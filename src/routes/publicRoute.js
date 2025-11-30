const express = require('express');
const { getPublicSettings } = require('../controllers/admin/systemController');
const router = express.Router();

// Public routes
router.get('/settings', getPublicSettings);




module.exports = router;