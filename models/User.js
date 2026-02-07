const db = require('../utils/database');
const { query } = require('../utils/queryBuilder');

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

  // New static method to enable User.where().get() syntax
  static where(...args) {
    return query('users').where(...args);
  }
}

module.exports = User;