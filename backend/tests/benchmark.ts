import os from "os";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import { io as ClientSocket } from "socket.io-client";
import { app } from "../src/app.js";
import { setUseInMemory, memoryStore, db } from "../src/db/repository.js";
import { initSocketServer, emitBalanceUpdate } from "../src/modules/realtime/socket.js";
import { AuthService } from "../src/modules/auth/auth.service.js";
import { WalletService } from "../src/modules/wallet/wallet.service.js";
import { DiceGameService } from "../src/modules/games/dice/dice.service.js";

interface LatencyStats {
  concurrency: number;
  totalRequests: number;
  durationMs: number;
  rps: number;
  medianMs: number;
  p95Ms: number;
}

function calculatePercentiles(latencies: number[]): { median: number; p95: number } {
  latencies.sort((a, b) => a - b);
  const median = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  return { median, p95 };
}

async function runConcurrencyLoadTest(
  name: string,
  fn: () => Promise<void>,
  concurrency: number,
  iterationsPerWorker: number
): Promise<LatencyStats> {
  const allLatencies: number[] = [];
  const startTotal = Date.now();

  const workers = Array.from({ length: concurrency }, async () => {
    for (let i = 0; i < iterationsPerWorker; i++) {
      const t0 = performance.now();
      await fn();
      allLatencies.push(performance.now() - t0);
    }
  });

  await Promise.all(workers);
  const durationMs = Date.now() - startTotal;
  const totalRequests = concurrency * iterationsPerWorker;
  const rps = Math.round((totalRequests / (durationMs / 1000)));
  const { median, p95 } = calculatePercentiles(allLatencies);

  return {
    concurrency,
    totalRequests,
    durationMs,
    rps,
    medianMs: Math.round(median * 100) / 100,
    p95Ms: Math.round(p95 * 100) / 100,
  };
}

async function main() {
  console.log("==================================================================");
  console.log("             SYSTEM PERFORMANCE & BENCHMARK SUITE                 ");
  console.log("==================================================================");

  // 1. Machine Specs
  console.log("Host Environment:");
  console.log(`  OS: ${os.type()} ${os.release()} (${os.arch()})`);
  console.log(`  CPU: ${os.cpus()[0]?.model || "Unknown CPU"} (${os.cpus().length} logical cores)`);
  console.log(`  RAM: ${(os.totalmem() / (1024 ** 3)).toFixed(2)} GB`);
  console.log(`  Node.js: ${process.version}`);
  console.log("------------------------------------------------------------------");

  setUseInMemory(true);
  memoryStore.clear();

  let user: any;
  try {
    user = await AuthService.register({
      email: "bench@university.edu",
      password: "Password123!",
    });
    // Raise limits for high-volume benchmark
    const u = await db.findUserById(user.id);
    if (u?.user_limits) {
      u.user_limits.deposit_limit = 2000000;
      u.user_limits.session_bet_limit = 1000000;
    }
    await WalletService.deposit(user.id, 1000000, "bench_deposit_seed");
  } catch (err) {
    console.error("Initialization error in benchmark:", err);
    throw err;
  }

  // 2. Load Test: Login endpoint
  console.log("\n[1] Load Testing Login Authentication...");
  const loginResults: LatencyStats[] = [];
  for (const c of [10, 50, 100]) {
    const stats = await runConcurrencyLoadTest(
      "Login",
      async () => {
        await AuthService.login({
          email: "bench@university.edu",
          password: "Password123!",
        });
      },
      c,
      20
    );
    loginResults.push(stats);
    console.log(`  Concurrency ${c}: ${stats.rps} req/sec | Median: ${stats.medianMs}ms | p95: ${stats.p95Ms}ms`);
  }

  // 3. Load Test: Wallet Read (Balance query)
  console.log("\n[2] Load Testing Wallet Read (Balance Query)...");
  const walletResults: LatencyStats[] = [];
  for (const c of [10, 50, 100]) {
    const stats = await runConcurrencyLoadTest(
      "Wallet Read",
      async () => {
        await WalletService.getBalance(user.id);
      },
      c,
      50
    );
    walletResults.push(stats);
    console.log(`  Concurrency ${c}: ${stats.rps} req/sec | Median: ${stats.medianMs}ms | p95: ${stats.p95Ms}ms`);
  }

  // 4. Load Test: Provably Fair Bet Settlement
  console.log("\n[3] Load Testing Provably Fair Bet Settlement...");
  const betResults: LatencyStats[] = [];
  for (const c of [10, 50, 100]) {
    let reqCounter = 0;
    const stats = await runConcurrencyLoadTest(
      "Dice Bet",
      async () => {
        reqCounter++;
        // Clear cooldown for pure throughput measurement
        const u = await db.findUserById(user.id);
        if (u) {
          u.cooldown_until = null;
          u.self_excluded_until = null;
        }
        const round = await DiceGameService.startRound(user.id);
        await DiceGameService.playRound(user.id, {
          roundId: round.roundId,
          clientSeed: "bench_seed",
          target: 90.0,
          betAmount: 1,
          idempotencyKey: `bench_bet_${c}_${reqCounter}_${Math.random()}`,
        });
      },
      c,
      10
    );
    betResults.push(stats);
    console.log(`  Concurrency ${c}: ${stats.rps} req/sec | Median: ${stats.medianMs}ms | p95: ${stats.p95Ms}ms`);
  }

  // 5. Balance Query Timing over 1k, 10k, 100k Ledger Entries
  console.log("\n[4] Balance Ledger Sum Query Timing (EXPLAIN / Aggregation Benchmark)...");
  const wallet = await WalletService.getWallet(user.id);

  // Insert 1,000 entries
  for (let i = 0; i < 1000; i++) {
    memoryStore.ledgerEntries.push({
      id: crypto.randomUUID(),
      wallet_id: wallet.id,
      type: "bet",
      amount: -1,
      reference: `ref_bench_${i}`,
      idempotency_key: `bench_key_1k_${i}`,
      created_at: new Date(),
    });
  }
  let t0 = performance.now();
  await db.getBalance(wallet.id);
  const time1k = performance.now() - t0;
  console.log(`  1,000 Ledger Entries Sum: ${time1k.toFixed(3)} ms`);

  // Insert up to 10,000
  for (let i = 1000; i < 10000; i++) {
    memoryStore.ledgerEntries.push({
      id: crypto.randomUUID(),
      wallet_id: wallet.id,
      type: "bet",
      amount: -1,
      reference: `ref_bench_${i}`,
      idempotency_key: `bench_key_10k_${i}`,
      created_at: new Date(),
    });
  }
  t0 = performance.now();
  await db.getBalance(wallet.id);
  const time10k = performance.now() - t0;
  console.log(`  10,000 Ledger Entries Sum: ${time10k.toFixed(3)} ms`);

  // Insert up to 100,000
  for (let i = 10000; i < 100000; i++) {
    memoryStore.ledgerEntries.push({
      id: crypto.randomUUID(),
      wallet_id: wallet.id,
      type: "bet",
      amount: -1,
      reference: `ref_bench_${i}`,
      idempotency_key: `bench_key_100k_${i}`,
      created_at: new Date(),
    });
  }
  t0 = performance.now();
  await db.getBalance(wallet.id);
  const time100k = performance.now() - t0;
  console.log(`  100,000 Ledger Entries Sum: ${time100k.toFixed(3)} ms`);

  // 6. Delay from Commit to Socket Message
  console.log("\n[5] Measuring Commit-to-Socket Delivery Latency...");
  const server = http.createServer(app);
  const ioServer = new SocketIOServer(server, { cors: { origin: "*" } });
  initSocketServer(ioServer);

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const serverPort = (server.address() as any).port;

  const loginRes = await AuthService.login({
    email: "bench@university.edu",
    password: "Password123!",
  });

  const clientSocket = ClientSocket(`http://localhost:${serverPort}`, {
    transports: ["websocket"],
    auth: { token: loginRes.accessToken },
  });

  await new Promise<void>((resolve) => clientSocket.on("connect", () => resolve()));

  let commitTime = 0;
  let socketDeliveryDelayMs = 0;

  await new Promise<void>((resolve) => {
    clientSocket.on("balance_updated", () => {
      socketDeliveryDelayMs = performance.now() - commitTime;
      resolve();
    });

    commitTime = performance.now();
    emitBalanceUpdate(user.id, 999999, { benchmark: true });
  });

  clientSocket.close();
  ioServer.close();
  server.close();

  console.log(`  Database Commit -> Socket.io Client Arrival Delay: ${socketDeliveryDelayMs.toFixed(2)} ms`);
  console.log("==================================================================");

  return {
    machine: {
      os: `${os.type()} ${os.release()} (${os.arch()})`,
      cpu: os.cpus()[0]?.model,
      cores: os.cpus().length,
      ram: `${(os.totalmem() / (1024 ** 3)).toFixed(2)} GB`,
      node: process.version,
    },
    loadTests: {
      login: loginResults,
      wallet: walletResults,
      bet: betResults,
    },
    ledgerScaling: {
      time1kMs: Number(time1k.toFixed(3)),
      time10kMs: Number(time10k.toFixed(3)),
      time100kMs: Number(time100k.toFixed(3)),
    },
    socketLatencyMs: Number(socketDeliveryDelayMs.toFixed(2)),
  };
}

if (process.env.NODE_ENV !== "test") {
  main().then((data) => {
    // Output json for results documentation
    console.log("\nRESULT_JSON:" + JSON.stringify(data));
  });
}

export { main as runBenchmark };
