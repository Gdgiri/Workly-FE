import React, { useState } from 'react';

import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../redux/store';
import { fetchMessages, resendMessage } from '../redux/slices/messageSlice';
import { fetchSettings } from '../redux/slices/settingSlice';
import { fetchCustomers } from '../redux/slices/customerSlice';
import api from '../utils/api';
import { useToast } from '../components/ToastContext';
import { useCurrency } from '../components/CurrencyContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    RefreshCw, Send, CheckCircle, Clock, AlertCircle,
    ExternalLink, Phone, ArrowRight, CreditCard, MessageSquare,
    Megaphone, Users, Calendar, Percent, Trash2, Play, Plus, ChevronRight, Info, Check
} from 'lucide-react';
import { Button, Card, KPICard, Modal, Skeleton, Input } from '../components/UI';

const MessageLog: React.FC = () => {
    const { formatPrice } = useCurrency();
    const { showToast } = useToast();
    const [activeFilter, setActiveFilter] = useState<'sent' | 'pending' | 'failed'>('sent');
    const dispatch = useDispatch<AppDispatch>();
    const { messages, loading, error } = useSelector((state: RootState) => state.messages);
    const { settings } = useSelector((state: RootState) => state.settings);
    const { customers } = useSelector((state: RootState) => state.customers);

    // Tab Navigation and filters for campaigns
    const [activeTab, setActiveTab] = useState<'logs' | 'campaigns'>('logs');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [campaignFilter, setCampaignFilter] = useState<'all' | 'scheduled' | 'sent' | 'draft'>('all');

    // Campaigns list
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [campaignsLoading, setCampaignsLoading] = useState(false);

    const fetchCampaignsFromDb = async () => {
        setCampaignsLoading(true);
        try {
            const response = await api.get('/campaigns');
            setCampaigns(response.data);
        } catch (error) {
            console.error('Failed to fetch campaigns:', error);
            showToast('Failed to fetch campaigns', 'error');
        } finally {
            setCampaignsLoading(false);
        }
    };

    // New campaign form state
    const [newCampaign, setNewCampaign] = useState({
        name: '',
        segment: 'all',
        triggerType: 'general',
        serviceName: 'Haircut & Style',
        discount: '',
        frequency: 'once',
        dateTime: '',
        customInterval: '1',
        customUnit: 'days',
        templateKey: '',
        weeklyDay: 'monday',
        monthlyDay: '1',
        customTriggerType: '',
        selectionType: 'segment',
        customerId: ''
    });

    // Parse templates from settings
    const apiIntegrations = settings?.apiIntegrations 
        ? (typeof settings.apiIntegrations === 'string' 
            ? JSON.parse(settings.apiIntegrations) 
            : settings.apiIntegrations) 
        : [];
    const whatsappConfig = Array.isArray(apiIntegrations) ? apiIntegrations.find((i: any) => i.type === 'whatsapp') : null;
    const whatsappTemplates = whatsappConfig?.templates || {};

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
        dispatch(fetchSettings());
        dispatch(fetchCustomers());
    }, [dispatch]);

    React.useEffect(() => {
        if (activeTab === 'campaigns') {
            fetchCampaignsFromDb();
        }
    }, [activeTab]);

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

    const handleCreateCampaign = async (status: 'scheduled' | 'draft') => {
        if (!newCampaign.name.trim()) {
            showToast('Please enter a campaign name', 'error');
            return;
        }
        if (!newCampaign.templateKey) {
            showToast('Please select a message template', 'error');
            return;
        }

        // For daily/weekly/monthly, if time is specified, convert it to a full ISO date-time string relative to today
        let resolvedDateTime = newCampaign.dateTime;
        if (newCampaign.frequency !== 'once' && newCampaign.frequency !== 'custom' && newCampaign.dateTime) {
            const todayStr = new Date().toDateString(); // e.g. "Sat Jun 27 2026"
            resolvedDateTime = new Date(`${todayStr} ${newCampaign.dateTime}`).toISOString();
        }

        try {
            if (newCampaign.selectionType === 'particular' && !newCampaign.customerId) {
                showToast('Please select a specific customer', 'error');
                return;
            }

            await api.post('/campaigns', {
                name: newCampaign.name.trim(),
                segment: newCampaign.selectionType === 'particular' ? 'all' : newCampaign.segment,
                customerId: newCampaign.selectionType === 'particular' ? newCampaign.customerId : undefined,
                triggerType: newCampaign.triggerType === 'custom' ? (newCampaign.customTriggerType.trim() || 'custom') : newCampaign.triggerType,
                serviceName: newCampaign.triggerType === 'service' ? newCampaign.serviceName : undefined,
                discount: newCampaign.triggerType === 'offer' ? newCampaign.discount : undefined,
                frequency: newCampaign.frequency,
                dateTime: resolvedDateTime || undefined,
                customInterval: newCampaign.frequency === 'custom' ? Number(newCampaign.customInterval) : undefined,
                customUnit: newCampaign.frequency === 'custom' ? newCampaign.customUnit : undefined,
                weeklyDay: newCampaign.frequency === 'weekly' ? newCampaign.weeklyDay : undefined,
                monthlyDay: newCampaign.frequency === 'monthly' ? newCampaign.monthlyDay : undefined,
                templateKey: newCampaign.templateKey,
                status: status === 'scheduled' ? 'SCHEDULED' : 'DRAFT'
            });

            showToast(status === 'scheduled' ? 'Campaign scheduled successfully!' : 'Campaign saved as draft!', 'success');
            fetchCampaignsFromDb();
            setShowCreateForm(false);
            setNewCampaign({
                name: '',
                segment: 'all',
                triggerType: 'general',
                serviceName: 'Haircut & Style',
                discount: '',
                frequency: 'once',
                dateTime: '',
                customInterval: '1',
                customUnit: 'days',
                templateKey: '',
                weeklyDay: 'monday',
                monthlyDay: '1',
                customTriggerType: '',
                selectionType: 'segment',
                customerId: ''
            });
        } catch (error: any) {
            console.error('Create campaign failed:', error);
            showToast(error.response?.data?.error || 'Failed to create campaign', 'error');
        }
    };

    const handleDeleteCampaign = async (id: string | number) => {
        try {
            await api.delete(`/campaigns/${id}`);
            showToast('Campaign deleted successfully!', 'success');
            fetchCampaignsFromDb();
        } catch (error: any) {
            console.error('Delete campaign failed:', error);
            showToast('Failed to delete campaign', 'error');
        }
    };

    const handleRunCampaign = async (id: string | number) => {
        try {
            await api.post(`/campaigns/${id}/run`);
            showToast('Campaign triggered successfully!', 'success');
            fetchCampaignsFromDb();
        } catch (error: any) {
            console.error('Run campaign failed:', error);
            showToast(error.response?.data?.error || 'Failed to run campaign', 'error');
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
            {/* Tab Selection */}
            <div style={{
                display: 'flex',
                borderBottom: '2px solid var(--border-light)',
                gap: '2rem',
                marginBottom: '1rem',
                paddingBottom: '0.5rem'
            }}>
                <button
                    onClick={() => { setActiveTab('logs'); setShowCreateForm(false); }}
                    style={{
                        padding: '0.75rem 0.5rem',
                        fontSize: '1rem',
                        fontWeight: 700,
                        color: activeTab === 'logs' ? 'var(--primary)' : 'var(--text-black)',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'logs' ? '3px solid var(--primary)' : '3px solid transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.2s',
                        marginBottom: '-0.65rem'
                    }}
                >
                    <MessageSquare size={18} />
                    Message Logs
                </button>
                <button
                    onClick={() => setActiveTab('campaigns')}
                    style={{
                        padding: '0.75rem 0.5rem',
                        fontSize: '1rem',
                        fontWeight: 700,
                        color: activeTab === 'campaigns' ? 'var(--primary)' : 'var(--text-black)',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'campaigns' ? '3px solid var(--primary)' : '3px solid transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.2s',
                        marginBottom: '-0.65rem'
                    }}
                >
                    <Megaphone size={18} />
                    Campaigns
                </button>
            </div>

            {activeTab === 'logs' ? (
                <>

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
                                    color: activeFilter === filter.id ? 'white' : 'var(--text-black)',
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
                                    color: activeFilter === filter.id ? 'white' : 'var(--text-black)'
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
                                    <p style={{ color: 'var(--text-black)', fontSize: '0.9rem' }}>
                                        There are no {activeFilter} messages to display right now.
                                    </p>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
                </>
            ) : (
                <>
                    {/* Campaigns View */}
                    {showCreateForm ? (
                        <Card style={{ padding: '2rem', borderRadius: '1.25rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-dark)' }}>Create New WhatsApp Campaign</h3>
                                    <p style={{ color: 'var(--text-black)', fontSize: '0.875rem' }}>Schedule and configure WhatsApp broadcasts to target audience groups.</p>
                                </div>
                                <Button variant="outline" onClick={() => setShowCreateForm(false)}>Cancel</Button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {/* Section 1: Name */}
                                <div>
                                    <Input
                                        label="Campaign Name"
                                        value={newCampaign.name}
                                        onChange={(e) => setNewCampaign(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="e.g. Inactive Customers June Broadcast"
                                        fullWidth
                                    />
                                </div>
                                 {/* Section 2: Segment & Trigger Reason */}
                                 <div style={{ marginBottom: '1rem' }}>
                                     <label className="input-label" style={{ marginBottom: '0.5rem', display: 'block' }}>Target Audience Mode</label>
                                     <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.5rem' }}>
                                         <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-dark)', cursor: 'pointer' }}>
                                             <input 
                                                 type="radio" 
                                                 name="selectionType" 
                                                 checked={newCampaign.selectionType === 'segment'} 
                                                 onChange={() => setNewCampaign(prev => ({ ...prev, selectionType: 'segment' }))} 
                                             />
                                             Customer Segment
                                         </label>
                                         <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-dark)', cursor: 'pointer' }}>
                                             <input 
                                                 type="radio" 
                                                 name="selectionType" 
                                                 checked={newCampaign.selectionType === 'particular'} 
                                                 onChange={() => setNewCampaign(prev => ({ ...prev, selectionType: 'particular' }))} 
                                             />
                                             Specific Customer
                                         </label>
                                     </div>
                                 </div>

                                 <div className="grid md:grid-cols-2 gap-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                                     <div>
                                         {newCampaign.selectionType === 'particular' ? (
                                             <>
                                                 <label className="input-label">Select Customer</label>
                                                 <select
                                                     value={newCampaign.customerId}
                                                     onChange={(e) => setNewCampaign(prev => ({ ...prev, customerId: e.target.value }))}
                                                     style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)', fontSize: '0.875rem', background: 'white', outline: 'none' }}
                                                 >
                                                     <option value="">-- Choose Customer --</option>
                                                     {customers.map((cust: any) => (
                                                         <option key={cust.id} value={cust.id}>
                                                             {cust.name} ({cust.phone || 'No Phone'})
                                                         </option>
                                                     ))}
                                                 </select>
                                             </>
                                         ) : (
                                             <>
                                                 <label className="input-label">Target Customer Segment</label>
                                                 <select
                                                     value={newCampaign.segment}
                                                     onChange={(e) => setNewCampaign(prev => ({ ...prev, segment: e.target.value }))}
                                                     style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)', fontSize: '0.875rem', background: 'white', outline: 'none' }}
                                                 >
                                                     <option value="all">All Registered Customers</option>
                                                     <option value="active">Active Visitors (Visited in last 30 days)</option>
                                                     <option value="inactive">Inactive Visitors (No visit in last 60 days)</option>
                                                 </select>
                                             </>
                                         )}
                                     </div>

                                    <div>
                                        <label className="input-label">Campaign Type / Trigger Reason</label>
                                        <select
                                            value={newCampaign.triggerType}
                                            onChange={(e) => setNewCampaign(prev => ({ ...prev, triggerType: e.target.value as any }))}
                                            style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)', fontSize: '0.875rem', background: 'white', outline: 'none' }}
                                        >
                                            <option value="general">General Announcement</option>
                                            <option value="service">New Service Launch</option>
                                            <option value="offer">Special Discount / Offer</option>
                                            <option value="custom">+ Add Custom Campaign Type...</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Dynamic fields based on trigger type */}
                                {newCampaign.triggerType === 'custom' && (
                                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                                        <Input
                                            label="Custom Campaign Type Name"
                                            value={newCampaign.customTriggerType}
                                            onChange={(e) => setNewCampaign(prev => ({ ...prev, customTriggerType: e.target.value }))}
                                            placeholder="e.g. Festival Greeting, Feedback Survey"
                                            fullWidth
                                        />
                                    </motion.div>
                                )}

                                {newCampaign.triggerType === 'service' && (
                                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                                        <label className="input-label">Select Launched Service</label>
                                        <select
                                            value={newCampaign.serviceName}
                                            onChange={(e) => setNewCampaign(prev => ({ ...prev, serviceName: e.target.value }))}
                                            style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)', fontSize: '0.875rem', background: 'white', outline: 'none' }}
                                        >
                                            <option value="Haircut & Style">Haircut & Style</option>
                                            <option value="Deep Cleansing Facial">Deep Cleansing Facial</option>
                                            <option value="Gel Manicure">Gel Manicure</option>
                                            <option value="Swedish Massage">Swedish Massage</option>
                                            <option value="Balayage Highlights">Balayage Highlights</option>
                                        </select>
                                    </motion.div>
                                )}

                                {newCampaign.triggerType === 'offer' && (
                                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                                        <Input
                                            label="Discount / Offer Details"
                                            value={newCampaign.discount}
                                            onChange={(e) => setNewCampaign(prev => ({ ...prev, discount: e.target.value }))}
                                            placeholder="e.g. 20% off all massage treatments"
                                            fullWidth
                                        />
                                    </motion.div>
                                )}

                                {/* Section 3: Schedule & Frequency */}
                                <div className="grid md:grid-cols-2 gap-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                                    <div>
                                        <label className="input-label">Schedule Frequency</label>
                                        <select
                                            value={newCampaign.frequency}
                                            onChange={(e) => setNewCampaign(prev => ({ ...prev, frequency: e.target.value as any }))}
                                            style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)', fontSize: '0.875rem', background: 'white', outline: 'none' }}
                                        >
                                            <option value="once">Run Once</option>
                                            <option value="daily">Daily Repeat</option>
                                            <option value="weekly">Weekly Repeat</option>
                                            <option value="monthly">Monthly Repeat</option>
                                            <option value="custom">Custom Repeat Interval</option>
                                        </select>
                                    </div>

                                    {/* Dynamic Scheduling Inputs */}
                                    {newCampaign.frequency === 'once' && (
                                        <div>
                                            <label className="input-label">Broadcast Date & Time</label>
                                            <input
                                                type="datetime-local"
                                                value={newCampaign.dateTime}
                                                onChange={(e) => setNewCampaign(prev => ({ ...prev, dateTime: e.target.value }))}
                                                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)', fontSize: '0.875rem', background: 'white', outline: 'none', height: '42px' }}
                                            />
                                        </div>
                                    )}

                                    {newCampaign.frequency === 'daily' && (
                                        <div>
                                            <label className="input-label">Run Daily at Time</label>
                                            <input
                                                type="time"
                                                value={newCampaign.dateTime}
                                                onChange={(e) => setNewCampaign(prev => ({ ...prev, dateTime: e.target.value }))}
                                                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)', fontSize: '0.875rem', background: 'white', outline: 'none', height: '42px' }}
                                            />
                                        </div>
                                    )}

                                    {newCampaign.frequency === 'weekly' && (
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <div style={{ flex: 1 }}>
                                                <label className="input-label">Day of Week</label>
                                                <select
                                                    value={newCampaign.weeklyDay}
                                                    onChange={(e) => setNewCampaign(prev => ({ ...prev, weeklyDay: e.target.value }))}
                                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)', fontSize: '0.875rem', background: 'white', outline: 'none', height: '42px' }}
                                                >
                                                    <option value="monday">Monday</option>
                                                    <option value="tuesday">Tuesday</option>
                                                    <option value="wednesday">Wednesday</option>
                                                    <option value="thursday">Thursday</option>
                                                    <option value="friday">Friday</option>
                                                    <option value="saturday">Saturday</option>
                                                    <option value="sunday">Sunday</option>
                                                </select>
                                            </div>
                                            <div style={{ width: '140px' }}>
                                                <label className="input-label">At Time</label>
                                                <input
                                                    type="time"
                                                    value={newCampaign.dateTime}
                                                    onChange={(e) => setNewCampaign(prev => ({ ...prev, dateTime: e.target.value }))}
                                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)', fontSize: '0.875rem', background: 'white', outline: 'none', height: '42px' }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {newCampaign.frequency === 'monthly' && (
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <div style={{ flex: 1 }}>
                                                <label className="input-label">Day of Month</label>
                                                <select
                                                    value={newCampaign.monthlyDay}
                                                    onChange={(e) => setNewCampaign(prev => ({ ...prev, monthlyDay: e.target.value }))}
                                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)', fontSize: '0.875rem', background: 'white', outline: 'none', height: '42px' }}
                                                >
                                                    {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                                                        <option key={day} value={day}>{day}{day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'} of month</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div style={{ width: '140px' }}>
                                                <label className="input-label">At Time</label>
                                                <input
                                                    type="time"
                                                    value={newCampaign.dateTime}
                                                    onChange={(e) => setNewCampaign(prev => ({ ...prev, dateTime: e.target.value }))}
                                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)', fontSize: '0.875rem', background: 'white', outline: 'none', height: '42px' }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {newCampaign.frequency === 'custom' && (
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'end' }}>
                                            <div style={{ flex: 1 }}>
                                                <Input
                                                    label="Repeat Every"
                                                    type="number"
                                                    value={newCampaign.customInterval}
                                                    onChange={(e) => setNewCampaign(prev => ({ ...prev, customInterval: e.target.value }))}
                                                    placeholder="3"
                                                />
                                            </div>
                                            <div className="input-group" style={{ width: '120px' }}>
                                                <span className="input-label" style={{ visibility: 'hidden', height: '21px' }}>Unit</span>
                                                <select
                                                    value={newCampaign.customUnit}
                                                    onChange={(e) => setNewCampaign(prev => ({ ...prev, customUnit: e.target.value as any }))}
                                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)', fontSize: '0.875rem', background: 'white', outline: 'none', height: '42px' }}
                                                >
                                                    <option value="hours">Hours</option>
                                                    <option value="days">Days</option>
                                                    <option value="weeks">Weeks</option>
                                                </select>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Section 4: Template Selector */}
                                <div>
                                    <label className="input-label">WhatsApp Template to Use</label>
                                    <select
                                        value={newCampaign.templateKey}
                                        onChange={(e) => setNewCampaign(prev => ({ ...prev, templateKey: e.target.value }))}
                                        style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)', fontSize: '0.875rem', background: 'white', outline: 'none' }}
                                    >
                                        <option value="">-- Select Template --</option>
                                        {Object.entries(whatsappTemplates).map(([key, value]) => {
                                            const templateName = typeof value === 'object' && value ? (value as any).name : (value || '');
                                            const templateLabel = typeof value === 'object' && value && (value as any).label ? (value as any).label : key.replace(/_/g, ' ');
                                            if (!templateName) return null;
                                            return (
                                                <option key={key} value={key}>
                                                    {templateLabel} ({templateName})
                                                </option>
                                            );
                                        })}
                                    </select>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-black)', marginTop: '0.25rem' }}>
                                        Templates are loaded dynamically from your WhatsApp settings integration configurations.
                                    </p>
                                </div>

                                {/* Action buttons */}
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--border-light)', paddingTop: '1.5rem', marginTop: '1rem' }}>
                                    <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                                        Cancel
                                    </Button>
                                    <Button variant="outline" onClick={() => handleCreateCampaign('draft')}>
                                        Save as Draft
                                    </Button>
                                    <Button variant="primary" onClick={() => handleCreateCampaign('scheduled')} icon={<Calendar size={16} />} style={{ boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)' }}>
                                        Schedule Campaign
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ) : (
                        <>
                            {/* Campaigns Dashboard Cards */}
                            <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                                <KPICard title="Total Campaigns" value={campaigns.length.toString()} icon={Megaphone} color="#6366F1" />
                                <KPICard title="Scheduled Broadcasts" value={campaigns.filter(c => c.status === 'scheduled').length.toString()} icon={Clock} color="#3B82F6" />
                                <KPICard title="Sent Campaigns" value={campaigns.filter(c => c.status === 'sent').length.toString()} icon={Send} color="#10B981" />
                                <KPICard title="Success Delivery Rate" value={`${campaigns.filter(c => c.status === 'sent').length > 0 ? '96%' : '100%'}`} icon={CheckCircle} color="#8B5CF6" />
                            </div>

                            {/* Campaigns Action Toolbar */}
                            <Card className="p-0 overflow-visible" style={{ padding: '0.75rem 1.5rem', borderRadius: '1.25rem' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>
                                    {/* Segment Filters */}
                                    <div style={{
                                        display: 'flex',
                                        background: 'var(--bg-body)',
                                        padding: '0.25rem',
                                        borderRadius: '0.75rem',
                                        border: '1px solid var(--border-light)'
                                    }}>
                                        {[
                                            { id: 'all', label: 'All' },
                                            { id: 'scheduled', label: 'Scheduled' },
                                            { id: 'sent', label: 'Sent' },
                                            { id: 'draft', label: 'Drafts' }
                                        ].map(filter => (
                                            <button
                                                key={filter.id}
                                                onClick={() => setCampaignFilter(filter.id as any)}
                                                style={{
                                                    padding: '0.5rem 1rem',
                                                    borderRadius: '0.5rem',
                                                    fontSize: '0.875rem',
                                                    fontWeight: 600,
                                                    transition: 'all 0.2s',
                                                    background: campaignFilter === filter.id ? 'var(--primary)' : 'transparent',
                                                    color: campaignFilter === filter.id ? 'white' : 'var(--text-black)',
                                                    border: 'none',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {filter.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Create Button */}
                                    <Button
                                        variant="primary"
                                        onClick={() => {
                                            if (Object.keys(whatsappTemplates).length === 0) {
                                                showToast('Please configure WhatsApp Integration templates in settings page first.', 'error');
                                            }
                                            setShowCreateForm(true);
                                        }}
                                        icon={<Plus size={16} />}
                                        style={{ boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)' }}
                                    >
                                        Create Campaign
                                    </Button>
                                </div>
                            </Card>

                            {/* Campaigns List Cards */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {campaigns.filter(c => {
                                    if (campaignFilter === 'scheduled') return c.status === 'scheduled';
                                    if (campaignFilter === 'sent') return c.status === 'sent';
                                    if (campaignFilter === 'draft') return c.status === 'draft';
                                    return true;
                                }).map(c => {
                                    const templateCfg = whatsappTemplates[c.templateKey];
                                    const templateName = typeof templateCfg === 'object' && templateCfg ? templateCfg.name : (templateCfg || c.templateKey);
                                    
                                    const totalAudience = c.targetAudienceCount ?? (c.status === 'sent' ? c.sentCount : 0);
                                    const readPercent = c.sentCount > 0 ? Math.round((c.readCount / c.sentCount) * 100) : 0;
                                    const failedPercent = c.sentCount > 0 ? Math.round((c.failedCount / c.sentCount) * 100) : 0;

                                    return (
                                        <div key={c.id} style={{
                                            display: 'flex',
                                            background: 'white',
                                            borderRadius: '1rem',
                                            overflow: 'hidden',
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                                            border: '1px solid var(--border-light)'
                                        }}>
                                            {/* Left Border colored strip based on status */}
                                            <div style={{
                                                width: '6px',
                                                background: c.status === 'sent' ? '#10B981' : c.status === 'scheduled' ? '#3B82F6' : '#6B7280'
                                            }} />

                                            <div style={{ flex: 1, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                {/* Card Header */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                                                    <div>
                                                        <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '0.25rem' }}>
                                                            {c.name}
                                                        </h4>
                                                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                                            <span style={{ fontSize: '0.75rem', background: '#F3F4F6', color: '#374151', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                                                                {c.customerId ? `Target Customer: ${c.customerName || 'Specific Customer'}` : `Segment: ${c.segment.toUpperCase()}`}
                                                            </span>
                                                            <span style={{ fontSize: '0.75rem', background: '#EEF2FF', color: '#4F46E5', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                                                                Type: {c.triggerType.toUpperCase()}
                                                            </span>
                                                            {c.serviceName && (
                                                                <span style={{ fontSize: '0.75rem', background: '#ECFDF5', color: '#047857', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                                                                    Service: {c.serviceName}
                                                                </span>
                                                            )}
                                                            {c.discount && (
                                                                <span style={{ fontSize: '0.75rem', background: '#FFFBEB', color: '#B45309', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                                                                    Offer: {c.discount}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Status Badge & Actions */}
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                        <span style={{
                                                            fontSize: '0.75rem',
                                                            fontWeight: 800,
                                                            textTransform: 'uppercase',
                                                            padding: '0.35rem 0.75rem',
                                                            borderRadius: '9999px',
                                                            background: c.status === 'sent' ? '#D1FAE5' : c.status === 'scheduled' ? '#DBEAFE' : '#E5E7EB',
                                                            color: c.status === 'sent' ? '#065F46' : c.status === 'scheduled' ? '#1E40AF' : '#374151'
                                                        }}>
                                                            {c.status}
                                                        </span>

                                                        {c.status !== 'sent' && (
                                                            <button
                                                                onClick={() => handleRunCampaign(c.id)}
                                                                style={{
                                                                    background: 'var(--primary)',
                                                                    color: 'white',
                                                                    border: 'none',
                                                                    borderRadius: '0.5rem',
                                                                    padding: '0.4rem 0.8rem',
                                                                    fontSize: '0.75rem',
                                                                    fontWeight: 700,
                                                                    cursor: 'pointer',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '0.25rem',
                                                                    boxShadow: '0 2px 4px rgba(99,102,241,0.2)'
                                                                }}
                                                            >
                                                                <Play size={12} fill="white" /> Run
                                                            </button>
                                                        )}

                                                        <button
                                                            onClick={() => handleDeleteCampaign(c.id)}
                                                            style={{
                                                                background: 'none',
                                                                border: 'none',
                                                                color: '#EF4444',
                                                                cursor: 'pointer',
                                                                padding: '0.4rem',
                                                                borderRadius: '0.5rem',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                transition: 'all 0.2s'
                                                            }}
                                                            title="Delete Campaign"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Grid details (Schedule / Template) */}
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', background: '#F9FAFB', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #F3F4F6' }}>
                                                    <div>
                                                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#6B7280', fontWeight: 600, textTransform: 'uppercase' }}>Frequency / Schedule</span>
                                                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                            <Calendar size={14} style={{ color: 'var(--primary)' }} />
                                                            {c.frequency === 'custom' 
                                                                ? `Every ${c.customInterval} ${c.customUnit}` 
                                                                : c.frequency === 'weekly' 
                                                                    ? `Weekly on ${c.weeklyDay?.toUpperCase() || 'MONDAY'}` 
                                                                    : c.frequency === 'monthly' 
                                                                        ? `Monthly on day ${c.monthlyDay || '1'}` 
                                                                        : c.frequency.toUpperCase()}
                                                            {c.dateTime && ` at ${c.dateTime.replace('T', ' ')}`}
                                                        </span>
                                                    </div>

                                                    <div>
                                                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#6B7280', fontWeight: 600, textTransform: 'uppercase' }}>Meta Template Config</span>
                                                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                            <Info size={14} style={{ color: 'var(--primary)' }} />
                                                            {templateName}
                                                        </span>
                                                    </div>

                                                    <div>
                                                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#6B7280', fontWeight: 600, textTransform: 'uppercase' }}>Target Audience</span>
                                                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                            <Users size={14} style={{ color: 'var(--primary)' }} />
                                                            {totalAudience} Customers
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Statistics progress metrics (Only shown for Sent campaigns) */}
                                                {c.status === 'sent' && (
                                                    <div style={{ marginTop: '0.5rem' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginBottom: '0.4rem' }}>
                                                            <span>Delivery & Engagement Analytics</span>
                                                            <span>Success Rate: {100 - failedPercent}%</span>
                                                        </div>

                                                        {/* Composite Progress bar */}
                                                        <div style={{ height: '8px', background: '#E5E7EB', borderRadius: '4px', overflow: 'hidden', display: 'flex', width: '100%' }}>
                                                            <div style={{ width: `${readPercent}%`, background: '#10B981', height: '100%' }} title={`Read: ${readPercent}%`} />
                                                            <div style={{ width: `${100 - readPercent - failedPercent}%`, background: '#60A5FA', height: '100%' }} title={`Delivered: ${100 - readPercent - failedPercent}%`} />
                                                            <div style={{ width: `${failedPercent}%`, background: '#EF4444', height: '100%' }} title={`Failed: ${failedPercent}%`} />
                                                        </div>

                                                        {/* Stats legends */}
                                                        <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 600, color: '#4B5563' }}>
                                                                <span style={{ width: '8px', height: '8px', background: '#10B981', borderRadius: '50%' }} />
                                                                Read: {c.readCount}
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 600, color: '#4B5563' }}>
                                                                <span style={{ width: '8px', height: '8px', background: '#60A5FA', borderRadius: '50%' }} />
                                                                Delivered: {c.sentCount - c.readCount - c.failedCount}
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 600, color: '#4B5563' }}>
                                                                <span style={{ width: '8px', height: '8px', background: '#EF4444', borderRadius: '50%' }} />
                                                                Failed: {c.failedCount}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                {campaigns.filter(c => {
                                    if (campaignFilter === 'scheduled') return c.status === 'scheduled';
                                    if (campaignFilter === 'sent') return c.status === 'sent';
                                    if (campaignFilter === 'draft') return c.status === 'draft';
                                    return true;
                                }).length === 0 && (
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
                                            <Megaphone size={24} />
                                        </div>
                                        <div>
                                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.25rem' }}>
                                                No campaigns found
                                            </h3>
                                            <p style={{ color: 'var(--text-black)', fontSize: '0.9rem' }}>
                                                There are no campaigns matching your filter. Click "+ Create Campaign" to get started!
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </>
            )}

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
                        <p style={{ color: 'var(--text-black)', lineHeight: '1.5' }}>
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
