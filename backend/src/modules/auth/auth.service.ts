import { db } from "../../db/repository.js";
import {
  hashPassword,
  verifyPassword,
  sha256,
  generateAccessToken,
  generateRefreshToken,
} from "../../utils/crypto.js";

export class AuthService {
  static async register(data: { email: string; password: string; role?: "player" | "admin" }) {
    // Check if user already exists
    const existing = await db.findUserByEmail(data.email);
    if (existing) {
      throw { status: 409, message: "User with this email already exists" };
    }

    // Salt and hash password with Argon2
    const password_hash = await hashPassword(data.password);

    // Create user and wallet atomically
    const user = await db.createUser({
      email: data.email,
      password_hash,
      role: data.role || "player",
    });

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      walletId: user.wallet?.id,
      createdAt: user.created_at,
    };
  }

  static async login(data: { email: string; password: string }) {
    const user = await db.findUserByEmail(data.email);
    if (!user) {
      throw { status: 401, message: "Invalid email or password" };
    }

    const isValid = await verifyPassword(data.password, user.password_hash);
    if (!isValid) {
      throw { status: 401, message: "Invalid email or password" };
    }

    // Generate 15-minute access token
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Generate refresh token and save its SHA-256 hash
    const { token: refreshToken, hash: tokenHash, expiresAt } = generateRefreshToken();
    await db.createRefreshToken(user.id, tokenHash, expiresAt);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        walletId: user.wallet?.id,
      },
    };
  }

  static async refresh(oldRefreshToken: string) {
    const tokenHash = sha256(oldRefreshToken);
    const stored = await db.findRefreshToken(tokenHash);

    if (!stored) {
      throw { status: 401, message: "Invalid refresh token" };
    }

    if (stored.revoked_at) {
      // Possible token reuse attempt: revoke all tokens for this user
      await db.revokeAllUserRefreshTokens(stored.user_id);
      throw { status: 401, message: "Refresh token has been revoked" };
    }

    if (new Date() > new Date(stored.expires_at)) {
      throw { status: 401, message: "Refresh token has expired" };
    }

    // Revoke the old refresh token
    await db.revokeRefreshToken(tokenHash);

    const user = stored.user || (await db.findUserById(stored.user_id));
    if (!user) {
      throw { status: 401, message: "User not found" };
    }

    // Issue new access token and new refresh token (token rotation)
    const newAccessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const { token: newRefreshToken, hash: newHash, expiresAt } = generateRefreshToken();
    await db.createRefreshToken(user.id, newHash, expiresAt);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  static async logout(refreshToken: string) {
    const tokenHash = sha256(refreshToken);
    await db.revokeRefreshToken(tokenHash);
    return { success: true, message: "Logged out successfully" };
  }

  static async getMe(userId: string) {
    const user = await db.findUserById(userId);
    if (!user) {
      throw { status: 404, message: "User not found" };
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      walletId: user.wallet?.id,
      createdAt: user.created_at,
      selfExcludedUntil: user.self_excluded_until,
      cooldownUntil: user.cooldown_until,
      limits: user.user_limits,
    };
  }
}

