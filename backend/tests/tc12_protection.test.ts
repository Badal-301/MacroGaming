import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { setUseInMemory, memoryStore } from "../src/db/repository.js";
import { ProtectionService } from "../src/modules/protection/protection.service.js";

describe("TC12: Responsible Design & User Protection (Limits, Cooldown & Self-Exclusion)", () => {
  let authToken: string;
  let userId: string;

  beforeEach(async () => {
    setUseInMemory(true);
    memoryStore.clear();
    ProtectionService.clearLossTrackers();

    // Register & Login player
    const regRes = await request(app)
      .post("/api/auth/register")
      .send({
        email: "protected_player@university.edu",
        password: "ValidPassword123!",
      });

    userId = regRes.body.user.id;

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({
        email: "protected_player@university.edu",
        password: "ValidPassword123!",
      });

    authToken = loginRes.body.accessToken;

    // Seed wallet with 2000 credits
    await request(app)
      .post("/api/wallet/deposit")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        amount: 2000,
        idempotencyKey: "seed_protect_2000",
      });
  });

  it("should block bets that exceed the user's session bet limit", async () => {
    // Set personal session bet limit to 200 credits
    await request(app)
      .put("/api/protection/limits")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ sessionBetLimit: 200 });

    // Start a round
    const startRes = await request(app)
      .post("/api/games/dice/start")
      .set("Authorization", `Bearer ${authToken}`)
      .send({});
    const { roundId, clientSeed } = startRes.body;

    // Direct API bet with 250 credits (> 200 limit) -> MUST BE BLOCKED
    const betRes = await request(app)
      .post("/api/games/dice/play")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        roundId,
        clientSeed,
        target: 50.0,
        betAmount: 250,
        idempotencyKey: "exceed_limit_bet_1",
      });

    expect(betRes.status).toBe(403);
    expect(betRes.body.error).toMatch(/exceeds your configured session bet limit/i);
  });

  it("should automatically trigger 10-minute cooldown after 5 consecutive losses and block bets", async () => {
    // Simulate 5 consecutive losses
    for (let i = 1; i <= 5; i++) {
      await ProtectionService.handleRoundLoss(userId);
    }

    // Attempt to start and play a round during active cooldown
    const startRes = await request(app)
      .post("/api/games/dice/start")
      .set("Authorization", `Bearer ${authToken}`)
      .send({});
    const { roundId, clientSeed } = startRes.body;

    const betRes = await request(app)
      .post("/api/games/dice/play")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        roundId,
        clientSeed,
        target: 50.0,
        betAmount: 10,
        idempotencyKey: "cooldown_bet_attempt",
      });

    expect(betRes.status).toBe(403);
    expect(betRes.body.error).toMatch(/cooldown active/i);
    expect(betRes.body.details).toHaveProperty("cooldownUntil");
  });

  it("should block bets and deposits when account is self-excluded", async () => {
    // 1. Player activates 30-day self-exclusion
    const excludeRes = await request(app)
      .post("/api/protection/self-exclude")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ days: 30 });

    expect(excludeRes.status).toBe(200);
    expect(excludeRes.body.success).toBe(true);

    // 2. Direct API call to deposit -> MUST BE BLOCKED
    const depRes = await request(app)
      .post("/api/wallet/deposit")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        amount: 100,
        idempotencyKey: "excluded_dep_attempt",
      });

    expect(depRes.status).toBe(403);
    expect(depRes.body.error).toMatch(/self-excluded/i);

    // 3. Direct API call to bet -> MUST BE BLOCKED
    const startRes = await request(app)
      .post("/api/games/dice/start")
      .set("Authorization", `Bearer ${authToken}`)
      .send({});
    const { roundId, clientSeed } = startRes.body;

    const betRes = await request(app)
      .post("/api/games/dice/play")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        roundId,
        clientSeed,
        target: 50.0,
        betAmount: 10,
        idempotencyKey: "excluded_bet_attempt",
      });

    expect(betRes.status).toBe(403);
    expect(betRes.body.error).toMatch(/self-excluded/i);
  });
});

