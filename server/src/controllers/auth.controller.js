import crypto from 'crypto';
import User from '../models/User.js';
import OtpVerification from '../models/OtpVerification.js';
import ActivityLog from '../models/ActivityLog.js';
import { ROLES } from '../config/constants.js';
import {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendPasswordResetConfirmationEmail,
  sendOtpEmail,
} from '../services/email.service.js';

function maskEmail(email) {
  if (!email || !email.includes('@')) return 'your registered email';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
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
      isGuest: false,
    });

    await user.save();

    // Audit log
    await ActivityLog.create({
      userId: user._id,
      userName: user.name,
      userRole: user.role,
      action: 'USER_REGISTER',
      category: 'AUTH',
      details: { email: user.email, phone: user.phone },
      ipAddress: req.ip || '127.0.0.1',
    });

    // Send Welcome Email
    if (user.email) {
      sendWelcomeEmail({ user }).catch((err) =>
        console.error('[Registration Welcome Email Error]:', err.message)
      );
    }

    const token = user.generateAuthToken();

    res.status(201).json({
      success: true,
      message: 'Registration successful! Welcome to NOAH GAMING.',
      data: {
        token,
        user: user.toSafeObject(),
      },
    });
  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error during registration. Please try again.',
      error: err.message,
    });
  }
};

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

    // 3. Save verification record with SHA-256 hash only
    await OtpVerification.create({
      userId: user._id,
      email: user.email,
      otpHash,
      purpose: 'LOGIN_2FA',
      challengeId,
      expiresAt,
      resendAvailableAt,
      attempts: 0,
      maxAttempts: 5,
    });

    // 4. Dispatch real OTP email via Resend
    const emailResult = await sendOtpEmail({
      email: user.email,
      name: user.name,
      otp: otpCode,
      purpose: 'LOGIN_2FA',
      expiresMinutes: 5,
    });

    if (emailResult.notConfigured) {
      return res.status(503).json({
        success: false,
        message:
          'Email verification service is currently unconfigured on the server. Please contact lounge administration to enable 2FA delivery.',
      });
    }

    await ActivityLog.create({
      userId: user._id,
      userName: user.name,
      userRole: user.role,
      action: 'CUSTOMER_LOGIN_2FA_DISPATCHED',
      category: 'AUTH',
      details: { email: user.email, challengeId },
      ipAddress: req.ip || '127.0.0.1',
    });

    // 5. Return challenge identifier - ZERO authentication tokens or sessions issued!
    return res.status(200).json({
      success: true,
      requires2FA: true,
      message: 'Two-factor verification code dispatched to your registered email address.',
      data: {
        challengeId,
        maskedEmail: maskEmail(user.email),
        maskedPhone: maskPhone(user.phone),
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

    await OtpVerification.create({
      userId: user._id,
      email: user.email,
      otpHash: newOtpHash,
      purpose: 'LOGIN_2FA',
      challengeId: newChallengeId,
      expiresAt,
      resendAvailableAt,
      attempts: 0,
      maxAttempts: 5,
    });

    await sendOtpEmail({
      email: user.email,
      name: user.name,
      otp: newOtpCode,
      purpose: 'LOGIN_2FA',
      expiresMinutes: 5,
    });

    return res.status(200).json({
      success: true,
      message: 'A fresh verification code has been dispatched to your email address.',
      data: {
        challengeId: newChallengeId,
        maskedEmail: maskEmail(user.email),
        resendCooldownSeconds: 60,
        expiresInSeconds: 300,
      },
    });
  } catch (err) {
    console.error('[resendCustomerLogin2FA Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to resend verification code.' });
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
        message: 'No customer account found with this mobile number or email.',
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
      details: { email: user.email, phone: user.phone },
      ipAddress: req.ip || '127.0.0.1',
    });

    res.status(200).json({
      success: true,
      message: `Password reset verification code sent to ${maskEmail(user.email)}.`,
      data: {
        userId: user._id,
        phone: user.phone,
        maskedPhone: maskPhone(user.phone),
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
    const { identifier, otp, newPassword } = req.body;
    if (!identifier || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Mobile/email, OTP, and new password are required.',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    const cleanOtp = otp.trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      return res.status(400).json({
        success: false,
        message: 'Verification code must be exactly 6 digits.',
      });
    }

    const clean = identifier.trim();
    const cleanPhone = clean.replace(/\D/g, '');
    const cleanEmail = clean.toLowerCase();

    const user = await User.findOne({
      $or: [{ phone: cleanPhone }, { email: cleanEmail }],
    }).select('+password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
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

    // 4. Invalidate OTP upon success
    record.verified = true;
    record.used = true;
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
      description: `Customer '${user.name}' (${user.phone}) reset password online via email OTP`,
      details: { userId: user._id, phone: user.phone },
      ipAddress: req.ip || '127.0.0.1',
    });

    if (user.email) {
      sendPasswordResetConfirmationEmail({ user }).catch((err) =>
        console.error('[OTP Reset Confirmation Email Error]:', err.message)
      );
    }

    res.status(200).json({
      success: true,
      message: 'Password reset successfully! You can now log in with your new password.',
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

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const resetUrl = `${clientUrl}#reset-password?token=${resetToken}`;

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
