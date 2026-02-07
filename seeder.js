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
    // Drop existing tables if they exist (to ensure fresh schema)
    await connection.execute('SET FOREIGN_KEY_CHECKS=0');
    await connection.execute('DROP TABLE IF EXISTS order_items');
    await connection.execute('DROP TABLE IF EXISTS orders');
    await connection.execute('DROP TABLE IF EXISTS stores');
    await connection.execute('DROP TABLE IF EXISTS user_product_favorites');
    await connection.execute('DROP TABLE IF EXISTS reviews');
    await connection.execute('DROP TABLE IF EXISTS transaction_details');
    await connection.execute('DROP TABLE IF EXISTS payment_histories');
    await connection.execute('DROP TABLE IF EXISTS transactions');
    await connection.execute('DROP TABLE IF EXISTS payment_methods');
    await connection.execute('DROP TABLE IF EXISTS products');
    await connection.execute('DROP TABLE IF EXISTS categories');
    await connection.execute('DROP TABLE IF EXISTS users');
    await connection.execute('SET FOREIGN_KEY_CHECKS=1');
    console.log('✅ Old tables dropped');

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

    // EXAMPLE: Categories table (create early since products references it)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Categories table created');

    // EXAMPLE: Products table (needs to exist before transaction_details references it)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        category_id INT NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        stock INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
      )
    `);
    console.log('✅ Products table created');

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

    // Transaction details table (now products exists!)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS transaction_details (
        id INT AUTO_INCREMENT PRIMARY KEY,
        transaction_id INT NOT NULL,
        product_id INT NOT NULL,
        item_name VARCHAR(100) NOT NULL,
        item_description TEXT,
        quantity INT NOT NULL DEFAULT 1,
        unit_price DECIMAL(10,2) NOT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        category VARCHAR(50),
        sku VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
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

    // EXAMPLE: Reviews table (uses 2 foreign keys)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        product_id INT NOT NULL,
        rating INT CHECK (rating >= 1 AND rating <= 5),
        title VARCHAR(100),
        content TEXT,
        is_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Reviews table created (2 Foreign Keys example)');

    // COMPOSITE KEY EXAMPLE: User Product Favorites
    // Uses composite primary key (user_id, product_id) - no separate id column!
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS user_product_favorites (
        user_id INT NOT NULL,
        product_id INT NOT NULL,
        favorited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        PRIMARY KEY (user_id, product_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ User Product Favorites table created (COMPOSITE PRIMARY KEY example)');

    // MULTIPLE FOREIGN KEYS EXAMPLE: Store-sharded Orders
    // Demonstrates relationships that match on MULTIPLE columns
    
    // Stores table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS stores (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        location VARCHAR(200),
        region VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Stores table created');

    // Orders table (sharded by store_id)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        store_id INT NOT NULL,
        user_id INT NOT NULL,
        order_number VARCHAR(50) UNIQUE NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL,
        status ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
        order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_store_order (store_id, id)
      )
    `);
    console.log('✅ Orders table created (with store_id for sharding)');

    // Order items table - MUST match BOTH order_id AND store_id
    // This demonstrates MULTIPLE FOREIGN KEY matching!
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        store_id INT NOT NULL,
        product_id INT NOT NULL,
        item_name VARCHAR(100) NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        unit_price DECIMAL(10,2) NOT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
        INDEX idx_order_store (order_id, store_id)
      )
    `);
    console.log('✅ Order Items table created (MULTIPLE FOREIGN KEY example - matches order_id AND store_id)');


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

    // Seed Categories (must come before products)
    const [categoryResult] = await connection.execute(`
      INSERT INTO categories (name, description) VALUES
      ('Electronics', 'Electronic devices and gadgets'),
      ('Books', 'Books and educational materials'),
      ('Accessories', 'Phone and computer accessories')
    `);
    console.log('✅ Categories seeded');

    // Seed Products (must come before transaction_details)
    const [productResult] = await connection.execute(`
      INSERT INTO products (name, category_id, description, price, stock) VALUES
      ('Wireless Headphones', 1, 'Bluetooth headphones with noise cancellation', 99.99, 50),
      ('Programming Book', 2, 'Advanced JavaScript Programming Guide', 45.00, 30),
      ('Phone Case', 3, 'Protective smartphone case', 25.00, 100),
      ('USB-C Cable', 1, 'Fast charging USB-C cable', 12.99, 200),
      ('Desk Lamp', 1, 'LED desk lamp with USB charging', 34.99, 25)
    `);
    console.log('✅ Products seeded');

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
      INSERT INTO transaction_details (transaction_id, product_id, item_name, item_description, quantity, unit_price, total_price, category, sku) VALUES
      (1, 1, 'Wireless Headphones', 'Bluetooth wireless headphones with noise cancellation', 1, 99.99, 99.99, 'Electronics', 'WH-001'),
      (1, 3, 'Phone Case', 'Protective case for smartphone', 1, 25.00, 25.00, 'Accessories', 'PC-001'),
      (2, 4, 'USB-C Cable', 'Fast charging USB-C cable', 2, 12.99, 25.98, 'Electronics', 'UC-001'),
      (2, 5, 'Desk Lamp', 'LED desk lamp with USB charging', 1, 39.99, 39.99, 'Electronics', 'LS-001'),
      (2, 3, 'Phone Case', 'Protective smartphone case', 1, 24.02, 24.02, 'Accessories', 'PC-001'),
      (3, 2, 'Programming Book', 'Advanced JavaScript programming guide', 1, 35.00, 35.00, 'Books', 'PB-001'),
      (3, 3, 'Phone Case', 'Protective case for smartphone', 1, 10.50, 10.50, 'Accessories', 'PC-001'),
      (4, 5, 'Desk Lamp', 'LED desk lamp with USB charging', 1, 89.99, 89.99, 'Electronics', 'LS-001'),
      (4, 1, 'Wireless Headphones', 'Bluetooth headphones with noise cancellation', 1, 99.99, 99.99, 'Electronics', 'WH-001'),
      (4, 4, 'USB-C Cable', 'Fast charging USB-C cable', 1, 60.01, 60.01, 'Accessories', 'UC-001')
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

    // Seed Reviews (with 2 foreign keys)
    // user_id references users table, product_id references products table
    await connection.execute(`
      INSERT INTO reviews (user_id, product_id, rating, title, content, is_verified) VALUES
      (1, 1, 5, 'Excellent quality!', 'Great sound and very comfortable to wear. Highly recommended!', TRUE),
      (1, 3, 4, 'Good protection', 'Protects my phone well, though a bit bulky', TRUE),
      (2, 2, 5, 'Must read for developers', 'Outstanding book for learning advanced concepts', TRUE),
      (2, 4, 3, 'Decent cable', 'Works fine but seems durable', FALSE),
      (3, 1, 4, 'Worth the price', 'Good headphones for the price point', TRUE),
      (3, 5, 5, 'Perfect for my desk', 'Bright light and looks good on my workspace', TRUE)
    `);
    console.log('✅ Reviews seeded (2 Foreign Keys example)');

    // Seed User Product Favorites (COMPOSITE KEY table)
    // Notice: No id column! Primary key is the combination of (user_id, product_id)
    await connection.execute(`
      INSERT INTO user_product_favorites (user_id, product_id, notes) VALUES
      (1, 1, 'Want to buy another one as a gift'),
      (1, 2, 'Great book, recommend to friends'),
      (1, 4, 'Need more of these cables'),
      (2, 1, 'Saving for purchase'),
      (2, 5, 'Perfect for home office'),
      (3, 2, 'On my reading list'),
      (3, 3, 'Need this for new phone'),
      (3, 4, NULL)
    `);
    console.log('✅ User Product Favorites seeded (COMPOSITE KEY example)');

    // Seed Stores
    await connection.execute(`
      INSERT INTO stores (name, location, region) VALUES
      ('Downtown Store', '123 Main St, Downtown', 'North'),
      ('Westside Mall', '456 West Ave, Westside', 'West'),
      ('Eastside Plaza', '789 East Blvd, Eastside', 'East')
    `);
    console.log('✅ Stores seeded');

    // Seed Orders (sharded by store_id)
    await connection.execute(`
      INSERT INTO orders (store_id, user_id, order_number, total_amount, status) VALUES
      (1, 1, 'ORD-2024-001', 149.99, 'delivered'),
      (1, 2, 'ORD-2024-002', 89.99, 'shipped'),
      (2, 1, 'ORD-2024-003', 234.50, 'processing'),
      (2, 3, 'ORD-2024-004', 45.00, 'pending'),
      (3, 2, 'ORD-2024-005', 299.99, 'delivered'),
      (3, 3, 'ORD-2024-006', 124.99, 'shipped')
    `);
    console.log('✅ Orders seeded (with store_id sharding)');

    // Seed Order Items - MUST match both order_id AND store_id
    // This demonstrates the MULTIPLE FOREIGN KEY relationship!
    await connection.execute(`
      INSERT INTO order_items (order_id, store_id, product_id, item_name, quantity, unit_price, total_price) VALUES
      -- Order 1 (store_id: 1)
      (1, 1, 1, 'Wireless Headphones', 1, 99.99, 99.99),
      (1, 1, 3, 'Phone Case', 2, 25.00, 50.00),
      -- Order 2 (store_id: 1)
      (2, 1, 4, 'USB-C Cable', 3, 12.99, 38.97),
      (2, 1, 5, 'Desk Lamp', 1, 34.99, 34.99),
      -- Order 3 (store_id: 2)
      (3, 2, 1, 'Wireless Headphones', 2, 99.99, 199.98),
      (3, 2, 2, 'Programming Book', 1, 45.00, 45.00),
      -- Order 4 (store_id: 2)
      (4, 2, 3, 'Phone Case', 1, 25.00, 25.00),
      -- Order 5 (store_id: 3)
      (5, 3, 1, 'Wireless Headphones', 1, 99.99, 99.99),
      (5, 3, 5, 'Desk Lamp', 2, 34.99, 69.98),
      (5, 3, 4, 'USB-C Cable', 5, 12.99, 64.95),
      -- Order 6 (store_id: 3)
      (6, 3, 2, 'Programming Book', 1, 45.00, 45.00),
      (6, 3, 3, 'Phone Case', 3, 25.00, 75.00)
    `);
    console.log('✅ Order Items seeded (MULTIPLE FOREIGN KEY - matches order_id AND store_id)');

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
    console.log('\n📚 2 Foreign Keys Example:');
    console.log('- 3 categories created');
    console.log('- 5 products created');
    console.log('- 6 reviews created (user_id + product_id)');
    console.log('\n🔑 COMPOSITE PRIMARY KEY Example:');
    console.log('- 8 user_product_favorites created');
    console.log('- Primary Key: (user_id, product_id) - no id column!');
    console.log('\n🔗 MULTIPLE FOREIGN KEYS Example:');
    console.log('- 3 stores created');
    console.log('- 6 orders created (sharded by store_id)');
    console.log('- 12 order_items created');
    console.log('- Relationship: order_items matches BOTH order_id AND store_id!');
    console.log('- Use case: Database sharding, multi-tenant systems');

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