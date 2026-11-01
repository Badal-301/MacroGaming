import { Router, Request, Response, NextFunction } from "express";
import { requireAuth } from "../../../middlewares/auth.js";
import { validateBody } from "../../../middlewares/validate.js";
import { dealBlackjackSchema, actionBlackjackSchema } from "./blackjack.schema.js";
import { BlackjackService } from "./blackjack.service.js";

const router = Router();

router.use(requireAuth);

/**
 * POST /api/games/blackjack/deal
 * Start and deal initial cards
 */
router.post(
  "/deal",
  validateBody(dealBlackjackSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await BlackjackService.deal(req.user!.userId, req.body);
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
 * POST /api/games/blackjack/hit
 * Player draws additional card
 */
router.post(
  "/hit",
  validateBody(actionBlackjackSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await BlackjackService.hit(req.user!.userId, req.body.roundId);
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
 * POST /api/games/blackjack/stand
 * Player stands, dealer resolves hand
 */
router.post(
  "/stand",
  validateBody(actionBlackjackSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await BlackjackService.stand(req.user!.userId, req.body.roundId);
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

export const blackjackRouter = router;

