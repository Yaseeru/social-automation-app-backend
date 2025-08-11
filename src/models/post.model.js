const mongoose = require('mongoose');

// Define the Post schema
const postSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Reference to the User model
    required: true,
  },
  text: {
    type: String,
    required: true,
    maxlength: 280, // Enforce X's character limit
  },
  // Scheduled post time
  scheduledDate: {
    type: Date,
    required: true,
  },
  // Status of the post
  status: {
    type: String,
    enum: ['pending', 'sent', 'failed'],
    default: 'pending',
  },
  // The ID of the post after it's been sent to X
  postId: {
    type: String,
  },
}, { timestamps: true });

// Create and export the Post model
const Post = mongoose.model('Post', postSchema);
module.exports = Post;
