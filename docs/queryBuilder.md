# QueryBuilder Documentation

A fluent SQL query builder for Node.js inspired by CodeIgniter 3's Active Record pattern. Build complex SQL queries with an intuitive, chainable API.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Basic Queries](#basic-queries)
- [WHERE Conditions](#where-conditions)
- [Joins](#joins)
- [Grouping & Ordering](#grouping--ordering)
- [Search & LIKE](#search--like)
- [Eager Loading](#eager-loading)
- [Aggregate Functions](#aggregate-functions)
- [Filtering by Aggregates](#filtering-by-aggregates)
- [Relationship Existence Filtering](#relationship-existence-filtering)
- [EXISTS Subqueries](#exists-subqueries)
- [Composite Keys](#composite-keys)
- [Chunking Large Datasets](#chunking-large-datasets)
- [Insert, Update, Delete](#insert-update-delete)
- [Raw SQL Values](#raw-sql-values)
- [Debugging](#debugging)
- [API Reference](#api-reference)

## Features

- **Fluent Interface**: Chain methods for readable query construction
- **Automatic Parameterization**: SQL injection protection built-in
- **Eager Loading**: Load relationships efficiently (withMany, withOne)
- **Aggregate Functions**: withSum, withCount, withAvg, withMax, withMin
- **Composite Keys**: Full support for multi-column primary/foreign keys
- **Chunking**: Process large datasets in batches
- **Advanced Filtering**: GROUP BY, HAVING, EXISTS subqueries
- **Search Operations**: Multi-column search with LIKE
- **Raw SQL Support**: Escape hatch for complex expressions

## Installation

The queryBuilder is already included in this project:

```javascript
const { query, RawSql } = require('./utils/queryBuilder');
```

## Quick Start

```javascript
const { query } = require('./utils/queryBuilder');

// Simple SELECT
const users = await query('users')
  .where('status', 'active')
  .get();

// SELECT with relationships
const usersWithTransactions = await query('users')
  .withMany('transactions', 'user_id', 'id')
  .where('users.status', 'active')
  .get();

// INSERT
const userId = await query('users')
  .insert({ name: 'John Doe', email: 'john@example.com' })
  .execute();

// UPDATE
await query('users')
  .update({ status: 'inactive' })
  .where('id', userId)
  .execute();
```

## Basic Queries

### SELECT with specific columns

```javascript
const users = await query('users')
  .select(['id', 'name', 'email'])
  .get();
```

### SELECT DISTINCT

```javascript
const emails = await query('users')
  .distinct()
  .select('email')
  .get();
```

### First record only

```javascript
const user = await query('users')
  .where('id', 1)
  .first();
```

### Count records

```javascript
const total = await query('users')
  .where('status', 'active')
  .count();
```

### Single value

```javascript
const email = await query('users')
  .where('id', 1)
  .value('email');
```

## WHERE Conditions

### Basic WHERE

```javascript
// Equal comparison (default operator)
query('users').where('status', 'active')
// WHERE status = 'active'

// With explicit operator
query('users').where('age', '>', 18)
// WHERE age > 18

// Multiple conditions (AND logic)
query('users')
  .where('status', 'active')
  .where('age', '>=', 18)
// WHERE status = 'active' AND age >= 18
```

### OR WHERE

```javascript
query('users')
  .where('status', 'active')
  .orWhere('role', 'admin')
// WHERE status = 'active' OR role = 'admin'
```

### WHERE IN / NOT IN

```javascript
query('users').whereIn('id', [1, 2, 3])
// WHERE id IN (1, 2, 3)

query('users').whereNotIn('status', ['banned', 'suspended'])
// WHERE status NOT IN ('banned', 'suspended')
```

### Grouped Conditions

```javascript
// AND group
query('users')
  .group(function(q) {
    q.where('name', 'John')
     .orWhere('email', 'john@example.com');
  })
  .where('status', 'active')
// WHERE (name = 'John' OR email = 'john@example.com') AND status = 'active'

// OR group (multiple OR groups)
query('users')
  .orGroup(function(q) {
    q.where('status', 'active')
     .where('role', 'admin');
  })
  .orGroup(function(q) {
    q.where('status', 'pending')
     .where('created_at', '>', '2024-01-01');
  })
// WHERE (status = 'active' AND role = 'admin') OR (status = 'pending' AND created_at > '2024-01-01')

// Nested groups (group inside group)
query('users')
  .group(function(outer) {
    outer.where('first_name', 'John')
      .orGroup(function(inner) {
        inner.where('last_name', 'Doe')
             .where('age', '>', 18);
      });
  })
  .where('status', 'active')
// WHERE (first_name = 'John' OR (last_name = 'Doe' AND age > 18)) AND status = 'active'

// Deep nesting (4+ levels)
query('products')
  .group(function(l1) {
    l1.where('category_id', 1)
      .orGroup(function(l2) {
        l2.where('price', '<', 100)
          .group(function(l3) {
            l3.where('stock', '>', 0)
              .orGroup(function(l4) {
                l4.where('featured', true)
                  .where('discount', '>', 0);
              });
          });
      });
  })
  .where('active', 1)
// Complex nested query
```

## Joins

```javascript
// INNER JOIN
query('users')
  .join('payment_methods', 'users.id = payment_methods.user_id')
  .select(['users.*', 'payment_methods.card_type'])
  .get();

// LEFT JOIN
query('users')
  .leftJoin('profiles', 'users.id = profiles.user_id')
  .get();

// RIGHT JOIN
query('users')
  .rightJoin('posts', 'users.id = posts.author_id')
  .get();
```

## Grouping & Ordering

### GROUP BY

```javascript
query('users')
  .select(['status', 'COUNT(*) as count'])
  .groupBy('status')
  .get();
```

### HAVING

```javascript
query('transactions')
  .select(['user_id', 'SUM(amount) as total'])
  .groupBy('user_id')
  .having('total', '>', 10000)
  .get();
```

### ORDER BY

```javascript
query('users')
  .orderBy('created_at', 'DESC')
  .orderBy('name', 'ASC')
  .get();
```

### LIMIT & OFFSET

```javascript
query('users')
  .orderBy('created_at', 'DESC')
  .limit(10)
  .offset(20)
  .get();
// Fetch 10 records starting from position 20
```

## Search & LIKE

### LIKE queries

```javascript
// Both sides wildcard
query('users').like('name', 'John')
// WHERE name LIKE '%John%'

// Right side wildcard
query('users').like('name', 'John', 'after')
// WHERE name LIKE 'John%'

// Left side wildcard
query('users').like('name', 'John', 'before')
// WHERE name LIKE '%John'
```

### Multi-column search (AND logic)

```javascript
query('users').search(['name', 'email', 'username'], 'john')
// WHERE name LIKE '%john%' AND email LIKE '%john%' AND username LIKE '%john%'
```

### Multi-column search (OR logic)

```javascript
query('users').orSearch(['name', 'email', 'username'], 'john')
// WHERE name LIKE '%john%' OR email LIKE '%john%' OR username LIKE '%john%'
```

## Eager Loading

Eager loading efficiently loads related records using a two-query approach (similar to Laravel's Eloquent).

### withMany() - One-to-Many Relationships

Load multiple related records (has-many relationship):

```javascript
// Basic usage - table name becomes property name
const users = await query('users')
  .withMany('transactions', 'user_id', 'id')
  .get();
// users[0].transactions = [{...}, {...}, ...]

// Custom property name
const users = await query('users')
  .withMany({'transactions': 'completedTransactions'}, 'user_id', 'id', function(q) {
    q.where('status', 'completed')
     .orderBy('created_at', 'DESC');
  })
  .get();
// users[0].completedTransactions = [{...}, {...}]

// Multiple relationships
const users = await query('users')
  .withMany('transactions', 'user_id', 'id')
  .withMany('reviews', 'user_id', 'id')
  .withMany('payment_methods', 'user_id', 'id')
  .get();
```

### withOne() - One-to-One or Belongs-To Relationships

Load a single related record:

```javascript
// Basic usage - table name becomes property name
const transactions = await query('transactions')
  .withOne('users', 'id', 'user_id')
  .get();
// transactions[0].users = {...}  (single object, not array)

// Custom property name
const transactions = await query('transactions')
  .withOne({'users': 'buyer'}, 'id', 'user_id')
  .get();
// transactions[0].buyer = {...}
```

### Nested Relationships

Load relationships within relationships:

```javascript
const users = await query('users')
  .withMany('transactions', 'user_id', 'id', function(q) {
    q.withMany('transaction_details', 'transaction_id', 'id');
  })
  .get();
// users[0].transactions[0].transaction_details = [{...}, {...}]
```

### Mixing withOne() and withMany()

```javascript
const users = await query('users')
  .withOne('profiles', 'user_id', 'id')          // Single object
  .withMany('transactions', 'user_id', 'id')      // Array of objects
  .get();
// users[0].profiles = {...}
// users[0].transactions = [{...}, {...}]
```

## Aggregate Functions

Add calculated columns without loading full related records. Much more efficient than loading all relations just to count or sum.

### withSum() - Sum Related Values

```javascript
// Auto alias: table_column_sum
const users = await query('users')
  .withSum('transactions', 'user_id', 'id', 'amount')
  .get();
// users[0].transactions_amount_sum = 15000

// Custom alias
const users = await query('users')
  .withSum({'transactions': 'total_spent'}, 'user_id', 'id', 'amount', function(q) {
    q.where('status', 'completed');
  })
  .get();
// users[0].total_spent = 15000
```

### withCount() - Count Related Records

```javascript
// Auto alias: table_count
const users = await query('users')
  .withCount('transactions', 'user_id', 'id')
  .get();
// users[0].transactions_count = 5

// Custom alias with filter
const users = await query('users')
  .withCount({'transactions': 'completed_count'}, 'user_id', 'id', function(q) {
    q.where('status', 'completed');
  })
  .get();
// users[0].completed_count = 3
```

### withAvg() - Average Related Values

```javascript
const users = await query('users')
  .withAvg('transactions', 'user_id', 'id', 'amount')
  .get();
// users[0].transactions_amount_avg = 3000
```

### withMax() / withMin() - Max/Min Related Values

```javascript
const users = await query('users')
  .withMax('transactions', 'user_id', 'id', 'amount')
  .withMin('transactions', 'user_id', 'id', 'amount')
  .get();
// users[0].transactions_amount_max = 10000
// users[0].transactions_amount_min = 100
```

### Multiple Aggregates

```javascript
const userStats = await query('users')
  .withCount({'transactions': 'total_transactions'}, 'user_id', 'id')
  .withSum({'transactions': 'total_spent'}, 'user_id', 'id', 'amount', function(q) {
    q.where('status', 'completed');
  })
  .withAvg({'reviews': 'avg_rating'}, 'user_id', 'id', 'rating')
  .where('users.status', 'active')
  .get();
// userStats[0] = {
//   id: 1,
//   name: 'John',
//   total_transactions: 10,
//   total_spent: 15000,
//   avg_rating: 4.5
// }
```

## Filtering by Aggregates

The query builder automatically detects aggregate aliases in `where()` conditions and generates efficient subqueries.

### Filter by Count

```javascript
// Find users with 5+ transactions
const activeUsers = await query('users')
  .withCount('transactions', 'user_id', 'id')
  .where('transactions_count', '>=', 5)
  .get();
// WHERE (SELECT COUNT(*) FROM transactions WHERE transactions.user_id = users.id) >= 5
```

### Filter by Sum

```javascript
// Find high spenders (>$10k)
const highSpenders = await query('users')
  .withSum({'transactions': 'total_spent'}, 'user_id', 'id', 'amount')
  .where('total_spent', '>', 10000)
  .get();
// WHERE (SELECT SUM(amount) FROM transactions WHERE transactions.user_id = users.id) > 10000
```

### Combine Multiple Aggregate Filters

```javascript
// VIP users: >$50k spent AND 10+ transactions in 2025
const vipUsers = await query('users')
  .withSum({'transactions': 'total_spent'}, 'user_id', 'id', 'amount', function(q) {
    q.where('status', 'completed');
    q.where('created_at', '>', '2025-01-01');
  })
  .withCount({'transactions': 'total_count'}, 'user_id', 'id')
  .where('total_spent', '>', 50000)     // Auto-detected as aggregate
  .where('total_count', '>=', 10)       // Auto-detected as aggregate
  .get();
```

### Mix with Normal Conditions

```javascript
const premiumActiveUsers = await query('users')
  .withAvg({'transactions': 'avg_amount'}, 'user_id', 'id', 'amount')
  .where('status', 'active')            // Normal column
  .where('avg_amount', '>', 500)        // Auto-detected as aggregate
  .orWhere('role', 'vip')               // Normal column
  .get();
```

## Relationship Existence Filtering

Laravel-style methods for filtering records based on the existence (or absence) of related records. These provide a more intuitive API than raw EXISTS subqueries.

### whereHas() - Filter by Relationship Existence

Filter records that have at least one related record matching the conditions:

```javascript
// Users who have completed transactions
const users = await query('users')
  .whereHas('transactions', 'user_id', 'id', function(q) {
    q.where('status', 'completed');
    q.where('amount', '>', 1000);
  })
  .get();
// WHERE EXISTS (SELECT 1 FROM transactions 
//   WHERE transactions.user_id = users.id 
//   AND status = 'completed' AND amount > 1000)

// Users who have any transactions (no conditions)
const usersWithTransactions = await query('users')
  .whereHas('transactions', 'user_id', 'id')
  .get();
```

### whereDoesntHave() - Filter by Relationship Absence

Filter records that don't have any related records (or none matching conditions):

```javascript
// Users without any transactions
const usersWithoutTransactions = await query('users')
  .whereDoesntHave('transactions', 'user_id', 'id')
  .get();
// WHERE NOT EXISTS (SELECT 1 FROM transactions WHERE transactions.user_id = users.id)

// Users without completed transactions
const noCompletedTransactions = await query('users')
  .whereDoesntHave('transactions', 'user_id', 'id', function(q) {
    q.where('status', 'completed');
  })
  .get();
```

### orWhereHas() / orWhereDoesntHave() - OR Variants

```javascript
// Active users OR users with transactions
const activeOrEngaged = await query('users')
  .where('status', 'active')
  .orWhereHas('transactions', 'user_id', 'id')
  .get();

// Inactive users OR users without bans
const inactiveOrNotBanned = await query('users')
  .where('status', 'inactive')
  .orWhereDoesntHave('banned_users', 'user_id', 'id')
  .get();
```

### has() - Shorthand with Count Support

Simple existence check without callback, plus count-based filtering:

```javascript
// Users with at least one transaction (shorthand)
const usersWithTransactions = await query('users')
  .has('transactions', 'user_id', 'id')
  .get();
// WHERE EXISTS (SELECT 1 FROM transactions WHERE transactions.user_id = users.id)

// Users with at least 5 transactions
const activeUsers = await query('users')
  .has('transactions', 'user_id', 'id', '>=', 5)
  .get();
// Uses COUNT subquery

// Users with exactly 3 reviews
const exactReviews = await query('users')
  .has('reviews', 'user_id', 'id', '=', 3)
  .get();

// Users with at least 5 completed transactions over $1000
const highValueUsers = await query('users')
  .has('transactions', 'user_id', 'id', '>=', 5, function(q) {
    q.where('status', 'completed');
    q.where('amount', '>', 1000);
  })
  .get();
// Counts only transactions matching the callback conditions
```

### doesntHave() - Simple Absence Check

```javascript
// Users without reviews (shorthand)
const usersWithoutReviews = await query('users')
  .doesntHave('reviews', 'user_id', 'id')
  .get();
```

### Complex Combinations

Combine multiple relationship filters for powerful queries:

```javascript
// Find VIP candidates:
// - Active users
// - With completed transactions since 2025
// - Not banned
// - Have at least 2 reviews
const vipCandidates = await query('users')
  .where('status', 'active')
  .whereHas('transactions', 'user_id', 'id', function(q) {
    q.where('status', 'completed');
    q.where('created_at', '>', '2025-01-01');
  })
  .whereDoesntHave('banned_users', 'user_id', 'id')
  .has('reviews', 'user_id', 'id', '>=', 2)
  .get();
```

### Composite Keys Support

All whereHas methods support composite keys for sharded databases:

```javascript
// Orders that have items (sharded by store_id)
const ordersWithItems = await query('orders')
  .whereHas('order_items', ['order_id', 'store_id'], ['id', 'store_id'], function(q) {
    q.where('quantity', '>', 0);
    q.where('status', 'active');
  })
  .get();
// WHERE EXISTS (SELECT 1 FROM order_items 
//   WHERE order_items.order_id = orders.id 
//   AND order_items.store_id = orders.store_id 
//   AND quantity > 0 AND status = 'active')

// Orders without items
const ordersWithoutItems = await query('orders')
  .whereDoesntHave('order_items', ['order_id', 'store_id'], ['id', 'store_id'])
  .get();
```

### When to Use whereHas vs withMany

```javascript
// ❌ BAD - Loading all transactions just to check existence
const users = await query('users')
  .withMany('transactions', 'user_id', 'id')
  .get();
const filtered = users.filter(u => u.transactions.length > 0);

// ✅ GOOD - Filter in database with whereHas
const users = await query('users')
  .whereHas('transactions', 'user_id', 'id')
  .get();

// ✅ ALSO GOOD - Use both when you need the data too
const users = await query('users')
  .whereHas('transactions', 'user_id', 'id')  // Filter users
  .withMany('transactions', 'user_id', 'id')   // Load their transactions
  .get();
```

## EXISTS Subqueries

**Note:** The `whereHas()` methods above are recommended for better readability. Use these lower-level methods when you need more control.

### WHERE EXISTS

```javascript
// Users who have completed at least one transaction
const usersWithCompletedTransactions = await query('users')
  .whereExistsRelation('transactions', 'user_id', 'id', function(q) {
    q.where('status', 'completed');
  })
  .get();
// WHERE EXISTS (SELECT 1 FROM transactions WHERE transactions.user_id = users.id AND status = 'completed')
```

### WHERE NOT EXISTS

```javascript
// Users without any transactions
const usersWithoutTransactions = await query('users')
  .whereNotExistsRelation('transactions', 'user_id', 'id')
  .get();
// WHERE NOT EXISTS (SELECT 1 FROM transactions WHERE transactions.user_id = users.id)
```

### OR EXISTS / OR NOT EXISTS

```javascript
// Active users OR users with transactions
const activeOrEngaged = await query('users')
  .where('status', 'active')
  .orWhereExistsRelation('transactions', 'user_id', 'id')
  .get();

// Active users OR not banned
const activeOrNoBans = await query('users')
  .where('status', 'active')
  .orWhereNotExistsRelation('banned_users', 'user_id', 'id')
  .get();
```

## Composite Keys

Full support for tables with composite primary keys (no single id column).

### Composite Primary Keys

```javascript
// user_product_favorites has composite PK (user_id, product_id)
const usersWithFavorites = await query('users')
  .withMany('user_product_favorites', 'user_id', 'id')
  .get();
// users[0].user_product_favorites = [{user_id: 1, product_id: 2}, ...]
```

### Multiple Foreign Keys (Sharded Databases)

For tables where relationships require matching multiple columns (common in sharded databases):

```javascript
// order_items matches on BOTH order_id AND store_id
const ordersWithItems = await query('orders')
  .withMany(
    'order_items',
    ['order_id', 'store_id'],    // Multiple foreign keys
    ['id', 'store_id']            // Multiple local keys
  )
  .get();
// orders[0].order_items = [{order_id: 1, store_id: 1, ...}, ...]
```

### Aggregates with Composite Keys

```javascript
const ordersWithAggregates = await query('orders')
  .withCount(
    {'order_items': 'total_items'},
    ['order_id', 'store_id'],
    ['id', 'store_id']
  )
  .withSum(
    {'order_items': 'total_value'},
    ['order_id', 'store_id'],
    ['id', 'store_id'],
    'total_price'
  )
  .get();
// ordersWithAggregates[0] = {
//   id: 1,
//   order_number: 'ORD-001',
//   total_items: 3,
//   total_value: 299.99
// }
```

## Chunking Large Datasets

Process large result sets in batches to avoid memory issues.

### chunk() - Offset-Based Chunking

```javascript
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
```

### chunkById() - ID-Based Chunking (More Efficient)

Uses `WHERE id > lastId` instead of OFFSET, which is more efficient for very large datasets:

```javascript
await query('users')
  .where('status', 'active')
  .chunkById(100, async (users, page) => {
    console.log(`Processing page ${page} with ${users.length} users`);
    for (const user of users) {
      await processUser(user);
    }
  });

// Custom ID column and alias
await query('products')
  .where('active', 1)
  .chunkById(100, async (products, page) => {
    await processProducts(products);
  }, 'product_id', 'p');
```

**Note:** Eager loading (withMany/withOne) is NOT applied in chunk mode for memory efficiency.

## Insert, Update, Delete

### INSERT

```javascript
// Simple insert
const userId = await query('users')
  .insert({ name: 'John Doe', email: 'john@example.com' })
  .execute();
console.log('New user ID:', userId);

// Insert with multiple fields
const productId = await query('products')
  .insert({
    name: 'Widget',
    price: 29.99,
    stock: 100,
    created_at: new Date()
  })
  .execute();
```

### UPDATE

```javascript
// Update with WHERE condition
await query('users')
  .update({ status: 'inactive' })
  .where('id', 1)
  .execute();

// Update multiple records
await query('products')
  .update({ stock: 0 })
  .where('stock', '<', 10)
  .execute();
```

### DELETE

```javascript
// Delete with WHERE condition
await query('users')
  .delete()
  .where('id', 1)
  .execute();

// Delete multiple records
await query('sessions')
  .delete()
  .where('expires_at', '<', new Date())
  .execute();
```

## Raw SQL Values

Use `RawSql` class for column references or trusted SQL expressions. **⚠️ NEVER use with user input!**

### Safe Usage - Column References

```javascript
const { query, RawSql } = require('./utils/queryBuilder');

// Compare two columns
query('users')
  .where('created_at', new RawSql('updated_at'))
// WHERE created_at = updated_at

// SQL expression
query('products')
  .where('price', '>', new RawSql('cost * 1.5'))
// WHERE price > cost * 1.5
```

### ⚠️ Security Warning

```javascript
// ❌ DANGEROUS - DO NOT DO THIS
const userInput = req.query.search;
query('users').where('name', new RawSql(userInput))  // SQL INJECTION RISK!

// ✅ SAFE - Use parameterization
query('users').where('name', userInput)  // Automatically parameterized
```

## Debugging

### View Generated SQL

```javascript
const builder = query('users')
  .where('status', 'active')
  .orderBy('created_at', 'DESC');

console.log(builder.toSql());
// SELECT * FROM users WHERE status = ? ORDER BY created_at DESC

console.log(builder.getParameters());
// ['active']
```

### Debug Utility

Use the project's debug utility for pretty output:

```javascript
const { dd } = require('./utils/debug');
const { query } = require('./utils/queryBuilder');

const users = await query('users').where('status', 'active').get();
dd(users);  // Dumps users array and stops execution
```

## API Reference

### Query Construction

| Method | Description |
|--------|-------------|
| `select(columns)` | Specify columns to select (string or array) |
| `distinct()` | Add DISTINCT keyword |
| `from(table)` | Set table name (usually via query() function) |

### WHERE Conditions

| Method | Description |
|--------|-------------|
| `where(column, operator, value)` | Add WHERE condition (AND logic) |
| `orWhere(column, operator, value)` | Add WHERE condition (OR logic) |
| `whereIn(column, values)` | WHERE IN condition |
| `whereNotIn(column, values)` | WHERE NOT IN condition |
| `group(callback)` | Grouped conditions (AND logic) |
| `orGroup(callback)` | Grouped conditions (OR logic) |

### Relationship Existence (Laravel-style)

| Method | Description |
|--------|-------------|
| `whereHas(table, fk, lk, callback)` | Filter by relationship existence (recommended) |
| `orWhereHas(table, fk, lk, callback)` | OR filter by relationship existence |
| `whereDoesntHave(table, fk, lk, callback)` | Filter by relationship absence |
| `orWhereDoesntHave(table, fk, lk, callback)` | OR filter by relationship absence |
| `has(table, fk, lk, operator, count, callback)` | Simple existence check with optional count and filter |
| `doesntHave(table, fk, lk)` | Simple absence check |

### EXISTS Subqueries (Lower-level)

| Method | Description |
|--------|-------------|
| `whereExistsRelation(table, fk, lk, callback)` | WHERE EXISTS with relation (use whereHas instead) |
| `orWhereExistsRelation(table, fk, lk, callback)` | OR WHERE EXISTS |
| `whereNotExistsRelation(table, fk, lk, callback)` | WHERE NOT EXISTS |
| `orWhereNotExistsRelation(table, fk, lk, callback)` | OR WHERE NOT EXISTS |

### Eager Loading

| Method | Description |
|--------|-------------|
| `withMany(relation, fk, lk, callback)` | Load has-many relationship |
| `withOne(relation, fk, lk, callback)` | Load has-one relationship |

### Aggregates

| Method | Description |
|--------|-------------|
| `withSum(table, fk, lk, column, callback)` | Add SUM aggregate |
| `withCount(table, fk, lk, callback)` | Add COUNT aggregate |
| `withAvg(table, fk, lk, column, callback)` | Add AVG aggregate |
| `withMax(table, fk, lk, column, callback)` | Add MAX aggregate |
| `withMin(table, fk, lk, column, callback)` | Add MIN aggregate |

### Search & LIKE

| Method | Description |
|--------|-------------|
| `like(column, value, side)` | LIKE condition (AND logic) |
| `orLike(column, value, side)` | LIKE condition (OR logic) |
| `search(columns, value, side)` | Search multiple columns (AND) |
| `orSearch(columns, value, side)` | Search multiple columns (OR) |

### Joins

| Method | Description |
|--------|-------------|
| `join(table, condition, type)` | Add JOIN clause |
| `leftJoin(table, condition)` | Add LEFT JOIN |
| `rightJoin(table, condition)` | Add RIGHT JOIN |

### Grouping & Sorting

| Method | Description |
|--------|-------------|
| `groupBy(columns)` | Add GROUP BY clause |
| `having(column, operator, value)` | Add HAVING condition |
| `orderBy(column, direction)` | Add ORDER BY clause |
| `limit(count)` | LIMIT clause |
| `offset(count)` | OFFSET clause |

### Execution

| Method | Description |
|--------|-------------|
| `get()` | Execute SELECT and return all results |
| `first()` | Execute SELECT and return first row |
| `count()` | Return count of records |
| `value(column)` | Return single column value |
| `chunk(size, callback)` | Process results in batches (offset-based) |
| `chunkById(size, callback, column, alias)` | Process results in batches (ID-based) |

### Modification

| Method | Description |
|--------|-------------|
| `insert(data)` | Prepare INSERT query |
| `update(data)` | Prepare UPDATE query |
| `delete(table)` | Prepare DELETE query |
| `execute()` | Execute INSERT/UPDATE/DELETE |

### Debugging

| Method | Description |
|--------|-------------|
| `toSql()` | Get generated SQL string |
| `getParameters()` | Get bound parameters array |

## Best Practices

### 1. Use Eager Loading Instead of N+1 Queries

```javascript
// ❌ BAD - N+1 query problem
const users = await query('users').get();
for (const user of users) {
  user.transactions = await query('transactions')
    .where('user_id', user.id)
    .get();
}

// ✅ GOOD - Eager loading with 2 queries total
const users = await query('users')
  .withMany('transactions', 'user_id', 'id')
  .get();
```

### 1b. Use whereHas for Filtering, Not Loading

```javascript
// ❌ BAD - Loading all data just to filter
const users = await query('users')
  .withMany('transactions', 'user_id', 'id')
  .get();
const filtered = users.filter(u => u.transactions.length > 0);

// ✅ GOOD - Filter in database
const users = await query('users')
  .whereHas('transactions', 'user_id', 'id')
  .get();

// ✅ BEST - Combine when you need both
const users = await query('users')
  .whereHas('transactions', 'user_id', 'id')  // Filter
  .withMany('transactions', 'user_id', 'id')   // Then load
  .get();
```

### 2. Use Aggregates When You Don't Need Full Data

```javascript
// ❌ BAD - Loads all transactions just to count
const users = await query('users')
  .withMany('transactions', 'user_id', 'id')
  .get();
const count = users[0].transactions.length;

// ✅ GOOD - Just count without loading
const users = await query('users')
  .withCount('transactions', 'user_id', 'id')
  .get();
const count = users[0].transactions_count;
```

### 3. Use Chunking for Large Datasets

```javascript
// ❌ BAD - Loads millions of records into memory
const users = await query('users').get();
for (const user of users) {
  await processUser(user);
}

// ✅ GOOD - Process in batches
await query('users').chunkById(100, async (users) => {
  for (const user of users) {
    await processUser(user);
  }
});
```

### 4. Be Specific with SELECT

```javascript
// ❌ BAD - Selects all columns including large blobs
const users = await query('users').get();

// ✅ GOOD - Select only needed columns
const users = await query('users')
  .select(['id', 'name', 'email'])
  .get();
```

### 5. Use Proper Indexes

Ensure database indexes exist for:
- Foreign keys used in eager loading
- Columns used in WHERE conditions
- Columns used in ORDER BY
- Columns used in aggregate callbacks

### 6. Filter Relations in Callbacks

```javascript
// Filter related records efficiently
const users = await query('users')
  .withMany('transactions', 'user_id', 'id', function(q) {
    q.where('status', 'completed')
     .where('created_at', '>', '2025-01-01')
     .orderBy('created_at', 'DESC')
     .limit(10);
  })
  .get();
```

## Common Patterns

### Pagination

```javascript
const page = 2;
const perPage = 20;

const users = await query('users')
  .where('status', 'active')
  .orderBy('created_at', 'DESC')
  .limit(perPage)
  .offset((page - 1) * perPage)
  .get();

const total = await query('users')
  .where('status', 'active')
  .count();
```

### Search with Filters

```javascript
const results = await query('products')
  .orSearch(['name', 'description', 'sku'], searchTerm)
  .where('active', 1)
  .whereIn('category_id', selectedCategories)
  .where('price', '>=', minPrice)
  .where('price', '<=', maxPrice)
  .orderBy('name', 'ASC')
  .get();
```

### Complex Dashboard Query

```javascript
const dashboardData = await query('users')
  .select(['id', 'name', 'email', 'created_at'])
  .withCount({'transactions': 'total_transactions'}, 'user_id', 'id')
  .withSum({'transactions': 'total_spent'}, 'user_id', 'id', 'amount', function(q) {
    q.where('status', 'completed');
  })
  .withAvg({'reviews': 'avg_rating'}, 'user_id', 'id', 'rating')
  .withOne('profiles', 'user_id', 'id')
  .where('users.status', 'active')
  .where('total_spent', '>', 1000)  // Auto-detected aggregate filter
  .orderBy('total_spent', 'DESC')
  .limit(50)
  .get();
```

### Bulk Processing

```javascript
// Process all active users in batches
let processed = 0;
await query('users')
  .where('status', 'active')
  .chunkById(100, async (users, page) => {
    console.log(`Processing batch ${page}...`);
    
    for (const user of users) {
      await sendEmail(user.email);
      processed++;
    }
    
    console.log(`Total processed: ${processed}`);
  });
```

---

## Related Documentation

- [Database Utilities](./database.md) - Database connection and basic query methods
- [Debug Utilities](./debug.md) - dd(), dump(), and logging functions
- [Model Patterns](./models.md) - Creating model classes with QueryBuilder

## Support

For issues or questions about the query builder:
1. Check this documentation
2. Review the [test file](../tests/queryBuilder.test.js) for examples
3. Examine the [source code](../utils/queryBuilder.js) JSDoc comments
