import { Router, Request, Response, NextFunction } from "express";
import { AuthService } from "./auth.service.js";
import { validateBody } from "../../middlewares/validate.js";
import { registerSchema, loginSchema, refreshTokenSchema } from "./auth.schema.js";
import { requireAuth } from "../../middlewares/auth.js";
import { loginRateLimiter } from "../../middlewares/rateLimiter.js";

const router = Router();

router.post(
  "/register",
  validateBody(registerSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await AuthService.register(req.body);
      res.status(201).json({
        message: "Registration successful",
        user,
      });
    } catch (err: any) {
      if (err.status) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      next(err);
    }
  }
);

router.post(
  "/login",
  loginRateLimiter,
  validateBody(loginSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await AuthService.login(req.body);
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

router.post(
  "/refresh",
  validateBody(refreshTokenSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tokens = await AuthService.refresh(req.body.refreshToken);
      res.status(200).json(tokens);
    } catch (err: any) {
      if (err.status) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      next(err);
    }
  }
);

router.post(
  "/logout",
  validateBody(refreshTokenSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await AuthService.logout(req.body.refreshToken);
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

router.get("/me", requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const profile = await AuthService.getMe(req.user!.userId);
    res.status(200).json(profile);
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    next(err);
  }
});

export const authRouter = router;

