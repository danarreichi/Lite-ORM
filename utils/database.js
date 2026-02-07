const mysql = require('mysql2/promise');

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'fox_jump_over_the_fence',
  database: process.env.DB_NAME || 'node_app_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Create connection pool
let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
  }
  return pool;
}

// Test database connection
async function testConnection() {
  try {
    const connection = await getPool().getConnection();
    console.log('✅ Database connected successfully');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

// Generic query function
async function query(sql, params = []) {
  try {
    const [rows, fields] = await getPool().execute(sql, params);
    return { rows, fields };
  } catch (error) {
    console.error('❌ Query error:', error.message);
    throw error;
  }
}

// Get single row
async function queryOne(sql, params = []) {
  const result = await query(sql, params);
  return result.rows[0] || null;
}

// Get single value
async function queryValue(sql, params = []) {
  const result = await query(sql, params);
  if (result.rows.length > 0) {
    const firstRow = result.rows[0];
    return Object.values(firstRow)[0];
  }
  return null;
}

// Insert and return insert ID
async function insert(sql, params = []) {
  try {
    const [result] = await getPool().execute(sql, params);
    return result.insertId;
  } catch (error) {
    console.error('❌ Insert error:', error.message);
    throw error;
  }
}

// Update and return affected rows
async function update(sql, params = []) {
  try {
    const [result] = await getPool().execute(sql, params);
    return result.affectedRows;
  } catch (error) {
    console.error('❌ Update error:', error.message);
    throw error;
  }
}

// Delete and return affected rows
async function deleteQuery(sql, params = []) {
  try {
    const [result] = await getPool().execute(sql, params);
    return result.affectedRows;
  } catch (error) {
    console.error('❌ Delete error:', error.message);
    throw error;
  }
}

// Transaction helper
async function transaction(callback) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();

    const result = await callback(connection);

    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    console.error('❌ Transaction error:', error.message);
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  getPool,
  testConnection,
  query,
  queryOne,
  queryValue,
  insert,
  update,
  deleteQuery,
  transaction
};