const cron = require('node-cron');
const Post = require('../models/post.model');
const User = require('../models/user.model');
const { TwitterApi } = require('twitter-api-v2');
const bcrypt = require('bcryptjs');

// Main function to start the post-sending scheduler
const startScheduler = () => {
  cron.schedule('* * * * *', async () => {
    console.log('Running scheduled task: Checking for pending posts...');
    
    const now = new Date();

    const pendingPosts = await Post.find({
      status: 'pending',
      scheduledDate: { $lte: now }
    }).populate('user');

    if (pendingPosts.length > 0) {
      console.log(`Found ${pendingPosts.length} pending post(s) to send.`);
    }

    for (const post of pendingPosts) {
      try {
        const user = post.user;

        if (!user || !user.accessToken) {
          console.error(`Skipping post ${post._id}: User or access token not found.`);
          await Post.findByIdAndUpdate(post._id, { status: 'failed', error: 'User or access token missing.' });
          continue;
        }

        // Debug token information
        console.log('=== DEBUGGING TOKEN INFO ===');
        console.log('User ID:', user._id);
        console.log('Username:', user.username);
        console.log('Access Token exists:', !!user.accessToken);
        console.log('Access Token length:', user.accessToken ? user.accessToken.length : 0);
        console.log('Token expiry:', user.tokenExpiry);
        console.log('Current time:', new Date());
        console.log('CLIENT_ID exists:', !!process.env.CLIENT_ID);
        console.log('CLIENT_SECRET exists:', !!process.env.CLIENT_SECRET);

        // Check if the access token is about to expire
        const nowInSeconds = Math.floor(Date.now() / 1000);
        const tokenExpiryInSeconds = Math.floor(new Date(user.tokenExpiry).getTime() / 1000);
        
        if (nowInSeconds > tokenExpiryInSeconds) {
          console.log(`Access token for user ${user.username} has expired. Attempting to refresh...`);

          if (!user.refreshToken) {
            console.error(`No refresh token available for user ${user.username}`);
            await Post.findByIdAndUpdate(post._id, { status: 'failed', error: 'No refresh token available.' });
            continue;
          }

          // Re-initialize the client with app credentials to get a new token
          const appClient = new TwitterApi({
            clientId: process.env.CLIENT_ID,
            clientSecret: process.env.CLIENT_SECRET,
          });

          try {
            const refreshedClient = await appClient.refreshOAuth2Token(user.refreshToken);

            // Hash the new refresh token
            const salt = await bcrypt.genSalt(10);
            const hashedRefreshToken = await bcrypt.hash(refreshedClient.refreshToken, salt);

            // Update the user's tokens in the database with the new values
            await User.findByIdAndUpdate(user._id, {
              accessToken: refreshedClient.accessToken,
              refreshToken: refreshedClient.refreshToken,
              hashedRefreshToken: hashedRefreshToken,
              tokenExpiry: new Date(Date.now() + 7200 * 1000)
            });

            console.log(`Successfully refreshed token for user ${user.username}.`);
            user.accessToken = refreshedClient.accessToken;
          } catch (refreshError) {
            console.error(`Failed to refresh token for user ${user.username}:`, refreshError.message);
            await Post.findByIdAndUpdate(post._id, { status: 'failed', error: 'Token refresh failed.' });
            continue;
          }
        }

        // Create Twitter client with proper OAuth 2.0 configuration
        const client = new TwitterApi(user.accessToken);

        // Test the token before trying to tweet
        try {
          console.log('Testing token validity...');
          const me = await client.v2.me();
          console.log('✅ Token is valid! User:', me.data.username);
        } catch (testError) {
          console.error('❌ Token test failed:', testError.message);
          
          // If token test fails, try to refresh if we have a refresh token
          if (user.refreshToken) {
            console.log('Attempting emergency token refresh...');
            try {
              const appClient = new TwitterApi({
                clientId: process.env.CLIENT_ID,
                clientSecret: process.env.CLIENT_SECRET,
              });
              
              const refreshedClient = await appClient.refreshOAuth2Token(user.refreshToken);
              
              // Update database
              const salt = await bcrypt.genSalt(10);
              const hashedRefreshToken = await bcrypt.hash(refreshedClient.refreshToken, salt);
              
              await User.findByIdAndUpdate(user._id, {
                accessToken: refreshedClient.accessToken,
                refreshToken: refreshedClient.refreshToken,
                hashedRefreshToken: hashedRefreshToken,
                tokenExpiry: new Date(Date.now() + 7200 * 1000)
              });
              
              // Recreate client with new token
              const newClient = new TwitterApi({
                clientId: process.env.CLIENT_ID,
                clientSecret: process.env.CLIENT_SECRET,
              }, {
                type: 'oauth2',
                token: refreshedClient.accessToken,
              });
              
              // Retry the tweet with new token
              const response = await newClient.v2.tweet({ text: post.text });
              
              await Post.findByIdAndUpdate(post._id, {
                status: 'sent',
                postId: response.data.id,
              });

              console.log(`Successfully sent post ${response.data.id} for user ${user.username} after token refresh`);
              continue;
              
            } catch (emergencyRefreshError) {
              console.error('Emergency token refresh failed:', emergencyRefreshError.message);
              await Post.findByIdAndUpdate(post._id, { status: 'failed', error: 'Token validation and refresh failed.' });
              continue;
            }
          } else {
            await Post.findByIdAndUpdate(post._id, { status: 'failed', error: 'Invalid token and no refresh token available.' });
            continue;
          }
        }

        // Send the tweet
        const response = await client.v2.tweet({ text: post.text });

        await Post.findByIdAndUpdate(post._id, {
          status: 'sent',
          postId: response.data.id,
        });

        console.log(`Successfully sent post ${response.data.id} for user ${user.username}`);

      } catch (error) {
        console.error(`Failed to send post ${post._id}:`, error);

        // Handle specific error cases
        if (error.code === 403) {
          if (error.data?.detail?.includes('duplicate content')) {
            console.log(`Post ${post._id} failed due to duplicate content. Marking as failed.`);
            await Post.findByIdAndUpdate(post._id, { status: 'failed', error: 'Duplicate content.' });
          } else {
            console.log(`Post ${post._id} failed due to permission issue.`);
            await Post.findByIdAndUpdate(post._id, { status: 'failed', error: 'Permission denied.' });
          }
        } else if (error.code === 401) {
          console.log(`Post ${post._id} failed due to authentication issue.`);
          await Post.findByIdAndUpdate(post._id, { status: 'failed', error: 'Authentication failed.' });
        } else {
          await Post.findByIdAndUpdate(post._id, { status: 'failed', error: error.message });
        }
      }
    }
  });
  console.log('Post scheduler has started.');
};

module.exports = { startScheduler };