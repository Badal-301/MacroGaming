import http from "http";
import { Server as SocketIOServer } from "socket.io";
import { app } from "./app.js";
import { config } from "./config/index.js";
import { connectDb } from "./db/client.js";
import { initSocketServer } from "./modules/realtime/socket.js";

const server = http.createServer(app);

export const io = new SocketIOServer(server, {
  cors: {
    origin: config.CORS_ORIGIN || "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Initialize real-time authentication & rooms
initSocketServer(io);

async function start() {
  await connectDb();

  server.listen(config.PORT, () => {
    console.log(`Server listening on port ${config.PORT}`);
    console.log(`Educational simulation banner: "Educational simulation. No real money is involved."`);
  });
}

if (process.env.NODE_ENV !== "test") {
  start();
}

export { server };

