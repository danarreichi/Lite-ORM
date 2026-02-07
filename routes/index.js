const express = require('express');
const router = express.Router();
const homeController = require('../controllers/homeController');

// Global variable to store current response object for debugging
global._currentResponse = null;

// Middleware to catch debug exceptions and provide response object
const debugMiddleware = (req, res, next) => {
  // Store current response object globally for dc() auto-detection
  global._currentResponse = res;

  // Override res.send to catch our debug exception
  const originalSend = res.send;
  res.send = function(data) {
    // If this is called after dc(), don't send again
    if (res.headersSent) {
      return res;
    }
    return originalSend.call(this, data);
  };

  // Clean up after request
  res.on('finish', () => {
    global._currentResponse = null;
  });

  next();
};

// Apply debug middleware to all routes
router.use(debugMiddleware);

// Home page route
router.get('/', (req, res) => {
  homeController.getHomePage(req, res);
});

// Query Builder test route
router.get('/testing_query_builder', async (req, res) => {
  await homeController.testQueryBuilder(req, res);
});

module.exports = router;