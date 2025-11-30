// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const validate = require('../middleware/validate');
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
  getUsersByIds
} = require('../controllers/authController');
const auth = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadLogo');
const { getSessions, terminateSession } = require('../controllers/sessionController');

// Public routes
router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/setup-password', validate(setupPasswordSchema), setupPassword);
router.get('/logout', logout);

// Protected routes
router.get('/me', auth, getProfile);
router.patch('/me', auth, validate(updateProfileSchema), updateProfile);
router.patch('/change-password', auth, validate(changePasswordSchema), changePassword);
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
