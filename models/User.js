const db = require('../utils/database');

class User {
  // Get all users
  static async findAll() {
    const sql = 'SELECT * FROM users ORDER BY created_at DESC';
    const result = await db.query(sql);
    return result.rows;
  }

  // Get user by ID
  static async findById(id) {
    const sql = 'SELECT * FROM users WHERE id = ?';
    const result = await db.queryOne(sql, [id]);
    return result;
  }

  // Get user by email
  static async findByEmail(email) {
    const sql = 'SELECT * FROM users WHERE email = ?';
    const result = await db.queryOne(sql, [email]);
    return result;
  }

  // Create new user
  static async create(userData) {
    const { username, email, password_hash, first_name, last_name, phone, address } = userData;
    const sql = `
      INSERT INTO users (username, email, password_hash, first_name, last_name, phone, address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const insertId = await db.insert(sql, [username, email, password_hash, first_name, last_name, phone, address]);
    return insertId;
  }

  // Update user
  static async update(id, userData) {
    const { username, email, first_name, last_name, phone, address } = userData;
    const sql = `
      UPDATE users
      SET username = ?, email = ?, first_name = ?, last_name = ?, phone = ?, address = ?
      WHERE id = ?
    `;
    const affectedRows = await db.update(sql, [username, email, first_name, last_name, phone, address, id]);
    return affectedRows;
  }

  // Delete user
  static async delete(id) {
    const sql = 'DELETE FROM users WHERE id = ?';
    const affectedRows = await db.deleteQuery(sql, [id]);
    return affectedRows;
  }

  // Get user with payment methods
  static async findWithPaymentMethods(id) {
    const sql = `
      SELECT u.*, pm.*
      FROM users u
      LEFT JOIN payment_methods pm ON u.id = pm.user_id
      WHERE u.id = ?
    `;
    const result = await db.query(sql, [id]);
    return result.rows;
  }

  // Search users
  static async search(searchTerm) {
    const sql = `
      SELECT * FROM users
      WHERE username LIKE ? OR email LIKE ? OR first_name LIKE ? OR last_name LIKE ?
      ORDER BY created_at DESC
    `;
    const searchPattern = `%${searchTerm}%`;
    const result = await db.query(sql, [searchPattern, searchPattern, searchPattern, searchPattern]);
    return result.rows;
  }

  // Get user statistics
  static async getStats() {
    const sql = `
      SELECT
        COUNT(*) as total_users,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as new_users_30_days
      FROM users
    `;
    const result = await db.queryOne(sql);
    return result;
  }
}

module.exports = User;