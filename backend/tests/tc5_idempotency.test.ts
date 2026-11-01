import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { setUseInMemory, memoryStore, db } from "../src/db/repository.js";

describe("TC5: Idempotency Key Replay Protection", () => {
  let authToken: string;
  let walletId: string;

  beforeEach(async () => {
    setUseInMemory(true);
    memoryStore.clear();

    const regRes = await request(app)
      .post("/api/auth/register")
      .send({
        email: "idempotency_player@university.edu",
        password: "ValidPassword123!",
      });

    walletId = regRes.body.user.walletId;

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({
        email: "idempotency_player@university.edu",
        password: "ValidPassword123!",
      });

    authToken = loginRes.body.accessToken;
  });

  it("should apply deposit once when the same idempotency key is sent twice", async () => {
    const key = "idem_dep_test_key_1";

    // First request
    const firstRes = await request(app)
      .post("/api/wallet/deposit")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        amount: 250,
        idempotencyKey: key,
      });

    expect(firstRes.status).toBe(200);
    expect(firstRes.body.isDuplicate).toBe(false);
    expect(firstRes.body.balance).toBe(250);

    // Second request with exact same idempotency key
    const secondRes = await request(app)
      .post("/api/wallet/deposit")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        amount: 250,
        idempotencyKey: key,
      });

    expect(secondRes.status).toBe(200);
    expect(secondRes.body.isDuplicate).toBe(true);
    expect(secondRes.body.balance).toBe(250); // Balance NOT increased to 500!

    // Verify database ledger contains only 1 entry
    const entries = memoryStore.ledgerEntries.filter((e) => e.wallet_id === walletId);
    expect(entries.length).toBe(1);

    const balance = await db.getBalance(walletId);
    expect(balance).toBe(250);
  });

  it("should apply withdrawal once when the same idempotency key is sent twice", async () => {
    // Seed initial balance of 500
    await request(app)
      .post("/api/wallet/deposit")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        amount: 500,
        idempotencyKey: "seed_dep_500",
      });

    const key = "idem_wth_test_key_1";

    // First withdrawal
    const firstRes = await request(app)
      .post("/api/wallet/withdraw")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        amount: 150,
        idempotencyKey: key,
      });

    expect(firstRes.status).toBe(200);
    expect(firstRes.body.isDuplicate).toBe(false);
    expect(firstRes.body.balance).toBe(350);

    // Second withdrawal with same idempotency key
    const secondRes = await request(app)
      .post("/api/wallet/withdraw")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        amount: 150,
        idempotencyKey: key,
      });

    expect(secondRes.status).toBe(200);
    expect(secondRes.body.isDuplicate).toBe(true);
    expect(secondRes.body.balance).toBe(350); // Balance NOT decreased to 200!

    // Final balance check
    const balance = await db.getBalance(walletId);
    expect(balance).toBe(350);
  });
});

