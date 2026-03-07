import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button, Input } from '../../components/UI';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../redux/store';
import { registerUser } from '../../redux/slices/authSlice';

import { useParams } from 'react-router-dom';

interface RegisterProps {
    onNavigate: (view: 'login' | 'register' | 'forgot-password' | 'reset-password') => void;
}

const Register: React.FC<RegisterProps> = ({ onNavigate }) => {
    const dispatch = useDispatch<AppDispatch>();
    // @ts-ignore - registrationSuccess might not be in the type definition yet if interface isn't updated in file view, but it is in slice
    const { loading, error, registrationSuccess } = useSelector((state: RootState) => state.auth);
    const { appId, businessName } = useParams<{ appId: string; businessName: string }>();

    useEffect(() => {
        if (registrationSuccess) {
            alert('Registration successful! Please sign in.');
            onNavigate('login');
        }
    }, [registrationSuccess, onNavigate]);

    useEffect(() => {
        if (error) {
            alert('Registration failed: ' + error);
        }
    }, [error]);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();

        const formData = new FormData(e.target as HTMLFormElement);
        const name = formData.get('name') as string;
        const email = formData.get('email') as string;
        const phone = formData.get('phone') as string;
        const password = formData.get('password') as string;
        const confirmPassword = formData.get('confirmPassword') as string;

        if (password !== confirmPassword) {
            alert("Passwords don't match");
            return;
        }

        if (!appId || !businessName) {
            alert('Invalid URL parameters');
            return;
        }

        dispatch(registerUser({ name, email, phone, password, appId, businessName }));
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
                <div className="text-center" style={{ marginBottom: '2rem' }}>
                    <motion.h1
                        initial={{ scale: 0.9 }}
                        animate={{ scale: 1 }}
                        style={{ fontSize: '2.25rem', fontWeight: 800, margin: '0 0 0.5rem 0', letterSpacing: '-0.025em' }}
                    >
                        Create Account<span style={{ color: 'var(--primary)' }}>.</span>
                    </motion.h1>
                    <p style={{ color: 'var(--text-gray)', fontSize: '0.875rem', fontWeight: 500 }}>Join Lumière Salon Systems</p>
                </div>

                <form onSubmit={handleRegister} className="space-y-6">
                    <Input label="Full Name" type="text" name="name" placeholder="John Doe" required style={{ background: '#f9fafb' }} />
                    <Input label="Email Address" type="email" name="email" placeholder="john@example.com" required style={{ background: '#f9fafb' }} />
                    <Input label="Phone Number" type="tel" name="phone" placeholder="555-123-4567" required style={{ background: '#f9fafb' }} />
                    <Input label="Password" type="password" name="password" placeholder="••••••••" required style={{ background: '#f9fafb' }} />
                    <Input label="Confirm Password" type="password" name="confirmPassword" placeholder="••••••••" required style={{ background: '#f9fafb' }} />

                    <Button type="submit" className="w-full" style={{ height: '3rem', fontSize: '1rem', fontWeight: 'bold', marginTop: '1rem' }} isLoading={loading}>
                        Sign Up
                    </Button>

                    <div style={{ display: 'flex', alignItems: 'center', margin: '1.5rem 0' }}>
                        <div style={{ flex: 1, borderTop: '1px solid var(--border)' }}></div>
                        <span style={{ margin: '0 1rem', color: 'var(--text-gray)', fontSize: '0.75rem' }}>OR</span>
                        <div style={{ flex: 1, borderTop: '1px solid var(--border)' }}></div>
                    </div>

                    <div className="text-center" style={{ fontSize: '0.875rem' }}>
                        <span style={{ color: 'var(--text-gray)' }}>Already have an account? </span>
                        <button
                            type="button"
                            onClick={() => onNavigate('login')}
                            style={{ color: 'var(--primary)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                            Sign In
                        </button>
                    </div>
                </form>
            </motion.div>

            <p style={{ marginTop: '2rem', fontSize: '0.75rem', color: '#9ca3af', zIndex: 10 }}>© 2026 Blackstone AI</p>
        </div>
    );
};

export default Register;
