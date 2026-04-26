import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

function requireAdmin(adminPassword: string) {
  const expected = process.env.ADMIN_PASSWORD || "admin";
  if (adminPassword !== expected) {
    throw new Error("Authentification admin invalide.");
  }
}

function randomInt(maxExclusive: number) {
  if (maxExclusive <= 0) {
    throw new Error("Invalid random range.");
  }
  const maxUint32 = 0xffffffff;
  const limit = maxUint32 - (maxUint32 % maxExclusive);
  const buffer = new Uint32Array(1);
  let value = 0;
  do {
    crypto.getRandomValues(buffer);
    value = buffer[0];
  } while (value >= limit);
  return value % maxExclusive;
}

function secureShuffle(values: number[]) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function listPrizes(ctx: any, raffleId: any) {
  return await ctx.db
    .query("prizes")
    .withIndex("by_raffle_position", (q) => q.eq("raffleId", raffleId))
    .collect();
}

export const runDraw = mutation({
  args: { raffleId: v.id("raffles"), adminPassword: v.string() },
  handler: async (ctx, { raffleId, adminPassword }) => {
    requireAdmin(adminPassword);
    const raffle = await ctx.db.get(raffleId);
    if (!raffle) {
      throw new Error("Tombola introuvable.");
    }
    if (raffle.status !== "draft") {
      throw new Error("Le tirage ne peut être lancé que depuis le statut draft.");
    }

    const existingWinners = await ctx.db.query("winners").withIndex("by_raffle", (q) => q.eq("raffleId", raffleId)).collect();
    if (existingWinners.length > 0) {
      throw new Error("Cette tombola possède déjà des résultats.");
    }

    const prizes = await listPrizes(ctx, raffleId);
    if (prizes.length === 0) {
      throw new Error("Aucun lot configuré.");
    }

    const excluded = new Set(raffle.excludedNumbers);
    const available: number[] = [];
    for (let i = raffle.numberMin; i <= raffle.numberMax; i += 1) {
      if (!excluded.has(i)) available.push(i);
    }

    if (available.length < prizes.length) {
      throw new Error("Il n’y a pas assez de numéros disponibles pour attribuer tous les lots.");
    }

    const shuffledNumbers = secureShuffle(available);
    const orderedPrizes = [...prizes].sort((a, b) => a.position - b.position);
    const now = Date.now();
    const results = orderedPrizes.map((prize, index) => ({
      prize,
      winningNumber: shuffledNumbers[index]
    }));

    for (const result of results) {
      await ctx.db.insert("winners", {
        raffleId,
        prizeId: result.prize._id,
        winningNumber: result.winningNumber,
        position: result.prize.position,
        createdAt: now
      });
    }

    await ctx.db.insert("drawAudits", {
      raffleId,
      drawnAt: now,
      numberMinSnapshot: raffle.numberMin,
      numberMaxSnapshot: raffle.numberMax,
      excludedNumbersSnapshot: raffle.excludedNumbers,
      prizesSnapshot: orderedPrizes.map((prize) => ({
        id: prize._id,
        name: prize.name,
        description: prize.description,
        position: prize.position
      })),
      resultsSnapshot: results.map((result) => ({
        prizeId: result.prize._id,
        prizeName: result.prize.name,
        position: result.prize.position,
        winningNumber: result.winningNumber
      })),
      algorithm: "web-crypto-fisher-yates-v1",
      createdAt: now
    });

    await ctx.db.patch(raffleId, {
      status: "drawn",
      drawnAt: now,
      updatedAt: now
    });
  }
});

export const listWinnersByRaffle = query({
  args: { raffleId: v.id("raffles") },
  handler: async (ctx, { raffleId }) => {
    return await ctx.db.query("winners").withIndex("by_raffle", (q) => q.eq("raffleId", raffleId)).collect();
  }
});

export const checkNumber = query({
  args: {
    publicSlug: v.string(),
    number: v.number()
  },
  handler: async (ctx, { publicSlug, number }) => {
    const raffle = await ctx.db
      .query("raffles")
      .withIndex("by_slug", (q) => q.eq("publicSlug", publicSlug))
      .unique();
    if (!raffle || raffle.status !== "published") {
      return { status: "not_published" as const };
    }
    if (!raffle.allowNumberLookup) {
      return { status: "lookup_disabled" as const, message: "La recherche par numéro n’est pas activée." };
    }
    if (!Number.isInteger(number) || number < raffle.numberMin || number > raffle.numberMax) {
      return { status: "invalid_number" as const, message: "Ce numéro ne fait pas partie de cette tombola." };
    }
    if (raffle.excludedNumbers.includes(number)) {
      return { status: "excluded_number" as const, message: "Ce numéro n’est pas éligible pour cette tombola." };
    }

    const winner = await ctx.db
      .query("winners")
      .withIndex("by_raffle_number", (q) => q.eq("raffleId", raffle._id).eq("winningNumber", number))
      .unique();

    if (!winner) {
      return { status: "losing_number" as const, number };
    }

    const prize = await ctx.db.get(winner.prizeId);
    return {
      status: "winning_number" as const,
      number,
      prize: {
        name: prize?.name ?? "Lot",
        description: prize?.description,
        position: prize?.position ?? winner.position
      }
    };
  }
});
