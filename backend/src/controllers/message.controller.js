import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import cloudinary from "../libs/cloudinary.js";
import { getReceiverSocketId, io } from "../libs/socket.js";

export const getUsersForSidebar = async (req, res) => {
  const myId = req.user._id;

  const users = await User.find({ _id: { $ne: myId } }).select("-password");

  const usersWithUnread = await Promise.all(
    users.map(async (u) => {
      const unreadCount = await Message.countDocuments({
        senderId: u._id,
        receiverId: myId,
        isRead: false,
      });

      const lastMessage = await Message.findOne({
        $or: [
          { senderId: myId, receiverId: u._id },
          { senderId: u._id, receiverId: myId },
        ],
      })
        .sort({ createdAt: -1 })
        .populate("replyTo", "text image audio");

      return { ...u.toObject(), unreadCount, lastMessage };
    }),
  );

  res.json(usersWithUnread);
};

export const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;

    // 1. Fetch messages with populated replyTo data
    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    })
      .sort({ createdAt: 1 })
      .populate("replyTo", "text image audio senderId createdAt");

    // 2. Mark incoming unread messages as READ
    const unreadMessages = messages.filter(
      (msg) => msg.receiverId.toString() === myId.toString() && !msg.isRead,
    );

    if (unreadMessages.length > 0) {
      await Message.updateMany(
        { _id: { $in: unreadMessages.map((m) => m._id) } },
        { $set: { isRead: true } },
      );

      // 3. Notify the sender that I have read their messages
      const senderSocketId = getReceiverSocketId(userToChatId);
      if (senderSocketId) {
        io.to(senderSocketId).emit("messagesSeen", {
          receiverId: myId,
          messageIds: unreadMessages.map((m) => m._id),
        });
      }
    }

    return res.status(200).json(messages);
  } catch (error) {
    console.log("Error in getMessages controller ", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, image, audio, audioDuration, replyTo } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    let imageUrl, audioUrl;

    if (image) {
      const imgRes = await cloudinary.uploader.upload(image, {
        resource_type: "image",
      });
      imageUrl = imgRes.secure_url;
    }

    if (audio) {
      const audioRes = await cloudinary.uploader.upload(
        `data:audio/ogg;base64,${audio}`,
        { resource_type: "video" },
      );
      audioUrl = audioRes.secure_url;
    }

    if (!text && !imageUrl && !audioUrl) {
      return res
        .status(400)
        .json({ error: "Message must have text, image, or audio" });
    }

    let safeReplyTo = null;

    if (replyTo) {
      const ref = await Message.findOne({
        _id: replyTo,
        $or: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId },
        ],
      }).select("_id");
      safeReplyTo = ref ? ref._id : null;
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: imageUrl,
      audio: audioUrl,
      audioDuration,
      replyTo: safeReplyTo ,
    });

    await newMessage.save();

    const populatedMessage = await Message.findById(newMessage._id).populate(
      "replyTo",
      "text image audio",
    );

    const receiverSocketIds = getReceiverSocketId(receiverId);
    if (receiverSocketIds) {
      for (const socketId of receiverSocketIds) {
        io.to(socketId).emit("newMessage", populatedMessage);

        io.to(socketId).emit("conversationUpdated", {
          userId: senderId,
          lastMessage: populatedMessage,
        });
      }
    }

    const senderSocketIds = getReceiverSocketId(senderId);
    if (senderSocketIds) {
      for (const socketId of senderSocketIds) {
        io.to(socketId).emit("conversationUpdated", {
          userId: receiverId,
          lastMessage: populatedMessage,
        });
      }
    }

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.log("Error in sendMessage:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const otherUserId = req.params.id;
    const myId = req.user._id;

    await Message.updateMany(
      { senderId: otherUserId, receiverId: myId, isRead: false },
      { $set: { isRead: true } },
    );

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: "Failed to mark as read" });
  }
};
