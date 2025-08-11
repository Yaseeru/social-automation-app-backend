const express = require('express');
const router = express.Router();
const User = require('../models/user.model');
const UserPreference = require('../models/user_preference.model');
const { TwitterApi } = require('twitter-api-v2');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const { CLIENT_ID, CLIENT_SECRET, CALLBACK_URI, JWT_SECRET } = process.env;

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
      existingUser.hashedRefreshToken = hashedRefreshToken; // Now saving the hashed refresh token for existing users
      existingUser.tokenExpiry = new Date(Date.now() + 7200 * 1000); // 2 hours
      await existingUser.save();
    } else {
      const newUser = new User({
        xId: user.id,
        username: user.username,
        name: user.name,
        accessToken,
        hashedRefreshToken, // FIX: The refresh token is now saved here for new users
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

module.exports = router;
