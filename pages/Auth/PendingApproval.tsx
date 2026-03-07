import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, CheckCircle, Mail, ArrowLeft } from 'lucide-react';

export const PendingApproval = () => {
    const navigate = useNavigate();

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem'
        }}>
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                    background: 'white',
                    borderRadius: '1.5rem',
                    padding: '3rem',
                    maxWidth: '600px',
                    width: '100%',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                    textAlign: 'center'
                }}
            >
                {/* Animated Icon */}
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                    style={{
                        width: '100px',
                        height: '100px',
                        margin: '0 auto 2rem',
                        background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <Clock size={48} color="white" />
                </motion.div>

                {/* Title */}
                <h1 style={{
                    fontSize: '2rem',
                    fontWeight: 'bold',
                    marginBottom: '1rem',
                    color: '#111827'
                }}>
                    Business Registration Submitted!
                </h1>

                {/* Subtitle */}
                <p style={{
                    fontSize: '1.125rem',
                    color: '#6b7280',
                    marginBottom: '2rem'
                }}>
                    Thank you for registering your salon business with our platform.
                </p>

                {/* Status Message */}
                <div style={{
                    background: '#fef3c7',
                    border: '2px solid #fbbf24',
                    borderRadius: '1rem',
                    padding: '1.5rem',
                    marginBottom: '2rem',
                    textAlign: 'left'
                }}>
                    <p style={{
                        fontSize: '1rem',
                        color: '#92400e',
                        marginBottom: '1rem',
                        fontWeight: 600
                    }}>
                        Your application is currently under review by our team.
                    </p>
                    <p style={{
                        fontSize: '0.875rem',
                        color: '#78350f',
                        lineHeight: '1.6'
                    }}>
                        You will receive an email notification once your business account has been approved.
                        This typically takes 24-48 hours.
                    </p>
                </div>

                {/* What's Next Section */}
                <div style={{
                    background: '#f9fafb',
                    borderRadius: '1rem',
                    padding: '1.5rem',
                    marginBottom: '2rem',
                    textAlign: 'left'
                }}>
                    <h3 style={{
                        fontSize: '1.125rem',
                        fontWeight: 600,
                        marginBottom: '1rem',
                        color: '#111827'
                    }}>
                        What happens next?
                    </h3>
                    <ul style={{
                        listStyle: 'none',
                        padding: 0,
                        margin: 0
                    }}>
                        {[
                            'Our team will review your business information',
                            'You\'ll receive approval within 24-48 hours',
                            'Once approved, you\'ll get access to your admin dashboard',
                            'You can start managing your salon operations immediately'
                        ].map((item, index) => (
                            <li key={index} style={{
                                display: 'flex',
                                alignItems: 'start',
                                gap: '0.75rem',
                                marginBottom: '0.75rem',
                                fontSize: '0.875rem',
                                color: '#374151'
                            }}>
                                <CheckCircle size={20} style={{ color: '#10b981', flexShrink: 0, marginTop: '0.125rem' }} />
                                <span>{item}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Email Notification Info */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    padding: '1rem',
                    background: '#eff6ff',
                    borderRadius: '0.75rem',
                    marginBottom: '2rem'
                }}>
                    <Mail size={20} style={{ color: '#3b82f6' }} />
                    <p style={{
                        fontSize: '0.875rem',
                        color: '#1e40af',
                        margin: 0
                    }}>
                        Check your email for updates on your application status
                    </p>
                </div>

                {/* Back to Login Button */}
                <button
                    onClick={() => navigate('/login')}
                    style={{
                        width: '100%',
                        padding: '1rem',
                        background: '#667eea',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.75rem',
                        fontSize: '1rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#5568d3'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#667eea'}
                >
                    <ArrowLeft size={20} />
                    Back to Login
                </button>

                {/* Support Info */}
                <p style={{
                    marginTop: '2rem',
                    fontSize: '0.75rem',
                    color: '#9ca3af'
                }}>
                    Need help? Contact us at{' '}
                    <a href="mailto:support@salonplatform.com" style={{ color: '#667eea', textDecoration: 'none' }}>
                        support@salonplatform.com
                    </a>
                </p>
            </motion.div>
        </div>
    );
};
