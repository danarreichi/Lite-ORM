const { query, RawSql } = require('../utils/queryBuilder');
const { dd } = require('../utils/debug');

/**
 * QueryBuilder Test Suite
 * 
 * Tests the queryBuilder functionality using the database schema from seeder.js
 * 
 * Prerequisites:
 * - MySQL must be running
 * - Run `npm run seed` to create tables and sample data
 * 
 * To run tests:
 * node tests/queryBuilder.test.js
 */

// Test result tracking
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

// Test helpers
function assert(condition, testName) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`✅ ${testName}`);
    return true;
  } else {
    failedTests++;
    console.error(`❌ ${testName}`);
    return false;
  }
}

function assertEquals(actual, expected, testName) {
  totalTests++;
  const passed = JSON.stringify(actual) === JSON.stringify(expected);
  if (passed) {
    passedTests++;
    console.log(`✅ ${testName}`);
  } else {
    failedTests++;
    console.error(`❌ ${testName}`);
    console.error('  Expected:', expected);
    console.error('  Actual:', actual);
  }
  return passed;
}

function assertGreaterThan(actual, expected, testName) {
  totalTests++;
  if (actual > expected) {
    passedTests++;
    console.log(`✅ ${testName}`);
    return true;
  } else {
    failedTests++;
    console.error(`❌ ${testName}`);
    console.error(`  Expected ${actual} > ${expected}`);
    return false;
  }
}

function assertContains(array, value, testName) {
  totalTests++;
  const passed = array && array.length > 0 && array.some(item => 
    JSON.stringify(item).includes(JSON.stringify(value))
  );
  if (passed) {
    passedTests++;
    console.log(`✅ ${testName}`);
  } else {
    failedTests++;
    console.error(`❌ ${testName}`);
    console.error('  Array:', array);
    console.error('  Looking for:', value);
  }
  return passed;
}

// Test Categories
console.log('\n📦 BASIC SELECT QUERIES\n');

async function testBasicSelect() {
  const users = await query('users').get();
  assert(users.length >= 3, 'Basic SELECT: Retrieve all users');
  assert(users[0].hasOwnProperty('id'), 'Basic SELECT: Users have id field');
  assert(users[0].hasOwnProperty('username'), 'Basic SELECT: Users have username field');
}

async function testSelectWithColumns() {
  const users = await query('users')
    .select(['id', 'username', 'email'])
    .get();
  assert(users.length >= 3, 'SELECT specific columns: Returns data');
  assert(users[0].hasOwnProperty('username'), 'SELECT specific columns: Has username');
  assert(!users[0].hasOwnProperty('password_hash'), 'SELECT specific columns: Excludes unselected fields');
}

async function testSelectDistinct() {
  const statuses = await query('transactions')
    .distinct()
    .select('status')
    .get();
  assert(statuses.length > 0, 'SELECT DISTINCT: Returns results');
  assert(statuses.length <= 5, 'SELECT DISTINCT: No duplicate statuses');
}

console.log('\n🔍 WHERE CONDITIONS\n');

async function testWhereEquals() {
  const user = await query('users')
    .where('username', 'john_doe')
    .first();
  assert(user !== null, 'WHERE =: Found user');
  assertEquals(user.username, 'john_doe', 'WHERE =: Correct user returned');
}

async function testWhereOperator() {
  const transactions = await query('transactions')
    .where('total_amount', '>', 100)
    .get();
  assert(transactions.length > 0, 'WHERE >: Found transactions');
  assert(transactions.every(t => t.total_amount > 100), 'WHERE >: All amounts greater than 100');
}

async function testWhereIn() {
  const users = await query('users')
    .whereIn('username', ['john_doe', 'jane_smith'])
    .get();
  assertEquals(users.length, 2, 'WHERE IN: Returns correct count');
  assert(users.every(u => ['john_doe', 'jane_smith'].includes(u.username)), 'WHERE IN: Correct users');
}

async function testWhereNotIn() {
  const users = await query('users')
    .whereNotIn('username', ['john_doe'])
    .get();
  assert(users.length >= 2, 'WHERE NOT IN: Returns other users');
  assert(users.every(u => u.username !== 'john_doe'), 'WHERE NOT IN: Excludes john_doe');
}

async function testOrWhere() {
  const users = await query('users')
    .where('username', 'john_doe')
    .orWhere('username', 'jane_smith')
    .get();
  assertEquals(users.length, 2, 'OR WHERE: Returns both users');
}

console.log('\n📁 GROUPED CONDITIONS\n');

async function testGroupedConditions() {
  const users = await query('users')
    .group(q => {
      q.where('username', 'john_doe')
       .orWhere('username', 'jane_smith');
    })
    .where('email', '!=', '')
    .get();
  assert(users.length >= 2, 'GROUP: Returns grouped results');
}

console.log('\n🔗 EXISTS SUBQUERIES\n');

async function testWhereExistsRelation() {
  const users = await query('users')
    .whereExistsRelation('transactions', 'user_id', 'id', function(q) {
      q.where('status', 'completed');
    })
    .get();
  assert(users.length > 0, 'WHERE EXISTS: Found users with completed transactions');
}

async function testWhereNotExistsRelation() {
  // This might return 0 if all users have transactions, which is fine
  const users = await query('users')
    .whereNotExistsRelation('transactions', 'user_id', 'id')
    .get();
  assert(Array.isArray(users), 'WHERE NOT EXISTS: Returns array');
}

console.log('\n🔄 EAGER LOADING (withMany/withOne)\n');

async function testWithMany() {
  const users = await query('users')
    .withMany('transactions', 'user_id', 'id')
    .where('username', 'john_doe')
    .first();
  
  assert(users !== null, 'withMany: Returns user');
  assert(Array.isArray(users.transactions), 'withMany: Loads transactions as array');
  assert(users.transactions.length >= 0, 'withMany: Transactions array exists');
}

async function testWithManyCustomName() {
  const users = await query('users')
    .withMany({'transactions': 'completedTransactions'}, 'user_id', 'id', function(q) {
      q.where('status', 'completed');
    })
    .where('username', 'john_doe')
    .first();
  
  assert(users !== null, 'withMany custom name: Returns user');
  assert(Array.isArray(users.completedTransactions), 'withMany custom name: Uses custom property name');
}

async function testWithOne() {
  const transactions = await query('transactions')
    .withOne({'users': 'buyer'}, 'id', 'user_id')
    .first();
  
  assert(transactions !== null, 'withOne: Returns transaction');
  assert(transactions.buyer !== null, 'withOne: Loads related user');
  assert(typeof transactions.buyer === 'object', 'withOne: Returns single object not array');
}

async function testNestedEagerLoading() {
  const users = await query('users')
    .withMany('transactions', 'user_id', 'id', function(q) {
      q.withMany('transaction_details', 'transaction_id', 'id');
    })
    .where('username', 'john_doe')
    .first();
  
  assert(users !== null, 'Nested eager loading: Returns user');
  assert(Array.isArray(users.transactions), 'Nested eager loading: Loads transactions');
  if (users.transactions.length > 0) {
    assert(Array.isArray(users.transactions[0].transaction_details), 'Nested eager loading: Loads nested details');
  }
}

console.log('\n📊 AGGREGATE FUNCTIONS\n');

async function testWithSum() {
  const users = await query('users')
    .withSum('transactions', 'user_id', 'id', 'total_amount')
    .where('username', 'john_doe')
    .first();
  
  assert(users !== null, 'withSum: Returns user');
  assert(typeof users.transactions_total_amount_sum === 'number', 'withSum: Auto alias is number');
}

async function testWithSumCustomAlias() {
  const users = await query('users')
    .withSum({'transactions': 'total_spent'}, 'user_id', 'id', 'total_amount')
    .where('username', 'john_doe')
    .first();
  
  assert(users !== null, 'withSum custom alias: Returns user');
  assert(typeof users.total_spent === 'number', 'withSum custom alias: Uses custom alias');
}

async function testWithCount() {
  const users = await query('users')
    .withCount('transactions', 'user_id', 'id')
    .get();
  
  assert(users.length > 0, 'withCount: Returns users');
  assert(typeof users[0].transactions_count === 'number', 'withCount: Count is number');
}

async function testWithAvg() {
  const users = await query('users')
    .withAvg('transactions', 'user_id', 'id', 'total_amount')
    .where('username', 'john_doe')
    .first();
  
  assert(users !== null, 'withAvg: Returns user');
  assert(typeof users.transactions_total_amount_avg === 'number' || users.transactions_total_amount_avg === 0, 'withAvg: Average is number');
}

async function testWithMax() {
  const users = await query('users')
    .withMax('transactions', 'user_id', 'id', 'total_amount')
    .where('username', 'john_doe')
    .first();
  
  assert(users !== null, 'withMax: Returns user');
  assert(typeof users.transactions_total_amount_max === 'number' || users.transactions_total_amount_max === 0, 'withMax: Max is number');
}

async function testWithMin() {
  const users = await query('users')
    .withMin('transactions', 'user_id', 'id', 'total_amount')
    .where('username', 'john_doe')
    .first();
  
  assert(users !== null, 'withMin: Returns user');
  assert(typeof users.transactions_total_amount_min === 'number' || users.transactions_total_amount_min === 0, 'withMin: Min is number');
}

async function testMultipleAggregates() {
  const users = await query('users')
    .withCount({'transactions': 'total_transactions'}, 'user_id', 'id')
    .withSum({'transactions': 'total_spent'}, 'user_id', 'id', 'total_amount')
    .withAvg({'transactions': 'avg_amount'}, 'user_id', 'id', 'total_amount')
    .where('username', 'john_doe')
    .first();
  
  assert(users !== null, 'Multiple aggregates: Returns user');
  assert(typeof users.total_transactions === 'number', 'Multiple aggregates: Has count');
  assert(typeof users.total_spent === 'number', 'Multiple aggregates: Has sum');
  assert(typeof users.avg_amount === 'number', 'Multiple aggregates: Has average');
}

console.log('\n🎯 AGGREGATE FILTERING (Auto-detect)\n');

async function testFilterByAggregateAlias() {
  const users = await query('users')
    .withSum({'transactions': 'total_spent'}, 'user_id', 'id', 'total_amount')
    .where('total_spent', '>', 100)
    .get();
  
  assert(Array.isArray(users), 'Filter by aggregate: Returns array');
  // All returned users should have spent > 100
  if (users.length > 0) {
    assert(users.every(u => u.total_spent > 100), 'Filter by aggregate: All match condition');
  }
}

async function testMixedFilteringAggregateAndNormal() {
  const users = await query('users')
    .withCount('transactions', 'user_id', 'id')
    .where('username', 'john_doe')
    .where('transactions_count', '>=', 1)
    .first();
  
  assert(users === null || users.username === 'john_doe', 'Mixed filtering: Normal WHERE works');
  assert(users === null || users.transactions_count >= 1, 'Mixed filtering: Aggregate WHERE works');
}

console.log('\n🔎 LIKE AND SEARCH\n');

async function testLike() {
  const users = await query('users')
    .like('username', 'john')
    .get();
  
  assert(users.length > 0, 'LIKE: Found matching users');
  assert(users.some(u => u.username.includes('john')), 'LIKE: Users match pattern');
}

async function testSearch() {
  const users = await query('users')
    .search(['username', 'email'], 'john')
    .get();
  
  assert(users.length > 0, 'SEARCH: Found matching users');
}

async function testOrSearch() {
  const users = await query('users')
    .orSearch(['username', 'email', 'first_name'], 'john')
    .get();
  
  assert(users.length > 0, 'OR SEARCH: Found matching users');
}

console.log('\n🔗 JOINS\n');

async function testJoin() {
  const users = await query('users')
    .select(['users.username', 'transactions.transaction_number'])
    .join('transactions', 'users.id = transactions.user_id')
    .get();
  
  assert(users.length > 0, 'JOIN: Returns joined results');
  assert(users[0].hasOwnProperty('username'), 'JOIN: Has user field');
  assert(users[0].hasOwnProperty('transaction_number'), 'JOIN: Has transaction field');
}

async function testLeftJoin() {
  const users = await query('users')
    .select(['users.username', 'transactions.id as transaction_id'])
    .leftJoin('transactions', 'users.id = transactions.user_id')
    .get();
  
  assert(users.length >= 3, 'LEFT JOIN: Returns all users');
}

console.log('\n📊 GROUP BY, HAVING, ORDER BY\n');

async function testGroupBy() {
  const stats = await query('transactions')
    .select(['status', 'COUNT(*) as count'])
    .groupBy('status')
    .get();
  
  assert(stats.length > 0, 'GROUP BY: Returns grouped results');
}

async function testHaving() {
  const stats = await query('transactions')
    .select(['user_id', 'COUNT(*) as count'])
    .groupBy('user_id')
    .having('count', '>', 1)
    .get();
  
  assert(Array.isArray(stats), 'HAVING: Returns results');
}

async function testOrderBy() {
  const users = await query('users')
    .orderBy('username', 'ASC')
    .get();
  
  assert(users.length >= 3, 'ORDER BY: Returns users');
  // Check if sorted (basic check)
  if (users.length >= 2) {
    assert(users[0].username <= users[1].username, 'ORDER BY: Results are sorted');
  }
}

console.log('\n📄 LIMIT AND OFFSET\n');

async function testLimit() {
  const users = await query('users')
    .limit(2)
    .get();
  
  assertEquals(users.length, 2, 'LIMIT: Returns limited results');
}

async function testLimitOffset() {
  const users = await query('users')
    .limit(2)
    .offset(1)
    .get();
  
  assert(users.length <= 2, 'LIMIT + OFFSET: Returns limited results');
}

console.log('\n➕ INSERT QUERIES\n');

async function testInsert() {
  const testUser = {
    username: 'test_user_' + Date.now(),
    email: `test${Date.now()}@example.com`,
    password_hash: '$2b$10$testhash',
    first_name: 'Test',
    last_name: 'User'
  };
  
  const insertId = await query('users')
    .insert(testUser)
    .execute();
  
  assert(insertId > 0, 'INSERT: Returns insert ID');
  
  // Verify insertion
  const inserted = await query('users')
    .where('id', insertId)
    .first();
  
  assertEquals(inserted.username, testUser.username, 'INSERT: User inserted correctly');
  
  // Cleanup
  await query('users').delete().where('id', insertId).execute();
}

console.log('\n✏️ UPDATE QUERIES\n');

async function testUpdate() {
  // Create test user
  const testUser = {
    username: 'update_test_' + Date.now(),
    email: `update${Date.now()}@example.com`,
    password_hash: '$2b$10$testhash',
    first_name: 'UpdateTest'
  };
  
  const insertId = await query('users').insert(testUser).execute();
  
  // Update
  const affectedRows = await query('users')
    .update({ first_name: 'Updated' })
    .where('id', insertId)
    .execute();
  
  assert(affectedRows > 0, 'UPDATE: Returns affected rows');
  
  // Verify
  const updated = await query('users').where('id', insertId).first();
  assertEquals(updated.first_name, 'Updated', 'UPDATE: Field updated correctly');
  
  // Cleanup
  await query('users').delete().where('id', insertId).execute();
}

console.log('\n🗑️ DELETE QUERIES\n');

async function testDelete() {
  // Create test user
  const testUser = {
    username: 'delete_test_' + Date.now(),
    email: `delete${Date.now()}@example.com`,
    password_hash: '$2b$10$testhash'
  };
  
  const insertId = await query('users').insert(testUser).execute();
  
  // Delete
  const deletedRows = await query('users')
    .delete()
    .where('id', insertId)
    .execute();
  
  assert(deletedRows > 0, 'DELETE: Returns deleted rows');
  
  // Verify
  const deleted = await query('users').where('id', insertId).first();
  assert(deleted === null, 'DELETE: User deleted correctly');
}

console.log('\n🔢 UTILITY METHODS\n');

async function testFirst() {
  const user = await query('users').first();
  assert(user !== null, 'first(): Returns single row');
  assert(!Array.isArray(user), 'first(): Returns object not array');
}

async function testValue() {
  const username = await query('users')
    .where('username', 'john_doe')
    .value('email');
  
  assert(username !== null, 'value(): Returns value');
  assertEquals(username, 'john@example.com', 'value(): Returns correct value');
}

async function testCount() {
  const count = await query('users').count();
  assert(count >= 3, 'count(): Returns count');
  assert(typeof count === 'number', 'count(): Count is number');
}

console.log('\n📦 CHUNKING\n');

async function testChunk() {
  let processedPages = 0;
  let totalRows = 0;
  
  await query('users')
    .chunk(2, async (rows, page) => {
      processedPages++;
      totalRows += rows.length;
      assert(rows.length <= 2, `chunk(): Page ${page} has <= 2 rows`);
    });
  
  assert(processedPages > 0, 'chunk(): Processed pages');
  assert(totalRows >= 3, 'chunk(): Processed all rows');
}

async function testChunkById() {
  let processedPages = 0;
  let totalRows = 0;
  
  await query('users')
    .chunkById(2, async (rows, page) => {
      processedPages++;
      totalRows += rows.length;
      assert(rows.length <= 2, `chunkById(): Page ${page} has <= 2 rows`);
    });
  
  assert(processedPages > 0, 'chunkById(): Processed pages');
  assert(totalRows >= 3, 'chunkById(): Processed all rows');
}

console.log('\n🔑 COMPOSITE KEYS\n');

async function testCompositeKeyEagerLoading() {
  // User product favorites has composite primary key (user_id, product_id)
  const users = await query('users')
    .withMany('user_product_favorites', 'user_id', 'id')
    .where('username', 'john_doe')
    .first();
  
  assert(users !== null, 'Composite key: Returns user');
  assert(Array.isArray(users.user_product_favorites), 'Composite key: Loads favorites');
}

console.log('\n🔗 MULTIPLE FOREIGN KEYS (Composite Matching)\n');

async function testMultipleForeignKeys() {
  const orders = await query('orders')
    .withMany('order_items', ['order_id', 'store_id'], ['id', 'store_id'])
    .first();
  
  assert(orders !== null, 'Multiple FK: Returns order');
  assert(Array.isArray(orders.order_items), 'Multiple FK: Loads order_items');
  
  // All order_items should match both order_id AND store_id
  if (orders.order_items.length > 0) {
    const allMatch = orders.order_items.every(item => 
      item.order_id === orders.id && item.store_id === orders.store_id
    );
    assert(allMatch, 'Multiple FK: All items match BOTH keys');
  }
}

async function testMultipleFKWithAggregate() {
  const orders = await query('orders')
    .withCount('order_items', ['order_id', 'store_id'], ['id', 'store_id'])
    .withSum('order_items', ['order_id', 'store_id'], ['id', 'store_id'], 'total_price')
    .first();
  
  assert(orders !== null, 'Multiple FK aggregate: Returns order');
  assert(typeof orders.order_items_count === 'number', 'Multiple FK aggregate: Has count');
  assert(typeof orders.order_items_total_price_sum === 'number', 'Multiple FK aggregate: Has sum');
}

console.log('\n🔍 DEBUGGING METHODS\n');

async function testToSql() {
  const sql = query('users')
    .where('username', 'john_doe')
    .toSql();
  
  assert(sql.includes('SELECT'), 'toSql(): Contains SELECT');
  assert(sql.includes('WHERE'), 'toSql(): Contains WHERE');
}

async function testGetParameters() {
  const qb = query('users')
    .where('username', 'john_doe')
    .where('email', 'john@example.com');
  
  // Must call toSql() first to populate parameters
  qb.toSql();
  const params = qb.getParameters();
  
  assert(Array.isArray(params), 'getParameters(): Returns array');
  assertEquals(params.length, 2, 'getParameters(): Has 2 parameters');
}

// Run all tests
async function runAllTests() {
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║   QueryBuilder Test Suite                         ║');
  console.log('║   Testing utils/queryBuilder.js                   ║');
  console.log('╚═══════════════════════════════════════════════════╝');
  
  try {
    // Basic SELECT
    await testBasicSelect();
    await testSelectWithColumns();
    await testSelectDistinct();
    
    // WHERE conditions
    await testWhereEquals();
    await testWhereOperator();
    await testWhereIn();
    await testWhereNotIn();
    await testOrWhere();
    
    // Grouped conditions
    await testGroupedConditions();
    
    // EXISTS subqueries
    await testWhereExistsRelation();
    await testWhereNotExistsRelation();
    
    // Eager loading
    await testWithMany();
    await testWithManyCustomName();
    await testWithOne();
    await testNestedEagerLoading();
    
    // Aggregates
    await testWithSum();
    await testWithSumCustomAlias();
    await testWithCount();
    await testWithAvg();
    await testWithMax();
    await testWithMin();
    await testMultipleAggregates();
    
    // Aggregate filtering
    await testFilterByAggregateAlias();
    await testMixedFilteringAggregateAndNormal();
    
    // LIKE and search
    await testLike();
    await testSearch();
    await testOrSearch();
    
    // JOINS
    await testJoin();
    await testLeftJoin();
    
    // GROUP BY, HAVING, ORDER BY
    await testGroupBy();
    await testHaving();
    await testOrderBy();
    
    // LIMIT and OFFSET
    await testLimit();
    await testLimitOffset();
    
    // INSERT, UPDATE, DELETE
    await testInsert();
    await testUpdate();
    await testDelete();
    
    // Utility methods
    await testFirst();
    await testValue();
    await testCount();
    
    // Chunking
    await testChunk();
    await testChunkById();
    
    // Composite keys
    await testCompositeKeyEagerLoading();
    
    // Multiple foreign keys
    await testMultipleForeignKeys();
    await testMultipleFKWithAggregate();
    
    // Debugging
    await testToSql();
    await testGetParameters();
    
  } catch (error) {
    console.error('\n💥 Test suite error:', error);
    failedTests++;
  }
  
  // Summary
  console.log('\n╔═══════════════════════════════════════════════════╗');
  console.log('║   TEST SUMMARY                                    ║');
  console.log('╚═══════════════════════════════════════════════════╝');
  console.log(`\n📊 Total Tests: ${totalTests}`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`📈 Success Rate: ${((passedTests / totalTests) * 100).toFixed(2)}%\n`);
  
  if (failedTests === 0) {
    console.log('🎉 All tests passed! QueryBuilder is working correctly.\n');
  } else {
    console.log(`⚠️  ${failedTests} test(s) failed. Please review the failures above.\n`);
  }
  
  process.exit(failedTests > 0 ? 1 : 0);
}

// Run tests if called directly
if (require.main === module) {
  runAllTests();
}

module.exports = { runAllTests };
