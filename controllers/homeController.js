const { dd, dc, dump, log } = require('../utils/debug');
const db = require('../utils/database');
const User = require('../models/User');
const { query } = require('../utils/queryBuilder');

const homeController = {
  getHomePage: (req, res) => {
    const data = {
      title: 'Node.js Express App',
      message: 'Welcome to your Express application with EJS templates!',
      features: [
        'Express.js web framework',
        'EJS templating engine',
        'Dynamic content rendering',
        'Clean MVC structure',
        'Easy to extend with routes and middleware'
      ]
    };

    res.render('index', data);
  },

  // Query Builder Examples (similar to CI3 Active Record)
  testQueryBuilder: async (req, res) => {
      const users = await query('users').get();
      dc(res, users);
  }
};

module.exports = homeController;