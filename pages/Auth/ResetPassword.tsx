import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button, Input } from '../../components/UI';
import { ArrowLeft } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../redux/store';
import { resetPassword } from '../../redux/slices/authSlice';
import { useParams, useSearchParams } from 'react-router-dom';
import { useToast } from '../../components/ToastContext';


interface ResetPasswordProps {
    onNavigate: (view: 'login' | 'register' | 'forgot-password' | 'reset-password') => void;
}

const ResetPassword: React.FC<ResetPasswordProps> = ({ onNavigate }) => {
    const dispatch = useDispatch<AppDispatch>();
    const { loading, error } = useSelector((state: RootState) => state.auth);
    const { appId, businessName } = useParams<{ appId: string; businessName: string }>();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const { showToast } = useToast();

    useEffect(() => {
        if (error) {
            showToast(error, 'error');

        }
    }, [error]);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();

        const formData = new FormData(e.target as HTMLFormElement);
        const password = formData.get('password') as string;
        const confirmPassword = formData.get('confirmPassword') as string;

        if (password.length < 6) {
            showToast('Password must be at least 6 characters long', 'error');
            return;
        }

        if (password !== confirmPassword) {
            showToast("Passwords don't match", 'error');
            return;
        }

        if (!appId || !businessName) {
            showToast('Invalid URL parameters', 'error');
            return;
        }

        if (!token) {
            showToast('Invalid or missing reset token. Please request a new password reset link.', 'error');
            return;
        }

        const resultAction = await dispatch(resetPassword({ password, token, appId, businessName }));

        if (resetPassword.fulfilled.match(resultAction)) {
            showToast('Password reset successful! Please login with your new password.', 'success');

            onNavigate('login');
        }
    };

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
                <button
                    type="button"
                    onClick={() => onNavigate('login')}
                    style={{ display: 'flex', alignItems: 'center', color: 'var(--text-black)', marginBottom: '1.5rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
                >
                    <ArrowLeft size={16} style={{ marginRight: '0.5rem' }} /> Back
                </button>

                <div className="text-center" style={{ marginBottom: '2rem' }}>
                    <motion.h1
                        initial={{ scale: 0.9 }}
                        animate={{ scale: 1 }}
                        style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 0.5rem 0', letterSpacing: '-0.025em' }}
                    >
                        Reset Password<span style={{ color: 'var(--primary)' }}>.</span>
                    </motion.h1>
                    <p style={{ color: 'var(--text-black)', fontSize: '0.875rem', fontWeight: 500 }}>
                        Enter your new password below.
                    </p>
                </div>

                <form onSubmit={handleReset} className="space-y-6">
                    <Input label="New Password" type="password" name="password" placeholder="••••••••" required style={{ background: '#f9fafb' }} />
                    <Input label="Confirm New Password" type="password" name="confirmPassword" placeholder="••••••••" required style={{ background: '#f9fafb' }} />

                    <Button type="submit" className="w-full" style={{ height: '3rem', fontSize: '1rem', fontWeight: 'bold', marginTop: '1rem' }} isLoading={loading}>
                        Update Password
                    </Button>
                </form>
            </motion.div>

            <p style={{ marginTop: '2rem', fontSize: '0.75rem', color: '#9ca3af', zIndex: 10 }}>© 2026 Blackstone AI</p>
        </div>
    );
};

export default ResetPassword;
