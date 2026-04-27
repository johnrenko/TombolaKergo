import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

const sessionDurationMs = 1000 * 60 * 60 * 24 * 14;
const defaultInviteDurationMs = 1000 * 60 * 60 * 24 * 7;
const passwordIterations = 120_000;
const defaultInviteMaxUses = 1;

type AdminUser = {
  _id: Id<"adminUsers">;
  email: string;
  name: string;
};

function bytesToHex(bytes: ArrayBuffer | Uint8Array) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return [...view].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function sha256(value: string) {
  return bytesToHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function hashPassword(password: string, salt: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: new TextEncoder().encode(salt),
      iterations: passwordIterations
    },
    key,
    256
  );
  return bytesToHex(bits);
}

function assertPassword(password: string) {
  if (password.length < 10) {
    throw new Error("Mot de passe trop court : utilisez au moins 10 caractères.");
  }
}

function adminInviteSecret() {
  return process.env.ADMIN_INVITE_SECRET || process.env.ADMIN_PASSWORD || "admin";
}

async function getSessionUser(ctx: QueryCtx | MutationCtx, sessionToken: string) {
  if (!sessionToken) return null;
  const tokenHash = await sha256(sessionToken);
  const session = await ctx.db
    .query("adminSessions")
    .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
    .unique();
  if (!session || session.revokedAt || session.expiresAt < Date.now()) {
    return null;
  }
  const user = await ctx.db.get(session.userId);
  if (!user) return null;
  return { session, user };
}

export async function requireAdminSession(ctx: MutationCtx, sessionToken: string): Promise<AdminUser> {
  const result = await getSessionUser(ctx, sessionToken);
  if (!result) {
    throw new Error("Session admin invalide ou expirée.");
  }
  await ctx.db.patch(result.session._id, { lastSeenAt: Date.now() });
  return {
    _id: result.user._id,
    email: result.user.email,
    name: result.user.name
  };
}

export async function requireAdmin(ctx: QueryCtx | MutationCtx, sessionToken: string): Promise<AdminUser> {
  const result = await getSessionUser(ctx, sessionToken);
  if (!result) {
    throw new Error("Session admin invalide ou expirée.");
  }
  return {
    _id: result.user._id,
    email: result.user.email,
    name: result.user.name
  };
}

export async function writeAudit(
  ctx: MutationCtx,
  actor: AdminUser | null,
  args: {
    action: string;
    entityType: string;
    entityId?: string;
    summary: string;
    metadata?: unknown;
  }
) {
  await ctx.db.insert("auditLogs", {
    actorUserId: actor?._id,
    actorEmail: actor?.email,
    action: args.action,
    entityType: args.entityType,
    entityId: args.entityId,
    summary: args.summary,
    metadata: args.metadata ? JSON.stringify(args.metadata) : undefined,
    createdAt: Date.now()
  });
}

async function createSession(ctx: MutationCtx, userId: Id<"adminUsers">) {
  const token = randomToken();
  const now = Date.now();
  await ctx.db.insert("adminSessions", {
    tokenHash: await sha256(token),
    userId,
    createdAt: now,
    lastSeenAt: now,
    expiresAt: now + sessionDurationMs
  });
  return token;
}

export const me = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const result = await getSessionUser(ctx, sessionToken);
    if (!result) return null;
    return {
      id: result.user._id,
      email: result.user.email,
      name: result.user.name,
      expiresAt: result.session.expiresAt
    };
  }
});

export const createInvite = mutation({
  args: {
    adminSecret: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    maxUses: v.optional(v.number()),
    expiresInHours: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    let actor: AdminUser | null = null;
    if (args.sessionToken) {
      actor = await requireAdminSession(ctx, args.sessionToken);
    } else if (args.adminSecret !== adminInviteSecret()) {
      throw new Error("Secret d’invitation invalide.");
    }

    const token = randomToken();
    const now = Date.now();
    const expiresAt = now + Math.max(1, args.expiresInHours ?? defaultInviteDurationMs / (1000 * 60 * 60)) * 60 * 60 * 1000;
    const maxUses = Math.max(1, Math.floor(args.maxUses ?? defaultInviteMaxUses));
    await ctx.db.insert("adminInvites", {
      tokenHash: await sha256(token),
      token,
      maxUses,
      usedCount: 0,
      createdByUserId: actor?._id,
      expiresAt,
      createdAt: now
    });
    await writeAudit(ctx, actor, {
      action: "admin_invite.created",
      entityType: "adminInvite",
      summary: `Invitation admin générée pour ${maxUses} compte${maxUses > 1 ? "s" : ""}.`,
      metadata: { maxUses, expiresAt }
    });
    return {
      token,
      signupPath: `/admin/signup?token=${token}`,
      expiresAt
    };
  }
});

export const listActiveInvites = query({
  args: {
    sessionToken: v.string(),
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const now = Date.now();
    const maxRows = Math.min(Math.max(1, Math.floor(args.limit ?? 50)), 100);
    const invites = await ctx.db
      .query("adminInvites")
      .withIndex("by_expiresAt", (q) => q.gt("expiresAt", now))
      .take(maxRows);

    return invites
      .map((invite) => {
        const maxUses = invite.maxUses ?? 1;
        const usedCount = invite.usedCount ?? (invite.usedAt ? 1 : 0);
        return {
          id: invite._id,
          signupPath: invite.token ? `/admin/signup?token=${invite.token}` : null,
          maxUses,
          usedCount,
          remainingUses: Math.max(0, maxUses - usedCount),
          createdAt: invite.createdAt,
          expiresAt: invite.expiresAt
        };
      })
      .filter((invite) => invite.remainingUses > 0);
  }
});

export const acceptInvite = mutation({
  args: {
    token: v.string(),
    email: v.string(),
    name: v.string(),
    password: v.string()
  },
  handler: async (ctx, args) => {
    assertPassword(args.password);
    const tokenHash = await sha256(args.token);
    const invite = await ctx.db
      .query("adminInvites")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    if (!invite || invite.usedAt || invite.expiresAt < Date.now()) {
      throw new Error("Lien d’invitation expiré ou déjà utilisé.");
    }
    const maxUses = invite.maxUses ?? 1;
    const usedCount = invite.usedCount ?? (invite.usedAt ? 1 : 0);
    if (usedCount >= maxUses) {
      throw new Error("Lien d’invitation expiré ou déjà utilisé.");
    }

    const email = normalizeEmail(args.email);
    const existingUser = await ctx.db.query("adminUsers").withIndex("by_email", (q) => q.eq("email", email)).unique();
    if (existingUser) {
      throw new Error("Un compte existe déjà pour cette adresse.");
    }

    const now = Date.now();
    const salt = randomToken(16);
    const userId = await ctx.db.insert("adminUsers", {
      email,
      name: args.name.trim() || email,
      passwordSalt: salt,
      passwordHash: await hashPassword(args.password, salt),
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now
    });
    const nextUsedCount = usedCount + 1;
    const invitePatch: { usedCount: number; usedByUserId: Id<"adminUsers">; usedAt?: number } = {
      usedCount: nextUsedCount,
      usedByUserId: userId
    };
    if (nextUsedCount >= maxUses) {
      invitePatch.usedAt = now;
    }
    await ctx.db.patch(invite._id, invitePatch);
    const user = await ctx.db.get(userId);
    const actor = user ? { _id: user._id, email: user.email, name: user.name } : null;
    await writeAudit(ctx, actor, {
      action: "admin_user.created",
      entityType: "adminUser",
      entityId: userId,
      summary: `Compte admin créé pour ${email}.`
    });
    return {
      sessionToken: await createSession(ctx, userId),
      user: { id: userId, email, name: user?.name ?? email }
    };
  }
});

export const login = mutation({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    const user = await ctx.db.query("adminUsers").withIndex("by_email", (q) => q.eq("email", email)).unique();
    if (!user) {
      throw new Error("Identifiants invalides : aucun compte ne correspond à cet email et ce mot de passe.");
    }
    const passwordHash = await hashPassword(args.password, user.passwordSalt);
    if (passwordHash !== user.passwordHash) {
      throw new Error("Identifiants invalides : aucun compte ne correspond à cet email et ce mot de passe.");
    }
    await ctx.db.patch(user._id, { lastLoginAt: Date.now() });
    await writeAudit(ctx, { _id: user._id, email: user.email, name: user.name }, {
      action: "admin_session.created",
      entityType: "adminUser",
      entityId: user._id,
      summary: `${user.email} s’est connecté.`
    });
    return {
      sessionToken: await createSession(ctx, user._id),
      user: { id: user._id, email: user.email, name: user.name }
    };
  }
});

export const resetPassword = mutation({
  args: {
    adminSecret: v.string(),
    email: v.string(),
    password: v.string()
  },
  handler: async (ctx, args) => {
    if (args.adminSecret !== adminInviteSecret()) {
      throw new Error("Secret d’invitation invalide.");
    }
    assertPassword(args.password);
    const email = normalizeEmail(args.email);
    const user = await ctx.db.query("adminUsers").withIndex("by_email", (q) => q.eq("email", email)).unique();
    if (!user) {
      throw new Error("Aucun compte admin ne correspond à cet email.");
    }

    const now = Date.now();
    const salt = randomToken(16);
    await ctx.db.patch(user._id, {
      passwordSalt: salt,
      passwordHash: await hashPassword(args.password, salt),
      updatedAt: now
    });
    const sessions = await ctx.db.query("adminSessions").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();
    for (const session of sessions) {
      if (!session.revokedAt) {
        await ctx.db.patch(session._id, { revokedAt: now });
      }
    }
    await writeAudit(ctx, { _id: user._id, email: user.email, name: user.name }, {
      action: "admin_user.password_reset",
      entityType: "adminUser",
      entityId: user._id,
      summary: `Mot de passe admin réinitialisé pour ${email}.`
    });
    return { ok: true };
  }
});

export const logout = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const result = await getSessionUser(ctx, sessionToken);
    if (!result) return;
    await ctx.db.patch(result.session._id, { revokedAt: Date.now() });
    await writeAudit(ctx, { _id: result.user._id, email: result.user.email, name: result.user.name }, {
      action: "admin_session.revoked",
      entityType: "adminUser",
      entityId: result.user._id,
      summary: `${result.user.email} s’est déconnecté.`
    });
  }
});

export const listAuditLogs = query({
  args: { sessionToken: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { sessionToken, limit }) => {
    const result = await getSessionUser(ctx, sessionToken);
    if (!result) {
      throw new Error("Session admin invalide ou expirée.");
    }
    const logs = await ctx.db.query("auditLogs").withIndex("by_createdAt").order("desc").take(limit ?? 100);
    return logs;
  }
});
