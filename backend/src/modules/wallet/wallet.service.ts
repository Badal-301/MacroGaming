import { db } from "../../db/repository.js";
import { MockPaymentGateway } from "./gateway.mock.js";
import { emitBalanceUpdate } from "../realtime/socket.js";
import { ProtectionService } from "../protection/protection.service.js";

export class WalletService {
  static async getWallet(userId: string) {
    const wallet = await db.getWalletByUserId(userId);
    if (!wallet) {
      throw { status: 404, message: "Wallet not found for this user" };
    }
    return wallet;
  }

  static async getBalance(userId: string) {
    const wallet = await this.getWallet(userId);
    const balance = await db.getBalance(wallet.id);
    return {
      walletId: wallet.id,
      balance,
    };
  }

  static async deposit(
    userId: string,
    amount: number,
    idempotencyKey: string,
    gatewayRef?: string,
    options?: { disableLocking?: boolean }
  ) {
    if (amount <= 0 || !Number.isInteger(amount)) {
      throw { status: 400, message: "Deposit amount must be a positive integer" };
    }

    // Responsible Gaming Protection Check (FR13)
    const protection = await ProtectionService.checkCanDeposit(userId, amount);
    if (!protection.allowed) {
      throw { status: 403, message: protection.reason };
    }

    const wallet = await this.getWallet(userId);

    // 1. Idempotency Check: if key already exists, return earlier result
    const existing = await db.findLedgerEntryByIdempotencyKey(idempotencyKey);
    if (existing) {
      const currentBalance = await db.getBalance(wallet.id);
      return {
        success: true,
        isDuplicate: true,
        message: "Idempotent request: transaction previously completed",
        entry: existing,
        balance: currentBalance,
      };
    }

    // 2. Simulated payment gateway
    const gatewayRes = await MockPaymentGateway.processDeposit(amount, gatewayRef);
    if (!gatewayRes.success) {
      throw { status: 402, message: gatewayRes.errorMessage || "Mock gateway payment declined" };
    }

    // 3. Concurrency-safe atomic ledger entry
    const result = await db.executeWalletTransaction(
      wallet.id,
      async (tx) => {
        // Double-check idempotency key inside lock
        const doubleCheck = await db.findLedgerEntryByIdempotencyKey(idempotencyKey);
        if (doubleCheck) {
          const currentBalance = await tx.getBalance();
          return {
            success: true,
            isDuplicate: true,
            entry: doubleCheck,
            balance: currentBalance,
          };
        }

        const entry = await tx.insertLedgerEntry({
          type: "deposit",
          amount: amount, // Positive integer
          reference: gatewayRes.gatewayReference,
          idempotencyKey,
        });

        const newBalance = await tx.getBalance();

        return {
          success: true,
          isDuplicate: false,
          entry,
          balance: newBalance,
        };
      },
      options
    );

    // Emit live real-time balance update over Socket.io
    emitBalanceUpdate(userId, result.balance, { type: "deposit", amount });

    return result;
  }

  static async withdraw(
    userId: string,
    amount: number,
    idempotencyKey: string,
    gatewayRef?: string,
    options?: { disableLocking?: boolean }
  ) {
    if (amount <= 0 || !Number.isInteger(amount)) {
      throw { status: 400, message: "Withdrawal amount must be a positive integer" };
    }

    const wallet = await this.getWallet(userId);

    // 1. Idempotency Check: if key already exists, return earlier result
    const existing = await db.findLedgerEntryByIdempotencyKey(idempotencyKey);
    if (existing) {
      const currentBalance = await db.getBalance(wallet.id);
      return {
        success: true,
        isDuplicate: true,
        message: "Idempotent request: transaction previously completed",
        entry: existing,
        balance: currentBalance,
      };
    }

    // 2. Concurrency-safe atomic transaction
    const result = await db.executeWalletTransaction(
      wallet.id,
      async (tx) => {
        // In-transaction balance check
        const currentBalance = await tx.getBalance();

        // If locking is disabled for test, simulate real database concurrent race window
        if (options?.disableLocking) {
          await new Promise((r) => setTimeout(r, 10));
        }

        if (amount > currentBalance) {
          throw {
            status: 400,
            message: `Insufficient balance: requested ${amount} credits, available ${currentBalance} credits`,
          };
        }

        // Process mock gateway payout
        const gatewayRes = await MockPaymentGateway.processWithdrawal(amount, gatewayRef);
        if (!gatewayRes.success) {
          throw {
            status: 502,
            message: gatewayRes.errorMessage || "Mock payout gateway failure",
          };
        }

        const entry = await tx.insertLedgerEntry({
          type: "withdrawal",
          amount: -amount, // Negative integer
          reference: gatewayRes.gatewayReference,
          idempotencyKey,
        });

        const newBalance = await tx.getBalance();

        return {
          success: true,
          isDuplicate: false,
          entry,
          balance: newBalance,
        };
      },
      options
    );

    // Emit live real-time balance update over Socket.io
    emitBalanceUpdate(userId, result.balance, { type: "withdrawal", amount: -amount });

    return result;
  }

  static async getTransactionHistory(userId: string, page: number = 1, limit: number = 20) {
    const wallet = await this.getWallet(userId);
    return await db.getLedgerEntries(wallet.id, page, limit);
  }

  /**
   * Helper specifically designed to test atomic rollbacks (TC6):
   * Injects a failure halfway between a bet entry and a payout entry.
   */
  static async simulateAtomicBetPayoutRollback(
    walletId: string,
    betAmount: number,
    payoutAmount: number,
    injectFailure: boolean
  ) {
    return await db.executeWalletTransaction(walletId, async (tx) => {
      // 1. Insert bet entry
      await tx.insertLedgerEntry({
        type: "bet",
        amount: -betAmount,
        reference: "test_round_bet",
        idempotencyKey: `bet_${Date.now()}_${Math.random()}`,
      });

      // 2. Inject failure halfway between bet entry and payout entry
      if (injectFailure) {
        throw new Error("INJECTED_FAILURE_HALFWAY: Network or processing crash occurred!");
      }

      // 3. Insert payout entry
      await tx.insertLedgerEntry({
        type: "payout",
        amount: payoutAmount,
        reference: "test_round_payout",
        idempotencyKey: `payout_${Date.now()}_${Math.random()}`,
      });

      return { success: true };
    });
  }
}
