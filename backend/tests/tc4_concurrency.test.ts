import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { setUseInMemory, memoryStore, db } from "../src/db/repository.js";
import { WalletService } from "../src/modules/wallet/wallet.service.js";

describe("TC4: Concurrency Testing (50 Simultaneous Withdrawals)", () => {
  let userId: string;
  let walletId: string;
  let authToken: string;

  beforeEach(async () => {
    setUseInMemory(true);
    memoryStore.clear();

    // Register user
    const regRes = await request(app)
      .post("/api/auth/register")
      .send({
        email: "concurrency_player@university.edu",
        password: "ValidPassword123!",
      });

    userId = regRes.body.user.id;
    walletId = regRes.body.user.walletId;

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({
        email: "concurrency_player@university.edu",
        password: "ValidPassword123!",
      });

    authToken = loginRes.body.accessToken;
  });

  it("should safely process 50 simultaneous withdrawals with row locking ENABLED: never negative, equals sum of ledger entries", async () => {
    // 1. Initial Deposit: 500 credits
    await WalletService.deposit(userId, 500, "initial_dep_500");

    const initialBalance = await db.getBalance(walletId);
    expect(initialBalance).toBe(500);

    // 2. Fire 50 simultaneous requests to withdraw 100 credits each
    // 50 * 100 = 5000 credits attempted against a 500 credit balance
    const withdrawalPromises = Array.from({ length: 50 }, (_, i) =>
      WalletService.withdraw(
        userId,
        100,
        `concurrency_locked_wth_${i}`,
        undefined,
        { disableLocking: false } // Row locking ENABLED
      )
        .then((res) => ({ success: true, result: res }))
        .catch((err) => ({ success: false, error: err }))
    );

    const results = await Promise.all(withdrawalPromises);

    const succeeded = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    // Exactly 5 withdrawals of 100 credits must succeed (5 * 100 = 500)
    expect(succeeded.length).toBe(5);
    // Exactly 45 withdrawals must fail due to insufficient balance
    expect(failed.length).toBe(45);

    // 3. Final balance verification
    const finalBalance = await db.getBalance(walletId);
    expect(finalBalance).toBe(0);
    expect(finalBalance).toBeGreaterThanOrEqual(0);

    // 4. Ledger entry sum verification
    const ledgerSum = memoryStore.ledgerEntries
      .filter((e) => e.wallet_id === walletId)
      .reduce((sum, e) => sum + e.amount, 0);

    expect(ledgerSum).toBe(finalBalance);
    expect(ledgerSum).toBe(0);

    // Initial deposit (1) + 5 successful withdrawals (5) = 6 total entries
    const userEntries = memoryStore.ledgerEntries.filter((e) => e.wallet_id === walletId);
    expect(userEntries.length).toBe(6);
  });

  it("should demonstrate race condition and balance corruption when row locking is DISABLED", async () => {
    // 1. Initial Deposit: 500 credits
    await WalletService.deposit(userId, 500, "initial_dep_unlocked_500");

    // 2. Fire 50 simultaneous requests to withdraw 100 credits each with row locking DISABLED
    const withdrawalPromises = Array.from({ length: 50 }, (_, i) =>
      WalletService.withdraw(
        userId,
        100,
        `concurrency_unlocked_wth_${i}`,
        undefined,
        { disableLocking: true } // Row locking DISABLED for test demonstration
      )
        .then((res) => ({ success: true, result: res }))
        .catch((err) => ({ success: false, error: err }))
    );

    const results = await Promise.all(withdrawalPromises);

    const succeeded = results.filter((r) => r.success);

    // Without row locking, race conditions cause multiple threads to read the balance
    // before preceding withdrawals are recorded. Thus, significantly more than 5 succeed!
    expect(succeeded.length).toBeGreaterThan(5);

    // Final balance drops into negative balance because of race condition!
    const corruptedBalance = await db.getBalance(walletId);
    expect(corruptedBalance).toBeLessThan(0);
  });
});

