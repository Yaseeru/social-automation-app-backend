const fs = require('fs');
const csv = require('csv-parser');
const Analytics = require('../models/analytics.model');

/**
 * Service to process and analyze social media analytics data.
 */
class AnalyticsService {

  /**
   * Processes a CSV file, extracts key metrics, and saves insights to the database.
   * @param {string} filePath - The path to the CSV file.
   * @param {string} userId - The ID of the authenticated user.
   * @returns {Promise<Object>} The processed insights saved to the database.
   */
  async processCsv(filePath, userId) {
    if (!fs.existsSync(filePath)) {
        throw new Error('File not found at the specified path.');
    }

    return new Promise((resolve, reject) => {
      const results = [];
      const dataByHour = {};
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
          results.push(data);
        })
        .on('end', async () => {
          fs.unlinkSync(filePath); // Clean up the temporary file

          if (results.length === 0) {
            const emptyInsights = await Analytics.findOneAndUpdate(
              { user: userId },
              { $set: { best_times_to_post: [], hourly_insights: [], last_updated: Date.now() } },
              { upsert: true, new: true }
            );
            return resolve(emptyInsights);
          }

          results.forEach(post => {
            // Add a validation check for the time field
            if (post['time']) {
              const date = new Date(post['time']);
              // Ensure the date is valid before proceeding
              if (!isNaN(date.getHours())) {
                const hour = date.getHours();

                if (!dataByHour[hour]) {
                  dataByHour[hour] = { engagements: 0, postCount: 0 };
                }

                const engagement = parseInt(post['engagements']) || 0;
                dataByHour[hour].engagements += engagement;
                dataByHour[hour].postCount++;
              }
            }
          });

          const hourlyInsights = Object.keys(dataByHour).map(hour => {
            const avgEngagement = dataByHour[hour].engagements / dataByHour[hour].postCount;
            return {
              hour: parseInt(hour),
              average_engagement: avgEngagement
            };
          });

          hourlyInsights.sort((a, b) => b.average_engagement - a.average_engagement);
          const bestTimes = hourlyInsights.slice(0, 3);
          
          const insights = await Analytics.findOneAndUpdate(
            { user: userId },
            { $set: { best_times_to_post: bestTimes, hourly_insights: hourlyInsights, last_updated: Date.now() } },
            { upsert: true, new: true }
          );
          
          resolve(insights);
        })
        .on('error', (error) => {
          console.error('Error parsing CSV:', error);
          fs.unlinkSync(filePath);
          reject(new Error('Failed to parse CSV file.'));
        });
    });
  }

  async getInsights(userId) {
    const insights = await Analytics.findOne({ user: userId });
    if (!insights) {
      return { message: "No analytics insights found. Please upload a CSV file first." };
    }
    return insights;
  }
}

module.exports = new AnalyticsService();
