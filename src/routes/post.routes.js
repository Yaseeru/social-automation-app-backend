const express = require('express');
const router = express.Router();
const Post = require('../models/post.model');
const User = require('../models/user.model');
const { protect } = require('../middleware/auth.middleware');
const { TwitterApi } = require('twitter-api-v2');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const trendsService = require('../services/trends.service');
const UserPreference = require('../models/user_preference.model');

const { CLIENT_ID, CLIENT_SECRET, OPENROUTER_API_KEY, JWT_SECRET, CALLBACK_URI } = process.env;

const twitterClient = new TwitterApi({
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET
});

const oauthState = {};

const generateToken = (id) => {
  return jwt.sign({ id }, JWT_SECRET, {
    expiresIn: '30d',
  });
};

router.get('/login', async (req, res) => {
  try {
    const { url, codeVerifier, state } = twitterClient.generateOAuth2AuthLink(
      CALLBACK_URI,
      { scope: ['tweet.read', 'users.read', 'tweet.write', 'offline.access'] }
    );
    oauthState[state] = codeVerifier;
    return res.redirect(url);
  } catch (error) {
    console.error('Error during login:', error);
    return res.status(500).send('Authentication failed.');
  }
});

router.get('/callback', async (req, res) => {
  const { state, code } = req.query;
  const codeVerifier = oauthState[state];

  if (!code || !codeVerifier || !state || state !== req.query.state) {
    return res.status(400).send('Invalid state or code.');
  }

  try {
    const { client, accessToken, refreshToken } = await twitterClient.loginWithOAuth2({
      code,
      codeVerifier,
      redirectUri: CALLBACK_URI,
    });
    const { data: user } = await client.v2.me();
    const salt = await bcrypt.genSalt(10);
    const hashedRefreshToken = await bcrypt.hash(refreshToken, salt);
    let existingUser = await User.findOne({ xId: user.id });

    if (existingUser) {
      existingUser.accessToken = accessToken;
      existingUser.hashedRefreshToken = hashedRefreshToken;
      existingUser.tokenExpiry = new Date(Date.now() + 7200 * 1000);
      await existingUser.save();
    } else {
      const newUser = new User({
        xId: user.id,
        username: user.username,
        name: user.name,
        accessToken,
        hashedRefreshToken,
        tokenExpiry: new Date(Date.now() + 7200 * 1000),
      });
      existingUser = await newUser.save();
      const UserPreference = require('../models/user_preference.model');
      await UserPreference.create({
        user: existingUser._id,
        preferred_post_times: [],
      });
    }

    const token = generateToken(existingUser._id);
    const frontendCallbackUrl = `http://localhost:5173/dashboard?token=${token}&user=${JSON.stringify({ xId: existingUser.xId, username: existingUser.username, name: existingUser.name })}`;
    return res.redirect(frontendCallbackUrl);
  } catch (error) {
    console.error('Error during callback:', error);
    res.status(500).send('Authentication failed.');
  } finally {
    delete oauthState[state];
  }
});


// --- Content Generation and Automation Route ---

/**
 * @route POST /api/posts/autocreate
 * @desc Automates the content creation and scheduling process for a new user.
 * @access Protected
 */
router.post('/autocreate', protect, async (req, res) => {
  const { keyword, geo } = req.body;
  const user = req.user;

  if (!keyword || !geo) {
    return res.status(400).send('Keyword and geographic location are required.');
  }

  try {
    // 1. Get detailed trends analysis for the provided keyword
    const trendsAnalysis = await trendsService.analyzeKeywords([keyword], geo);
    if (!trendsAnalysis || trendsAnalysis.length === 0) {
      return res.status(404).send('No relevant trends or queries found for the given keyword.');
    }

    // 2. Extract rising and top queries to provide more context to the AI
    const firstAnalysis = trendsAnalysis[0];
    const risingQueries = firstAnalysis.rising_queries?.map(q => q.query) || [];
    const topQueries = firstAnalysis.top_queries?.map(q => q.query) || [];

    // 3. Create a detailed prompt for the AI using the extracted data
    const promptContent = `The main keyword is "${keyword}". Rising queries include: ${risingQueries.join(', ')}. Top related queries are: ${topQueries.join(', ')}.`;

    const preferences = await UserPreference.findOne({ user: user._id });
    if (!preferences || !preferences.preferred_post_times || preferences.preferred_post_times.length === 0) {
      return res.status(404).send('User has not set a preferred posting time.');
    }
    const preferredTime = preferences.preferred_post_times[0];

    const generatedContent = await generateTweetFromTrend(promptContent);

    const now = new Date();
    const [hour, minute] = preferredTime.split(':').map(Number);
    let scheduledDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0);

    if (scheduledDate < now) {
      scheduledDate.setDate(scheduledDate.getDate() + 1);
    }

    const newPost = new Post({
      user: user._id,
      text: generatedContent,
      scheduledDate,
      status: 'pending'
    });

    await newPost.save();

    return res.status(201).json({
      message: 'Post created and scheduled successfully.',
      post: newPost,
    });
  } catch (error) {
    console.error('Error during automated content creation:', error);
    return res.status(500).send('Failed to automate content creation. Please try again.');
  }
});


// Helper function to generate a tweet draft using the OpenRouter API
const generateTweetFromTrend = async (promptContent) => {
  try {
    const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
      "model": "deepseek/deepseek-r1-0528:free",
      "messages": [
        {
          "role": "system",
          "content": "You are a content creation bot. Your only task is to draft a single, engaging tweet based on a given topic. The tweet must be under 280 characters and include a relevant hashtag. You must return ONLY the tweet content and nothing else. No conversational text, no intro, no outro.",
        },
        {
          "role": "user",
          "content": `Draft a tweet about the topic: "${promptContent}".`,
        },
      ],
    }, {
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      }
    });

    const result = response.data;

    if (result && result.choices && result.choices.length > 0 && result.choices[0].message) {
      const generatedText = result.choices[0].message.content;
      return generatedText.trim();
    } else {
      console.error('OpenRouter API response:', JSON.stringify(result, null, 2));
      throw new Error('OpenRouter API returned an unexpected response or no content.');
    }
  } catch (error) {
    console.error('OpenRouter API call failed:', error);
    throw new Error('Failed to generate content from OpenRouter. Please check your API key and billing details.');
  }
};


// --- Post Routes (for scheduling) ---
router.post('/', protect, async (req, res) => {
  const { text, scheduledDate } = req.body;
  const user = req.user;

  try {
    const newPost = new Post({
      user: user._id,
      text,
      scheduledDate,
      status: 'pending'
    });
    await newPost.save();
    return res.status(201).json({ message: 'Post scheduled successfully.', post: newPost });
  } catch (error) {
    console.error('Error scheduling post:', error);
    return res.status(500).send('Failed to schedule post.');
  }
});

router.get('/', protect, async (req, res) => {
  const user = req.user;
  try {
    const posts = await Post.find({ user: user._id }).sort({ scheduledDate: 1 });
    return res.status(200).json(posts);
  } catch (error) {
    console.error('Error fetching posts:', error);
    return res.status(500).send('Failed to fetch posts.');
  }
});


module.exports = router;