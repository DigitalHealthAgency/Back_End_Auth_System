// src/routes/admin/adminUsersRoutes.js
const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  createUser,
  getUserById,
  updateUserStatus,
  updateUserRole,
  deleteUser,
  exportUsers
} = require('../../controllers/admin/adminUsersController');
const auth = require('../../middleware/authMiddleware');
const { requireAdminRole } = require('../../middleware/rbac');

// All routes require authentication and admin role
router.use(auth);
router.use(requireAdminRole());

// User management routes
router.get('/export', exportUsers);  // Must be before /:id route
router.get('/', getAllUsers);
router.post('/', createUser);
router.get('/:id', getUserById);
router.patch('/:id/status', updateUserStatus);
router.patch('/:id/role', updateUserRole);
router.delete('/:id', deleteUser);

module.exports = router;
