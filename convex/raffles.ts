import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const raffleStatus = v.union(v.literal("draft"), v.literal("drawn"), v.literal("published"));

export const listRaffles = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("raffles").collect();
  }
});

export const createRaffle = mutation({
  args: {
    name: v.string(),
    publicSlug: v.string(),
    numberMin: v.number(),
    numberMax: v.number(),
    excludedNumbers: v.array(v.number()),
    showAllWinners: v.boolean(),
    allowNumberCheck: v.boolean()
  },
  handler: async (ctx, args) => {
    if (args.numberMin >= args.numberMax) {
      throw new Error("Le numéro minimum doit être strictement inférieur au maximum.");
    }

    const now = Date.now();
    return await ctx.db.insert("raffles", {
      ...args,
      status: "draft",
      createdAt: now,
      updatedAt: now
    });
  }
});

export const publishRaffle = mutation({
  args: {
    raffleId: v.id("raffles")
  },
  handler: async (ctx, { raffleId }) => {
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

export const setRaffleStatus = mutation({
  args: {
    raffleId: v.id("raffles"),
    status: raffleStatus
  },
  handler: async (ctx, { raffleId, status }) => {
    const raffle = await ctx.db.get(raffleId);
    if (!raffle) {
      throw new Error("Tombola introuvable.");
    }

    await ctx.db.patch(raffleId, {
      status,
      drawAt: status === "drawn" ? Date.now() : raffle.drawAt,
      updatedAt: Date.now()
    });
  }
});
