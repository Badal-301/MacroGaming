import { z } from "zod";

export const registerSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, "Email is required")
      .email("Invalid email format"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters long")
      .regex(/[a-zA-Z]/, "Password must contain at least one letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    role: z.enum(["player", "admin"]).optional().default("player"),
  })
  .strict(); // Reject unknown fields

export const loginSchema = z
  .object({
    email: z.string().trim().min(1, "Email is required").email("Invalid email format"),
    password: z.string().min(1, "Password is required"),
  })
  .strict();

export const refreshTokenSchema = z
  .object({
    refreshToken: z.string().min(1, "Refresh token is required"),
  })
  .strict();
