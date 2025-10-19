import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import colors from "colors";
import { createServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { connectDB } from "./config/dbConnection.js";
import router from "./routes/index.js";
import { syncModels } from "./models/index.js";
import { setSocketIO } from "./services/notificationService.js";
import DeadlineMonitorService from "./services/deadlineMonitorService.js";
import { initializeFirebase } from "./config/firebase.js";

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 5000;

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: [
      process.env.USER_URL || "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:8080",
      "http://127.0.0.1:8080",
      "http://localhost:5000",
      "http://127.0.0.1:5000"
    ],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Set Socket.IO instance for notification service
setSocketIO(io);

// Socket.IO authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    socket.userRole = decoded.role;
    socket.isAdmin = decoded.role === 'admin';
    next();
  } catch (err) {
    next(new Error('Authentication error: Invalid token'));
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`User ${socket.userId} (${socket.userRole}) connected`);
  
  // Join user to their specific room
  socket.join(`user_${socket.userId}`);
  socket.join(`role_${socket.userRole}`);
  
  // Join admin room if user is admin
  if (socket.isAdmin) {
    socket.join('role_admin');
  }

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User ${socket.userId} (${socket.userRole}) disconnected`);
  });

  // Handle custom events if needed
  socket.on('joinWorkOrder', (workOrderId) => {
    socket.join(`workorder_${workOrderId}`);
  });

  socket.on('leaveWorkOrder', (workOrderId) => {
    socket.leave(`workorder_${workOrderId}`);
  });
});

// Middleware
app.use(cors({
  origin: [
    process.env.USER_URL || "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:5000",
    "http://127.0.0.1:5000"
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Serve static files from templates directory
app.use('/templates', express.static('templates'));

// Test endpoint
app.get("/", (req, res) => {
  res.json({ message: "Server is running!" });
});

// Routes
app.use("/api", router);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(colors.red("Error:"), err.stack);
  res.status(500).json({ message: "Internal server error" });
});

// Start server
const startServer = async () => {
  try {
    await connectDB();
    await syncModels(); // Sync models with database
    
    // Initialize Firebase for push notifications
    initializeFirebase();
    
    server.listen(PORT, () => {
      console.log(colors.cyan(`🚀 Server running on port ${PORT}`));
      console.log(colors.green(`📡 Socket.IO enabled for real-time notifications`));
      console.log(colors.magenta(`🔔 Firebase Push Notifications ready`));
      
      // Start deadline monitoring service
      DeadlineMonitorService.start();
    });
  } catch (error) {
    console.error(colors.red("❌ Failed to start server:"), error);
    process.exit(1);
  }
};

startServer();