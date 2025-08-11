const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

// Load JWT secret from environment variables
const { JWT_SECRET } = process.env;

/**
 * @desc Protects routes by verifying a JWT from the Authorization header.
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next middleware function
 */
const protect = async (req, res, next) => {
  let token;

  // Check if the Authorization header is present and starts with 'Bearer'
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get the token from the header
      token = req.headers.authorization.split(' ')[1];

      // Verify the token
      const decoded = jwt.verify(token, JWT_SECRET);

      // Find the user by ID from the token payload
      const user = await User.findById(decoded.id).select('-hashedRefreshToken');

      if (!user) {
        return res.status(401).send('Not authorized, no user found');
      }
      // Attach the user to the request object
      req.user = user;
      next();
    } catch (error) {
      console.error('JWT verification error:', error);
      return res.status(401).send('Not authorized, token failed');
    }
  }

  // If no token is provided
  if (!token) {
    return res.status(401).send('Not authorized, no token');
  }
};

module.exports = { protect };
