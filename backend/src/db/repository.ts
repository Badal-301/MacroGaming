import { prisma } from "./client.js";
import { config } from "../config/index.js";

// Check if we should use Prisma or in-memory repository (e.g. for vitest when no DB is available)
let useInMemory = process.env.USE_IN_MEMORY_DB === "true";

export function setUseInMemory(val: boolean) {
  useInMemory = val;
}

export function isUsingInMemory() {
  return useInMemory;
}

// In-memory collections
export interface MemoryUser {
  id: string;
  email: string;
  password_hash: string;
  role: "player" | "admin";
  created_at: Date;
  self_excluded_until: Date | null;
  cooldown_until: Date | null;
}

export interface MemoryWallet {
  id: string;
  user_id: string;
}

export interface MemoryLedgerEntry {
  id: string;
  wallet_id: string;
  type: "deposit" | "withdrawal" | "bet" | "payout";
  amount: number;
  reference: string;
  idempotency_key: string;
  created_at: Date;
}

export interface MemoryUserLimit {
  user_id: string;
  session_bet_limit: number;
  deposit_limit: number;
  updated_at: Date;
}

export interface MemoryRefreshToken {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
}

export interface MemoryGameRound {
  id: string;
  user_id: string;
  game_type: string;
  server_seed_hash: string;
  server_seed: string | null;
  client_seed: string;
  nonce: number;
  bet_amount: number;
  outcome: any;
  payout_amount: number;
  status: string;
  created_at: Date;
}

export interface MemoryFraudFlag {
  id: string;
  user_id: string;
  anomaly_score: number;
  reason: string;
  status: "open" | "reviewed";
  reviewed_by: string | null;
  created_at: Date;
}

// Wallet row lock queue for in-memory / non-raw test environments
class AsyncLock {
  private queue: Promise<void> = Promise.resolve();

  async acquire<T>(fn: () => Promise<T>): Promise<T> {
    let release: () => void;
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    const current = this.queue;
    this.queue = current.then(() => wait);
    await current;
    try {
      return await fn();
    } finally {
      release!();
    }
  }
}

const walletLocks = new Map<string, AsyncLock>();

function getWalletLock(walletId: string): AsyncLock {
  let lock = walletLocks.get(walletId);
  if (!lock) {
    lock = new AsyncLock();
    walletLocks.set(walletId, lock);
  }
  return lock;
}

export const memoryStore = {
  users: [] as MemoryUser[],
  wallets: [] as MemoryWallet[],
  ledgerEntries: [] as MemoryLedgerEntry[],
  userLimits: [] as MemoryUserLimit[],
  refreshTokens: [] as MemoryRefreshToken[],
  gameRounds: [] as MemoryGameRound[],
  fraudFlags: [] as MemoryFraudFlag[],

  clear() {
    this.users = [];
    this.wallets = [];
    this.ledgerEntries = [];
    this.userLimits = [];
    this.refreshTokens = [];
    this.gameRounds = [];
    this.fraudFlags = [];
    walletLocks.clear();
  },
};

export const db = {
  // USERS
  async createUser(data: { email: string; password_hash: string; role?: "player" | "admin" }) {
    if (useInMemory) {
      if (memoryStore.users.some((u) => u.email.toLowerCase() === data.email.toLowerCase())) {
        const error: any = new Error("Unique constraint failed on the fields: (`email`)");
        error.code = "P2002";
        throw error;
      }
      const user: MemoryUser = {
        id: crypto.randomUUID(),
        email: data.email.toLowerCase(),
        password_hash: data.password_hash,
        role: data.role || "player",
        created_at: new Date(),
        self_excluded_until: null,
        cooldown_until: null,
      };
      memoryStore.users.push(user);

      // Create wallet
      const wallet: MemoryWallet = {
        id: crypto.randomUUID(),
        user_id: user.id,
      };
      memoryStore.wallets.push(wallet);

      // Create user limit
      memoryStore.userLimits.push({
        user_id: user.id,
        session_bet_limit: 10000,
        deposit_limit: 50000,
        updated_at: new Date(),
      });

      return { ...user, wallet };
    }

    return await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        password_hash: data.password_hash,
        role: data.role || "player",
        wallet: {
          create: {},
        },
        user_limits: {
          create: {},
        },
      },
      include: {
        wallet: true,
      },
    });
  },

  async findUserByEmail(email: string) {
    if (useInMemory) {
      const user = memoryStore.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (!user) return null;
      const wallet = memoryStore.wallets.find((w) => w.user_id === user.id);
      return { ...user, wallet };
    }
    return await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { wallet: true },
    });
  },

  async findUserById(id: string) {
    if (useInMemory) {
      const user = memoryStore.users.find((u) => u.id === id);
      if (!user) return null;
      const wallet = memoryStore.wallets.find((w) => w.user_id === user.id);
      const limits = memoryStore.userLimits.find((l) => l.user_id === user.id);
      return { ...user, wallet, user_limits: limits };
    }
    return await prisma.user.findUnique({
      where: { id },
      include: { wallet: true, user_limits: true },
    });
  },

  async updateUser(id: string, data: Partial<MemoryUser>) {
    if (useInMemory) {
      const userIndex = memoryStore.users.findIndex((u) => u.id === id);
      if (userIndex === -1) return null;
      memoryStore.users[userIndex] = { ...memoryStore.users[userIndex], ...data };
      return memoryStore.users[userIndex];
    }
    return await prisma.user.update({
      where: { id },
      data,
    });
  },

  // REFRESH TOKENS
  async createRefreshToken(userId: string, tokenHash: string, expiresAt: Date) {
    if (useInMemory) {
      const item: MemoryRefreshToken = {
        id: crypto.randomUUID(),
        user_id: userId,
        token_hash: tokenHash,
        expires_at: expiresAt,
        revoked_at: null,
      };
      memoryStore.refreshTokens.push(item);
      return item;
    }
    return await prisma.refreshToken.create({
      data: {
        user_id: userId,
        token_hash: tokenHash,
        expires_at: expiresAt,
      },
    });
  },

  async findRefreshToken(tokenHash: string) {
    if (useInMemory) {
      const item = memoryStore.refreshTokens.find((t) => t.token_hash === tokenHash);
      if (!item) return null;
      const user = memoryStore.users.find((u) => u.id === item.user_id);
      return { ...item, user };
    }
    return await prisma.refreshToken.findFirst({
      where: { token_hash: tokenHash },
      include: { user: true },
    });
  },

  async revokeRefreshToken(tokenHash: string) {
    if (useInMemory) {
      const item = memoryStore.refreshTokens.find((t) => t.token_hash === tokenHash);
      if (item) {
        item.revoked_at = new Date();
      }
      return item;
    }
    return await prisma.refreshToken.updateMany({
      where: { token_hash: tokenHash },
      data: { revoked_at: new Date() },
    });
  },

  async revokeAllUserRefreshTokens(userId: string) {
    if (useInMemory) {
      memoryStore.refreshTokens
        .filter((t) => t.user_id === userId)
        .forEach((t) => {
          t.revoked_at = new Date();
        });
      return;
    }
    await prisma.refreshToken.updateMany({
      where: { user_id: userId, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  },

  // WALLET & LEDGER
  async getWalletByUserId(userId: string) {
    if (useInMemory) {
      return memoryStore.wallets.find((w) => w.user_id === userId) || null;
    }
    return await prisma.wallet.findUnique({
      where: { user_id: userId },
    });
  },

  async getBalance(walletId: string): Promise<number> {
    if (useInMemory) {
      return memoryStore.ledgerEntries
        .filter((entry) => entry.wallet_id === walletId)
        .reduce((sum, entry) => sum + entry.amount, 0);
    }
    const result = await prisma.ledgerEntry.aggregate({
      where: { wallet_id: walletId },
      _sum: { amount: true },
    });
    return result._sum.amount || 0;
  },

  async findLedgerEntryByIdempotencyKey(key: string) {
    if (useInMemory) {
      return memoryStore.ledgerEntries.find((e) => e.idempotency_key === key) || null;
    }
    return await prisma.ledgerEntry.findUnique({
      where: { idempotency_key: key },
    });
  },

  async getLedgerEntries(walletId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    if (useInMemory) {
      const matching = memoryStore.ledgerEntries
        .filter((e) => e.wallet_id === walletId)
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

      const total = matching.length;
      const entries = matching.slice(skip, skip + limit);
      return { entries, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    const [entries, total] = await Promise.all([
      prisma.ledgerEntry.findMany({
        where: { wallet_id: walletId },
        orderBy: { created_at: "desc" },
        skip,
        take: limit,
      }),
      prisma.ledgerEntry.count({
        where: { wallet_id: walletId },
      }),
    ]);

    return { entries, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  /**
   * Concurrency-safe atomic transaction for wallet modifications.
   * Locks the wallet row (SELECT ... FOR UPDATE), evaluates balance,
   * checks idempotency, and records the ledger entry.
   */
  async executeWalletTransaction<T>(
    walletId: string,
    operation: (tx: {
      getBalance: () => Promise<number>;
      insertLedgerEntry: (entry: {
        type: "deposit" | "withdrawal" | "bet" | "payout";
        amount: number;
        reference: string;
        idempotencyKey: string;
      }) => Promise<MemoryLedgerEntry>;
      injectFailure?: boolean;
    }) => Promise<T>,
    options?: { disableLocking?: boolean }
  ): Promise<T> {
    const shouldLock =
      options?.disableLocking === true ? false : config.ROW_LOCKING_ENABLED;

    const runWork = async () => {
      if (useInMemory) {
        // In-memory transaction with rollback support
        const snapshotEntries = [...memoryStore.ledgerEntries];

        const tx = {
          getBalance: async () => {
            return memoryStore.ledgerEntries
              .filter((e) => e.wallet_id === walletId)
              .reduce((sum, e) => sum + e.amount, 0);
          },
          insertLedgerEntry: async (entry: {
            type: "deposit" | "withdrawal" | "bet" | "payout";
            amount: number;
            reference: string;
            idempotencyKey: string;
          }) => {
            // When locking is disabled in test mode, simulate race window between read and commit
            if (!shouldLock) {
              await new Promise((r) => setTimeout(r, 10));
            }

            // Check unique constraint on idempotency key
            if (memoryStore.ledgerEntries.some((e) => e.idempotency_key === entry.idempotencyKey)) {
              const err: any = new Error("Unique constraint failed on idempotency_key");
              err.code = "P2002";
              throw err;
            }

            const newEntry: MemoryLedgerEntry = {
              id: crypto.randomUUID(),
              wallet_id: walletId,
              type: entry.type,
              amount: entry.amount,
              reference: entry.reference,
              idempotency_key: entry.idempotencyKey,
              created_at: new Date(),
            };
            memoryStore.ledgerEntries.push(newEntry);
            return newEntry;
          },
        };

        try {
          return await operation(tx);
        } catch (err) {
          // Rollback to snapshot on failure
          memoryStore.ledgerEntries = snapshotEntries;
          throw err;
        }
      }

      // Real PostgreSQL Prisma interactive transaction with SELECT ... FOR UPDATE
      return await prisma.$transaction(async (tx) => {
        if (shouldLock) {
          // Lock the wallet row
          await tx.$queryRaw`SELECT id FROM wallets WHERE id = ${walletId} FOR UPDATE`;
        }

        const getBalance = async () => {
          const res = await tx.ledgerEntry.aggregate({
            where: { wallet_id: walletId },
            _sum: { amount: true },
          });
          return res._sum.amount || 0;
        };

        const insertLedgerEntry = async (entry: {
          type: "deposit" | "withdrawal" | "bet" | "payout";
          amount: number;
          reference: string;
          idempotencyKey: string;
        }) => {
          return (await tx.ledgerEntry.create({
            data: {
              wallet_id: walletId,
              type: entry.type,
              amount: entry.amount,
              reference: entry.reference,
              idempotency_key: entry.idempotencyKey,
            },
          })) as any;
        };

        return await operation({ getBalance, insertLedgerEntry });
      });
    };

    if (shouldLock) {
      const lock = getWalletLock(walletId);
      return await lock.acquire(runWork);
    } else {
      return await runWork();
    }
  },

  // GAME ROUNDS
  async createGameRound(data: {
    user_id: string;
    game_type: string;
    server_seed_hash: string;
    server_seed?: string | null;
    client_seed: string;
    nonce: number;
    bet_amount: number;
    outcome: any;
    payout_amount: number;
    status: string;
  }) {
    if (useInMemory) {
      const round: MemoryGameRound = {
        id: crypto.randomUUID(),
        user_id: data.user_id,
        game_type: data.game_type,
        server_seed_hash: data.server_seed_hash,
        server_seed: data.server_seed || null,
        client_seed: data.client_seed,
        nonce: data.nonce,
        bet_amount: data.bet_amount,
        outcome: data.outcome,
        payout_amount: data.payout_amount,
        status: data.status,
        created_at: new Date(),
      };
      memoryStore.gameRounds.push(round);
      return round;
    }

    return await prisma.gameRound.create({
      data: {
        user_id: data.user_id,
        game_type: data.game_type,
        server_seed_hash: data.server_seed_hash,
        server_seed: data.server_seed,
        client_seed: data.client_seed,
        nonce: data.nonce,
        bet_amount: data.bet_amount,
        outcome: data.outcome,
        payout_amount: data.payout_amount,
        status: data.status,
      },
    });
  },

  async findGameRoundById(id: string) {
    if (useInMemory) {
      return memoryStore.gameRounds.find((r) => r.id === id) || null;
    }
    return await prisma.gameRound.findUnique({
      where: { id },
    });
  },

  async updateGameRound(id: string, data: Partial<MemoryGameRound>) {
    if (useInMemory) {
      const idx = memoryStore.gameRounds.findIndex((r) => r.id === id);
      if (idx === -1) return null;
      memoryStore.gameRounds[idx] = { ...memoryStore.gameRounds[idx], ...data };
      return memoryStore.gameRounds[idx];
    }
    return await prisma.gameRound.update({
      where: { id },
      data,
    });
  },

  async getUserGameRounds(userId: string, limit: number = 20) {
    if (useInMemory) {
      return memoryStore.gameRounds
        .filter((r) => r.user_id === userId)
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
        .slice(0, limit);
    }
    return await prisma.gameRound.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      take: limit,
    });
  },

  async getUserNextNonce(userId: string): Promise<number> {
    if (useInMemory) {
      const userRounds = memoryStore.gameRounds.filter((r) => r.user_id === userId);
      return userRounds.length + 1;
    }
    const count = await prisma.gameRound.count({
      where: { user_id: userId },
    });
    return count + 1;
  },

  // ADMIN & FRAUD
  async getAllUsers(limit: number = 50) {
    if (useInMemory) {
      return memoryStore.users.slice(0, limit).map((u) => {
        const wallet = memoryStore.wallets.find((w) => w.user_id === u.id);
        const limits = memoryStore.userLimits.find((l) => l.user_id === u.id);
        const balance = memoryStore.ledgerEntries
          .filter((e) => e.wallet_id === wallet?.id)
          .reduce((sum, e) => sum + e.amount, 0);

        return {
          id: u.id,
          email: u.email,
          role: u.role,
          created_at: u.created_at,
          self_excluded_until: u.self_excluded_until,
          cooldown_until: u.cooldown_until,
          walletId: wallet?.id,
          balance,
          limits,
        };
      });
    }

    return await prisma.user.findMany({
      take: limit,
      orderBy: { created_at: "desc" },
      include: {
        wallet: true,
        user_limits: true,
      },
    });
  },

  async getAllTransactions(filters?: { userId?: string; type?: string; limit?: number }) {
    const limit = filters?.limit || 50;

    if (useInMemory) {
      let filtered = [...memoryStore.ledgerEntries];
      if (filters?.userId) {
        const wallet = memoryStore.wallets.find((w) => w.user_id === filters.userId);
        filtered = filtered.filter((e) => e.wallet_id === wallet?.id);
      }
      if (filters?.type) {
        filtered = filtered.filter((e) => e.type === filters.type);
      }
      return filtered
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
        .slice(0, limit);
    }

    const where: any = {};
    if (filters?.type) where.type = filters.type;
    if (filters?.userId) {
      const user = await prisma.user.findUnique({
        where: { id: filters.userId },
        include: { wallet: true },
      });
      if (user?.wallet) {
        where.wallet_id = user.wallet.id;
      }
    }

    return await prisma.ledgerEntry.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: limit,
      include: { wallet: { include: { user: true } } },
    });
  },

  async createFraudFlag(data: {
    user_id: string;
    anomaly_score: number;
    reason: string;
    status?: "open" | "reviewed";
  }) {
    if (useInMemory) {
      const flag: MemoryFraudFlag = {
        id: crypto.randomUUID(),
        user_id: data.user_id,
        anomaly_score: data.anomaly_score,
        reason: data.reason,
        status: data.status || "open",
        reviewed_by: null,
        created_at: new Date(),
      };
      memoryStore.fraudFlags.push(flag);
      return flag;
    }

    return await prisma.fraudFlag.create({
      data: {
        user_id: data.user_id,
        anomaly_score: data.anomaly_score,
        reason: data.reason,
        status: data.status || "open",
      },
    });
  },

  async getFraudFlags(status?: "open" | "reviewed") {
    if (useInMemory) {
      let flags = [...memoryStore.fraudFlags];
      if (status) {
        flags = flags.filter((f) => f.status === status);
      }
      return flags.sort((a, b) => b.created_at.getTime() - a.created_at.getTime()).map((f) => {
        const user = memoryStore.users.find((u) => u.id === f.user_id);
        const reviewer = f.reviewed_by ? memoryStore.users.find((u) => u.id === f.reviewed_by) : null;
        return {
          ...f,
          user: user ? { id: user.id, email: user.email } : null,
          reviewer: reviewer ? { id: reviewer.id, email: reviewer.email } : null,
        };
      });
    }

    return await prisma.fraudFlag.findMany({
      where: status ? { status } : undefined,
      orderBy: { created_at: "desc" },
      include: {
        user: { select: { id: true, email: true } },
        reviewer: { select: { id: true, email: true } },
      },
    });
  },

  async reviewFraudFlag(flagId: string, adminUserId: string) {
    if (useInMemory) {
      const flag = memoryStore.fraudFlags.find((f) => f.id === flagId);
      if (flag) {
        flag.status = "reviewed";
        flag.reviewed_by = adminUserId;
      }
      return flag;
    }

    return await prisma.fraudFlag.update({
      where: { id: flagId },
      data: {
        status: "reviewed",
        reviewed_by: adminUserId,
      },
    });
  },
};
