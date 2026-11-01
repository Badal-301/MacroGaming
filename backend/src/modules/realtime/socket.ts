import { Server as SocketIOServer, Socket } from "socket.io";
import { verifyAccessToken, TokenPayload } from "../../utils/crypto.js";

declare module "socket.io" {
  interface Socket {
    user?: TokenPayload;
  }
}

let ioInstance: SocketIOServer | null = null;

export function initSocketServer(io: SocketIOServer) {
  ioInstance = io;

  // Handshake authentication middleware
  io.use((socket: Socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace("Bearer ", "") ||
      (socket.handshake.query?.token as string);

    if (!token) {
      return next(new Error("Authentication error: Token required"));
    }

    try {
      const payload = verifyAccessToken(token);
      socket.user = payload;
      next();
    } catch {
      return next(new Error("Authentication error: Invalid or expired token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    if (!socket.user) return;

    const userRoom = `user:${socket.user.userId}`;
    socket.join(userRoom);

    socket.emit("connected", {
      message: "Connected to real-time notification stream",
      userId: socket.user.userId,
      notice: "Educational simulation. No real money is involved.",
    });

    socket.on("disconnect", () => {
      socket.leave(userRoom);
    });
  });
}

/**
 * Emit balance update to all open tabs/devices for this user
 */
export function emitBalanceUpdate(userId: string, newBalance: number, details?: any) {
  if (!ioInstance) return;

  ioInstance.to(`user:${userId}`).emit("balance_updated", {
    balance: newBalance,
    currency: "CREDITS",
    timestamp: new Date().toISOString(),
    details,
  });
}

/**
 * Emit round resolution to user room
 */
export function emitGameResult(userId: string, gameType: string, result: any) {
  if (!ioInstance) return;

  ioInstance.to(`user:${userId}`).emit("game_result", {
    gameType,
    result,
    timestamp: new Date().toISOString(),
  });
}

