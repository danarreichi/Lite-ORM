const express = require('express');
const router = express.Router();
const homeController = require('../controllers/homeController');

// Middleware to catch debug exceptions
const debugMiddleware = (req, res, next) => {
  // Override res.send to catch our debug exception
  const originalSend = res.send;
  res.send = function(data) {
    // If this is called after dc(), don't send again
    if (res.headersSent) {
      return res;
    }
    return originalSend.call(this, data);
  };
  next();
};

// Apply debug middleware to all routes
router.use(debugMiddleware);

// Home page route
router.get('/', (req, res) => {
  try {
    homeController.getHomePage(req, res);
  } catch (error) {
    if (error.message === 'DEBUG_CONTINUE_EXCEPTION') {
      // Debug output already sent, do nothing
      return;
    }
    throw error; // Re-throw other errors
  }
});

// Query Builder test route
router.get('/testing_query_builder', async (req, res) => {
    await homeController.testQueryBuilder(req, res);
});

module.exports = router;