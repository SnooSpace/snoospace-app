const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { createPool, ensureTables } = require("./config/db");
const routes = require("./routes/index");
const schedulerService = require("./services/schedulerService");
const { verifyRazorpaySignature, handleRazorpayWebhook } = require("./routes/webhooks");

// Nodemon reload complete
const app = express();
app.use(cors());

// ⚠️ Razorpay webhook MUST be registered before express.json()
// Razorpay signs the raw request body — parsing it first breaks signature verification
app.post(
  "/webhooks/razorpay",
  express.raw({ type: "application/json" }),
  verifyRazorpaySignature,
  handleRazorpayWebhook,
);

app.use(express.json());

// ── DEV ONLY: Network latency simulation ─────────────────────────────────────
// Set SIMULATE_LATENCY_MS=2000 in .env to add artificial delay to every response.
// This lets you test scroll performance, loading states, and polling behaviour
// under "bad network" conditions without needing a real slow connection.
// Set to 0 or remove the variable to disable completely.
const SIMULATE_LATENCY_MS = parseInt(process.env.SIMULATE_LATENCY_MS || "0", 10);
if (SIMULATE_LATENCY_MS > 0) {
  console.log(`⚠️  [DEV] Latency simulation active: +${SIMULATE_LATENCY_MS}ms on every response`);
  app.use((_req, _res, next) => setTimeout(next, SIMULATE_LATENCY_MS));
}


// PostgreSQL connection
const pool = createPool();
pool
  .connect()
  .then(() => {
    console.log("✅ Connected to PostgreSQL");
    // Initialize scheduler service after DB connection
    schedulerService.init(pool);
  })
  .catch((err) => console.error("❌ DB Connection Error", err));

// Expose pool to routes
app.locals.pool = pool;

// Ensure required tables exist
ensureTables(pool);

const http = require("http");
const { Server } = require("socket.io");

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Save io on app.locals to make it accessible to controllers without circular dependencies
app.locals.io = io;

io.on("connection", (socket) => {
  console.log("[Socket.io] Client connected:", socket.id);

  // User joins their personal room on login
  socket.on("register_user", (userId) => {
    socket.join(`user_${userId}`);
    socket.userId = userId;
    console.log(`[Socket.io] User ${userId} registered on socket ${socket.id}`);
  });

  // User joins a chat room
  socket.on("join_chat", (chatId) => {
    socket.join(`chat_${chatId}`);
    console.log(`[Socket.io] Socket ${socket.id} joined chat_${chatId}`);
  });

  // User leaves a chat room
  socket.on("leave_chat", (chatId) => {
    socket.leave(`chat_${chatId}`);
    console.log(`[Socket.io] Socket ${socket.id} left chat_${chatId}`);
  });

  // Typing indicator — broadcast to everyone in room except sender
  socket.on("typing_start", ({ chatId, userId, userName }) => {
    socket.to(`chat_${chatId}`).emit("user_typing", { userId, userName });
  });

  socket.on("typing_stop", ({ chatId, userId }) => {
    socket.to(`chat_${chatId}`).emit("user_stopped_typing", { userId });
  });

  socket.on("disconnect", () => {
    console.log("[Socket.io] Client disconnected:", socket.id);
  });
});

// Load routes
app.use("/", routes);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

module.exports = { io };
