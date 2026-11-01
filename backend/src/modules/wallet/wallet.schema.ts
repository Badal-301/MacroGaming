import { z } from "zod";

export const depositSchema = z
  .object({
    amount: z
      .number()
      .int("Amount must be an integer (no floats allowed)")
      .positive("Deposit amount must be strictly greater than zero"),
    idempotencyKey: z
      .string()
      .trim()
      .min(1, "Idempotency-Key cannot be empty"),
    gatewayReference: z.string().optional(),
  })
  .strict();

export const withdrawSchema = z
  .object({
    amount: z
      .number()
      .int("Amount must be an integer (no floats allowed)")
      .positive("Withdrawal amount must be strictly greater than zero"),
    idempotencyKey: z
      .string()
      .trim()
      .min(1, "Idempotency-Key cannot be empty"),
    gatewayReference: z.string().optional(),
  })
  .strict();

export const paginationSchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  });
