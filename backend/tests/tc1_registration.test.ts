import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { setUseInMemory, memoryStore } from "../src/db/repository.js";

describe("TC1: Registration validation & wallet creation", () => {
  beforeEach(() => {
    setUseInMemory(true);
    memoryStore.clear();
  });

  it("should successfully register a valid user and automatically create a wallet", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        email: "student@university.edu",
        password: "ValidPassword123!",
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("user");
    expect(res.body.user.email).toBe("student@university.edu");
    expect(res.body.user.role).toBe("player");
    expect(res.body.user.walletId).toBeDefined();

    // Verify wallet was created
    expect(memoryStore.wallets.length).toBe(1);
    expect(memoryStore.wallets[0].user_id).toBe(res.body.user.id);
  });

  it("should reject registration with duplicate email", async () => {
    // First registration
    await request(app)
      .post("/api/auth/register")
      .send({
        email: "duplicate@university.edu",
        password: "ValidPassword123!",
      });

    // Second registration with same email
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        email: "duplicate@university.edu",
        password: "AnotherPassword456!",
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it("should reject malformed email addresses", async () => {
    const invalidEmails = ["not-an-email", "missing-at.com", "@missing-user.com", "spaces in@email.com"];

    for (const email of invalidEmails) {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          email,
          password: "ValidPassword123!",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Validation error");
      expect(res.body.details.some((d: any) => d.field === "email")).toBe(true);
    }
  });

  it("should reject weak passwords (less than 8 chars, missing number or letter)", async () => {
    const weakPasswords = [
      "short1", // < 8 characters
      "allcharacterswithoutdigits", // no digits
      "1234567890", // no letters
    ];

    for (const password of weakPasswords) {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          email: "test@university.edu",
          password,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Validation error");
      expect(res.body.details.some((d: any) => d.field === "password")).toBe(true);
    }
  });

  it("should reject unknown/extraneous fields in the request body (Zod strictness)", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        email: "attacker@university.edu",
        password: "ValidPassword123!",
        balance: 1000000, // Attacker trying to inject balance!
        isAdmin: true,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation error");
  });
});

