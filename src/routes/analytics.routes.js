const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const multer = require('multer');
const analyticsService = require('../services/analytics.service');

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// --- Analytics Routes ---

/**
 * @route POST /api/analytics/upload
 * @desc Upload a CSV file of X analytics data for processing and storage.
 * @access Protected
 */
router.post('/upload', protect, upload.single('analyticsFile'), async (req, res) => {
  const user = req.user;
  const file = req.file;

  if (!file) {
    return res.status(400).send('No file uploaded.');
  }

  try {
    const insights = await analyticsService.processCsv(file.path, user._id);
    return res.status(200).json(insights);
  } catch (error) {
    console.error('Error processing analytics file:', error);
    return res.status(500).send('Failed to process analytics data.');
  }
});

/**
 * @route GET /api/analytics/insights
 * @desc Get processed analytics insights for the authenticated user from the database.
 * @access Protected
 */
router.get('/insights', protect, async (req, res) => {
  const user = req.user;
  try {
    const insights = await analyticsService.getInsights(user._id);
    return res.status(200).json(insights);
  } catch (error) {
    console.error('Error fetching analytics insights:', error);
    return res.status(500).send('Failed to fetch analytics insights.');
  }
});

module.exports = router;
