import { Router } from 'express';
import { body } from 'express-validator';
import {
  register,
  login,
  verifyCustomerLogin2FA,
  resendCustomerLogin2FA,
  verifyRegistrationOtp,
  resendRegistrationOtp,
  requestOtpAssistance,
  getOtpAssistanceStatus,
  completeOtpAssistance,
  getMe,
  updateProfile,
  requestConversionOtpOnline,
  verifyConversionOtpOnline,
  forgotPasswordRequestOtp,
  forgotPasswordVerifyOtp,
  requestPasswordResetEmail,
  resetPasswordWithEmailToken,
} from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { validate } from '../middlewares/validator.js';
import { authLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

// Registration validation rules
const registerValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Full name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email address is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Mobile number is required')
    .matches(/^[0-9]{10}$/)
    .withMessage('Mobile number must be a valid 10-digit number'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
];

// Login validation rules
const loginValidation = [
  body('identifier')
    .trim()
    .notEmpty()
    .withMessage('Please provide your email address or mobile number'),
  body('password').notEmpty().withMessage('Password is required'),
];

// Profile update validation rules
const updateProfileValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('phone')
    .optional()
    .trim()
    .matches(/^[0-9]{10}$/)
    .withMessage('Mobile number must be a valid 10-digit number'),
];

// Routes
router.post('/register', authLimiter, registerValidation, validate, register);
router.post('/login', authLimiter, loginValidation, validate, login);

// Customer Registration OTP Verification
router.post(
  '/register/verify-otp',
  authLimiter,
  [
    body('challengeId').trim().notEmpty().withMessage('Challenge identifier is required'),
    body('otp')
      .trim()
      .notEmpty()
      .withMessage('Verification code is required')
      .matches(/^\d{6}$/)
      .withMessage('Verification code must be exactly 6 digits'),
  ],
  validate,
  verifyRegistrationOtp
);

router.post(
  '/register/resend-otp',
  authLimiter,
  [body('challengeId').trim().notEmpty().withMessage('Challenge identifier is required')],
  validate,
  resendRegistrationOtp
);

// Customer Two-Factor Authentication (2FA) for Login
router.post(
  '/login-2fa/verify',
  authLimiter,
  [
    body('challengeId').trim().notEmpty().withMessage('Challenge identifier is required'),
    body('otp')
      .trim()
      .notEmpty()
      .withMessage('Verification code is required')
      .matches(/^\d{6}$/)
      .withMessage('Verification code must be exactly 6 digits'),
  ],
  validate,
  verifyCustomerLogin2FA
);

router.post(
  '/login-2fa/resend',
  authLimiter,
  [body('challengeId').trim().notEmpty().withMessage('Challenge identifier is required')],
  validate,
  resendCustomerLogin2FA
);

// Admin-Assisted OTP Fallback Endpoints
router.post(
  '/otp-assistance/request',
  authLimiter,
  [body('challengeId').trim().notEmpty().withMessage('Challenge identifier is required')],
  validate,
  requestOtpAssistance
);

router.get('/otp-assistance/status/:challengeId', authLimiter, getOtpAssistanceStatus);

router.post(
  '/otp-assistance/complete',
  authLimiter,
  [
    body('challengeId').trim().notEmpty().withMessage('Challenge identifier is required'),
    body('approvalToken').trim().notEmpty().withMessage('Approval token is required'),
  ],
  validate,
  completeOtpAssistance
);

router.get('/me', authenticate, getMe);
router.put('/profile', authenticate, updateProfileValidation, validate, updateProfile);

// Online Guest-to-Registered Account Conversion
router.post('/conversion/request-otp', authLimiter, requestConversionOtpOnline);
router.post('/conversion/verify-otp', authLimiter, verifyConversionOtpOnline);

// Online Password Reset via OTP
router.post('/forgot-password/request-otp', authLimiter, forgotPasswordRequestOtp);
router.post('/forgot-password/verify-otp', authLimiter, forgotPasswordVerifyOtp);

// Online Password Reset via Secure Email Link (Resend Integration)
router.post(
  '/forgot-password-email',
  authLimiter,
  [
    body('email')
      .trim()
      .notEmpty()
      .withMessage('Email address is required')
      .isEmail()
      .withMessage('Please provide a valid email address')
      .normalizeEmail(),
  ],
  validate,
  requestPasswordResetEmail
);

router.post(
  '/reset-password-email',
  authLimiter,
  [
    body('token').trim().notEmpty().withMessage('Reset token is required'),
    body('newPassword')
      .notEmpty()
      .withMessage('New password is required')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long'),
  ],
  validate,
  resetPasswordWithEmailToken
);

export default router;
