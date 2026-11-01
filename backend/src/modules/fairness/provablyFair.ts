import crypto from "crypto";

export interface ProvablyFairCommitment {
  serverSeed: string;
  serverSeedHash: string;
}

export interface DiceOutcome {
  roll: number;
  hex: string;
  fourBytesInt: number;
}

export class ProvablyFairEngine {
  /**
   * Generates a secure 32-byte server seed and its published SHA-256 commitment hash
   */
  static generateServerSeed(): ProvablyFairCommitment {
    const serverSeed = crypto.randomBytes(32).toString("hex");
    const serverSeedHash = crypto.createHash("sha256").update(serverSeed).digest("hex");
    return { serverSeed, serverSeedHash };
  }

  /**
   * Computes SHA-256 hash using Node's crypto
   */
  static sha256(data: string): string {
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  /**
   * Generates HMAC-SHA256 signature
   * Message format: clientSeed:nonce or clientSeed:nonce:cursor
   */
  static computeHmac(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    cursor?: number
  ): string {
    const message = cursor !== undefined ? `${clientSeed}:${nonce}:${cursor}` : `${clientSeed}:${nonce}`;
    return crypto.createHmac("sha256", serverSeed).update(message).digest("hex");
  }

  /**
   * Generates provably fair dice roll: 0.00 to 99.99
   * Takes the first 4 bytes of HMAC-SHA256 as an unsigned 32-bit integer,
   * divides by 2^32, and scales to [0.00, 99.99].
   * Uses division (not modulo/remainder) to ensure zero bias.
   */
  static calculateDiceRoll(serverSeed: string, clientSeed: string, nonce: number): DiceOutcome {
    const hmac = this.computeHmac(serverSeed, clientSeed, nonce);

    // First 4 bytes (8 hex characters)
    const first4BytesHex = hmac.substring(0, 8);
    const fourBytesInt = parseInt(first4BytesHex, 16);

    // Divide by 2^32 (4294967296)
    const float = fourBytesInt / 0x100000000;

    // Scale to 0.00 - 99.99
    const roll = Math.floor(float * 10000) / 100;

    return {
      roll,
      hex: hmac,
      fourBytesInt,
    };
  }

  /**
   * Independent verification of a past round
   */
  static verifyRound(
    serverSeed: string,
    serverSeedHash: string,
    clientSeed: string,
    nonce: number
  ): {
    isValidCommitment: boolean;
    recomputedHash: string;
    roll: number;
  } {
    const recomputedHash = this.sha256(serverSeed);
    const isValidCommitment = recomputedHash.toLowerCase() === serverSeedHash.toLowerCase();
    const outcome = this.calculateDiceRoll(serverSeed, clientSeed, nonce);

    return {
      isValidCommitment,
      recomputedHash,
      roll: outcome.roll,
    };
  }
}

