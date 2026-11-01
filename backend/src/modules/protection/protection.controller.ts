import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { requireAuth } from "../../middlewares/auth.js";
import { validateBody } from "../../middlewares/validate.js";
import { ProtectionService } from "./protection.service.js";
import { db } from "../../db/repository.js";

const router = Router();

router.use(requireAuth);

const selfExcludeSchema = z
  .object({
    days: z
      .number()
      .int("Exclusion duration must be whole days")
      .min(1, "Minimum self-exclusion period is 1 day")
      .max(365, "Maximum self-exclusion period is 365 days"),
  })
  .strict();

const updateLimitsSchema = z
  .object({
    sessionBetLimit: z
      .number()
      .int("Limit must be integer credits")
      .positive("Session bet limit must be positive")
      .optional(),
    depositLimit: z
      .number()
      .int("Limit must be integer credits")
      .positive("Deposit limit must be positive")
      .optional(),
  })
  .strict();

router.get("/status", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await db.findUserById(req.user!.userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.status(200).json({
      selfExcludedUntil: user.self_excluded_until,
      cooldownUntil: user.cooldown_until,
      limits: user.user_limits,
    });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/self-exclude",
  validateBody(selfExcludeSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await ProtectionService.setSelfExclusion(req.user!.userId, req.body.days);
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

router.put(
  "/limits",
  validateBody(updateLimitsSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await ProtectionService.updateLimits(req.user!.userId, req.body);
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

export const protectionRouter = router;

