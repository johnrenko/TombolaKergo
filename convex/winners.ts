import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

function randomPick(values: number[]) {
  const idx = Math.floor(Math.random() * values.length);
  return values[idx];
}

export const runDraw = mutation({
  args: {
    raffleId: v.id("raffles")
  },
  handler: async (ctx, { raffleId }) => {
    const raffle = await ctx.db.get(raffleId);
    if (!raffle) {
      throw new Error("Tombola introuvable.");
    }
    if (raffle.status !== "draft") {
      throw new Error("Le tirage ne peut être lancé que depuis le statut draft.");
    }

    const prizes = await ctx.db
      .query("prizes")
      .withIndex("by_raffle_rank", (q) => q.eq("raffleId", raffleId))
      .collect();

    if (prizes.length === 0) {
      throw new Error("Aucun lot configuré.");
    }

    const excluded = new Set(raffle.excludedNumbers);
    const available: number[] = [];
    for (let i = raffle.numberMin; i <= raffle.numberMax; i += 1) {
      if (!excluded.has(i)) available.push(i);
    }

    if (available.length < prizes.length) {
      throw new Error("Pas assez de numéros disponibles pour attribuer tous les lots.");
    }

    for (const prize of prizes) {
      const winningNumber = randomPick(available);
      available.splice(available.indexOf(winningNumber), 1);
      await ctx.db.insert("winners", {
        raffleId,
        prizeId: prize._id,
        winningNumber,
        rank: prize.rank,
        createdAt: Date.now()
      });
    }

    await ctx.db.patch(raffleId, {
      status: "drawn",
      drawAt: Date.now(),
      updatedAt: Date.now()
    });
  }
});

export const listWinnersByRaffle = query({
  args: {
    raffleId: v.id("raffles")
  },
  handler: async (ctx, { raffleId }) => {
    return await ctx.db
      .query("winners")
      .withIndex("by_raffle", (q) => q.eq("raffleId", raffleId))
      .collect();
  }
});
