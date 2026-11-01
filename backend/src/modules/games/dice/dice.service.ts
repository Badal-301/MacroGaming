import { db } from "../../../db/repository.js";
import { ProvablyFairEngine } from "../../fairness/provablyFair.js";
import { WalletService } from "../../wallet/wallet.service.js";
import { ProtectionService } from "../../protection/protection.service.js";

export const DICE_HOUSE_EDGE = 0.01; // 1% House Edge

export class DiceGameService {
  /**
   * Step 1: Commitment step
   * Generates a 32-byte server seed, stores it unrevealed,
   * and returns only the SHA-256 commitment hash and the rising nonce.
   */
  static async startRound(userId: string, defaultClientSeed?: string) {
    const { serverSeed, serverSeedHash } = ProvablyFairEngine.generateServerSeed();
    const nonce = await db.getUserNextNonce(userId);

    const clientSeed = defaultClientSeed || Math.random().toString(36).substring(2, 12);

    const round = await db.createGameRound({
      user_id: userId,
      game_type: "dice",
      server_seed_hash: serverSeedHash,
      server_seed: serverSeed, // Stored securely on server, revealed only after round settles
      client_seed: clientSeed,
      nonce,
      bet_amount: 0,
      outcome: {},
      payout_amount: 0,
      status: "started",
    });

    return {
      roundId: round.id,
      serverSeedHash,
      nonce,
      clientSeed,
    };
  }

  /**
   * Step 2: Bet & Reveal step
   * Executes the bet, computes outcome via HMAC-SHA256, writes ledger entries,
   * commits the transaction, and reveals the server seed.
   */
  static async playRound(
    userId: string,
    data: {
      roundId: string;
      clientSeed: string;
      target: number;
      betAmount: number;
      idempotencyKey: string;
      // Client-sent tampered fields (TC9 verification)
      outcome?: any;
      payoutAmount?: any;
      won?: any;
    }
  ) {
    const wallet = await WalletService.getWallet(userId);

    // 1. Fetch round record
    const round = await db.findGameRoundById(data.roundId);
    if (!round) {
      throw { status: 404, message: "Game round not found" };
    }

    if (round.user_id !== userId) {
      throw { status: 403, message: "Round belongs to another player" };
    }

    if (round.status === "completed") {
      throw { status: 400, message: "Round has already been played and settled" };
    }

    // Target chance validation
    if (data.target < 1.0 || data.target > 98.0) {
      throw { status: 400, message: "Target must be between 1.00 and 98.00" };
    }

    // Responsible Gaming Protection Check (FR13 / TC12)
    const protection = await ProtectionService.checkCanBet(userId, data.betAmount);
    if (!protection.allowed) {
      throw {
        status: 403,
        message: protection.reason,
        details: protection.details,
      };
    }

    // Multiplier calculation: (100 - house_edge%) / target_chance
    // e.g. (100 - 1) / 50 = 99 / 50 = 1.98x
    const multiplier = (100 - DICE_HOUSE_EDGE * 100) / data.target;

    // 2. Concurrency-safe atomic transaction for bet, outcome, payout and round update
    return await db.executeWalletTransaction(wallet.id, async (tx) => {
      // Balance check
      const currentBalance = await tx.getBalance();
      if (data.betAmount > currentBalance) {
        throw {
          status: 400,
          message: `Insufficient balance: bet requires ${data.betAmount} credits, available ${currentBalance} credits`,
        };
      }

      // Record bet entry (negative amount)
      await tx.insertLedgerEntry({
        type: "bet",
        amount: -data.betAmount,
        reference: round.id,
        idempotencyKey: `bet_${data.idempotencyKey}`,
      });

      // 3. Compute outcome with HMAC-SHA256 strictly on server
      // Note: Client-sent `data.outcome` or `data.payoutAmount` are COMPLETELY IGNORED.
      const serverSeed = round.server_seed!;
      const diceResult = ProvablyFairEngine.calculateDiceRoll(serverSeed, data.clientSeed, round.nonce);

      // Roll under target rule
      const won = diceResult.roll < data.target;
      const payoutAmount = won ? Math.floor(data.betAmount * multiplier) : 0;

      // If player won, record payout entry in the same transaction
      if (won && payoutAmount > 0) {
        await tx.insertLedgerEntry({
          type: "payout",
          amount: payoutAmount,
          reference: round.id,
          idempotencyKey: `payout_${data.idempotencyKey}`,
        });
      }

      // 4. Update round record and reveal server seed
      const outcomePayload = {
        roll: diceResult.roll,
        target: data.target,
        won,
        multiplier: Math.round(multiplier * 100) / 100,
        hmacHex: diceResult.hex,
        fourBytesInt: diceResult.fourBytesInt,
        houseEdge: `${DICE_HOUSE_EDGE * 100}%`,
      };

      await db.updateGameRound(round.id, {
        client_seed: data.clientSeed,
        bet_amount: data.betAmount,
        outcome: outcomePayload,
        payout_amount: payoutAmount,
        status: "completed",
      });

      const newBalance = await tx.getBalance();

      // Responsible Gaming: track wins & consecutive loss cooldown
      if (won) {
        ProtectionService.handleRoundWin(userId);
      } else {
        await ProtectionService.handleRoundLoss(userId);
      }

      // Return round resolution with revealed server seed
      return {
        roundId: round.id,
        roll: diceResult.roll,
        target: data.target,
        won,
        betAmount: data.betAmount,
        payoutAmount,
        multiplier: Math.round(multiplier * 100) / 100,
        balance: newBalance,
        serverSeed, // Revealed to the player
        serverSeedHash: round.server_seed_hash,
        clientSeed: data.clientSeed,
        nonce: round.nonce,
      };
    });
  }

  static async getUserRounds(userId: string, limit: number = 20) {
    return await db.getUserGameRounds(userId, limit);
  }

  static async getRound(roundId: string) {
    const round = await db.findGameRoundById(roundId);
    if (!round) {
      throw { status: 404, message: "Round not found" };
    }
    return round;
  }

  static verifyRound(
    serverSeed: string,
    serverSeedHash: string,
    clientSeed: string,
    nonce: number
  ) {
    return ProvablyFairEngine.verifyRound(serverSeed, serverSeedHash, clientSeed, nonce);
  }
}

