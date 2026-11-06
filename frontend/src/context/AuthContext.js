import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!localStorage.getItem('token'));

  // Restore the session on page load.
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    let cancelled = false;
    authService.getProfile()
      .then((res) => { if (!cancelled) setUser(res.data.user); })
      .catch(() => { localStorage.removeItem('token'); if (!cancelled) setUser(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (email, password, role) => {
    const res = await authService.login(email, password, role);
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const res = await authService.register(payload);
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const refresh = useCallback(async () => {
    const res = await authService.getProfile();
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
  }, []);

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isDoctor: user?.role === 'doctor',
    login,
    register,
    refresh,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/** Where each role lands after signing in. */
export const isVerifiedDoctor = (user) => user?.role === 'doctor' && user.verification_status === 'approved';

export const homeFor = (user) => {
  if (user?.role === 'admin') return '/admin';
  if (user?.role === 'doctor') return isVerifiedDoctor(user) ? '/doctor/appointments' : '/doctor/pending';
  return '/dashboard';
};
