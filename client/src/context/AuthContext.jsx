import React, { createContext, useContext, useState, useEffect } from 'react';
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
  const [token, setToken] = useState(localStorage.getItem('noah_auth_token') || localStorage.getItem('nexus_auth_token') || null);
  const [loading, setLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState('login'); // 'login' or 'register'

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

  const login = async (identifier, password) => {
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
        setAuthModalOpen(false);
        return { success: true, user: response.data.user };
      }
      if (response.requires2FA) {
        return {
          success: false,
          requires2FA: true,
          message: response.message,
          data: response.data,
        };
      }
      return { success: false, message: response.message || 'Login failed' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const verifyLogin2FA = async (challengeId, otp) => {
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
        setAuthModalOpen(false);
        return { success: true, user: response.data.user };
      }
      return { success: false, message: response.message || 'Verification failed' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const resendLogin2FA = async (challengeId) => {
    try {
      return await authApi.resendLogin2FA(challengeId);
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const register = async (payload) => {
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
        setAuthModalOpen(false);
        return { success: true, user: response.data.user };
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
  };

  const setAuthData = ({ token: newToken, user: newUser }) => {
    if (newToken) {
      localStorage.setItem('noah_auth_token', newToken);
      localStorage.setItem('nexus_auth_token', newToken);
      setToken(newToken);
    }
    if (newUser) {
      localStorage.setItem('noah_user', JSON.stringify(newUser));
      setUser(newUser);
    }
    setAuthModalOpen(false);
  };

  const logout = () => {
    localStorage.removeItem('noah_auth_token');
    localStorage.removeItem('nexus_auth_token');
    localStorage.removeItem('noah_user');
    setToken(null);
    setUser(null);
    setAuthModalOpen(false);
  };

  const refreshUser = async () => {
    try {
      const response = await authApi.getMe();
      if (response.success && response.data?.user) {
        setUser(response.data.user);
        localStorage.setItem('noah_user', JSON.stringify(response.data.user));
      }
    } catch (err) {
      console.warn('Failed to refresh user:', err.message);
    }
  };

  const updateUser = (updatedFields) => {
    setUser((prev) => {
      if (!prev) return prev;
      const merged = { ...prev, ...updatedFields };
      localStorage.setItem('noah_user', JSON.stringify(merged));
      return merged;
    });
  };

  const openLoginModal = () => {
    setAuthModalTab('login');
    setAuthModalOpen(true);
  };

  const openRegisterModal = () => {
    setAuthModalTab('register');
    setAuthModalOpen(true);
  };

  const value = {
    user,
    token,
    loading,
    login,
    verifyLogin2FA,
    resendLogin2FA,
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
