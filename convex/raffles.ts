import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

const prizeInput = v.object({
  name: v.string(),
  description: v.optional(v.string()),
  position: v.number()
});

function requireAdmin(adminPassword: string) {
  const expected = process.env.ADMIN_PASSWORD || "admin";
  if (adminPassword !== expected) {
    throw new Error("Authentification admin invalide.");
  }
}

function normalizeExcludedNumbers(values: number[], min: number, max: number) {
  const unique = [...new Set(values.map((value) => Math.trunc(value)).filter(Number.isFinite))].sort((a, b) => a - b);
  for (const value of unique) {
    if (value < min || value > max) {
      throw new Error(`Le numéro exclu ${value} doit être compris dans la plage de la tombola.`);
    }
  }
  return unique;
}

function validateRaffleInput(args: { title: string; numberMin: number; numberMax: number; prizes: { name: string; position: number }[] }) {
  if (!args.title.trim()) {
    throw new Error("Le nom de la tombola est obligatoire.");
  }
  if (!Number.isInteger(args.numberMin) || !Number.isInteger(args.numberMax)) {
    throw new Error("La plage doit contenir des nombres entiers.");
  }
  if (args.numberMin > args.numberMax) {
    throw new Error("Le numéro minimum doit être inférieur ou égal au maximum.");
  }
  if (args.prizes.length === 0) {
    throw new Error("Ajoutez au moins un lot avant d'enregistrer.");
  }
  const positions = new Set(args.prizes.map((prize) => prize.position));
  if (positions.size !== args.prizes.length) {
    throw new Error("Chaque lot doit avoir un ordre d'attribution unique.");
  }
  for (const prize of args.prizes) {
    if (!prize.name.trim()) {
      throw new Error("Chaque lot doit avoir un nom.");
    }
  }
}

function slugify(value: string) {
  const base = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 46);
  return `${base || "tombola"}-${Date.now().toString(36)}`;
}

async function getPrizes(ctx: any, raffleId: Id<"raffles">) {
  return await ctx.db
    .query("prizes")
    .withIndex("by_raffle_position", (q) => q.eq("raffleId", raffleId))
    .collect();
}

async function getWinners(ctx: any, raffleId: Id<"raffles">) {
  return await ctx.db.query("winners").withIndex("by_raffle", (q) => q.eq("raffleId", raffleId)).collect();
}

export const listRaffles = query({
  args: {},
  handler: async (ctx) => {
    const raffles = await ctx.db.query("raffles").collect();
    const rows = await Promise.all(
      raffles.map(async (raffle) => {
        const prizes = await getPrizes(ctx, raffle._id);
        return { ...raffle, prizeCount: prizes.length };
      })
    );
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  }
});

export const getAdminRaffle = query({
  args: { raffleId: v.id("raffles") },
  handler: async (ctx, { raffleId }) => {
    const raffle = await ctx.db.get(raffleId);
    if (!raffle) return null;
    const [prizes, winners] = await Promise.all([getPrizes(ctx, raffleId), getWinners(ctx, raffleId)]);
    return { raffle, prizes, winners };
  }
});

export const getPublicRaffle = query({
  args: { publicSlug: v.string() },
  handler: async (ctx, { publicSlug }) => {
    const raffle = await ctx.db
      .query("raffles")
      .withIndex("by_slug", (q) => q.eq("publicSlug", publicSlug))
      .unique();
    if (!raffle) return null;
    const winners = raffle.status === "published" && raffle.showPublicWinners ? await getWinners(ctx, raffle._id) : [];
    const prizes = winners.length > 0 ? await getPrizes(ctx, raffle._id) : [];
    return { raffle, prizes, winners };
  }
});

export const createRaffle = mutation({
  args: {
    adminPassword: v.string(),
    title: v.string(),
    numberMin: v.number(),
    numberMax: v.number(),
    excludedNumbers: v.array(v.number()),
    showPublicWinners: v.boolean(),
    allowNumberLookup: v.boolean(),
    prizes: v.array(prizeInput)
  },
  handler: async (ctx, args) => {
    requireAdmin(args.adminPassword);
    validateRaffleInput(args);
    const excludedNumbers = normalizeExcludedNumbers(args.excludedNumbers, args.numberMin, args.numberMax);
    const now = Date.now();
    const raffleId = await ctx.db.insert("raffles", {
      title: args.title.trim(),
      publicSlug: slugify(args.title),
      numberMin: args.numberMin,
      numberMax: args.numberMax,
      excludedNumbers,
      showPublicWinners: args.showPublicWinners,
      allowNumberLookup: args.allowNumberLookup,
      status: "draft",
      createdAt: now,
      updatedAt: now
    });

    for (const prize of args.prizes) {
      await ctx.db.insert("prizes", {
        raffleId,
        name: prize.name.trim(),
        description: prize.description?.trim() || undefined,
        position: prize.position,
        createdAt: now,
        updatedAt: now
      });
    }

    const raffle = await ctx.db.get(raffleId);
    return { raffleId, publicSlug: raffle?.publicSlug ?? "" };
  }
});

export const updateRaffle = mutation({
  args: {
    adminPassword: v.string(),
    raffleId: v.id("raffles"),
    title: v.string(),
    numberMin: v.number(),
    numberMax: v.number(),
    excludedNumbers: v.array(v.number()),
    showPublicWinners: v.boolean(),
    allowNumberLookup: v.boolean(),
    prizes: v.array(prizeInput)
  },
  handler: async (ctx, args) => {
    requireAdmin(args.adminPassword);
    const raffle = await ctx.db.get(args.raffleId);
    if (!raffle) {
      throw new Error("Tombola introuvable.");
    }
    if (raffle.status !== "draft") {
      throw new Error("Cette tombola a déjà été tirée. Les paramètres ne peuvent plus être modifiés.");
    }
    validateRaffleInput(args);
    const excludedNumbers = normalizeExcludedNumbers(args.excludedNumbers, args.numberMin, args.numberMax);
    const now = Date.now();

    await ctx.db.patch(args.raffleId, {
      title: args.title.trim(),
      numberMin: args.numberMin,
      numberMax: args.numberMax,
      excludedNumbers,
      showPublicWinners: args.showPublicWinners,
      allowNumberLookup: args.allowNumberLookup,
      updatedAt: now
    });

    const existingPrizes = await getPrizes(ctx, args.raffleId);
    for (const prize of existingPrizes) {
      await ctx.db.delete(prize._id);
    }
    for (const prize of args.prizes) {
      await ctx.db.insert("prizes", {
        raffleId: args.raffleId,
        name: prize.name.trim(),
        description: prize.description?.trim() || undefined,
        position: prize.position,
        createdAt: now,
        updatedAt: now
      });
    }
  }
});

export const publishRaffle = mutation({
  args: { raffleId: v.id("raffles"), adminPassword: v.string() },
  handler: async (ctx, { raffleId, adminPassword }) => {
    requireAdmin(adminPassword);
    const raffle = await ctx.db.get(raffleId);
    if (!raffle) {
      throw new Error("Tombola introuvable.");
    }
    if (raffle.status !== "drawn") {
      throw new Error("La tombola doit être tirée avant publication.");
    }

    await ctx.db.patch(raffleId, {
      status: "published",
      publishedAt: Date.now(),
      updatedAt: Date.now()
    });
  }
});
