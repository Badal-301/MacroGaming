import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { setUseInMemory, memoryStore } from "../src/db/repository.js";
import { clearRateLimits } from "../src/middlewares/rateLimiter.js";

describe("TC10: Security Hardening (SQL Injection Immunity & Rate Limiting)", () => {
  beforeEach(() => {
    setUseInMemory(true);
    memoryStore.clear();
    clearRateLimits();
  });

  it("should prevent SQL injection strings from altering authentication logic", async () => {
    // Register honest admin
    await request(app)
      .post("/api/auth/register")
      .send({
        email: "admin@university.edu",
        password: "AdminPassword123!",
        role: "admin",
      });

    const injectionPayloads = [
      "' OR '1'='1",
      "admin@university.edu'--",
      "' UNION SELECT * FROM users--",
      "admin' OR 1=1 #",
      "'; DROP TABLE users; --",
    ];

    for (const sqlInjection of injectionPayloads) {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: sqlInjection,
          password: "RandomPassword123!",
        });

      // Must be rejected by either Zod email validation or authentication verification
      expect([400, 401]).toContain(res.status);
      expect(res.body).not.toHaveProperty("accessToken");
    }
  });

  it("should refuse the 6th login attempt within 1 minute with 429 Too Many Requests", async () => {
    const targetEmail = "victim_account@university.edu";

    // 5 failed login attempts
    for (let i = 1; i <= 5; i++) {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: targetEmail,
          password: "WrongPassword999!",
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid/i);
    }

    // 6th attempt within the same minute window -> Must return 429!
    const sixthAttempt = await request(app)
      .post("/api/auth/login")
      .send({
        email: targetEmail,
        password: "WrongPassword999!",
      });

    expect(sixthAttempt.status).toBe(429);
    expect(sixthAttempt.body.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(sixthAttempt.body.error).toMatch(/too many login attempts/i);
    expect(sixthAttempt.body.retryAfter).toBe(60);
  });
});

