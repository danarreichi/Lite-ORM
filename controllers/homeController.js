const { dd, dc, dump, log } = require('../utils/debug');
const db = require('../utils/database');
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
      const qb = await query('users')
        .whereExistsRelation('transactions', 'user_id', 'id', function(q) {
            q.whereExistsRelation('transaction_details', 'transaction_id', 'id', function(q){
              q.where('item_name', 'USB-C Cable');
            })
        })
        .orWhereExistsRelation('transactions', 'user_id', 'id', function(q) {
            q.whereExistsRelation('transaction_details', 'transaction_id', 'id', function(q){
              q.where('item_name', 'Wireless Headphones');
            })
        })
        .withMany('transactions', 'user_id', 'id', function(q) {
          q.withMany('transaction_details', 'transaction_id', 'id', function(q) {
            q.withOne('products', 'id', 'product_id');
          });
        })
        .group(function(q){
            q.where('username', 'jane_smith');
            q.orLike('username', 'john');
            q.orLike('username', 'wilson');
        })
        .get();
    dd(qb);
  }
};

module.exports = homeController;