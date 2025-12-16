import axios, { AxiosError } from 'axios';
import type { InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { setAuth } from '../providers/auth-storage';
import { API_BASE } from './host';

const api = axios.create({
    baseURL: API_BASE,
    withCredentials: true,
});

// Request interceptor to ensure token is properly set from localStorage
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('authToken');
    if (token && config.headers) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

// Response interceptor for better error handling
api.interceptors.response.use(
    (response: AxiosResponse) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        // Handle 401 Unauthorized (token expired or invalid)
        if (error?.response?.status === 401) {
            try {
                // Clear stored auth dan in-memory auth
                localStorage.removeItem('authToken');
                localStorage.removeItem('userRole');
                localStorage.removeItem('user');
                setAuth({ accessToken: null, role: null, user: null });
            } catch (e) {
                console.error('Error clearing auth:', e);
            }
            
            // Ensure axios won't keep Authorization header
            delete api.defaults.headers.common['Authorization'];
            
            // Redirect user to login (only if not already on login page)
            if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
                window.location.href = '/login?reason=session_expired';
            }
            
            return Promise.reject(error);
        }

        // Handle 403 Forbidden
        if (error?.response?.status === 403) {
            console.error('Access forbidden:', error);
            return Promise.reject(error);
        }

        return Promise.reject(error);
    }
);

export default api;