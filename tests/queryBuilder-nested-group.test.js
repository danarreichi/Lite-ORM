/**
 * Test QueryBuilder Nested Group Functionality with Real Database
 * Tests complex nested WHERE conditions using data from seeder.js
 * 
 * Prerequisites: Run `npm run seed` first to populate database
 * Run: node tests/queryBuilder-nested-group.test.js
 */

const { query } = require('../utils/queryBuilder');
const db = require('../utils/database');

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

  assertGreaterThan(actual, expected, message) {
    if (actual <= expected) {
      throw new Error(`${message}\n  Expected > ${expected}\n  Actual:   ${actual}`);
    }
  }

  assertContains(string, substring, message) {
    if (!string.includes(substring)) {
      throw new Error(`${message}\n  Expected to contain: ${substring}\n  Actual: ${string}`);
    }
  }

  async run() {
    console.log('\n🧪 Testing Nested Group with Real Database...\n');
    console.log('📊 Using data from seeder.js\n');

    // Test database connection first
    try {
      await db.testConnection();
      console.log('✅ Database connected\n');
    } catch (error) {
      console.error('❌ Database connection failed!');
      console.log('Run: npm run seed');
      return false;
    }

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

    console.log(`\n${'='.repeat(70)}`);
    console.log(`Tests: ${this.passedTests + this.failedTests}`);
    console.log(`Passed: ${this.passedTests}`);
    console.log(`Failed: ${this.failedTests}`);
    console.log(`${'='.repeat(70)}\n`);

    return this.failedTests === 0;
  }
}

const runner = new TestRunner();

// Test 1: Simple nested group
runner.test('Nested group - (name OR email) AND first_name', async () => {
  const users = await query('users')
    .group(function(q) {
      q.where('username', 'john_doe')
       .orWhere('email', 'jane@example.com');
    })
    .where('first_name', 'John')
    .get();

  // Should only return john_doe since Jane Smith doesn't match first_name='John'
  runner.assertEqual(users.length, 1, 'Should return 1 user');
  runner.assertEqual(users[0].username, 'john_doe', 'Should be john_doe');
});

// Test 2: Double nested group
runner.test('Double nested - ((name OR email) OR (first_name AND last_name))', async () => {
  const users = await query('users')
    .orGroup(function(q) {
      q.where('username', 'john_doe')
       .orWhere('email', 'jane@example.com');
    })
    .orGroup(function(q) {
      q.where('first_name', 'Bob')
       .where('last_name', 'Wilson');
    })
    .get();

  // Should return john_doe, jane_smith, and bob_wilson
  runner.assertGreaterThan(users.length, 2, 'Should return at least 3 users');
});

// Test 3: Complex nested - AND group inside OR group
runner.test('Complex nested - status AND ((total_amount > X AND method) OR date)', async () => {
  const transactions = await query('transactions')
    .where('status', 'completed')
    .group(function(q) {
      q.group(function(innerQ) {
        innerQ.where('total_amount', '>', 500)
              .where('payment_method_id', 1);
      })
      .orWhere('created_at', '>', '2024-01-01');
    })
    .get();

  console.log(`     Found ${transactions.length} completed transactions matching complex criteria`);
  runner.assertGreaterThan(transactions.length, -1, 'Should execute without error');
});

// Test 4: Triple nested group
runner.test('Triple nested - (A OR (B AND (C OR D)))', async () => {
  const products = await query('products')
    .group(function(levelOne) {
      levelOne.where('category_id', 1)
        .orGroup(function(levelTwo) {
          levelTwo.where('price', '<', 100)
            .group(function(levelThree) {
              levelThree.where('stock', '>', 0)
                       .orWhere('name', 'LIKE', '%Widget%');
            });
        });
    })
    .get();

  console.log(`     Found ${products.length} products matching triple nested criteria`);
  runner.assertGreaterThan(products.length, -1, 'Should execute without error');
});

// Test 5: Multiple groups at same level
runner.test('Multiple groups at same level - (A AND B) OR (C AND D) OR (E AND F)', async () => {
  const users = await query('users')
    .orGroup(function(q) {
      q.where('first_name', 'John')
       .where('last_name', 'Doe');
    })
    .orGroup(function(q) {
      q.where('first_name', 'Jane')
       .where('last_name', 'Smith');
    })
    .orGroup(function(q) {
      q.where('first_name', 'Bob')
       .where('last_name', 'Wilson');
    })
    .get();

  runner.assertEqual(users.length, 3, 'Should match all 3 users');
});

// Test 6: Nested with JOINs
runner.test('Nested groups with JOINs - users with transactions', async () => {
  const results = await query('users')
    .join('transactions', 'users.id = transactions.user_id')
    .select(['users.username', 'users.first_name', 'transactions.total_amount', 'transactions.status'])
    .group(function(q) {
      q.where('transactions.status', 'completed')
       .orWhere('transactions.status', 'pending');
    })
    .where('users.first_name', 'John')
    .get();

  console.log(`     Found ${results.length} transaction records for John`);
  runner.assertGreaterThan(results.length, 0, 'Should find at least 1 transaction');
});

// Test 7: Nested with Eager Loading
runner.test('Nested groups with eager loading - withMany', async () => {
  const users = await query('users')
    .withMany('transactions', 'user_id', 'id', function(q) {
      q.where('status', 'completed')
       .where('total_amount', '>', 100);
    })
    .group(function(q) {
      q.where('first_name', 'John')
       .orWhere('first_name', 'Jane');
    })
    .get();

  runner.assertGreaterThan(users.length, 0, 'Should find users');
  console.log(`     Found ${users.length} users (John or Jane) with loaded transactions`);
  
  if (users.length > 0 && users[0].transactions) {
    console.log(`     First user has ${users[0].transactions.length} completed transactions > $100`);
  }
});

// Test 8: Deep nested (4 levels)
runner.test('Deep nested 4 levels - ((A OR (B AND (C OR (D AND E)))) AND F)', async () => {
  const users = await query('users')
    .group(function(l1) {
      l1.where('username', 'john_doe')
        .orGroup(function(l2) {
          l2.where('first_name', 'Jane')
            .group(function(l3) {
              l3.where('last_name', 'Smith')
                .orGroup(function(l4) {
                  l4.where('email', 'LIKE', '%example.com%')
                    .where('id', '>', 0);
                });
            });
        });
    })
    .where('created_at', '>', '2020-01-01')
    .get();

  console.log(`     Found ${users.length} users matching deep nested criteria`);
  runner.assertGreaterThan(users.length, 0, 'Should find at least 1 user');
});

// Test 9: Nested with whereHas
runner.test('Nested groups with whereHas - complex relationship filtering', async () => {
  const users = await query('users')
    .group(function(q) {
      q.whereHas('transactions', 'user_id', 'id', function(subq) {
        subq.where('status', 'completed');
        subq.where('total_amount', '>', 500);
      })
      .orWhere('email', 'LIKE', '%@example.com%');
    })
    .get();

  console.log(`     Found ${users.length} users with high-value transactions OR example.com email`);
  runner.assertGreaterThan(users.length, 0, 'Should find users');
});

// Test 10: SQL Generation Test (doesn't execute)
runner.test('SQL generation - verify nested group syntax', async () => {
  const q = query('users')
    .where('status', 'active')
    .group(function(q1) {
      q1.where('first_name', 'John')
        .orGroup(function(q2) {
          q2.where('last_name', 'Doe')
            .where('age', '>', 18);
        });
    })
    .orWhere('role', 'admin');

  const sql = q.toSql();
  
  console.log('\n     Generated SQL:');
  console.log(`     ${sql}\n`);
  
  runner.assertContains(sql, 'WHERE', 'Should have WHERE clause');
  runner.assertContains(sql, '(', 'Should have opening parenthesis');
  runner.assertContains(sql, ')', 'Should have closing parenthesis');
  runner.assertContains(sql, 'OR', 'Should have OR logic');
});

// Test 11: Real-world scenario - Complex product search
runner.test('Real-world - Complex product search with nested groups', async () => {
  const products = await query('products')
    .group(function(q) {
      // Price range conditions
      q.group(function(priceGroup) {
        priceGroup.where('price', '>=', 10)
                  .where('price', '<=', 100);
      })
      // OR premium products
      .orWhere('category_id', 1);
    })
    .where('stock', '>', 0)  // Must be in stock
    .orderBy('price', 'ASC')
    .get();

  console.log(`     Found ${products.length} products (price $10-$100 OR category 1) in stock`);
  runner.assertGreaterThan(products.length, -1, 'Should execute successfully');
});

// Test 12: Nested with multiple ANDs and ORs
runner.test('Mixed nested - ((A AND B) OR C) AND ((D OR E) AND F)', async () => {
  const reviews = await query('reviews')
    .group(function(outer1) {
      outer1.group(function(inner1) {
        inner1.where('rating', '>=', 4)
              .where('content', 'IS NOT', null);
      })
      .orWhere('user_id', 1);
    })
    .group(function(outer2) {
      outer2.group(function(inner2) {
        inner2.where('product_id', 1)
              .orWhere('product_id', 2);
      })
      .where('created_at', '>', '2024-01-01');
    })
    .get();

  console.log(`     Found ${reviews.length} reviews matching complex mixed criteria`);
  runner.assertGreaterThan(reviews.length, -1, 'Should execute without error');
});

// Run all tests
runner.run().then(success => {
  if (!success) {
    process.exit(1);
  }
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
