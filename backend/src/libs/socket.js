import { Server } from "socket.io";
import express from "express";
import http from "http";
import User from "../models/user.model.js"; // Import User model

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173"],
  },
});

export function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

// Store online users in memory for quick access
const userSocketMap = {}; // {userId: socketId}

io.on("connection", async (socket) => {
  const userId = socket.handshake.query.userId;

  if (userId) {
    userSocketMap[userId] = socket.id;

    // UPDATE DB: User is now online
    await User.findByIdAndUpdate(userId, { isOnline: true });
  }

  // Emit online users immediately
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  socket.on("typing", ({ chatId }) => {
    const receiverSocketId = getReceiverSocketId(chatId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("typing", { senderId: userId });
    }
  });

  socket.on("stopTyping", ({ chatId }) => {
    const receiverSocketId = getReceiverSocketId(chatId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("stopTyping", { senderId: userId });
    }
  });

  socket.on("disconnect", async () => {
    if (userId) {
      delete userSocketMap[userId];

      // UPDATE DB: User is offline, record timestamp
      await User.findByIdAndUpdate(userId, {
        isOnline: false,
        lastSeen: new Date(),
      });

      io.emit("getOnlineUsers", Object.keys(userSocketMap));
    }
  });
});

export { io, server, app };
