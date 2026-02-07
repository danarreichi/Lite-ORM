# QueryBuilder Test Suite

This directory contains tests for the `utils/queryBuilder.js` module.

## Prerequisites

Before running tests, ensure:

1. **MySQL is running** locally
2. **Database is seeded** with test data

```bash
# Seed the database first
npm run seed
```

## Running Tests

```bash
# Run all queryBuilder tests
npm test

# Or run specific test files
node tests/queryBuilder.test.js
node tests/queryBuilder-composite-whereHas.test.js
node tests/queryBuilder-has-callback.test.js
node tests/queryBuilder-nested-group.test.js
```

## Test Coverage

The test suite validates:

### ✅ Basic Queries
- SELECT (all columns, specific columns, distinct)
- INSERT (with auto-increment ID)
- UPDATE (with WHERE conditions)
- DELETE (with WHERE conditions)

### ✅ WHERE Conditions
- Equality (`where('column', 'value')`)
- Operators (`where('column', '>', value)`)
- IN / NOT IN
- OR WHERE
- Grouped conditions

### ✅ EXISTS Subqueries
- WHERE EXISTS
- WHERE NOT EXISTS
- OR WHERE EXISTS
- OR WHERE NOT EXISTS

### ✅ Relationship Existence Filtering (Laravel-style)
- `whereHas()` - Filter by relationship existence with conditions
- `orWhereHas()` - OR variant
- `whereDoesntHave()` - Filter by relationship absence
- `orWhereDoesntHave()` - OR variant
- `has()` - Simple existence check with count support
- `doesntHave()` - Simple absence check
- Composite keys support (multiple columns)
- Nested conditions in callbacks

### ✅ Eager Loading
- `withMany()` - Load has-many relationships
- `withOne()` - Load has-one/belongs-to relationships
- Custom relation names
- Nested eager loading (relations within relations)
- Composite keys (multiple columns)
- Multiple foreign keys (e.g., order_items)

### ✅ Aggregate Functions
- `withSum()` - Sum of related column
- `withCount()` - Count of related records
- `withAvg()` - Average of related column
- `withMax()` - Maximum value
- `withMin()` - Minimum value
- Custom aliases
- Multiple aggregates on same query
- Composite key aggregates

### ✅ Aggregate Filtering
- Auto-detection of aggregate aliases in WHERE
- Mixed normal + aggregate WHERE conditions
- Complex filtering scenarios

### ✅ LIKE and Search
- `like()` - Pattern matching
- `search()` - Multiple columns with AND
- `orSearch()` - Multiple columns with OR
- Side options (both, before, after)

### ✅ JOINs
- INNER JOIN
- LEFT JOIN
- RIGHT JOIN

### ✅ Clauses
- GROUP BY
- HAVING
- ORDER BY (ASC/DESC)
- LIMIT
- OFFSET

### ✅ Utility Methods
- `first()` - Get first row
- `value()` - Get single column value
- `count()` - Get row count

### ✅ Chunking
- `chunk()` - Offset-based pagination
- `chunkById()` - ID-based pagination (more efficient)
- Early termination support

### ✅ Advanced Features
- Composite primary keys
- Multiple foreign key matching
- Debugging (`toSql()`, `getParameters()`)

## Test Files

### `queryBuilder.test.js`
Main test suite covering all core functionality:
- Basic queries (SELECT, INSERT, UPDATE, DELETE)
- WHERE conditions and operators
- Eager loading (withMany, withOne)
- Aggregate functions (withSum, withCount, etc.)
- Aggregate filtering
- LIKE and search operations
- JOINs, GROUP BY, ORDER BY
- Chunking methods
- Utility methods

### `queryBuilder-composite-whereHas.test.js`
Specialized tests for relationship existence filtering with composite keys:
- `whereHas()` with single and composite keys
- `whereDoesntHave()` with composite keys
- `orWhereHas()` and `orWhereDoesntHave()`
- Complex queries mixing multiple whereHas conditions
- Nested conditions with composite keys

### `queryBuilder-has-callback.test.js`
Tests for `has()` method with callback support:
- Simple existence checks without callback
- Count-based filtering with various operators (>=, =, <)
- Callback support for filtering related records before counting
- Composite keys with callbacks
- Complex nested conditions in callbacks
- Multiple `has()` calls with different callbacks

### `queryBuilder-nested-group.test.js`
Integration tests for nested group logic with seeded data:
- Group inside group (nested parentheses)
- Multiple OR groups at same level
- Deep nesting (4 levels)
- Nested groups with joins and eager loading
- Nested groups combined with `whereHas()`

## Test Data

Tests use the sample data from `seeder.js`:

- **3 users**: john_doe, jane_smith, bob_wilson
- **4 transactions** with various statuses
- **10 transaction details** linked to transactions
- **4 payment methods** and histories
- **3 categories** and **5 products**
- **6 reviews** (demonstrates 2 foreign keys)
- **8 user_product_favorites** (demonstrates composite primary key)
- **3 stores**, **6 orders**, **12 order_items** (demonstrates multiple foreign key matching)

## Expected Results

When all tests pass, you should see:

```
✅ Passed: 80+
❌ Failed: 0
📈 Success Rate: 100.00%

🎉 All tests passed! QueryBuilder is working correctly.
```

## Troubleshooting

### "MySQL connection failed"
- Ensure MySQL server is running
- Check credentials in `seeder.js` dbConfig
- Verify port 3306 is available

### "Table doesn't exist"
```bash
# Re-run the seeder
npm run seed
```

### "Tests fail after refactoring"
1. STOP immediately
2. Revert your changes
3. Review the failing test output
4. Fix the issue or adjust approach
5. Commit only after tests pass

## Adding New Tests

When adding tests, follow this pattern:

```javascript
async function testNewFeature() {
  const result = await query('table_name')
    .someMethod()
    .get();
  
  assert(condition, 'Test description');
  assertEquals(result.field, expectedValue, 'Test description');
}

// Then add to runAllTests():
await testNewFeature();
```

## Test Principles (from refactoring-code skill)

- ✅ Tests verify behavior preservation
- ✅ Tests run before every refactoring
- ✅ Tests run after every refactoring
- ✅ Each test is independent and isolated
- ✅ Tests use real database (integration tests)
- ✅ Tests clean up after themselves (INSERT/UPDATE/DELETE tests)

## Next Steps

After all tests pass:
1. Review `docs/queryBuilder-refactoring-plan.md`
2. Follow Phase 1 refactoring steps
3. Run tests after each small change
4. Commit only when tests pass

---

**For more information:** See the refactoring plan in `docs/queryBuilder-refactoring-plan.md`
