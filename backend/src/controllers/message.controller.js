import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import cloudinary from "../libs/cloudinary.js";
import { getReceiverSocketId, io } from "../libs/socket.js";

export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    // TODO: In the future, we can sort these by 'lastMessage' timestamp for true WhatsApp ordering
    const filteredUsers = await User.find({
      _id: { $ne: loggedInUserId },
    }).select("-password");

    return res.status(200).json(filteredUsers);
  } catch (error) {
    console.log("Error in getUsersForSidebar controller ", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
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
    }).populate("replyTo", "text image audio"); // <--- FIX: Populate reply context

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
      // PRO TIP: Use 'video' resource_type for audio to ensure better cross-browser playback URL support
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

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: imageUrl,
      audio: audioUrl,
      audioDuration,
      replyTo: replyTo || null,
    });

    await newMessage.save();

    // 4. Populate BEFORE emitting socket event so the receiver sees the reply preview instantly
    const populatedMessage = await Message.findById(newMessage._id).populate(
      "replyTo",
      "text image audio",
    );

    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", populatedMessage);
    }

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.log("Error in sendMessage:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
