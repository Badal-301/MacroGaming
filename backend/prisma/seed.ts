import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";
import crypto from "crypto";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database with demo users, ledger entries, finished rounds, and fraud flags...");

  // Clear existing data (in dependency order)
  await prisma.fraudFlag.deleteMany();
  await prisma.gameRound.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.userLimit.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await argon2.hash("Password123!", {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  // 1. Admin Account
  const admin = await prisma.user.create({
    data: {
      email: "admin@platform.edu",
      password_hash: passwordHash,
      role: "admin",
      wallet: { create: {} },
      user_limits: {
        create: { session_bet_limit: 50000, deposit_limit: 100000 },
      },
    },
    include: { wallet: true },
  });

  // 2. Demo Player 1: Active honest student
  const player1 = await prisma.user.create({
    data: {
      email: "alice@student.edu",
      password_hash: passwordHash,
      role: "player",
      wallet: { create: {} },
      user_limits: {
        create: { session_bet_limit: 5000, deposit_limit: 20000 },
      },
    },
    include: { wallet: true },
  });

  // 3. Demo Player 2: Player currently in cooldown
  const player2 = await prisma.user.create({
    data: {
      email: "bob@student.edu",
      password_hash: passwordHash,
      role: "player",
      cooldown_until: new Date(Date.now() + 8 * 60 * 1000), // 8 mins left
      wallet: { create: {} },
      user_limits: {
        create: { session_bet_limit: 2000, deposit_limit: 10000 },
      },
    },
    include: { wallet: true },
  });

  // 4. Demo Player 3: Self-excluded user
  const player3 = await prisma.user.create({
    data: {
      email: "charlie@student.edu",
      password_hash: passwordHash,
      role: "player",
      self_excluded_until: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000), // 25 days left
      wallet: { create: {} },
      user_limits: {
        create: { session_bet_limit: 1000, deposit_limit: 5000 },
      },
    },
    include: { wallet: true },
  });

  // 5. Seed Ledger for Alice (Player 1)
  // Deposit 2,000 credits
  await prisma.ledgerEntry.create({
    data: {
      wallet_id: player1.wallet!.id,
      type: "deposit",
      amount: 2000,
      reference: "sim_gateway_dep_seed_01",
      idempotency_key: "seed_idem_alice_dep_01",
    },
  });

  // Round 1: Bet 100 (Loss)
  const round1Seed = crypto.randomBytes(32).toString("hex");
  const round1Hash = crypto.createHash("sha256").update(round1Seed).digest("hex");
  const round1 = await prisma.gameRound.create({
    data: {
      user_id: player1.id,
      game_type: "dice",
      server_seed_hash: round1Hash,
      server_seed: round1Seed,
      client_seed: "alice_lucky_seed",
      nonce: 1,
      bet_amount: 100,
      outcome: { roll: 78.45, target: 50.0, won: false, multiplier: 1.98 },
      payout_amount: 0,
      status: "completed",
    },
  });

  await prisma.ledgerEntry.create({
    data: {
      wallet_id: player1.wallet!.id,
      type: "bet",
      amount: -100,
      reference: round1.id,
      idempotency_key: "seed_idem_alice_bet_01",
    },
  });

  // Round 2: Bet 100 (Win)
  const round2Seed = crypto.randomBytes(32).toString("hex");
  const round2Hash = crypto.createHash("sha256").update(round2Seed).digest("hex");
  const round2 = await prisma.gameRound.create({
    data: {
      user_id: player1.id,
      game_type: "dice",
      server_seed_hash: round2Hash,
      server_seed: round2Seed,
      client_seed: "alice_lucky_seed",
      nonce: 2,
      bet_amount: 100,
      outcome: { roll: 23.12, target: 50.0, won: true, multiplier: 1.98 },
      payout_amount: 198,
      status: "completed",
    },
  });

  await prisma.ledgerEntry.create({
    data: {
      wallet_id: player1.wallet!.id,
      type: "bet",
      amount: -100,
      reference: round2.id,
      idempotency_key: "seed_idem_alice_bet_02",
    },
  });

  await prisma.ledgerEntry.create({
    data: {
      wallet_id: player1.wallet!.id,
      type: "payout",
      amount: 198,
      reference: round2.id,
      idempotency_key: "seed_idem_alice_payout_02",
    },
  });

  // 6. Seed Fraud Flags
  await prisma.fraudFlag.create({
    data: {
      user_id: player2.id,
      anomaly_score: 0.942,
      reason: "Ultra-regular bot-like bet timing (std < 0.1s); Abnormally high bet frequency (68.4 bets/min)",
      status: "open",
    },
  });

  await prisma.fraudFlag.create({
    data: {
      user_id: player3.id,
      anomaly_score: 0.815,
      reason: "Extreme bet sizing spread and rapid frequency anomaly",
      status: "reviewed",
      reviewed_by: admin.id,
    },
  });

  console.log("Database seeded successfully!");
  console.log("Accounts created:");
  console.log("  Admin: admin@platform.edu / Password123!");
  console.log("  Player: alice@student.edu / Password123! (Balance: 1,998 Credits)");
  console.log("  Player (Cooldown): bob@student.edu / Password123!");
  console.log("  Player (Self-Excluded): charlie@student.edu / Password123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

