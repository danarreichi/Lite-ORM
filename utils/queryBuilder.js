const db = require('./database');

/**
 * RawSql class - Marks SQL values that should not be parameterized
 * 
 * ⚠️ SECURITY WARNING: NEVER use with user input!
 * RawSql bypasses SQL injection protection. Only use with:
 * - Column references (e.g., new RawSql('table.column'))
 * - Trusted SQL expressions from your code
 * - Never with any user-controlled data
 * 
 * @example
 * // SAFE - column reference
 * query('users').where('created_at', new RawSql('updated_at'))
 * 
 * // DANGEROUS - user input
 * query('users').where('id', new RawSql(userInput)) // ❌ NEVER DO THIS!
 */
class RawSql {
  constructor(value) {
    if (typeof value !== 'string') {
      throw new TypeError('RawSql value must be a string');
    }
    this.value = value;
  }
}

/**
 * QueryBuilder class - Fluent SQL query builder similar to CodeIgniter 3 Active Record
 * Provides a fluent interface for building SQL queries with method chaining.
 *
 * @example
 * const { query } = require('./queryBuilder');
 *
 * // Basic usage
 * const users = await query('users')
 *   .select(['id', 'name', 'email'])
 *   .where('status', 'active')
 *   .orderBy('created_at', 'DESC')
 *   .limit(10)
 *   .get();
 */
class QueryBuilder {
  // Private fields
  #query;
  #parameters;
  #executor;

  /**
   * Creates a new QueryBuilder instance
   */
  constructor(executor = db) {
    this.#executor = executor;
    this.#reset();
  }

  /**
   * Reset query state to initial values
   * @private
   */
  #reset() {
    this.#query = {
      type: null,
      table: null,
      select: '*',
      distinct: false,
      joins: [],
      where: [],
      groupBy: [],
      having: [],
      orderBy: [],
      limit: null,
      offset: null,
      set: null,
      values: null,
      upsertUpdate: null,
      with: [],
      aggregates: [],
      autoAddedColumns: [] // Track columns auto-added for relationships
    };
    this.#parameters = [];
    return this;
  }

  /**
   * Specify columns to select in SELECT queries
   * @param {string|string[]} columns - Column names to select (default: '*')
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   *
   * @example
   * query('users').select(['id', 'name']) // SELECT id, name FROM users
   * query('users').select('COUNT(*) as total') // SELECT COUNT(*) as total FROM users
   */
  select(columns = '*') {
    this.#query.type = 'SELECT';
    if (columns === '*' && this.#query.aggregates.length > 0) {
      // Keep '*' but we'll add aggregates in buildSql
      this.#query.select = columns;
    } else {
      this.#query.select = Array.isArray(columns) ? columns.join(', ') : columns;
    }
    return this;
  }

  /**
   * Add DISTINCT keyword to SELECT queries
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   *
   * @example
   * query('users').distinct().select('email').get() // SELECT DISTINCT email FROM users
   */
  distinct() {
    this.#query.distinct = true;
    return this;
  }

  /**
   * Specify the table to query (usually set by factory function)
   * @param {string} table - Table name
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   */
  from(table) {
    if (typeof table !== 'string' || table.trim().length === 0) {
      throw new Error('Table name must be a non-empty string');
    }
    // Validate table name format (alphanumeric, dots, underscores, backticks only)
    if (!/^[a-zA-Z0-9_.`]+$/.test(table)) {
      throw new Error('Invalid table name format');
    }
    this.#query.table = table;
    return this;
  }

  /**
   * Validate column identifiers to prevent SQL injection via identifiers
   * @private
   * @param {string} column - Column name to validate
   * @param {string} context - Context for error messages
   */
  #validateColumnName(column, context) {
    if (typeof column !== 'string' || column.trim().length === 0) {
      throw new Error(`${context} column name must be a non-empty string`);
    }

    // Allow only simple identifiers: table.column, backticks, underscores
    if (!/^[a-zA-Z0-9_.`]+$/.test(column)) {
      throw new Error(`Invalid ${context} column name`);
    }
  }

  /**
   * Validate SQL operator against allowed list
   * @private
   * @param {string} operator - Operator to validate
   * @param {string[]} validOperators - Allowed operators
   */
  #validateOperator(operator, validOperators) {
    if (!validOperators.includes(operator)) {
      throw new Error(`Invalid operator: ${operator}`);
    }
  }

  /**
   * Add WHERE condition with aggregate alias auto-detection
   * @private
   * @param {string} column - Column name or aggregate alias
   * @param {string} operator - Comparison operator
   * @param {any} value - Comparison value
   * @param {'AND'|'OR'} logicType - Condition logic type
   */
  #addWhereCondition(column, operator, value, logicType) {
    const aggregate = this.#query.aggregates.find(agg => agg.alias === column);

    if (aggregate) {
      this.#query.where.push(this.#buildAggregateSubquery(aggregate, operator, value, logicType));
    } else {
      this.#query.where.push({ column, operator, value, type: logicType });
    }
  }

  /**
   * Add WHERE condition with AND logic
   * @param {string} column - Column name
   * @param {string|any} operator - Operator or value (if value is null, operator becomes value)
   * @param {any} [value] - Value to compare against
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   *
   * @example
   * query('users').where('id', 1) // WHERE id = 1
   * query('users').where('age', '>', 18) // WHERE age > 18
   * query('users').where('status', 'active') // WHERE status = 'active'
   * 
   * // Auto-detect aggregate aliases
   * query('users')
   *   .withSum({'transactions': 'total_spent'}, 'user_id', 'id', 'amount')
   *   .where('total_spent', '>', 10000)
   *   .get();
   */
  where(column, operator = null, value = null) {
    this.#validateColumnName(column, 'WHERE');

    if (value === null && operator !== null) {
      // where('column', 'value')
      value = operator;
      operator = '=';
    }

    const validOperators = ['=', '!=', '<>', '>', '<', '>=', '<=', 'LIKE', 'NOT LIKE', 'IS', 'IS NOT'];
    this.#validateOperator(operator, validOperators);
    this.#addWhereCondition(column, operator, value, 'AND');

    return this;
  }

  /**
   * Add WHERE condition comparing two columns
   * @param {string} firstColumn - Left column name
   * @param {string} [operator='='] - Comparison operator
   * @param {string} secondColumn - Right column name
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   *
   * @example
   * query('users').whereColumn('created_at', '>=', 'updated_at')
   */
  whereColumn(firstColumn, operator = '=', secondColumn) {
    this.#validateColumnName(firstColumn, 'WHERE');
    this.#validateColumnName(secondColumn, 'WHERE');

    const validOperators = ['=', '!=', '<>', '>', '<', '>=', '<='];
    this.#validateOperator(operator, validOperators);

    this.#query.where.push({
      column: firstColumn,
      operator,
      value: new RawSql(secondColumn),
      type: 'AND'
    });
    return this;
  }

  /**
   * Add OR WHERE condition comparing two columns
   * @param {string} firstColumn - Left column name
   * @param {string} [operator='='] - Comparison operator
   * @param {string} secondColumn - Right column name
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   */
  orWhereColumn(firstColumn, operator = '=', secondColumn) {
    this.#validateColumnName(firstColumn, 'WHERE');
    this.#validateColumnName(secondColumn, 'WHERE');

    const validOperators = ['=', '!=', '<>', '>', '<', '>=', '<='];
    this.#validateOperator(operator, validOperators);

    this.#query.where.push({
      column: firstColumn,
      operator,
      value: new RawSql(secondColumn),
      type: 'OR'
    });
    return this;
  }

  /**
   * Add WHERE column IS NULL condition
   * @param {string} column - Column name
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   *
   * @example
   * query('users').whereNull('deleted_at') // WHERE deleted_at IS NULL
   */
  whereNull(column) {
    this.#validateColumnName(column, 'WHERE');
    this.#query.where.push({ column, operator: 'IS', value: null, type: 'AND' });
    return this;
  }

  /**
   * Add OR WHERE column IS NULL condition
   * @param {string} column - Column name
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   */
  orWhereNull(column) {
    this.#validateColumnName(column, 'WHERE');
    this.#query.where.push({ column, operator: 'IS', value: null, type: 'OR' });
    return this;
  }

  /**
   * Add WHERE column IS NOT NULL condition
   * @param {string} column - Column name
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   *
   * @example
   * query('users').whereNotNull('deleted_at') // WHERE deleted_at IS NOT NULL
   */
  whereNotNull(column) {
    this.#validateColumnName(column, 'WHERE');
    this.#query.where.push({ column, operator: 'IS NOT', value: null, type: 'AND' });
    return this;
  }

  /**
   * Add OR WHERE column IS NOT NULL condition
   * @param {string} column - Column name
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   */
  orWhereNotNull(column) {
    this.#validateColumnName(column, 'WHERE');
    this.#query.where.push({ column, operator: 'IS NOT', value: null, type: 'OR' });
    return this;
  }

  /**
   * Add WHERE condition with OR logic
   * @param {string} column - Column name
   * @param {string|any} operator - Operator or value
   * @param {any} [value] - Value to compare against
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   *
   * @example
   * query('users').where('status', 'active').orWhere('role', 'admin')
   * 
   * // Auto-detect aggregate aliases
   * query('users')
   *   .withSum({'transactions': 'total_spent'}, 'user_id', 'id', 'amount')
   *   .where('status', 'active')
   *   .orWhere('total_spent', '>', 10000)
   *   .get();
   */
  orWhere(column, operator = null, value = null) {
    this.#validateColumnName(column, 'WHERE');

    if (value === null && operator !== null) {
      value = operator;
      operator = '=';
    }

    const validOperators = ['=', '!=', '<>', '>', '<', '>=', '<=', 'LIKE', 'NOT LIKE', 'IS', 'IS NOT'];
    this.#validateOperator(operator, validOperators);
    this.#addWhereCondition(column, operator, value, 'OR');

    return this;
  }

  /**
   * Add WHERE IN condition
   * @param {string} column - Column name
   * @param {any[]} values - Array of values to check against
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   *
   * @example
   * query('users').whereIn('id', [1, 2, 3]) // WHERE id IN (1, 2, 3)
   */
  whereIn(column, values) {
    this.#validateColumnName(column, 'WHERE');
    if (!Array.isArray(values)) {
      throw new Error('whereIn() requires an array of values');
    }
    if (values.length === 0) {
      // WHERE column IN () is invalid SQL - use FALSE condition (1 = 0)
      this.#query.where.push({ column: '1', operator: '=', value: 0, type: 'AND' });
      return this;
    }
    this.#query.where.push({ column, operator: 'IN', value: values, type: 'AND' });
    return this;
  }

  /**
   * Add WHERE NOT IN condition
   * @param {string} column - Column name
   * @param {any[]} values - Array of values to exclude
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   */
  whereNotIn(column, values) {
    this.#validateColumnName(column, 'WHERE');
    if (!Array.isArray(values)) {
      throw new Error('whereNotIn() requires an array of values');
    }
    if (values.length === 0) {
      // WHERE column NOT IN () is always true - skip condition
      return this;
    }
    this.#query.where.push({ column, operator: 'NOT IN', value: values, type: 'AND' });
    return this;
  }

  /**
   * Add WHERE BETWEEN condition
   * @param {string} column - Column name
   * @param {any[]} values - Array with two values [start, end]
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   *
   * @example
   * query('transactions').whereBetween('total_amount', [100, 500])
   */
  whereBetween(column, values) {
    this.#validateColumnName(column, 'WHERE');
    if (!Array.isArray(values) || values.length !== 2) {
      throw new Error('whereBetween() requires an array of two values');
    }
    this.#query.where.push({ column, operator: 'BETWEEN', value: values, type: 'AND' });
    return this;
  }

  /**
   * Add WHERE NOT BETWEEN condition
   * @param {string} column - Column name
   * @param {any[]} values - Array with two values [start, end]
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   */
  whereNotBetween(column, values) {
    this.#validateColumnName(column, 'WHERE');
    if (!Array.isArray(values) || values.length !== 2) {
      throw new Error('whereNotBetween() requires an array of two values');
    }
    this.#query.where.push({ column, operator: 'NOT BETWEEN', value: values, type: 'AND' });
    return this;
  }

  /**
   * Add OR WHERE BETWEEN condition
   * @param {string} column - Column name
   * @param {any[]} values - Array with two values [start, end]
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   */
  orWhereBetween(column, values) {
    this.#validateColumnName(column, 'WHERE');
    if (!Array.isArray(values) || values.length !== 2) {
      throw new Error('orWhereBetween() requires an array of two values');
    }
    this.#query.where.push({ column, operator: 'BETWEEN', value: values, type: 'OR' });
    return this;
  }

  /**
   * Add OR WHERE NOT BETWEEN condition
   * @param {string} column - Column name
   * @param {any[]} values - Array with two values [start, end]
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   */
  orWhereNotBetween(column, values) {
    this.#validateColumnName(column, 'WHERE');
    if (!Array.isArray(values) || values.length !== 2) {
      throw new Error('orWhereNotBetween() requires an array of two values');
    }
    this.#query.where.push({ column, operator: 'NOT BETWEEN', value: values, type: 'OR' });
    return this;
  }

  /**
   * Start a grouped condition with AND logic (callback-based)
   * @param {function} callback - Function that receives the QueryBuilder instance
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   * @throws {Error} If callback is not a function
   *
   * @example
   * query('users').group(q => {
   *   q.where('name', 'John').orWhere('email', 'john@example.com');
   * }).where('status', 'active')
   * // WHERE (name = 'John' OR email = 'john@example.com') AND status = 'active'
   */
  group(callback) {
    if (typeof callback !== 'function') {
      throw new Error('group() requires a callback function');
    }
    this.#query.where.push({ type: 'GROUP_START', groupType: 'AND' });
    callback(this);
    this.#query.where.push({ type: 'GROUP_END' });
    return this;
  }

  /**
   * Start a grouped condition with OR logic (callback-based)
   * @param {function} callback - Function that receives the QueryBuilder instance
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   * @throws {Error} If callback is not a function
   *
   * @example
   * query('users')
   *   .orGroup(q => {
   *     q.where('status', 'active').where('role', 'admin');
   *   })
   *   .orGroup(q => {
   *     q.where('status', 'pending').where('created_at', '>', '2024-01-01');
   *   })
   * // WHERE (status = 'active' AND role = 'admin') OR (status = 'pending' AND created_at > '2024-01-01')
   */
  orGroup(callback) {
    if (typeof callback !== 'function') {
      throw new Error('orGroup() requires a callback function');
    }
    this.#query.where.push({ type: 'GROUP_START', groupType: 'OR' });
    callback(this);
    this.#query.where.push({ type: 'GROUP_END' });
    return this;
  }

  /**
   * Add WHERE EXISTS subquery with relation
   * @param {string} relatedTable - The related table name
   * @param {string|string[]} foreignKey - Foreign key column(s) in related table (string or array for composite keys)
   * @param {string|string[]} localKey - Local key column(s) (defaults to 'id', string or array for composite keys)
   * @param {function} [callback] - Optional callback to add conditions to the subquery
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   *
   * @example
   * query('users').whereExistsRelation('transactions', 'user_id', 'id', function(q) {
   *   q.where('status', 'completed');
   * })
   * // WHERE EXISTS (SELECT 1 FROM transactions WHERE transactions.user_id = users.id AND status = 'completed')
   * 
   * @example
   * // Composite keys
   * query('orders').whereExistsRelation('order_items', ['order_id', 'store_id'], ['id', 'store_id'])
   */
  whereExistsRelation(relatedTable, foreignKey, localKey = 'id', callback = null) {
    this.#query.where.push(this.#buildExistsSubquery(relatedTable, foreignKey, localKey, 'EXISTS', callback));
    return this;
  }

  /**
   * Add OR WHERE EXISTS subquery with relation
   * @param {string} relatedTable - The related table name
   * @param {string|string[]} foreignKey - Foreign key column(s) in related table (string or array for composite keys)
   * @param {string|string[]} localKey - Local key column(s) (defaults to 'id', string or array for composite keys)
   * @param {function} [callback] - Optional callback to add conditions to the subquery
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   *
   * @example
   * query('users').where('status', 'active').orWhereExistsRelation('transactions', 'user_id', 'id')
   * // WHERE status = 'active' OR EXISTS (SELECT 1 FROM transactions WHERE transactions.user_id = users.id)
   * 
   * @example
   * // Composite keys
   * query('orders').orWhereExistsRelation('order_items', ['order_id', 'store_id'], ['id', 'store_id'])
   */
  orWhereExistsRelation(relatedTable, foreignKey, localKey = 'id', callback = null) {
    this.#query.where.push(this.#buildExistsSubquery(relatedTable, foreignKey, localKey, 'OR_EXISTS', callback));
    return this;
  }

  /**
   * Add WHERE NOT EXISTS subquery with relation
   * @param {string} relatedTable - The related table name
   * @param {string|string[]} foreignKey - Foreign key column(s) in related table (string or array for composite keys)
   * @param {string|string[]} localKey - Local key column(s) (defaults to 'id', string or array for composite keys)
   * @param {function} [callback] - Optional callback to add conditions to the subquery
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   *
   * @example
   * query('users').whereNotExistsRelation('transactions', 'user_id', 'id')
   * // WHERE NOT EXISTS (SELECT 1 FROM transactions WHERE transactions.user_id = users.id)
   * 
   * @example
   * // Composite keys
   * query('orders').whereNotExistsRelation('order_items', ['order_id', 'store_id'], ['id', 'store_id'])
   */
  whereNotExistsRelation(relatedTable, foreignKey, localKey = 'id', callback = null) {
    this.#query.where.push(this.#buildExistsSubquery(relatedTable, foreignKey, localKey, 'NOT_EXISTS', callback));
    return this;
  }

  /**
   * Add OR WHERE NOT EXISTS subquery with relation
   * @param {string} relatedTable - The related table name
   * @param {string|string[]} foreignKey - Foreign key column(s) in related table (string or array for composite keys)
   * @param {string|string[]} localKey - Local key column(s) (defaults to 'id', string or array for composite keys)
   * @param {function} [callback] - Optional callback to add conditions to the subquery
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   *
   * @example
   * query('users').where('status', 'active').orWhereNotExistsRelation('banned_users', 'user_id', 'id')
   * // WHERE status = 'active' OR NOT EXISTS (SELECT 1 FROM banned_users WHERE banned_users.user_id = users.id)
   * 
   * @example
   * // Composite keys
   * query('orders').orWhereNotExistsRelation('order_items', ['order_id', 'store_id'], ['id', 'store_id'])
   */
  orWhereNotExistsRelation(relatedTable, foreignKey, localKey = 'id', callback = null) {
    this.#query.where.push(this.#buildExistsSubquery(relatedTable, foreignKey, localKey, 'OR_NOT_EXISTS', callback));
    return this;
  }

  /**
   * Filter by the existence of a relationship (Laravel-style)
   * Alias for whereExistsRelation() with more familiar Laravel naming
   * 
   * @param {string} relatedTable - The related table name
   * @param {string|string[]} foreignKey - Foreign key column(s) in related table (string or array for composite keys)
   * @param {string|string[]} localKey - Local key column(s) (defaults to 'id', string or array for composite keys)
   * @param {function} [callback] - Optional callback to add conditions to the subquery
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   *
   * @example
   * // Users who have at least one completed transaction
   * query('users').whereHas('transactions', 'user_id', 'id', function(q) {
   *   q.where('status', 'completed');
   * })
   * 
   * @example
   * // Users who have any transactions
   * query('users').whereHas('transactions', 'user_id', 'id')
   * 
   * @example
   * // Composite keys - Orders that have items (sharded by store)
   * query('orders').whereHas('order_items', ['order_id', 'store_id'], ['id', 'store_id'], function(q) {
   *   q.where('quantity', '>', 0);
   * })
   */
  whereHas(relatedTable, foreignKey, localKey = 'id', callback = null) {
    return this.whereExistsRelation(relatedTable, foreignKey, localKey, callback);
  }

  /**
   * Filter by the existence of a relationship with OR logic (Laravel-style)
   * Alias for orWhereExistsRelation()
   * 
   * @param {string} relatedTable - The related table name
   * @param {string|string[]} foreignKey - Foreign key column(s) in related table (string or array for composite keys)
   * @param {string|string[]} localKey - Local key column(s) (defaults to 'id', string or array for composite keys)
   * @param {function} [callback] - Optional callback to add conditions to the subquery
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   *
   * @example
   * query('users')
   *   .where('status', 'active')
   *   .orWhereHas('transactions', 'user_id', 'id')
   * 
   * @example
   * // Composite keys
   * query('orders')
   *   .where('status', 'pending')
   *   .orWhereHas('order_items', ['order_id', 'store_id'], ['id', 'store_id'])
   */
  orWhereHas(relatedTable, foreignKey, localKey = 'id', callback = null) {
    return this.orWhereExistsRelation(relatedTable, foreignKey, localKey, callback);
  }

  /**
   * Filter by the absence of a relationship (Laravel-style)
   * Alias for whereNotExistsRelation()
   * 
   * @param {string} relatedTable - The related table name
   * @param {string|string[]} foreignKey - Foreign key column(s) in related table (string or array for composite keys)
   * @param {string|string[]} localKey - Local key column(s) (defaults to 'id', string or array for composite keys)
   * @param {function} [callback] - Optional callback to add conditions to the subquery
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   *
   * @example
   * // Users who have no transactions
   * query('users').whereDoesntHave('transactions', 'user_id', 'id')
   * 
   * @example
   * // Users who have no completed transactions
   * query('users').whereDoesntHave('transactions', 'user_id', 'id', function(q) {
   *   q.where('status', 'completed');
   * })
   * 
   * @example
   * // Composite keys - Orders without items
   * query('orders').whereDoesntHave('order_items', ['order_id', 'store_id'], ['id', 'store_id'])
   */
  whereDoesntHave(relatedTable, foreignKey, localKey = 'id', callback = null) {
    return this.whereNotExistsRelation(relatedTable, foreignKey, localKey, callback);
  }

  /**
   * Filter by the absence of a relationship with OR logic (Laravel-style)
   * Alias for orWhereNotExistsRelation()
   * 
   * @param {string} relatedTable - The related table name
   * @param {string|string[]} foreignKey - Foreign key column(s) in related table (string or array for composite keys)
   * @param {string|string[]} localKey - Local key column(s) (defaults to 'id', string or array for composite keys)
   * @param {function} [callback] - Optional callback to add conditions to the subquery
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   *
   * @example
   * query('users')
   *   .where('status', 'inactive')
   *   .orWhereDoesntHave('transactions', 'user_id', 'id')
   * 
   * @example
   * // Composite keys
   * query('orders')
   *   .where('status', 'cancelled')
   *   .orWhereDoesntHave('order_items', ['order_id', 'store_id'], ['id', 'store_id'])
   */
  orWhereDoesntHave(relatedTable, foreignKey, localKey = 'id', callback = null) {
    return this.orWhereNotExistsRelation(relatedTable, foreignKey, localKey, callback);
  }

  /**
   * Filter records that have a relationship (simple existence check)
   * Shorthand for whereHas() without conditions - checks if relationship exists
   * Can also accept count operator to check relationship count
   * 
   * @param {string} relatedTable - The related table name
   * @param {string|string[]} foreignKey - Foreign key column(s) in related table (string or array for composite keys)
   * @param {string|string[]} localKey - Local key column(s) (defaults to 'id', string or array for composite keys)
   * @param {string} [operator='>='] - Comparison operator (>=, >, =, <, <=)
   * @param {number} [count=1] - Minimum count of related records
   * @param {function} [callback] - Optional callback to filter related records before counting
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   *
   * @example
   * // Users who have at least one transaction
   * query('users').has('transactions', 'user_id', 'id')
   * 
   * @example
   * // Users who have at least 5 transactions
   * query('users').has('transactions', 'user_id', 'id', '>=', 5)
   * 
   * @example
   * // Users who have exactly 3 completed transactions
   * query('users').has('transactions', 'user_id', 'id', '=', 3, function(q) {
   *   q.where('status', 'completed');
   * })
   * 
   * @example
   * // Users who have at least 10 high-value transactions
   * query('users').has('transactions', 'user_id', 'id', '>=', 10, function(q) {
   *   q.where('amount', '>', 1000);
   *   q.where('status', 'completed');
   * })
   */
  has(relatedTable, foreignKey, localKey = 'id', operator = '>=', count = 1, callback = null) {
    if (operator === '>=' && count === 1 && !callback) {
      // Simple existence check without callback
      return this.whereHas(relatedTable, foreignKey, localKey);
    }
    
    // If callback provided or custom count, use whereHas with callback
    if (callback || operator !== '>=' || count !== 1) {
      // For custom count, wrap the callback to ensure proper filtering
      if (operator === '>=' && count === 1) {
        // Simple has with callback
        return this.whereHas(relatedTable, foreignKey, localKey, callback);
      }
      
      // Count-based check using aggregate subquery
      const aggregate = {
        type: 'COUNT',
        relatedTable: relatedTable,
        foreignKey: foreignKey,
        localKey: localKey,
        column: '*',
        alias: `__temp_${relatedTable}_count`,
        callback: callback
      };
      
      // Add to where using aggregate subquery builder
      this.#query.where.push(this.#buildAggregateSubquery(aggregate, operator, count, 'AND'));
      
      return this;
    }
    
    return this;
  }

  /**
   * Filter records that don't have a relationship (simple non-existence check)
   * Shorthand for whereDoesntHave() without conditions
   * 
   * @param {string} relatedTable - The related table name
   * @param {string|string[]} foreignKey - Foreign key column(s) in related table (string or array for composite keys)
   * @param {string|string[]} localKey - Local key column(s) (defaults to 'id', string or array for composite keys)
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   *
   * @example
   * // Users who have no transactions
   * query('users').doesntHave('transactions', 'user_id', 'id')
   */
  doesntHave(relatedTable, foreignKey, localKey = 'id') {
    return this.whereDoesntHave(relatedTable, foreignKey, localKey);
  }

  /**
   * Parse relation name from string or object format
   * @private
   * @param {string|object} relation - Table name or {table: name} mapping
   * @returns {{relatedTable: string, relationName: string}}
   */
  #parseRelationName(relation) {
    if (typeof relation === 'string') {
      return { relatedTable: relation, relationName: relation };
    } else {
      const relatedTable = Object.keys(relation)[0];
      const relationName = relation[relatedTable];
      return { relatedTable, relationName };
    }
  }

  /**
   * Eager load has-many relationship (one-to-many)
   * Uses two-query approach to load related records efficiently
   * 
   * @param {string|object} relation - Table name (string) or object mapping {relatedTable: relationName}
   * @param {string|string[]} foreignKey - Foreign key column(s) in related table (string or array for composite keys)
   * @param {string|string[]} [localKey='id'] - Local key column(s) (defaults to 'id', string or array for composite keys)
   * @param {function} [callback] - Optional callback to add conditions to the related query
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   *
   * @example
   * // Shorthand - table name as relation name
   * const users = await query('users')
   *   .withMany('transactions', 'user_id', 'id')
   *   .get();
   * // users[0].transactions = [{...}, {...}]
   * 
   * @example
   * // Custom relation name
   * const users = await query('users')
   *   .withMany({'transactions': 'completedTransactions'}, 'user_id', 'id', function(q) {
   *     q.where('status', 'completed');
   *   })
   *   .get();
   * // users[0].completedTransactions = [{...}, {...}]
   * 
   * @example
   * // Composite keys (multiple columns)
   * const orders = await query('orders')
   *   .withMany('order_items', ['order_id', 'store_id'], ['id', 'store_id'])
   *   .get();
   * // orders[0].order_items = [{...}, {...}]
   */
  withMany(relation, foreignKey, localKey = 'id', callback = null) {
    const { relatedTable, relationName } = this.#parseRelationName(relation);

    this.#query.with.push({
      type: 'hasMany',
      relationName,
      relatedTable,
      foreignKey,
      localKey,
      callback
    });
    return this;
  }

  /**
   * Eager load has-one relationship (one-to-one or belongs-to)
   * Uses two-query approach to load single related record efficiently
   * 
   * @param {string|object} relation - Table name (string) or object mapping {relatedTable: relationName}
   * @param {string|string[]} foreignKey - Foreign key column(s) in related table (string or array for composite keys)
   * @param {string|string[]} [localKey='id'] - Local key column(s) (defaults to 'id', string or array for composite keys)
   * @param {function} [callback] - Optional callback to add conditions to the related query
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   *
   * @example
   * // Shorthand - table name as relation name
   * const users = await query('users')
   *   .withOne('profile', 'user_id', 'id')
   *   .get();
   * // users[0].profile = {...}
   * 
   * @example
   * // Custom relation name
   * const transactions = await query('transactions')
   *   .withOne({'users': 'buyer'}, 'id', 'user_id')
   *   .get();
   * // transactions[0].buyer = {...}
   * 
   * @example
   * // Composite keys (multiple columns)
   * const transactions = await query('transactions')
   *   .withOne('transaction_details', ['transaction_id', 'item_id'], ['id', 'primary_item_id'])
   *   .get();
   * // transactions[0].transaction_details = {...}
   */
  withOne(relation, foreignKey, localKey = 'id', callback = null) {
    const { relatedTable, relationName } = this.#parseRelationName(relation);

    this.#query.with.push({
      type: 'hasOne',
      relationName,
      relatedTable,
      foreignKey,
      localKey,
      callback
    });
    return this;
  }

  /**
   * Parse aggregate alias from string or object format
   * @private
   * @param {string|object} relatedTable - Table name or {table: alias} mapping
   * @param {string|null} column - Column name (for auto-alias generation, null for COUNT)
   * @param {string} aggregateType - SUM, COUNT, AVG, MAX, MIN
   * @returns {{table: string, alias: string}}
   */
  #parseAggregateAlias(relatedTable, column, aggregateType) {
    if (typeof relatedTable === 'string') {
      let alias;
      if (aggregateType === 'COUNT') {
        alias = `${relatedTable}_count`;
      } else {
        alias = `${relatedTable}_${column}_${aggregateType.toLowerCase()}`;
      }
      return { table: relatedTable, alias };
    } else {
      const table = Object.keys(relatedTable)[0];
      const alias = relatedTable[table];
      return { table, alias };
    }
  }

  /**
   * Register aggregate definition for SELECT subquery aggregate
   * @private
   * @param {'SUM'|'COUNT'|'AVG'|'MAX'|'MIN'} aggregateType - Aggregate type
   * @param {string|object} relatedTable - Table name or {table: alias}
   * @param {string|string[]} foreignKey - Related table foreign key(s)
   * @param {string|string[]} localKey - Current table local key(s)
   * @param {string|null} column - Aggregate column (null for COUNT)
   * @param {function|null} callback - Optional related query callback
   * @returns {QueryBuilder} QueryBuilder instance
   */
  #registerAggregate(aggregateType, relatedTable, foreignKey, localKey, column, callback = null) {
    const { table, alias } = this.#parseAggregateAlias(relatedTable, column, aggregateType);

    this.#query.aggregates.push({
      type: aggregateType,
      relatedTable: table,
      foreignKey,
      localKey,
      column: aggregateType === 'COUNT' ? '*' : column,
      alias,
      callback
    });

    return this;
  }

  /**
   * Build aggregate subquery for WHERE filtering
   * @private
   * @param {object} aggregate - Aggregate definition object
   * @param {string} operator - Comparison operator (e.g., '>', '>=', '=')
   * @param {any} value - Value to compare against
   * @param {string} logicType - 'AND' or 'OR'
   * @returns {object} WHERE condition object with aggregate subquery
   */
  #buildAggregateSubquery(aggregate, operator, value, logicType) {
    const subQuery = new QueryBuilder(this.#executor);
    subQuery.from(aggregate.relatedTable);

    // Handle composite keys (arrays) or single key
    if (Array.isArray(aggregate.foreignKey)) {
      const foreignKeys = aggregate.foreignKey;
      const localKeys = Array.isArray(aggregate.localKey) ? aggregate.localKey : [aggregate.localKey];

      if (foreignKeys.length !== localKeys.length) {
        throw new Error('Foreign keys and local keys must have the same length for composite keys');
      }

      // Add multiple WHERE conditions for composite keys
      foreignKeys.forEach((fk, i) => {
        subQuery.where(`${aggregate.relatedTable}.${fk}`, new RawSql(`${this.#query.table}.${localKeys[i]}`));
      });
    } else {
      subQuery.where(`${aggregate.relatedTable}.${aggregate.foreignKey}`, new RawSql(`${this.#query.table}.${aggregate.localKey}`));
    }

    // Apply callback if provided in aggregate definition
    if (aggregate.callback && typeof aggregate.callback === 'function') {
      aggregate.callback(subQuery);
    }

    // Build aggregate function
    const aggFunc = aggregate.type === 'COUNT' ? 'COUNT(*)' : `${aggregate.type}(${aggregate.column})`;
    subQuery.#query.select = aggFunc;
    subQuery.#query.type = 'SELECT';

    return {
      type: 'AGGREGATE_SUBQUERY',
      subQuery: subQuery,
      operator: operator,
      value: value,
      logicType: logicType
    };
  }

  /**
   * Build EXISTS subquery for whereExists methods
   * Supports both single keys and composite keys (arrays)
   * @private
   * @param {string} relatedTable - Related table name
   * @param {string|string[]} foreignKey - Foreign key(s) in related table (string or array for composite keys)
   * @param {string|string[]} localKey - Local key(s) in current table (string or array for composite keys)
   * @param {string} type - EXISTS type ('EXISTS', 'OR_EXISTS', 'NOT_EXISTS', 'OR_NOT_EXISTS')
   * @param {function|null} callback - Optional callback for additional conditions
   * @returns {object} WHERE condition object with EXISTS subquery
   */
  #buildExistsSubquery(relatedTable, foreignKey, localKey, type, callback) {
    const subQuery = new QueryBuilder(this.#executor);
    subQuery.select('1').from(relatedTable);
    
    // Handle composite keys (arrays) or single key
    if (Array.isArray(foreignKey)) {
      const foreignKeys = foreignKey;
      const localKeys = Array.isArray(localKey) ? localKey : [localKey];

      if (foreignKeys.length !== localKeys.length) {
        throw new Error(`Foreign keys and local keys must have the same length for composite keys`);
      }

      // Add multiple WHERE conditions for composite keys
      foreignKeys.forEach((fk, i) => {
        subQuery.where(`${relatedTable}.${fk}`, new RawSql(`${this.#query.table}.${localKeys[i]}`));
      });
    } else {
      // Single key
      subQuery.where(`${relatedTable}.${foreignKey}`, new RawSql(`${this.#query.table}.${localKey}`));
    }

    // Add additional conditions if callback provided
    if (callback && typeof callback === 'function') {
      callback(subQuery);
    }

    return {
      type: type,
      subQuery: subQuery,
      relation: { relatedTable, foreignKey, localKey }
    };
  }

  /**
   * Add SUM aggregate for related table
   * @param {string|object} relatedTable - Table name (string) or object mapping {table: alias}
   * @param {string|string[]} foreignKey - Foreign key(s) in related table (string or array for composite keys)
   * @param {string|string[]} localKey - Local key(s) in current table (string or array for composite keys)
   * @param {string} column - Column to sum
   * @param {function} [callback] - Optional callback to filter related records
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   *
   * @example
   * // Standard syntax - auto alias
   * const users = await query('users')
   *   .withSum('transactions', 'user_id', 'id', 'amount')
   *   .get();
   * // users[0].transactions_amount_sum = 15000
   * 
   * @example
   * // Object syntax with custom alias
   * const users = await query('users')
   *   .withSum({'transactions': 'total_spent'}, 'user_id', 'id', 'amount', function(q) {
   *     q.where('status', 'completed');
   *   })
   *   .get();
   * // users[0].total_spent = 15000
   * 
   * @example
   * // Composite keys (multiple columns)
   * const orders = await query('orders')
   *   .withSum('order_items', ['order_id', 'store_id'], ['id', 'store_id'], 'total_price')
   *   .get();
   * // orders[0].order_items_total_price_sum = 299.99
   */
  withSum(relatedTable, foreignKey, localKey, column, callback = null) {
    return this.#registerAggregate('SUM', relatedTable, foreignKey, localKey, column, callback);
  }

  /**
   * Add COUNT aggregate for related table
   * @param {string|object} relatedTable - Table name (string) or object mapping {table: alias}
   * @param {string|string[]} foreignKey - Foreign key(s) in related table (string or array for composite keys)
   * @param {string|string[]} localKey - Local key(s) in current table (string or array for composite keys)
   * @param {function} [callback] - Optional callback to filter related records
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   *
   * @example
   * // Standard syntax - auto alias
   * const users = await query('users')
   *   .withCount('transactions', 'user_id', 'id')
   *   .get();
   * // users[0].transactions_count = 5
   * 
   * @example
   * // Object syntax with custom alias
   * const users = await query('users')
   *   .withCount({'transactions': 'total_transactions'}, 'user_id', 'id', function(q) {
   *     q.where('status', 'completed');
   *   })
   *   .get();
   * // users[0].total_transactions = 5
   * 
   * @example
   * // Composite keys (multiple columns)
   * const orders = await query('orders')
   *   .withCount('order_items', ['order_id', 'store_id'], ['id', 'store_id'])
   *   .get();
   * // orders[0].order_items_count = 3
   */
  withCount(relatedTable, foreignKey, localKey, callback = null) {
    return this.#registerAggregate('COUNT', relatedTable, foreignKey, localKey, null, callback);
  }

  /**
   * Add AVG aggregate for related table
   * @param {string|object} relatedTable - Table name (string) or object mapping {table: alias}
   * @param {string|string[]} foreignKey - Foreign key(s) in related table (string or array for composite keys)
   * @param {string|string[]} localKey - Local key(s) in current table (string or array for composite keys)
   * @param {string} column - Column to average
   * @param {function} [callback] - Optional callback to filter related records
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   *
   * @example
   * // Standard syntax - auto alias
   * const users = await query('users')
   *   .withAvg('transactions', 'user_id', 'id', 'amount')
   *   .get();
   * // users[0].transactions_amount_avg = 3000
   * 
   * @example
   * // Object syntax with custom alias
   * const users = await query('users')
   *   .withAvg({'transactions': 'avg_amount'}, 'user_id', 'id', 'amount', function(q) {
   *     q.where('status', 'completed');
   *   })
   *   .get();
   * // users[0].avg_amount = 3000
   * 
   * @example
   * // Composite keys (multiple columns)
   * const orders = await query('orders')
   *   .withAvg('order_items', ['order_id', 'store_id'], ['id', 'store_id'], 'unit_price')
   *   .get();
   * // orders[0].order_items_unit_price_avg = 49.99
   */
  withAvg(relatedTable, foreignKey, localKey, column, callback = null) {
    return this.#registerAggregate('AVG', relatedTable, foreignKey, localKey, column, callback);
  }

  /**
   * Add MAX aggregate for related table
   * @param {string|object} relatedTable - Table name (string) or object mapping {table: alias}
   * @param {string|string[]} foreignKey - Foreign key(s) in related table (string or array for composite keys)
   * @param {string|string[]} localKey - Local key(s) in current table (string or array for composite keys)
   * @param {string} column - Column to get maximum value
   * @param {function} [callback] - Optional callback to filter related records
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   *
   * @example
   * // Standard syntax - auto alias
   * const users = await query('users')
   *   .withMax('transactions', 'user_id', 'id', 'amount')
   *   .get();
   * // users[0].transactions_amount_max = 10000
   * 
   * @example
   * // Object syntax with custom alias
   * const users = await query('users')
   *   .withMax({'transactions': 'largest_transaction'}, 'user_id', 'id', 'amount', function(q) {
   *     q.where('status', 'completed');
   *   })
   *   .get();
   * // users[0].largest_transaction = 10000
   * 
   * @example
   * // Composite keys (multiple columns)
   * const orders = await query('orders')
   *   .withMax('order_items', ['order_id', 'store_id'], ['id', 'store_id'], 'total_price')
   *   .get();
   * // orders[0].order_items_total_price_max = 199.99
   */
  withMax(relatedTable, foreignKey, localKey, column, callback = null) {
    return this.#registerAggregate('MAX', relatedTable, foreignKey, localKey, column, callback);
  }

  /**
   * Add MIN aggregate for related table
   * @param {string|object} relatedTable - Table name (string) or object mapping {table: alias}
   * @param {string|string[]} foreignKey - Foreign key(s) in related table (string or array for composite keys)
   * @param {string|string[]} localKey - Local key(s) in current table (string or array for composite keys)
   * @param {string} column - Column to get minimum value
   * @param {function} [callback] - Optional callback to filter related records
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   *
   * @example
   * // Standard syntax - auto alias
   * const users = await query('users')
   *   .withMin('transactions', 'user_id', 'id', 'amount')
   *   .get();
   * // users[0].transactions_amount_min = 100
   * 
   * @example
   * // Object syntax with custom alias
   * const users = await query('users')
   *   .withMin({'transactions': 'smallest_transaction'}, 'user_id', 'id', 'amount', function(q) {
   *     q.where('status', 'completed');
   *   })
   *   .get();
   * // users[0].smallest_transaction = 100
   * 
   * @example
   * // Composite keys (multiple columns)
   * const orders = await query('orders')
   *   .withMin('order_items', ['order_id', 'store_id'], ['id', 'store_id'], 'unit_price')
   *   .get();
   * // orders[0].order_items_unit_price_min = 12.99
   */
  withMin(relatedTable, foreignKey, localKey, column, callback = null) {
    return this.#registerAggregate('MIN', relatedTable, foreignKey, localKey, column, callback);
  }

  /**
   * Escape special LIKE characters
   * @private
   * @param {string} value - Value to escape
   * @returns {string} Escaped value
   */
  #escapeLikePattern(value) {
    return String(value)
      .replace(/\\/g, '\\\\')
      .replace(/%/g, '\\%')
      .replace(/_/g, '\\_');
  }

  /**
   * Create LIKE pattern for search operations
   * @private
   * @param {string} value - Search value
   * @param {string} side - Pattern side: 'both', 'before', 'after'
   * @returns {string} LIKE pattern
   */
  #createLikePattern(value, side) {
    const escaped = this.#escapeLikePattern(value);
    if (side === 'before') return `%${escaped}`;
    if (side === 'after') return `${escaped}%`;
    return `%${escaped}%`;
  }

  /**
   * Add LIKE condition with AND logic
   * @param {string} column - Column name
   * @param {string} value - Search value
   * @param {string} [side='both'] - Pattern placement: 'both', 'before', 'after'
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   *
   * @example
   * query('users').like('name', 'John') // WHERE name LIKE '%John%'
   * query('users').like('name', 'John', 'after') // WHERE name LIKE 'John%'
   */
  like(column, value, side = 'both') {
    this.#validateColumnName(column, 'LIKE');
    const pattern = this.#createLikePattern(value, side);
    this.#query.where.push({ column, operator: 'LIKE', value: pattern, type: 'AND' });
    return this;
  }

  /**
   * Add LIKE condition with OR logic
   * @param {string} column - Column name
   * @param {string} value - Search value
   * @param {string} [side='both'] - Pattern placement
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   */
  orLike(column, value, side = 'both') {
    this.#validateColumnName(column, 'LIKE');
    const pattern = this.#createLikePattern(value, side);
    this.#query.where.push({ column, operator: 'LIKE', value: pattern, type: 'OR' });
    return this;
  }

  /**
   * Search multiple columns with AND logic between columns
   * @param {string|string[]} columns - Column names to search
   * @param {string} value - Search value
   * @param {string} [side='both'] - Pattern placement
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   *
   * @example
   * query('users').search(['name', 'email'], 'john')
   * // WHERE name LIKE '%john%' AND email LIKE '%john%'
   */
  search(columns, value, side = 'both') {
    if (!Array.isArray(columns)) {
      columns = [columns];
    }

    columns.forEach(column => this.#validateColumnName(column, 'SEARCH'));

    columns.forEach((column, index) => {
      const pattern = this.#createLikePattern(value, side);
      const conditionType = index === 0 ? 'AND' : 'OR';
      this.#query.where.push({ column, operator: 'LIKE', value: pattern, type: conditionType });
    });
    return this;
  }

  /**
   * Search multiple columns with OR logic between columns
   * @param {string|string[]} columns - Column names to search
   * @param {string} value - Search value
   * @param {string} [side='both'] - Pattern placement
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   *
   * @example
   * query('users').orSearch(['name', 'email'], 'john')
   * // WHERE name LIKE '%john%' OR email LIKE '%john%'
   */
  orSearch(columns, value, side = 'both') {
    if (!Array.isArray(columns)) {
      columns = [columns];
    }

    columns.forEach(column => this.#validateColumnName(column, 'SEARCH'));

    columns.forEach(column => {
      const pattern = this.#createLikePattern(value, side);
      this.#query.where.push({ column, operator: 'LIKE', value: pattern, type: 'OR' });
    });
    return this;
  }

  /**
   * Add JOIN clause
   * @param {string} table - Table to join
   * @param {string} condition - Join condition
   * @param {string} [type='INNER'] - Join type: 'INNER', 'LEFT', 'RIGHT'
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   *
   * @example
   * query('users').join('posts', 'users.id = posts.user_id')
   * query('users').leftJoin('profiles', 'users.id = profiles.user_id')
   */
  join(table, condition, type = 'INNER') {
    this.#query.joins.push({ table, condition, type });
    return this;
  }

  /**
   * Add LEFT JOIN clause
   * @param {string} table - Table to join
   * @param {string} condition - Join condition
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   */
  leftJoin(table, condition) {
    return this.join(table, condition, 'LEFT');
  }

  /**
   * Add RIGHT JOIN clause
   * @param {string} table - Table to join
   * @param {string} condition - Join condition
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   */
  rightJoin(table, condition) {
    return this.join(table, condition, 'RIGHT');
  }

  /**
   * Add GROUP BY clause
   * @param {string|string[]} columns - Column names to group by
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   *
   * @example
   * query('users').select(['status', 'COUNT(*) as count']).groupBy('status')
   */
  groupBy(columns) {
    const colArray = Array.isArray(columns) ? columns : [columns];
    
    // Validate each column name
    colArray.forEach(col => {
      if (typeof col !== 'string' || !/^[a-zA-Z0-9_.`]+$/.test(col)) {
        throw new Error(`Invalid GROUP BY column: ${col}`);
      }
    });
    
    this.#query.groupBy = colArray;
    return this;
  }

  /**
   * Add HAVING condition
   * @param {string} column - Column name
   * @param {string|any} operator - Operator or value
   * @param {any} [value] - Value to compare against
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   */
  having(column, operator = null, value = null) {
    this.#validateColumnName(column, 'HAVING');
    if (value === null && operator !== null) {
      value = operator;
      operator = '=';
    }

    this.#query.having.push({ column, operator, value, type: 'AND' });
    return this;
  }

  /**
   * Add ORDER BY clause
   * @param {string} column - Column name to order by
   * @param {string} [direction='ASC'] - Sort direction: 'ASC' or 'DESC'
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   *
   * @example
   * query('users').orderBy('created_at', 'DESC').orderBy('name', 'ASC')
   */
  orderBy(column, direction = 'ASC') {
    // Validate column name (alphanumeric, dots, underscores, backticks only)
    if (typeof column !== 'string' || !/^[a-zA-Z0-9_.`]+$/.test(column)) {
      throw new Error('Invalid ORDER BY column name');
    }
    
    // Validate direction
    const validDirections = ['ASC', 'DESC'];
    const upperDirection = String(direction).toUpperCase();
    if (!validDirections.includes(upperDirection)) {
      throw new Error('ORDER BY direction must be ASC or DESC');
    }
    
    this.#query.orderBy.push({ column, direction: upperDirection });
    return this;
  }

  /**
   * Add LIMIT clause
   * @param {number} value - Maximum number of records to return
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   */
  limit(value) {
    const numValue = parseInt(value, 10);
    if (!Number.isInteger(numValue) || numValue < 0) {
      throw new Error('LIMIT must be a non-negative integer');
    }
    this.#query.limit = numValue;
    return this;
  }

  /**
   * Add OFFSET clause
   * @param {number} value - Number of records to skip
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   */
  offset(value) {
    const numValue = parseInt(value, 10);
    if (!Number.isInteger(numValue) || numValue < 0) {
      throw new Error('OFFSET must be a non-negative integer');
    }
    this.#query.offset = numValue;
    return this;
  }

  /**
   * Prepare INSERT query
   * @param {object} data - Data to insert (column-value pairs)
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   *
   * @example
   * query('users').insert({name: 'John', email: 'john@example.com'}).execute()
   */
  insert(data) {
    this.#query.type = 'INSERT';
    const { table, ...insertData } = data;
    if (table) this.#query.table = table;
    this.#query.set = insertData;
    return this;
  }

  /**
   * Prepare INSERT MANY query (bulk insert)
   * @param {object[]} rows - Array of row objects to insert
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   *
   * @example
   * query('users').insertMany([
   *   { username: 'a', email: 'a@example.com' },
   *   { username: 'b', email: 'b@example.com' }
   * ]).execute()
   */
  insertMany(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('insertMany() requires a non-empty array of rows');
    }

    this.#query.type = 'INSERT';

    const normalizedRows = rows.map((row, index) => {
      if (!row || typeof row !== 'object') {
        throw new Error(`insertMany() row ${index} must be an object`);
      }
      const { table, ...rowData } = row;
      if (table) {
        if (!this.#query.table) {
          this.#query.table = table;
        } else if (this.#query.table !== table) {
          throw new Error('insertMany() rows must target the same table');
        }
      }
      return rowData;
    });

    const baseColumns = Object.keys(normalizedRows[0]);
    if (baseColumns.length === 0) {
      throw new Error('insertMany() requires row data');
    }

    normalizedRows.forEach((row, index) => {
      const rowColumns = Object.keys(row);
      if (rowColumns.length !== baseColumns.length || !baseColumns.every(col => rowColumns.includes(col))) {
        throw new Error(`insertMany() row ${index} must have the same columns`);
      }
    });

    this.#query.values = normalizedRows;
    this.#query.set = null;
    return this;
  }

  /**
   * Prepare UPDATE query
   * @param {object} data - Data to update (column-value pairs)
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   *
   * @example
   * query('users').update({status: 'active'}).where('id', 1).execute()
   */
  update(data) {
    this.#query.type = 'UPDATE';
    const { table, ...updateData } = data;
    if (table) this.#query.table = table;
    this.#query.set = updateData;
    return this;
  }

  /**
   * Prepare UPSERT query (INSERT ... ON DUPLICATE KEY UPDATE)
   * @param {object} data - Data to insert (column-value pairs)
   * @param {object|null} [updateData=null] - Data to update on duplicate (defaults to data)
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   *
   * @example
   * query('users')
   *   .upsert({ id: 1, username: 'john', email: 'john@example.com' }, { email: 'new@example.com' })
   *   .execute();
   */
  upsert(data, updateData = null) {
    if (!data || typeof data !== 'object') {
      throw new Error('upsert() requires a data object');
    }

    this.#query.type = 'UPSERT';
    const { table, ...insertData } = data;
    if (table) this.#query.table = table;

    const insertEntries = Object.entries(insertData)
      .filter(([, value]) => value !== undefined);

    if (insertEntries.length === 0) {
      throw new Error('upsert() requires insert data');
    }

    const normalizedInsertData = Object.fromEntries(insertEntries);
    const updates = updateData === null ? normalizedInsertData : updateData;
    if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
      throw new Error('upsert() requires update data');
    }

    this.#query.set = normalizedInsertData;
    this.#query.upsertUpdate = updates;
    return this;
  }

  /**
   * Prepare DELETE query
   * @param {string} [table] - Optional table name override
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   *
   * @example
   * query('users').delete().where('id', 1).execute()
   */
  delete(table = null) {
    this.#query.type = 'DELETE';
    if (table) this.#query.table = table;
    return this;
  }

  /**
   * Build WHERE clause from conditions array
   * @private
   * @returns {string} WHERE clause SQL
   */
  buildWhere() {
    if (this.#query.where.length === 0) return '';

    let sql = ' WHERE ';
    let groupLevel = 0;
    let conditionsInGroup = [0]; // Track conditions per group level

    this.#query.where.forEach((condition, index) => {
      if (condition.type === 'RAW') {
        // Handle raw SQL conditions (for composite keys)
        if (conditionsInGroup[groupLevel] > 0) {
          sql += ' AND ';
        }
        conditionsInGroup[groupLevel]++;
        sql += condition.sql;
        this.#parameters.push(...condition.values);
      } else if (condition.type === 'GROUP_START') {
        // Add AND/OR before group if not the first condition in current group
        if (conditionsInGroup[groupLevel] > 0) {
          sql += ` ${condition.groupType || 'AND'} `;
        }
        conditionsInGroup[groupLevel]++;
        sql += '(';
        groupLevel++;
        conditionsInGroup.push(0);
      } else if (condition.type === 'GROUP_END') {
        sql += ')';
        groupLevel--;
        conditionsInGroup.pop();
      } else if (condition.type === 'EXISTS' || condition.type === 'OR_EXISTS' ||
        condition.type === 'NOT_EXISTS' || condition.type === 'OR_NOT_EXISTS') {
        // Add AND/OR if this is not the first condition in current group
        if (conditionsInGroup[groupLevel] > 0) {
          // Determine if this is an OR condition
          const isOr = condition.type === 'OR_EXISTS' || condition.type === 'OR_NOT_EXISTS';
          sql += isOr ? ' OR ' : ' AND ';
        }
        conditionsInGroup[groupLevel]++;

        // Build the EXISTS subquery
        const subSql = condition.subQuery.buildSql();
        const isNegated = condition.type === 'NOT_EXISTS' || condition.type === 'OR_NOT_EXISTS';
        sql += isNegated ? `NOT EXISTS (${subSql})` : `EXISTS (${subSql})`;
        // Add subquery parameters to main parameters array
        this.#parameters.push(...condition.subQuery.#parameters);
      } else if (condition.type === 'AGGREGATE_SUBQUERY') {
        // Add AND/OR if this is not the first condition in current group
        if (conditionsInGroup[groupLevel] > 0) {
          sql += condition.logicType === 'OR' ? ' OR ' : ' AND ';
        }
        conditionsInGroup[groupLevel]++;

        // Build the aggregate subquery
        const subSql = condition.subQuery.buildSql();
        sql += `(${subSql}) ${condition.operator} ?`;
        // Add subquery parameters to main parameters array
        this.#parameters.push(...condition.subQuery.#parameters);
        // Add comparison value
        this.#parameters.push(condition.value);
      } else {
        // Regular condition
        // Add AND/OR if this is not the first condition in current group
        if (conditionsInGroup[groupLevel] > 0) {
          sql += ` ${condition.type} `;
        }
        conditionsInGroup[groupLevel]++;

        if (condition.operator === 'IN' || condition.operator === 'NOT IN') {
          const placeholders = condition.value.map(() => '?').join(', ');
          sql += `${condition.column} ${condition.operator} (${placeholders})`;
          this.#parameters.push(...condition.value);
        } else if (condition.operator === 'BETWEEN' || condition.operator === 'NOT BETWEEN') {
          sql += `${condition.column} ${condition.operator} ? AND ?`;
          this.#parameters.push(condition.value[0], condition.value[1]);
        } else if (condition.value instanceof RawSql) {
          // For raw SQL values (like column references), use directly without parameterizing
          sql += `${condition.column} ${condition.operator} ${condition.value.value}`;
        } else if ((condition.operator === 'IS' || condition.operator === 'IS NOT') && condition.value === null) {
          sql += `${condition.column} ${condition.operator} NULL`;
        } else {
          sql += `${condition.column} ${condition.operator} ?`;
          this.#parameters.push(condition.value);
        }
      }
    });

    return sql;
  }

  /**
   * Build HAVING clause from conditions array
   * @private
   * @returns {string} HAVING clause SQL
   */
  buildHaving() {
    if (this.#query.having.length === 0) return '';

    let sql = ' HAVING ';
    this.#query.having.forEach((condition, index) => {
      if (index > 0) {
        sql += ` ${condition.type} `;
      }
      sql += `${condition.column} ${condition.operator} ?`;
      this.#parameters.push(condition.value);
    });

    return sql;
  }

  /**
   * Build complete SQL query string
   * @private
   * @returns {string} Complete SQL query
   */
  buildSql() {
    this.#parameters = [];
    // Validate table is set
    if (!this.#query.table) {
      throw new Error('Table name is required. Use from() or query(tableName)');
    }

    // If no type is set, default to SELECT
    if (!this.#query.type) {
      this.#query.type = 'SELECT';
    }

    let sql = '';

    switch (this.#query.type) {
      case 'SELECT':
        let selectClause = this.#query.select;

        // Auto-include local keys needed for eager loading
        if (selectClause !== '*' && this.#query.with.length > 0) {
          const selectColumns = selectClause.split(',').map(col => col.trim());
          const requiredKeys = new Set();

          // Collect all local keys needed for relationships
          this.#query.with.forEach(rel => {
            if (Array.isArray(rel.localKey)) {
              rel.localKey.forEach(key => requiredKeys.add(key));
            } else {
              requiredKeys.add(rel.localKey);
            }
          });

          // Add missing keys to select (with table prefix if needed)
          requiredKeys.forEach(key => {
            const hasKey = selectColumns.some(col => {
              const cleanCol = col.replace(/.*\./, ''); // Remove table prefix
              return cleanCol === key || cleanCol.startsWith(`${key} `);
            });
            
            if (!hasKey) {
              const keyWithTable = `${this.#query.table}.${key}`;
              selectColumns.push(keyWithTable);
              // Track this column as auto-added
              this.#query.autoAddedColumns.push(key);
            }
          });

          selectClause = selectColumns.join(', ');
        }

        // Add aggregate subqueries if any
        if (this.#query.aggregates.length > 0) {
          const aggregateSelects = this.#query.aggregates.map(agg => {
            // Build subquery for aggregate
            const subQuery = new QueryBuilder(this.#executor);
            subQuery.from(agg.relatedTable);

            // Handle composite keys (arrays) or single key
            if (Array.isArray(agg.foreignKey)) {
              const foreignKeys = agg.foreignKey;
              const localKeys = Array.isArray(agg.localKey) ? agg.localKey : [agg.localKey];

              if (foreignKeys.length !== localKeys.length) {
                throw new Error('Foreign keys and local keys must have the same length for composite keys');
              }

              // Add multiple WHERE conditions for composite keys
              foreignKeys.forEach((fk, i) => {
                subQuery.where(`${agg.relatedTable}.${fk}`, new RawSql(`${this.#query.table}.${localKeys[i]}`));
              });
            } else {
              subQuery.where(`${agg.relatedTable}.${agg.foreignKey}`, new RawSql(`${this.#query.table}.${agg.localKey}`));
            }

            // Apply callback if provided
            if (agg.callback && typeof agg.callback === 'function') {
              agg.callback(subQuery);
            }

            // Build aggregate function
            const aggFunc = agg.type === 'COUNT' ? 'COUNT(*)' : `${agg.type}(${agg.column})`;
            subQuery.#query.select = aggFunc;
            subQuery.#query.type = 'SELECT';

            const subSql = subQuery.buildSql();
            this.#parameters.push(...subQuery.#parameters);

            return `(${subSql}) as ${agg.alias}`;
          });

          selectClause = selectClause === '*'
            ? `${this.#query.table}.*, ${aggregateSelects.join(', ')}`
            : `${selectClause}, ${aggregateSelects.join(', ')}`;
        }

        sql = `SELECT ${this.#query.distinct ? 'DISTINCT ' : ''}${selectClause} FROM ${this.#query.table}`;

        // JOINs
        this.#query.joins.forEach(join => {
          sql += ` ${join.type} JOIN ${join.table} ON ${join.condition}`;
        });

        // WHERE
        sql += this.buildWhere();

        // GROUP BY
        if (this.#query.groupBy.length > 0) {
          sql += ` GROUP BY ${this.#query.groupBy.join(', ')}`;
        }

        // HAVING
        sql += this.buildHaving();

        // ORDER BY
        if (this.#query.orderBy.length > 0) {
          sql += ' ORDER BY ';
          sql += this.#query.orderBy.map(order => `${order.column} ${order.direction}`).join(', ');
        }

        // LIMIT and OFFSET
        if (this.#query.limit !== null) {
          sql += ` LIMIT ${this.#query.limit}`;
          if (this.#query.offset !== null) {
            sql += ` OFFSET ${this.#query.offset}`;
          }
        }
        break;

      case 'INSERT':
        if (this.#query.values && this.#query.values.length > 0) {
          const columns = Object.keys(this.#query.values[0]);
          const rowPlaceholder = `(${columns.map(() => '?').join(', ')})`;
          const placeholders = this.#query.values.map(() => rowPlaceholder).join(', ');
          sql = `INSERT INTO ${this.#query.table} (${columns.join(', ')}) VALUES ${placeholders}`;
          this.#parameters = [];
          this.#query.values.forEach(row => {
            columns.forEach(col => {
              this.#parameters.push(row[col]);
            });
          });
        } else {
          const columns = Object.keys(this.#query.set);
          const placeholders = columns.map(() => '?').join(', ');
          sql = `INSERT INTO ${this.#query.table} (${columns.join(', ')}) VALUES (${placeholders})`;
          this.#parameters = columns.map(col => this.#query.set[col]);
        }
        break;

      case 'UPDATE':
        sql = `UPDATE ${this.#query.table} SET `;
        const updates = Object.keys(this.#query.set).map(col => `${col} = ?`);
        sql += updates.join(', ');
        this.#parameters = Object.values(this.#query.set);

        sql += this.buildWhere();
        break;

      case 'UPSERT':
        const upsertColumns = Object.keys(this.#query.set);
        const upsertPlaceholders = upsertColumns.map(() => '?').join(', ');
        const updateColumns = Object.keys(this.#query.upsertUpdate || {});

        if (updateColumns.length === 0) {
          throw new Error('upsert() requires update data');
        }

        sql = `INSERT INTO ${this.#query.table} (${upsertColumns.join(', ')}) VALUES (${upsertPlaceholders})`;
        const updateClauses = updateColumns.map(col => {
          const value = this.#query.upsertUpdate[col];
          if (value instanceof RawSql) {
            return `${col} = ${value.value}`;
          }
          return `${col} = ?`;
        });
        sql += ` ON DUPLICATE KEY UPDATE ${updateClauses.join(', ')}`;

        this.#parameters = upsertColumns.map(col => this.#query.set[col]);
        updateColumns.forEach(col => {
          const value = this.#query.upsertUpdate[col];
          if (!(value instanceof RawSql)) {
            this.#parameters.push(value);
          }
        });
        break;

      case 'DELETE':
        sql = `DELETE FROM ${this.#query.table}`;
        sql += this.buildWhere();
        break;
    }

    return sql;
  }

  /**
   * Apply common row post-processing after SELECT execution
   * @private
   * @param {any[]} rows - Raw query result rows
   * @returns {Promise<any[]>} Processed rows
   */
  async #postProcessRows(rows) {
    // Convert aggregate results to numbers (MySQL returns strings for aggregates)
    if (this.#query.aggregates.length > 0 && rows.length > 0) {
      rows = rows.map(row => {
        const newRow = { ...row };
        this.#query.aggregates.forEach(agg => {
          if (newRow[agg.alias] !== null && newRow[agg.alias] !== undefined) {
            newRow[agg.alias] = Number(newRow[agg.alias]) || 0;
          }
        });
        return newRow;
      });
    }

    // Process eager loaded relationships (two-query approach like Laravel)
    if (this.#query.with.length > 0 && rows.length > 0) {
      rows = await this.#loadRelations(rows, this.#query.with);
    }

    // Remove auto-added columns from results if they weren't explicitly selected
    if (this.#query.autoAddedColumns.length > 0 && rows.length > 0) {
      rows = rows.map(row => {
        const cleanRow = { ...row };
        this.#query.autoAddedColumns.forEach(col => {
          delete cleanRow[col];
        });
        return cleanRow;
      });
    }

    return rows;
  }

  /**
   * Shared chunk loop runner for offset-based and ID-based chunking
   * @private
   * @param {number} size - Chunk size
   * @param {function} callback - Per-chunk callback
   * @param {function} setupIteration - Called before each query
   * @param {function|null} continueIteration - Called when loop continues to next page
   * @returns {Promise<boolean>} True when processing completes
   */
  async #runChunkLoop(size, callback, setupIteration, continueIteration = null) {
    let page = 0;

    while (true) {
      this.#parameters = [];

      if (setupIteration) {
        await setupIteration(page);
      }

      this.#query.limit = size;

      const sql = this.buildSql();
      const result = await this.#executor.query(sql, this.#parameters);
      let rows = result.rows;
      rows = await this.#postProcessRows(rows);

      if (rows.length === 0) {
        break;
      }

      const shouldContinue = await callback(rows, page);
      if (shouldContinue === false) {
        break;
      }

      if (rows.length < size) {
        break;
      }

      if (continueIteration) {
        await continueIteration(rows, page);
      }

      page++;
    }

    return true;
  }

  /**
   * Execute SELECT query and return results
   * @returns {Promise<any[]>} Array of result rows
   *
   * @example
   * const users = await query('users').where('active', 1).get();
   * console.log(users); // Array of user objects
   */
  async get() {
    const sql = this.buildSql();
    const result = await this.#executor.query(sql, this.#parameters);
    let rows = result.rows;
    rows = await this.#postProcessRows(rows);

    this.#reset(); // Reset for next query
    return rows;
  }

  /**
   * Process query results in chunks to avoid memory issues with large datasets
   * Similar to Laravel's chunk() method - processes records in batches
    * Eager loading (withMany/withOne) and aggregate casting are applied per chunk
   * 
   * @param {number} size - Number of records per chunk
   * @param {function} callback - Function to process each chunk (receives rows and page number)
   * @returns {Promise<boolean>} True when chunking completes
   *
   * @example
   * // Process users in batches of 100
   * await query('users').where('status', 'active').chunk(100, async (users, page) => {
   *   console.log(`Processing page ${page} with ${users.length} users`);
   *   for (const user of users) {
   *     await processUser(user);
   *   }
   * });
   * 
   * @example
   * // Return false to stop chunking early
   * await query('users').chunk(100, async (users, page) => {
   *   console.log(`Page ${page}`);
   *   if (page >= 5) {
   *     return false; // Stop after 5 pages
   *   }
   * });
   */
  async chunk(size, callback) {
    if (typeof callback !== 'function') {
      throw new Error('chunk() requires a callback function');
    }

    if (!Number.isInteger(size) || size <= 0) {
      throw new Error('chunk() size must be a positive integer');
    }

    // Save the original limit and offset
    const originalLimit = this.#query.limit;
    const originalOffset = this.#query.offset;

    try {
      await this.#runChunkLoop(
        size,
        callback,
        async (page) => {
          this.#query.offset = page * size;
        }
      );
    } finally {
      // Restore original values and reset
      this.#query.limit = originalLimit;
      this.#query.offset = originalOffset;
      this.#reset();
    }

    return true;
  }

  /**
   * Process query results in chunks using ID-based pagination (more efficient than offset)
   * Similar to Laravel's chunkById() - uses WHERE id > lastId instead of OFFSET
   * This is more efficient for very large datasets as it avoids OFFSET performance issues
    * Eager loading (withMany/withOne) and aggregate casting are applied per chunk
   * 
   * @param {number} size - Number of records per chunk
   * @param {function} callback - Function to process each chunk (receives rows and page number)
   * @param {string} [column='id'] - Column name to use for chunking (must be indexed and unique)
   * @param {string} [alias=null] - Optional table alias if using joins
   * @returns {Promise<boolean>} True when chunking completes
   *
   * @example
   * // Process users efficiently using ID-based pagination
   * await query('users').where('status', 'active').chunkById(100, async (users, page) => {
   *   console.log(`Processing page ${page} with ${users.length} users`);
   *   for (const user of users) {
   *     await processUser(user);
   *   }
   * });
   * 
   * @example
   * // Use custom column for chunking
   * await query('transactions').chunkById(500, async (transactions, page) => {
   *   await processTransactions(transactions);
   * }, 'transaction_id');
   * 
   * @example
   * // With table alias (when using joins)
   * await query('users')
   *   .join('profiles', 'users.id = profiles.user_id')
   *   .chunkById(100, async (rows) => {
   *     // Process...
   *   }, 'id', 'users');
   */
  async chunkById(size, callback, column = 'id', alias = null) {
    if (typeof callback !== 'function') {
      throw new Error('chunkById() requires a callback function');
    }

    if (!Number.isInteger(size) || size <= 0) {
      throw new Error('chunkById() size must be a positive integer');
    }

    let lastId = null;

    // Save original values
    const originalLimit = this.#query.limit;
    const originalOrderBy = [...this.#query.orderBy];
    const originalWhere = [...this.#query.where];

    // Determine the full column name (with alias if provided)
    const fullColumn = alias ? `${alias}.${column}` : column;

    try {
      // Add ORDER BY if not already present for the chunk column
      const hasOrderBy = this.#query.orderBy.some(order =>
        order.column === column || order.column === fullColumn
      );

      if (!hasOrderBy) {
        this.#query.orderBy.push({ column: fullColumn, direction: 'ASC' });
      }

      await this.#runChunkLoop(
        size,
        callback,
        async () => {
          if (lastId !== null) {
            this.#query.where.push({
              column: fullColumn,
              operator: '>',
              value: lastId,
              type: 'AND'
            });
          }
        },
        async (rows) => {
          lastId = rows[rows.length - 1][column];
          this.#query.where = [...originalWhere];
        }
      );
    } finally {
      // Restore original values and reset
      this.#query.limit = originalLimit;
      this.#query.orderBy = originalOrderBy;
      this.#query.where = originalWhere;
      this.#reset();
    }

    return true;
  }

  /**
   * Load relations recursively (supports nested eager loading)
   * @private
   * @param {array} rows - Parent records
   * @param {array} relations - Relations to load
   * @returns {Promise<array>} Rows with loaded relations
   */
  async #loadRelations(rows, relations) {
    for (const relation of relations) {
      // Check if we're dealing with composite keys (arrays)
      const isCompositeKey = Array.isArray(relation.foreignKey);

      if (isCompositeKey) {
        // Composite key handling
        const foreignKeys = relation.foreignKey;
        const localKeys = Array.isArray(relation.localKey) ? relation.localKey : [relation.localKey];

        if (foreignKeys.length !== localKeys.length) {
          throw new Error(`Foreign keys and local keys must have the same length for composite keys`);
        }

        // Get unique combinations of local key values from parent records
        const localKeyValuePairs = rows.map(row => {
          return localKeys.map(key => row[key]);
        }).filter(pair => pair.every(val => val != null));

        if (localKeyValuePairs.length === 0) {
          // No valid keys, set empty value based on relation type
          rows.forEach(row => {
            row[relation.relationName] = relation.type === 'hasOne' ? null : [];
          });
          continue;
        }

        // Build query for related records with composite key matching
        const relatedQuery = new QueryBuilder(this.#executor);
        relatedQuery.from(relation.relatedTable);

        // Build WHERE clause for composite keys using tuple matching
        // WHERE (fk1, fk2) IN ((?, ?), (?, ?))
        const tupleConditions = localKeyValuePairs.map((_, index) => {
          const conditions = foreignKeys.map((fk, i) => `${fk} = ?`).join(' AND ');
          return `(${conditions})`;
        }).join(' OR ');

        relatedQuery.#query.where.push({
          type: 'RAW',
          sql: tupleConditions,
          values: localKeyValuePairs.flat()
        });

        // Apply callback conditions and capture nested withMany/withOne calls
        const addedForeignKeys = []; // Track FK columns we add for mapping
        if (relation.callback && typeof relation.callback === 'function') {
          relation.callback(relatedQuery);
          
          // Ensure foreign keys are selected if callback used select()
          // We need them to map records back to parents
          if (relatedQuery.#query.select !== '*') {
            const selectColumns = relatedQuery.#query.select.split(',').map(col => col.trim());
            
            foreignKeys.forEach(fk => {
              const hasForeignKey = selectColumns.some(col => {
                const cleanCol = col.replace(/.*\./, '');
                return cleanCol === fk || cleanCol.startsWith(`${fk} `);
              });
              
              if (!hasForeignKey) {
                selectColumns.push(`${relation.relatedTable}.${fk}`);
                addedForeignKeys.push(fk); // Track that we added this
              }
            });
            
            relatedQuery.#query.select = selectColumns.join(', ');
          }
        }

        // Fetch related records
        const relatedSql = relatedQuery.buildSql();
        const relatedResult = await this.#executor.query(relatedSql, relatedQuery.#parameters);
        let relatedRecords = relatedResult.rows;

        // Process nested relations if any were defined in the callback
        if (relatedQuery.#query.with.length > 0 && relatedRecords.length > 0) {
          relatedRecords = await this.#loadRelations(relatedRecords, relatedQuery.#query.with);
        }

        // Remove auto-added columns from related records
        if (relatedQuery.#query.autoAddedColumns.length > 0 && relatedRecords.length > 0) {
          relatedRecords = relatedRecords.map(record => {
            const cleanRecord = { ...record };
            relatedQuery.#query.autoAddedColumns.forEach(col => {
              delete cleanRecord[col];
            });
            return cleanRecord;
          });
        }

        // Group related records by composite key
        if (relation.type === 'hasOne') {
          const mappedRelated = {};
          relatedRecords.forEach(record => {
            const compositeKey = foreignKeys.map(fk => record[fk]).join('|');
            if (!mappedRelated[compositeKey]) {
              // Remove foreign keys that we added for mapping
              if (addedForeignKeys.length > 0) {
                const cleanRecord = { ...record };
                addedForeignKeys.forEach(fk => delete cleanRecord[fk]);
                mappedRelated[compositeKey] = cleanRecord;
              } else {
                mappedRelated[compositeKey] = record;
              }
            }
          });

          rows = rows.map(row => {
            const compositeKey = localKeys.map(lk => row[lk]).join('|');
            row[relation.relationName] = mappedRelated[compositeKey] || null;
            return row;
          });
        } else {
          const groupedRelated = {};
          relatedRecords.forEach(record => {
            const compositeKey = foreignKeys.map(fk => record[fk]).join('|');
            
            // Remove foreign keys that we added for mapping
            let cleanRecord = record;
            if (addedForeignKeys.length > 0) {
              cleanRecord = { ...record };
              addedForeignKeys.forEach(fk => delete cleanRecord[fk]);
            }
            
            if (!groupedRelated[compositeKey]) {
              groupedRelated[compositeKey] = [];
            }
            groupedRelated[compositeKey].push(cleanRecord);
          });

          rows = rows.map(row => {
            const compositeKey = localKeys.map(lk => row[lk]).join('|');
            row[relation.relationName] = groupedRelated[compositeKey] || [];
            return row;
          });
        }
      } else {
        // Single key handling (original logic)
        const localKeyValues = rows.map(row => row[relation.localKey]).filter(val => val != null);

        if (localKeyValues.length === 0) {
          // No valid keys, set empty value based on relation type
          rows.forEach(row => {
            row[relation.relationName] = relation.type === 'hasOne' ? null : [];
          });
          continue;
        }

        // Build query for related records
        const relatedQuery = new QueryBuilder(this.#executor);
        relatedQuery.from(relation.relatedTable);
        relatedQuery.whereIn(relation.foreignKey, localKeyValues);

        // Apply callback conditions and capture nested withMany/withOne calls
        let addedForeignKey = false; // Track if we added FK for mapping
        if (relation.callback && typeof relation.callback === 'function') {
          relation.callback(relatedQuery);
          
          // Ensure foreign key is selected if callback used select()
          // We need it to map records back to parents
          if (relatedQuery.#query.select !== '*') {
            const selectColumns = relatedQuery.#query.select.split(',').map(col => col.trim());
            const hasForeignKey = selectColumns.some(col => {
              const cleanCol = col.replace(/.*\./, '');
              return cleanCol === relation.foreignKey || cleanCol.startsWith(`${relation.foreignKey} `);
            });
            
            if (!hasForeignKey) {
              selectColumns.push(`${relation.relatedTable}.${relation.foreignKey}`);
              relatedQuery.#query.select = selectColumns.join(', ');
              addedForeignKey = true; // Track that we added this
            }
          }
        }

        // Fetch related records
        const relatedSql = relatedQuery.buildSql();
        const relatedResult = await this.#executor.query(relatedSql, relatedQuery.#parameters);
        let relatedRecords = relatedResult.rows;

        // Process nested relations if any were defined in the callback
        if (relatedQuery.#query.with.length > 0 && relatedRecords.length > 0) {
          relatedRecords = await this.#loadRelations(relatedRecords, relatedQuery.#query.with);
        }

        // Remove auto-added columns from related records
        if (relatedQuery.#query.autoAddedColumns.length > 0 && relatedRecords.length > 0) {
          relatedRecords = relatedRecords.map(record => {
            const cleanRecord = { ...record };
            relatedQuery.#query.autoAddedColumns.forEach(col => {
              delete cleanRecord[col];
            });
            return cleanRecord;
          });
        }

        if (relation.type === 'hasOne') {
          // For hasOne: create map of foreignKey -> single record (first match)
          const mappedRelated = {};
          relatedRecords.forEach(record => {
            const fk = record[relation.foreignKey];
            if (!mappedRelated[fk]) {
              // Remove foreign key that we added for mapping
              if (addedForeignKey) {
                const cleanRecord = { ...record };
                delete cleanRecord[relation.foreignKey];
                mappedRelated[fk] = cleanRecord;
              } else {
                mappedRelated[fk] = record; // Only take first match
              }
            }
          });

          // Attach single related record to parent records
          rows = rows.map(row => {
            const localKeyValue = row[relation.localKey];
            row[relation.relationName] = mappedRelated[localKeyValue] || null;
            return row;
          });
        } else {
          // For hasMany: group related records by foreign key
          const groupedRelated = {};
          relatedRecords.forEach(record => {
            const fk = record[relation.foreignKey];
            
            // Remove foreign key that we added for mapping
            let cleanRecord = record;
            if (addedForeignKey) {
              cleanRecord = { ...record };
              delete cleanRecord[relation.foreignKey];
            }
            
            if (!groupedRelated[fk]) {
              groupedRelated[fk] = [];
            }
            groupedRelated[fk].push(cleanRecord);
          });

          // Attach related records array to parent records
          rows = rows.map(row => {
            const localKeyValue = row[relation.localKey];
            row[relation.relationName] = groupedRelated[localKeyValue] || [];
            return row;
          });
        }
      }
    }

    return rows;
  }

  /**
   * Execute query and return first row only
   * @returns {Promise<object|null>} First row or null if no results
   *
   * @example
   * const user = await query('users').where('id', 1).first();
   */
  async first() {
    const rows = await this.get();
    return rows[0] || null;
  }

  /**
   * Execute query and return single column value from first row
   * @param {string} column - Column name to return
   * @returns {Promise<any>} Column value or null if no results
   *
   * @example
   * const email = await query('users').where('id', 1).value('email');
   */
  async value(column) {
    const rows = await this.get();
    if (rows.length > 0) {
      return rows[0][column];
    }
    return null;
  }

  /**
   * Execute COUNT query and return number of records
   * @returns {Promise<number>} Count of records
   *
   * @example
   * const totalUsers = await query('users').count();
   */
  async count() {
    const originalSelect = this.#query.select;
    this.#query.select = 'COUNT(*) as count';
    const result = await this.first();
    this.#query.select = originalSelect;
    return result ? result.count : 0;
  }

  /**
   * Execute INSERT, UPDATE, or DELETE query
   * @returns {Promise<object>} Query result with affected rows info
   *
   * @example
   * const result = await query('users').insert({name: 'John'}).execute();
   * console.log(result.insertId); // For INSERT queries
   */
  async execute() {
    const sql = this.buildSql();
    let result;

    if (this.#query.type === 'INSERT' || this.#query.type === 'UPSERT') {
      result = await this.#executor.insert(sql, this.#parameters);
    } else if (this.#query.type === 'UPDATE' || this.#query.type === 'DELETE') {
      result = await this.#executor.update(sql, this.#parameters);
    }

    this.#reset();
    return result;
  }

  /**
   * Get the generated SQL query string (for debugging)
   * @returns {string} SQL query string
   *
   * @example
   * const sql = query('users').where('id', 1).toSql();
   * console.log(sql); // "SELECT * FROM users WHERE id = ?"
   */
  toSql() {
    return this.buildSql();
  }

  /**
   * Get the bound parameters array (for debugging)
   * @returns {any[]} Array of parameter values
   *
   * @example
   * const params = query('users').where('id', 1).getParameters();
   * console.log(params); // [1]
   */
  getParameters() {
    return this.#parameters;
  }
}

/**
 * Factory function to create QueryBuilder instances
 * @param {string} [table] - Optional table name to start with
 * @returns {QueryBuilder} New QueryBuilder instance
 *
 * @example
 * const { query } = require('./queryBuilder');
 * const users = query('users').where('active', 1).get();
 * const posts = query().from('posts').where('published', 1).get();
 */
function query(table = null) {
  const qb = new QueryBuilder();
  if (table) qb.from(table);
  return qb;
}

function createExecutor(connection) {
  return {
    query: async (sql, params = []) => {
      const [rows, fields] = await connection.execute(sql, params);
      return { rows, fields };
    },
    insert: async (sql, params = []) => {
      const [result] = await connection.execute(sql, params);
      return result.insertId;
    },
    update: async (sql, params = []) => {
      const [result] = await connection.execute(sql, params);
      return result.affectedRows;
    }
  };
}

/**
 * Run multiple queries in a single transaction.
 * Rolls back on any thrown error (query errors or JavaScript errors).
 *
 * @param {function} callback - Async function that receives trx() query factory
 * @returns {Promise<any>} Result returned by callback
 *
 * @example
 * const { transaction } = require('./queryBuilder');
 *
 * await transaction(async (trx) => {
 *   const userId = await trx('users')
 *     .insert({ username: 'alice', email: 'a@b.com', password_hash: 'x' })
 *     .execute();
 *
 *   await trx('transactions')
 *     .insert({ user_id: userId, total_amount: 100, status: 'pending' })
 *     .execute();
 * });
 */
async function transaction(callback) {
  return db.transaction(async (connection) => {
    const executor = createExecutor(connection);
    const trxQuery = (table = null) => {
      const qb = new QueryBuilder(executor);
      if (table) qb.from(table);
      return qb;
    };

    return callback(trxQuery);
  });
}

module.exports = { QueryBuilder, query, transaction, RawSql };