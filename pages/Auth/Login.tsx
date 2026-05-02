import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button, Input } from '../../components/UI';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../redux/store';
import { loginUser } from '../../redux/slices/authSlice';
import { useParams, useSearchParams } from 'react-router-dom';
import { useToast } from '../../components/ToastContext';
import { LoadingSpinner } from '../../components/LoadingSpinner';

interface LoginProps {
    onNavigate: (view: 'login' | 'register' | 'forgot-password' | 'reset-password') => void;
}

const Login: React.FC<LoginProps> = ({ onNavigate }) => {
    const dispatch = useDispatch<AppDispatch>();
    const { loading, error, isAuthenticated, user } = useSelector((state: RootState) => state.auth);
    const { appId, businessName } = useParams<{ appId: string; businessName: string }>();
    const [searchParams] = useSearchParams();
    const { showToast } = useToast();
    const [isAppValid, setIsAppValid] = React.useState<boolean>(true);
    const [validatingApp, setValidatingApp] = React.useState<boolean>(true);
    const [validationError, setValidationError] = React.useState<string | null>(null);

    // Format business name for display
    const businessNameFromUrl = businessName || 'lumiere';
    const displayBusinessName = businessNameFromUrl.charAt(0).toUpperCase() + businessNameFromUrl.slice(1);

    // Show error from URL params (e.g., from failed OAuth callback)
    useEffect(() => {
        const urlError = searchParams.get('error');
        if (urlError) {
            const errorMessages: Record<string, string> = {
                'auth_failed': 'Authentication failed. Please try again.',
                'callback_failed': 'Failed to complete login. Please try again.',
                'no_token': 'No authentication token received.',
            };
            showToast(errorMessages[urlError] || 'An error occurred during login.', 'error');
        }
    }, [searchParams, showToast]);

    // Validate VITE_APP_ID against backend
    useEffect(() => {
        const validateAppId = async () => {
            try {
                const AUTH_SERVICE_URL = (import.meta as any).env.VITE_AUTH_SERVICE_URL || 'https://authservice-salon-backend-1.onrender.com';
                // URL appId takes precedence, fallback to env, then default
                const targetAppId = appId || (import.meta as any).env.VITE_APP_ID || 'workly-salon';

                console.log('🔍 Validating App ID:', targetAppId);

                const response = await fetch(`${AUTH_SERVICE_URL}/apps`);

                if (!response.ok) {
                    throw new Error('Failed to fetch app configuration');
                }

                const apps = await response.json();
                console.log('📱 Available Apps:', apps);

                // Check if our app ID exists in the available apps
                const isValid = apps.some((app: any) => app.name === targetAppId);

                if (isValid) {
                    setIsAppValid(true);
                } else {
                    console.error(`❌ Invalid App ID: ${targetAppId}. Expected one of: ${apps.map((a: any) => a.name).join(', ')}`);
                    setIsAppValid(false);
                    setValidationError(`Invalid Application Configuration: ${targetAppId} is not a registered application.`);
                }

            } catch (error) {
                console.error('Failed to validate app:', error);
                // Fallback to allow login in case of network error, or block?
                // Plan said block, but network error might be temporary.
                // Let's safe fail to TRUE for network errors to avoid locking out admins during outage,
                // BUT strictly enforce if we got a valid response list.
                // Re-reading plan: "Block login or show error if the app ID is invalid"
                // Let's block for safety if we explicitly know it's invalid, but maybe show retry for network error?
                // For now, let's assume if fetch fails, we can't validate, so maybe warn but allow?
                // Actually, let's default to allow if strictly network fail to avoid total lockout?
                // NO, prompt said "validate", ensuring it exists.
                // Let's set error but maybe a retry button.
                setValidationError('Unable to validate application configuration. Please check your connection.');
                setIsAppValid(false);
            } finally {
                setValidatingApp(false);
            }
        };

        validateAppId();
    }, [appId]);

    useEffect(() => {
        if (error) {
            showToast('Login failed: ' + error, 'error');
        }
    }, [error, showToast]);

    // Show success toast when login is successful
    useEffect(() => {
        if (isAuthenticated && user) {
            showToast(`Login Successful! Welcome back, ${user.name}! 🎉`, 'success');
        }
    }, [isAuthenticated, user, showToast]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();

        const formData = new FormData(e.target as HTMLFormElement);
        const email = formData.get('email') as string;
        const password = formData.get('password') as string;

        // Determine target App ID (URL > Env > Default)
        const targetAppId = appId || (import.meta as any).env.VITE_APP_ID || 'workly-salon';
        const businessNameFromUrl = businessName || 'lumiere';

        if (!businessNameFromUrl) {
            alert('Invalid URL parameters');
            return;
        }

        dispatch(loginUser({ email, password, appId: targetAppId, businessName: businessNameFromUrl }));
    };

    // if (validatingApp) {
    //     return <LoadingSpinner fullScreen message="Validating Application Configuration..." />;
    // }

    if (!isAppValid) {
        return (
            <div className="login-bg" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem', position: 'relative', overflow: 'hidden' }}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-panel"
                    style={{ padding: '2.5rem', borderRadius: '1.5rem', width: '100%', maxWidth: '28rem', position: 'relative', zIndex: 10, textAlign: 'center' }}
                >
                    <div style={{ color: '#ef4444', marginBottom: '1rem' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                    </div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1rem', color: '#1e293b' }}>Configuration Error</h2>
                    <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
                        {validationError || 'This application is not correctly configured.'}
                    </p>
                    <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                        App ID: {appId || (import.meta as any).env.VITE_APP_ID || 'workly-salon'}
                    </p>
                    <Button onClick={() => window.location.reload()} style={{ marginTop: '2rem' }}>
                        Retry Connection
                    </Button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="login-bg" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem', position: 'relative', overflow: 'hidden' }}>

            {/* Decorative Background Blobs */}
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
                <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '24rem', height: '24rem', background: '#234C6A', borderRadius: '50%', filter: 'blur(60px)', opacity: 0.2 }}></div>
                <div style={{ position: 'absolute', top: '10%', right: '-10%', width: '24rem', height: '24rem', background: '#1B3C53', borderRadius: '50%', filter: 'blur(60px)', opacity: 0.15 }}></div>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="glass-panel"
                style={{ padding: '2.5rem', borderRadius: '1.5rem', width: '100%', maxWidth: '28rem', position: 'relative', zIndex: 10 }}
            >
                <div className="text-center" style={{ marginBottom: '2rem' }}>
                    <motion.h1
                        initial={{ scale: 0.9 }}
                        animate={{ scale: 1 }}
                        style={{ fontSize: '2.25rem', fontWeight: 800, margin: '0 0 0.5rem 0', letterSpacing: '-0.025em' }}
                    >
                        {displayBusinessName}<span style={{ color: 'var(--primary)' }}>.</span>
                    </motion.h1>
                    {/* <p style={{ color: 'var(--text-black)', fontSize: '0.875rem', fontWeight: 500 }}>Beauty & Salon Management</p> */}
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <Input label="Email Address" type="email" name="email" placeholder="admin@lumiere.com" style={{ background: '#f9fafb' }} required />
                    <Input label="Password" type="password" name="password" placeholder="••••••••" style={{ background: '#f9fafb' }} required />

                    <div className="flex justify-between items-center" style={{ fontSize: '0.875rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', color: 'var(--text-black)', cursor: 'pointer' }}>
                            <input type="checkbox" style={{ marginRight: '0.5rem' }} />
                            Remember me
                        </label>
                        <button
                            type="button"
                            onClick={() => onNavigate('forgot-password')}
                            style={{ color: 'var(--primary)', fontWeight: 500, textDecoration: 'none', background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                            Forgot password?
                        </button>
                    </div>

                    <Button type="submit" className="w-full" style={{ height: '3rem', fontSize: '1rem', fontWeight: 'bold' }} isLoading={loading}>
                        Sign In
                    </Button>

                    <div style={{ display: 'flex', alignItems: 'center', margin: '1.5rem 0' }}>
                        <div style={{ flex: 1, borderTop: '1px solid var(--border)' }}></div>
                        <span style={{ margin: '0 1rem', color: 'var(--text-black)', fontSize: '0.75rem' }}>OR</span>
                        <div style={{ flex: 1, borderTop: '1px solid var(--border)' }}></div>
                    </div>

                    <div className="text-center">
                        <button type="button" className="btn-ghost" style={{ fontSize: '0.875rem', fontWeight: 600, border: 'none', background: 'none', color: 'var(--text-dark)', cursor: 'pointer' }}>
                            Login with One-Time Password
                        </button>
                    </div>

                    {/* <div className="text-center" style={{ marginTop: '1rem', fontSize: '0.875rem' }}>
                        <span style={{ color: 'var(--text-black)' }}>Don't have an account? </span>
                        <button
                            type="button"
                            onClick={() => onNavigate('register')}
                            style={{ color: 'var(--primary)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                            Register
                        </button>
                    </div> */}
                </form>
            </motion.div>

            <p style={{ marginTop: '2rem', fontSize: '0.75rem', color: '#9ca3af', zIndex: 10 }}>© 2026 Blackstone AI</p>
        </div>
    );
};

export default Login;
