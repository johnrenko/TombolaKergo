import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listPrizesForRaffle = query({
  args: { raffleId: v.id("raffles") },
  handler: async (ctx, { raffleId }) => {
    return await ctx.db
      .query("prizes")
      .withIndex("by_raffle_position", (q) => q.eq("raffleId", raffleId))
      .collect();
  }
});

export const addPrize = mutation({
  args: {
    raffleId: v.id("raffles"),
    position: v.number(),
    name: v.string(),
    description: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const raffle = await ctx.db.get(args.raffleId);
    if (!raffle) {
      throw new Error("Tombola introuvable.");
    }
    if (raffle.status !== "draft") {
      throw new Error("Impossible d'ajouter un lot hors brouillon.");
    }

    const now = Date.now();
    return await ctx.db.insert("prizes", {
      ...args,
      name: args.name.trim(),
      description: args.description?.trim() || undefined,
      createdAt: now,
      updatedAt: now
    });
  }
});
