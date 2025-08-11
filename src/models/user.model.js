const mongoose = require('mongoose');

// Define the User schema
const userSchema = new mongoose.Schema({
  xId: {
    type: String,
    required: true,
    unique: true, // Ensures no duplicate X accounts
  },
  username: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  profileImageUrl: {
    type: String,
  },
  accessToken: {
    type: String,
    required: true, // This token will be used for API calls
  },
  hashedRefreshToken: {
    type: String,
    required: true, // This is the securely hashed refresh token
  },
  tokenExpiry: {
    type: Date,
    required: true, // Stores the expiration time of the access token
  },
}, { timestamps: true }); // Adds createdAt and updatedAt fields automatically

// Create and export the User model
const User = mongoose.model('User', userSchema);
module.exports = User;
