import { z } from "zod";

export const dealBlackjackSchema = z
  .object({
    betAmount: z
      .number()
      .int("Bet amount must be an integer (credits)")
      .positive("Bet amount must be greater than zero"),
    clientSeed: z.string().trim().min(1).max(64),
    idempotencyKey: z.string().trim().min(1),
  })
  .strict();

export const actionBlackjackSchema = z
  .object({
    roundId: z.string().min(1),
  })
  .strict();

