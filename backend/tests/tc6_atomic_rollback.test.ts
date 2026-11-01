import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { setUseInMemory, memoryStore, db } from "../src/db/repository.js";
import { WalletService } from "../src/modules/wallet/wallet.service.js";

describe("TC6: Atomic Rollback (Failure Injected Between Multi-Step Entries)", () => {
  let userId: string;
  let walletId: string;

  beforeEach(async () => {
    setUseInMemory(true);
    memoryStore.clear();

    const regRes = await request(app)
      .post("/api/auth/register")
      .send({
        email: "rollback_player@university.edu",
        password: "ValidPassword123!",
      });

    userId = regRes.body.user.id;
    walletId = regRes.body.user.walletId;
  });

  it("should completely rollback and leave 0 ledger entries when failure is injected midway", async () => {
    // Verify wallet starts with 0 ledger entries
    expect(memoryStore.ledgerEntries.length).toBe(0);

    // Call multi-step transaction with injectFailure = true
    let caughtError: any = null;
    try {
      await WalletService.simulateAtomicBetPayoutRollback(
        walletId,
        100, // bet amount
        200, // payout amount
        true // INJECT FAILURE MIDWAY
      );
    } catch (err: any) {
      caughtError = err;
    }

    // Verify error was raised
    expect(caughtError).toBeDefined();
    expect(caughtError.message).toContain("INJECTED_FAILURE_HALFWAY");

    // CRITICAL: Verify transaction rolled back completely - nothing left in ledger!
    const remainingEntries = memoryStore.ledgerEntries.filter((e) => e.wallet_id === walletId);
    expect(remainingEntries.length).toBe(0);

    // Balance must be 0
    const balance = await db.getBalance(walletId);
    expect(balance).toBe(0);
  });

  it("should successfully commit both entries when no failure occurs", async () => {
    expect(memoryStore.ledgerEntries.length).toBe(0);

    const result = await WalletService.simulateAtomicBetPayoutRollback(
      walletId,
      100, // bet
      200, // payout
      false // NO FAILURE
    );

    expect(result.success).toBe(true);

    // Verify both bet (-100) and payout (+200) were committed
    const entries = memoryStore.ledgerEntries.filter((e) => e.wallet_id === walletId);
    expect(entries.length).toBe(2);

    const bet = entries.find((e) => e.type === "bet");
    const payout = entries.find((e) => e.type === "payout");

    expect(bet).toBeDefined();
    expect(bet?.amount).toBe(-100);

    expect(payout).toBeDefined();
    expect(payout?.amount).toBe(200);

    // Net balance = -100 + 200 = 100
    const balance = await db.getBalance(walletId);
    expect(balance).toBe(100);
  });
});

