import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles?: ('ADMIN' | 'MANAGER' | 'STAFF' | 'CUSTOMER' | 'SUPER_ADMIN')[];
}

/**
 * Protected route component for role-based access control
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh'
            }}>
                <div>Loading...</div>
            </div>
        );
    }

    if (!user) {
        // Not authenticated - redirect to login
        return <Navigate to="/login" replace />;
    }

    // Normalize user role and allowed roles for comparison
    const userRole = user.role?.toUpperCase();
    const normalizedAllowedRoles = allowedRoles?.map(r => r.toUpperCase());

    if (normalizedAllowedRoles && !normalizedAllowedRoles.includes(userRole)) {
        // User doesn't have required role - redirect to a safe landing page (Sales)
        // Extract appId and businessName from current URL if possible
        const pathParts = location.pathname.split('/').filter(p => p);
        if (pathParts.length >= 2) {
            const appId = pathParts[0];
            const businessName = pathParts[1];
            return <Navigate to={`/${appId}/${businessName}/sales`} replace />;
        }
        
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
};

export default ProtectedRoute;
