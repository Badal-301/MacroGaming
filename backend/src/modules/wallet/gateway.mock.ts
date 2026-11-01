import crypto from "crypto";

export interface GatewayResponse {
  success: boolean;
  gatewayReference: string;
  mode: "test";
  timestamp: string;
  errorMessage?: string;
}

/**
 * Mock Simulated Payment Gateway
 * Note: Educational simulation. No real money or payment processor is ever contacted.
 */
export class MockPaymentGateway {
  static async processDeposit(amount: number, clientRef?: string): Promise<GatewayResponse> {
    const reference = clientRef || `sim_dep_${crypto.randomBytes(8).toString("hex")}`;

    // Simulated failure for testing
    if (reference.startsWith("fail_")) {
      return {
        success: false,
        gatewayReference: reference,
        mode: "test",
        timestamp: new Date().toISOString(),
        errorMessage: "Simulated mock payment gateway decline",
      };
    }

    return {
      success: true,
      gatewayReference: reference,
      mode: "test",
      timestamp: new Date().toISOString(),
    };
  }

  static async processWithdrawal(amount: number, clientRef?: string): Promise<GatewayResponse> {
    const reference = clientRef || `sim_wth_${crypto.randomBytes(8).toString("hex")}`;

    // Simulated failure for testing
    if (reference.startsWith("fail_")) {
      return {
        success: false,
        gatewayReference: reference,
        mode: "test",
        timestamp: new Date().toISOString(),
        errorMessage: "Simulated mock payout gateway failure",
      };
    }

    return {
      success: true,
      gatewayReference: reference,
      mode: "test",
      timestamp: new Date().toISOString(),
    };
  }
}

