import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  raffles: defineTable({
    name: v.string(),
    status: v.union(v.literal("draft"), v.literal("drawn"), v.literal("published")),
    publicSlug: v.string(),
    numberMin: v.number(),
    numberMax: v.number(),
    excludedNumbers: v.array(v.number()),
    showAllWinners: v.boolean(),
    allowNumberCheck: v.boolean(),
    drawAt: v.optional(v.number()),
    publishedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_slug", ["publicSlug"])
    .index("by_status", ["status"]),

  prizes: defineTable({
    raffleId: v.id("raffles"),
    rank: v.number(),
    name: v.string(),
    description: v.optional(v.string())
  })
    .index("by_raffle", ["raffleId"])
    .index("by_raffle_rank", ["raffleId", "rank"]),

  winners: defineTable({
    raffleId: v.id("raffles"),
    prizeId: v.id("prizes"),
    winningNumber: v.number(),
    rank: v.number(),
    createdAt: v.number()
  })
    .index("by_raffle", ["raffleId"])
    .index("by_raffle_number", ["raffleId", "winningNumber"])
});
