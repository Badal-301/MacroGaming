import { Router, Request, Response, NextFunction } from "express";
import { requireAuth } from "../../middlewares/auth.js";
import { validateBody } from "../../middlewares/validate.js";
import { depositSchema, withdrawSchema } from "./wallet.schema.js";
import { WalletService } from "./wallet.service.js";

const router = Router();

// All wallet endpoints require valid authentication
router.use(requireAuth);

/**
 * GET /api/wallet/balance
 * Returns current virtual balance computed from sum of ledger entries
 */
router.get("/balance", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await WalletService.getBalance(req.user!.userId);
    res.status(200).json({
      balance: data.balance,
      walletId: data.walletId,
      currency: "CREDITS",
      mode: "test",
      notice: "Educational simulation. No real money is involved.",
    });
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    next(err);
  }
});

/**
 * POST /api/wallet/deposit
 * Process mock deposit into virtual wallet
 */
router.post(
  "/deposit",
  (req: Request, _res: Response, next: NextFunction) => {
    // Fallback: extract Idempotency-Key from headers if present
    if (!req.body.idempotencyKey && req.headers["idempotency-key"]) {
      req.body.idempotencyKey = req.headers["idempotency-key"];
    }
    next();
  },
  validateBody(depositSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { amount, idempotencyKey, gatewayReference } = req.body;
      const result = await WalletService.deposit(
        req.user!.userId,
        amount,
        idempotencyKey,
        gatewayReference
      );
      res.status(200).json(result);
    } catch (err: any) {
      if (err.status) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      next(err);
    }
  }
);

/**
 * POST /api/wallet/withdraw
 * Process mock withdrawal from virtual wallet
 */
router.post(
  "/withdraw",
  (req: Request, _res: Response, next: NextFunction) => {
    // Fallback: extract Idempotency-Key from headers if present
    if (!req.body.idempotencyKey && req.headers["idempotency-key"]) {
      req.body.idempotencyKey = req.headers["idempotency-key"];
    }
    next();
  },
  validateBody(withdrawSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { amount, idempotencyKey, gatewayReference } = req.body;
      const result = await WalletService.withdraw(
        req.user!.userId,
        amount,
        idempotencyKey,
        gatewayReference
      );
      res.status(200).json(result);
    } catch (err: any) {
      if (err.status) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      next(err);
    }
  }
);

/**
 * GET /api/wallet/transactions
 * Returns paginated transaction history, newest first
 */
router.get("/transactions", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;

    const data = await WalletService.getTransactionHistory(req.user!.userId, page, limit);
    res.status(200).json(data);
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    next(err);
  }
});

export const walletRouter = router;

