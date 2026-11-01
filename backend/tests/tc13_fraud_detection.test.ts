import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import path from "path";

describe("TC13: Fraud Detection (Isolation Forest on Synthetic Account Telemetry)", () => {
  it("should execute fraud detection pipeline, flag synthetic abnormal accounts, and achieve >= 80% recall", () => {
    const fraudDir = path.resolve(__dirname, "../../fraud");
    const scriptPath = path.join(fraudDir, "evaluate.py");

    // Execute Python evaluation job
    const output = execSync(`python "${scriptPath}"`, {
      cwd: fraudDir,
      encoding: "utf-8",
    });

    console.log(output);

    // Verify key indicators in output
    expect(output).toContain("FRAUD & ANOMALY DETECTION EVALUATION");
    expect(output).toContain("TC13 PASSED");
    expect(output).toMatch(/Recall\)/i);
    expect(output).toMatch(/Precision/i);
  });
});

