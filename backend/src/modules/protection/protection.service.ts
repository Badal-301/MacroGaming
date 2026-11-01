import { db } from "../../db/repository.js";
import { protectionConfig } from "../../config/protection.config.js";

// In-memory tracker for consecutive losses per user
const userConsecutiveLosses = new Map<string, number>();

export class ProtectionService {
  /**
   * Evaluates all responsible gambling rules before accepting any bet
   */
  static async checkCanBet(
    userId: string,
    betAmount: number
  ): Promise<{ allowed: boolean; reason?: string; details?: any }> {
    const user = await db.findUserById(userId);
    if (!user) {
      return { allowed: false, reason: "User not found" };
    }

    const now = new Date();

    // 1. Check Self-Exclusion
    if (user.self_excluded_until && new Date(user.self_excluded_until) > now) {
      const remainingDays = Math.ceil(
        (new Date(user.self_excluded_until).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        allowed: false,
        reason: `Account self-excluded for responsible gambling. Remaining time: ${remainingDays} day(s). Bets are locked.`,
        details: { selfExcludedUntil: user.self_excluded_until },
      };
    }

    // 2. Check Cooldown
    if (user.cooldown_until && new Date(user.cooldown_until) > now) {
      const remainingSeconds = Math.ceil(
        (new Date(user.cooldown_until).getTime() - now.getTime()) / 1000
      );
      const remainingMinutes = Math.ceil(remainingSeconds / 60);
      return {
        allowed: false,
        reason: `Loss streak cooldown active. Please take a break for ${remainingMinutes} more minute(s).`,
        details: { cooldownUntil: user.cooldown_until, remainingSeconds },
      };
    }

    // 3. Check Session Bet Limit
    if (user.user_limits) {
      const sessionLimit = user.user_limits.session_bet_limit;
      if (betAmount > sessionLimit) {
        return {
          allowed: false,
          reason: `Bet amount (${betAmount} credits) exceeds your configured session bet limit (${sessionLimit} credits).`,
          details: { sessionLimit },
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Check before accepting any deposit
   */
  static async checkCanDeposit(
    userId: string,
    depositAmount: number
  ): Promise<{ allowed: boolean; reason?: string }> {
    const user = await db.findUserById(userId);
    if (!user) {
      return { allowed: false, reason: "User not found" };
    }

    const now = new Date();

    // Cannot deposit while self-excluded
    if (user.self_excluded_until && new Date(user.self_excluded_until) > now) {
      return {
        allowed: false,
        reason: "Account is self-excluded. Deposits are prohibited until the exclusion period expires.",
      };
    }

    // Check deposit limit
    if (user.user_limits) {
      const depositLimit = user.user_limits.deposit_limit;
      if (depositAmount > depositLimit) {
        return {
          allowed: false,
          reason: `Deposit amount (${depositAmount} credits) exceeds your personal limit of ${depositLimit} credits.`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Track consecutive losses and automatically trigger cooldown
   */
  static async handleRoundLoss(userId: string) {
    const current = (userConsecutiveLosses.get(userId) || 0) + 1;
    userConsecutiveLosses.set(userId, current);

    if (current >= protectionConfig.CONSECUTIVE_LOSS_TRIGGER) {
      // Trigger mandatory cooldown
      const cooldownUntil = new Date(
        Date.now() + protectionConfig.COOLDOWN_DURATION_MINUTES * 60 * 1000
      );
      await db.updateUser(userId, { cooldown_until: cooldownUntil });
      userConsecutiveLosses.set(userId, 0); // Reset counter

      return {
        triggeredCooldown: true,
        cooldownUntil,
        durationMinutes: protectionConfig.COOLDOWN_DURATION_MINUTES,
      };
    }

    return { triggeredCooldown: false, consecutiveLosses: current };
  }

  /**
   * Reset consecutive loss counter on win
   */
  static handleRoundWin(userId: string) {
    userConsecutiveLosses.set(userId, 0);
  }

  /**
   * Self-exclusion action
   */
  static async setSelfExclusion(userId: string, days: number) {
    if (
      days < protectionConfig.MIN_SELF_EXCLUSION_DAYS ||
      days > protectionConfig.MAX_SELF_EXCLUSION_DAYS
    ) {
      throw {
        status: 400,
        message: `Self-exclusion period must be between ${protectionConfig.MIN_SELF_EXCLUSION_DAYS} and ${protectionConfig.MAX_SELF_EXCLUSION_DAYS} days`,
      };
    }

    const user = await db.findUserById(userId);
    if (!user) {
      throw { status: 404, message: "User not found" };
    }

    const selfExcludedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await db.updateUser(userId, { self_excluded_until: selfExcludedUntil });

    return {
      success: true,
      selfExcludedUntil,
      message: `Account successfully self-excluded for ${days} days. Gaming and deposit features are locked.`,
    };
  }

  /**
   * Update personal limits
   */
  static async updateLimits(
    userId: string,
    limits: { sessionBetLimit?: number; depositLimit?: number }
  ) {
    const user = await db.findUserById(userId);
    if (!user) {
      throw { status: 404, message: "User not found" };
    }

    if (user.user_limits) {
      user.user_limits.session_bet_limit =
        limits.sessionBetLimit ?? user.user_limits.session_bet_limit;
      user.user_limits.deposit_limit =
        limits.depositLimit ?? user.user_limits.deposit_limit;
    }

    return {
      success: true,
      limits: user.user_limits,
    };
  }

  static clearLossTrackers() {
    userConsecutiveLosses.clear();
  }
}

