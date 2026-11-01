import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../src/app.js";
import { setUseInMemory, memoryStore } from "../src/db/repository.js";
import { config } from "../src/config/index.js";

describe("TC2: Authentication, Token Lifecycle & Role Verification", () => {
  beforeEach(() => {
    setUseInMemory(true);
    memoryStore.clear();
  });

  it("should refuse player token on admin routes (403 Forbidden)", async () => {
    // 1. Register a regular player
    const regRes = await request(app)
      .post("/api/auth/register")
      .send({
        email: "player@university.edu",
        password: "PlayerPassword123!",
        role: "player",
      });
    expect(regRes.status).toBe(201);

    // 2. Login as player
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({
        email: "player@university.edu",
        password: "PlayerPassword123!",
      });
    expect(loginRes.status).toBe(200);
    const playerToken = loginRes.body.accessToken;

    // 3. Try to access admin route with player token
    const adminRes = await request(app)
      .get("/api/admin/overview")
      .set("Authorization", `Bearer ${playerToken}`);

    expect(adminRes.status).toBe(403);
    expect(adminRes.body.error).toMatch(/Forbidden/i);
  });

  it("should allow admin token on admin routes (200 OK)", async () => {
    // 1. Register an admin
    await request(app)
      .post("/api/auth/register")
      .send({
        email: "admin@university.edu",
        password: "AdminPassword123!",
        role: "admin",
      });

    // 2. Login as admin
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({
        email: "admin@university.edu",
        password: "AdminPassword123!",
      });
    const adminToken = loginRes.body.accessToken;

    // 3. Access admin route with admin token
    const adminRes = await request(app)
      .get("/api/admin/overview")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(adminRes.status).toBe(200);
    expect(adminRes.body.message).toMatch(/granted/i);
  });

  it("should refuse expired access tokens", async () => {
    // Craft an expired JWT using the same secret
    const expiredToken = jwt.sign(
      {
        userId: "test-user-id",
        email: "expired@university.edu",
        role: "player",
      },
      config.JWT_SECRET,
      { expiresIn: "-1s" } // Expired 1 second ago
    );

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("TOKEN_EXPIRED");
  });

  it("should refuse altered/tampered tokens", async () => {
    // 1. Generate valid login
    await request(app)
      .post("/api/auth/register")
      .send({
        email: "tamper@university.edu",
        password: "ValidPassword123!",
      });

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({
        email: "tamper@university.edu",
        password: "ValidPassword123!",
      });

    const validToken = loginRes.body.accessToken;

    // 2. Alter the token payload or signature
    const parts = validToken.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({ userId: "hacked", role: "admin" })
    ).toString("base64url");
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    const res = await request(app)
      .get("/api/admin/overview")
      .set("Authorization", `Bearer ${tamperedToken}`);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("TOKEN_INVALID");
  });

  it("should support refresh token rotation and revoke old refresh token", async () => {
    // 1. Register & login
    await request(app)
      .post("/api/auth/register")
      .send({
        email: "refresh@university.edu",
        password: "ValidPassword123!",
      });

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({
        email: "refresh@university.edu",
        password: "ValidPassword123!",
      });

    const firstRefreshToken = loginRes.body.refreshToken;

    // 2. Refresh the token (rotates tokens)
    const refreshRes = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: firstRefreshToken });

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body).toHaveProperty("accessToken");
    expect(refreshRes.body).toHaveProperty("refreshToken");
    expect(refreshRes.body.refreshToken).not.toBe(firstRefreshToken);

    const secondRefreshToken = refreshRes.body.refreshToken;

    // 3. Using the newly rotated refresh token works cleanly
    const thirdRefreshRes = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: secondRefreshToken });

    expect(thirdRefreshRes.status).toBe(200);
    expect(thirdRefreshRes.body).toHaveProperty("accessToken");
    expect(thirdRefreshRes.body).toHaveProperty("refreshToken");

    // 4. Attempt to reuse old revoked refresh token -> triggers security revocation
    const reuseRes = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: firstRefreshToken });

    expect(reuseRes.status).toBe(401);
    expect(reuseRes.body.error).toMatch(/revoked/i);
  });
});
