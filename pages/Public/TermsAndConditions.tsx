import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, ArrowLeft, Lock, FileText, Globe } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

const TermsAndConditions: React.FC = () => {
    const navigate = useNavigate();
    const { appId, businessName } = useParams<{ appId: string; businessName: string }>();

    const handleBack = () => {
        if (window.history.length > 1) {
            navigate(-1);
        } else if (appId && businessName) {
            navigate(`/${appId}/${businessName}/dashboard`);
        } else {
            navigate('/login');
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%)',
            color: '#1E293B',
            fontFamily: "'Inter', sans-serif",
            padding: '2rem 1rem'
        }}>
            <nav style={{
                maxWidth: '800px',
                margin: '0 auto 2rem auto',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <motion.button
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={handleBack}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        background: 'white',
                        border: '1px solid #E2E8F0',
                        padding: '0.5rem 1rem',
                        borderRadius: '0.75rem',
                        color: '#64748B',
                        cursor: 'pointer',
                        fontWeight: 500,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                    }}
                >
                    <ArrowLeft size={18} /> Back
                </motion.button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#3B82F6' }}>
                    <ShieldCheck size={24} />
                    <span style={{ fontWeight: 700, fontSize: '1.25rem' }}>Workly Secure</span>
                </div>
            </nav>

            <motion.main
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                    maxWidth: '800px',
                    margin: '0 auto',
                    background: 'rgba(255, 255, 255, 0.8)',
                    backdropFilter: 'blur(10px)',
                    padding: '3rem',
                    borderRadius: '2rem',
                    border: '1px solid white',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02)'
                }}
            >
                <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
                    <FileText size={48} style={{ color: '#3B82F6', marginBottom: '1rem' }} />
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.5rem' }}>Terms & Conditions</h1>
                </div>

                <section style={{ marginBottom: '2.5rem' }}>
                    <div style={{
                        background: 'linear-gradient(135deg, #DBEAFE 0%, #EFF6FF 100%)',
                        padding: '2rem',
                        borderRadius: '1.5rem',
                        border: '1px solid #BFDBFE',
                        marginBottom: '2rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: '#1E40AF' }}>
                            <Lock size={24} />
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Data Safety & Trust Commitment</h2>
                        </div>
                        <p style={{ color: '#1E40AF', lineHeight: 1.6, fontSize: '1.05rem', fontWeight: 500 }}>
                            We understand that the details you provide are personal and sensitive.
                            <strong> We strictly guarantee that all information collected through our forms is handled with the highest level of security.</strong>
                            We do not leak, sell, or share your data with unauthorized third parties. Your details are used exclusively for managing your relationship with the salon and improving your service experience.
                        </p>
                    </div>

                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1E293B', marginBottom: '1rem' }}>1. Acceptance of Terms</h2>
                    <p style={{ lineHeight: 1.6, color: '#475569', marginBottom: '1rem' }}>
                        By accessing or using this service, you agree to be bound by these Terms and Conditions. These terms govern the relationship between you (the customer) and the salon administration.
                    </p>

                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1E293B', marginBottom: '1rem' }}>2. Information Collection</h2>
                    <p style={{ lineHeight: 1.6, color: '#475569', marginBottom: '1rem' }}>
                        Providing your details (Name, Phone, Email, etc.) is voluntary but necessary for us to provide personalized salon services, manage appointments, and maintain records.
                    </p>

                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1E293B', marginBottom: '1rem' }}>3. Service Usage</h2>
                    <p style={{ lineHeight: 1.6, color: '#475569', marginBottom: '1rem' }}>
                        The information provided must be accurate. Any abuse of the booking system or providing fraudulent information may result in the termination of access to our services.
                    </p>

                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1E293B', marginBottom: '1rem' }}>4. Security Measures</h2>
                    <p style={{ lineHeight: 1.6, color: '#475569', marginBottom: '1rem' }}>
                        We employ industry-standard encryption and security protocols to protect your data stored in our system. Only authorized personnel have access to this information.
                    </p>
                </section>

                <footer style={{
                    borderTop: '1px solid #E2E8F0',
                    paddingTop: '2rem',
                    textAlign: 'center',
                    color: '#94A3B8',
                    fontSize: '0.875rem'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginBottom: '1rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Globe size={14} /> Global Standard Privacy</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><ShieldCheck size={14} /> End-to-End Encryption</span>
                    </div>
                    © {new Date().getFullYear()} Workly. All rights reserved.
                </footer>
            </motion.main>
        </div>
    );
};

export default TermsAndConditions;
