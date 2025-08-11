const mongoose = require('mongoose');

// Define the schema for hourly insights
const hourlyInsightSchema = new mongoose.Schema({
  hour: { type: Number, required: true },
  average_engagement: { type: Number, required: true },
});

// Define the main Analytics schema
const analyticsSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Link to the User model
    required: true,
    unique: true, // Ensures a user can only have one insights document
  },
  best_times_to_post: [hourlyInsightSchema],
  hourly_insights: [hourlyInsightSchema],
  last_updated: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

const Analytics = mongoose.model('Analytics', analyticsSchema);
module.exports = Analytics;
