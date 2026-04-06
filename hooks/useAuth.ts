import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import { User } from '../utils/api/user';

interface UseAuthReturn {
    user: User | null;
    loading: boolean;
    error: string | null;
    isAdmin: boolean;
    isManager: boolean;
    isStaff: boolean;
    isCustomer: boolean;
    isAuthenticated: boolean;
    hasPermission: (module: string, action: 'view' | 'add' | 'edit') => boolean;
}

/**
 * Hook to get current authenticated user and role helpers from Redux
 */
export const useAuth = (): UseAuthReturn => {
    const { user, loading, error, isAuthenticated } = useSelector((state: RootState) => state.auth);

    const isAdmin = user?.role?.toUpperCase() === 'ADMIN';
    const isManager = user?.role?.toUpperCase() === 'MANAGER';
    const isStaff = user?.role?.toUpperCase() === 'STAFF';
    
    const hasPermission = (module: string, action: 'view' | 'add' | 'edit'): boolean => {
        if (isAdmin || isManager) return true;
        if (!user) return false;
        const permissions: string[] = (user as any).permissions || [];
        return permissions.includes(`${module}.${action}`);
    };

    return {
        user: user as User | null,
        loading,
        error,
        isAuthenticated,
        isAdmin,
        isManager,
        isStaff,
        isCustomer: user?.role?.toUpperCase() === 'CUSTOMER',
        hasPermission
    };
};
