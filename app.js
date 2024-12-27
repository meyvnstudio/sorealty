import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";

// Routes
import authRoutes from "./routes/auth.route.js";
import userRoutes from "./routes/user.route.js";

// Middleware
import { verifyToken } from "./middleware/verifyToken.js";

// Prisma
import prisma from "./lib/prisma.js";

// Load environment variables
dotenv.config();

const app = express();

// Middlewares
app.use(cors({ origin: "http://localhost:5173", credentials: true })); // Adjust origin as needed
app.use(cookieParser());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);

// Socket.IO setup
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Adjust as needed
    credentials: true,
  },
});

let onlineUsers = [];

// Helper functions for managing online users
const addUser = (userId, socketId) => {
  if (!onlineUsers.some((user) => user.userId === userId)) {
    onlineUsers.push({ userId, socketId });
  }
};

const removeUser = (socketId) => {
  onlineUsers = onlineUsers.filter((user) => user.socketId !== socketId);
};

const getUser = (userId) => {
  return onlineUsers.find((user) => user.userId === userId);
};

// Socket.IO event listeners
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Add new user
  socket.on("newUser", (userId) => {
    addUser(userId, socket.id);
    console.log("Online users:", onlineUsers);
  });

  // Send message
  socket.on("sendMessage", async ({ senderId, receiverId, text, chatId }) => {
    const receiver = getUser(receiverId);

    // Save message to database
    const message = await prisma.message.create({
      data: {
        text,
        userId: senderId,
        chatId,
      },
    });

    if (receiver) {
      io.to(receiver.socketId).emit("getMessage", { senderId, text, message });
    }
  });

  // Disconnect user
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    removeUser(socket.id);
  });
});

// Test endpoint
app.get("/", (req, res) => {
  res.send("API is running!");
});

// Server listener
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
