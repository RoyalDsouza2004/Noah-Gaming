import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/auth.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('noah_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [token, setToken] = useState(
    localStorage.getItem('noah_auth_token') || localStorage.getItem('nexus_auth_token') || null
  );
  const [loading, setLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState('login'); // 'login' | 'register' | 'login2FA' | 'registerOTP' | 'convertGuest' | 'forgotPassword' | 'resetToken'

  // Centralized OTP Challenge & Admin Assistance State
  const [otpChallengeData, setOtpChallengeData] = useState(null);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [challengeRemainingSeconds, setChallengeRemainingSeconds] = useState(300);
  const [assistanceRequested, setAssistanceRequested] = useState(false);
  const [assistanceStatus, setAssistanceStatus] = useState('PENDING'); // PENDING, AWAITING_ADMIN_ASSISTANCE, APPROVED, REJECTED, EXPIRED
  const [rejectionReason, setRejectionReason] = useState('');

  // Validate existing token on mount
  useEffect(() => {
    const verifyExistingToken = async () => {
      const storedToken = localStorage.getItem('noah_auth_token') || localStorage.getItem('nexus_auth_token');
      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        const response = await authApi.getMe();
        if (response.success && response.data?.user) {
          setUser(response.data.user);
          localStorage.setItem('noah_user', JSON.stringify(response.data.user));
          setToken(storedToken);
        } else {
          logout();
        }
      } catch (err) {
        console.warn('Session expired or invalid token:', err.message);
        logout();
      } finally {
        setLoading(false);
      }
    };

    verifyExistingToken();
  }, []);

  const openOtpVerificationModal = useCallback((challenge) => {
    if (!challenge) return;
    const isReg = challenge.purpose === 'REGISTRATION';
    setOtpChallengeData({
      challengeId: challenge.challengeId,
      maskedEmail: challenge.maskedEmail,
      maskedPhone: challenge.maskedPhone,
      emailDeliveryStatus: challenge.emailDeliveryStatus || 'PENDING',
      purpose: isReg ? 'REGISTRATION' : 'LOGIN_2FA',
    });
    setOtpCooldown(challenge.resendCooldownSeconds || 60);
    setChallengeRemainingSeconds(challenge.expiresInSeconds || 300);
    setAssistanceRequested(challenge.assistanceRequested || false);
    setAssistanceStatus(challenge.status || 'PENDING');
    setRejectionReason(challenge.rejectionReason || '');
    setAuthModalTab(isReg ? 'registerOTP' : 'login2FA');
    setAuthModalOpen(true);
  }, []);

  const login = useCallback(async (identifier, password) => {
    try {
      const response = await authApi.login(identifier, password);
      if (response.success && response.data?.token) {
        localStorage.setItem('noah_auth_token', response.data.token);
        localStorage.setItem('nexus_auth_token', response.data.token);
        if (response.data.user) {
          localStorage.setItem('noah_user', JSON.stringify(response.data.user));
        }
        setToken(response.data.token);
        setUser(response.data.user);
        setOtpChallengeData(null);
        setAuthModalOpen(false);
        return { success: true, user: response.data.user };
      }

      // Handle 2FA or pending registration OTP verification
      if (response.requires2FA || response.requiresOtpVerification) {
        const isReg = response.purpose === 'REGISTRATION' || response.requiresOtpVerification;
        const challengeData = {
          challengeId: response.data?.challengeId,
          maskedEmail: response.data?.maskedEmail,
          maskedPhone: response.data?.maskedPhone,
          emailDeliveryStatus: response.data?.emailDeliveryStatus || 'PENDING',
          emailDeliveryError: response.data?.emailDeliveryError || null,
          purpose: isReg ? 'REGISTRATION' : 'LOGIN_2FA',
          resendCooldownSeconds: response.data?.resendCooldownSeconds || 60,
          expiresInSeconds: response.data?.expiresInSeconds || 300,
        };

        setOtpChallengeData(challengeData);
        setOtpCooldown(challengeData.resendCooldownSeconds);
        setChallengeRemainingSeconds(challengeData.expiresInSeconds);
        setAssistanceRequested(false);
        setAssistanceStatus('PENDING');
        setRejectionReason('');
        setAuthModalTab(isReg ? 'registerOTP' : 'login2FA');
        setAuthModalOpen(true);

        return {
          success: false,
          requires2FA: !isReg,
          requiresOtpVerification: isReg,
          purpose: challengeData.purpose,
          message: response.message,
          data: response.data,
        };
      }

      return { success: false, message: response.message || 'Login failed' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }, []);

  const verifyLogin2FA = useCallback(async (challengeId, otp) => {
    try {
      const response = await authApi.verifyLogin2FA(challengeId, otp);
      if (response.success && response.data?.token) {
        localStorage.setItem('noah_auth_token', response.data.token);
        localStorage.setItem('nexus_auth_token', response.data.token);
        if (response.data.user) {
          localStorage.setItem('noah_user', JSON.stringify(response.data.user));
        }
        setToken(response.data.token);
        setUser(response.data.user);
        setOtpChallengeData(null);
        setAuthModalOpen(false);
        return { success: true, user: response.data.user, token: response.data.token };
      }
      return { success: false, message: response.message || 'Verification failed' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }, []);

  const resendLogin2FA = useCallback(async (challengeId) => {
    try {
      const res = await authApi.resendLogin2FA(challengeId);
      if (res.success && res.data) {
        setOtpChallengeData((prev) => ({
          ...prev,
          challengeId: res.data.challengeId || prev?.challengeId,
          maskedEmail: res.data.maskedEmail || prev?.maskedEmail,
          emailDeliveryStatus: res.data.emailDeliveryStatus || prev?.emailDeliveryStatus,
        }));
        setOtpCooldown(res.data.resendCooldownSeconds || 60);
        setChallengeRemainingSeconds(res.data.expiresInSeconds || 300);
      }
      return res;
    } catch (err) {
      return { success: false, message: err.message };
    }
  }, []);

  const verifyRegistrationOtp = useCallback(async (challengeId, otp) => {
    try {
      const response = await authApi.verifyRegistrationOtp(challengeId, otp);
      if (response.success && response.data?.token) {
        localStorage.setItem('noah_auth_token', response.data.token);
        localStorage.setItem('nexus_auth_token', response.data.token);
        if (response.data.user) {
          localStorage.setItem('noah_user', JSON.stringify(response.data.user));
        }
        setToken(response.data.token);
        setUser(response.data.user);
        setOtpChallengeData(null);
        setAuthModalOpen(false);
        return { success: true, user: response.data.user, token: response.data.token };
      }
      return { success: false, message: response.message || 'Verification failed' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }, []);

  const resendRegistrationOtp = useCallback(async (challengeId) => {
    try {
      const res = await authApi.resendRegistrationOtp(challengeId);
      if (res.success && res.data) {
        setOtpChallengeData((prev) => ({
          ...prev,
          challengeId: res.data.challengeId || prev?.challengeId,
          maskedEmail: res.data.maskedEmail || prev?.maskedEmail,
          emailDeliveryStatus: res.data.emailDeliveryStatus || prev?.emailDeliveryStatus,
        }));
        setOtpCooldown(res.data.resendCooldownSeconds || 60);
        setChallengeRemainingSeconds(res.data.expiresInSeconds || 300);
      }
      return res;
    } catch (err) {
      return { success: false, message: err.message };
    }
  }, []);

  const requestOtpAssistance = useCallback(async (challengeId) => {
    try {
      const res = await authApi.requestOtpAssistance(challengeId);
      if (res.success) {
        setAssistanceRequested(true);
        setAssistanceStatus('AWAITING_ADMIN_ASSISTANCE');
        if (res.data?.expiresInSeconds) {
          setChallengeRemainingSeconds(res.data.expiresInSeconds);
        }
      }
      return res;
    } catch (err) {
      return { success: false, message: err.message };
    }
  }, []);

  const getOtpAssistanceStatus = useCallback(async (challengeId) => {
    try {
      return await authApi.getOtpAssistanceStatus(challengeId);
    } catch (err) {
      return { success: false, message: err.message };
    }
  }, []);

  const completeOtpAssistance = useCallback(async (challengeId, approvalToken) => {
    try {
      const response = await authApi.completeOtpAssistance(challengeId, approvalToken);
      if (response.success && response.data?.token) {
        localStorage.setItem('noah_auth_token', response.data.token);
        localStorage.setItem('nexus_auth_token', response.data.token);
        if (response.data.user) {
          localStorage.setItem('noah_user', JSON.stringify(response.data.user));
        }
        setToken(response.data.token);
        setUser(response.data.user);
        setOtpChallengeData(null);
        setAssistanceStatus('APPROVED');
        setAuthModalOpen(false);
        return { success: true, user: response.data.user, token: response.data.token };
      }
      return { success: false, message: response.message || 'Assistance completion failed' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }, []);

  const register = useCallback(async (payload) => {
    try {
      const response = await authApi.register(payload);
      if (response.success && response.data?.token) {
        localStorage.setItem('noah_auth_token', response.data.token);
        localStorage.setItem('nexus_auth_token', response.data.token);
        if (response.data.user) {
          localStorage.setItem('noah_user', JSON.stringify(response.data.user));
        }
        setToken(response.data.token);
        setUser(response.data.user);
        setOtpChallengeData(null);
        setAuthModalOpen(false);
        return { success: true, user: response.data.user };
      }

      if (response.requiresOtpVerification) {
        const challengeData = {
          challengeId: response.data?.challengeId,
          maskedEmail: response.data?.maskedEmail,
          maskedPhone: response.data?.maskedPhone,
          emailDeliveryStatus: response.data?.emailDeliveryStatus || 'PENDING',
          emailDeliveryError: response.data?.emailDeliveryError || null,
          purpose: 'REGISTRATION',
          resendCooldownSeconds: response.data?.resendCooldownSeconds || 60,
          expiresInSeconds: response.data?.expiresInSeconds || 300,
        };

        setOtpChallengeData(challengeData);
        setOtpCooldown(challengeData.resendCooldownSeconds);
        setChallengeRemainingSeconds(challengeData.expiresInSeconds);
        setAssistanceRequested(false);
        setAssistanceStatus('PENDING');
        setRejectionReason('');
        setAuthModalTab('registerOTP');
        setAuthModalOpen(true);

        return {
          success: false,
          requiresOtpVerification: true,
          purpose: 'REGISTRATION',
          message: response.message,
          data: response.data,
        };
      }

      if (response.requiresConversion) {
        return {
          success: false,
          requiresConversion: true,
          message: response.message,
          data: response.data,
        };
      }

      return { success: false, message: response.message || 'Registration failed' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }, []);

  const setAuthData = useCallback(({ token: newToken, user: newUser }) => {
    if (newToken) {
      localStorage.setItem('noah_auth_token', newToken);
      localStorage.setItem('nexus_auth_token', newToken);
      setToken(newToken);
    }
    if (newUser) {
      localStorage.setItem('noah_user', JSON.stringify(newUser));
      setUser(newUser);
    }
    setOtpChallengeData(null);
    setAuthModalOpen(false);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('noah_auth_token');
    localStorage.removeItem('nexus_auth_token');
    localStorage.removeItem('noah_user');
    setToken(null);
    setUser(null);
    setOtpChallengeData(null);
    setAuthModalOpen(false);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const response = await authApi.getMe();
      if (response.success && response.data?.user) {
        setUser(response.data.user);
        localStorage.setItem('noah_user', JSON.stringify(response.data.user));
      }
    } catch (err) {
      console.warn('Failed to refresh user:', err.message);
    }
  }, []);

  const updateUser = useCallback((updatedFields) => {
    setUser((prev) => {
      if (!prev) return prev;
      const merged = { ...prev, ...updatedFields };
      localStorage.setItem('noah_user', JSON.stringify(merged));
      return merged;
    });
  }, []);

  const openLoginModal = useCallback(() => {
    setAuthModalTab('login');
    setAuthModalOpen(true);
  }, []);

  const openRegisterModal = useCallback(() => {
    setAuthModalTab('register');
    setAuthModalOpen(true);
  }, []);

  const value = {
    user,
    token,
    loading,
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
    updateUser,
    logout,
    refreshUser,
    authModalOpen,
    setAuthModalOpen,
    authModalTab,
    setAuthModalTab,
    openLoginModal,
    openRegisterModal,
    openOtpVerificationModal,
    // Centralized challenge state
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
    // Role helpers
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isReceptionist: user?.role === 'receptionist',
    isStaff: user?.role === 'admin' || user?.role === 'receptionist',
    isCustomer: user?.role === 'customer',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
