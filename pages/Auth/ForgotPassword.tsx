import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button, Input } from '../../components/UI';
import { ArrowLeft } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../redux/store';
import { forgotPassword } from '../../redux/slices/authSlice';
import { useParams } from 'react-router-dom';

interface ForgotPasswordProps {
    onNavigate: (view: 'login' | 'register' | 'forgot-password' | 'reset-password') => void;
}

const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onNavigate }) => {
    const dispatch = useDispatch<AppDispatch>();
    const { loading, error } = useSelector((state: RootState) => state.auth);
    const { appId, businessName } = useParams<{ appId: string; businessName: string }>();
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        if (error) {
            // We might want to show error in UI instead of alerting, but basic alert for now
            alert('Error: ' + error);
        }
    }, [error]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const formData = new FormData(e.target as HTMLFormElement);
        const email = formData.get('email') as string;

        if (!appId || !businessName) {
            alert('Invalid URL parameters');
            return;
        }

        const resultAction = await dispatch(forgotPassword({ email, appId, businessName }));

        if (forgotPassword.fulfilled.match(resultAction)) {
            setSubmitted(true);
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
                    style={{ display: 'flex', alignItems: 'center', color: 'var(--text-gray)', marginBottom: '1.5rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
                >
                    <ArrowLeft size={16} style={{ marginRight: '0.5rem' }} /> Back to Login
                </button>

                <div className="text-center" style={{ marginBottom: '2rem' }}>
                    <motion.h1
                        initial={{ scale: 0.9 }}
                        animate={{ scale: 1 }}
                        style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 0.5rem 0', letterSpacing: '-0.025em' }}
                    >
                        Forgot Password<span style={{ color: 'var(--primary)' }}>?</span>
                    </motion.h1>
                    <p style={{ color: 'var(--text-gray)', fontSize: '0.875rem', fontWeight: 500 }}>
                        Enter your email and we'll send you instructions to reset your password.
                    </p>
                </div>

                {!submitted ? (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <Input label="Email Address" type="email" name="email" placeholder="john@example.com" required style={{ background: '#f9fafb' }} />

                        <Button type="submit" className="w-full" style={{ height: '3rem', fontSize: '1rem', fontWeight: 'bold', marginTop: '1rem' }} isLoading={loading}>
                            Send Reset Link
                        </Button>
                    </form>
                ) : (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        style={{ textAlign: 'center', padding: '1rem', background: 'var(--success-light)', borderRadius: '0.5rem', color: 'var(--success-dark)' }}
                    >
                        <p style={{ fontWeight: 600 }}>Check your email</p>
                        <p style={{ fontSize: '0.875rem' }}>We have sent a password reset link to your email address.</p>
                        <Button
                            variant='outline'
                            className="w-full"
                            style={{ marginTop: '1.5rem', borderColor: 'var(--success-dark)', color: 'var(--success-dark)' }}
                            onClick={() => setSubmitted(false)}
                        >
                            Resend Email
                        </Button>
                    </motion.div>
                )}
            </motion.div>

            <p style={{ marginTop: '2rem', fontSize: '0.75rem', color: '#9ca3af', zIndex: 10 }}>© 2026 Blackstone AI</p>
        </div>
    );
};

export default ForgotPassword;
