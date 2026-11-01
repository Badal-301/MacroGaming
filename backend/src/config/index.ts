import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z
    .string()
    .default("postgresql://postgres:postgres@localhost:5432/gaming_simulation?schema=public"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  JWT_SECRET: z.string().default("educational_simulation_jwt_secret_key_32bytes_min!"),
  JWT_REFRESH_SECRET: z.string().default("educational_simulation_refresh_secret_key_32bytes!"),
  ACCESS_TOKEN_EXPIRY: z.string().default("15m"),
  REFRESH_TOKEN_EXPIRY_DAYS: z.coerce.number().default(7),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  ROW_LOCKING_ENABLED: z.string().default("true").transform((v) => v !== "false"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.format());
  throw new Error("Invalid configuration");
}

export const config = parsed.data;
