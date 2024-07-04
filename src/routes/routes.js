const express = require('express');
const router = express.Router();
const controller = require('../controller/controller');

// Define the route and attach the controller function
router.post('/getTotalCost', controller.getTotalCost);

module.exports = router;
