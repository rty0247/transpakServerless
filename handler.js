'use strict';

const serverless = require('serverless-http');
const express = require('express');
const routes = require('./src/routes/routes');

const app = express();
//const port = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Middleware to parse URL-encoded bodies (form submissions)
app.use(express.urlencoded({ extended: true }));

// Use the routes defined in your routes file
app.use('/api', routes);

// Export the app for local running and the handler for Lambda
module.exports = {
  app, // For local running
  handler: serverless(app), // For AWS Lambda
};
