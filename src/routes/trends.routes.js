const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const trendsService = require('../services/trends.service'); // Import the new service

// --- Trends Routes ---

/**
 * @route GET /api/trends/general
 * @desc Get general trending topics from the Python service.
 * @access Public
 */
router.get('/general', async (req, res) => {
  const { geo } = req.query; // e.g., ?geo=US
  try {
    const trends = await trendsService.getGeneralTrending(geo);
    return res.status(200).json(trends);
  } catch (error) {
    console.error('Error in general trends route:', error);
    return res.status(500).send('Failed to fetch general trends.');
  }
});

/**
 * @route GET /api/trends/analyze
 * @desc Analyze keywords for trends and opportunities using the Python service.
 * @access Protected
 */
router.get('/analyze', protect, async (req, res) => {
  const { keywords, geo } = req.query; // e.g., ?keywords=python,ai&geo=US
  try {
    const keywordsArray = keywords.split(',').map(k => k.trim());
    const analysis = await trendsService.analyzeKeywords(keywordsArray, geo);
    return res.status(200).json(analysis);
  } catch (error) {
    console.error('Error in analyze route:', error);
    return res.status(500).send('Failed to analyze keywords.');
  }
});

/**
 * @route GET /api/trends/personalized
 * @desc A placeholder route for personalized trends.
 * @access Protected (user-context auth)
 * @NOTE This is a mock route for now.
 */
router.get('/personalized', protect, async (req, res) => {
  try {
    const mockTrends = [
      { trend_name: "#BuildInPublic", tweet_count: 5000, category: "Tech" },
      { trend_name: "JavaScript", tweet_count: 12000, category: "Programming" },
      { trend_name: "#MERNStack", tweet_count: 3500, category: "WebDev" }
    ];
    return res.status(200).json(mockTrends);
  } catch (error) {
    console.error('Error fetching personalized trends:', error);
    return res.status(500).send('Failed to fetch personalized trends.');
  }
});

module.exports = router;
