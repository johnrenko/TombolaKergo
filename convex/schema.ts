import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const status = v.union(v.literal("draft"), v.literal("drawn"), v.literal("published"));

export default defineSchema({
  raffles: defineTable({
    title: v.string(),
    status,
    publicSlug: v.string(),
    numberMin: v.number(),
    numberMax: v.number(),
    excludedNumbers: v.array(v.number()),
    showPublicWinners: v.boolean(),
    allowNumberLookup: v.boolean(),
    drawnAt: v.optional(v.number()),
    publishedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_slug", ["publicSlug"])
    .index("by_status", ["status"]),

  prizes: defineTable({
    raffleId: v.id("raffles"),
    position: v.number(),
    name: v.string(),
    description: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_raffle", ["raffleId"])
    .index("by_raffle_position", ["raffleId", "position"]),

  winners: defineTable({
    raffleId: v.id("raffles"),
    prizeId: v.id("prizes"),
    winningNumber: v.number(),
    position: v.number(),
    createdAt: v.number()
  })
    .index("by_raffle", ["raffleId"])
    .index("by_raffle_number", ["raffleId", "winningNumber"]),

  drawAudits: defineTable({
    raffleId: v.id("raffles"),
    drawnAt: v.number(),
    drawnByUserId: v.optional(v.string()),
    numberMinSnapshot: v.number(),
    numberMaxSnapshot: v.number(),
    excludedNumbersSnapshot: v.array(v.number()),
    prizesSnapshot: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        description: v.optional(v.string()),
        position: v.number()
      })
    ),
    resultsSnapshot: v.array(
      v.object({
        prizeId: v.string(),
        prizeName: v.string(),
        position: v.number(),
        winningNumber: v.number()
      })
    ),
    algorithm: v.string(),
    createdAt: v.number()
  }).index("by_raffle", ["raffleId"])
});
