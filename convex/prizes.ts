import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin, requireAdminSession, writeAudit } from "./auth";

export const listPrizesForRaffle = query({
  args: { raffleId: v.id("raffles"), sessionToken: v.string() },
  handler: async (ctx, { raffleId, sessionToken }) => {
    await requireAdmin(ctx, sessionToken);
    return await ctx.db
      .query("prizes")
      .withIndex("by_raffle_position", (q) => q.eq("raffleId", raffleId))
      .collect();
  }
});

export const addPrize = mutation({
  args: {
    raffleId: v.id("raffles"),
    sessionToken: v.string(),
    position: v.number(),
    emoji: v.optional(v.string()),
    name: v.string(),
    description: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const actor = await requireAdminSession(ctx, args.sessionToken);
    const raffle = await ctx.db.get(args.raffleId);
    if (!raffle) {
      throw new Error("Tombola introuvable.");
    }
    if (raffle.status !== "draft") {
      throw new Error("Impossible d'ajouter un lot hors brouillon.");
    }

    const now = Date.now();
    const prizeId = await ctx.db.insert("prizes", {
      raffleId: args.raffleId,
      position: args.position,
      name: args.name.trim(),
      emoji: args.emoji?.trim() || "🎁",
      description: args.description?.trim() || undefined,
      createdAt: now,
      updatedAt: now
    });
    await writeAudit(ctx, actor, {
      action: "prize.created",
      entityType: "prize",
      entityId: prizeId,
      summary: `${actor.email} a ajouté le lot "${args.name.trim()}".`,
      metadata: { raffleId: args.raffleId, position: args.position }
    });
    return prizeId;
  }
});
