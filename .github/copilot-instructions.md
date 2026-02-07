# Copilot Instructions for node_new_prj

## Project Overview
A Node.js HTTP server project with Express and EJS dependencies installed. Currently uses native Node.js `http` module for a minimal server. Structured as a starter template for building web applications.

## Essential Commands
- `npm start` - Runs `node index.js` to start the HTTP server on port 3000
- `npm run dev` - Runs with nodemon for automatic restarts on code changes
- `npm run seed` - Runs the database seeder to create tables and sample data
- `npm test` - Currently returns error (no tests configured)
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
- **payment_methods**: User's saved payment methods (credit cards, PayPal, etc.)
- **transactions**: Main transaction records with totals and status
- **transaction_details**: Individual items within transactions
- **payment_histories**: Payment processing history and gateway responses

### Relationships
- `users` → `payment_methods` (1:many)
- `users` → `transactions` (1:many)  
- `payment_methods` → `transactions` (1:many)
- `transactions` → `transaction_details` (1:many)
- `transactions` → `payment_histories` (1:many)

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

// Count and single values
const total = await query('users').count();
const email = await query('users').where('id', 1).value('email');
```

Available methods:
- `select(columns)` - Specify columns to select
- `distinct()` - Add DISTINCT to query
- `from(table)` - Specify table (can also pass to query() function)
- `where(column, operator, value)` - Add WHERE condition
- `orWhere(column, operator, value)` - Add OR WHERE condition
- `whereIn(column, values)` - WHERE IN condition
- `whereNotIn(column, values)` - WHERE NOT IN condition
- `group(callback)` - Start a grouped condition (AND logic) with callback
- `orGroup(callback)` - Start a grouped condition (OR logic) with callback
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
- `first()` - Execute and return first row
- `count()` - Return count of records
- `value(column)` - Return single column value
- `execute()` - Execute INSERT/UPDATE/DELETE
- `toSql()` - Get generated SQL (for debugging)
- `getParameters()` - Get bound parameters (for debugging)

## Debugging Utilities

### dd() Function (Dump and Die)
Similar to Laravel's `dd()` function for debugging:

```javascript
const { dd, dc, dump, log } = require('../utils/debug');

// Console output (stops execution)
dd(userData, requestObject);

// HTML output in browser (stops execution) - pass response object as first param
dd(res, userData, requestObject);

// HTML output in browser (CONTINUES execution) - pass response object as first param
dc(res, userData, requestObject);

// Continue execution and dump data
dump(userData);

// Enhanced logging with timestamp
log('User data retrieved', userData);
```

Available functions in `utils/debug.js`:
- `dd(res?, ...data)` - Dump and die (console output by default, HTML if res object provided)
- `dc(res, ...data)` - Dump and continue (HTML output, stops current request execution)
- `dump(...data)` - Dump only (continues execution)
- `log(message, data)` - Timestamped logging
- `pp(data)` - Pretty print JSON

## File References
- [package.json](package.json) - Dependencies and scripts
- [README.md](README.md) - User-facing startup instructions
