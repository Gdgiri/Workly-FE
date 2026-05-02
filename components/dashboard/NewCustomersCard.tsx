import React from 'react';
import { Card } from '../UI';
import { motion } from 'framer-motion';
import { UserPlus, MapPin, Clock } from 'lucide-react';

interface NewCustomer {
    id: string;
    name: string;
    email?: string;
    city?: string;
    joinedAt: string;
    createdBy?: string;
}

interface NewCustomersCardProps {
    customers: NewCustomer[];
    loading?: boolean;
}

const getAvatarColor = (name: string) => {
    const colors = [
        'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
        'linear-gradient(135deg, #3b82f6 0%, #2dd4bf 100%)',
        'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
        'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
        'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

export const NewCustomersCard: React.FC<NewCustomersCardProps> = ({ customers, loading }) => {
    return (
        <Card title={`New Customers Today ${customers.length > 0 ? `(${customers.length})` : ''}`} className="h-full">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {[1, 2, 3].map(i => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: 'var(--radius-xl)', background: 'var(--bg-hover)', animation: 'pulse 2s infinite' }}>
                                <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', background: 'var(--border-light)' }} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ height: '1rem', width: '8rem', background: 'var(--border-light)', borderRadius: '4px', marginBottom: '0.5rem' }} />
                                    <div style={{ height: '0.75rem', width: '5rem', background: 'var(--border-light)', borderRadius: '4px' }} />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : customers.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                        <div style={{
                            width: '4rem',
                            height: '4rem',
                            background: 'var(--bg-hover)',
                            borderRadius: 'var(--radius-2xl)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 1rem auto'
                        }}>
                            <UserPlus style={{ color: 'var(--text-light)' }} size={32} />
                        </div>
                        <p style={{ fontWeight: 600, color: 'var(--text-black)' }}>No new customers today</p>
                    </div>
                ) : (
                    <div className="custom-scrollbar" style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                        maxHeight: '405px',
                        overflowY: 'auto',
                        paddingRight: '12px'
                    }}>
                        {customers.map((customer, index) => (
                            <motion.div
                                key={customer.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.08 }}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '0.75rem',
                                    borderRadius: 'var(--radius-xl)',
                                    border: '1px solid var(--border-light)',
                                    background: 'var(--bg-card)',
                                    transition: 'all 0.2s ease',
                                    cursor: 'default'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div>
                                        <div style={{ fontWeight: 800, fontSize: '0.875rem', color: 'var(--text-dark)', textTransform: 'capitalize', lineHeight: 1.2 }}>
                                            {customer.name}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.125rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', color: 'var(--text-light)', fontWeight: 600 }}>
                                                <MapPin size={10} />
                                                <span>{customer.city || 'Chennai'}</span>
                                            </div>
                                            <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'var(--border)' }} />
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', color: 'var(--info)', fontWeight: 800, textTransform: 'uppercase' }}>
                                                <Clock size={10} />
                                                <span>{new Date(customer.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {customer.createdBy ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                                        <span style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--text-light)', textTransform: 'uppercase' }}>Created By</span>
                                        <span style={{
                                            padding: '2px 8px',
                                            borderRadius: 'var(--radius-full)',
                                            background: 'var(--bg-hover)',
                                            color: 'var(--primary)',
                                            fontSize: '0.65rem',
                                            fontWeight: 800,
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {customer.createdBy}
                                        </span>
                                    </div>
                                ) : (
                                    <span style={{
                                        padding: '2px 8px',
                                        borderRadius: 'var(--radius-full)',
                                        background: 'rgba(16, 185, 129, 0.1)',
                                        color: 'var(--success)',
                                        fontSize: '0.6rem',
                                        fontWeight: 900,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em'
                                    }}>
                                        NEW
                                    </span>
                                )}
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </Card>
    );
};
