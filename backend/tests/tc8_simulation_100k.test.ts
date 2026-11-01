import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { ProvablyFairEngine } from "../src/modules/fairness/provablyFair.js";

describe("TC8: 100,000 Simulated Rounds & Chi-Square Goodness-of-Fit Test", () => {
  it("should simulate 100,000 dice rolls, verify observed win rate against theoretical, and pass Chi-Square test", () => {
    const TOTAL_ROUNDS = 100000;
    const TARGET = 50.0; // Win if roll < 50.00
    const THEORETICAL_WIN_RATE = 0.5; // 5000 outcomes out of 10000

    const serverSeed = crypto.randomBytes(32).toString("hex");
    const clientSeed = "academic_simulation_seed_test_100k";

    let observedWins = 0;
    let observedLosses = 0;

    const startTime = Date.now();

    for (let nonce = 1; nonce <= TOTAL_ROUNDS; nonce++) {
      const outcome = ProvablyFairEngine.calculateDiceRoll(serverSeed, clientSeed, nonce);

      if (outcome.roll < TARGET) {
        observedWins++;
      } else {
        observedLosses++;
      }
    }

    const durationMs = Date.now() - startTime;

    const observedWinRate = observedWins / TOTAL_ROUNDS;
    const expectedWins = TOTAL_ROUNDS * THEORETICAL_WIN_RATE;
    const expectedLosses = TOTAL_ROUNDS * (1 - THEORETICAL_WIN_RATE);

    // Pearson's Chi-Square Test Statistic: Sum((O - E)^2 / E)
    const chiSquare =
      Math.pow(observedWins - expectedWins, 2) / expectedWins +
      Math.pow(observedLosses - expectedLosses, 2) / expectedLosses;

    // Degrees of freedom = k - 1 = 2 - 1 = 1
    // Critical value for alpha = 0.05 is 3.841
    // Critical value for alpha = 0.01 is 6.635
    const chiSquareCritical_05 = 3.841;
    const chiSquareCritical_01 = 6.635;

    console.log(`\n--- TC8 100,000 Rounds Simulation Results ---`);
    console.log(`Total Rounds: ${TOTAL_ROUNDS.toLocaleString()}`);
    console.log(`Execution Time: ${durationMs} ms (${Math.round((TOTAL_ROUNDS / durationMs) * 1000)} rolls/sec)`);
    console.log(`Target: Roll under ${TARGET.toFixed(2)}`);
    console.log(`Theoretical Win Rate: ${(THEORETICAL_WIN_RATE * 100).toFixed(2)}%`);
    console.log(`Observed Win Rate: ${(observedWinRate * 100).toFixed(4)}% (${observedWins.toLocaleString()} wins)`);
    console.log(`Difference: ${(Math.abs(observedWinRate - THEORETICAL_WIN_RATE) * 100).toFixed(4)}%`);
    console.log(`Chi-Square Statistic (df=1): ${chiSquare.toFixed(4)}`);
    console.log(`Passes alpha=0.01 threshold (< 6.635): ${chiSquare < chiSquareCritical_01}`);
    console.log(`---------------------------------------------\n`);

    // Win rate must be very close to 50% (within 0.8% margin for 100k samples)
    expect(Math.abs(observedWinRate - THEORETICAL_WIN_RATE)).toBeLessThan(0.008);

    // Chi-Square statistic must be below the critical value at alpha=0.01
    expect(chiSquare).toBeLessThan(chiSquareCritical_01);
  });
});

