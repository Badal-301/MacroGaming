import crypto from "crypto";
import argon2 from "argon2";
import jwt, { SignOptions } from "jsonwebtoken";
import { config } from "../config/index.js";

/**
 * Hash password with salted argon2
 */
export async function hashPassword(password: string): Promise<string> {
  return await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

/**
 * Verify password against argon2 hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/**
 * SHA-256 hash using Node's built-in crypto
 */
export function sha256(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * HMAC-SHA256 using Node's built-in crypto
 */
export function hmacSha256(key: string, message: string): string {
  return crypto.createHmac("sha256", key).update(message).digest("hex");
}

/**
 * Secure random bytes hex
 */
export function randomBytesHex(length: number = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: "player" | "admin";
}

/**
 * Generate 15-minute access token
 */
export function generateAccessToken(payload: TokenPayload): string {
  const options: SignOptions = {
    expiresIn: config.ACCESS_TOKEN_EXPIRY as any,
  };
  return jwt.sign(payload, config.JWT_SECRET, options);
}

/**
 * Generate refresh token (random bytes token + stored hash)
 */
export function generateRefreshToken(): { token: string; hash: string; expiresAt: Date } {
  const token = crypto.randomBytes(40).toString("hex");
  const hash = sha256(token);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + config.REFRESH_TOKEN_EXPIRY_DAYS);

  return { token, hash, expiresAt };
}

/**
 * Verify access token
 */
export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, config.JWT_SECRET) as TokenPayload;
}

