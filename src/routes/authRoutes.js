// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const validate = require('../middleware/validate');
const validateRegistration = require('../middleware/validateRegistration');
const {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  updateProfileSchema ,
  terminateAccountSchema,
  setupPasswordSchema,
  createBoardMemberUserSchema
} = require('../validators/authValidator');
const {
  register,
  login,
  logout,
  getProfile,
  updateProfile,
  changePassword,
  regenerateAccessKey,
  uploadLogo,
  deleteLogo,
  terminateAccount,
  abortTermination,
  setupPassword,
  createBoardMemberUser,
  getOrganizationMembers,
  updateUserRole,
  updateUserBoardRole,
  updateUserProfile,
  updateUserAccountStatus,
  findUserByEmail,
  checkUserPasswordExists,
  deactivateUser,
  sendInternalEmail,
  getUserById,
  getUsersByIds,
  createUserByAdmin,
  firstTimePasswordChange
} = require('../controllers/authController');
const auth = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadLogo');
const { getSessions, terminateSession } = require('../controllers/sessionController');
const { requireRole } = require('../middleware/rbac');
const { autoUnlockMiddleware } = require('../middleware/autoUnlock'); //  CRITICAL FIX: Auto-unlock middleware
const { checkPasswordExpiry } = require('../middleware/passwordExpiryCheck'); //  CRITICAL FIX: Password expiry check

// Public routes
router.post('/register', validateRegistration, register);
router.post('/login', autoUnlockMiddleware, validate(loginSchema), login); //  CRITICAL FIX: Apply auto-unlock before login
router.post('/setup-password', validate(setupPasswordSchema), setupPassword);
router.post('/logout', auth, logout);

// Protected routes
router.get('/me', auth, checkPasswordExpiry, getProfile); //  FIX: Block API access with expired password
router.get('/profile', auth, checkPasswordExpiry, getProfile); // Alias for backward compatibility with tests
router.patch('/me', auth, checkPasswordExpiry, validate(updateProfileSchema), updateProfile); //  FIX: Block API access with expired password
router.put('/profile', auth, checkPasswordExpiry, validate(updateProfileSchema), updateProfile); // Alias for backward compatibility with tests (PUT method)
router.patch('/profile', auth, checkPasswordExpiry, validate(updateProfileSchema), updateProfile); // Alias for backward compatibility with tests (PATCH method)
router.patch('/change-password', auth, validate(changePasswordSchema), changePassword); //  FIX: Allow password change with expired password
router.post('/change-password', auth, validate(changePasswordSchema), changePassword); //  FIX: Allow password change with expired password
router.post('/first-time-password-change', auth, firstTimePasswordChange);

// Admin-only routes
router.post('/admin/create-user', auth, auth.checkFirstTimeSetup, requireRole(['dha_system_administrator']), createUserByAdmin);
router.post('/regenerate-access-key', auth, regenerateAccessKey);
router.post('/me/logo', auth, (req, res, next) => {
  //console.log('Logo upload route hit');
  upload.single('logo')(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err);
      return res.status(400).json({ message: err.message });
    }
    next();
  });
}, uploadLogo); 
router.delete('/logo', auth, deleteLogo);
router.get('/sessions', auth, getSessions);
router.delete('/sessions/:sessionId', auth, terminateSession);
router.post('/terminate', auth, validate(terminateAccountSchema), terminateAccount);
router.post('/abort-termination', auth, abortTermination);

// Internal API routes for board member management (with service validation)
router.post('/internal/board-member-user', auth.internalServiceOnly, validate(createBoardMemberUserSchema), createBoardMemberUser);
router.get('/internal/organization/:registrationNumber/members', auth.internalServiceOnly, getOrganizationMembers);
router.get('/internal/user/by-email/:email', auth.internalServiceOnly, findUserByEmail);
router.get('/internal/user/:userId/password-exists', auth.internalServiceOnly, checkUserPasswordExists);
router.patch('/internal/user/:userId/board-role', auth.internalServiceOnly, updateUserBoardRole);
router.patch('/internal/user/:userId/profile', auth.internalServiceOnly, updateUserProfile);
router.patch('/internal/user/:userId/status', auth.internalServiceOnly, updateUserAccountStatus);
router.patch('/internal/user/:userId/deactivate', auth.internalServiceOnly, deactivateUser);
router.post('/internal/send-email', auth.internalServiceOnly, sendInternalEmail);
router.get('/internal/user/:userId', auth.internalServiceOnly, getUserById);
router.post('/internal/users/batch', auth.internalServiceOnly, getUsersByIds);

module.exports = router;
