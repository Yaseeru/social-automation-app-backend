const axios = require('axios');

// This is the base URL of your Python Flask API.
const PYTHON_API_BASE_URL = process.env.PYTHON_API_BASE_URL

class TrendsService {
  /**
   * Fetches general trending searches from the Python API.
   * @param {string} geo - The geographic location code (e.g., 'US', 'IN').
   * @param {number} limit - The number of results to return.
   * @returns {Promise<Array>} A list of trending topics.
   */
  async getGeneralTrending(geo = 'US', limit = 20) {
    try {
      const response = await axios.get(`${PYTHON_API_BASE_URL}/trending`, {
        params: { geo, limit }
      });
      return response.data.trending_searches;
    } catch (error) {
      console.error('Error calling Python Trends API:', error.message);
      throw new Error('Failed to fetch trends from Python service.');
    }
  }

  /**
   * Analyzes keywords using the Python API.
   * @param {Array<string>} keywords - A list of keywords to analyze.
   * @param {string} geo - The geographic location code.
   * @returns {Promise<Object>} An object containing the analysis results.
   */
  async analyzeKeywords(keywords, geo = 'US') {
    try {
      const keywordsString = keywords.join(',');
      const response = await axios.get(`${PYTHON_API_BASE_URL}/analyze`, {
        params: { keywords: keywordsString, geo }
      });
      return response.data.analysis;
    } catch (error) {
      console.error('Error calling Python Analysis API:', error.message);
      throw new Error('Failed to analyze keywords with Python service.');
    }
  }
}

module.exports = new TrendsService();
