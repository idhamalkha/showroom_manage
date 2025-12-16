import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import api from "../api/axios";
import { setAuth as setAuthStorage, getAuth } from "./auth-storage";

type AuthContextType = {
  accessToken: string | null;
  role?: string | null;
  user: any | null;  // Add user property
  loading: boolean;  // Add loading property
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (newData: Partial<any>) => void; // Add updateUser method
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(getAuth().accessToken);
  const [role, setRole] = useState<string | null>(getAuth().role ?? null);
  const [user, setUser] = useState<any>(getAuth().user ?? null);
  const [loading, setLoading] = useState<boolean>(true);
  const userLoadedRef = useRef(false);

  // Load user data if token exists but no user data (only once)
  useEffect(() => {
    const loadUser = async () => {
      // Hindari double load
      if (userLoadedRef.current) {
        setLoading(false);
        return;
      }

      if (token && !user) {
        try {
          userLoadedRef.current = true;
          // pastikan Authorization header tersedia
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          const response = await api.get('/auth/me');
          setUser(response.data);
          setAuthStorage({ accessToken: token, role, user: response.data });
        } catch (error) {
          console.error('Failed to load user:', error);
          // Token mungkin expired, clear everything
          setToken(null);
          setRole(null);
          setUser(null);
          setAuthStorage({ accessToken: null, role: null, user: null });
        }
      } else if (token) {
        // Token exists dan user sudah di-cache
        userLoadedRef.current = true;
      }

      setLoading(false);
    };

    loadUser();
  }, [token, user]);

  const login = async (username: string, password: string) => {
    setLoading(true);
    try {
        const body = new URLSearchParams();
        body.append("username", username);
        body.append("password", password);
        
        const res = await api.post("/auth/token", body, {
            headers: { 
                "Content-Type": "application/x-www-form-urlencoded"
            }
        });
        
        const { access_token, role: userRole } = res.data;
        
        if (!access_token) {
            throw new Error("No access token received");
        }
        
        // Store token first (persist)
        localStorage.setItem('authToken', access_token);
        localStorage.setItem('userRole', userRole ?? '');
        // ensure axios will include Authorization immediately
        api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
        
        // Get user data with new token
        const userResponse = await api.get('/auth/me');
        
        // Reset ref untuk allow reloading user jika perlu
        userLoadedRef.current = false;

        // Update state dan persistent storage
        setToken(access_token);
        setRole(userRole);
        setUser(userResponse.data);
        
        setAuthStorage({
            accessToken: access_token,
            role: userRole,
            user: userResponse.data
        });
        
    } catch (error: any) {
        console.error('Login error:', error);
        throw new Error(error?.response?.data?.detail || 'Login failed');
    } finally {
        setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {} finally {
      setToken(null);
      setRole(null);
      setUser(null);
      userLoadedRef.current = false;
      setAuthStorage({ accessToken: null, role: null, user: null });
      delete api.defaults.headers.common['Authorization'];
    }
  };

  // Add proper typing for updateUser
  const updateUser = useCallback((newData: Partial<typeof user>) => {
    setUser((current: typeof user) => {
      const updated = { ...current, ...newData };
      try {
        localStorage.setItem('user', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  // sync localStorage whenever token/role/user changes
  useEffect(() => {
    setAuthStorage({ accessToken: token, role, user });
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete api.defaults.headers.common['Authorization'];
    }
  }, [token, role, user]);

  // Expose updateUser through context
  const value = {
    accessToken: token,
    role,
    user,
    loading,
    login,
    logout,
    updateUser,
  };
  
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};