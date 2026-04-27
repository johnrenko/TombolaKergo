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
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    showPublicWinners: v.boolean(),
    allowNumberLookup: v.boolean(),
    drawnAt: v.optional(v.number()),
    publishedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_slug", ["publicSlug"])
    .index("by_status", ["status"]),

  adminUsers: defineTable({
    email: v.string(),
    name: v.string(),
    passwordHash: v.string(),
    passwordSalt: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastLoginAt: v.optional(v.number())
  }).index("by_email", ["email"]),

  adminInvites: defineTable({
    tokenHash: v.string(),
    token: v.optional(v.string()),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    maxUses: v.optional(v.number()),
    usedCount: v.optional(v.number()),
    createdByUserId: v.optional(v.id("adminUsers")),
    usedByUserId: v.optional(v.id("adminUsers")),
    usedAt: v.optional(v.number()),
    expiresAt: v.number(),
    createdAt: v.number()
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_createdAt", ["createdAt"])
    .index("by_expiresAt", ["expiresAt"]),

  adminSessions: defineTable({
    tokenHash: v.string(),
    userId: v.id("adminUsers"),
    expiresAt: v.number(),
    createdAt: v.number(),
    lastSeenAt: v.number(),
    revokedAt: v.optional(v.number())
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_user", ["userId"]),

  auditLogs: defineTable({
    actorUserId: v.optional(v.id("adminUsers")),
    actorEmail: v.optional(v.string()),
    action: v.string(),
    entityType: v.string(),
    entityId: v.optional(v.string()),
    summary: v.string(),
    metadata: v.optional(v.string()),
    createdAt: v.number()
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_actor", ["actorUserId"]),

  prizes: defineTable({
    raffleId: v.id("raffles"),
    position: v.number(),
    emoji: v.optional(v.string()),
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
        emoji: v.optional(v.string()),
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
