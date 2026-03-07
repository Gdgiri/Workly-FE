import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../redux/store';
import { handleOAuthCallback } from '../../redux/slices/authSlice';

const AuthCallback: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const dispatch = useDispatch<AppDispatch>();

    useEffect(() => {
        const processCallback = async () => {
            const token = searchParams.get('token');
            const error = searchParams.get('error');

            if (error) {
                // Handle error from Auth Service
                console.error('Auth error:', error);
                navigate('/login?error=auth_failed');
                return;
            }

            if (token) {
                try {
                    // Dispatch action to handle OAuth callback
                    await dispatch(handleOAuthCallback(token)).unwrap();

                    // Redirect to dashboard
                    const currentPath = window.location.pathname;
                    const pathParts = currentPath.split('/').filter(p => p);

                    if (pathParts.length >= 2) {
                        navigate(`/${pathParts[0]}/${pathParts[1]}/dashboard`);
                    } else {
                        navigate('/dashboard');
                    }
                } catch (err) {
                    console.error('Failed to process OAuth callback:', err);
                    navigate('/login?error=callback_failed');
                }
            } else {
                // No token or error - redirect to login
                navigate('/login?error=no_token');
            }
        };

        processCallback();
    }, [searchParams, navigate, dispatch]);

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            flexDirection: 'column',
            gap: '1rem'
        }}>
            <div className="spinner" style={{
                border: '4px solid #f3f3f3',
                borderTop: '4px solid #3498db',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                animation: 'spin 1s linear infinite'
            }}></div>
            <p style={{ color: '#666', fontSize: '1rem' }}>Authenticating...</p>
            <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
        </div>
    );
};

export default AuthCallback;
