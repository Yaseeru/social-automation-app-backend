const mongoose = require('mongoose');

const userPreferenceSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Link to the User model
    required: true,
    unique: true, // A user can only have one preference document
  },
  // Store a single preferred post time for free users
  preferred_post_time: {
    type: String, // e.g., "10:00"
    default: null, // Initially null until the user sets it
  },
  // We'll keep the multi-time feature for a future premium upgrade
  preferred_post_times: [{
    type: String,
    required: true,
  }],
}, { timestamps: true });

const UserPreference = mongoose.model('UserPreference', userPreferenceSchema);
module.exports = UserPreference;
