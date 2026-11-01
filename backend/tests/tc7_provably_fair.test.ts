import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { setUseInMemory, memoryStore } from "../src/db/repository.js";
import { ProvablyFairEngine } from "../src/modules/fairness/provablyFair.js";

describe("TC7: Provably Fair Commit-Reveal Verification", () => {
  let authToken: string;

  beforeEach(async () => {
    setUseInMemory(true);
    memoryStore.clear();

    // Register & login player
    await request(app)
      .post("/api/auth/register")
      .send({
        email: "fairness_player@university.edu",
        password: "ValidPassword123!",
      });

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({
        email: "fairness_player@university.edu",
        password: "ValidPassword123!",
      });

    authToken = loginRes.body.accessToken;

    // Seed wallet with 1000 credits
    await request(app)
      .post("/api/wallet/deposit")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        amount: 1000,
        idempotencyKey: "seed_fairness_1000",
      });
  });

  it("should match stored outcome with recomputed outcome and match revealed seed with published hash", async () => {
    // 1. Commitment step: client requests round start
    const startRes = await request(app)
      .post("/api/games/dice/start")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ clientSeed: "custom_client_seed_42" });

    expect(startRes.status).toBe(200);
    const { roundId, serverSeedHash, nonce, clientSeed } = startRes.body;

    expect(roundId).toBeDefined();
    expect(serverSeedHash).toHaveLength(64); // SHA-256 is 64 hex characters
    expect(nonce).toBeGreaterThanOrEqual(1);

    // 2. Bet & Reveal step: player submits bet
    const playRes = await request(app)
      .post("/api/games/dice/play")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        roundId,
        clientSeed,
        target: 50.0,
        betAmount: 100,
        idempotencyKey: "play_dice_tc7_1",
      });

    expect(playRes.status).toBe(200);
    const {
      roll,
      serverSeed: revealedServerSeed,
      serverSeedHash: returnedHash,
      nonce: returnedNonce,
    } = playRes.body;

    expect(revealedServerSeed).toBeDefined();
    expect(revealedServerSeed).toHaveLength(64); // 32 bytes hex

    // 3. Independent Verification 1: Check SHA-256 hash of revealed seed matches commitment
    const computedHash = ProvablyFairEngine.sha256(revealedServerSeed);
    expect(computedHash).toBe(serverSeedHash);
    expect(computedHash).toBe(returnedHash);

    // 4. Independent Verification 2: Recompute dice roll using revealed seeds
    const recomputedOutcome = ProvablyFairEngine.calculateDiceRoll(
      revealedServerSeed,
      clientSeed,
      returnedNonce
    );

    expect(recomputedOutcome.roll).toBe(roll);

    // 5. Independent Verification 3: Call public verification API
    const verifyRes = await request(app)
      .post("/api/games/verify")
      .send({
        serverSeed: revealedServerSeed,
        serverSeedHash,
        clientSeed,
        nonce: returnedNonce,
      });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.isValidCommitment).toBe(true);
    expect(verifyRes.body.roll).toBe(roll);
  });

  it("should reject verification if server seed does not match the published hash", async () => {
    const fakeServerSeed = "0000000000000000000000000000000000000000000000000000000000000000";
    const honestHash = "abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd";

    const verifyRes = await request(app)
      .post("/api/games/verify")
      .send({
        serverSeed: fakeServerSeed,
        serverSeedHash: honestHash,
        clientSeed: "any_seed",
        nonce: 1,
      });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.isValidCommitment).toBe(false);
  });
});

