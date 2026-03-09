import React, { useState } from 'react';

import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../redux/store';
import { fetchMessages, resendMessage } from '../redux/slices/messageSlice';
// import api from '../utils/api'; // Remove api import if not used anymore (resend uses dispatch)
import { useCurrency } from '../components/CurrencyContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    RefreshCw, Send, CheckCircle, Clock, AlertCircle,
    ExternalLink, Phone, ArrowRight, CreditCard, MessageSquare
} from 'lucide-react';
import { Button, Card, KPICard, Modal, Skeleton } from '../components/UI';

const MessageLog: React.FC = () => {
    const { formatPrice } = useCurrency();
    const [activeFilter, setActiveFilter] = useState<'sent' | 'pending' | 'failed'>('sent');
    const dispatch = useDispatch<AppDispatch>();
    const { messages, loading, error } = useSelector((state: RootState) => state.messages);

    // const [messages, setMessages] = useState<any[]>([]); // Removed
    // const [loading, setLoading] = useState(false); // Removed
    const [stats, setStats] = useState({
        total: 0,
        sent: 0,
        pending: 0,
        failed: 0
    });
    const [confirmModal, setConfirmModal] = useState<{ id: string | number, message?: any } | null>(null);

    // Calculate stats whenever messages change
    React.useEffect(() => {
        setStats({
            total: messages.length,
            sent: messages.filter((m: any) => m.status === 'SENT').length,
            pending: messages.filter((m: any) => m.status === 'PENDING').length,
            failed: messages.filter((m: any) => m.status === 'FAILED').length
        });
    }, [messages]);

    React.useEffect(() => {
        dispatch(fetchMessages());
    }, [dispatch]);

    const handleRefresh = () => {
        dispatch(fetchMessages());
    };

    // Initial fetch handled above

    const handleResend = async (id: string | number, e: React.MouseEvent) => {
        e.stopPropagation();
        const msg = messages.find(m => m.id === id);
        setConfirmModal({ id, message: msg });
    };

    const executeResend = async () => {
        if (!confirmModal) return;

        try {
            await dispatch(resendMessage(confirmModal.id)).unwrap();

            // Refresh messages to show updated status (or handle optimistic update in slice)
            dispatch(fetchMessages());

            setConfirmModal(null);
            // Show toast? (useToast hook needed if implemented)
        } catch (error: any) {
            console.error('Failed to resend message:', error);
            alert(error.message || 'Failed to resend message');
        }
    };

    const filteredMessages = messages.filter(msg => {
        if (activeFilter === 'sent') return msg.status === 'SENT';
        if (activeFilter === 'pending') return msg.status === 'PENDING';
        if (activeFilter === 'failed') return msg.status === 'FAILED';
        return true;
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Header */}
            {/* <div>
                <h1 style={{ fontSize: '1.875rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '0.5rem' }}>
                    Communication Central
                </h1>
                <p style={{ color: 'var(--text-gray)', fontSize: '1rem' }}>
                    Track all automated messages sent to your customers.
                </p>
            </div> */}

            {/* Loading / Content State */}

            {/* Stats Cards */}
            <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                <KPICard title="Total Messages" value={stats.total.toLocaleString()} icon={Send} color="#6366F1" loading={loading} />
                <KPICard title="Sent Successful" value={stats.sent.toLocaleString()} icon={CheckCircle} color="#10B981" loading={loading} />
                <KPICard title="Pending Resend" value={stats.pending.toLocaleString()} icon={Clock} color="#F59E0B" loading={loading} />
                <KPICard title="Failed Delivery" value={stats.failed.toLocaleString()} icon={AlertCircle} color="#EF4444" loading={loading} />
            </div>

            {/* Action Toolbar */}
            <Card className="p-0 overflow-visible" style={{ padding: '0.75rem 1.5rem', borderRadius: '1.25rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>

                    {/* Filters - Segmented Control Style */}
                    <div style={{
                        display: 'flex',
                        background: 'var(--bg-body)',
                        padding: '0.25rem',
                        borderRadius: '0.75rem',
                        border: '1px solid var(--border-light)'
                    }}>
                        {[
                            { id: 'sent', label: 'Sent', count: stats.sent },
                            { id: 'pending', label: 'Pending', count: stats.pending },
                            { id: 'failed', label: 'Failed', count: stats.failed }
                        ].map(filter => (
                            <button
                                key={filter.id}
                                onClick={() => setActiveFilter(filter.id as any)}
                                style={{
                                    padding: '0.5rem 1rem',
                                    borderRadius: '0.5rem',
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    transition: 'all 0.2s',
                                    background: activeFilter === filter.id ? 'var(--primary)' : 'transparent',
                                    color: activeFilter === filter.id ? 'white' : 'var(--text-gray)',
                                    border: 'none',
                                    boxShadow: activeFilter === filter.id ? '0 4px 12px rgba(79, 70, 229, 0.3)' : 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                {filter.label}
                                <span style={{
                                    fontSize: '0.75rem',
                                    background: activeFilter === filter.id ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)',
                                    padding: '0.1rem 0.4rem',
                                    borderRadius: '99px',
                                    color: activeFilter === filter.id ? 'white' : 'var(--text-gray)'
                                }}>{filter.count}</span>
                            </button>
                        ))}
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <Button
                            style={{
                                background: 'white',
                                color: 'var(--text-dark)',
                                border: '1px solid var(--border)',
                                borderRadius: '0.75rem',
                                padding: '0.625rem 1.25rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontWeight: 600
                            }}
                            onClick={handleRefresh}
                            isLoading={loading}
                        >
                            {/* <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> */}
                            Refresh
                        </Button>
                        <Button
                            style={{
                                background: 'var(--primary)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '0.75rem',
                                padding: '0.625rem 1.25rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)'
                            }}
                            onClick={() => { }}
                        >
                            <Send size={16} />
                            Resend Pending
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Message Cards List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <div key={`msg-skeleton-${i}`} style={{
                            display: 'flex',
                            background: 'white',
                            borderRadius: '1rem',
                            overflow: 'hidden',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                            border: '1px solid var(--border-light)',
                            opacity: 0.7
                        }}>
                            {/* Status Strip Placeholder */}
                            <div style={{
                                width: '6px',
                                background: 'var(--border-light)'
                            }} />

                            <div style={{ flex: 1, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {/* Card Header Skeleton */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                        <Skeleton width="40px" height="40px" borderRadius="50%" />
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                            <Skeleton width="160px" height="1.1rem" />
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <Skeleton width="100px" height="0.75rem" />
                                                <Skeleton width="80px" height="0.75rem" />
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <Skeleton width="80px" height="2rem" borderRadius="9999px" />
                                        <Skeleton width="90px" height="2rem" borderRadius="9999px" />
                                    </div>
                                </div>

                                {/* Chat Bubble Content Skeleton */}
                                <div style={{
                                    background: 'var(--bg-body)',
                                    padding: '1.5rem',
                                    borderRadius: '0.75rem',
                                    borderTopLeftRadius: '0',
                                    marginLeft: '3.5rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.5rem'
                                }}>
                                    <Skeleton width="80%" height="1rem" />
                                    <Skeleton width="30%" height="0.8rem" />
                                </div>

                                {/* Footer Actions Skeleton */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginLeft: '3.5rem' }}>
                                    <div style={{ display: 'flex', gap: '1.5rem' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                            <Skeleton width="40px" height="0.7rem" />
                                            <Skeleton width="100px" height="1rem" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <>
                        <AnimatePresence mode="popLayout">
                            {filteredMessages.map((msg) => (
                                <motion.div
                                    layout
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.98 }}
                                    key={msg.id}
                                >
                                    <div style={{
                                        display: 'flex',
                                        background: 'white',
                                        borderRadius: '1rem',
                                        overflow: 'hidden',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                                        border: '1px solid var(--border-light)'
                                    }}>
                                        {/* Status Strip */}
                                        <div style={{
                                            width: '6px',
                                            background: msg.status === 'SENT' ? '#10B981' : msg.status === 'FAILED' ? '#EF4444' : '#F59E0B'
                                        }} />

                                        <div style={{ flex: 1, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            {/* Card Header */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                                    <div style={{
                                                        width: '40px',
                                                        height: '40px',
                                                        borderRadius: '50%',
                                                        background: 'var(--bg-body)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: 'var(--primary)'
                                                    }}>
                                                        {msg.type === 'Payment Request' ? <CreditCard size={20} /> : <Send size={20} />}
                                                    </div>
                                                    <div>
                                                        <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-dark)' }}>
                                                            {msg.metadata?.title || msg.type}
                                                        </h4>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.1rem' }}>
                                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: 500 }}>
                                                                To: <span style={{ color: 'var(--text-dark)' }}>{msg.customerPhone}</span>
                                                            </span>
                                                            <span style={{ fontSize: '0.8rem', color: 'var(--border)' }}>•</span>
                                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>
                                                                {new Date(msg.createdAt).toLocaleString()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                    <button
                                                        onClick={(e) => handleResend(msg.id, e)}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.25rem',
                                                            padding: '0.35rem 0.75rem',
                                                            borderRadius: '9999px',
                                                            background: 'white',
                                                            color: 'var(--primary)',
                                                            border: '1px solid var(--primary)',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 700,
                                                            textTransform: 'uppercase',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s',
                                                            letterSpacing: '0.025em'
                                                        }}
                                                    >
                                                        <RefreshCw size={12} /> Resend
                                                    </button>
                                                    <StatusBadge status={msg.status} />
                                                </div>
                                            </div>

                                            {/* Chat Bubble Content */}
                                            <div style={{
                                                background: 'var(--bg-body)',
                                                padding: '1rem',
                                                borderRadius: '0.75rem',
                                                borderTopLeftRadius: '0',
                                                marginLeft: '3.5rem',
                                                position: 'relative',
                                                fontSize: '0.95rem',
                                                color: 'var(--text-dark)',
                                                lineHeight: '1.5'
                                            }}>
                                                <div style={{ position: 'absolute', top: '0', left: '-8px', width: '0', height: '0', borderTop: '10px solid var(--bg-body)', borderLeft: '10px solid transparent' }} />
                                                {msg.content && <div style={{ marginBottom: '0.5rem', whiteSpace: 'pre-wrap' }}>{msg.content}</div>}
                                                {msg.metadata?.paymentLink && !msg.metadata.paymentLink.includes('lumiere.com') && (
                                                    <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <span style={{ fontWeight: 600 }}>Payment Link:</span>
                                                        <a href={msg.metadata.paymentLink} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
                                                            {msg.metadata.paymentLink}
                                                        </a>
                                                    </div>
                                                )}
                                                {msg.error && (
                                                    <div style={{
                                                        marginTop: '0.5rem',
                                                        padding: '0.5rem 0.75rem',
                                                        background: '#FEF2F2',
                                                        border: '1px solid #FECACA',
                                                        borderRadius: '0.5rem',
                                                        color: '#B91C1C',
                                                        fontSize: '0.85rem',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '0.5rem'
                                                    }}>
                                                        <AlertCircle size={14} />
                                                        {msg.error}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Footer Actions */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginLeft: '3.5rem', marginTop: '0.25rem' }}>
                                                <div style={{ display: 'flex', gap: '1.5rem' }}>
                                                    {msg.orderId && (
                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase' }}>Order ID</span>
                                                            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-dark)' }}>#{msg.orderId}</span>
                                                        </div>
                                                    )}
                                                    {msg.metadata?.amount && (
                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase' }}>Amount</span>
                                                            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#10B981' }}>{formatPrice(msg.metadata.amount)}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {msg.metadata?.paymentLink && !msg.metadata.paymentLink.includes('lumiere.com') && (
                                                    <a
                                                        href={msg.metadata.paymentLink}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.5rem',
                                                            padding: '0.5rem 1rem',
                                                            background: 'white',
                                                            border: '1px solid var(--border)',
                                                            borderRadius: '0.5rem',
                                                            color: 'var(--primary)',
                                                            fontSize: '0.85rem',
                                                            fontWeight: 600,
                                                            textDecoration: 'none',
                                                            transition: 'all 0.2s',
                                                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                                        }}
                                                    >
                                                        Open Link <ExternalLink size={14} />
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {filteredMessages.length === 0 && (
                            <div style={{
                                padding: '4rem',
                                textAlign: 'center',
                                background: 'white',
                                borderRadius: '1.5rem',
                                border: '1px dashed var(--border)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '1rem'
                            }}>
                                <div style={{
                                    width: '64px',
                                    height: '64px',
                                    borderRadius: '50%',
                                    background: 'var(--bg-body)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--text-light)'
                                }}>
                                    <Send size={24} />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.25rem' }}>
                                        No messages found
                                    </h3>
                                    <p style={{ color: 'var(--text-gray)', fontSize: '0.9rem' }}>
                                        There are no {activeFilter} messages to display right now.
                                    </p>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Confirmation Modal */}
            <Modal
                isOpen={!!confirmModal}
                onClose={() => setConfirmModal(null)}
                title="Resend Message"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center', textAlign: 'center' }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '50%',
                        background: '#EEF2FF',
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <RefreshCw size={32} />
                    </div>

                    <div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '0.5rem' }}>
                            Are you sure?
                        </h3>
                        <p style={{ color: 'var(--text-gray)', lineHeight: '1.5' }}>
                            This will resend the message automatically via Meta WhatsApp API to the customer.
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
                        <Button
                            variant="outline"
                            style={{ flex: 1, borderRadius: '0.75rem' }}
                            onClick={() => setConfirmModal(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            style={{ flex: 1, borderRadius: '0.75rem', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)' }}
                            onClick={executeResend}
                        >
                            Yes, Resend
                        </Button>
                    </div>
                </div>
            </Modal>
        </div >
    );
};

const StatusBadge = ({ status }: { status: string }) => {
    const s = status.toLowerCase();
    const configs: any = {
        sent: { icon: CheckCircle, bg: '#10B981', label: 'Sent' },
        pending: { icon: Clock, bg: '#F59E0B', label: 'Pending' },
        failed: { icon: AlertCircle, bg: '#EF4444', label: 'Failed' },
    };
    const config = configs[s] || configs.pending;

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            borderRadius: '9999px',
            background: `${config.bg}15`,
            color: config.bg,
            border: `1px solid ${config.bg}30`
        }}>
            <config.icon size={16} strokeWidth={2.5} />
            <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                {config.label}
            </span>
        </div>
    );
};

export default MessageLog;
