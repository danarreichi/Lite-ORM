# Copilot Instructions for node_new_prj

## Project Overview
A Node.js HTTP server project with Express and EJS dependencies installed. Currently uses native Node.js `http` module for a minimal server. Structured as a starter template for building web applications.

## Essential Commands
- `npm start` - Runs `node index.js` to start the HTTP server on port 3000
- `npm run dev` - Runs with nodemon for automatic restarts on code changes
- `npm run seed` - Runs the database seeder to create tables and sample data
- `npm test` - Runs `node tests/runAll.js` to execute the QueryBuilder test suites
- Port 3000 is the default; modify in code if conflicts occur

## Architecture & Structure
- **index.js**: Main entry point configuring Express app and mounting routes
- **routes/**: Route definitions organized by feature
  - `routes/index.js`: Home page routes
- **controllers/**: Business logic separated from routing
  - `controllers/homeController.js`: Home page controller logic
- **models/**: Database models and queries
  - `models/User.js`: User model with database operations
- **views/**: Directory containing EJS templates
  - `views/index.ejs`: Main page template with dynamic content rendering
- **utils/**: Utility functions and helpers
  - `utils/debug.js`: Debug utilities including dd() function (similar to Laravel's dd())
  - `utils/database.js`: Database connection and query utilities
  - `utils/queryBuilder.js`: Query builder for fluent SQL construction (CI3 style)
- **seeder.js**: Database seeder for MySQL with sample data
- **Dependencies**:
  - `express` (5.2.1): Web framework for routing and middleware
  - `ejs` (4.0.1): Template engine for server-side rendering
  - `mysql2` (^3.x.x): MySQL database driver

## Key Patterns When Expanding

### Adding Express Routes
Create route files in `routes/` directory following the pattern in [routes/index.js](routes/index.js):
```javascript
const express = require('express');
const router = express.Router();
const controllerName = require('../controllers/controllerName');

// Routes
router.get('/', controllerName.methodName);

module.exports = router;
```

### Adding Controllers
Create controller files in `controllers/` directory with methods for handling requests:
```javascript
const controllerName = {
  methodName: (req, res) => {
    // Handle request logic
    res.render('template-name', data);
  }
};

module.exports = controllerName;
```

### Mounting Routes in Main App
Add new route modules to [index.js](index.js):
```javascript
const newRouter = require('./routes/newRoute');
app.use('/new-path', newRouter);
```

### EJS Templates
- Templates in `views/` directory with `.ejs` extension
- Pass data objects to templates for dynamic rendering
- Use `<%= %>` for output and `<% %>` for logic (see [views/index.ejs](views/index.ejs) for examples)

## Database Schema

The application uses MySQL with the following tables:

### Core Tables
- **users**: User accounts with profile information
- **categories**: Product categories
- **products**: Product catalog with pricing and inventory
- **payment_methods**: User's saved payment methods (credit cards, PayPal, etc.)
- **transactions**: Main transaction records with totals and status
- **transaction_details**: Individual items within transactions
- **payment_histories**: Payment processing history and gateway responses
- **reviews**: Product reviews by users (2 foreign keys: user_id, product_id)
- **user_product_favorites**: User's favorite products (COMPOSITE PRIMARY KEY: user_id, product_id)
- **stores**: Store locations
- **orders**: Customer orders (sharded by store_id)
- **order_items**: Items in orders (MULTIPLE FOREIGN KEYS: order_id, store_id)

### Relationships
- `users` → `payment_methods` (1:many)
- `users` → `transactions` (1:many)
- `users` → `reviews` (1:many)
- `users` → `orders` (1:many)
- `users` ↔ `products` → `user_product_favorites` (many:many with composite key)
- `payment_methods` → `transactions` (1:many)
- `transactions` → `transaction_details` (1:many)
- `transactions` → `payment_histories` (1:many)
- `products` → `transaction_details` (1:many)
- `products` → `reviews` (1:many)
- `categories` → `products` (1:many)
- `stores` → `orders` (1:many)
- `orders` → `order_items` (1:many with MULTIPLE column matching: order_id + store_id)

### Composite Key Example
The `user_product_favorites` table demonstrates composite primary keys:
- Primary Key: `(user_id, product_id)` - no separate id column
- Represents many-to-many relationship between users and products
- Used to track which products each user has favorited

### Multiple Foreign Keys Example
The `order_items` table demonstrates multiple foreign key matching:
- Matches on BOTH `order_id` AND `store_id` to parent `orders` table
- Use case: Database sharding where data is partitioned by store_id
- Query syntax: `.withMany('order_items', ['order_id', 'store_id'], ['id', 'store_id'])`
- Common in multi-tenant systems or sharded databases

### Sample Data
Run `npm run seed` to populate the database with sample users, transactions, and payment data.

## Development Workflow

### Automatic Server Restarts
Use `npm run dev` during development to automatically restart the server when code changes:

```bash
npm run dev
```

This uses nodemon to watch:
- `index.js`
- `routes/` directory
- `controllers/` directory  
- `utils/` directory
- `views/` directory

Nodemon configuration in `nodemon.json`:
- Ignores `node_modules/`, logs, and git files
- Watches `.js`, `.json`, and `.ejs` files
- 500ms delay to prevent excessive restarts
- Sets `NODE_ENV=development`

## Database Querying Patterns

### Database Connection
Use the database utility in `utils/database.js`:
```javascript
const db = require('../utils/database');

// Test connection
await db.testConnection();

// Basic query
const { rows } = await db.query('SELECT * FROM users WHERE id = ?', [userId]);

// Get single row
const user = await db.queryOne('SELECT * FROM users WHERE id = ?', [userId]);

// Get single value
const count = await db.queryValue('SELECT COUNT(*) FROM users');

// Insert and get ID
const insertId = await db.insert('INSERT INTO users SET ?', userData);

// Update and get affected rows
const affectedRows = await db.update('UPDATE users SET name = ? WHERE id = ?', [name, id]);

// Delete
const deletedRows = await db.deleteQuery('DELETE FROM users WHERE id = ?', [id]);
```

### Model Pattern
Create models in `models/` directory following the pattern in `models/User.js`:
```javascript
const db = require('../utils/database');

class User {
  static async findAll() {
    const sql = 'SELECT * FROM users ORDER BY created_at DESC';
    const result = await db.query(sql);
    return result.rows;
  }

  static async findById(id) {
    const sql = 'SELECT * FROM users WHERE id = ?';
    return await db.queryOne(sql, [id]);
  }

  static async create(userData) {
    const sql = 'INSERT INTO users SET ?';
    return await db.insert(sql, userData);
  }
}

module.exports = User;
```

### Controller Usage
Use models in controllers with proper error handling:
```javascript
const User = require('../models/User');

exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
};
```

### Query Builder Pattern (CI3 Style)
Use the query builder in `utils/queryBuilder.js` for fluent SQL query construction (similar to CodeIgniter 3 Active Record):

```javascript
const { query } = require('../utils/queryBuilder');

// Basic SELECT with WHERE
const user = await query('users')
  .select(['id', 'name', 'email'])
  .where('id', 1)
  .first();

// Multiple conditions
const activeUsers = await query('users')
  .where('status', 'active')
  .where('created_at', '>', '2024-01-01')
  .get();

// Grouped conditions
const complexUsers = await query('users')
  .group(function(q) {
    q.where('name', 'John')
     .orWhere('email', 'john@example.com');
  })
  .where('status', 'active')
  .get();

// OR groups
const orGroupUsers = await query('users')
  .orGroup(function(q) {
    q.where('status', 'active')
     .where('role', 'admin');
  })
  .orGroup(function(q) {
    q.where('status', 'pending')
     .where('created_at', '>', '2024-01-01');
  })
  .get();

// Nested groups (group inside group)
const nestedGroupUsers = await query('users')
  .group(function(outer) {
    outer.where('first_name', 'John')
      .orGroup(function(inner) {
        inner.where('last_name', 'Doe')
             .where('id', '>', 0);
      });
  })
  .where('email', 'LIKE', '%@example.com%')
  .get();

// LIKE queries
const searchResults = await query('users')
  .like('name', 'John')
  .get();

// Search multiple columns
const multiColumnSearch = await query('users')
  .search(['name', 'email', 'username'], 'john')
  .get();

// Search multiple columns with OR logic
const multiColumnOrSearch = await query('users')
  .orSearch(['name', 'email', 'username'], 'john')
  .get();

// JOINs
const usersWithPayments = await query('users')
  .select(['users.name', 'payment_methods.card_type'])
  .join('payment_methods', 'users.id = payment_methods.user_id')
  .get();

// GROUP BY and aggregate functions
const stats = await query('users')
  .select(['status', 'COUNT(*) as count'])
  .groupBy('status')
  .get();

// INSERT
const newUser = { name: 'John', email: 'john@example.com' };
const insertId = await query('users').insert(newUser).execute();

// UPDATE
await query('users')
  .update({ status: 'inactive' })
  .where('id', 1)
  .execute();

// DELETE
await query('users')
  .delete()
  .where('id', 1)
  .execute();

// Advanced features
const complex = await query('transactions')
  .select(['transactions.*', 'users.name'])
  .join('users', 'transactions.user_id = users.id')
  .whereIn('status', ['pending', 'completed'])
  .orderBy('created_at', 'DESC')
  .limit(10)
  .offset(20)
  .get();

// Eager Loading with withMany() - Load related records
// Shorthand syntax (table name = property name)
const usersWithTransactions = await query('users')
  .withMany('transactions', 'user_id', 'id')
  .get();
// Each user will have a 'transactions' array with their transaction objects

// Eager loading with conditions and custom property name
const usersWithCompletedTransactions = await query('users')
  .withMany({'transactions': 'completedTransactions'}, 'user_id', 'id', function(q) {
    q.where('status', 'completed')
     .orderBy('created_at', 'DESC');
  })
  .where('users.status', 'active')
  .get();

// Multiple relationships
const usersWithMultipleRelations = await query('users')
  .withMany('transactions', 'user_id', 'id')
  .withMany({'payment_methods': 'paymentMethods'}, 'user_id', 'id')
  .withMany('reviews', 'user_id', 'id')
  .get();

// Nested relationships (loading relations within relations)
const usersWithNestedRelations = await query('users')
  .withMany('transactions', 'user_id', 'id', function(q) {
    q.withMany('transaction_details', 'transaction_id', 'id');
  })
  .get();
// users[0].transactions[0].transaction_details = [{...}, {...}]

// Eager Loading with withOne() - Load single related record (one-to-one or belongs-to)
// Shorthand syntax
const transactionsWithUser = await query('transactions')
  .withOne('users', 'id', 'user_id')
  .get();
// Each transaction will have a 'users' object (not array)

// Custom property name
const transactionsWithBuyer = await query('transactions')
  .withOne({'users': 'buyer'}, 'id', 'user_id')
  .get();
// transactions[0].buyer = {...}

// Mixing withOne() and withMany()
const usersComplete = await query('users')
  .withOne('profiles', 'user_id', 'id')
  .withMany('transactions', 'user_id', 'id')
  .get();
// users[0].profiles = {...} (single object)
// users[0].transactions = [{...}, {...}] (array)

// Aggregate Functions - Add calculated columns without loading full related records
// withSum - Sum of related column (auto alias: table_column_sum)
const usersWithAutoSum = await query('users')
  .withSum('transactions', 'user_id', 'id', 'amount')
  .get();
// users[0].transactions_amount_sum = 15000

// withSum - Custom alias using object syntax
const usersWithCustomSum = await query('users')
  .withSum({'transactions': 'total_spent'}, 'user_id', 'id', 'amount', function(q) {
    q.where('status', 'completed');
  })
  .get();
// users[0].total_spent = 15000

// withCount - Count related records (auto alias: table_count)
const usersWithCount = await query('users')
  .withCount('transactions', 'user_id', 'id')
  .get();
// users[0].transactions_count = 5

// withAvg, withMax, withMin - Similar patterns
const usersWithStats = await query('users')
  .withAvg('transactions', 'user_id', 'id', 'amount')      // users[0].transactions_amount_avg
  .withMax('transactions', 'user_id', 'id', 'amount')      // users[0].transactions_amount_max
  .withMin('transactions', 'user_id', 'id', 'amount')      // users[0].transactions_amount_min
  .get();

// withCustom - Custom aggregate formula (trusted SQL expression)
const usersWithCustomFormula = await query('users')
  .withCustom(
    {'transactions': 'avg_ticket'},
    'user_id',
    'id',
    'SUM(total_amount) / COUNT(total_amount)'
  )
  .where('avg_ticket', '>', 100)
  .get();

// JOIN-based aggregates (better for larger datasets)
// joinSum, joinCount, joinAvg, joinMax, joinMin use derived-table LEFT JOIN strategy
const usersWithJoinAgg = await query('users')
  .joinSum({'transactions': 'total_spent'}, 'user_id', 'id', 'amount', function(q) {
    q.where('status', 'completed');
  })
  .joinCount({'transactions': 'total_count'}, 'user_id', 'id')
  .where('total_spent', '>', 10000)   // aggregate alias auto-detected
  .get();

// joinCustom - JOIN-based custom aggregate formula
const usersWithJoinCustom = await query('users')
  .joinCustom(
    {'transactions': 'avg_ticket_join'},
    'user_id',
    'id',
    'SUM(total_amount) / COUNT(total_amount)'
  )
  .where('avg_ticket_join', '>', 100)
  .get();

// Multiple aggregates with conditions
const userStats = await query('users')
  .withCount({'transactions': 'total_transactions'}, 'user_id', 'id')
  .withSum({'transactions': 'total_spent'}, 'user_id', 'id', 'amount', function(q) {
    q.where('status', 'completed');
  })
  .withAvg({'reviews': 'avg_rating'}, 'user_id', 'id', 'rating')
  .where('users.status', 'active')
  .get();
// userStats[0] = { id: 1, name: 'John', total_transactions: 10, total_spent: 15000, avg_rating: 4.5 }

// Aggregates with Composite Keys (Multiple Foreign Keys)
const ordersWithAggregates = await query('orders')
  .withCount(
    {'order_items': 'total_items'},
    ['order_id', 'store_id'],    // Multiple foreign keys
    ['id', 'store_id']            // Multiple local keys
  )
  .withSum(
    {'order_items': 'total_value'},
    ['order_id', 'store_id'],
    ['id', 'store_id'],
    'total_price'
  )
  .get();
// ordersWithAggregates[0] = { id: 1, order_number: 'ORD-001', total_items: 3, total_value: 299.99 }

// Filter by Aggregate Values - where() auto-detects aggregate aliases
// Just use normal where() - it automatically generates subquery if column matches aggregate alias!
const highSpenders = await query('users')
  .withSum({'transactions': 'total_spent'}, 'user_id', 'id', 'amount')
  .where('total_spent', '>', 10000)
  .get();
// WHERE (SELECT SUM(amount) FROM transactions WHERE transactions.user_id = users.id) > 10000

const activeUsers = await query('users')
  .withCount('transactions', 'user_id', 'id')
  .where('transactions_count', '>=', 5)
  .get();
// WHERE (SELECT COUNT(*) FROM transactions WHERE transactions.user_id = users.id) >= 5

// Combine multiple aggregate filters - all auto-detected!
const vipUsers = await query('users')
  .withSum({'transactions': 'total_spent'}, 'user_id', 'id', 'amount', function(q) {
    q.where('status', 'completed');
    q.where('created_at', '>', '2025-01-01');
  })
  .withCount({'transactions': 'total_count'}, 'user_id', 'id')
  .where('total_spent', '>', 50000)     // Auto-detected as aggregate
  .where('total_count', '>=', 10)       // Auto-detected as aggregate
  .get();
// Filter VIP users with >50k in completed transactions since 2025 AND at least 10 transactions

// Mix with normal WHERE conditions
const premiumActiveUsers = await query('users')
  .withAvg({'transactions': 'avg_amount'}, 'user_id', 'id', 'amount')
  .where('status', 'active')            // Normal column
  .where('avg_amount', '>', 500)        // Auto-detected as aggregate
  .orWhere('role', 'vip')               // Normal column
  .get();

// Relationship Existence Filtering - whereHas() & whereDoesntHave() (Laravel-style)
// Filter records based on the existence of related records

// whereHas - Users who have completed transactions
const usersWithCompletedTransactions = await query('users')
  .whereHas('transactions', 'user_id', 'id', function(q) {
    q.where('status', 'completed');
    q.where('amount', '>', 1000);
  })
  .get();
// WHERE EXISTS (SELECT 1 FROM transactions WHERE transactions.user_id = users.id AND status = 'completed' AND amount > 1000)

// whereDoesntHave - Users who have no transactions
const usersWithoutTransactions = await query('users')
  .whereDoesntHave('transactions', 'user_id', 'id')
  .get();
// WHERE NOT EXISTS (SELECT 1 FROM transactions WHERE transactions.user_id = users.id)

// orWhereHas - Active users OR users with transactions
const activeOrHasTransactions = await query('users')
  .where('status', 'active')
  .orWhereHas('transactions', 'user_id', 'id')
  .get();
// WHERE status = 'active' OR EXISTS (SELECT 1 FROM transactions WHERE transactions.user_id = users.id)

// orWhereDoesntHave - Inactive users OR users without bans
const inactiveOrNoBans = await query('users')
  .where('status', 'inactive')
  .orWhereDoesntHave('banned_users', 'user_id', 'id')
  .get();
// WHERE status = 'inactive' OR NOT EXISTS (SELECT 1 FROM banned_users WHERE banned_users.user_id = users.id)

// has() - Simple existence check (shorthand without callback)
const usersWithAnyTransactions = await query('users')
  .has('transactions', 'user_id', 'id')
  .get();
// WHERE EXISTS (SELECT 1 FROM transactions WHERE transactions.user_id = users.id)

// has() with count - Users with at least 5 transactions
const activeUsersWithMultipleTransactions = await query('users')
  .where('status', 'active')
  .has('transactions', 'user_id', 'id', '>=', 5)
  .get();

// has() with exact count - Users with exactly 3 reviews
const usersWithExactReviews = await query('users')
  .has('reviews', 'user_id', 'id', '=', 3)
  .get();

// has() with callback - Users with at least 5 completed transactions
const usersWithCompletedTransactions = await query('users')
  .has('transactions', 'user_id', 'id', '>=', 5, function(q) {
    q.where('status', 'completed');
    q.where('amount', '>', 1000);
  })
  .get();
// Counts only completed transactions over $1000

// doesntHave() - Simple non-existence check (shorthand)
const usersWithoutReviews = await query('users')
  .doesntHave('reviews', 'user_id', 'id')
  .get();
// WHERE NOT EXISTS (SELECT 1 FROM reviews WHERE reviews.user_id = users.id)

// Complex combinations
const complexQuery = await query('users')
  .where('status', 'active')
  .whereHas('transactions', 'user_id', 'id', function(q) {
    q.where('status', 'completed');
    q.where('created_at', '>', '2025-01-01');
  })
  .whereDoesntHave('banned_users', 'user_id', 'id')
  .has('reviews', 'user_id', 'id', '>=', 2)
  .get();
// Active users with completed transactions since 2025, not banned, and have at least 2 reviews

// Composite Keys with whereHas() - Orders with items (sharded database)
const ordersWithItems = await query('orders')
  .whereHas('order_items', ['order_id', 'store_id'], ['id', 'store_id'], function(q) {
    q.where('quantity', '>', 0);
    q.where('status', 'active');
  })
  .get();
// WHERE EXISTS (SELECT 1 FROM order_items WHERE order_items.order_id = orders.id 
//   AND order_items.store_id = orders.store_id AND quantity > 0 AND status = 'active')

// Composite Keys with whereDoesntHave() - Orders without items
const ordersWithoutItems = await query('orders')
  .whereDoesntHave('order_items', ['order_id', 'store_id'], ['id', 'store_id'])
  .get();
// WHERE NOT EXISTS (SELECT 1 FROM order_items WHERE order_items.order_id = orders.id 
//   AND order_items.store_id = orders.store_id)

// whereExistsRelation() - Lower-level alternative (use whereHas() for better readability)
const usersWithCompletedTransactionsAlt = await query('users')
  .whereExistsRelation('transactions', 'user_id', 'id', function(q) {
    q.where('status', 'completed');
  })
  .get();
// Same as whereHas() - both generate: WHERE EXISTS (SELECT 1 FROM ...)

// Composite Keys - Support for tables with composite primary keys
// user_product_favorites has composite PK (user_id, product_id) - no id column!
const usersWithFavorites = await query('users')
  .withMany('user_product_favorites', 'user_id', 'id')
  .get();
// users[0].user_product_favorites = [{user_id: 1, product_id: 2, ...}, ...]

// Composite keys with multiple columns (arrays)
// For tables where relationships require matching on multiple columns
const ordersWithItems = await query('orders')
  .withMany(
    'order_items',
    ['order_id', 'store_id'],    // Multiple foreign keys
    ['id', 'store_id']            // Multiple local keys
  )
  .get();

// Real example: Orders with Items (store-sharded database)
const example = await query('orders')
  .withMany(
    'order_items',
    ['order_id', 'store_id'],    // order_items must match BOTH columns
    ['id', 'store_id'],           // from orders table
    function(q) {
      q.withOne('products', 'id', 'product_id'); // Nested relation
    }
  )
  .withOne('users', 'id', 'user_id')
  .where('status', 'delivered')
  .get();
// orders[0].order_items = [{order_id: 1, store_id: 1, ...}, ...]

// Chunking large datasets (process in batches to avoid memory issues)
await query('users')
  .where('status', 'active')
  .orderBy('id', 'ASC')
  .chunk(100, async (users, page) => {
    console.log(`Processing page ${page} with ${users.length} users`);
    for (const user of users) {
      await processUser(user);
    }
    // Return false to stop early
    // if (someCondition) return false;
  });

// Chunking by ID (more efficient for very large datasets - uses WHERE id > lastId)
await query('users')
  .where('status', 'active')
  .chunkById(100, async (users, page) => {
    console.log(`Processing page ${page} with ${users.length} users`);
    for (const user of users) {
      await processUser(user);
    }
  });

// Count and single values
const total = await query('users').count();
const email = await query('users').where('id', 1).value('email');
```

Available methods:
- `select(columns)` - Specify columns to select
- `distinct()` - Add DISTINCT to query
- `from(table)` - Specify table (can also pass to query() function)
- `where(column, operator, value)` - Add WHERE condition (auto-detects aggregate aliases)
- `orWhere(column, operator, value)` - Add OR WHERE condition (auto-detects aggregate aliases)
- `whereIn(column, values)` - WHERE IN condition
- `whereNotIn(column, values)` - WHERE NOT IN condition
- `whereExistsRelation(table, foreignKey, localKey, callback)` - WHERE EXISTS subquery with relation (lower-level)
- `orWhereExistsRelation(table, foreignKey, localKey, callback)` - OR WHERE EXISTS subquery (lower-level)
- `whereNotExistsRelation(table, foreignKey, localKey, callback)` - WHERE NOT EXISTS subquery (lower-level)
- `orWhereNotExistsRelation(table, foreignKey, localKey, callback)` - OR WHERE NOT EXISTS subquery (lower-level)
- `whereHas(table, foreignKey, localKey, callback)` - Filter by relationship existence (Laravel-style, recommended)
- `orWhereHas(table, foreignKey, localKey, callback)` - OR filter by relationship existence
- `whereDoesntHave(table, foreignKey, localKey, callback)` - Filter by relationship absence
- `orWhereDoesntHave(table, foreignKey, localKey, callback)` - OR filter by relationship absence
- `has(table, foreignKey, localKey, operator, count, callback)` - Check relationship existence with optional count and filter
- `doesntHave(table, foreignKey, localKey)` - Check relationship absence (shorthand)
- `group(callback)` - Start a grouped condition (AND logic) with callback
- `orGroup(callback)` - Start a grouped condition (OR logic) with callback
- `withMany('table', foreignKey, localKey, callback)` - Eager load has-many (shorthand: table = property name, supports arrays for composite keys)
- `withMany({'table': 'property'}, foreignKey, localKey, callback)` - Eager load has-many (custom property name, supports arrays for composite keys)
- `withOne('table', foreignKey, localKey, callback)` - Eager load has-one (shorthand: table = property name, supports arrays for composite keys)
- `withOne({'table': 'property'}, foreignKey, localKey, callback)` - Eager load has-one (custom property name, supports arrays for composite keys)
- `withSum('table', foreignKey, localKey, column, callback)` - Add SUM aggregate (auto alias: table_column_sum, supports arrays for composite keys)
- `withSum({'table': 'alias'}, foreignKey, localKey, column, callback)` - Add SUM aggregate (custom alias, supports arrays for composite keys)
- `withCount('table', foreignKey, localKey, callback)` - Add COUNT aggregate (auto alias: table_count, supports arrays for composite keys)
- `withCount({'table': 'alias'}, foreignKey, localKey, callback)` - Add COUNT aggregate (custom alias, supports arrays for composite keys)
- `withAvg('table', foreignKey, localKey, column, callback)` - Add AVG aggregate (auto alias: table_column_avg, supports arrays for composite keys)
- `withAvg({'table': 'alias'}, foreignKey, localKey, column, callback)` - Add AVG aggregate (custom alias, supports arrays for composite keys)
- `withMax('table', foreignKey, localKey, column, callback)` - Add MAX aggregate (auto alias: table_column_max, supports arrays for composite keys)
- `withMax({'table': 'alias'}, foreignKey, localKey, column, callback)` - Add MAX aggregate (custom alias, supports arrays for composite keys)
- `withMin('table', foreignKey, localKey, column, callback)` - Add MIN aggregate (auto alias: table_column_min, supports arrays for composite keys)
- `withMin({'table': 'alias'}, foreignKey, localKey, column, callback)` - Add MIN aggregate (custom alias, supports arrays for composite keys)
- `withCustom('table', foreignKey, localKey, expression, callback)` - Add custom aggregate expression (trusted SQL expression)
- `withCustom({'table': 'alias'}, foreignKey, localKey, expression, callback)` - Add custom aggregate expression with custom alias
- `joinSum('table', foreignKey, localKey, column, callback)` - Add JOIN-based SUM aggregate (derived table strategy)
- `joinSum({'table': 'alias'}, foreignKey, localKey, column, callback)` - Add JOIN-based SUM aggregate (custom alias)
- `joinCount('table', foreignKey, localKey, callback)` - Add JOIN-based COUNT aggregate
- `joinCount({'table': 'alias'}, foreignKey, localKey, callback)` - Add JOIN-based COUNT aggregate (custom alias)
- `joinAvg('table', foreignKey, localKey, column, callback)` - Add JOIN-based AVG aggregate
- `joinAvg({'table': 'alias'}, foreignKey, localKey, column, callback)` - Add JOIN-based AVG aggregate (custom alias)
- `joinMax('table', foreignKey, localKey, column, callback)` - Add JOIN-based MAX aggregate
- `joinMax({'table': 'alias'}, foreignKey, localKey, column, callback)` - Add JOIN-based MAX aggregate (custom alias)
- `joinMin('table', foreignKey, localKey, column, callback)` - Add JOIN-based MIN aggregate
- `joinMin({'table': 'alias'}, foreignKey, localKey, column, callback)` - Add JOIN-based MIN aggregate (custom alias)
- `joinCustom('table', foreignKey, localKey, expression, callback)` - Add JOIN-based custom aggregate expression
- `joinCustom({'table': 'alias'}, foreignKey, localKey, expression, callback)` - Add JOIN-based custom aggregate expression with custom alias
- `like(column, value, side)` - LIKE condition (side: 'both', 'before', 'after')
- `orLike(column, value, side)` - OR LIKE condition
- `search(columns, value, side)` - Search multiple columns with AND logic (side: 'both', 'before', 'after')
- `orSearch(columns, value, side)` - Search multiple columns with OR logic (side: 'both', 'before', 'after')
- `join(table, condition, type)` - Add JOIN (type: 'INNER', 'LEFT', 'RIGHT')
- `leftJoin(table, condition)` - LEFT JOIN
- `rightJoin(table, condition)` - RIGHT JOIN
- `groupBy(columns)` - GROUP BY clause
- `having(column, operator, value)` - HAVING clause
- `orderBy(column, direction)` - ORDER BY clause
- `limit(count)` - LIMIT clause
- `offset(count)` - OFFSET clause
- `insert(data)` - Prepare INSERT query
- `update(data)` - Prepare UPDATE query
- `delete(table)` - Prepare DELETE query
- `get()` - Execute SELECT and return results
- `chunk(size, callback)` - Process results in batches (returns rows and page number to callback)
- `chunkById(size, callback, column, alias)` - Process results in batches using ID-based pagination (more efficient)
- `first()` - Execute and return first row
- `count()` - Return count of records
- `value(column)` - Return single column value
- `execute()` - Execute INSERT/UPDATE/DELETE
- `toSql()` - Get generated SQL (for debugging)
- `getParameters()` - Get bound parameters (for debugging)

## Debugging Utilities

### dd() Function (Dump and Die)
Similar to Laravel's `dd()` function - displays data and stops execution:

```javascript
const { dd, dump, log } = require('../utils/debug');

// Console output (stops execution)
dd(userData, requestObject);

// HTML output in browser (stops execution) - pass response object as first param
dd(res, userData, requestObject);
```

Available functions in `utils/debug.js`:
- `dd(res?, ...data)` - Dump and die (stops execution) - HTML if res object provided
- `dump(...data)` - Console dump only (continues execution)
- `log(message, data)` - Timestamped logging
- `pp(data)` - Pretty print JSON

## Development Guidelines

### After Making Changes
When you make changes to the codebase, do not suggest running `npm run dev` to test the changes. The user will handle server restarts and testing as needed.

### QueryBuilder Aggregate Changes
When modifying aggregate logic in `utils/queryBuilder.js`:
- Run targeted aggregate tests first: `node tests/queryBuilder.test.js`
- Ensure both subquery aggregates (`with*`) and JOIN-based aggregates (`join*`) are validated
- Verify aggregate alias filtering still works with `where('alias', operator, value)`

## File References
- [package.json](package.json) - Dependencies and scripts
- [README.md](README.md) - User-facing startup instructions
