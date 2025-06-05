const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const { Server } = require("socket.io");
const http = require("http");
const cron = require("node-cron");
const resetCheckIns = require("./scripts/resetCheckIns");

// Routes
const userRoutes = require("./routes/users");
const offerRoutes = require("./routes/offers");
const clickRoutes = require("./routes/clicks");

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin:
      process.env.NODE_ENV === "production"
        ? [process.env.FRONTEND_URL || "https://your-frontend-domain.com"]
        : "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log("User: New client connected");

  // Join a room based on user ID
  socket.on("join", (userId) => {
    socket.join(userId);
    console.log(`User: User ${userId} joined their room`);
  });

  socket.on("disconnect", () => {
    console.log("User: Client disconnected");
  });
});

// Make io accessible to routes
app.set("io", io);

// Middleware
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? [process.env.FRONTEND_URL || "https://your-frontend-domain.com"]
        : "*",
    credentials: true,
  })
);
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

// Routes
app.use("/api/users", userRoutes);
app.use("/api/offers", offerRoutes);
app.use("/api/clicks", clickRoutes);

// MongoDB Connection with retry logic
const connectDB = async () => {
  const MONGODB_URI =
    process.env.MONGODB_URI || "mongodb://localhost:27017/rewards_app";
  const MAX_RETRIES = 5;
  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      await mongoose.connect(MONGODB_URI);
      console.log("Connected to MongoDB");
      break;
    } catch (err) {
      console.error(`MongoDB connection attempt ${retries + 1} failed:`, err);
      retries++;
      if (retries === MAX_RETRIES) {
        console.error("Failed to connect to MongoDB after maximum retries");
        process.exit(1);
      }
      // Wait for 5 seconds before retrying
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
};

connectDB();

// Schedule daily check-in reset at midnight (00:00)
cron.schedule(
  "0 0 * * *",
  async () => {
    console.log("Running daily check-in reset...");
    try {
      await resetCheckIns();
      console.log("Daily check-in reset completed successfully");
    } catch (error) {
      console.error("Error in daily check-in reset:", error);
    }
  },
  {
    scheduled: true,
    timezone: "Asia/Kolkata", // Set to Indian timezone
  }
);

// Basic route for testing
app.get("/", (req, res) => {
  res.send("Server is running");
});

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ message: "Route not found" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message:
      process.env.NODE_ENV === "production"
        ? "Something went wrong!"
        : err.message,
    error: process.env.NODE_ENV === "production" ? {} : err,
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
