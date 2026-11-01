import { db } from "../../../db/repository.js";
import { ProvablyFairEngine } from "../../fairness/provablyFair.js";
import { WalletService } from "../../wallet/wallet.service.js";
import { BlackjackEngine, Card } from "./blackjack.engine.js";
import { emitBalanceUpdate, emitGameResult } from "../../realtime/socket.js";

export const BLACKJACK_HOUSE_EDGE = 0.005; // 0.5% with basic strategy

export interface BlackjackGameState {
  playerHand: Card[];
  dealerHand: Card[]; // Note: Hole card hidden to client until settlement
  shuffledDeck: Card[];
  deckIndex: number;
}

export class BlackjackService {
  /**
   * Deal initial hand
   */
  static async deal(
    userId: string,
    data: {
      betAmount: number;
      clientSeed: string;
      idempotencyKey: string;
    }
  ) {
    const wallet = await WalletService.getWallet(userId);

    // 1. Generate provably fair server seed & nonce
    const { serverSeed, serverSeedHash } = ProvablyFairEngine.generateServerSeed();
    const nonce = await db.getUserNextNonce(userId);

    // 2. Shuffle deck provably fair
    const deck = BlackjackEngine.shuffleDeck(serverSeed, data.clientSeed, nonce);

    // Deal 2 cards to player and 2 cards to dealer
    const playerHand = [deck[0], deck[2]];
    const dealerHand = [deck[1], deck[3]];
    let deckIndex = 4;

    const playerScore = BlackjackEngine.calculateScore(playerHand);
    const dealerScore = BlackjackEngine.calculateScore(dealerHand);

    // 3. Atomically debit the bet
    return await db.executeWalletTransaction(wallet.id, async (tx) => {
      const currentBalance = await tx.getBalance();
      if (data.betAmount > currentBalance) {
        throw {
          status: 400,
          message: `Insufficient balance: ${data.betAmount} credits needed, ${currentBalance} available`,
        };
      }

      // Create round record
      const round = await db.createGameRound({
        user_id: userId,
        game_type: "blackjack",
        server_seed_hash: serverSeedHash,
        server_seed: serverSeed,
        client_seed: data.clientSeed,
        nonce,
        bet_amount: data.betAmount,
        outcome: {},
        payout_amount: 0,
        status: "in_progress",
      });

      // Debit bet entry
      await tx.insertLedgerEntry({
        type: "bet",
        amount: -data.betAmount,
        reference: round.id,
        idempotencyKey: `bet_${data.idempotencyKey}`,
      });

      // Check for immediate natural Blackjack
      if (playerScore.isBlackjack) {
        let payout = 0;
        let resultType = "loss";

        if (dealerScore.isBlackjack) {
          // Push (Tie)
          payout = data.betAmount;
          resultType = "push";
        } else {
          // Natural 3:2 payout (e.g. 100 bet -> 250 return)
          payout = Math.floor(data.betAmount * 2.5);
          resultType = "blackjack";
        }

        if (payout > 0) {
          await tx.insertLedgerEntry({
            type: "payout",
            amount: payout,
            reference: round.id,
            idempotencyKey: `payout_${data.idempotencyKey}`,
          });
        }

        const outcomePayload = {
          playerHand,
          dealerHand,
          playerScore: playerScore.score,
          dealerScore: dealerScore.score,
          result: resultType,
          status: "completed",
        };

        await db.updateGameRound(round.id, {
          outcome: outcomePayload,
          payout_amount: payout,
          status: "completed",
        });

        const newBalance = await tx.getBalance();
        emitBalanceUpdate(userId, newBalance, { type: "blackjack_settle", payout });
        emitGameResult(userId, "blackjack", outcomePayload);

        return {
          roundId: round.id,
          playerHand,
          dealerHand, // Revealed
          playerScore: playerScore.score,
          dealerScore: dealerScore.score,
          status: "completed",
          result: resultType,
          payoutAmount: payout,
          balance: newBalance,
          serverSeed, // Revealed
          serverSeedHash,
          clientSeed: data.clientSeed,
          nonce,
        };
      }

      // Normal ongoing hand: hide dealer's hole card from client
      const visibleDealerHand = [dealerHand[0]];

      const savedState: BlackjackGameState = {
        playerHand,
        dealerHand,
        shuffledDeck: deck,
        deckIndex,
      };

      await db.updateGameRound(round.id, {
        outcome: savedState,
      });

      const newBalance = await tx.getBalance();
      emitBalanceUpdate(userId, newBalance, { type: "blackjack_deal" });

      return {
        roundId: round.id,
        playerHand,
        dealerHand: visibleDealerHand, // Only 1 card visible during play!
        playerScore: playerScore.score,
        status: "in_progress",
        balance: newBalance,
        serverSeedHash,
        nonce,
      };
    });
  }

  /**
   * Hit action: player draws next card
   */
  static async hit(userId: string, roundId: string) {
    const round = await db.findGameRoundById(roundId);
    if (!round || round.user_id !== userId) {
      throw { status: 404, message: "Round not found" };
    }
    if (round.status !== "in_progress") {
      throw { status: 400, message: "Round is already completed" };
    }

    const state = round.outcome as BlackjackGameState;
    const nextCard = state.shuffledDeck[state.deckIndex++];
    state.playerHand.push(nextCard);

    const playerScore = BlackjackEngine.calculateScore(state.playerHand);

    // Player Busts (> 21)
    if (playerScore.isBust) {
      const dealerScore = BlackjackEngine.calculateScore(state.dealerHand);

      const outcomePayload = {
        playerHand: state.playerHand,
        dealerHand: state.dealerHand,
        playerScore: playerScore.score,
        dealerScore: dealerScore.score,
        result: "bust",
        status: "completed",
      };

      await db.updateGameRound(round.id, {
        outcome: outcomePayload,
        payout_amount: 0,
        status: "completed",
      });

      const balance = await db.getBalance((await WalletService.getWallet(userId)).id);
      emitGameResult(userId, "blackjack", outcomePayload);

      return {
        roundId: round.id,
        playerHand: state.playerHand,
        dealerHand: state.dealerHand, // Revealed
        playerScore: playerScore.score,
        dealerScore: dealerScore.score,
        status: "completed",
        result: "bust",
        payoutAmount: 0,
        balance,
        serverSeed: round.server_seed, // Revealed
        serverSeedHash: round.server_seed_hash,
      };
    }

    // Ongoing hand
    await db.updateGameRound(round.id, {
      outcome: state,
    });

    const balance = await db.getBalance((await WalletService.getWallet(userId)).id);

    return {
      roundId: round.id,
      playerHand: state.playerHand,
      dealerHand: [state.dealerHand[0]],
      playerScore: playerScore.score,
      status: "in_progress",
      balance,
    };
  }

  /**
   * Stand action: dealer plays out hand and settles
   */
  static async stand(userId: string, roundId: string) {
    const round = await db.findGameRoundById(roundId);
    if (!round || round.user_id !== userId) {
      throw { status: 404, message: "Round not found" };
    }
    if (round.status !== "in_progress") {
      throw { status: 400, message: "Round is already completed" };
    }

    const wallet = await WalletService.getWallet(userId);
    const state = round.outcome as BlackjackGameState;

    // Dealer hits until >= 17
    let dealerScore = BlackjackEngine.calculateScore(state.dealerHand);
    while (dealerScore.score < 17 && state.deckIndex < state.shuffledDeck.length) {
      const card = state.shuffledDeck[state.deckIndex++];
      state.dealerHand.push(card);
      dealerScore = BlackjackEngine.calculateScore(state.dealerHand);
    }

    const playerScore = BlackjackEngine.calculateScore(state.playerHand);

    // Evaluate result
    let result = "loss";
    let payout = 0;

    if (dealerScore.isBust) {
      result = "win";
      payout = round.bet_amount * 2;
    } else if (playerScore.score > dealerScore.score) {
      result = "win";
      payout = round.bet_amount * 2;
    } else if (playerScore.score === dealerScore.score) {
      result = "push";
      payout = round.bet_amount;
    } else {
      result = "loss";
      payout = 0;
    }

    // Commit payout in wallet transaction
    return await db.executeWalletTransaction(wallet.id, async (tx) => {
      if (payout > 0) {
        await tx.insertLedgerEntry({
          type: "payout",
          amount: payout,
          reference: round.id,
          idempotencyKey: `payout_bj_stand_${round.id}`,
        });
      }

      const outcomePayload = {
        playerHand: state.playerHand,
        dealerHand: state.dealerHand,
        playerScore: playerScore.score,
        dealerScore: dealerScore.score,
        result,
        status: "completed",
      };

      await db.updateGameRound(round.id, {
        outcome: outcomePayload,
        payout_amount: payout,
        status: "completed",
      });

      const newBalance = await tx.getBalance();
      emitBalanceUpdate(userId, newBalance, { type: "blackjack_settle", payout });
      emitGameResult(userId, "blackjack", outcomePayload);

      return {
        roundId: round.id,
        playerHand: state.playerHand,
        dealerHand: state.dealerHand,
        playerScore: playerScore.score,
        dealerScore: dealerScore.score,
        status: "completed",
        result,
        payoutAmount: payout,
        balance: newBalance,
        serverSeed: round.server_seed, // Revealed
        serverSeedHash: round.server_seed_hash,
        clientSeed: round.client_seed,
        nonce: round.nonce,
      };
    });
  }
}

