const { dd, dump, log } = require('../utils/debug');
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
    // =============================================
    // COMPOSITE KEYS EXAMPLES
    // =============================================
    
    // Example 1: Load users with their reviews (using composite keys)
    // Reviews table has both user_id and product_id foreign keys
    const example1 = await query('users')
      .select(['username', 'email'])
      .withMany({'reviews': 'userReviews'}, 'user_id', 'id', function(q) {
        q.select(['title', 'content']);
        q.withOne('products', 'id', 'product_id', function(q) {
          q.select('name');
        }); // Nested relation
      })
      .get();
    
    // Example 2: Load products with their reviews and the reviewer info
    // Shows composite relationship: each review belongs to both a user AND a product
    const example2 = await query('products')
      .select(['id', 'name', 'price'])
      .withMany('reviews', 'product_id', 'id', function(q) {
        q.withOne('users', 'id', 'user_id'); // Get the user who wrote the review
      })
      .withAvg('reviews', 'product_id', 'id', 'rating') // Average rating
      .where('reviews_rating_avg', '>=', 4.0)
      .limit(3)
      .get();
    
    // Example 3: REAL Composite Key Example
    // user_product_favorites has composite PRIMARY KEY (user_id, product_id)
    // This demonstrates loading relations where the related table uses composite keys
    const example3 = await query('users')
      .select(['id', 'username', 'email'])
      .withMany(
        {'user_product_favorites': 'favorites'}, 
        'user_id',  // Foreign key in favorites table
        'id'        // Local key in users table
      )
      .get();
    
    // Example 3b: Get products with their favorited-by users
    const example3b = await query('products')
      .select(['id', 'name', 'price'])
      .withMany('user_product_favorites', 'product_id', 'id', function(q) {
        q.withOne('users', 'id', 'user_id'); // Get the user who favorited
      })
      .get();
    
    // =============================================
    // MULTIPLE FOREIGN KEYS EXAMPLES (Array Syntax)
    // =============================================
    
    // Example 4: Orders with Items (MULTIPLE FOREIGN KEY MATCHING)
    // order_items table requires matching on BOTH order_id AND store_id
    // This is common in sharded databases or multi-tenant systems
    const example4 = await query('orders')
      .select(['id', 'order_number', 'store_id', 'total_amount'])
      .withMany(
        'order_items',
        ['order_id', 'store_id'],    // Multiple foreign keys in order_items
        ['id', 'store_id']            // Multiple local keys in orders
      )
      .get();
    
    // Example 4b: Orders with Items AND Product Details (nested with composite keys)
    const example4b = await query('orders')
      .select(['orders.id', 'orders.order_number', 'stores.name as store_name', 'orders.total_amount'])
      .join('stores', 'orders.store_id = stores.id')
      .withMany(
        {'order_items': 'items'},
        ['order_id', 'store_id'],    // Multiple foreign keys
        ['id', 'store_id'],           // Multiple local keys
        function(q) {
          q.withOne('products', 'id', 'product_id'); // Get product details for each item
        }
      )
      .withOne('users', 'id', 'user_id')
      .where('orders.status', 'delivered')
      .get();
    
    // Example 4c: Stores with their Orders and Order Items
    const example4c = await query('stores')
      .select(['id', 'name', 'location'])
      .withMany('orders', 'store_id', 'id', function(q) {
        q.withMany(
          'order_items',
          ['order_id', 'store_id'],
          ['id', 'store_id'],
          function(itemQ) {
            itemQ.withOne('products', 'id', 'product_id');
          }
        );
        q.withOne('users', 'id', 'user_id');
      })
      .get();
    
    // =============================================
    // AGGREGATE FUNCTIONS WITH MULTIPLE FOREIGN KEYS
    // =============================================
    
    // Example 8: Orders with aggregate on order_items (composite FK)
    // Count items and sum totals matching on BOTH order_id AND store_id
    const example8 = await query('orders')
      .select(['id', 'order_number', 'store_id', 'total_amount'])
      .withMany(
        {'order_items': 'items'},
        ['order_id', 'store_id'],    // Multiple foreign keys
        ['id', 'store_id'],           // Multiple local keys
        function(q) {
          q.withOne('products', 'id', 'product_id'); // Get product details for each item
        }
      )
      .withCount(
        {'order_items': 'total_items'},
        ['order_id', 'store_id'],    // Multiple foreign keys
        ['id', 'store_id']            // Multiple local keys
      )
      .withSum(
        {'order_items': 'items_sum'},
        ['order_id', 'store_id'],
        ['id', 'store_id'],
        'total_price'
      )
      .withAvg(
        'order_items',
        ['order_id', 'store_id'],
        ['id', 'store_id'],
        'unit_price'
      )
      .where('status', 'delivered')
      .get();
    
    // Example 9: Filter orders by aggregate values (composite FK)
    // Find orders with more than 2 items
    const example9 = await query('orders')
      .select(['id', 'order_number', 'total_amount'])
      .withCount(
        {'order_items': 'item_count'},
        ['order_id', 'store_id'],
        ['id', 'store_id']
      )
      .where('item_count', '>=', 2)    // Auto-detects aggregate alias!
      .get();
    
    // Example 10: Multiple aggregates with composite keys and filtering
    const example10 = await query('orders')
      .select(['orders.id', 'orders.order_number', 'stores.name as store_name'])
      .join('stores', 'orders.store_id = stores.id')
      .withCount(
        {'order_items': 'total_items'},
        ['order_id', 'store_id'],
        ['id', 'store_id']
      )
      .withSum(
        {'order_items': 'total_value'},
        ['order_id', 'store_id'],
        ['id', 'store_id'],
        'total_price',
        function(q) {
          q.where('quantity', '>', 1);  // Only items with quantity > 1
        }
      )
      .where('total_items', '>=', 2)
      .where('total_value', '>', 100)
      .get();
    
    // Example 5: Complex query with transaction_details
    // Shows relationship between transactions and products through transaction_details
    const example5 = await query('transactions')
      .select(['id', 'transaction_number', 'total_amount', 'status'])
      .withMany('transaction_details', 'transaction_id', 'id', function(q) {
        q.withOne('products', 'id', 'product_id', function(pq) {
          pq.withOne('categories', 'id', 'category_id');
        });
      })
      .withOne('users', 'id', 'user_id')
      .where('status', 'completed')
      .orderBy('transaction_date', 'DESC')
      .limit(2)
      .get();
    
    // Example 6: Find users who reviewed specific products with composite filtering
    const example6 = await query('users')
      .whereExistsRelation('reviews', 'user_id', 'id', function(q) {
        q.where('product_id', 1); // Wireless Headphones
        q.where('rating', '>=', 4);
      })
      .withMany('reviews', 'user_id', 'id')
      .get();
    
    // Example 7: Get all reviews with full user and product details
    const example7 = await query('reviews')
      .withOne({'users': 'reviewer'}, 'id', 'user_id')
      .withOne({'products': 'reviewedProduct'}, 'id', 'product_id', function(q) {
        q.withOne('categories', 'id', 'category_id');
      })
      .where('rating', '>=', 4)
      .orderBy('created_at', 'DESC')
      .limit(3)
      .get();
    
    // Return all examples
    dd(res, {
      '--- COMPOSITE PRIMARY KEY ---': null,
      'Example 1 - Users with Reviews': example1,
      'Example 2 - Products with Reviews (Avg Rating >= 4)': example2,
      'Example 3 - Users with Favorites (COMPOSITE KEY table)': example3,
      'Example 3b - Products with Favorited By Users': example3b,
      '--- MULTIPLE FOREIGN KEYS (Array Syntax) ---': null,
      'Example 4 - Orders with Items (2 FK: order_id + store_id)': example4,
      'Example 4b - Orders with Items + Products (nested composite)': example4b,
      'Example 4c - Stores with Orders and Items (nested)': example4c,
      '--- AGGREGATES WITH MULTIPLE FOREIGN KEYS ---': null,
      'Example 8 - Orders with Aggregates (composite FK)': example8,
      'Example 9 - Filter by Aggregate (item_count >= 2)': example9,
      'Example 10 - Multiple Aggregates + Filtering': example10,
      '--- OTHER EXAMPLES ---': null,
      'Example 5 - Transactions with Details & Products': example5,
      'Example 6 - Users who reviewed Product 1 (rating >= 4)': example6,
      'Example 7 - All Reviews with User & Product Details': example7
    });
  }
};

module.exports = homeController;