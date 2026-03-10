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
}

/**
 * Hook to get current authenticated user and role helpers from Redux
 */
export const useAuth = (): UseAuthReturn => {
    const { user, loading, error, isAuthenticated } = useSelector((state: RootState) => state.auth);

    return {
        user: user as User | null,
        loading,
        error,
        isAuthenticated,
        isAdmin: user?.role?.toUpperCase() === 'ADMIN',
        isManager: user?.role?.toUpperCase() === 'MANAGER',
        isStaff: user?.role?.toUpperCase() === 'STAFF',
        isCustomer: user?.role?.toUpperCase() === 'CUSTOMER',
    };
};
