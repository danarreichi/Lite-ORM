# QueryBuilder Refactoring Plan

## Overview
This document outlines a safety-first refactoring plan for `utils/queryBuilder.js` (1,795 lines) following the refactoring-code skill principles. All refactoring steps should be executed AFTER the test suite passes.

## Current Status
- ✅ Test suite created: `tests/queryBuilder.test.js`
- ✅ Database seeder available: `seeder.js`
- ⏳ Tests need to pass before proceeding

## Safety Checklist (Per Refactoring-Code Skill)
- [x] Test suite exists
- [ ] All tests pass
- [ ] Tests run before each change
- [ ] Tests run after each change
- [ ] Linters/formatters available
- [ ] Each commit is small and reversible
- [ ] Public API preserved throughout

## Refactoring Priorities

### Phase 1: Extract Duplicate Logic (High Impact, Low Risk)

#### 1.1 Extract Aggregate Subquery Builder
**Location:** `where()` and `orWhere()` methods  
**Lines:** 127-169, 201-232  
**Duplication:** ~50 lines duplicated  

**New Method:**
```javascript
/**
 * Build aggregate subquery for WHERE filtering
 * @private
 * @param {object} aggregate - Aggregate configuration
 * @param {string} operator - Comparison operator
 * @param {any} value - Value to compare
 * @param {string} logicType - 'AND' or 'OR'
 * @returns {object} WHERE condition object
 */
_buildAggregateSubquery(aggregate, operator, value, logicType) {
  const subQuery = new QueryBuilder();
  subQuery.from(aggregate.relatedTable);

  // Handle composite keys or single key
  if (Array.isArray(aggregate.foreignKey)) {
    const foreignKeys = aggregate.foreignKey;
    const localKeys = Array.isArray(aggregate.localKey) ? aggregate.localKey : [aggregate.localKey];
    foreignKeys.forEach((fk, i) => {
      subQuery.where(`${aggregate.relatedTable}.${fk}`, new RawSql(`${this.query.table}.${localKeys[i]}`));
    });
  } else {
    subQuery.where(`${aggregate.relatedTable}.${aggregate.foreignKey}`, new RawSql(`${this.query.table}.${aggregate.localKey}`));
  }

  // Apply callback if provided
  if (aggregate.callback && typeof aggregate.callback === 'function') {
    aggregate.callback(subQuery);
  }

  // Build aggregate function
  const aggFunc = aggregate.type === 'COUNT' ? 'COUNT(*)' : `${aggregate.type}(${aggregate.column})`;
  subQuery.query.select = aggFunc;
  subQuery.query.type = 'SELECT';

  return {
    type: 'AGGREGATE_SUBQUERY',
    subQuery: subQuery,
    operator: operator,
    value: value,
    logicType: logicType
  };
}
```

**Impact:** Reduces ~100 lines to ~50 lines  
**Commit Message:** `Refactor(queryBuilder): extract _buildAggregateSubquery() method`

**Steps:**
1. Run tests (all pass)
2. Add `_buildAggregateSubquery()` method
3. Update `where()` to use new method
4. Run tests (all pass)
5. Commit
6. Update `orWhere()` to use new method
7. Run tests (all pass)
8. Commit

---

#### 1.2 Extract Relation Name Parser
**Location:** `withMany()` and `withOne()` methods  
**Lines:** 451-462, 507-518  
**Duplication:** 12 lines duplicated  

**New Method:**
```javascript
/**
 * Parse relation name from string or object format
 * @private
 * @param {string|object} relation - Table name or {table: name} mapping
 * @returns {{relatedTable: string, relationName: string}}
 */
_parseRelationName(relation) {
  if (typeof relation === 'string') {
    return { relatedTable: relation, relationName: relation };
  } else {
    const relatedTable = Object.keys(relation)[0];
    const relationName = relation[relatedTable];
    return { relatedTable, relationName };
  }
}
```

**Impact:** Eliminates 12 lines of duplication  
**Commit Message:** `Refactor(queryBuilder): extract _parseRelationName() helper`

**Steps:**
1. Run tests (all pass)
2. Add `_parseRelationName()` method
3. Update `withMany()` to use new method
4. Run tests (all pass)
5. Commit
6. Update `withOne()` to use new method
7. Run tests (all pass)
8. Commit

---

#### 1.3 Extract Aggregate Alias Parser
**Location:** All aggregate methods (`withSum`, `withCount`, `withAvg`, `withMax`, `withMin`)  
**Lines:** Multiple locations  
**Duplication:** ~10 lines per method × 5 methods = 50 lines  

**New Method:**
```javascript
/**
 * Parse aggregate alias from string or object format
 * @private
 * @param {string|object} relatedTable - Table name or {table: alias} mapping
 * @param {string} column - Column name (for auto-alias generation)
 * @param {string} aggregateType - SUM, COUNT, AVG, MAX, MIN
 * @returns {{table: string, alias: string}}
 */
_parseAggregateAlias(relatedTable, column, aggregateType) {
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
```

**Impact:** Reduces ~50 duplicate lines to single helper  
**Commit Message:** `Refactor(queryBuilder): extract _parseAggregateAlias() helper`

**Steps:**
1. Run tests (all pass)
2. Add `_parseAggregateAlias()` method
3. Update `withSum()` to use new method
4. Run tests (all pass)
5. Commit
6. Repeat for `withCount()`, `withAvg()`, `withMax()`, `withMin()` (one commit each)

---

#### 1.4 Extract EXISTS Subquery Builder
**Location:** 4 whereExists methods  
**Lines:** 297-325, 340-355, 370-385, 400-415  
**Duplication:** Similar logic across 4 methods  

**New Method:**
```javascript
/**
 * Build EXISTS subquery for relation
 * @private
 * @param {string} relatedTable - Related table name
 * @param {string} foreignKey - Foreign key column
 * @param {string} localKey - Local key column
 * @param {function|null} callback - Optional conditions callback
 * @param {string} type - EXISTS, OR_EXISTS, NOT_EXISTS, OR_NOT_EXISTS
 * @returns {object} WHERE condition object
 */
_buildExistsSubquery(relatedTable, foreignKey, localKey, callback, type) {
  const subQuery = new QueryBuilder();
  subQuery.select('1').from(relatedTable);
  subQuery.where(`${relatedTable}.${foreignKey}`, new RawSql(`${this.query.table}.${localKey}`));

  if (callback && typeof callback === 'function') {
    callback(subQuery);
  }

  return {
    type: type,
    subQuery: subQuery,
    relation: { relatedTable, foreignKey, localKey }
  };
}
```

**Impact:** Simplifies 4 methods significantly  
**Commit Message:** `Refactor(queryBuilder): extract _buildExistsSubquery() helper`

---

### Phase 2: Split Large Methods (Medium Priority)

#### 2.1 Split `_loadRelations()` Method
**Current Size:** 160 lines  
**Complexity:** High - handles composite keys, nested relations, hasOne/hasMany  

**New Structure:**
```javascript
async _loadRelations(rows, relations) {
  for (const relation of relations) {
    if (Array.isArray(relation.foreignKey)) {
      await this._loadCompositeKeyRelation(rows, relation);
    } else {
      await this._loadSimpleKeyRelation(rows, relation);
    }
  }
  return rows;
}

async _loadCompositeKeyRelation(rows, relation) { /* ... */ }
async _loadSimpleKeyRelation(rows, relation) { /* ... */ }
```

**Impact:** Improves readability and testability  
**Commit Message:** `Refactor(queryBuilder): split _loadRelations() into smaller methods`

---

#### 2.2 Split `buildWhere()` Method
**Current Size:** 81 lines  
**Complexity:** High - handles multiple condition types  

**New Structure:**
```javascript
buildWhere() {
  if (this.query.where.length === 0) return '';

  let sql = ' WHERE ';
  let groupLevel = 0;
  let conditionsInGroup = [0];

  this.query.where.forEach((condition, index) => {
    sql += this._buildWhereCondition(condition, index, groupLevel, conditionsInGroup);
  });

  return sql;
}

_buildWhereCondition(condition, index, groupLevel, conditionsInGroup) { /* ... */ }
_buildExistsCondition(condition, groupLevel, conditionsInGroup) { /* ... */ }
_buildAggregateCondition(condition, groupLevel, conditionsInGroup) { /* ... */ }
_buildRegularCondition(condition, groupLevel, conditionsInGroup) { /* ... */ }
```

---

#### 2.3 Split `buildSql()` Method
**Current Size:** 109 lines  
**Complexity:** High - large switch statement  

**New Structure:**
```javascript
buildSql() {
  if (!this.query.type) this.query.type = 'SELECT';

  switch (this.query.type) {
    case 'SELECT': return this._buildSelectSql();
    case 'INSERT': return this._buildInsertSql();
    case 'UPDATE': return this._buildUpdateSql();
    case 'DELETE': return this._buildDeleteSql();
  }
}

_buildSelectSql() { /* ... */ }
_buildInsertSql() { /* ... */ }
_buildUpdateSql() { /* ... */ }
_buildDeleteSql() { /* ... */ }
```

---

### Phase 3: File Organization (Optional, Low Priority)

#### 3.1 Consider Module Split
**Only if file remains > 1000 lines after Phase 1 & 2**

Potential structure:
```
utils/queryBuilder/
├── index.js                  # Factory function + main export
├── QueryBuilder.js           # Core query building methods
├── AggregateBuilder.js       # Aggregate methods (withSum, withCount, etc.)
├── RelationLoader.js         # Eager loading (_loadRelations, etc.)
├── SqlBuilder.js             # SQL generation (buildSql, buildWhere, etc.)
└── RawSql.js                 # RawSql class
```

**Considerations:**
- Only if complexity justifies split
- Keep backward compatibility (`require('./queryBuilder')` still works)
- May introduce circular dependencies - weigh benefits carefully

---

## Commit Message Format
```
Refactor(queryBuilder): <short description>

- What: Brief description of change
- Why: Reason for refactoring
- Impact: Line count reduction or complexity improvement
```

**Example:**
```
Refactor(queryBuilder): extract _buildAggregateSubquery() method

- What: Extract duplicate aggregate subquery building logic
- Why: Code duplicated in where() and orWhere() methods
- Impact: Reduces 100 lines to 50, improves maintainability
```

---

## Testing Protocol

Before EVERY code change:
```bash
npm test
```

After EVERY code change:
```bash
npm test
```

If tests fail:
1. STOP immediately
2. Revert changes
3. Analyze failure
4. Fix or adjust approach
5. Try again

---

## Success Metrics

### Phase 1 Targets
- [ ] Reduce total lines from 1,795 to < 1,500
- [ ] Eliminate 150+ lines of duplication
- [ ] Maintain 100% test pass rate
- [ ] No public API changes

### Phase 2 Targets
- [ ] No method > 80 lines
- [ ] Improve cyclomatic complexity
- [ ] Split complex methods into focused helpers
- [ ] Maintain 100% test pass rate

### Phase 3 (If Needed)
- [ ] File < 1,000 lines or logically split
- [ ] Clear module boundaries
- [ ] Zero breaking changes
- [ ] Maintain 100% test pass rate

---

## Rollback Plan

If any refactoring step causes issues:

1. **Immediate:** `git revert <commit-hash>`
2. **Review:** Analyze what went wrong
3. **Adjust:** Smaller increments or different approach
4. **Retry:** With adjusted strategy

---

## Notes

- **Don't rush:** Small, tested increments are faster than large rewrites
- **Preserve behavior:** Tests verify no regression
- **Keep API stable:** No breaking changes for consumers
- **Document decisions:** Why you chose specific refactoring approaches
- **Stop if uncertain:** Ask for clarification rather than guess

---

## References

- Refactoring-Code Skill: `.github/skills/refactoring-code/SKILL.md`
- Test Suite: `tests/queryBuilder.test.js`
- Original File: `utils/queryBuilder.js`
- Seeder (for test data): `seeder.js`

---

**Created:** February 7, 2026  
**Status:** Ready for Phase 1 (pending test suite validation)
