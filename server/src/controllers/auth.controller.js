import crypto from 'crypto';
import User from '../models/User.js';
import OtpVerification from '../models/OtpVerification.js';
import OtpAuditLog from '../models/OtpAuditLog.js';
import ActivityLog from '../models/ActivityLog.js';
import { ROLES } from '../config/constants.js';
import {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendPasswordResetConfirmationEmail,
  sendOtpEmail,
} from '../services/email.service.js';
import { getFrontendUrl, getPasswordResetUrl } from '../utils/url.js';

export function maskEmail(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) return 'your registered email';
  const [local, domain] = email.trim().toLowerCase().split('@');
  if (local.length <= 1) return `*@${domain}`;
  if (local.length === 2) return `${local[0]}***@${domain}`;
  if (local.length <= 4) return `${local.slice(0, 2)}***@${domain}`;
  return `${local.slice(0, 3)}***@${domain}`;
}

function maskPhone(phone) {
  if (!phone || phone.length < 4) return 'XXXXXX';
  return `XXXXXX${phone.slice(-4)}`;
}

// Register Customer
export const register = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    const cleanPhone = phone ? phone.trim().replace(/\D/g, '') : '';
    const cleanEmail = email ? email.toLowerCase().trim() : '';

    // Check if phone already exists
    if (cleanPhone) {
      const existingPhone = await User.findOne({ phone: cleanPhone });
      if (existingPhone) {
        if (existingPhone.accountType === 'GUEST' || existingPhone.isGuest) {
          // Invalidate previous conversion OTPs
          await OtpVerification.updateMany(
            { userId: existingPhone._id, purpose: 'GUEST_CONVERSION', used: false },
            { used: true }
          );

          // Generate secure 6-digit conversion OTP and store SHA-256 hash
          const otpCode = OtpVerification.generateNumericOtp();
          const otpHash = OtpVerification.hashOtp(otpCode);
          const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
          const resendAvailableAt = new Date(Date.now() + 60 * 1000); // 60s cooldown

          const targetEmail = existingPhone.email || cleanEmail;

          await OtpVerification.create({
            userId: existingPhone._id,
            email: targetEmail,
            otpHash,
            purpose: 'GUEST_CONVERSION',
            expiresAt,
            resendAvailableAt,
            attempts: 0,
            maxAttempts: 5,
          });

          // Dispatch real OTP email via Resend
          if (targetEmail) {
            await sendOtpEmail({
              email: targetEmail,
              name: existingPhone.name,
              otp: otpCode,
              purpose: 'GUEST_CONVERSION',
              expiresMinutes: 5,
            });
          }

          return res.status(200).json({
            success: true,
            requiresConversion: true,
            isGuestAccount: true,
            message: `An existing guest gaming profile was found for ${cleanPhone}! Enter the verification code sent to your email to claim your profile, booking history, and receipts.`,
            data: {
              userId: existingPhone._id,
              phone: existingPhone.phone,
              name: existingPhone.name,
              email: existingPhone.email,
              maskedPhone: maskPhone(cleanPhone),
              maskedEmail: maskEmail(targetEmail),
              resendCooldownSeconds: 60,
              expiresInSeconds: 300,
            },
          });
        }

        if (existingPhone.accountStatus === 'PENDING_VERIFICATION') {
          // Unverified previous registration: reuse and re-issue verification challenge
          existingPhone.name = name.trim();
          existingPhone.email = cleanEmail;
          existingPhone.password = password;
          await existingPhone.save();
          return dispatchRegistrationChallenge(existingPhone, req, res);
        }

        return res.status(409).json({
          success: false,
          message: 'An account with this mobile number already exists.',
        });
      }
    }

    // Check if email already registered
    if (cleanEmail) {
      const existingEmail = await User.findOne({ email: cleanEmail });
      if (existingEmail) {
        if (existingEmail.accountType === 'GUEST' || existingEmail.isGuest) {
          // Invalidate previous conversion OTPs
          await OtpVerification.updateMany(
            { userId: existingEmail._id, purpose: 'GUEST_CONVERSION', used: false },
            { used: true }
          );

          const otpCode = OtpVerification.generateNumericOtp();
          const otpHash = OtpVerification.hashOtp(otpCode);
          const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
          const resendAvailableAt = new Date(Date.now() + 60 * 1000);

          await OtpVerification.create({
            userId: existingEmail._id,
            email: cleanEmail,
            otpHash,
            purpose: 'GUEST_CONVERSION',
            expiresAt,
            resendAvailableAt,
            attempts: 0,
            maxAttempts: 5,
          });

          await sendOtpEmail({
            email: cleanEmail,
            name: existingEmail.name,
            otp: otpCode,
            purpose: 'GUEST_CONVERSION',
            expiresMinutes: 5,
          });

          return res.status(200).json({
            success: true,
            requiresConversion: true,
            isGuestAccount: true,
            message: `An existing guest gaming profile was found for ${cleanEmail}! Enter the verification code sent to your email to convert your account.`,
            data: {
              userId: existingEmail._id,
              phone: existingEmail.phone,
              name: existingEmail.name,
              email: existingEmail.email,
              maskedPhone: maskPhone(existingEmail.phone),
              maskedEmail: maskEmail(cleanEmail),
              resendCooldownSeconds: 60,
              expiresInSeconds: 300,
            },
          });
        }

        if (existingEmail.accountStatus === 'PENDING_VERIFICATION') {
          existingEmail.name = name.trim();
          existingEmail.phone = cleanPhone;
          existingEmail.password = password;
          await existingEmail.save();
          return dispatchRegistrationChallenge(existingEmail, req, res);
        }

        return res.status(409).json({
          success: false,
          message: 'An account with this email address already exists.',
        });
      }
    }

    const user = new User({
      name: name.trim(),
      email: cleanEmail,
      phone: cleanPhone,
      password,
      role: ROLES.CUSTOMER,
      accountType: 'REGISTERED',
      accountStatus: 'PENDING_VERIFICATION',
      isGuest: false,
      isEmailVerified: false,
      emailVerificationMethod: 'none',
    });

    await user.save();
    return dispatchRegistrationChallenge(user, req, res);
  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error during registration. Please try again.',
      error: err.message,
    });
  }
};

// Helper: Dispatch Registration OTP Challenge & Audit
async function dispatchRegistrationChallenge(user, req, res) {
  // Invalidate previous registration challenges for this user
  await OtpVerification.updateMany(
    { userId: user._id, purpose: 'REGISTRATION', used: false },
    { used: true }
  );

  const otpCode = OtpVerification.generateNumericOtp();
  const challengeId = crypto.randomBytes(32).toString('hex');
  const otpHash = OtpVerification.hashOtp(otpCode);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  const resendAvailableAt = new Date(Date.now() + 60 * 1000);

  let emailDeliveryStatus = 'PENDING';
  let emailDeliveryError = '';
  try {
    const emailResult = await sendOtpEmail({
      email: user.email,
      name: user.name,
      otp: otpCode,
      purpose: 'REGISTRATION',
      expiresMinutes: 5,
    });

    if (emailResult.success) {
      emailDeliveryStatus = 'ACCEPTED';
    } else if (emailResult.notConfigured) {
      emailDeliveryStatus = 'NOT_CONFIGURED';
      emailDeliveryError = emailResult.message || 'Email service not configured on server';
    } else {
      emailDeliveryStatus = 'FAILED';
      emailDeliveryError = emailResult.error || emailResult.reason || 'Failed to dispatch email';
    }
  } catch (e) {
    emailDeliveryStatus = 'FAILED';
    emailDeliveryError = e.message;
  }

  await OtpVerification.create({
    userId: user._id,
    email: user.email,
    phone: user.phone,
    userName: user.name,
    otpHash,
    purpose: 'REGISTRATION',
    challengeId,
    expiresAt,
    resendAvailableAt,
    attempts: 0,
    maxAttempts: 5,
    emailDeliveryStatus,
    emailDeliveryError,
    status: 'PENDING',
  });

  await ActivityLog.create({
    userId: user._id,
    userName: user.name,
    userRole: user.role,
    action: 'USER_REGISTER_CHALLENGE_CREATED',
    category: 'AUTH',
    details: { email: user.email, phone: user.phone, challengeId, emailDeliveryStatus },
    ipAddress: req.ip || '127.0.0.1',
  });

  return res.status(200).json({
    success: true,
    requiresOtpVerification: true,
    purpose: 'REGISTRATION',
    message: 'Verification code dispatched to your registered email address.',
    data: {
      challengeId,
      maskedEmail: maskEmail(user.email),
      maskedPhone: maskPhone(user.phone),
      emailDeliveryStatus,
      emailDeliveryError: emailDeliveryError || null,
      resendCooldownSeconds: 60,
      expiresInSeconds: 300,
    },
  });
}

// Login User (supports login via email or mobile number)
export const login = async (req, res) => {
  try {
    const { identifier, password } = req.body; // identifier can be email or phone

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email/phone and password.',
      });
    }

    const cleanIdentifier = identifier.trim().toLowerCase();

    // Find user by either email or phone
    const user = await User.findOne({
      $or: [{ email: cleanIdentifier }, { phone: cleanIdentifier }],
    }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Please verify your email/phone and password.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact the administrator.',
      });
    }

    // Handle pending registration verification
    if (user.accountStatus === 'PENDING_VERIFICATION') {
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials. Please verify your email/phone and password.',
        });
      }

      await OtpVerification.updateMany(
        { userId: user._id, purpose: 'REGISTRATION', used: false },
        { used: true }
      );

      const otpCode = OtpVerification.generateNumericOtp();
      const challengeId = crypto.randomBytes(32).toString('hex');
      const otpHash = OtpVerification.hashOtp(otpCode);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      const resendAvailableAt = new Date(Date.now() + 60 * 1000);

      let emailDeliveryStatus = 'PENDING';
      let emailDeliveryError = '';
      try {
        const emailResult = await sendOtpEmail({
          email: user.email,
          name: user.name,
          otp: otpCode,
          purpose: 'REGISTRATION',
          expiresMinutes: 5,
        });

        if (emailResult.success) {
          emailDeliveryStatus = 'ACCEPTED';
        } else if (emailResult.notConfigured) {
          emailDeliveryStatus = 'NOT_CONFIGURED';
          emailDeliveryError = emailResult.message || 'Email service not configured';
        } else {
          emailDeliveryStatus = 'FAILED';
          emailDeliveryError = emailResult.error || emailResult.reason || 'Failed to dispatch email';
        }
      } catch (e) {
        emailDeliveryStatus = 'FAILED';
        emailDeliveryError = e.message;
      }

      await OtpVerification.create({
        userId: user._id,
        email: user.email,
        phone: user.phone,
        userName: user.name,
        otpHash,
        purpose: 'REGISTRATION',
        challengeId,
        expiresAt,
        resendAvailableAt,
        attempts: 0,
        maxAttempts: 5,
        emailDeliveryStatus,
        emailDeliveryError,
        status: 'PENDING',
      });

      return res.status(200).json({
        success: true,
        requiresOtpVerification: true,
        purpose: 'REGISTRATION',
        message: 'Your registration is pending verification. Please enter the verification code or request Admin Assistance.',
        data: {
          challengeId,
          maskedEmail: maskEmail(user.email),
          maskedPhone: maskPhone(user.phone),
          emailDeliveryStatus,
          emailDeliveryError: emailDeliveryError || null,
          resendCooldownSeconds: 60,
          expiresInSeconds: 300,
        },
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Please verify your email/phone and password.',
      });
    }

    // Role-based 2FA Enforcement:
    // ADMIN and RECEPTIONIST authenticate via password-only (NO 2FA required)
    if (user.role === ROLES.ADMIN || user.role === ROLES.RECEPTIONIST) {
      user.lastLogin = new Date();
      await user.save();

      await ActivityLog.create({
        userId: user._id,
        userName: user.name,
        userRole: user.role,
        action: 'STAFF_LOGIN_SUCCESS',
        category: 'AUTH',
        details: { role: user.role, email: user.email },
        ipAddress: req.ip || '127.0.0.1',
      });

      const token = user.generateAuthToken();

      return res.status(200).json({
        success: true,
        message: `Login successful. Welcome back, ${user.name}!`,
        data: {
          token,
          user: user.toSafeObject(),
        },
      });
    }

    // CUSTOMER ACCOUNTS: Mandatory Two-Factor Authentication via Real Email OTP
    // 1. Invalidate any existing active LOGIN_2FA challenges for this user
    await OtpVerification.updateMany(
      { userId: user._id, purpose: 'LOGIN_2FA', used: false },
      { used: true }
    );

    // 2. Generate secure 6-digit numeric OTP and challenge ID
    const otpCode = OtpVerification.generateNumericOtp();
    const challengeId = crypto.randomBytes(32).toString('hex');
    const otpHash = OtpVerification.hashOtp(otpCode);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity
    const resendAvailableAt = new Date(Date.now() + 60 * 1000); // 60s cooldown

    // 3. Dispatch real OTP email via Resend
    let emailDeliveryStatus = 'PENDING';
    let emailDeliveryError = '';
    try {
      const emailResult = await sendOtpEmail({
        email: user.email,
        name: user.name,
        otp: otpCode,
        purpose: 'LOGIN_2FA',
        expiresMinutes: 5,
      });

      if (emailResult.success) {
        emailDeliveryStatus = 'ACCEPTED';
      } else if (emailResult.notConfigured) {
        emailDeliveryStatus = 'NOT_CONFIGURED';
        emailDeliveryError = emailResult.message || 'Email service not configured';
      } else {
        emailDeliveryStatus = 'FAILED';
        emailDeliveryError = emailResult.error || emailResult.reason || 'Failed to dispatch email';
      }
    } catch (e) {
      emailDeliveryStatus = 'FAILED';
      emailDeliveryError = e.message;
    }

    // 4. Save verification record with SHA-256 hash
    await OtpVerification.create({
      userId: user._id,
      email: user.email,
      phone: user.phone,
      userName: user.name,
      otpHash,
      purpose: 'LOGIN_2FA',
      challengeId,
      expiresAt,
      resendAvailableAt,
      attempts: 0,
      maxAttempts: 5,
      emailDeliveryStatus,
      emailDeliveryError,
      status: 'PENDING',
    });

    await ActivityLog.create({
      userId: user._id,
      userName: user.name,
      userRole: user.role,
      action: 'CUSTOMER_LOGIN_2FA_DISPATCHED',
      category: 'AUTH',
      details: { email: user.email, challengeId, emailDeliveryStatus },
      ipAddress: req.ip || '127.0.0.1',
    });

    // 5. Return challenge identifier
    return res.status(200).json({
      success: true,
      requires2FA: true,
      purpose: 'LOGIN_2FA',
      message: 'Two-factor verification code dispatched to your registered email address.',
      data: {
        challengeId,
        maskedEmail: maskEmail(user.email),
        maskedPhone: maskPhone(user.phone),
        emailDeliveryStatus,
        emailDeliveryError: emailDeliveryError || null,
        resendCooldownSeconds: 60,
        expiresInSeconds: 300,
      },
    });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error during login. Please try again.',
      error: err.message,
    });
  }
};

// Customer Online: Verify Two-Factor Authentication OTP and Complete Login
export const verifyCustomerLogin2FA = async (req, res) => {
  try {
    const { challengeId, otp } = req.body;
    if (!challengeId || !challengeId.trim()) {
      return res.status(400).json({ success: false, message: 'Challenge identifier is required.' });
    }
    if (!otp || !otp.trim()) {
      return res.status(400).json({ success: false, message: '6-digit verification code is required.' });
    }

    const cleanOtp = otp.trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      return res.status(400).json({ success: false, message: 'Verification code must be exactly 6 digits.' });
    }

    const record = await OtpVerification.findOne({
      challengeId: challengeId.trim(),
      purpose: 'LOGIN_2FA',
      used: false,
    }).select('+otpHash');

    if (!record) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or already used verification challenge. Please sign in again.',
      });
    }

    // 1. Enforce 5-minute expiry
    if (new Date() > new Date(record.expiresAt)) {
      record.used = true;
      await record.save();
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired (5-minute limit). Please sign in again or request a new code.',
      });
    }

    // 2. Enforce maximum 5 attempts
    if (record.attempts >= record.maxAttempts) {
      record.used = true;
      await record.save();
      return res.status(429).json({
        success: false,
        message: 'Maximum verification attempts exceeded (5/5). For your security, this verification session is terminated.',
      });
    }

    // 3. Constant-time hash verification
    const isValid = record.verifyOtp(cleanOtp);
    if (!isValid) {
      record.attempts += 1;
      if (record.attempts >= record.maxAttempts) {
        record.used = true;
        await record.save();
        return res.status(429).json({
          success: false,
          message: 'Maximum verification attempts exceeded (5/5). For your security, this verification session is terminated.',
        });
      }
      await record.save();
      const remaining = record.maxAttempts - record.attempts;
      return res.status(400).json({
        success: false,
        message: `Invalid verification code. ${remaining} attempt(s) remaining.`,
      });
    }

    // 4. Invalidate challenge on success (single-use)
    record.verified = true;
    record.used = true;
    record.status = 'CONSUMED';
    record.authMethod = 'email_otp';
    await record.save();

    const user = await User.findById(record.userId);
    if (!user || !user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is inactive or no longer exists.',
      });
    }

    user.lastLogin = new Date();
    await user.save();

    await ActivityLog.create({
      userId: user._id,
      userName: user.name,
      userRole: user.role,
      action: 'CUSTOMER_LOGIN_2FA_SUCCESS',
      category: 'AUTH',
      details: { email: user.email, challengeId: record.challengeId },
      ipAddress: req.ip || '127.0.0.1',
    });

    await OtpAuditLog.create({
      challengeId: record.challengeId,
      userId: user._id,
      userName: user.name,
      email: user.email,
      phone: user.phone,
      purpose: 'LOGIN_2FA',
      emailDeliveryStatus: record.emailDeliveryStatus,
      emailDeliveryError: record.emailDeliveryError,
      resolution: 'EMAIL_OTP_VERIFIED',
      decisionTimestamp: new Date(),
      note: 'Verified directly via email OTP code',
      ipAddress: req.ip || '127.0.0.1',
    });

    // 5. Only now issue final JWT token
    const token = user.generateAuthToken();

    return res.status(200).json({
      success: true,
      message: `Two-factor verification successful. Welcome back, ${user.name}!`,
      data: {
        token,
        user: user.toSafeObject(),
      },
    });
  } catch (err) {
    console.error('[verifyCustomerLogin2FA Error]', err);
    return res.status(500).json({ success: false, message: 'Server error during 2FA verification.' });
  }
};

// Customer Online: Resend Two-Factor Authentication OTP
export const resendCustomerLogin2FA = async (req, res) => {
  try {
    const { challengeId } = req.body;
    if (!challengeId || !challengeId.trim()) {
      return res.status(400).json({ success: false, message: 'Challenge identifier is required.' });
    }

    const record = await OtpVerification.findOne({
      challengeId: challengeId.trim(),
      purpose: 'LOGIN_2FA',
      used: false,
    });

    if (!record) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired login challenge. Please sign in again.',
      });
    }

    const now = new Date();
    if (now < new Date(record.resendAvailableAt)) {
      const waitSeconds = Math.ceil((new Date(record.resendAvailableAt).getTime() - now.getTime()) / 1000);
      return res.status(429).json({
        success: false,
        message: `Please wait ${waitSeconds} second(s) before requesting a new verification code.`,
        data: { remainingSeconds: waitSeconds },
      });
    }

    // Invalidate old challenge
    record.used = true;
    await record.save();

    const user = await User.findById(record.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Create fresh challenge & OTP
    const newOtpCode = OtpVerification.generateNumericOtp();
    const newChallengeId = crypto.randomBytes(32).toString('hex');
    const newOtpHash = OtpVerification.hashOtp(newOtpCode);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const resendAvailableAt = new Date(Date.now() + 60 * 1000);

    let emailDeliveryStatus = 'PENDING';
    let emailDeliveryError = '';
    try {
      const emailResult = await sendOtpEmail({
        email: user.email,
        name: user.name,
        otp: newOtpCode,
        purpose: 'LOGIN_2FA',
        expiresMinutes: 5,
      });

      if (emailResult.success) {
        emailDeliveryStatus = 'ACCEPTED';
      } else if (emailResult.notConfigured) {
        emailDeliveryStatus = 'NOT_CONFIGURED';
        emailDeliveryError = emailResult.message || 'Email service not configured';
      } else {
        emailDeliveryStatus = 'FAILED';
        emailDeliveryError = emailResult.error || emailResult.reason || 'Failed to dispatch email';
      }
    } catch (e) {
      emailDeliveryStatus = 'FAILED';
      emailDeliveryError = e.message;
    }

    await OtpVerification.create({
      userId: user._id,
      email: user.email,
      phone: user.phone,
      userName: user.name,
      otpHash: newOtpHash,
      purpose: 'LOGIN_2FA',
      challengeId: newChallengeId,
      expiresAt,
      resendAvailableAt,
      attempts: 0,
      maxAttempts: 5,
      emailDeliveryStatus,
      emailDeliveryError,
      status: 'PENDING',
    });

    return res.status(200).json({
      success: true,
      message: 'A fresh verification code has been dispatched to your email address.',
      data: {
        challengeId: newChallengeId,
        maskedEmail: maskEmail(user.email),
        emailDeliveryStatus,
        emailDeliveryError: emailDeliveryError || null,
        resendCooldownSeconds: 60,
        expiresInSeconds: 300,
      },
    });
  } catch (err) {
    console.error('[resendCustomerLogin2FA Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to resend verification code.' });
  }
};

// Customer: Verify Registration OTP
export const verifyRegistrationOtp = async (req, res) => {
  try {
    const { challengeId, otp } = req.body;
    if (!challengeId || !challengeId.trim()) {
      return res.status(400).json({ success: false, message: 'Challenge identifier is required.' });
    }
    if (!otp || !otp.trim()) {
      return res.status(400).json({ success: false, message: '6-digit verification code is required.' });
    }

    const cleanOtp = otp.trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      return res.status(400).json({ success: false, message: 'Verification code must be exactly 6 digits.' });
    }

    const record = await OtpVerification.findOne({
      challengeId: challengeId.trim(),
      purpose: 'REGISTRATION',
      used: false,
    }).select('+otpHash');

    if (!record) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or already used registration challenge. Please register again.',
      });
    }

    if (new Date() > new Date(record.expiresAt)) {
      record.used = true;
      record.status = 'EXPIRED';
      await record.save();
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired (5-minute limit). Please request a new code or request Admin Assistance.',
      });
    }

    if (record.attempts >= record.maxAttempts) {
      record.used = true;
      await record.save();
      return res.status(429).json({
        success: false,
        message: 'Maximum verification attempts exceeded (5/5). For your security, this verification session is terminated.',
      });
    }

    const isValid = record.verifyOtp(cleanOtp);
    if (!isValid) {
      record.attempts += 1;
      if (record.attempts >= record.maxAttempts) {
        record.used = true;
        await record.save();
        return res.status(429).json({
          success: false,
          message: 'Maximum verification attempts exceeded (5/5). For your security, this verification session is terminated.',
        });
      }
      await record.save();
      const remaining = record.maxAttempts - record.attempts;
      return res.status(400).json({
        success: false,
        message: `Invalid verification code. ${remaining} attempt(s) remaining.`,
      });
    }

    record.verified = true;
    record.used = true;
    record.status = 'CONSUMED';
    record.authMethod = 'email_otp';
    await record.save();

    const user = await User.findById(record.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User account not found.' });
    }

    user.accountStatus = 'ACTIVE';
    user.isEmailVerified = true;
    user.emailVerificationMethod = 'email_otp';
    user.isActive = true;
    user.lastLogin = new Date();
    await user.save();

    await ActivityLog.create({
      userId: user._id,
      userName: user.name,
      userRole: user.role,
      action: 'USER_REGISTER_VERIFIED',
      category: 'AUTH',
      details: { email: user.email, phone: user.phone, challengeId: record.challengeId },
      ipAddress: req.ip || '127.0.0.1',
    });

    await OtpAuditLog.create({
      challengeId: record.challengeId,
      userId: user._id,
      userName: user.name,
      email: user.email,
      phone: user.phone,
      purpose: 'REGISTRATION',
      emailDeliveryStatus: record.emailDeliveryStatus,
      emailDeliveryError: record.emailDeliveryError,
      resolution: 'EMAIL_OTP_VERIFIED',
      decisionTimestamp: new Date(),
      note: 'Customer verified registration via direct email OTP code',
      ipAddress: req.ip || '127.0.0.1',
    });

    if (user.email) {
      sendWelcomeEmail({ user }).catch((err) =>
        console.error('[Registration Welcome Email Error]:', err.message)
      );
    }

    const token = user.generateAuthToken();

    return res.status(200).json({
      success: true,
      message: 'Registration verified successfully! Welcome to NOAH GAMING.',
      data: {
        token,
        user: user.toSafeObject(),
      },
    });
  } catch (err) {
    console.error('[verifyRegistrationOtp Error]', err);
    return res.status(500).json({ success: false, message: 'Server error during registration verification.' });
  }
};

// Customer: Resend Registration OTP
export const resendRegistrationOtp = async (req, res) => {
  try {
    const { challengeId } = req.body;
    if (!challengeId || !challengeId.trim()) {
      return res.status(400).json({ success: false, message: 'Challenge identifier is required.' });
    }

    const record = await OtpVerification.findOne({
      challengeId: challengeId.trim(),
      purpose: 'REGISTRATION',
      used: false,
    });

    if (!record) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired registration challenge. Please register again.',
      });
    }

    const now = new Date();
    if (now < new Date(record.resendAvailableAt)) {
      const waitSeconds = Math.ceil((new Date(record.resendAvailableAt).getTime() - now.getTime()) / 1000);
      return res.status(429).json({
        success: false,
        message: `Please wait ${waitSeconds} second(s) before requesting a new verification code.`,
        data: { remainingSeconds: waitSeconds },
      });
    }

    record.used = true;
    await record.save();

    const user = await User.findById(record.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const newOtpCode = OtpVerification.generateNumericOtp();
    const newChallengeId = crypto.randomBytes(32).toString('hex');
    const newOtpHash = OtpVerification.hashOtp(newOtpCode);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const resendAvailableAt = new Date(Date.now() + 60 * 1000);

    let emailDeliveryStatus = 'PENDING';
    let emailDeliveryError = '';
    try {
      const emailResult = await sendOtpEmail({
        email: user.email,
        name: user.name,
        otp: newOtpCode,
        purpose: 'REGISTRATION',
        expiresMinutes: 5,
      });

      if (emailResult.success) {
        emailDeliveryStatus = 'ACCEPTED';
      } else if (emailResult.notConfigured) {
        emailDeliveryStatus = 'NOT_CONFIGURED';
        emailDeliveryError = emailResult.message || 'Email service not configured';
      } else {
        emailDeliveryStatus = 'FAILED';
        emailDeliveryError = emailResult.error || emailResult.reason || 'Failed to dispatch email';
      }
    } catch (e) {
      emailDeliveryStatus = 'FAILED';
      emailDeliveryError = e.message;
    }

    await OtpVerification.create({
      userId: user._id,
      email: user.email,
      phone: user.phone,
      userName: user.name,
      otpHash: newOtpHash,
      purpose: 'REGISTRATION',
      challengeId: newChallengeId,
      expiresAt,
      resendAvailableAt,
      attempts: 0,
      maxAttempts: 5,
      emailDeliveryStatus,
      emailDeliveryError,
      status: 'PENDING',
    });

    return res.status(200).json({
      success: true,
      message: 'A fresh verification code has been dispatched to your email address.',
      data: {
        challengeId: newChallengeId,
        maskedEmail: maskEmail(user.email),
        emailDeliveryStatus,
        emailDeliveryError: emailDeliveryError || null,
        resendCooldownSeconds: 60,
        expiresInSeconds: 300,
      },
    });
  } catch (err) {
    console.error('[resendRegistrationOtp Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to resend registration code.' });
  }
};

// Customer: Request Admin Assistance for Pending OTP
export const requestOtpAssistance = async (req, res) => {
  try {
    const { challengeId } = req.body;
    if (!challengeId || !challengeId.trim()) {
      return res.status(400).json({ success: false, message: 'Challenge identifier is required.' });
    }

    const record = await OtpVerification.findOne({
      challengeId: challengeId.trim(),
      used: false,
    });

    if (!record) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification challenge. Please initiate authentication again.',
      });
    }

    if (new Date() > new Date(record.expiresAt)) {
      record.status = 'EXPIRED';
      record.used = true;
      await record.save();
      return res.status(400).json({
        success: false,
        message: 'Verification challenge has expired (5-minute limit). Please initiate authentication again.',
      });
    }

    record.assistanceRequested = true;
    record.assistanceRequestedAt = new Date();
    record.status = 'AWAITING_ADMIN_ASSISTANCE';
    await record.save();

    await ActivityLog.create({
      userId: record.userId,
      userName: record.userName || 'Customer',
      userRole: ROLES.CUSTOMER,
      action: 'OTP_ADMIN_ASSISTANCE_REQUESTED',
      category: 'AUTH',
      details: { email: record.email, phone: record.phone, challengeId: record.challengeId, purpose: record.purpose },
      ipAddress: req.ip || '127.0.0.1',
    });

    const expiresInSeconds = Math.max(0, Math.floor((new Date(record.expiresAt).getTime() - Date.now()) / 1000));

    return res.status(200).json({
      success: true,
      message: 'Admin assistance requested. Lounge administration has been alerted to review and verify your request.',
      data: {
        challengeId: record.challengeId,
        status: record.status,
        expiresInSeconds,
      },
    });
  } catch (err) {
    console.error('[requestOtpAssistance Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to request admin assistance.' });
  }
};

// Customer: Check OTP Assistance Status (Polled by client)
export const getOtpAssistanceStatus = async (req, res) => {
  try {
    const { challengeId } = req.params;
    if (!challengeId || !challengeId.trim()) {
      return res.status(400).json({ success: false, message: 'Challenge identifier is required.' });
    }

    const record = await OtpVerification.findOne({ challengeId: challengeId.trim() });
    if (!record) {
      return res.status(404).json({ success: false, message: 'Verification challenge not found.' });
    }

    if (record.status === 'CONSUMED') {
      return res.status(200).json({
        success: true,
        data: {
          status: 'CONSUMED',
          purpose: record.purpose,
        },
      });
    }

    const isExpired = new Date() > new Date(record.expiresAt);
    if (isExpired && record.status !== 'APPROVED' && record.status !== 'REJECTED') {
      if (!record.used) {
        record.used = true;
        record.status = 'EXPIRED';
        await record.save();
      }
      return res.status(200).json({
        success: true,
        data: {
          status: 'EXPIRED',
          purpose: record.purpose,
          message: 'Challenge validity has expired (5-minute limit).',
          expiresInSeconds: 0,
        },
      });
    }

    const expiresInSeconds = Math.max(0, Math.floor((new Date(record.expiresAt).getTime() - Date.now()) / 1000));

    return res.status(200).json({
      success: true,
      data: {
        status: record.status, // 'PENDING', 'AWAITING_ADMIN_ASSISTANCE', 'APPROVED', 'REJECTED', 'EXPIRED'
        purpose: record.purpose,
        emailDeliveryStatus: record.emailDeliveryStatus,
        assistanceRequested: record.assistanceRequested,
        approvalToken: record.status === 'APPROVED' ? record.approvalToken : null,
        rejectionReason: record.status === 'REJECTED' ? record.adminDecision?.reason : null,
        expiresInSeconds,
      },
    });
  } catch (err) {
    console.error('[getOtpAssistanceStatus Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve challenge status.' });
  }
};

// Customer: Complete Authentication via Admin Approval
export const completeOtpAssistance = async (req, res) => {
  try {
    const { challengeId, approvalToken } = req.body;
    if (!challengeId || !challengeId.trim()) {
      return res.status(400).json({ success: false, message: 'Challenge identifier is required.' });
    }
    if (!approvalToken || !approvalToken.trim()) {
      return res.status(400).json({ success: false, message: 'Approval token is required.' });
    }

    const record = await OtpVerification.findOne({
      challengeId: challengeId.trim(),
      approvalToken: approvalToken.trim(),
      status: 'APPROVED',
      used: false,
    });

    if (!record) {
      return res.status(400).json({
        success: false,
        message: 'Invalid, expired, or already consumed approval token.',
      });
    }

    if (new Date() > new Date(record.expiresAt)) {
      record.used = true;
      record.status = 'EXPIRED';
      await record.save();
      return res.status(400).json({
        success: false,
        message: 'This approval session has expired (5-minute limit). Please sign in or register again.',
      });
    }

    // Invalidate immediately (single-use guarantee)
    record.used = true;
    record.verified = true;
    record.status = 'CONSUMED';
    record.authMethod = 'admin_assisted';
    await record.save();

    const user = await User.findById(record.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User account not found.' });
    }

    if (record.purpose === 'REGISTRATION') {
      user.accountStatus = 'ACTIVE';
      user.isEmailVerified = true;
      user.emailVerificationMethod = 'admin_assisted';
      user.isActive = true;
      if (user.email) {
        sendWelcomeEmail({ user }).catch((err) =>
          console.error('[Welcome Email Error]:', err.message)
        );
      }
    }

    user.lastLogin = new Date();
    await user.save();

    await ActivityLog.create({
      userId: user._id,
      userName: user.name,
      userRole: user.role,
      action: 'OTP_ADMIN_ASSISTANCE_COMPLETED',
      category: 'AUTH',
      details: {
        email: user.email,
        phone: user.phone,
        challengeId: record.challengeId,
        purpose: record.purpose,
        approvedBy: record.adminDecision?.adminName,
      },
      ipAddress: req.ip || '127.0.0.1',
    });

    await OtpAuditLog.create({
      challengeId: record.challengeId,
      userId: user._id,
      userName: user.name,
      email: user.email,
      phone: user.phone,
      purpose: record.purpose,
      emailDeliveryStatus: record.emailDeliveryStatus,
      emailDeliveryError: record.emailDeliveryError,
      assistanceRequested: true,
      assistanceRequestedAt: record.assistanceRequestedAt,
      resolution: 'ADMIN_APPROVED',
      adminId: record.adminDecision?.adminId,
      adminName: record.adminDecision?.adminName,
      decisionTimestamp: record.adminDecision?.decidedAt || new Date(),
      note: record.adminDecision?.reason || 'Verified via Admin-Assisted OTP Fallback',
      ipAddress: req.ip || '127.0.0.1',
    });

    const token = user.generateAuthToken();

    return res.status(200).json({
      success: true,
      message: 'Authentication verified successfully by Administrator. Welcome to NOAH GAMING!',
      data: {
        token,
        user: user.toSafeObject(),
      },
    });
  } catch (err) {
    console.error('[completeOtpAssistance Error]', err);
    return res.status(500).json({ success: false, message: 'Server error during assistance completion.' });
  }
};

// Get Current User Profile
export const getMe = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        user: req.user,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user profile',
      error: err.message,
    });
  }
};

// Update Profile
export const updateProfile = async (req, res) => {
  try {
    const { name, phone } = req.body;
    const user = req.user;

    if (name) user.name = name.trim();
    if (phone) {
      // Check phone uniqueness
      const existing = await User.findOne({ phone: phone.trim(), _id: { $ne: user._id } });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'This mobile number is already in use by another account.',
        });
      }
      user.phone = phone.trim();
    }

    await user.save();

    await ActivityLog.create({
      userId: user._id,
      userName: user.name,
      userRole: user.role,
      action: 'UPDATE_PROFILE',
      category: 'AUTH',
      details: { name: user.name, phone: user.phone },
      ipAddress: req.ip || '127.0.0.1',
    });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      data: {
        user: user.toSafeObject(),
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error updating profile',
      error: err.message,
    });
  }
};

// Customer Online: Request OTP to convert guest profile
export const requestConversionOtpOnline = async (req, res) => {
  try {
    const { identifier, email } = req.body;
    if (!identifier) {
      return res.status(400).json({ success: false, message: 'Please provide your mobile number or email.' });
    }
    const clean = identifier.trim();
    const cleanPhone = clean.replace(/\D/g, '');
    const cleanEmail = clean.toLowerCase();

    const user = await User.findOne({
      $or: [{ phone: cleanPhone }, { email: cleanEmail }],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No guest profile found with this mobile number or email.',
      });
    }

    if (user.accountType === 'REGISTERED' && !user.isGuest) {
      return res.status(400).json({
        success: false,
        message: 'This account is already registered. Please sign in directly or reset your password.',
      });
    }

    const targetEmail = (email && email.trim()) ? email.trim().toLowerCase() : user.email;
    if (!targetEmail || !targetEmail.includes('@') || targetEmail.startsWith('guest.')) {
      return res.status(400).json({
        success: false,
        message: 'A valid email address is required to receive your verification code. Please provide your email.',
      });
    }

    // Check resend cooldown (60 seconds)
    const recentOtp = await OtpVerification.findOne({
      userId: user._id,
      purpose: 'GUEST_CONVERSION',
      used: false,
    }).sort({ createdAt: -1 });

    if (recentOtp && new Date() < new Date(recentOtp.resendAvailableAt)) {
      const remainingSeconds = Math.ceil((new Date(recentOtp.resendAvailableAt).getTime() - Date.now()) / 1000);
      return res.status(429).json({
        success: false,
        message: `Please wait ${remainingSeconds} second(s) before requesting a new verification code.`,
        data: { remainingSeconds },
      });
    }

    // Invalidate prior OTPs
    await OtpVerification.updateMany(
      { userId: user._id, purpose: 'GUEST_CONVERSION', used: false },
      { used: true }
    );

    // Generate secure 6-digit OTP and store SHA-256 hash
    const otpCode = OtpVerification.generateNumericOtp();
    const otpHash = OtpVerification.hashOtp(otpCode);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    const resendAvailableAt = new Date(Date.now() + 60 * 1000); // 60s cooldown

    await OtpVerification.create({
      userId: user._id,
      email: targetEmail,
      otpHash,
      purpose: 'GUEST_CONVERSION',
      expiresAt,
      resendAvailableAt,
      attempts: 0,
      maxAttempts: 5,
    });

    // Dispatch real email via Resend
    const emailResult = await sendOtpEmail({
      email: targetEmail,
      name: user.name,
      otp: otpCode,
      purpose: 'GUEST_CONVERSION',
      expiresMinutes: 5,
    });

    if (emailResult.notConfigured) {
      return res.status(503).json({
        success: false,
        message: 'Email verification service is currently unconfigured on the server.',
      });
    }

    await ActivityLog.create({
      userId: user._id,
      userName: user.name,
      userRole: user.role,
      action: 'GUEST_CONVERSION_OTP_SENT',
      category: 'AUTH',
      details: { email: targetEmail, phone: user.phone },
      ipAddress: req.ip || '127.0.0.1',
    });

    res.status(200).json({
      success: true,
      message: `Verification code sent to ${maskEmail(targetEmail)}.`,
      data: {
        userId: user._id,
        phone: user.phone,
        email: targetEmail,
        name: user.name,
        maskedPhone: maskPhone(user.phone),
        maskedEmail: maskEmail(targetEmail),
        resendCooldownSeconds: 60,
        expiresInSeconds: 300,
      },
    });
  } catch (err) {
    console.error('[requestConversionOtpOnline Error]', err);
    res.status(500).json({ success: false, message: 'Failed to request conversion OTP', error: err.message });
  }
};

// Customer Online: Verify OTP and complete guest conversion to registered account
export const verifyConversionOtpOnline = async (req, res) => {
  try {
    const { userId, phone, otp, password, name, email } = req.body;

    const query = {};
    if (userId) query._id = userId;
    else if (phone) query.phone = phone.trim().replace(/\D/g, '');
    else {
      return res.status(400).json({ success: false, message: 'User ID or mobile number is required.' });
    }

    const user = await User.findOne(query).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Guest account not found.' });
    }

    if (user.accountType === 'REGISTERED' && !user.isGuest) {
      return res.status(400).json({
        success: false,
        message: 'This account is already registered. Please sign in.',
      });
    }

    if (!otp || !otp.trim()) {
      return res.status(400).json({ success: false, message: 'Verification OTP is required.' });
    }

    const cleanOtp = otp.trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      return res.status(400).json({ success: false, message: 'Verification code must be exactly 6 digits.' });
    }

    const record = await OtpVerification.findOne({
      userId: user._id,
      purpose: 'GUEST_CONVERSION',
      used: false,
    }).select('+otpHash').sort({ createdAt: -1 });

    if (!record) {
      return res.status(400).json({
        success: false,
        message: 'No active verification code found. Please request a new code.',
      });
    }

    // 1. Enforce 5-minute expiry
    if (new Date() > new Date(record.expiresAt)) {
      record.used = true;
      await record.save();
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired (5-minute limit). Please request a new code.',
      });
    }

    // 2. Enforce maximum 5 attempts
    if (record.attempts >= record.maxAttempts) {
      record.used = true;
      await record.save();
      return res.status(429).json({
        success: false,
        message: 'Maximum verification attempts exceeded (5/5). Please request a new code.',
      });
    }

    // 3. Constant-time hash check
    const isValid = record.verifyOtp(cleanOtp);
    if (!isValid) {
      record.attempts += 1;
      if (record.attempts >= record.maxAttempts) {
        record.used = true;
        await record.save();
        return res.status(429).json({
          success: false,
          message: 'Maximum verification attempts exceeded (5/5). Please request a new code.',
        });
      }
      await record.save();
      const remaining = record.maxAttempts - record.attempts;
      return res.status(400).json({
        success: false,
        message: `Invalid verification code. ${remaining} attempt(s) remaining.`,
      });
    }

    // 4. Invalidate OTP immediately upon success (single-use)
    record.verified = true;
    record.used = true;
    await record.save();

    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
    }

    if (email && email.trim()) {
      const cleanEmail = email.trim().toLowerCase();
      if (cleanEmail !== user.email) {
        const emailExists = await User.findOne({ email: cleanEmail, _id: { $ne: user._id } });
        if (emailExists) {
          return res.status(409).json({ success: false, message: `Email '${cleanEmail}' is already registered.` });
        }
        user.email = cleanEmail;
      }
    } else if (record.email && (!user.email || user.email.startsWith('guest.'))) {
      user.email = record.email;
    }

    if (name && name.trim()) user.name = name.trim();

    user.accountType = 'REGISTERED';
    user.isGuest = false;
    user.guestConvertedAt = new Date();
    user.guestConvertedBy = user._id;
    user.password = password;

    await user.save();

    await ActivityLog.create({
      userId: user._id,
      userName: user.name,
      userRole: user.role,
      action: 'GUEST_SELF_CONVERSION_SUCCESS',
      category: 'AUTH',
      customerId: user._id,
      description: `Customer self-converted guest account '${user.name}' (${user.phone}) to registered account online`,
      details: { userId: user._id, phone: user.phone, email: user.email },
      ipAddress: req.ip || '127.0.0.1',
    });

    // Send Welcome Email for converted customer
    if (user.email) {
      sendWelcomeEmail({ user }).catch((err) =>
        console.error('[Conversion Welcome Email Error]:', err.message)
      );
    }

    const token = user.generateAuthToken();

    res.status(200).json({
      success: true,
      message: 'Account successfully registered and connected to all past gaming history!',
      data: {
        token,
        user: user.toSafeObject(),
      },
    });
  } catch (err) {
    console.error('[verifyConversionOtpOnline Error]', err);
    res.status(500).json({ success: false, message: 'Failed to convert account', error: err.message });
  }
};

// Customer Online: Forgot Password OTP Request
export const forgotPasswordRequestOtp = async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier || !String(identifier).trim()) {
      return res.status(400).json({ success: false, message: 'Please provide your mobile number or email.' });
    }

    const clean = String(identifier).trim();
    const isEmail = clean.includes('@');
    const cleanEmail = clean.toLowerCase();

    // Normalize phone number (strip non-digits, normalize 10-digit, 11-digit with 0, 12-digit with 91)
    const rawDigits = clean.replace(/\D/g, '');
    let cleanPhone = rawDigits;
    if (rawDigits.length === 12 && rawDigits.startsWith('91')) {
      cleanPhone = rawDigits.slice(2);
    } else if (rawDigits.length === 11 && rawDigits.startsWith('0')) {
      cleanPhone = rawDigits.slice(1);
    }

    let user = null;
    if (isEmail) {
      user = await User.findOne({ email: cleanEmail });
    } else {
      user = await User.findOne({
        $or: [
          { phone: cleanPhone },
          { phone: rawDigits },
          { phone: `+91${cleanPhone}` },
          { phone: `+91 ${cleanPhone}` },
        ],
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No registered customer account found with this identifier. Please verify your email or mobile number.',
      });
    }

    // Role-based check: Staff/Admin accounts must use administrative reset mechanisms
    if (user.role && user.role !== ROLES.CUSTOMER) {
      return res.status(403).json({
        success: false,
        message: 'Staff and administrative accounts must use the official password reset link or contact system administration.',
      });
    }

    if (!user.email || !user.email.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'No registered email found for this account. Please contact lounge administration to reset your password.',
      });
    }

    // Check resend cooldown (60 seconds)
    const recentOtp = await OtpVerification.findOne({
      userId: user._id,
      purpose: 'PASSWORD_RESET',
      used: false,
    }).sort({ createdAt: -1 });

    if (recentOtp && new Date() < new Date(recentOtp.resendAvailableAt)) {
      const remainingSeconds = Math.ceil((new Date(recentOtp.resendAvailableAt).getTime() - Date.now()) / 1000);
      return res.status(429).json({
        success: false,
        message: `Please wait ${remainingSeconds} second(s) before requesting a new reset code.`,
        data: { remainingSeconds },
      });
    }

    // Invalidate prior OTPs
    await OtpVerification.updateMany(
      { userId: user._id, purpose: 'PASSWORD_RESET', used: false },
      { used: true }
    );

    // Generate secure 6-digit OTP and SHA-256 hash
    const otpCode = OtpVerification.generateNumericOtp();
    const otpHash = OtpVerification.hashOtp(otpCode);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    const resendAvailableAt = new Date(Date.now() + 60 * 1000); // 60s cooldown

    await OtpVerification.create({
      userId: user._id,
      email: user.email,
      otpHash,
      purpose: 'PASSWORD_RESET',
      expiresAt,
      resendAvailableAt,
      attempts: 0,
      maxAttempts: 5,
    });

    // Dispatch real OTP email via Resend
    const emailResult = await sendOtpEmail({
      email: user.email,
      name: user.name,
      otp: otpCode,
      purpose: 'PASSWORD_RESET',
      expiresMinutes: 5,
    });

    if (emailResult.notConfigured) {
      return res.status(503).json({
        success: false,
        message: 'Email verification service is currently unconfigured on the server.',
      });
    }

    await ActivityLog.create({
      userId: user._id,
      userName: user.name,
      userRole: user.role,
      action: 'PASSWORD_RESET_OTP_SENT',
      category: 'AUTH',
      details: { email: user.email },
      ipAddress: req.ip || '127.0.0.1',
    });

    // Masked destination email only
    res.status(200).json({
      success: true,
      message: `Password reset verification code sent to ${maskEmail(user.email)}.`,
      data: {
        userId: user._id,
        maskedEmail: maskEmail(user.email),
        resendCooldownSeconds: 60,
        expiresInSeconds: 300,
      },
    });
  } catch (err) {
    console.error('[forgotPasswordRequestOtp Error]', err);
    res.status(500).json({ success: false, message: 'Failed to request password reset OTP', error: err.message });
  }
};

// Customer Online: Forgot Password OTP Verify & Reset
export const forgotPasswordVerifyOtp = async (req, res) => {
  try {
    const { identifier, otp, newPassword, resetToken } = req.body;
    if (!identifier || !String(identifier).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number or email is required.',
      });
    }

    const clean = String(identifier).trim();
    const isEmail = clean.includes('@');
    const cleanEmail = clean.toLowerCase();
    const rawDigits = clean.replace(/\D/g, '');
    let cleanPhone = rawDigits;
    if (rawDigits.length === 12 && rawDigits.startsWith('91')) {
      cleanPhone = rawDigits.slice(2);
    } else if (rawDigits.length === 11 && rawDigits.startsWith('0')) {
      cleanPhone = rawDigits.slice(1);
    }

    let user = null;
    if (isEmail) {
      user = await User.findOne({ email: cleanEmail }).select('+password');
    } else {
      user = await User.findOne({
        $or: [
          { phone: cleanPhone },
          { phone: rawDigits },
          { phone: `+91${cleanPhone}` },
          { phone: `+91 ${cleanPhone}` },
        ],
      }).select('+password');
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }

    // Role check: Staff/Admin accounts must use administrative reset mechanisms
    if (user.role && user.role !== ROLES.CUSTOMER) {
      return res.status(403).json({
        success: false,
        message: 'Staff and administrative accounts must use the official password reset link.',
      });
    }

    // Branch A: Resetting password using verified resetToken (Multi-step Step 3)
    if (resetToken && newPassword) {
      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long.',
        });
      }

      const hashedToken = crypto.createHash('sha256').update(String(resetToken).trim()).digest('hex');
      const verifiedRecord = await OtpVerification.findOne({
        userId: user._id,
        purpose: 'PASSWORD_RESET',
        verified: true,
        used: false,
        approvalToken: hashedToken,
        expiresAt: { $gt: new Date() },
      }).sort({ createdAt: -1 });

      if (!verifiedRecord) {
        return res.status(400).json({
          success: false,
          message: 'Password reset verification has expired or is invalid. Please request a new code.',
        });
      }

      user.password = newPassword;
      await user.save();

      verifiedRecord.used = true;
      verifiedRecord.status = 'CONSUMED';
      await verifiedRecord.save();

      await ActivityLog.create({
        userId: user._id,
        userName: user.name,
        userRole: user.role,
        action: 'CUSTOMER_PASSWORD_RESET_SUCCESS',
        category: 'AUTH',
        customerId: user._id,
        description: `Customer '${user.name}' reset password online via email OTP challenge`,
        details: { userId: user._id, email: user.email },
        ipAddress: req.ip || '127.0.0.1',
      });

      if (user.email) {
        sendPasswordResetConfirmationEmail({ user }).catch((err) =>
          console.error('[OTP Reset Confirmation Email Error]:', err.message)
        );
      }

      return res.status(200).json({
        success: true,
        message: 'Password reset successfully! You can now log in with your new password.',
      });
    }

    // For OTP verification: validate OTP format
    if (!otp) {
      return res.status(400).json({
        success: false,
        message: '6-digit verification code is required.',
      });
    }

    const cleanOtp = String(otp).trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      return res.status(400).json({
        success: false,
        message: 'Verification code must be exactly 6 digits.',
      });
    }

    const record = await OtpVerification.findOne({
      userId: user._id,
      purpose: 'PASSWORD_RESET',
      used: false,
    }).select('+otpHash').sort({ createdAt: -1 });

    if (!record) {
      return res.status(400).json({
        success: false,
        message: 'No active password reset verification found. Please request a new code.',
      });
    }

    // 1. Enforce 5-minute expiry
    if (new Date() > new Date(record.expiresAt)) {
      record.used = true;
      await record.save();
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired (5-minute limit). Please request a new code.',
      });
    }

    // 2. Enforce maximum 5 attempts
    if (record.attempts >= record.maxAttempts) {
      record.used = true;
      await record.save();
      return res.status(429).json({
        success: false,
        message: 'Too many incorrect attempts (5/5). Please request a new reset code.',
      });
    }

    // 3. Constant-time comparison
    const isValid = record.verifyOtp(cleanOtp);
    if (!isValid) {
      record.attempts += 1;
      if (record.attempts >= record.maxAttempts) {
        record.used = true;
        await record.save();
        return res.status(429).json({
          success: false,
          message: 'Too many incorrect attempts (5/5). Please request a new reset code.',
        });
      }
      await record.save();
      const remaining = record.maxAttempts - record.attempts;
      return res.status(400).json({
        success: false,
        message: `Invalid verification code. ${remaining} attempt(s) remaining.`,
      });
    }

    // Branch B: Single-step verify & set new password (when newPassword is provided along with otp)
    if (newPassword) {
      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long.',
        });
      }

      record.verified = true;
      record.used = true;
      record.status = 'CONSUMED';
      await record.save();

      user.password = newPassword;
      await user.save();

      await ActivityLog.create({
        userId: user._id,
        userName: user.name,
        userRole: user.role,
        action: 'CUSTOMER_PASSWORD_RESET_SUCCESS',
        category: 'AUTH',
        customerId: user._id,
        description: `Customer '${user.name}' reset password online via email OTP`,
        details: { userId: user._id, email: user.email },
        ipAddress: req.ip || '127.0.0.1',
      });

      if (user.email) {
        sendPasswordResetConfirmationEmail({ user }).catch((err) =>
          console.error('[OTP Reset Confirmation Email Error]:', err.message)
        );
      }

      return res.status(200).json({
        success: true,
        message: 'Password reset successfully! You can now log in with your new password.',
      });
    }

    // Branch C: Verify OTP alone (Step 2) -> generate secure resetToken for Step 3
    const generatedToken = crypto.randomBytes(32).toString('hex');
    const hashedApproval = crypto.createHash('sha256').update(generatedToken).digest('hex');

    record.verified = true;
    record.approvalToken = hashedApproval;
    await record.save();

    return res.status(200).json({
      success: true,
      message: 'Verification code verified successfully. Please enter your new password.',
      data: {
        resetToken: generatedToken,
        maskedEmail: maskEmail(user.email),
      },
    });
  } catch (err) {
    console.error('[forgotPasswordVerifyOtp Error]', err);
    res.status(500).json({ success: false, message: 'Failed to reset password', error: err.message });
  }
};

// Customer Online: Request Password Reset via Email Link (Secure single-use crypto token)
export const requestPasswordResetEmail = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Please provide an email address.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });

    // Always respond with identical message to avoid revealing account existence
    if (!user || user.accountStatus === 'SUSPENDED' || user.accountStatus === 'DEACTIVATED') {
      return res.status(200).json({
        success: true,
        message: 'If an account exists with this email address, a password reset link has been dispatched.',
      });
    }

    // Generate secure random token and store hash in DB with 1 hour expiration
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    // Use centralized getPasswordResetUrl pointing to production deployed frontend or local dev
    const resetUrl = getPasswordResetUrl(resetToken, req);

    // Dispatch email
    sendPasswordResetEmail({
      user,
      resetToken,
      resetUrl,
    }).catch((err) => console.error('[Password Reset Email Error]:', err.message));

    await ActivityLog.create({
      userId: user._id,
      userName: user.name,
      userRole: user.role,
      action: 'PASSWORD_RESET_REQUESTED_EMAIL',
      category: 'AUTH',
      customerId: user._id,
      description: `Password reset link requested for customer ${user.email}`,
      details: { email: user.email },
      ipAddress: req.ip || '127.0.0.1',
    });

    return res.status(200).json({
      success: true,
      message: 'If an account exists with this email address, a password reset link has been dispatched.',
    });
  } catch (err) {
    console.error('[Request Password Reset Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to process password reset request.' });
  }
};

// Customer Online: Verify Token and Set New Password
export const resetPasswordWithEmailToken = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !token.trim()) {
      return res.status(400).json({ success: false, message: 'Password reset token is required.' });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
    }

    const hashedToken = crypto.createHash('sha256').update(token.trim()).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    }).select('+password +passwordResetToken +passwordResetExpires');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Password reset link is invalid or has expired. Please request a new link.',
      });
    }

    user.password = newPassword;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();

    // Send confirmation email
    if (user.email) {
      sendPasswordResetConfirmationEmail({ user }).catch((err) =>
        console.error('[Password Reset Confirmation Email Error]:', err.message)
      );
    }

    await ActivityLog.create({
      userId: user._id,
      userName: user.name,
      userRole: user.role,
      action: 'PASSWORD_RESET_SUCCESS_EMAIL',
      category: 'AUTH',
      customerId: user._id,
      description: `Customer ${user.name} successfully reset password via secure email link`,
      details: { email: user.email, phone: user.phone },
      ipAddress: req.ip || '127.0.0.1',
    });

    return res.status(200).json({
      success: true,
      message: 'Your password has been reset successfully! You can now log in with your new password.',
    });
  } catch (err) {
    console.error('[Reset Password Token Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to reset password.' });
  }
};
