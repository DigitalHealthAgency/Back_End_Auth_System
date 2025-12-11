// src/routes/testRoutes.js
const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const Test = require('../models/Test');

// Separation of Duties Middleware for Tests
const checkTestSOD = async (req, res, next) => {
  const test = await Test.findById(req.params.id);
  if (!test) {
    return res.status(404).json({ message: 'Test not found' });
  }

  const user = req.user;

  // SOD-003: Testing Lab Assignment
  if (user.role === 'testing_lab_staff') {
    if (!test.assignedTo || test.assignedTo.toString() !== user._id.toString()) {
      return res.status(403).json({
        message: 'Separation of duties violation: Can only access assigned tests',
        code: 'SOD-003',
        details: { violation: 'unassigned_access' }
      });
    }
  }

  // SOD-005: Vendor cannot execute tests
  if (['vendor_developer', 'vendor_technical_lead', 'vendor_compliance_officer'].includes(user.role)) {
    if (req.route.path.endsWith('/execute')) {
      return res.status(403).json({
        message: 'Separation of duties violation: Vendors cannot execute tests',
        code: 'SOD-005',
        details: { violation: 'vendor_test_restriction' }
      });
    }
  }

  req.test = test;
  next();
};

// Routes
router.get('/:id', protect, checkTestSOD, async (req, res) => {
  try {
    res.status(200).json(req.test);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/:id/execute', protect, checkTestSOD, async (req, res) => {
  try {
    res.status(200).json({ message: 'Test executed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
