import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listPrizesForRaffle = query({
  args: {
    raffleId: v.id("raffles")
  },
  handler: async (ctx, { raffleId }) => {
    return await ctx.db
      .query("prizes")
      .withIndex("by_raffle_rank", (q) => q.eq("raffleId", raffleId))
      .collect();
  }
});

export const addPrize = mutation({
  args: {
    raffleId: v.id("raffles"),
    rank: v.number(),
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

    return await ctx.db.insert("prizes", args);
  }
});
