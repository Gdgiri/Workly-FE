import React from 'react';
import { motion } from 'framer-motion';
import { Shield, ArrowLeft, ShieldCheck, Database, Globe } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

const PrivacyPolicy: React.FC = () => {
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
            background: 'linear-gradient(135deg, #F8FAFC 0%, #F5F3FF 100%)',
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#7C3AED' }}>
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
                    <Shield size={48} style={{ color: '#7C3AED', marginBottom: '1rem' }} />
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.5rem' }}>Privacy Policy</h1>
                </div>

                <section style={{ marginBottom: '2.5rem' }}>
                    <div style={{
                        background: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)',
                        padding: '2rem',
                        borderRadius: '1.5rem',
                        border: '1px solid #DDD6FE',
                        marginBottom: '2rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: '#5B21B6' }}>
                            <Database size={24} />
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Data Protection Guarantee</h2>
                        </div>
                        <p style={{ color: '#5B21B6', lineHeight: 1.6, fontSize: '1rem' }}>
                            Your privacy is our priority. We are committed to protecting the integrity and confidentiality of your data using modern security technologies and rigorous data handling policies.
                        </p>
                    </div>

                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1E293B', marginBottom: '1rem' }}>1. Information We Collect</h2>
                    <p style={{ lineHeight: 1.6, color: '#475569', marginBottom: '1rem' }}>
                        When you register with our partner salon, we collect information such as your Name, Email Address, Phone Number, Date of Birth, and City. We may also store your visit history and service preferences.
                    </p>

                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1E293B', marginBottom: '1rem' }}>2. How We Use Your Data</h2>
                    <ul style={{ lineHeight: 1.8, color: '#475569', marginBottom: '1rem', paddingLeft: '1.5rem' }}>
                        <li>To schedule and manage your salon appointments.</li>
                        <li>To send important service notifications via Email or SMS.</li>
                        <li>To provide personalized service recommendations based on your history.</li>
                        <li>To process payments and generate receipts.</li>
                    </ul>

                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1E293B', marginBottom: '1rem' }}>3. Data Security</h2>
                    <p style={{ lineHeight: 1.6, color: '#475569', marginBottom: '1rem' }}>
                        All data is stored in secure, encrypted databases. We implement strict access controls ensuring that only your salon's verified staff can view your profile for service purposes.
                    </p>

                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1E293B', marginBottom: '1rem' }}>4. Your Rights</h2>
                    <p style={{ lineHeight: 1.6, color: '#475569', marginBottom: '1rem' }}>
                        You have the right to access your data, request corrections, or ask for the deletion of your customer profile from the salon's database. Please contact your salon administration for such requests.
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
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Globe size={14} /> Safe Data Practices</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><ShieldCheck size={14} /> Privacy First Design</span>
                    </div>
                    © {new Date().getFullYear()} Workly. All rights reserved.
                </footer>
            </motion.main>
        </div>
    );
};

export default PrivacyPolicy;
