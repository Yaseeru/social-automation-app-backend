// Load environment variables from .env file
require("dotenv").config();

// Import necessary libraries
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const rateLimit = require('express-rate-limit'); 

// Import routes
const authRoutes = require("./src/routes/auth.routes");
const postRoutes = require("./src/routes/post.routes");
const trendsRoutes = require('./src/routes/trends.routes');
const analyticsRoutes = require('./src/routes/analytics.routes');
const preferenceRoutes = require('./src/routes/preference.routes'); 
const { startScheduler } = require("./src/services/scheduler.service");

const { errorHandler } = require('./src/middleware/error.middleware');

// Initialize the Express app
const app = express();

// --- Middleware Setup ---
app.use(cors());
app.use(express.json());

// Configure the rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `windowMs`
  standardHeaders: true, // Return rate limit info in the headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
});

// --- Database Connection ---
const connectDB = async () => {
  try {
    // Attempt to connect to the MongoDB database using the URI from the .env file
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected successfully!");
    // Start the post scheduler AFTER the database is connected
    startScheduler();
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    // Exit the process with failure if the connection fails
    process.exit(1);
  }
};

// Apply the rate limiting middleware to all API requests
app.use('/api/', limiter);

// --- Routes Setup ---
app.use("/auth", authRoutes);
app.use("/api/posts", postRoutes);
app.use('/api/trends', trendsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/preferences', preferenceRoutes);

// --- Error Handling Middleware ---
app.use(errorHandler);

// --- Server Startup ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  // Connect to the database when the server starts
  connectDB();
});

// A simple test route to confirm the server is working
app.get("/", (req, res) => {
  res.send("X Automation App Backend is running!");
});
