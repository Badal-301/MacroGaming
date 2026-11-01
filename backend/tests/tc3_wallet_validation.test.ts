import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { setUseInMemory, memoryStore } from "../src/db/repository.js";

describe("TC3: Wallet Validation (Zero, Negative, Exceeding Balance, Floats)", () => {
  let authToken: string;

  beforeEach(async () => {
    setUseInMemory(true);
    memoryStore.clear();

    // Register and login test player
    await request(app)
      .post("/api/auth/register")
      .send({
        email: "player_tc3@university.edu",
        password: "ValidPassword123!",
      });

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({
        email: "player_tc3@university.edu",
        password: "ValidPassword123!",
      });

    authToken = loginRes.body.accessToken;
  });

  it("should refuse withdrawal above current balance (starting with 0 balance)", async () => {
    const res = await request(app)
      .post("/api/wallet/withdraw")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        amount: 500,
        idempotencyKey: "tc3_wth_exceed_1",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/insufficient balance/i);

    // Verify balance remains 0
    const balRes = await request(app)
      .get("/api/wallet/balance")
      .set("Authorization", `Bearer ${authToken}`);

    expect(balRes.body.balance).toBe(0);
  });

  it("should refuse zero amount deposits and withdrawals", async () => {
    // Deposit 0
    const depRes = await request(app)
      .post("/api/wallet/deposit")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        amount: 0,
        idempotencyKey: "tc3_dep_zero",
      });
    expect(depRes.status).toBe(400);
    expect(depRes.body.error).toBe("Validation error");

    // Withdraw 0
    const wthRes = await request(app)
      .post("/api/wallet/withdraw")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        amount: 0,
        idempotencyKey: "tc3_wth_zero",
      });
    expect(wthRes.status).toBe(400);
    expect(wthRes.body.error).toBe("Validation error");
  });

  it("should refuse negative amount deposits and withdrawals", async () => {
    // Deposit -100
    const depRes = await request(app)
      .post("/api/wallet/deposit")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        amount: -100,
        idempotencyKey: "tc3_dep_neg",
      });
    expect(depRes.status).toBe(400);

    // Withdraw -100
    const wthRes = await request(app)
      .post("/api/wallet/withdraw")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        amount: -100,
        idempotencyKey: "tc3_wth_neg",
      });
    expect(wthRes.status).toBe(400);
  });

  it("should refuse float amounts (enforcing integer credits rule)", async () => {
    // Deposit 50.75
    const depRes = await request(app)
      .post("/api/wallet/deposit")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        amount: 50.75,
        idempotencyKey: "tc3_dep_float",
      });
    expect(depRes.status).toBe(400);
    expect(depRes.body.details.some((d: any) => d.message.includes("integer"))).toBe(true);

    // Withdraw 10.25
    const wthRes = await request(app)
      .post("/api/wallet/withdraw")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        amount: 10.25,
        idempotencyKey: "tc3_wth_float",
      });
    expect(wthRes.status).toBe(400);
  });

  it("should refuse withdrawal when amount is even 1 credit above balance after deposit", async () => {
    // Deposit 1000 credits
    await request(app)
      .post("/api/wallet/deposit")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        amount: 1000,
        idempotencyKey: "tc3_dep_1000",
      });

    // Attempt to withdraw 1001 credits
    const res = await request(app)
      .post("/api/wallet/withdraw")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        amount: 1001,
        idempotencyKey: "tc3_wth_1001",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/insufficient balance/i);

    // Balance must still be 1000
    const balRes = await request(app)
      .get("/api/wallet/balance")
      .set("Authorization", `Bearer ${authToken}`);

    expect(balRes.body.balance).toBe(1000);
  });
});

