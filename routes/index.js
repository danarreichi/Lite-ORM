const express = require('express');
const router = express.Router();
const homeController = require('../controllers/homeController');

// Home page route
router.get('/', (req, res) => {
  homeController.getHomePage(req, res);
});

// Query Builder test route
router.get('/testing_query_builder', async (req, res) => {
  await homeController.testQueryBuilder(req, res);
});

module.exports = router;