import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { setUseInMemory, memoryStore, db } from "../src/db/repository.js";
import { ProvablyFairEngine } from "../src/modules/fairness/provablyFair.js";

describe("TC9: Client Tamper Resistance (Ignoring Injected Outcome / Payout)", () => {
  let authToken: string;
  let userId: string;
  let walletId: string;

  beforeEach(async () => {
    setUseInMemory(true);
    memoryStore.clear();

    const regRes = await request(app)
      .post("/api/auth/register")
      .send({
        email: "tamper_player@university.edu",
        password: "ValidPassword123!",
      });

    userId = regRes.body.user.id;
    walletId = regRes.body.user.walletId;

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({
        email: "tamper_player@university.edu",
        password: "ValidPassword123!",
      });

    authToken = loginRes.body.accessToken;

    // Seed wallet with 500 credits
    await request(app)
      .post("/api/wallet/deposit")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        amount: 500,
        idempotencyKey: "seed_tamper_500",
      });
  });

  it("should completely ignore client-supplied outcome: { won: true } and payoutAmount: 999999", async () => {
    // 1. Start round
    const startRes = await request(app)
      .post("/api/games/dice/start")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ clientSeed: "tamper_seed_alpha" });

    const { roundId } = startRes.body;

    // 2. Client sends a malicious request trying to force a win and 999,999 payout
    // Setting an extremely low target (e.g., 1.00) makes a natural win virtually impossible (1% chance)
    const playRes = await request(app)
      .post("/api/games/dice/play")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        roundId,
        clientSeed: "tamper_seed_alpha",
        target: 1.0, // Roll must be under 1.00 to win legitimately
        betAmount: 100,
        idempotencyKey: "tamper_attempt_1",
        // INJECTED CLIENT FRAUD FIELDS:
        won: true,
        payoutAmount: 999999,
        outcome: {
          won: true,
          roll: 0.05,
          multiplier: 99.0,
        },
      });

    expect(playRes.status).toBe(200);

    const body = playRes.body;

    // 3. Verify that the server ignored the injected 999,999 payout
    expect(body.payoutAmount).not.toBe(999999);

    // 4. Verify that the server calculated the roll from HMAC-SHA256
    const serverSeed = body.serverSeed;
    const verified = ProvablyFairEngine.calculateDiceRoll(serverSeed, "tamper_seed_alpha", body.nonce);
    expect(body.roll).toBe(verified.roll);

    // If the verified roll was >= 1.00 (loss), payout must be strictly 0
    if (verified.roll >= 1.0) {
      expect(body.won).toBe(false);
      expect(body.payoutAmount).toBe(0);
      expect(body.balance).toBe(400); // 500 initial - 100 bet = 400
    } else {
      // If by 1% chance it won, payout is Math.floor(100 * 99) = 9900, NEVER 999,999!
      expect(body.payoutAmount).toBe(9900);
    }

    // 5. Check ledger balance matches server calculation
    const finalBalance = await db.getBalance(walletId);
    expect(finalBalance).toBe(body.balance);
    expect(finalBalance).not.toBe(500 - 100 + 999999);
  });
});

