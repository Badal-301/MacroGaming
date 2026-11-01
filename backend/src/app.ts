import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { config } from "./config/index.js";
import { authRouter } from "./modules/auth/auth.controller.js";
import { adminRouter } from "./modules/admin/admin.controller.js";
import { walletRouter } from "./modules/wallet/wallet.controller.js";
import { gamesRouter } from "./modules/games/dice/dice.controller.js";
import { blackjackRouter } from "./modules/games/blackjack/blackjack.controller.js";
import { protectionRouter } from "./modules/protection/protection.controller.js";

export const app = express();

// Security headers
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("X-Simulation-Notice", "Educational simulation. No real money is involved.");
  next();
});

// CORS configuration
app.use(
  cors({
    origin: config.CORS_ORIGIN || "*",
    credentials: true,
  })
);

app.use(express.json());

// Health & Educational Banner check
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    notice: "Educational simulation. No real money is involved.",
    timestamp: new Date().toISOString(),
  });
});

// Module routes
app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/wallet", walletRouter);
app.use("/api/games", gamesRouter);
app.use("/api/games/blackjack", blackjackRouter);
app.use("/api/protection", protectionRouter);

// Global 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: config.NODE_ENV === "development" ? err.message : undefined,
  });
});

