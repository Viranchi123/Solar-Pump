import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import colors from "colors";
import { connectDB } from "./config/dbConnection.js";
import router from "./routes/index.js";
import { syncModels } from "./models/index.js";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: [process.env.USER_URL],
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
    app.listen(PORT, () => {
      console.log(colors.cyan(`🚀 Server running on port ${PORT}`));
    });
  } catch (error) {
    console.error(colors.red("❌ Failed to start server:"), error);
    process.exit(1);
  }
};

startServer();