import { Server } from "socket.io";
import express from "express";
import http from "http";
import User from "../models/user.model.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// userId => Set of socketIds
const userSocketMap = new Map();

export function getReceiverSocketId(userId) {
  return userSocketMap.get(userId);
}

io.on("connection", async (socket) => {
  const userId = socket.handshake.auth.userId;

  if (!userId) {
    socket.disconnect();
    return;
  }

  // Add socketId to user map
  if (!userSocketMap.has(userId)) {
    userSocketMap.set(userId, new Set());
  }
  userSocketMap.get(userId).add(socket.id);

  await User.findByIdAndUpdate(userId, { isOnline: true });

  io.emit("userStatusChange", { userId, isOnline: true });
  io.emit("getOnlineUsers", Array.from(userSocketMap.keys()));

  socket.on("typing", ({ receiverId, senderId }) => {
    const receiverSockets = getReceiverSocketId(String(receiverId));
    if (!receiverSockets) return;

    for (const sid of receiverSockets) {
      io.to(sid).emit("typing", { senderId: String(senderId) });
    }
  });

  socket.on("stopTyping", ({ receiverId, senderId }) => {
    const receiverSockets = getReceiverSocketId(String(receiverId));
    if (!receiverSockets) return;

    for (const sid of receiverSockets) {
      io.to(sid).emit("stopTyping", { senderId: String(senderId) });
    }
  });

  socket.on("disconnect", async () => {
    const userSockets = userSocketMap.get(userId);
    if (userSockets) {
      userSockets.delete(socket.id);
      if (userSockets.size === 0) {
        userSocketMap.delete(userId);

        const lastSeenTime = new Date();
        await User.findByIdAndUpdate(userId, {
          isOnline: false,
          lastSeen: lastSeenTime,
        });

        io.emit("userStatusChange", {
          userId,
          isOnline: false,
          lastSeen: lastSeenTime,
        });

        io.emit("getOnlineUsers", Array.from(userSocketMap.keys()));
      }
    }
  });
});

export { io, server, app };
