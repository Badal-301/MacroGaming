import { ProvablyFairEngine } from "../../fairness/provablyFair.js";

export interface Card {
  suit: "H" | "D" | "C" | "S";
  rank: "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";
  value: number;
}

export const SUITS: Card["suit"][] = ["H", "D", "C", "S"];
export const RANKS: Card["rank"][] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

export class BlackjackEngine {
  /**
   * Generates a standard fresh 52-card deck
   */
  static createDeck(): Card[] {
    const deck: Card[] = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        let value = parseInt(rank, 10);
        if (["J", "Q", "K"].includes(rank)) value = 10;
        if (rank === "A") value = 11;
        deck.push({ suit, rank, value });
      }
    }
    return deck;
  }

  /**
   * Shuffles standard deck using Provably Fair Fisher-Yates with HMAC cursor
   */
  static shuffleDeck(serverSeed: string, clientSeed: string, nonce: number): Card[] {
    const deck = this.createDeck();
    let cursor = 0;

    for (let i = deck.length - 1; i > 0; i--) {
      // Draw 4 bytes from HMAC-SHA256(serverSeed, clientSeed:nonce:cursor)
      const hmac = ProvablyFairEngine.computeHmac(serverSeed, clientSeed, nonce, cursor);
      cursor++;

      const fourBytesInt = parseInt(hmac.substring(0, 8), 16);
      const j = fourBytesInt % (i + 1);

      // Swap
      const temp = deck[i];
      deck[i] = deck[j];
      deck[j] = temp;
    }

    return deck;
  }

  /**
   * Calculates hand score with dynamic Ace valuation (1 or 11)
   */
  static calculateScore(hand: Card[]): { score: number; isSoft: boolean; isBust: boolean; isBlackjack: boolean } {
    let score = 0;
    let aces = 0;

    for (const card of hand) {
      if (card.rank === "A") {
        aces++;
        score += 11;
      } else {
        score += card.value;
      }
    }

    // Downgrade Aces from 11 to 1 if busting
    while (score > 21 && aces > 0) {
      score -= 10;
      aces--;
    }

    const isBust = score > 21;
    const isBlackjack = hand.length === 2 && score === 21;
    const isSoft = aces > 0;

    return { score, isSoft, isBust, isBlackjack };
  }
}

