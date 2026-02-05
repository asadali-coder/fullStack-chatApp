import { Router } from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  getMessages,
  getUsersForSidebar,
  markAsRead,
  sendMessage,
} from "../controllers/message.controller.js";
const router = Router();

router.get("/users", protectRoute, getUsersForSidebar);
router.get("/:id", protectRoute, getMessages);
router.post("/send/:id", protectRoute, sendMessage);
router.put("/read/:id", protectRoute, markAsRead);

export default router;
