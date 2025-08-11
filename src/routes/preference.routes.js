const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const UserPreference = require('../models/user_preference.model');

// --- User Preference Routes ---

/**
 * @route GET /api/preferences
 * @desc Get a user's saved posting time preferences.
 * @access Protected
 */
router.get('/', protect, async (req, res) => {
  try {
    const preferences = await UserPreference.findOne({ user: req.user._id });
    if (!preferences) {
      return res.status(404).send('No preferences found for this user.');
    }
    return res.status(200).json(preferences);
  } catch (error) {
    console.error('Error fetching user preferences:', error);
    return res.status(500).send('Failed to fetch user preferences.');
  }
});

/**
 * @route PUT /api/preferences
 * @desc Update a user's posting time preferences.
 * @access Protected
 */
router.put('/', protect, async (req, res) => {
  const { preferred_post_time, preferred_post_times } = req.body;

  let updateData = {};
  if (typeof preferred_post_time === 'string' && preferred_post_time.length > 0) {
    // If a single time string is provided, store it as a single-element array
    updateData = { preferred_post_times: [preferred_post_time] };
  } else if (Array.isArray(preferred_post_times) && preferred_post_times.length > 0) {
    // If an array of times is provided, store the array
    updateData = { preferred_post_times: preferred_post_times };
  } else {
    // If input is invalid or empty
    return res.status(400).send('Invalid input. Expected a valid single time string or an array of times.');
  }

  try {
    const preferences = await UserPreference.findOneAndUpdate(
      { user: req.user._id },
      { $set: updateData },
      { new: true, upsert: true }
    );
    return res.status(200).json(preferences);
  } catch (error) {
    console.error('Error updating user preferences:', error);
    return res.status(500).send('Failed to update user preferences.');
  }
});

module.exports = router;
