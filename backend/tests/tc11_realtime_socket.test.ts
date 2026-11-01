import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import { io as ClientSocket, Socket as ClientSocketType } from "socket.io-client";
import request from "supertest";
import { app } from "../src/app.js";
import { setUseInMemory, memoryStore } from "../src/db/repository.js";
import { initSocketServer, emitBalanceUpdate } from "../src/modules/realtime/socket.js";
import { WalletService } from "../src/modules/wallet/wallet.service.js";

describe("TC11: Real-Time Layer (Authenticated Handshake & Live Multi-Client Sync)", () => {
  let server: http.Server;
  let ioServer: SocketIOServer;
  let serverPort: number;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    server = http.createServer(app);
    ioServer = new SocketIOServer(server, { cors: { origin: "*" } });
    initSocketServer(ioServer);

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address() as any;
        serverPort = addr.port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    ioServer.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(async () => {
    setUseInMemory(true);
    memoryStore.clear();

    // Register & Login player
    const regRes = await request(app)
      .post("/api/auth/register")
      .send({
        email: "socket_player@university.edu",
        password: "ValidPassword123!",
      });

    userId = regRes.body.user.id;

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({
        email: "socket_player@university.edu",
        password: "ValidPassword123!",
      });

    authToken = loginRes.body.accessToken;
  });

  it("should refuse socket connection without an auth token during handshake", async () => {
    let connectError: any = null;

    const unauthenticatedSocket = ClientSocket(`http://localhost:${serverPort}`, {
      transports: ["websocket"],
      reconnection: false,
      auth: {}, // Missing token
    });

    await new Promise<void>((resolve) => {
      unauthenticatedSocket.on("connect_error", (err) => {
        connectError = err;
        unauthenticatedSocket.close();
        resolve();
      });

      unauthenticatedSocket.on("connect", () => {
        unauthenticatedSocket.close();
        resolve();
      });
    });

    expect(connectError).toBeDefined();
    expect(connectError.message).toMatch(/Authentication error/i);
  });

  it("should successfully authenticate valid token and deliver real-time balance update to second client", async () => {
    let receivedUpdate: any = null;

    // Connect authenticated client (Tab 2)
    const clientSocket: ClientSocketType = ClientSocket(`http://localhost:${serverPort}`, {
      transports: ["websocket"],
      reconnection: false,
      auth: { token: authToken },
    });

    await new Promise<void>((resolve, reject) => {
      clientSocket.on("connect", () => {
        resolve();
      });
      clientSocket.on("connect_error", (err) => {
        reject(err);
      });
    });

    // Listen for real-time balance push
    clientSocket.on("balance_updated", (data) => {
      receivedUpdate = data;
    });

    // Perform balance-changing deposit on REST API (Tab 1)
    await WalletService.deposit(userId, 750, "realtime_dep_750");

    // Wait up to 500ms for websocket event arrival
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (receivedUpdate) {
          clearInterval(interval);
          resolve();
        }
      }, 20);

      setTimeout(() => {
        clearInterval(interval);
        resolve();
      }, 500);
    });

    clientSocket.close();

    // Verify real-time message payload
    expect(receivedUpdate).toBeDefined();
    expect(receivedUpdate.balance).toBe(750);
    expect(receivedUpdate.currency).toBe("CREDITS");
  });
});

