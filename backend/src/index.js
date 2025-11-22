import express from "express";
import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import dotenv from "dotenv";
import { connectDB } from "./libs/db.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import { app, server } from "./libs/socket.js";
import path from "path";

dotenv.config();
const PORT = process.env.PORT;
const __dirname = path.resolve();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true })); // use for extract the json data from req body
app.use(cookieParser());

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
  });
}
server.listen(PORT, console.log(`server is started at ${PORT}`), connectDB());
