/**
 * Test QueryBuilder has() method with callback support
 * Run: node tests/queryBuilder-has-callback.test.js
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
    console.log('\n🧪 Running QueryBuilder has() Callback Tests...\n');

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

// Test has() without callback (simple existence)
runner.test('has() without callback - simple existence check', () => {
  const q = query('users')
    .has('transactions', 'user_id', 'id');

  const sql = q.toSql();
  
  runner.assertContains(sql, 'WHERE EXISTS', 'Should contain WHERE EXISTS');
  runner.assertContains(sql, 'SELECT 1 FROM transactions', 'Should select 1 from transactions');
  runner.assertContains(sql, 'transactions.user_id = users.id', 'Should match foreign key to local key');
});

// Test has() with count but no callback
runner.test('has() with count but no callback', () => {
  const q = query('users')
    .has('transactions', 'user_id', 'id', '>=', 5);

  const sql = q.toSql();
  const params = q.getParameters();
  
  runner.assertContains(sql, 'WHERE', 'Should contain WHERE clause');
  runner.assertContains(sql, 'SELECT COUNT(*) FROM transactions', 'Should have COUNT subquery');
  runner.assertContains(sql, 'transactions.user_id = users.id', 'Should match keys');
  runner.assertEqual(params[0], 5, 'Should have count parameter');
});

// Test has() with exact count (=)
runner.test('has() with exact count operator', () => {
  const q = query('users')
    .has('reviews', 'user_id', 'id', '=', 3);

  const sql = q.toSql();
  const params = q.getParameters();
  
  runner.assertContains(sql, 'COUNT(*)', 'Should have COUNT');
  runner.assertEqual(params[0], 3, 'Should have count parameter of 3');
});

// Test has() with callback for filtering
runner.test('has() with callback - filters related records', () => {
  const q = query('users')
    .has('transactions', 'user_id', 'id', '>=', 5, function(subq) {
      subq.where('status', 'completed');
      subq.where('amount', '>', 1000);
    });

  const sql = q.toSql();
  const params = q.getParameters();
  
  runner.assertContains(sql, 'COUNT(*)', 'Should have COUNT subquery');
  runner.assertContains(sql, 'transactions.user_id = users.id', 'Should match keys');
  runner.assertContains(sql, 'status', 'Should contain status filter');
  runner.assertContains(sql, 'amount', 'Should contain amount filter');
  
  // Parameters: 'completed', 1000, 5 (count)
  runner.assertEqual(params.length, 3, 'Should have 3 parameters');
  runner.assertEqual(params[0], 'completed', 'First param should be completed');
  runner.assertEqual(params[1], 1000, 'Second param should be 1000');
  runner.assertEqual(params[2], 5, 'Third param should be 5');
});

// Test has() with callback but default count (>=1)
runner.test('has() with callback and default count', () => {
  const q = query('users')
    .has('transactions', 'user_id', 'id', '>=', 1, function(subq) {
      subq.where('status', 'completed');
    });

  const sql = q.toSql();
  
  // This should behave like whereHas
  runner.assertContains(sql, 'WHERE EXISTS', 'Should use EXISTS for count >= 1');
  runner.assertContains(sql, 'status', 'Should contain status filter from callback');
});

// Test has() with composite keys and callback
runner.test('has() with composite keys and callback', () => {
  const q = query('orders')
    .has('order_items', ['order_id', 'store_id'], ['id', 'store_id'], '>=', 3, function(subq) {
      subq.where('quantity', '>', 0);
      subq.where('status', 'active');
    });

  const sql = q.toSql();
  
  runner.assertContains(sql, 'COUNT(*)', 'Should have COUNT subquery');
  runner.assertContains(sql, 'order_items.order_id = orders.id', 'Should match first composite key');
  runner.assertContains(sql, 'order_items.store_id = orders.store_id', 'Should match second composite key');
  runner.assertContains(sql, 'quantity', 'Should contain quantity filter');
  runner.assertContains(sql, 'status', 'Should contain status filter');
});

// Test multiple has() with callbacks
runner.test('Multiple has() calls with different callbacks', () => {
  const q = query('users')
    .has('transactions', 'user_id', 'id', '>=', 5, function(subq) {
      subq.where('status', 'completed');
    })
    .has('reviews', 'user_id', 'id', '>=', 2, function(subq) {
      subq.where('rating', '>=', 4);
    });

  const sql = q.toSql();
  const params = q.getParameters();
  
  runner.assertContains(sql, 'transactions', 'Should reference transactions');
  runner.assertContains(sql, 'reviews', 'Should reference reviews');
  runner.assertContains(sql, 'status', 'Should have status filter');
  runner.assertContains(sql, 'rating', 'Should have rating filter');
  
  // Should have parameters: 'completed', 5, 4, 2
  runner.assertEqual(params.length, 4, 'Should have 4 parameters');
});

// Test has() with callback and different operators
runner.test('has() with callback and < operator', () => {
  const q = query('users')
    .has('failed_logins', 'user_id', 'id', '<', 3, function(subq) {
      subq.where('created_at', '>', '2025-01-01');
    });

  const sql = q.toSql();
  const params = q.getParameters();
  
  runner.assertContains(sql, 'COUNT(*)', 'Should have COUNT subquery');
  runner.assertContains(sql, 'created_at', 'Should have date filter from callback');
  runner.assertEqual(params[1], 3, 'Should compare count < 3');
});

// Test has() with complex nested conditions in callback
runner.test('has() with complex nested conditions in callback', () => {
  const q = query('users')
    .has('transactions', 'user_id', 'id', '>=', 10, function(subq) {
      subq.where('status', 'completed');
      subq.group(function(innerq) {
        innerq.where('amount', '>', 1000)
              .orWhere('priority', 'high');
      });
    });

  const sql = q.toSql();
  
  runner.assertContains(sql, 'COUNT(*)', 'Should have COUNT');
  runner.assertContains(sql, 'status', 'Should have status filter');
  runner.assertContains(sql, 'amount', 'Should have amount filter');
  runner.assertContains(sql, 'priority', 'Should have priority filter');
});

// Run all tests
runner.run().then(success => {
  if (!success) {
    process.exit(1);
  }
});
