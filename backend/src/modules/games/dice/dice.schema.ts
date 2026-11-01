import { z } from "zod";

export const startDiceRoundSchema = z.object({
  clientSeed: z.string().trim().max(64).optional(),
});

export const playDiceSchema = z.object({
  roundId: z.string().min(1, "Round ID is required"),
  clientSeed: z.string().trim().min(1, "Client seed is required").max(64),
  target: z
    .number()
    .min(1.0, "Target must be at least 1.00")
    .max(98.0, "Target must be at most 98.00"),
  betAmount: z
    .number()
    .int("Bet amount must be an integer (credits)")
    .positive("Bet amount must be strictly greater than 0"),
  idempotencyKey: z.string().trim().min(1, "Idempotency key is required"),
  // Any client-supplied outcome or payout fields are allowed by the parser so they don't break the HTTP request,
  // but are strictly ignored by the game engine (TC9 verification)
  outcome: z.any().optional(),
  payoutAmount: z.any().optional(),
  won: z.any().optional(),
});

export const verifySchema = z.object({
  serverSeed: z.string().trim().min(1, "Server seed is required"),
  serverSeedHash: z.string().trim().min(1, "Server seed hash is required"),
  clientSeed: z.string().trim().min(1, "Client seed is required"),
  nonce: z.number().int().positive("Nonce must be positive integer"),
});

