import React from 'react';
import { Card } from '../UI';
import { Skeleton } from '../Skeleton';
import { DollarSign, Clock, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useCurrency } from '../CurrencyContext';
import { useAuth } from '../../hooks/useAuth';

interface PendingPayment {
    id: string;
    customerName: string;
    date: string;
    amountDue: number;
}

interface PendingPaymentsCardProps {
    pendingPayments: any[];
    loading?: boolean;
}

export const PendingPaymentsCard: React.FC<PendingPaymentsCardProps> = ({ pendingPayments, loading }) => {
    const navigate = useNavigate();
    const { formatPrice } = useCurrency();
    const { user } = useAuth();

    // Use pre-calculated data from backend
    const displayPayments = pendingPayments.slice(0, 5).map(p => ({
        id: p.id,
        customerName: p.customerName,
        date: new Date(p.createdAt).toLocaleDateString(),
        amountDue: p.balanceAmount // Backend returns 'balanceAmount'
    }));

    const handleViewAll = () => {
        const appId = user?.app_id || 'salon';
        const businessName = user?.businessName || 'admin';
        navigate(`/${appId}/${businessName}/payments`, { state: { filterStatus: 'PARTIAL' } });
    };

    return (
        <Card
            title="Pending Payments"
            className="h-full"
            action={
                <button
                    onClick={handleViewAll}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--primary)',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer'
                    }}
                >
                    View All <ArrowRight size={14} />
                </button>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {loading ? (
                    [1, 2, 3].map(i => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'var(--bg-hover)', borderRadius: 'var(--radius-lg)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <Skeleton width="100px" height="1rem" />
                                <Skeleton width="60px" height="0.75rem" />
                            </div>
                            <Skeleton width="50px" height="1.2rem" />
                        </div>
                    ))
                ) : displayPayments.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                        <div style={{
                            width: '3rem',
                            height: '3rem',
                            background: 'var(--bg-hover)',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 0.75rem auto'
                        }}>
                            <Clock className="text-slate-300" size={24} />
                        </div>
                        <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-gray)' }}>No pending payments</p>
                    </div>
                ) : (
                    displayPayments.map((payment, index) => (
                        <motion.div
                            key={payment.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '0.75rem',
                                borderRadius: 'var(--radius-lg)',
                                background: 'var(--bg-hover)',
                                border: '1px solid var(--border-light)'
                            }}
                        >
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.875rem' }}>{payment.customerName}</span>
                                <span style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{payment.date}</span>
                            </div>
                            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--danger)' }}>
                                    {formatPrice(payment.amountDue)}
                                </span>
                                <span style={{ fontSize: '0.56rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>Due</span>
                            </div>
                        </motion.div>
                    ))
                )}
            </div>
        </Card>
    );
};
