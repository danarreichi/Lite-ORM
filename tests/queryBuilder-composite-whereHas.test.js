/**
 * Test QueryBuilder whereHas() methods with Composite Keys support
 * Run: node tests/queryBuilder-composite-whereHas.test.js
 */

const { query } = require('../utils/queryBuilder');

class TestRunner {
  constructor() {
    this.tests = [];
    this.passedTests = 0;
    this.failedTests = 0;
  }

  test(name, callback) {
    this.tests.push({ name, callback });
  }

  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`${message}\n  Expected: ${expected}\n  Actual:   ${actual}`);
    }
  }

  assertContains(string, substring, message) {
    if (!string.includes(substring)) {
      throw new Error(`${message}\n  Expected to contain: ${substring}\n  Actual: ${string}`);
    }
  }

  async run() {
    console.log('\n🧪 Running QueryBuilder Composite Keys whereHas() Tests...\n');

    for (const test of this.tests) {
      try {
        await test.callback();
        console.log(`✅ ${test.name}`);
        this.passedTests++;
      } catch (error) {
        console.log(`❌ ${test.name}`);
        console.log(`   ${error.message}\n`);
        this.failedTests++;
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Tests: ${this.passedTests + this.failedTests}`);
    console.log(`Passed: ${this.passedTests}`);
    console.log(`Failed: ${this.failedTests}`);
    console.log(`${'='.repeat(60)}\n`);

    return this.failedTests === 0;
  }
}

const runner = new TestRunner();

// Test whereHas() with single key
runner.test('whereHas() generates correct SQL with single key', () => {
  const q = query('users')
    .whereHas('transactions', 'user_id', 'id', function(subq) {
      subq.where('status', 'completed');
    });

  const sql = q.toSql();
  
  runner.assertContains(sql, 'WHERE EXISTS', 'Should contain WHERE EXISTS');
  runner.assertContains(sql, 'SELECT 1 FROM transactions', 'Should select 1 from transactions');
  runner.assertContains(sql, 'transactions.user_id = users.id', 'Should match foreign key to local key');
  runner.assertContains(sql, 'status', 'Should contain status condition');
});

// Test whereHas() with composite keys (arrays)
runner.test('whereHas() generates correct SQL with composite keys', () => {
  const q = query('orders')
    .whereHas('order_items', ['order_id', 'store_id'], ['id', 'store_id'], function(subq) {
      subq.where('quantity', '>', 0);
    });

  const sql = q.toSql();
  
  runner.assertContains(sql, 'WHERE EXISTS', 'Should contain WHERE EXISTS');
  runner.assertContains(sql, 'SELECT 1 FROM order_items', 'Should select 1 from order_items');
  runner.assertContains(sql, 'order_items.order_id = orders.id', 'Should match first composite key');
  runner.assertContains(sql, 'order_items.store_id = orders.store_id', 'Should match second composite key');
  runner.assertContains(sql, 'quantity', 'Should contain quantity condition');
});

// Test whereDoesntHave() with composite keys
runner.test('whereDoesntHave() generates correct SQL with composite keys', () => {
  const q = query('orders')
    .whereDoesntHave('order_items', ['order_id', 'store_id'], ['id', 'store_id']);

  const sql = q.toSql();
  
  runner.assertContains(sql, 'WHERE NOT EXISTS', 'Should contain WHERE NOT EXISTS');
  runner.assertContains(sql, 'SELECT 1 FROM order_items', 'Should select 1 from order_items');
  runner.assertContains(sql, 'order_items.order_id = orders.id', 'Should match first composite key');
  runner.assertContains(sql, 'order_items.store_id = orders.store_id', 'Should match second composite key');
});

// Test orWhereHas() with composite keys
runner.test('orWhereHas() generates correct SQL with composite keys', () => {
  const q = query('orders')
    .where('status', 'pending')
    .orWhereHas('order_items', ['order_id', 'store_id'], ['id', 'store_id']);

  const sql = q.toSql();
  
  runner.assertContains(sql, 'WHERE', 'Should contain WHERE');
  runner.assertContains(sql, 'OR EXISTS', 'Should contain OR EXISTS');
  runner.assertContains(sql, 'order_items.order_id = orders.id', 'Should match first composite key');
  runner.assertContains(sql, 'order_items.store_id = orders.store_id', 'Should match second composite key');
});

// Test orWhereDoesntHave() with composite keys
runner.test('orWhereDoesntHave() generates correct SQL with composite keys', () => {
  const q = query('orders')
    .where('status', 'cancelled')
    .orWhereDoesntHave('order_items', ['order_id', 'store_id'], ['id', 'store_id']);

  const sql = q.toSql();
  
  runner.assertContains(sql, 'WHERE', 'Should contain WHERE');
  runner.assertContains(sql, 'OR NOT EXISTS', 'Should contain OR NOT EXISTS');
  runner.assertContains(sql, 'order_items.order_id = orders.id', 'Should match first composite key');
  runner.assertContains(sql, 'order_items.store_id = orders.store_id', 'Should match second composite key');
});

// Test whereExistsRelation() with composite keys
runner.test('whereExistsRelation() generates correct SQL with composite keys', () => {
  const q = query('orders')
    .whereExistsRelation('order_items', ['order_id', 'store_id'], ['id', 'store_id'], function(subq) {
      subq.where('status', 'active');
    });

  const sql = q.toSql();
  
  runner.assertContains(sql, 'WHERE EXISTS', 'Should contain WHERE EXISTS');
  runner.assertContains(sql, 'order_items.order_id = orders.id', 'Should match first composite key');
  runner.assertContains(sql, 'order_items.store_id = orders.store_id', 'Should match second composite key');
  runner.assertContains(sql, 'status', 'Should contain status condition');
});

// Test complex query with composite keys
runner.test('Complex query with multiple whereHas using composite keys', () => {
  const q = query('orders')
    .where('orders.status', 'confirmed')
    .whereHas('order_items', ['order_id', 'store_id'], ['id', 'store_id'], function(subq) {
      subq.where('quantity', '>', 0);
    })
    .whereDoesntHave('order_refunds', ['order_id', 'store_id'], ['id', 'store_id']);

  const sql = q.toSql();
  
  runner.assertContains(sql, 'orders.status', 'Should filter by order status');
  runner.assertContains(sql, 'WHERE', 'Should have WHERE clause');
  runner.assertContains(sql, 'EXISTS', 'Should check order_items existence');
  runner.assertContains(sql, 'NOT EXISTS', 'Should check order_refunds absence');
});

// Test mixed single and composite keys
runner.test('Mixed single key and composite key whereHas', () => {
  const q = query('users')
    .whereHas('transactions', 'user_id', 'id')
    .whereHas('orders', ['user_id', 'organization_id'], ['id', 'org_id']);

  const sql = q.toSql();
  
  runner.assertContains(sql, 'transactions.user_id = users.id', 'Should handle single key');
  runner.assertContains(sql, 'orders.user_id = users.id', 'Should handle composite key first column');
  runner.assertContains(sql, 'orders.organization_id = users.org_id', 'Should handle composite key second column');
});

// Test whereHas with nested conditions and composite keys
runner.test('whereHas with nested conditions using composite keys', () => {
  const q = query('orders')
    .whereHas('order_items', ['order_id', 'store_id'], ['id', 'store_id'], function(subq) {
      subq.where('quantity', '>', 0);
      subq.where('status', 'active');
      subq.orWhere('priority', 'high');
    });

  const sql = q.toSql();
  
  runner.assertContains(sql, 'order_items.order_id = orders.id', 'Should match first composite key');
  runner.assertContains(sql, 'order_items.store_id = orders.store_id', 'Should match second composite key');
  runner.assertContains(sql, 'quantity', 'Should contain quantity condition');
  runner.assertContains(sql, 'status', 'Should contain status condition');
  runner.assertContains(sql, 'priority', 'Should contain priority condition');
});

// Run all tests
runner.run().then(success => {
  if (!success) {
    process.exit(1);
  }
});
