import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_URL + '/api/v1';

// Create axios instance with auth token
const api = axios.create({
    baseURL: API_URL,
});

// Add auth token to requests
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

/**
 * Get all pending business accounts
 */
export const getPendingBusinesses = async () => {
    const response = await api.get('/superadmin/businesses/pending');
    return response.data;
};

/**
 * Get all businesses with optional status filter
 */
export const getAllBusinesses = async (status?: string) => {
    const params = status ? { status } : {};
    const response = await api.get('/superadmin/businesses', { params });
    return response.data;
};

/**
 * Approve a business and assign subscription
 */
export const approveBusiness = async (userId: string, subscriptionPlanId?: string, trialPeriod?: number) => {
    const response = await api.post(`/superadmin/businesses/${userId}/approve`, {
        subscriptionPlanId,
        trialPeriod
    });
    return response.data;
};

/**
 * Reject a business application
 */
export const rejectBusiness = async (userId: string, reason: string) => {
    const response = await api.post(`/superadmin/businesses/${userId}/reject`, {
        reason
    });
    return response.data;
};

/**
 * Suspend a business
 */
export const suspendBusiness = async (userId: string, reason?: string) => {
    const response = await api.post(`/superadmin/businesses/${userId}/suspend`, {
        reason
    });
    return response.data;
};

/**
 * Get all subscription plans
 */
export const getSubscriptionPlans = async () => {
    // TODO: Create this endpoint in backend
    // For now, return mock data
    return {
        plans: [
            {
                id: '1',
                name: 'Trial',
                monthlyPrice: 0,
                isTrial: true,
                trialDays: 14
            },
            {
                id: '2',
                name: 'Starter',
                monthlyPrice: 999,
                isDefault: true
            },
            {
                id: '3',
                name: 'Professional',
                monthlyPrice: 1999
            },
            {
                id: '4',
                name: 'Enterprise',
                monthlyPrice: 4999
            }
        ]
    };
};
