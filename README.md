# Node New Project

A simple Node.js project that runs a basic HTTP server.

## Development

### Running in Development Mode

For development with automatic server restarts on code changes:

```bash
npm run dev
```

This uses nodemon to watch for file changes and automatically restart the server.

### Running in Production Mode

```bash
npm start
```

## Database Setup

This project includes a MySQL database seeder for development and testing.

### Prerequisites
- MySQL Server installed and running
- Node.js dependencies installed (`npm install`)

### Database Seeding

To create the database tables and populate with sample data:

```bash
npm run seed
```

This will create:
- `node_app_db` database
- 5 tables: users, payment_methods, transactions, transaction_details, payment_histories
- Sample data for testing

### Database Configuration

Update the database credentials in `seeder.js`:

```javascript
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'your_mysql_password', // Update this
  database: 'node_app_db',
  multipleStatements: true
};
```

## Troubleshooting

- If port 3000 is in use, change the port in index.js.
- Make sure Node.js is installed.
- For database issues, ensure MySQL is running and credentials are correct.