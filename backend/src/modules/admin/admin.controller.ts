import { Router, Request, Response, NextFunction } from "express";
import { requireAuth, requireRole } from "../../middlewares/auth.js";
import { db } from "../../db/repository.js";

const router = Router();

// Strict Admin-only middleware
router.use(requireAuth, requireRole("admin"));

/**
 * GET /api/admin/overview
 * High-level platform telemetry
 */
router.get("/overview", async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const users = await db.getAllUsers(500);
    const flags = await db.getFraudFlags("open");
    const transactions = await db.getAllTransactions({ limit: 500 });

    const totalVolume = transactions.reduce((acc, t) => acc + Math.abs(t.amount), 0);

    res.status(200).json({
      message: "Admin overview granted",
      stats: {
        totalUsers: users.length,
        totalVolume,
        openFraudFlags: flags.length,
        excludedUsers: users.filter((u: any) => u.self_excluded_until && new Date(u.self_excluded_until) > new Date()).length,
        cooldownUsers: users.filter((u: any) => u.cooldown_until && new Date(u.cooldown_until) > new Date()).length,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/users
 * User directory with account status
 */
router.get("/users", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const users = await db.getAllUsers(limit);
    res.status(200).json(users);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/transactions
 * Filterable transaction history
 */
router.get("/transactions", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.query.userId as string | undefined;
    const type = req.query.type as string | undefined;
    const limit = parseInt(req.query.limit as string, 10) || 50;

    const transactions = await db.getAllTransactions({ userId, type, limit });
    res.status(200).json(transactions);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/fraud-flags
 * Accounts flagged by Isolation Forest
 */
router.get("/fraud-flags", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const status = req.query.status as "open" | "reviewed" | undefined;
    const flags = await db.getFraudFlags(status);
    res.status(200).json(flags);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/admin/fraud-flags/:id/review
 * Mark flag reviewed by admin
 */
router.patch("/fraud-flags/:id/review", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const updated = await db.reviewFraudFlag(id, req.user!.userId);
    res.status(200).json({
      success: true,
      message: "Flag marked as reviewed",
      flag: updated,
    });
  } catch (err) {
    next(err);
  }
});

export const adminRouter = router;
