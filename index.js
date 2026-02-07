const express = require('express');
const app = express();

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set view engine to EJS
app.set('view engine', 'ejs');
app.set('views', './views');

// Import routes
const indexRouter = require('./routes/index');
app.use('/', indexRouter);

const port = 3000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});