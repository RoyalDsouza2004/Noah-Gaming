import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { userManagementApi } from '../api/userManagement.js';
import { emailApi } from '../api/email.js';
import { showToast } from '../utils/toast.js';
import { SixDigitOtpInput } from './common/SixDigitOtpInput.jsx';
import { maskEmail } from '../utils/mask.js';
import {
  X,
  Lock,
  Mail,
  Phone,
  User,
  Shield,
  Sparkles,
  AlertCircle,
  ArrowRight,
  KeyRound,
  CheckCircle2,
  Loader2,
  UserCheck,
  ShieldCheck,
  Clock,
  HelpCircle,
  RefreshCw,
  Eye,
  EyeOff,
} from 'lucide-react';

export const AuthModal = () => {
  const {
    authModalOpen,
    setAuthModalOpen,
    authModalTab,
    setAuthModalTab,
    login,
    verifyLogin2FA,
    resendLogin2FA,
    verifyRegistrationOtp,
    resendRegistrationOtp,
    requestOtpAssistance,
    getOtpAssistanceStatus,
    completeOtpAssistance,
    register,
    setAuthData,
    // Centralized challenge state from AuthContext
    otpChallengeData,
    setOtpChallengeData,
    otpCooldown,
    setOtpCooldown,
    challengeRemainingSeconds,
    setChallengeRemainingSeconds,
    assistanceRequested,
    setAssistanceRequested,
    assistanceStatus,
    setAssistanceStatus,
    rejectionReason,
    setRejectionReason,
  } = useAuth();

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Customer OTP input & local operation state
  const [otpCode, setOtpCode] = useState('');
  const [submittingOtp, setSubmittingOtp] = useState(false);
  const [requestingAssistance, setRequestingAssistance] = useState(false);
  const checkingStatusRef = useRef(false);

  // Register form state
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');

  // Conversion state (Guest to Registered)
  const [conversionData, setConversionData] = useState(null);
  const [convertOtp, setConvertOtp] = useState('');
  const [convertPassword, setConvertPassword] = useState('');
  const [convertCooldown, setConvertCooldown] = useState(0);
  const [submittingConversion, setSubmittingConversion] = useState(false);

  // Forgot password state
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [showForgotConfirmPassword, setShowForgotConfirmPassword] = useState(false);
  const [forgotMaskedEmail, setForgotMaskedEmail] = useState('');
  const [forgotStep, setForgotStep] = useState('identifier'); // 'identifier' | 'otp' | 'newPassword' | 'success'
  const [forgotVerifiedToken, setForgotVerifiedToken] = useState('');
  const [forgotOtpSent, setForgotOtpSent] = useState(false);
  const [forgotCooldown, setForgotCooldown] = useState(0);
  const [submittingForgot, setSubmittingForgot] = useState(false);

  const resetForgotState = () => {
    setForgotIdentifier('');
    setForgotOtp('');
    setForgotNewPassword('');
    setForgotConfirmPassword('');
    setShowForgotNewPassword(false);
    setShowForgotConfirmPassword(false);
    setForgotMaskedEmail('');
    setForgotStep('identifier');
    setForgotVerifiedToken('');
    setForgotOtpSent(false);
    setForgotCooldown(0);
    setSubmittingForgot(false);
  };

  // Email-based password reset token state
  const [resetToken, setResetToken] = useState('');
  const [tokenNewPassword, setTokenNewPassword] = useState('');
  const [submittingTokenReset, setSubmittingTokenReset] = useState(false);
  const [emailLinkSent, setEmailLinkSent] = useState(false);
  const [submittingEmailLink, setSubmittingEmailLink] = useState(false);

  // Status state
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Countdown timers tick
  useEffect(() => {
    const timer = setInterval(() => {
      setOtpCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      setChallengeRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      setConvertCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      setForgotCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [setOtpCooldown, setChallengeRemainingSeconds]);

  // Check approval status: can be called by polling timer or user manual button
  const checkApprovalStatusNow = useCallback(
    async (silent = false) => {
      if (!otpChallengeData?.challengeId || checkingStatusRef.current) return;
      try {
        checkingStatusRef.current = true;
        const res = await getOtpAssistanceStatus(otpChallengeData.challengeId);
        if (res?.success && res.data) {
          if (res.data.status === 'APPROVED' && res.data.approvalToken) {
            setAssistanceStatus('APPROVED');
            showToast.success('Administrator approved your verification! Completing authentication...');
            const compRes = await completeOtpAssistance(otpChallengeData.challengeId, res.data.approvalToken);
            if (compRes?.success) {
              setAuthModalOpen(false);
              showToast.success(`Welcome to NOAH GAMING, ${compRes.user?.name || 'Gamer'}!`);
              if (compRes.user?.role === 'admin') {
                window.location.hash = '#admin';
              } else if (compRes.user?.role === 'receptionist') {
                window.location.hash = '#receptionist';
              } else {
                window.location.hash = '#home';
              }
            } else {
              setErrorMessage(compRes?.message || 'Failed to complete authentication.');
            }
          } else if (res.data.status === 'REJECTED') {
            setAssistanceStatus('REJECTED');
            setRejectionReason(res.data.rejectionReason || 'Identity verification could not be confirmed.');
            if (!silent) showToast.error('Your verification request was rejected by the administrator.');
          } else if (res.data.status === 'EXPIRED') {
            setAssistanceStatus('EXPIRED');
            if (!silent) showToast.error('Verification challenge has expired.');
          } else if (!silent) {
            showToast.info('Verification is still pending review by the administrator.');
          }
        }
      } catch (err) {
        if (!silent) showToast.error(err.message || 'Error checking approval status.');
      } finally {
        checkingStatusRef.current = false;
      }
    },
    [
      otpChallengeData?.challengeId,
      getOtpAssistanceStatus,
      completeOtpAssistance,
      setAuthModalOpen,
      setAssistanceStatus,
      setErrorMessage,
      setRejectionReason,
    ]
  );

  // Polling for Admin Assistance Approval (checks immediately and every 2 seconds)
  useEffect(() => {
    let interval = null;
    const isAwaiting =
      (authModalTab === 'login2FA' || authModalTab === 'registerOTP') &&
      assistanceRequested &&
      assistanceStatus === 'AWAITING_ADMIN_ASSISTANCE' &&
      otpChallengeData?.challengeId;

    if (isAwaiting) {
      // Immediate status check
      checkApprovalStatusNow(true);
      // High-frequency poll (2s)
      interval = setInterval(() => {
        checkApprovalStatusNow(true);
      }, 2000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [
    authModalTab,
    assistanceRequested,
    assistanceStatus,
    otpChallengeData?.challengeId,
    checkApprovalStatusNow,
  ]);

  // Check URL hash for #reset-password?token=...
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash || '';
      if (hash.startsWith('#reset-password')) {
        let token = '';
        if (hash.includes('token=')) {
          token = hash.split('token=')[1]?.split('&')[0];
        } else {
          const urlParams = new URLSearchParams(window.location.search);
          token = urlParams.get('token');
        }

        if (token) {
          setResetToken(token);
          setAuthModalTab('resetToken');
          setAuthModalOpen(true);
        }
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [setAuthModalOpen, setAuthModalTab]);

  if (!authModalOpen) return null;

  // Handle Login Submit
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    const result = await login(loginIdentifier, loginPassword);
    setLoading(false);

    // If customer requires 2FA or pending registration verification:
    if (result.requires2FA || result.requiresOtpVerification) {
      setOtpCode('');
      showToast.info('Verification code dispatched to your registered email.');
      return;
    }

    if (!result.success) {
      setErrorMessage(result.message);
      showToast.error(result.message || 'Login failed');
    } else {
      setAuthModalOpen(false);
      showToast.success(`Welcome back, ${result.user?.name || 'Gamer'}!`);
      if (result.user?.role === 'admin') {
        window.location.hash = '#admin';
      } else if (result.user?.role === 'receptionist') {
        window.location.hash = '#receptionist';
      } else {
        window.location.hash = '#home';
      }
    }
  };

  // Handle Customer OTP Verification Submit (both Login 2FA and Registration)
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    if (!otpCode || otpCode.length !== 6) {
      setErrorMessage('Please enter the complete 6-digit verification code.');
      return;
    }

    try {
      setSubmittingOtp(true);
      const isReg = otpChallengeData?.purpose === 'REGISTRATION';
      const res = isReg
        ? await verifyRegistrationOtp(otpChallengeData.challengeId, otpCode)
        : await verifyLogin2FA(otpChallengeData.challengeId, otpCode);

      if (res.success) {
        showToast.success(`Welcome to NOAH GAMING, ${res.user?.name || 'Gamer'}!`);
        setAuthModalOpen(false);
        if (res.user?.role === 'admin') {
          window.location.hash = '#admin';
        } else if (res.user?.role === 'receptionist') {
          window.location.hash = '#receptionist';
        } else {
          window.location.hash = '#home';
        }
      } else {
        setErrorMessage(res.message || 'Verification failed');
        showToast.error(res.message || 'Verification failed');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Verification failed');
      showToast.error(err.message || 'Verification failed');
    } finally {
      setSubmittingOtp(false);
    }
  };

  // Handle Customer OTP Resend
  const handleResendOtp = async () => {
    if (otpCooldown > 0 || !otpChallengeData?.challengeId) return;
    try {
      setSubmittingOtp(true);
      const isReg = otpChallengeData?.purpose === 'REGISTRATION';
      const res = isReg
        ? await resendRegistrationOtp(otpChallengeData.challengeId)
        : await resendLogin2FA(otpChallengeData.challengeId);

      if (res.success) {
        showToast.success('A fresh verification code has been dispatched to your email.');
      } else {
        showToast.error(res.message || 'Failed to resend verification code');
      }
    } catch (err) {
      showToast.error(err.message || 'Failed to resend verification code');
    } finally {
      setSubmittingOtp(false);
    }
  };

  // Handle Request Admin Assistance Fallback
  const handleRequestAdminAssistance = async () => {
    if (!otpChallengeData?.challengeId) return;
    try {
      setRequestingAssistance(true);
      setErrorMessage('');
      const res = await requestOtpAssistance(otpChallengeData.challengeId);
      if (res.success) {
        showToast.info('Verification request sent to Administrator. Waiting for approval...');
      } else {
        showToast.error(res.message || 'Failed to request Admin assistance');
      }
    } catch (err) {
      showToast.error(err.message || 'Failed to request Admin assistance');
    } finally {
      setRequestingAssistance(false);
    }
  };

  // Handle Customer Registration Submit
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    const result = await register({
      name: registerName,
      email: registerEmail,
      phone: registerPhone,
      password: registerPassword,
    });
    setLoading(false);

    if (result.requiresOtpVerification) {
      setOtpCode('');
      showToast.info('Verification code sent to your registered email.');
      return;
    }

    if (result.requiresConversion) {
      setConversionData({
        userId: result.data?.userId,
        phone: result.data?.phone || registerPhone,
        name: registerName || result.data?.name,
        email: registerEmail || result.data?.email,
        maskedPhone: result.data?.maskedPhone || `XXXXXX${registerPhone.slice(-4)}`,
        maskedEmail: result.data?.maskedEmail,
      });
      setConvertPassword(registerPassword);
      setConvertOtp('');
      setConvertCooldown(result.data?.resendCooldownSeconds || 60);
      setAuthModalTab('convertGuest');
      showToast.success('Existing guest profile found! Enter email OTP to convert your account.');
      return;
    }

    if (result.requiresConversion) {
      setConversionData({
        userId: result.data?.userId,
        phone: result.data?.phone || registerPhone,
        name: registerName || result.data?.name,
        email: registerEmail || result.data?.email,
        maskedPhone: result.data?.maskedPhone || `XXXXXX${registerPhone.slice(-4)}`,
        maskedEmail: result.data?.maskedEmail,
      });
      setConvertPassword(registerPassword);
      setConvertOtp('');
      setConvertCooldown(result.data?.resendCooldownSeconds || 60);
      setAuthModalTab('convertGuest');
      showToast.success('Existing guest profile found! Enter email OTP to convert your account.');
      return;
    }

    if (!result.success) {
      setErrorMessage(result.message);
      showToast.error(result.message || 'Registration failed');
    } else {
      setAuthModalOpen(false);
      showToast.success('Account created successfully! Welcome to NOAH GAMING.');
    }
  };

  // Online Guest Conversion Submit
  const handleConversionSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    if (!convertOtp || convertOtp.length !== 6 || !convertPassword) {
      setErrorMessage('Please enter the 6-digit OTP and your chosen password.');
      return;
    }

    try {
      setSubmittingConversion(true);
      const res = await userManagementApi.verifyOnlineConversionOtp({
        userId: conversionData?.userId,
        phone: conversionData?.phone,
        otp: convertOtp.trim(),
        password: convertPassword,
        name: conversionData?.name,
        email: conversionData?.email,
      });

      if (res?.success) {
        setAuthModalOpen(false);
        showToast.success('Account activated! All your prior bookings & receipts are ready.');
        setAuthData({ token: res.data.token, user: res.data.user });
      } else {
        setErrorMessage(res?.message || 'Verification failed');
        showToast.error(res?.message || 'Verification failed');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Verification failed');
      showToast.error(err.message || 'Verification failed');
    } finally {
      setSubmittingConversion(false);
    }
  };

  // Request new conversion OTP
  const handleResendConversionOtp = async () => {
    if (convertCooldown > 0 || !conversionData?.phone) return;
    try {
      setLoading(true);
      const res = await userManagementApi.requestOnlineConversionOtp(
        conversionData.phone,
        conversionData.email
      );
      if (res?.success) {
        showToast.success(`New verification code sent to ${res.data?.maskedEmail || 'your email'}!`);
        setConvertCooldown(res.data?.resendCooldownSeconds || 60);
      } else {
        showToast.error(res?.message || 'Failed to send OTP');
      }
    } catch (err) {
      showToast.error(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  // 1. Request OTP for Forgot Password
  const handleRequestForgotOtp = async () => {
    if (!forgotIdentifier.trim() || forgotCooldown > 0) {
      if (!forgotIdentifier.trim()) setErrorMessage('Please enter your mobile number or email.');
      return;
    }
    setErrorMessage('');
    try {
      setSubmittingForgot(true);
      const res = await userManagementApi.requestOnlineForgotPasswordOtp(forgotIdentifier.trim());
      if (res?.success) {
        setForgotOtpSent(true);
        const serverMasked = res.data?.maskedEmail || maskEmail(forgotIdentifier.trim());
        setForgotMaskedEmail(serverMasked);
        setForgotCooldown(res.data?.resendCooldownSeconds || 60);
        setForgotStep('otp');
        showToast.success(`Verification code dispatched to ${serverMasked}!`);
      } else {
        setErrorMessage(res?.message || 'Failed to generate reset OTP');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to send reset OTP');
    } finally {
      setSubmittingForgot(false);
    }
  };

  // 2. Verify OTP code (Step 2)
  const handleVerifyForgotOtpCode = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setErrorMessage('');
    const cleanOtp = (forgotOtp || '').trim();
    if (cleanOtp.length !== 6) {
      setErrorMessage('Please enter the complete 6-digit verification code.');
      return;
    }
    try {
      setSubmittingForgot(true);
      const res = await userManagementApi.verifyOnlineForgotPasswordOtp({
        identifier: forgotIdentifier.trim(),
        otp: cleanOtp,
      });
      if (res?.success) {
        if (res.data?.resetToken) {
          setForgotVerifiedToken(res.data.resetToken);
        }
        setForgotStep('newPassword');
        showToast.success('Verification code accepted! Please set your new password.');
      } else {
        setErrorMessage(res?.message || 'Invalid verification code');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Verification failed');
    } finally {
      setSubmittingForgot(false);
    }
  };

  // 3. Save New Password (Step 3)
  const handleSaveNewPassword = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setErrorMessage('');
    if (!forgotNewPassword || forgotNewPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters long.');
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setErrorMessage('New passwords do not match. Please verify both fields.');
      return;
    }
    try {
      setSubmittingForgot(true);
      const payload = {
        identifier: forgotIdentifier.trim(),
        newPassword: forgotNewPassword,
      };
      if (forgotVerifiedToken) {
        payload.resetToken = forgotVerifiedToken;
      } else {
        payload.otp = forgotOtp.trim();
      }
      const res = await userManagementApi.verifyOnlineForgotPasswordOtp(payload);
      if (res?.success) {
        setForgotStep('success');
        showToast.success('Password reset successfully! You can now sign in.');
      } else {
        setErrorMessage(res?.message || 'Failed to update password');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to update password');
    } finally {
      setSubmittingForgot(false);
    }
  };

  // Request password reset email link
  const handleRequestEmailResetLink = async () => {
    if (!forgotIdentifier.trim()) {
      setErrorMessage('Please enter your email address to receive a reset link.');
      return;
    }
    setErrorMessage('');
    try {
      setSubmittingEmailLink(true);
      const res = await emailApi.requestPasswordResetEmail(forgotIdentifier.trim());
      setEmailLinkSent(true);
      showToast.success('Password reset link dispatched! Please check your email inbox.');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to dispatch reset email');
    } finally {
      setSubmittingEmailLink(false);
    }
  };

  // Token-based password reset submission
  const handleTokenResetSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    if (!resetToken) {
      setErrorMessage('Password reset token is missing from the link.');
      return;
    }
    if (!tokenNewPassword || tokenNewPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    try {
      setSubmittingTokenReset(true);
      const res = await emailApi.resetPasswordWithToken(resetToken, tokenNewPassword);
      if (res?.success) {
        showToast.success('Password reset successfully! Please sign in with your new password.');
        window.location.hash = '';
        setAuthModalTab('login');
        setLoginPassword('');
      } else {
        setErrorMessage(res?.message || 'Password reset failed');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Password reset failed');
    } finally {
      setSubmittingTokenReset(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto p-5 sm:p-6 bg-[#260D17] border border-[#49202C] rounded-2xl sm:rounded-3xl shadow-2xl text-[#FFF4E8] m-auto">
        {/* Close Button */}
        <button
          onClick={() => setAuthModalOpen(false)}
          className="absolute top-4 right-4 p-1.5 text-[#C7A5A8] hover:text-[#FFF4E8] rounded-lg hover:bg-[#171014] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-black font-heading text-[#FFF4E8]">
            {authModalTab === 'login'
              ? 'WELCOME TO NOAH'
              : authModalTab === 'login2FA'
              ? 'VERIFY YOUR LOGIN'
              : authModalTab === 'register'
              ? 'JOIN NOAH GAMING'
              : authModalTab === 'registerOTP'
              ? 'VERIFY YOUR EMAIL'
              : authModalTab === 'convertGuest'
              ? 'CLAIM YOUR PROFILE'
              : authModalTab === 'forgotPassword'
              ? (forgotStep === 'otp'
                  ? 'VERIFY YOUR EMAIL'
                  : forgotStep === 'newPassword'
                  ? 'SET NEW PASSWORD'
                  : forgotStep === 'success'
                  ? 'PASSWORD UPDATED'
                  : 'RESET PASSWORD')
              : 'RESET PASSWORD'}
          </h2>
          <p className="text-xs text-[#C7A5A8] mt-1">
            {authModalTab === 'login'
              ? 'Access your gaming profile, passes, and bookings'
              : authModalTab === 'login2FA'
              ? 'Enter the verification code sent to your email address to securely sign in.'
              : authModalTab === 'register'
              ? 'Join NOAH GAMING for instant online session bookings'
              : authModalTab === 'registerOTP'
              ? 'Enter the verification code sent to your email address to complete your registration.'
              : authModalTab === 'convertGuest'
              ? 'Verify your email OTP to connect existing bookings and stats'
              : authModalTab === 'forgotPassword'
              ? (forgotStep === 'otp'
                  ? 'Enter the verification OTP sent to your registered email to continue.'
                  : forgotStep === 'newPassword'
                  ? 'Choose a secure new password for your account (min 6 characters).'
                  : forgotStep === 'success'
                  ? 'Your account password has been successfully updated.'
                  : 'Enter your registered email address or mobile number to receive a verification code.')
              : 'Enter the verification OTP to verify your identity and set a new password.'}
          </p>
        </div>

        {/* Tab Switcher (Visible on Login & Register tabs) */}
        {(authModalTab === 'login' || authModalTab === 'register') && (
          <div className="flex p-1 mb-6 rounded-xl bg-[#171014] border border-[#49202C]">
            <button
              type="button"
              onClick={() => {
                setAuthModalTab('login');
                setErrorMessage('');
              }}
              className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                authModalTab === 'login'
                  ? 'bg-[#851B2B] text-[#FFF4E8] shadow-md font-heading'
                  : 'text-[#C7A5A8] hover:text-[#FFF4E8]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthModalTab('register');
                setErrorMessage('');
              }}
              className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                authModalTab === 'register'
                  ? 'bg-[#851B2B] text-[#FFF4E8] shadow-md font-heading'
                  : 'text-[#C7A5A8] hover:text-[#FFF4E8]'
              }`}
            >
              Register
            </button>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-2">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ---------------- 1. LOGIN TAB ---------------- */}
        {authModalTab === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#C7A5A8] mb-1">
                Email Address or Mobile Number
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C7A5A8]" />
                <input
                  type="text"
                  required
                  placeholder="admin@gaminglounge.com or 9876543210"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-[#171014] border border-[#49202C] rounded-xl text-sm text-[#FFF4E8] placeholder-[#C7A5A8]/50 focus:outline-none focus:border-[#851B2B]"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#C7A5A8]">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotIdentifier(loginIdentifier);
                    setAuthModalTab('forgotPassword');
                    setErrorMessage('');
                  }}
                  className="text-[11px] text-[#D7FF00] hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C7A5A8]" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-[#171014] border border-[#49202C] rounded-xl text-sm text-[#FFF4E8] placeholder-[#C7A5A8]/50 focus:outline-none focus:border-[#851B2B]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#851B2B] hover:bg-[#6E1623] active:bg-[#5E121E] text-white font-bold rounded-xl shadow-lg shadow-[#851B2B]/25 transition-all font-heading flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Authenticating...
                </>
              ) : (
                <>
                  Sign In Now <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setAuthModalTab('convertGuest');
                  setErrorMessage('');
                }}
                className="text-xs text-[#C7A5A8] hover:text-[#D7FF00] transition-colors inline-flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Played as a walk-in guest? Claim your account &rarr;
              </button>
            </div>
          </form>
        )}

        {/* ---------------- 2. CUSTOMER OTP VERIFICATION (LOGIN 2FA & REGISTRATION) ---------------- */}
        {(authModalTab === 'login2FA' || authModalTab === 'registerOTP') && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            {/* Header Banner */}
            <div className="p-3.5 rounded-xl bg-[#851B2B]/20 border border-[#851B2B]/40 text-xs text-[#FFF4E8]">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 text-[#D7FF00] font-bold">
                  {authModalTab === 'registerOTP' ? (
                    <UserCheck className="w-4 h-4 text-[#D7FF00]" />
                  ) : (
                    <Shield className="w-4 h-4 text-[#D7FF00]" />
                  )}
                  <span>
                    {authModalTab === 'registerOTP'
                      ? 'Registration Email Verification'
                      : 'Login Security Verification'}
                  </span>
                </div>
                <span className="font-mono text-[11px] font-bold text-amber-300 flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  <Clock className="w-3 h-3" />
                  {Math.floor(challengeRemainingSeconds / 60)}:
                  {(challengeRemainingSeconds % 60).toString().padStart(2, '0')}
                </span>
              </div>
              <p className="text-[#C7A5A8]">
                {authModalTab === 'registerOTP'
                  ? 'Enter the 6-digit verification code dispatched to: '
                  : 'Enter the 6-digit security code dispatched to: '}
                <span className="font-mono text-white font-bold">
                  {otpChallengeData?.maskedEmail || 'your email'}
                </span>
                .
              </p>
            </div>

            {/* Email Delivery Warning: only rendered when provider returns a failure or unconfigured state */}
            {(otpChallengeData?.emailDeliveryStatus === 'FAILED' ||
              otpChallengeData?.emailDeliveryStatus === 'NOT_CONFIGURED') && (
              <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">
                    {otpChallengeData?.emailDeliveryStatus === 'NOT_CONFIGURED'
                      ? 'Email service is unconfigured on the server.'
                      : 'Email dispatch encountered a delivery issue.'}
                  </span>
                  <p className="text-[11px] text-amber-200/80 mt-0.5">
                    {otpChallengeData?.emailDeliveryError
                      ? `${otpChallengeData.emailDeliveryError}. `
                      : ''}
                    If you do not receive the email code, click <strong>Request Admin Assistance</strong> below to verify your session with lounge staff.
                  </p>
                </div>
              </div>
            )}

            {/* 6-Digit OTP Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#C7A5A8]">
                  Enter 6-Digit Code *
                </label>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={otpCooldown > 0 || submittingOtp}
                  className="text-[11px] text-[#D7FF00] hover:underline disabled:opacity-50 disabled:no-underline font-mono flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${submittingOtp ? 'animate-spin' : ''}`} />
                  {otpCooldown > 0 ? `Resend in ${otpCooldown}s` : 'Resend Code'}
                </button>
              </div>

              <SixDigitOtpInput
                value={otpCode}
                onChange={setOtpCode}
                disabled={submittingOtp || assistanceStatus === 'AWAITING_ADMIN_ASSISTANCE'}
                variant="lime"
              />
            </div>

            <button
              type="submit"
              disabled={submittingOtp || otpCode.length !== 6 || challengeRemainingSeconds <= 0}
              className="w-full py-2.5 px-4 bg-[#851B2B] hover:bg-[#6E1623] active:bg-[#5E121E] text-white font-bold rounded-xl shadow-lg shadow-[#851B2B]/25 transition-all font-heading flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submittingOtp ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Verifying Code...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />{' '}
                  {authModalTab === 'registerOTP' ? 'Complete Registration' : 'Complete Sign In'}
                </>
              )}
            </button>

            {/* Admin-Assisted OTP Verification Fallback Section */}
            <div className="pt-2 border-t border-[#49202C]/60 space-y-3">
              <div className="flex items-center justify-between text-xs text-[#C7A5A8]">
                <span className="font-semibold flex items-center gap-1">
                  <HelpCircle className="w-3.5 h-3.5 text-[#D7FF00]" /> Didn't receive your OTP?
                </span>
              </div>

              {/* Assistance Status: AWAITING_ADMIN_ASSISTANCE */}
              {assistanceRequested && assistanceStatus === 'AWAITING_ADMIN_ASSISTANCE' && (
                <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-500/40 text-xs text-cyan-200 space-y-2.5 animate-fadeIn">
                  <div className="flex items-center gap-2 font-bold text-cyan-300">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
                    </span>
                    <span>Admin Assistance Requested</span>
                  </div>
                  <p className="text-[11px] text-cyan-200/90 leading-relaxed">
                    Your verification request has been sent to the Admin Console. The system is listening for administrator approval and will log you in automatically.
                  </p>
                  <div className="flex items-center justify-between pt-1 text-[11px] text-cyan-300/80 font-mono border-t border-cyan-500/20">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                      Listening for approval...
                    </span>
                    <span className="font-bold">
                      Expires in: {Math.floor(challengeRemainingSeconds / 60)}:
                      {(challengeRemainingSeconds % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => checkApprovalStatusNow(false)}
                    className="w-full py-2 px-3 rounded-lg bg-cyan-900/40 hover:bg-cyan-800/60 border border-cyan-500/40 text-cyan-200 hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition-all mt-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Check Approval Status Now
                  </button>
                </div>
              )}

              {/* Assistance Status: REJECTED */}
              {assistanceStatus === 'REJECTED' && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300 space-y-1.5 animate-fadeIn">
                  <div className="flex items-center gap-1.5 font-bold text-rose-400">
                    <AlertCircle className="w-4 h-4" /> Verification Request Denied
                  </div>
                  <p className="text-[11px] text-rose-200">
                    {rejectionReason || 'The administrator rejected this verification request.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setAssistanceRequested(false);
                      setAssistanceStatus('PENDING');
                    }}
                    className="text-[11px] font-bold text-rose-300 underline hover:text-white"
                  >
                    Try Requesting Assistance Again
                  </button>
                </div>
              )}

              {/* Assistance Status: EXPIRED */}
              {(challengeRemainingSeconds <= 0 || assistanceStatus === 'EXPIRED') && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" /> Verification Challenge Expired
                  </div>
                  <p className="text-[11px] text-rose-200">
                    This verification session has exceeded its 5-minute validity limit. Please return to start a fresh session.
                  </p>
                </div>
              )}

              {/* Request Assistance Button (Visible when not actively awaiting or rejected) */}
              {!assistanceRequested && challengeRemainingSeconds > 0 && (
                <div className="rounded-xl p-3 bg-[#171014] border border-[#49202C]">
                  <p className="text-[11px] text-[#C7A5A8] mb-2 leading-relaxed">
                    Not getting the verification email? You can request manual identity verification from the lounge administrator without entering an OTP.
                  </p>
                  <button
                    type="button"
                    onClick={handleRequestAdminAssistance}
                    disabled={requestingAssistance}
                    className="w-full py-2 px-3 rounded-lg bg-[#260D17] hover:bg-[#381322] border border-[#851B2B]/40 hover:border-[#851B2B] text-xs font-bold text-[#FFF4E8] flex items-center justify-center gap-2 transition-all shadow-sm font-heading"
                  >
                    {requestingAssistance ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Contacting Administrator...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4 text-[#D7FF00]" /> Request Admin Assistance
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Back Button */}
            <button
              type="button"
              onClick={() => {
                setAuthModalTab(authModalTab === 'registerOTP' ? 'register' : 'login');
                setErrorMessage('');
                setOtpCode('');
                setAssistanceRequested(false);
                setAssistanceStatus('PENDING');
              }}
              className="w-full text-center text-xs text-[#C7A5A8] hover:text-white pt-1"
            >
              &larr; Back to {authModalTab === 'registerOTP' ? 'Registration' : 'Sign In'}
            </button>
          </form>
        )}

        {/* ---------------- 3. REGISTER TAB ---------------- */}
        {authModalTab === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#C7A5A8] mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C7A5A8]" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Verma"
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-[#171014] border border-[#49202C] rounded-xl text-sm text-[#FFF4E8] placeholder-[#C7A5A8]/50 focus:outline-none focus:border-[#851B2B]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#C7A5A8] mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C7A5A8]" />
                <input
                  type="email"
                  required
                  placeholder="rahul@example.com"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-[#171014] border border-[#49202C] rounded-xl text-sm text-[#FFF4E8] placeholder-[#C7A5A8]/50 focus:outline-none focus:border-[#851B2B]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#C7A5A8] mb-1">
                10-Digit Mobile Number
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C7A5A8]" />
                <input
                  type="tel"
                  required
                  maxLength={10}
                  placeholder="9876543210"
                  value={registerPhone}
                  onChange={(e) => setRegisterPhone(e.target.value.replace(/\D/g, ''))}
                  className="w-full pl-9 pr-4 py-2 bg-[#171014] border border-[#49202C] rounded-xl text-sm text-[#FFF4E8] placeholder-[#C7A5A8]/50 focus:outline-none focus:border-[#851B2B]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#C7A5A8] mb-1">
                Password (min 6 characters)
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C7A5A8]" />
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-[#171014] border border-[#49202C] rounded-xl text-sm text-[#FFF4E8] placeholder-[#C7A5A8]/50 focus:outline-none focus:border-[#851B2B]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#851B2B] hover:bg-[#6E1623] active:bg-[#5E121E] text-white font-bold rounded-xl shadow-lg shadow-[#851B2B]/25 transition-all font-heading flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            >
              {loading ? 'Creating Account...' : 'Complete Registration'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* ---------------- 4. GUEST CONVERSION VIEW ---------------- */}
        {authModalTab === 'convertGuest' && (
          <form onSubmit={handleConversionSubmit} className="space-y-4">
            <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-xs text-amber-200">
              <span className="font-bold text-white block mb-0.5">Existing Guest Profile Detected</span>
              We found your counter walk-in profile! Enter the 6-digit verification code sent to your registered email to claim your account and past bookings.
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#C7A5A8] mb-1">
                Mobile Number
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C7A5A8]" />
                <input
                  type="tel"
                  required
                  value={conversionData?.phone || registerPhone}
                  onChange={(e) =>
                    setConversionData({
                      ...conversionData,
                      phone: e.target.value.replace(/\D/g, ''),
                    })
                  }
                  placeholder="9876543210"
                  className="w-full pl-9 pr-4 py-2 bg-[#171014] border border-[#49202C] rounded-xl text-sm text-white font-mono"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#C7A5A8]">
                  6-Digit Verification OTP *
                </label>
                <button
                  type="button"
                  onClick={handleResendConversionOtp}
                  disabled={convertCooldown > 0 || loading}
                  className="text-[11px] text-[#D7FF00] hover:underline disabled:opacity-50 disabled:no-underline font-mono"
                >
                  {convertCooldown > 0 ? `Resend in ${convertCooldown}s` : 'Resend OTP'}
                </button>
              </div>

              <SixDigitOtpInput
                value={convertOtp}
                onChange={setConvertOtp}
                disabled={submittingConversion}
                variant="amber"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#C7A5A8] mb-1">
                Set Account Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C7A5A8]" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={convertPassword}
                  onChange={(e) => setConvertPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full pl-9 pr-4 py-2 bg-[#171014] border border-[#49202C] rounded-xl text-sm text-white focus:outline-none focus:border-[#851B2B]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submittingConversion || convertOtp.length !== 6 || !convertPassword}
              className="w-full py-2.5 px-4 bg-[#851B2B] hover:bg-[#6E1623] active:bg-[#5E121E] text-white font-bold rounded-xl shadow-lg shadow-[#851B2B]/25 transition-all font-heading flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submittingConversion ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Verifying...
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4" /> Activate & Claim Past History
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setAuthModalTab('login');
                setErrorMessage('');
              }}
              className="w-full text-center text-xs text-[#C7A5A8] hover:text-white pt-1"
            >
              &larr; Back to Sign In
            </button>
          </form>
        )}

        {/* ---------------- 5. FORGOT PASSWORD VIEW ---------------- */}
        {authModalTab === 'forgotPassword' && (
          <div className="space-y-4">
            {/* Step 1: Identifier Input */}
            {forgotStep === 'identifier' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleRequestForgotOtp();
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#C7A5A8] mb-1">
                    Registered Email or Mobile Number
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C7A5A8]" />
                    <input
                      type="text"
                      required
                      value={forgotIdentifier}
                      onChange={(e) => setForgotIdentifier(e.target.value)}
                      placeholder="e.g. roy@example.com or 9876543210"
                      className="w-full pl-9 pr-3 py-2.5 bg-[#171014] border border-[#49202C] rounded-xl text-sm text-white placeholder-[#785860] focus:outline-none focus:border-[#851B2B]"
                    />
                  </div>
                  <p className="text-[11px] text-[#A58287] mt-1.5 leading-relaxed">
                    Enter your registered email address or mobile number. The 6-digit verification code will always be delivered to your registered email address for account security.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={submittingForgot || !forgotIdentifier.trim() || forgotCooldown > 0}
                  className="w-full py-2.5 px-4 bg-[#851B2B] hover:bg-[#701529] active:bg-[#5E121E] text-white font-bold rounded-xl shadow-lg shadow-[#851B2B]/20 transition-all font-heading flex items-center justify-center gap-2 disabled:opacity-50 text-xs uppercase tracking-wider"
                >
                  {submittingForgot ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" /> Sending Verification Code...
                    </>
                  ) : forgotCooldown > 0 ? (
                    `Resend Available in ${forgotCooldown}s`
                  ) : (
                    'Send Verification Code'
                  )}
                </button>

                {/* Email Reset Link Fallback */}
                <div className="pt-2 border-t border-[#49202C]/60 text-center">
                  <button
                    type="button"
                    onClick={handleRequestEmailResetLink}
                    disabled={submittingEmailLink || !forgotIdentifier.trim()}
                    className="text-xs text-[#D7FF00] hover:underline flex items-center justify-center gap-1.5 mx-auto font-semibold disabled:opacity-50"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    {submittingEmailLink ? 'Dispatching link...' : 'Or email me a password reset link'}
                  </button>
                  {emailLinkSent && (
                    <p className="text-[11px] text-emerald-400 mt-1">
                      ✓ Reset link dispatched! Please check your email inbox.
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    resetForgotState();
                    setAuthModalTab('login');
                    setErrorMessage('');
                  }}
                  className="w-full text-center text-xs text-[#C7A5A8] hover:text-white pt-1"
                >
                  &larr; Back to Sign In
                </button>
              </form>
            )}

            {/* Step 2: OTP Verification */}
            {forgotStep === 'otp' && (
              <form onSubmit={handleVerifyForgotOtpCode} className="space-y-4">
                {/* Masked Email Destination Card */}
                <div className="p-3.5 bg-[#1F1018] border border-[#851B2B]/40 rounded-xl text-center shadow-inner">
                  <p className="text-xs text-[#C7A5A8]">We've sent a password-reset verification code to:</p>
                  <p className="text-sm font-bold font-mono text-[#D7FF00] mt-1 tracking-wide">
                    {forgotMaskedEmail || 'your registered email'}
                  </p>
                  <p className="text-[11px] text-[#A58287] mt-1">
                    Enter the six-digit code to continue.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#C7A5A8] mb-1.5 text-center">
                    6-Digit Verification Code
                  </label>
                  <SixDigitOtpInput
                    value={forgotOtp}
                    onChange={setForgotOtp}
                    disabled={submittingForgot}
                    variant="rose"
                  />
                </div>

                <div className="flex items-center justify-between text-xs pt-1 px-1">
                  <button
                    type="button"
                    onClick={handleRequestForgotOtp}
                    disabled={submittingForgot || forgotCooldown > 0}
                    className="text-[#D7FF00] hover:underline font-semibold disabled:opacity-50 flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${submittingForgot ? 'animate-spin' : ''}`} />
                    {forgotCooldown > 0 ? `Resend code in ${forgotCooldown}s` : 'Resend Code'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotStep('identifier');
                      setForgotOtp('');
                      setErrorMessage('');
                    }}
                    className="text-[#C7A5A8] hover:text-white text-xs underline"
                  >
                    Change mobile or email
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={submittingForgot || (forgotOtp || '').trim().length !== 6}
                  className="w-full py-2.5 px-4 bg-[#851B2B] hover:bg-[#701529] active:bg-[#5E121E] text-white font-bold rounded-xl shadow-lg shadow-[#851B2B]/20 transition-all font-heading flex items-center justify-center gap-2 disabled:opacity-50 text-xs uppercase tracking-wider"
                >
                  {submittingForgot ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" /> Verifying Code...
                    </>
                  ) : (
                    <>
                      Verify Code & Continue <ArrowRight className="w-4 h-4 text-white" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    resetForgotState();
                    setAuthModalTab('login');
                    setErrorMessage('');
                  }}
                  className="w-full text-center text-xs text-[#C7A5A8] hover:text-white pt-1"
                >
                  &larr; Back to Sign In
                </button>
              </form>
            )}

            {/* Step 3: Set New Password */}
            {forgotStep === 'newPassword' && (
              <form onSubmit={handleSaveNewPassword} className="space-y-4">
                <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-xl flex items-center gap-2.5 text-xs text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Verification complete for <strong className="font-mono text-white">{forgotMaskedEmail}</strong>. Set your new password below.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#C7A5A8] mb-1">
                    New Password (min 6 characters) *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C7A5A8]" />
                    <input
                      type={showForgotNewPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-10 py-2.5 bg-[#171014] border border-[#49202C] rounded-xl text-sm text-white focus:outline-none focus:border-[#851B2B]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                    >
                      {showForgotNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#C7A5A8] mb-1">
                    Confirm New Password *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C7A5A8]" />
                    <input
                      type={showForgotConfirmPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={forgotConfirmPassword}
                      onChange={(e) => setForgotConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-10 py-2.5 bg-[#171014] border border-[#49202C] rounded-xl text-sm text-white focus:outline-none focus:border-[#851B2B]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowForgotConfirmPassword(!showForgotConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                    >
                      {showForgotConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {forgotNewPassword && forgotConfirmPassword && forgotNewPassword !== forgotConfirmPassword && (
                  <p className="text-xs text-rose-400 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Passwords do not match.
                  </p>
                )}

                <button
                  type="submit"
                  disabled={
                    submittingForgot ||
                    !forgotNewPassword ||
                    forgotNewPassword.length < 6 ||
                    forgotNewPassword !== forgotConfirmPassword
                  }
                  className="w-full py-2.5 px-4 bg-[#851B2B] hover:bg-[#701529] active:bg-[#5E121E] text-white font-bold rounded-xl shadow-lg shadow-[#851B2B]/20 transition-all font-heading flex items-center justify-center gap-2 disabled:opacity-50 text-xs uppercase tracking-wider"
                >
                  {submittingForgot ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" /> Updating Password...
                    </>
                  ) : (
                    'Reset & Save Password'
                  )}
                </button>
              </form>
            )}

            {/* Step 4: Success Screen */}
            {forgotStep === 'success' && (
              <div className="space-y-4 text-center py-2">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold font-heading text-white">Password Updated Successfully</h3>
                  <p className="text-xs text-[#C7A5A8] mt-1.5 max-w-sm mx-auto leading-relaxed">
                    Your account password has been updated securely. You can now sign in to NOAH GAMING using your new credentials.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const emailOrPhone = forgotIdentifier;
                    resetForgotState();
                    setAuthModalTab('login');
                    setLoginIdentifier(emailOrPhone);
                    setLoginPassword('');
                  }}
                  className="w-full py-2.5 px-4 bg-[#851B2B] hover:bg-[#701529] active:bg-[#5E121E] text-white font-bold rounded-xl shadow-lg shadow-[#851B2B]/20 font-heading text-xs uppercase tracking-wider"
                >
                  Proceed to Sign In &rarr;
                </button>
              </div>
            )}
          </div>
        )}

        {/* ---------------- 6. RESET PASSWORD VIA EMAIL TOKEN VIEW ---------------- */}
        {authModalTab === 'resetToken' && (
          <form onSubmit={handleTokenResetSubmit} className="space-y-4">
            <div className="text-center pb-2">
              <div className="w-12 h-12 rounded-2xl bg-[#851B2B]/20 text-[#D7FF00] border border-[#851B2B]/40 flex items-center justify-center mx-auto mb-2">
                <KeyRound className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold font-heading text-[#FFF4E8]">
                Set Your New Password
              </h3>
              <p className="text-xs text-[#C7A5A8] mt-1">
                Your reset token has been verified. Enter a secure new password for your account.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#C7A5A8] mb-1">
                New Password (minimum 6 characters) *
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C7A5A8]" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={tokenNewPassword}
                  onChange={(e) => setTokenNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full pl-9 pr-4 py-2 bg-[#171014] border border-[#49202C] rounded-xl text-sm text-white focus:outline-none focus:border-[#851B2B]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submittingTokenReset || !tokenNewPassword || tokenNewPassword.length < 6}
              className="w-full py-2.5 px-4 bg-[#851B2B] hover:bg-[#6E1623] active:bg-[#5E121E] text-white font-bold rounded-xl shadow-lg shadow-[#851B2B]/25 transition-all font-heading flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submittingTokenReset ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Updating Password...
                </>
              ) : (
                'Save Password & Sign In'
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                window.location.hash = '';
                setAuthModalTab('login');
                setErrorMessage('');
              }}
              className="w-full text-center text-xs text-[#C7A5A8] hover:text-white pt-1"
            >
              &larr; Back to Sign In
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
