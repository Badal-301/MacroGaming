import { Router, Request, Response, NextFunction } from "express";
import { requireAuth } from "../../../middlewares/auth.js";
import { validateBody } from "../../../middlewares/validate.js";
import {
  startDiceRoundSchema,
  playDiceSchema,
  verifySchema,
} from "./dice.schema.js";
import { DiceGameService } from "./dice.service.js";

const router = Router();

/**
 * POST /api/games/dice/start
 * Step 1: Commitment step. Generates server seed, publishes SHA-256 hash & nonce.
 */
router.post(
  "/dice/start",
  requireAuth,
  validateBody(startDiceRoundSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const commitment = await DiceGameService.startRound(
        req.user!.userId,
        req.body.clientSeed
      );
      res.status(200).json(commitment);
    } catch (err: any) {
      if (err.status) {
        res.status(err.status).json({ error: err.message, details: err.details });
        return;
      }
      next(err);
    }
  }
);

/**
 * POST /api/games/dice/play
 * Step 2: Bet & Reveal step. Settles bet, computes outcome on server, reveals server seed.
 */
router.post(
  "/dice/play",
  requireAuth,
  validateBody(playDiceSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await DiceGameService.playRound(req.user!.userId, req.body);
      res.status(200).json(result);
    } catch (err: any) {
      if (err.status) {
        res.status(err.status).json({ error: err.message, details: err.details });
        return;
      }
      next(err);
    }
  }
);

/**
 * GET /api/games/dice/rounds
 * Retrieve authenticated player's past dice rounds
 */
router.get(
  "/dice/rounds",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const rounds = await DiceGameService.getUserRounds(req.user!.userId, limit);
      res.status(200).json(rounds);
    } catch (err: any) {
      if (err.status) {
        res.status(err.status).json({ error: err.message, details: err.details });
        return;
      }
      next(err);
    }
  }
);

/**
 * POST /api/games/verify
 * Public Provably Fair Verifier: anyone can verify any round with seeds & nonce
 */
router.post(
  "/verify",
  validateBody(verifySchema),
  (req: Request, res: Response) => {
    const { serverSeed, serverSeedHash, clientSeed, nonce } = req.body;
    const result = DiceGameService.verifyRound(
      serverSeed,
      serverSeedHash,
      clientSeed,
      nonce
    );
    res.status(200).json({
      success: true,
      ...result,
    });
  }
);

export const gamesRouter = router;

