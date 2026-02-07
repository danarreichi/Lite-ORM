const mysql = require('mysql2/promise');

// Database configuration
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'fox_jump_over_the_fence', // Update with your MySQL password
  database: 'node_app_db',
  multipleStatements: true
};

async function checkMySQLConnection() {
  try {
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password
    });
    await connection.end();
    return true;
  } catch (error) {
    console.error('❌ MySQL connection failed!');
    console.log('\n🔧 MySQL Setup Instructions:');
    console.log('1. Install MySQL Server (https://dev.mysql.com/downloads/mysql/)');
    console.log('2. Start MySQL service');
    console.log('3. Update password in seeder.js dbConfig if needed');
    console.log('4. Or use a different MySQL user with proper permissions');
    console.log('\n💡 Alternative: Use a cloud database like PlanetScale or Railway');
    return false;
  }
}

async function createDatabase() {
  try {
    // Connect without database first
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      multipleStatements: true
    });

    // Create database if it doesn't exist
    await connection.execute('CREATE DATABASE IF NOT EXISTS node_app_db');
    console.log('✅ Database created successfully');

    await connection.end();

    // Connect to the specific database
    const dbConnection = await mysql.createConnection(dbConfig);
    return dbConnection;
  } catch (error) {
    console.error('❌ Error creating database:', error);
    throw error;
  }
}

async function createTables(connection) {
  try {
    // Users table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(50),
        last_name VARCHAR(50),
        phone VARCHAR(20),
        address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Users table created');

    // Payment methods table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS payment_methods (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        type ENUM('credit_card', 'debit_card', 'paypal', 'bank_transfer', 'cash') NOT NULL,
        provider VARCHAR(50),
        account_number VARCHAR(100),
        expiry_date DATE,
        is_default BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Payment methods table created');

    // Transactions table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        payment_method_id INT,
        transaction_number VARCHAR(50) UNIQUE NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL,
        tax_amount DECIMAL(10,2) DEFAULT 0,
        discount_amount DECIMAL(10,2) DEFAULT 0,
        status ENUM('pending', 'processing', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
        transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL
      )
    `);
    console.log('✅ Transactions table created');

    // Transaction details table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS transaction_details (
        id INT AUTO_INCREMENT PRIMARY KEY,
        transaction_id INT NOT NULL,
        item_name VARCHAR(100) NOT NULL,
        item_description TEXT,
        quantity INT NOT NULL DEFAULT 1,
        unit_price DECIMAL(10,2) NOT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        category VARCHAR(50),
        sku VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Transaction details table created');

    // Payment histories table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS payment_histories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        transaction_id INT NOT NULL,
        payment_method_id INT,
        amount DECIMAL(10,2) NOT NULL,
        status ENUM('initiated', 'processing', 'success', 'failed', 'refunded') DEFAULT 'initiated',
        gateway_response TEXT,
        reference_number VARCHAR(100),
        processed_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
        FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL
      )
    `);
    console.log('✅ Payment histories table created');

  } catch (error) {
    console.error('❌ Error creating tables:', error);
    throw error;
  }
}

async function seedData(connection) {
  try {
    // Insert sample users
    const [userResult] = await connection.execute(`
      INSERT INTO users (username, email, password_hash, first_name, last_name, phone, address) VALUES
      ('john_doe', 'john@example.com', '$2b$10$hashedpassword1', 'John', 'Doe', '+1234567890', '123 Main St, City, State 12345'),
      ('jane_smith', 'jane@example.com', '$2b$10$hashedpassword2', 'Jane', 'Smith', '+1234567891', '456 Oak Ave, City, State 12346'),
      ('bob_wilson', 'bob@example.com', '$2b$10$hashedpassword3', 'Bob', 'Wilson', '+1234567892', '789 Pine Rd, City, State 12347')
    `);
    console.log('✅ Users seeded');

    // Insert payment methods
    await connection.execute(`
      INSERT INTO payment_methods (user_id, type, provider, account_number, expiry_date, is_default) VALUES
      (1, 'credit_card', 'Visa', '****-****-****-1234', '2025-12-31', TRUE),
      (1, 'paypal', 'PayPal', 'john@example.com', NULL, FALSE),
      (2, 'debit_card', 'MasterCard', '****-****-****-5678', '2024-10-31', TRUE),
      (3, 'bank_transfer', 'Bank of America', '****1234', NULL, TRUE)
    `);
    console.log('✅ Payment methods seeded');

    // Insert transactions
    const [transactionResult] = await connection.execute(`
      INSERT INTO transactions (user_id, payment_method_id, transaction_number, total_amount, tax_amount, discount_amount, status, notes) VALUES
      (1, 1, 'TXN-2024-001', 150.00, 15.00, 5.00, 'completed', 'First purchase'),
      (2, 3, 'TXN-2024-002', 89.99, 8.99, 0.00, 'completed', 'Electronics purchase'),
      (1, 1, 'TXN-2024-003', 45.50, 4.55, 2.00, 'processing', 'Book order'),
      (3, 4, 'TXN-2024-004', 299.99, 29.99, 10.00, 'pending', 'Large order')
    `);
    console.log('✅ Transactions seeded');

    // Insert transaction details
    await connection.execute(`
      INSERT INTO transaction_details (transaction_id, item_name, item_description, quantity, unit_price, total_price, category, sku) VALUES
      (1, 'Wireless Headphones', 'Bluetooth wireless headphones with noise cancellation', 1, 120.00, 120.00, 'Electronics', 'WH-001'),
      (1, 'Phone Case', 'Protective case for smartphone', 1, 25.00, 25.00, 'Accessories', 'PC-001'),
      (2, 'USB Cable', 'Fast charging USB-C cable', 2, 12.99, 25.98, 'Electronics', 'UC-001'),
      (2, 'Wireless Mouse', 'Ergonomic wireless mouse', 1, 39.99, 39.99, 'Electronics', 'WM-001'),
      (2, 'Screen Protector', 'Tempered glass screen protector', 1, 24.02, 24.02, 'Accessories', 'SP-001'),
      (3, 'Programming Book', 'Advanced JavaScript programming guide', 1, 35.00, 35.00, 'Books', 'PB-001'),
      (3, 'Coffee Mug', 'Developer themed coffee mug', 1, 10.50, 10.50, 'Accessories', 'CM-001'),
      (4, 'Laptop Stand', 'Adjustable aluminum laptop stand', 1, 89.99, 89.99, 'Electronics', 'LS-001'),
      (4, 'External Hard Drive', '2TB portable hard drive', 1, 149.99, 149.99, 'Electronics', 'HD-001'),
      (4, 'Cable Organizer', 'Desk cable management solution', 1, 60.01, 60.01, 'Accessories', 'CO-001')
    `);
    console.log('✅ Transaction details seeded');

    // Insert payment histories
    await connection.execute(`
      INSERT INTO payment_histories (transaction_id, payment_method_id, amount, status, reference_number, processed_at) VALUES
      (1, 1, 150.00, 'success', 'REF-001-123456', '2024-01-15 10:30:00'),
      (2, 3, 89.99, 'success', 'REF-002-789012', '2024-01-16 14:20:00'),
      (3, 1, 45.50, 'processing', 'REF-003-345678', NULL),
      (4, 4, 299.99, 'initiated', 'REF-004-901234', NULL)
    `);
    console.log('✅ Payment histories seeded');

  } catch (error) {
    console.error('❌ Error seeding data:', error);
    throw error;
  }
}

async function runSeeder() {
  let connection;

  try {
    console.log('🚀 Starting database seeder...');

    // Check MySQL connection first
    const isConnected = await checkMySQLConnection();
    if (!isConnected) {
      console.log('💡 Seeder requires MySQL to be running. Please set up MySQL first.');
      return;
    }

    connection = await createDatabase();
    await createTables(connection);
    await seedData(connection);

    console.log('🎉 Database seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log('- 3 users created');
    console.log('- 4 payment methods created');
    console.log('- 4 transactions created');
    console.log('- 10 transaction details created');
    console.log('- 4 payment histories created');

  } catch (error) {
    console.error('💥 Seeder failed:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run seeder if called directly
if (require.main === module) {
  runSeeder();
}

module.exports = { runSeeder, createDatabase, createTables, seedData };