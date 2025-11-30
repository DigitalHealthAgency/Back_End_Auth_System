const express = require('express');
const router = express.Router();
const migrateController = require('../controllers/migrateController');

router.post('/admin/migrate', migrateController.migrateToPostgres);

module.exports = router;