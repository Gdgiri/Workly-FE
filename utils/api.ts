import axios from 'axios';

// Get environment variables with proper typing
const getEnvVar = (key: string, defaultValue: string): string => {
    return (import.meta as any).env[key] || defaultValue;
};

// Use environment variable or default to localhost
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
export const BASE_URL = `${API_URL}/api/v1`;

// Create axios instance with base configuration
const api = axios.create({
    baseURL: BASE_URL,
    timeout: 30000, // 30 second timeout to allow more time for requests
    headers: {
        'Content-Type': 'application/json',
        ...(BASE_URL.includes('ngrok') ? { 'ngrok-skip-browser-warning': 'true' } : {}),
    },
});

// Request interceptor - Add auth token to all requests
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('accessToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        // Add business name context if available in URL or fallback to localStorage
        const pathParts = window.location.pathname.split('/').filter(p => p);
        let businessName = null;

        if (pathParts.length >= 2) {
            // URL format: /appId/businessName/...
            businessName = pathParts[1];
        }

        // Fallback to localStorage if not in URL
        if (!businessName) {
            try {
                const userJson = localStorage.getItem('user');
                if (userJson) {
                    const userData = JSON.parse(userJson);
                    businessName = userData.businessName;
                }
            } catch (e) {
                console.warn('Failed to parse user from localStorage for business name header');
            }
        }

        if (businessName) {
            config.headers['x-business-name'] = businessName;
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor - Handle 401 errors (token expired/invalid)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Token expired or invalid - clear auth data
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');

            // Redirect to login page ONLY if not already on an auth page
            const currentPath = window.location.pathname;
            const isAuthPage = currentPath.includes('/login') ||
                currentPath.includes('/register') ||
                currentPath.includes('/forgotpassword') ||
                currentPath.includes('/resetpassword');

            if (!isAuthPage) {
                const pathParts = currentPath.split('/').filter(p => p);
                if (pathParts.length >= 2) {
                    window.location.href = `/${pathParts[0]}/${pathParts[1]}/login`;
                } else {
                    window.location.href = '/login';
                }
            }
        }
        return Promise.reject(error);
    }
);

export default api;
