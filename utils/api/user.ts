import api from '../api';

export interface User {
    id: string;
    authId: string;
    adminId?: string; // Business Owner's ID for multi-tenant filtering
    email: string;
    phone: string;
    name: string;
    role: 'ADMIN' | 'MANAGER' | 'STAFF' | 'CUSTOMER';
    app_id: string;
    permissions?: string[];
    businessName?: string;
    businessPhone?: string;
    businessAddress?: string;
}

/**
 * Get current authenticated user profile
 */
export const getCurrentUser = async (): Promise<User> => {
    const response = await api.get('/users/me');
    return response.data.user;
};

/**
 * Get all users (Admin only)
 */
export const getAllUsers = async (): Promise<User[]> => {
    const response = await api.get('/users');
    return response.data.users;
};

/**
 * Update user role (Admin only)
 */
export const updateUserRole = async (userId: string, role: string): Promise<User> => {
    const response = await api.patch(`/users/${userId}/role`, { role });
    return response.data.user;
};
