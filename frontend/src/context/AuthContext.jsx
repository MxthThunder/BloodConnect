import React, { createContext, useContext, useState, useEffect } from 'react';
import apiClient from '../api/client';

const AuthContext = createContext(null);

export const DEMO_CREDENTIALS = {
  admin_freddy: {
    username: 'freddy.admin',
    email: 'freddy.admin@bloodconnect.org',
    password: 'Admin@1234',
    name: 'Freddy Matthew R',
    role: 'admin',
    badge: 'Admin: Freddy'
  },
  admin_joshua: {
    username: 'joshua.admin',
    email: 'joshua.admin@bloodconnect.org',
    password: 'Admin@1234',
    name: 'Joshua Bennet C',
    role: 'admin',
    badge: 'Admin: Joshua'
  },
  admin_boopathi: {
    username: 'boopathi.admin',
    email: 'boopathi.admin@bloodconnect.org',
    password: 'Admin@1234',
    name: 'Boopathi P R',
    role: 'admin',
    badge: 'Admin: Boopathi'
  },
  admin_balakumaran: {
    username: 'balakumaran.admin',
    email: 'balakumaran.admin@bloodconnect.org',
    password: 'Admin@1234',
    name: 'Balakumaran E',
    role: 'admin',
    badge: 'Admin: Bala'
  },
  admin_abilash: {
    username: 'abilash.admin',
    email: 'abilash.admin@bloodconnect.org',
    password: 'Admin@1234',
    name: 'Abilash Alexander A',
    role: 'admin',
    badge: 'Admin: Abilash'
  },
  admin_harisankaran: {
    username: 'harisankaran.admin',
    email: 'harisankaran.admin@bloodconnect.org',
    password: 'Admin@1234',
    name: 'Harisankaran J',
    role: 'admin',
    badge: 'Admin: Hari'
  },
  requester: {
    email: 'requester@bloodconnect.org',
    password: 'Requester@1234',
    name: 'Ananya Sharma (T. Nagar)',
    role: 'requester',
    badge: 'Requester'
  },
  donor_o_neg: {
    email: 'donor.o_neg@bloodconnect.org',
    password: 'Donor@1234',
    name: 'Vikram Malhotra (O- Universal Donor, Adyar)',
    role: 'donor',
    badge: 'Donor O-'
  },
  donor_a_pos: {
    email: 'donor.a_pos@bloodconnect.org',
    password: 'Donor@1234',
    name: 'Rahul Deshmukh (A+ Donor, Nungambakkam)',
    role: 'donor',
    badge: 'Donor A+'
  }
};


export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('bc_token') || null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore user session on mount
  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem('bc_token');
      if (savedToken) {
        try {
          const res = await apiClient.get('/auth/me/');
          setUser(res.data);
        } catch (err) {
          console.error("Session restore failed", err);
          logout();
        }
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

  const login = async (email, password) => {
    setIsLoading(true);
    try {
      const res = await apiClient.post('/auth/login/', { email, password });
      const { token: authToken, user: userData } = res.data;
      localStorage.setItem('bc_token', authToken);
      localStorage.setItem('bc_user', JSON.stringify(userData));
      setToken(authToken);
      setUser(userData);
      return { success: true, user: userData };
    } catch (err) {
      const message = err.response?.data?.non_field_errors?.[0] || 
                      err.response?.data?.detail || 
                      err.response?.data?.message || 
                      'Invalid email or password.';
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (formData) => {
    setIsLoading(true);
    try {
      const res = await apiClient.post('/auth/register/', formData);
      const { token: authToken, user: userData } = res.data;
      localStorage.setItem('bc_token', authToken);
      localStorage.setItem('bc_user', JSON.stringify(userData));
      setToken(authToken);
      setUser(userData);
      return { success: true, user: userData };
    } catch (err) {
      let errorMsg = 'Registration failed. Please check the form fields.';
      if (err.response?.data) {
        const errors = err.response.data;
        const firstKey = Object.keys(errors)[0];
        if (firstKey) {
          const errVal = errors[firstKey];
          errorMsg = Array.isArray(errVal) ? `${firstKey}: ${errVal[0]}` : `${firstKey}: ${errVal}`;
        }
      }
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await apiClient.post('/auth/logout/');
      }
    } catch (err) {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem('bc_token');
      localStorage.removeItem('bc_user');
      setToken(null);
      setUser(null);
    }
  };

  const refreshUser = async () => {
    try {
      const res = await apiClient.get('/auth/me/');
      setUser(res.data);
      localStorage.setItem('bc_user', JSON.stringify(res.data));
    } catch (err) {
      console.error("Failed to refresh user", err);
    }
  };

  const quickLogin = async (key) => {
    const creds = DEMO_CREDENTIALS[key];
    if (creds) {
      return await login(creds.email, creds.password);
    }
    return { success: false, error: 'Unknown role' };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role: user?.role || null,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
        quickLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
