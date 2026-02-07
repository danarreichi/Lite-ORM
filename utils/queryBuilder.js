const db = require('./database');

/**
 * RawSql class - Marks SQL values that should not be parameterized
 * Used for column references and raw SQL expressions
 */
class RawSql {
  constructor(value) {
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
  /**
   * Creates a new QueryBuilder instance
   */
  constructor() {
    this.reset();
  }

  /**
   * Reset query state to initial values
   * @private
   */
  reset() {
    this.query = {
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
      with: []
    };
    this.parameters = [];
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
    this.query.type = 'SELECT';
    this.query.select = Array.isArray(columns) ? columns.join(', ') : columns;
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
    this.query.distinct = true;
    return this;
  }

  /**
   * Specify the table to query (usually set by factory function)
   * @param {string} table - Table name
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   */
  from(table) {
    this.query.table = table;
    return this;
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
   */
  where(column, operator = null, value = null) {
    if (value === null && operator !== null) {
      // where('column', 'value')
      value = operator;
      operator = '=';
    }

    this.query.where.push({ column, operator, value, type: 'AND' });
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
   */
  orWhere(column, operator = null, value = null) {
    if (value === null && operator !== null) {
      value = operator;
      operator = '=';
    }

    this.query.where.push({ column, operator, value, type: 'OR' });
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
    this.query.where.push({ column, operator: 'IN', value: values, type: 'AND' });
    return this;
  }

  /**
   * Add WHERE NOT IN condition
   * @param {string} column - Column name
   * @param {any[]} values - Array of values to exclude
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   */
  whereNotIn(column, values) {
    this.query.where.push({ column, operator: 'NOT IN', value: values, type: 'AND' });
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
    this.query.where.push({ type: 'GROUP_START', groupType: 'AND' });
    callback(this);
    this.query.where.push({ type: 'GROUP_END' });
    return this;
  }

  /**
   * Add WHERE EXISTS subquery with relation
   * @param {string} relatedTable - The related table name
   * @param {string} foreignKey - Foreign key column in related table
   * @param {string} localKey - Local key column (defaults to 'id')
   * @param {function} [callback] - Optional callback to add conditions to the subquery
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   *
   * @example
   * query('users').whereExistsRelation('transactions', 'user_id', 'id', function(q) {
   *   q.where('status', 'completed');
   * })
   * // WHERE EXISTS (SELECT 1 FROM transactions WHERE transactions.user_id = users.id AND status = 'completed')
   */
  whereExistsRelation(relatedTable, foreignKey, localKey = 'id', callback = null) {
    // Create a sub-query builder for the EXISTS clause
    const subQuery = new QueryBuilder();
    subQuery.select('1').from(relatedTable);
    // Use RawSql to prevent the column reference from being parameterized
    subQuery.where(`${relatedTable}.${foreignKey}`, new RawSql(`${this.query.table}.${localKey}`));

    // Add additional conditions if callback provided
    if (callback && typeof callback === 'function') {
      callback(subQuery);
    }

    // Add EXISTS condition to where array
    this.query.where.push({
      type: 'EXISTS',
      subQuery: subQuery,
      relation: { relatedTable, foreignKey, localKey }
    });

    return this;
  }

  /**
   * Eager load has-many relationship (one-to-many)
   * Uses two-query approach to load related records efficiently
   * 
   * @param {string|object} relation - Table name (string) or object mapping {relatedTable: relationName}
   * @param {string} foreignKey - Foreign key column in related table
   * @param {string} [localKey='id'] - Local key column (defaults to 'id')
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
   */
  withMany(relation, foreignKey, localKey = 'id', callback = null) {
    let relatedTable, relationName;
    
    // Check if relation is a string (shorthand) or object (explicit mapping)
    if (typeof relation === 'string') {
      // Shorthand: use same name for both table and property
      relatedTable = relation;
      relationName = relation;
    } else {
      // Object mapping: extract table and relation name
      relatedTable = Object.keys(relation)[0];
      relationName = relation[relatedTable];
    }
    
    this.query.with.push({
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
   * @param {string} foreignKey - Foreign key column in related table
   * @param {string} [localKey='id'] - Local key column (defaults to 'id')
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
   */
  withOne(relation, foreignKey, localKey = 'id', callback = null) {
    let relatedTable, relationName;
    
    // Check if relation is a string (shorthand) or object (explicit mapping)
    if (typeof relation === 'string') {
      // Shorthand: use same name for both table and property
      relatedTable = relation;
      relationName = relation;
    } else {
      // Object mapping: extract table and relation name
      relatedTable = Object.keys(relation)[0];
      relationName = relation[relatedTable];
    }
    
    this.query.with.push({
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
   * Create LIKE pattern for search operations
   * @private
   * @param {string} value - Search value
   * @param {string} side - Pattern side: 'both', 'before', 'after'
   * @returns {string} LIKE pattern
   */
  _createLikePattern(value, side) {
    if (side === 'before') return `%${value}`;
    if (side === 'after') return `${value}%`;
    return `%${value}%`;
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
    const pattern = this._createLikePattern(value, side);
    this.query.where.push({ column, operator: 'LIKE', value: pattern, type: 'AND' });
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
    const pattern = this._createLikePattern(value, side);
    this.query.where.push({ column, operator: 'LIKE', value: pattern, type: 'OR' });
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

    columns.forEach((column, index) => {
      const pattern = this._createLikePattern(value, side);
      const conditionType = index === 0 ? 'AND' : 'OR';
      this.query.where.push({ column, operator: 'LIKE', value: pattern, type: conditionType });
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

    columns.forEach(column => {
      const pattern = this._createLikePattern(value, side);
      this.query.where.push({ column, operator: 'LIKE', value: pattern, type: 'OR' });
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
    this.query.joins.push({ table, condition, type });
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
    this.query.groupBy = Array.isArray(columns) ? columns : [columns];
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
    if (value === null && operator !== null) {
      value = operator;
      operator = '=';
    }

    this.query.having.push({ column, operator, value, type: 'AND' });
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
    this.query.orderBy.push({ column, direction });
    return this;
  }

  /**
   * Add LIMIT clause
   * @param {number} value - Maximum number of records to return
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   */
  limit(value) {
    this.query.limit = value;
    return this;
  }

  /**
   * Add OFFSET clause
   * @param {number} value - Number of records to skip
   * @returns {QueryBuilder} QueryBuilder instance for chaining
   */
  offset(value) {
    this.query.offset = value;
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
    this.query.type = 'INSERT';
    this.query.table = data.table || this.query.table;
    this.query.set = data;
    delete data.table;
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
    this.query.type = 'UPDATE';
    this.query.table = data.table || this.query.table;
    this.query.set = data;
    delete data.table;
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
    this.query.type = 'DELETE';
    if (table) this.query.table = table;
    return this;
  }

  /**
   * Build WHERE clause from conditions array
   * @private
   * @returns {string} WHERE clause SQL
   */
  buildWhere() {
    if (this.query.where.length === 0) return '';

    let sql = ' WHERE ';
    let groupLevel = 0;
    let conditionsInGroup = [0]; // Track conditions per group level

    this.query.where.forEach((condition, index) => {
      if (condition.type === 'GROUP_START') {
        // Add AND/OR before group if not the first condition at root level
        if (groupLevel === 0 && index > 0) {
          sql += ` ${this.query.where[index - 1].groupType || 'AND'} `;
        }
        sql += '(';
        groupLevel++;
        conditionsInGroup.push(0);
      } else if (condition.type === 'GROUP_END') {
        sql += ')';
        groupLevel--;
        conditionsInGroup.pop();
      } else if (condition.type === 'EXISTS') {
        // Add AND/OR if this is not the first condition in current group
        if (conditionsInGroup[groupLevel] > 0) {
          sql += ' AND ';
        }
        conditionsInGroup[groupLevel]++;

        // Build the EXISTS subquery
        const subSql = condition.subQuery.buildSql();
        sql += `EXISTS (${subSql})`;
        // Add subquery parameters to main parameters array
        this.parameters.push(...condition.subQuery.parameters);
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
          this.parameters.push(...condition.value);
        } else if (condition.value instanceof RawSql) {
          // For raw SQL values (like column references), use directly without parameterizing
          sql += `${condition.column} ${condition.operator} ${condition.value.value}`;
        } else {
          sql += `${condition.column} ${condition.operator} ?`;
          this.parameters.push(condition.value);
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
    if (this.query.having.length === 0) return '';

    let sql = ' HAVING ';
    this.query.having.forEach((condition, index) => {
      if (index > 0) {
        sql += ` ${condition.type} `;
      }
      sql += `${condition.column} ${condition.operator} ?`;
      this.parameters.push(condition.value);
    });

    return sql;
  }

  /**
   * Build complete SQL query string
   * @private
   * @returns {string} Complete SQL query
   */
  buildSql() {
    // If no type is set, default to SELECT
    if (!this.query.type) {
      this.query.type = 'SELECT';
    }

    let sql = '';

    switch (this.query.type) {
      case 'SELECT':
        sql = `SELECT ${this.query.distinct ? 'DISTINCT ' : ''}${this.query.select} FROM ${this.query.table}`;

        // JOINs
        this.query.joins.forEach(join => {
          sql += ` ${join.type} JOIN ${join.table} ON ${join.condition}`;
        });

        // WHERE
        sql += this.buildWhere();

        // GROUP BY
        if (this.query.groupBy.length > 0) {
          sql += ` GROUP BY ${this.query.groupBy.join(', ')}`;
        }

        // HAVING
        sql += this.buildHaving();

        // ORDER BY
        if (this.query.orderBy.length > 0) {
          sql += ' ORDER BY ';
          sql += this.query.orderBy.map(order => `${order.column} ${order.direction}`).join(', ');
        }

        // LIMIT and OFFSET
        if (this.query.limit) {
          sql += ` LIMIT ${this.query.limit}`;
          if (this.query.offset) {
            sql += ` OFFSET ${this.query.offset}`;
          }
        }
        break;

      case 'INSERT':
        const columns = Object.keys(this.query.set);
        const placeholders = columns.map(() => '?').join(', ');
        sql = `INSERT INTO ${this.query.table} (${columns.join(', ')}) VALUES (${placeholders})`;
        this.parameters = columns.map(col => this.query.set[col]);
        break;

      case 'UPDATE':
        sql = `UPDATE ${this.query.table} SET `;
        const updates = Object.keys(this.query.set).map(col => `${col} = ?`);
        sql += updates.join(', ');
        this.parameters = Object.values(this.query.set);

        sql += this.buildWhere();
        break;

      case 'DELETE':
        sql = `DELETE FROM ${this.query.table}`;
        sql += this.buildWhere();
        break;
    }

    return sql;
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
    const result = await db.query(sql, this.parameters);
    let rows = result.rows;
    
    // Process eager loaded relationships (two-query approach like Laravel)
    if (this.query.with.length > 0 && rows.length > 0) {
      rows = await this._loadRelations(rows, this.query.with);
    }
    
    this.reset(); // Reset for next query
    return rows;
  }

  /**
   * Load relations recursively (supports nested eager loading)
   * @private
   * @param {array} rows - Parent records
   * @param {array} relations - Relations to load
   * @returns {Promise<array>} Rows with loaded relations
   */
  async _loadRelations(rows, relations) {
    for (const relation of relations) {
      // Get the local key values from parent records
      const localKeyValues = rows.map(row => row[relation.localKey]).filter(val => val != null);
      
      if (localKeyValues.length === 0) {
        // No valid keys, set empty value based on relation type
        rows.forEach(row => {
          row[relation.relationName] = relation.type === 'hasOne' ? null : [];
        });
        continue;
      }
      
      // Build query for related records
      const relatedQuery = new QueryBuilder();
      relatedQuery.from(relation.relatedTable);
      relatedQuery.whereIn(relation.foreignKey, localKeyValues);
      
      // Apply callback conditions and capture nested withMany/withOne calls
      if (relation.callback && typeof relation.callback === 'function') {
        relation.callback(relatedQuery);
      }
      
      // Fetch related records
      const relatedSql = relatedQuery.buildSql();
      const relatedResult = await db.query(relatedSql, relatedQuery.parameters);
      let relatedRecords = relatedResult.rows;
      
      // Process nested relations if any were defined in the callback
      if (relatedQuery.query.with.length > 0 && relatedRecords.length > 0) {
        relatedRecords = await this._loadRelations(relatedRecords, relatedQuery.query.with);
      }
      
      if (relation.type === 'hasOne') {
        // For hasOne: create map of foreignKey -> single record (first match)
        const mappedRelated = {};
        relatedRecords.forEach(record => {
          const fk = record[relation.foreignKey];
          if (!mappedRelated[fk]) {
            mappedRelated[fk] = record; // Only take first match
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
          if (!groupedRelated[fk]) {
            groupedRelated[fk] = [];
          }
          groupedRelated[fk].push(record);
        });
        
        // Attach related records array to parent records
        rows = rows.map(row => {
          const localKeyValue = row[relation.localKey];
          row[relation.relationName] = groupedRelated[localKeyValue] || [];
          return row;
        });
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
    const originalSelect = this.query.select;
    this.query.select = 'COUNT(*) as count';
    const result = await this.first();
    this.query.select = originalSelect;
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

    if (this.query.type === 'INSERT') {
      result = await db.insert(sql, this.parameters);
    } else if (this.query.type === 'UPDATE' || this.query.type === 'DELETE') {
      result = await db.update(sql, this.parameters);
    }

    this.reset();
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
    return this.parameters;
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

module.exports = { QueryBuilder, query, RawSql };