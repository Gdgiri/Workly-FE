import React, { useState } from 'react';

import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../redux/store';
import { fetchMessages, resendMessage } from '../redux/slices/messageSlice';
import { fetchCustomers, invalidateCustomerCache } from '../redux/slices/customerSlice';
import { fetchSettings } from '../redux/slices/settingSlice';
import { useCurrency } from '../components/CurrencyContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    RefreshCw, Send, CheckCircle, Clock, AlertCircle,
    ExternalLink, Phone, ArrowRight, CreditCard, MessageSquare,
    Calendar, Users, Check, FileText, CheckCircle2, Trash2, Plus,
    ChevronRight, AlertTriangle, UserCheck, UserX, Info, Edit, X
} from 'lucide-react';
import { Button, Card, KPICard, Modal, Skeleton, Input } from '../components/UI';
import api from '../utils/api';
import { useToast } from '../components/ToastContext';

const MessageLog: React.FC = () => {
    const { formatPrice } = useCurrency();
    const [activeTab, setActiveTab] = useState<'automated' | 'bulk'>('automated');
    const [activeFilter, setActiveFilter] = useState<'sent' | 'pending' | 'failed'>('sent');
    const dispatch = useDispatch<AppDispatch>();
    
    // Redux selectors
    const { messages, loading: messagesLoading } = useSelector((state: RootState) => state.messages);
    const { customers, loading: customersLoading } = useSelector((state: RootState) => state.customers);
    const { settings, loading: settingsLoading } = useSelector((state: RootState) => state.settings);

    const loading = messagesLoading || customersLoading || settingsLoading;

    // Automated stats
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

    // Choose default active filter dynamically based on message presence
    React.useEffect(() => {
        if (messages && messages.length > 0) {
            const hasSent = messages.some((m: any) => m.status === 'SENT');
            const hasFailed = messages.some((m: any) => m.status === 'FAILED');
            const hasPending = messages.some((m: any) => m.status === 'PENDING');
            
            // Only auto-switch if activeFilter doesn't have any messages to show
            const activeCount = messages.filter((m: any) => {
                if (activeFilter === 'sent') return m.status === 'SENT';
                if (activeFilter === 'pending') return m.status === 'PENDING';
                if (activeFilter === 'failed') return m.status === 'FAILED';
                return true;
            }).length;

            if (activeCount === 0) {
                if (hasSent) {
                    setActiveFilter('sent');
                } else if (hasFailed) {
                    setActiveFilter('failed');
                } else if (hasPending) {
                    setActiveFilter('pending');
                }
            }
        }
    }, [messages, activeFilter]);

    React.useEffect(() => {
        dispatch(fetchMessages());
        dispatch(fetchCustomers());
        dispatch(fetchSettings());
    }, [dispatch]);

    const handleRefresh = () => {
        dispatch(fetchMessages());
    };

    const handleResend = async (id: string | number, e: React.MouseEvent) => {
        e.stopPropagation();
        const msg = messages.find(m => m.id === id);
        setConfirmModal({ id, message: msg });
    };

    const executeResend = async () => {
        if (!confirmModal) return;
        try {
            await dispatch(resendMessage(confirmModal.id)).unwrap();
            dispatch(fetchMessages());
            setConfirmModal(null);
        } catch (error: any) {
            console.error('Failed to resend message:', error);
            alert(error.message || 'Failed to resend message');
        }
    };

    const [isResendingAll, setIsResendingAll] = useState(false);

    const handleResendAll = async (status: 'FAILED' | 'PENDING') => {
        const count = messages.filter((m: any) => m.status === status).length;
        if (count === 0) return;
        
        if (!window.confirm(`Are you sure you want to resend all ${count} ${status.toLowerCase()} message(s)?`)) {
            return;
        }

        setIsResendingAll(true);
        try {
            const response = await api.post('/message-logs/resend-all', { status });
            const result = response.data;
            showToast(`Resent ${result.successCount || 0} messages successfully!`, 'success');
            dispatch(fetchMessages());
        } catch (error: any) {
            console.error('Resend all failed:', error);
            showToast(error.response?.data?.error || 'Failed to resend messages', 'error');
        } finally {
            setIsResendingAll(false);
        }
    };

    const filteredMessages = messages.filter(msg => {
        if (activeFilter === 'sent') return msg.status === 'SENT';
        if (activeFilter === 'pending') return msg.status === 'PENDING';
        if (activeFilter === 'failed') return msg.status === 'FAILED';
        return true;
    });

    // --- BULK CAMPAIGN MANAGEMENT ---
    
    // Campaign history state (persisted in localStorage)
    const [campaigns, setCampaigns] = useState<any[]>(() => {
        const stored = localStorage.getItem('bulk_campaigns');
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                console.error(e);
            }
        }
        // Fallback default campaign history
        return [
            {
                id: '1',
                name: 'Ramadan Special Promotion',
                description: 'Sent greetings and 15% discount for grooming packages to top-tier clients.',
                status: 'COMPLETED',
                target: 'Top Performing Clients',
                templateName: 'ramadan_special_15',
                sentCount: 38,
                successCount: 38,
                failedCount: 0,
                createdAt: '2026-06-12T14:30:00.000Z',
                scheduleTime: null
            },
            {
                id: '2',
                name: 'We Miss You Alert',
                description: 'Re-engagement template message to clients who have not visited in 30 days.',
                status: 'COMPLETED',
                target: 'Never Visited Last Month',
                templateName: 'system_we_miss_you',
                sentCount: 104,
                successCount: 99,
                failedCount: 5,
                createdAt: '2026-06-20T09:15:00.000Z',
                scheduleTime: null
            },
            {
                id: '3',
                name: 'July Holiday Promotion',
                description: 'Broadcast about upcoming slot bookings and holiday greetings.',
                status: 'SCHEDULED',
                target: 'All Customers',
                templateName: 'holiday_greetings_july',
                sentCount: 0,
                successCount: 0,
                failedCount: 0,
                createdAt: '2026-06-27T18:00:00.000Z',
                scheduleTime: '2026-07-04T10:00:00.000Z'
            }
        ];
    });

    React.useEffect(() => {
        localStorage.setItem('bulk_campaigns', JSON.stringify(campaigns));
    }, [campaigns]);

    // Bulk campaigns stats
    const bulkStats = React.useMemo(() => {
        return {
            total: campaigns.length,
            totalSent: campaigns.reduce((acc, c) => acc + (c.sentCount || 0), 0),
            successRate: campaigns.some(c => c.status === 'COMPLETED' && c.sentCount > 0)
                ? `${(campaigns.reduce((acc, c) => acc + (c.successCount || 0), 0) / campaigns.reduce((acc, c) => acc + (c.status === 'COMPLETED' ? c.sentCount : 0), 0) * 100).toFixed(1)}%`
                : '100%',
            scheduled: campaigns.filter(c => c.status === 'SCHEDULED').length
        };
    }, [campaigns]);

    // Wizard States
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [wizardStep, setWizardStep] = useState(1);
    const [campaignName, setCampaignName] = useState('');
    const [campaignDesc, setCampaignDesc] = useState('');
    const [scheduleType, setScheduleType] = useState<'now' | 'scheduled'>('now');
    const [scheduleDateTime, setScheduleDateTime] = useState('');
    const [audienceFilter, setAudienceFilter] = useState<'all' | 'top' | 'inactive' | 'custom_date'>('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [validationTab, setValidationTab] = useState<'eligible' | 'excluded'>('eligible');

    // Inline Customer Editing States inside Campaign Wizard
    const { showToast } = useToast();
    const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
    const [editPhoneValue, setEditPhoneValue] = useState('');
    const [editNameValue, setEditNameValue] = useState('');
    const [isSavingCustomer, setIsSavingCustomer] = useState(false);
    const [previewCustomerId, setPreviewCustomerId] = useState<string>('');

    // Progress States
    const [isSending, setIsSending] = useState(false);
    const [sendProgress, setSendProgress] = useState(0);
    const [sendCurrentIndex, setSendCurrentIndex] = useState(0);

    // Extract bulk templates from settings
    const bulkTemplates = React.useMemo(() => {
        if (!settings?.apiIntegrations) return [];
        try {
            const integrations = typeof settings.apiIntegrations === 'string'
                ? JSON.parse(settings.apiIntegrations)
                : settings.apiIntegrations;
            if (Array.isArray(integrations)) {
                const wa = integrations.find((i: any) => i.type === 'whatsapp');
                return wa?.bulkTemplates || [];
            }
        } catch (e) {
            console.error("Failed to parse settings for bulk templates", e);
        }
        return [];
    }, [settings]);

    const defaultTemplates = [
        { id: 'sys_promo', name: 'system_promo_general', language: 'en', description: 'General promo: "Hey {name}! Get 15% off on your next services. Use code PROMO15."' },
        { id: 'sys_miss_you', name: 'system_we_miss_you', language: 'en', description: 'Re-engagement: "Hi {name}, we miss you! Book your next pampering session today and enjoy 10% off."' }
    ];

    const allTemplates = React.useMemo(() => {
        return [...bulkTemplates, ...defaultTemplates];
    }, [bulkTemplates]);

    // Apply audience filter
    const filteredCustomers = React.useMemo(() => {
        if (audienceFilter === 'all') {
            return customers;
        }
        if (audienceFilter === 'top') {
            return customers.filter(c => c.totalSpend > 5000 || (c.visitCount || c.totalAppointments || 0) > 5);
        }
        if (audienceFilter === 'inactive') {
            const lastMonth = new Date();
            lastMonth.setDate(lastMonth.getDate() - 30);
            return customers.filter(c => {
                if (!c.lastVisit) return true;
                return new Date(c.lastVisit) < lastMonth;
            });
        }
        if (audienceFilter === 'custom_date') {
            return customers.filter(c => {
                if (!c.lastVisit) return false;
                const visitDate = new Date(c.lastVisit);
                const start = startDate ? new Date(startDate) : null;
                const end = endDate ? new Date(endDate) : null;
                if (start && visitDate < start) return false;
                if (end && visitDate > end) return false;
                return true;
            });
        }
        return [];
    }, [customers, audienceFilter, startDate, endDate]);

    // Validation helper
    const validatePhoneNumber = (phone: string) => {
        if (!phone) return false;
        const digits = phone.replace(/\D/g, '');
        return digits.length >= 10 && digits.length <= 15;
    };

    const handleStartEditCustomer = (id: string, name: string, phone: string) => {
        setEditingCustomerId(id);
        setEditNameValue(name || '');
        setEditPhoneValue(phone || '');
    };

    const handleCancelEditCustomer = () => {
        setEditingCustomerId(null);
        setEditNameValue('');
        setEditPhoneValue('');
    };

    const handleSaveCustomerDetails = async (id: string, originalCustomer: any) => {
        if (!editNameValue.trim()) {
            showToast('Customer name is required', 'error');
            return;
        }
        if (!editPhoneValue.trim()) {
            showToast('Phone number is required', 'error');
            return;
        }

        setIsSavingCustomer(true);
        try {
            await api.put(`/customers/${id}`, {
                name: editNameValue.trim(),
                phone: editPhoneValue.trim(),
                email: originalCustomer.email,
                city: originalCustomer.city,
                role: originalCustomer.role,
                dateOfBirth: originalCustomer.dateOfBirth,
                ageGroup: originalCustomer.ageGroup,
                attachments: originalCustomer.attachments || []
            });

            showToast('Customer updated successfully', 'success');

            // Refresh Redux customers list
            dispatch(invalidateCustomerCache());
            await dispatch(fetchCustomers()).unwrap();

            // If previously excluded and now valid, auto-select them
            const isNowEligible = validatePhoneNumber(editPhoneValue.trim());
            if (isNowEligible && !selectedCustomers.includes(id)) {
                setSelectedCustomers(prev => [...prev, id]);
            }

            handleCancelEditCustomer();
        } catch (err: any) {
            console.error('Failed to update customer from campaign wizard:', err);
            showToast(err.response?.data?.error || 'Failed to update customer', 'error');
        } finally {
            setIsSavingCustomer(false);
        }
    };

    // Separate eligible vs excluded based on phone validation
    const eligibleCustomers = React.useMemo(() => {
        return filteredCustomers.filter(c => validatePhoneNumber(c.phone));
    }, [filteredCustomers]);

    const excludedCustomers = React.useMemo(() => {
        return filteredCustomers.filter(c => !validatePhoneNumber(c.phone));
    }, [filteredCustomers]);

    // Sync selected customers when audience changes
    React.useEffect(() => {
        const ids = eligibleCustomers.map(c => String(c.id));
        setSelectedCustomers(ids);
        if (ids.length > 0) {
            setPreviewCustomerId(ids[0]);
        } else {
            setPreviewCustomerId('');
        }
    }, [eligibleCustomers]);

    // Open Wizard modal and reset states
    const handleOpenWizard = () => {
        setCampaignName('');
        setCampaignDesc('');
        setScheduleType('now');
        setScheduleDateTime('');
        setAudienceFilter('all');
        setStartDate('');
        setEndDate('');
        setSelectedTemplateId(allTemplates[0]?.id || '');
        setPreviewCustomerId('');
        setWizardStep(1);
        setValidationTab('eligible');
        setIsWizardOpen(true);
    };

    // Simulate sending messages
    const handleLaunchCampaign = async () => {
        const eligibleCount = selectedCustomers.length;
        if (eligibleCount === 0) {
            showToast('No recipients selected for the campaign', 'error');
            return;
        }

        const selectedTemplate = allTemplates.find(t => t.id === selectedTemplateId) || allTemplates[0];

        // Prepare recipients payload
        const recipients = selectedCustomers.map(id => {
            const c = customers.find(cust => String(cust.id) === id);
            return {
                name: c?.name || 'Customer',
                phone: c?.phone || ''
            };
        });

        setIsSending(true);
        setSendProgress(0);
        setSendCurrentIndex(0);

        try {
            // Call real backend API
            const response = await api.post('/message-logs/bulk', {
                campaignName,
                campaignDesc,
                templateId: selectedTemplateId,
                scheduledAt: scheduleType === 'scheduled' ? scheduleDateTime : undefined,
                recipients
            });

            const data = response.data;

            // Show a visual simulation progress bar for 1.2 seconds to represent dispatching before finishing
            for (let progress = 0; progress <= 100; progress += 20) {
                setSendProgress(progress);
                setSendCurrentIndex(Math.floor((progress / 100) * eligibleCount));
                await new Promise(resolve => setTimeout(resolve, 150));
            }

            showToast(
                scheduleType === 'scheduled' 
                    ? `Campaign scheduled successfully for ${new Date(data.scheduledAtUTC).toLocaleString()}` 
                    : `Campaign queued successfully for immediate dispatch!`,
                'success'
            );

            // Add to campaigns history view (local state + localStorage)
            const newCampaign = {
                id: data.campaignId || Date.now().toString(),
                name: campaignName,
                description: campaignDesc,
                status: scheduleType === 'scheduled' ? 'SCHEDULED' : 'COMPLETED',
                target: audienceFilter === 'all' ? 'All Customers' :
                        audienceFilter === 'top' ? 'Top Performing' :
                        audienceFilter === 'inactive' ? 'Never Visited Last Month' : 'Custom Date Filter',
                templateName: selectedTemplate?.name || 'default_template',
                sentCount: eligibleCount,
                successCount: scheduleType === 'scheduled' ? 0 : eligibleCount,
                failedCount: 0,
                createdAt: new Date().toISOString(),
                scheduleTime: scheduleType === 'scheduled' ? scheduleDateTime : null
            };

            setCampaigns(prev => [newCampaign, ...prev]);
            setIsWizardOpen(false);
        } catch (error: any) {
            console.error('Launch campaign failed:', error);
            showToast(error.response?.data?.error || 'Failed to launch broadcast campaign', 'error');
        } finally {
            setIsSending(false);
        }
    };

    // Toggle customer selection
    const handleToggleCustomerSelection = (id: string) => {
        setSelectedCustomers(prev =>
            prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]
        );
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Header Tabs */}
            <div style={{
                display: 'flex',
                borderBottom: '1px solid var(--border-light)',
                gap: '2.5rem',
                margin: '-1rem 0 1rem'
            }}>
                <button
                    onClick={() => setActiveTab('automated')}
                    style={{
                        padding: '1rem 0.5rem',
                        fontSize: '1rem',
                        fontWeight: activeTab === 'automated' ? 700 : 500,
                        color: activeTab === 'automated' ? 'var(--primary)' : 'var(--text-black)',
                        border: 'none',
                        background: 'none',
                        borderBottom: activeTab === 'automated' ? '3.5px solid var(--primary)' : '3.5px solid transparent',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        outline: 'none'
                    }}
                >
                    Automated Logs
                </button>
                <button
                    onClick={() => setActiveTab('bulk')}
                    style={{
                        padding: '1rem 0.5rem',
                        fontSize: '1rem',
                        fontWeight: activeTab === 'bulk' ? 700 : 500,
                        color: activeTab === 'bulk' ? 'var(--primary)' : 'var(--text-black)',
                        border: 'none',
                        background: 'none',
                        borderBottom: activeTab === 'bulk' ? '3.5px solid var(--primary)' : '3.5px solid transparent',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        outline: 'none'
                    }}
                >
                    WhatsApp Broadcast Campaigns
                </button>
            </div>

            {activeTab === 'automated' ? (
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
                                    Refresh
                                </Button>
                                {activeFilter !== 'sent' && (
                                    <Button
                                        style={{
                                            background: activeFilter === 'failed' ? '#EF4444' : 'var(--primary)',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '0.75rem',
                                            padding: '0.625rem 1.25rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            boxShadow: activeFilter === 'failed' 
                                                ? '0 4px 12px rgba(239, 68, 68, 0.2)' 
                                                : '0 4px 12px rgba(99, 102, 241, 0.2)'
                                        }}
                                        onClick={() => handleResendAll(activeFilter === 'failed' ? 'FAILED' : 'PENDING')}
                                        disabled={
                                            activeFilter === 'failed' 
                                                ? stats.failed === 0 
                                                : stats.pending === 0
                                        }
                                        isLoading={isResendingAll}
                                    >
                                        <Send size={16} />
                                        {activeFilter === 'failed' ? 'Resend Failed' : 'Resend Pending'}
                                    </Button>
                                )}
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
                                    <div style={{ width: '6px', background: 'var(--border-light)' }} />
                                    <div style={{ flex: 1, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                                <Skeleton width="40px" height="40px" variant="circular" />
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                    <Skeleton width="160px" height="1.1rem" />
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <Skeleton width="100px" height="0.75rem" />
                                                        <Skeleton width="80px" height="0.75rem" />
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <Skeleton width="80px" height="2rem" style={{ borderRadius: '9999px' }} />
                                                <Skeleton width="90px" height="2rem" style={{ borderRadius: '9999px' }} />
                                            </div>
                                        </div>
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
                                                <div style={{
                                                    width: '6px',
                                                    background: msg.status === 'SENT' ? '#10B981' : msg.status === 'FAILED' ? '#EF4444' : '#F59E0B'
                                                }} />

                                                <div style={{ flex: 1, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                    {/* Bulk Campaign Stats */}
                    <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                        <KPICard title="Total Broadcasts" value={bulkStats.total.toLocaleString()} icon={Users} color="#4F46E5" loading={customersLoading} />
                        <KPICard title="Recipients Targeted" value={bulkStats.totalSent.toLocaleString()} icon={Send} color="#10B981" loading={customersLoading} />
                        <KPICard title="Success Rate" value={bulkStats.successRate} icon={CheckCircle2} color="#8B5CF6" loading={customersLoading} />
                        <KPICard title="Scheduled Tasks" value={bulkStats.scheduled.toLocaleString()} icon={Calendar} color="#F59E0B" loading={customersLoading} />
                    </div>

                    {/* Toolbar */}
                    <Card style={{ padding: '1rem 1.5rem', borderRadius: '1.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-dark)', margin: 0 }}>
                                    Campaign History Log
                                </h3>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', margin: '0.2rem 0 0' }}>
                                    View and manage WhatsApp bulk message broadcasts.
                                </p>
                            </div>
                            <Button
                                onClick={handleOpenWizard}
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
                            >
                                <Plus size={16} /> Create Campaign
                            </Button>
                        </div>
                    </Card>

                    {/* Broadcast Logs List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {campaigns.map((camp) => (
                            <div key={camp.id} style={{
                                display: 'flex',
                                background: 'white',
                                borderRadius: '1rem',
                                border: '1px solid var(--border-light)',
                                overflow: 'hidden',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                            }}>
                                <div style={{
                                    width: '6px',
                                    background: camp.status === 'COMPLETED' ? '#10B981' : camp.status === 'SCHEDULED' ? '#F59E0B' : '#6366F1'
                                }} />
                                <div style={{ flex: 1, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-dark)', margin: 0 }}>
                                                {camp.name}
                                            </h4>
                                            <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', margin: '0.2rem 0 0' }}>
                                                {camp.description || 'No description provided.'}
                                            </p>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <span style={{
                                                fontSize: '0.72rem',
                                                fontWeight: 800,
                                                padding: '0.35rem 0.75rem',
                                                borderRadius: '99px',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.025em',
                                                background: camp.status === 'COMPLETED' ? '#dcfce7' : '#fef3c7',
                                                color: camp.status === 'COMPLETED' ? '#15803d' : '#b45309',
                                                border: camp.status === 'COMPLETED' ? '1px solid #bbf7d0' : '1px solid #fde68a'
                                            }}>
                                                {camp.status}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (window.confirm("Are you sure you want to delete this campaign log?")) {
                                                        setCampaigns(prev => prev.filter(c => c.id !== camp.id));
                                                    }
                                                }}
                                                style={{
                                                    border: 'none', background: 'none', color: '#94a3b8',
                                                    cursor: 'pointer', padding: '0.25rem', display: 'flex'
                                                }}
                                                title="Delete Campaign"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                                        gap: '1rem',
                                        padding: '0.75rem 1rem',
                                        background: 'var(--bg-body)',
                                        borderRadius: '0.75rem',
                                        fontSize: '0.85rem'
                                    }}>
                                        <div>
                                            <span style={{ color: 'var(--text-light)', display: 'block', marginBottom: '0.15rem' }}>Audience Group</span>
                                            <span style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{camp.target}</span>
                                        </div>
                                        <div>
                                            <span style={{ color: 'var(--text-light)', display: 'block', marginBottom: '0.15rem' }}>WhatsApp Template</span>
                                            <span style={{ fontWeight: 600, color: 'var(--text-dark)', fontFamily: 'monospace' }}>{camp.templateName}</span>
                                        </div>
                                        <div>
                                            <span style={{ color: 'var(--text-light)', display: 'block', marginBottom: '0.15rem' }}>Recipients Stats</span>
                                            {camp.status === 'SCHEDULED' ? (
                                                <span style={{ fontWeight: 600, color: 'var(--text-dark)' }}>
                                                    {camp.sentCount} Targeted
                                                </span>
                                            ) : (
                                                <span style={{ fontWeight: 600, color: 'var(--text-dark)' }}>
                                                    Sent: {camp.sentCount} | <span style={{ color: '#10B981' }}>✓ {camp.successCount}</span>{camp.failedCount > 0 && <span style={{ color: '#EF4444' }}> | ✗ {camp.failedCount}</span>}
                                                </span>
                                            )}
                                        </div>
                                        <div>
                                            <span style={{ color: 'var(--text-light)', display: 'block', marginBottom: '0.15rem' }}>
                                                {camp.status === 'SCHEDULED' ? 'Scheduled Date' : 'Execution Time'}
                                            </span>
                                            <span style={{ fontWeight: 600, color: 'var(--text-dark)' }}>
                                                {camp.status === 'SCHEDULED'
                                                    ? new Date(camp.scheduleTime).toLocaleString()
                                                    : new Date(camp.createdAt).toLocaleString()
                                                }
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {campaigns.length === 0 && (
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
                                    <Users size={24} />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.25rem' }}>
                                        No campaigns found
                                    </h3>
                                    <p style={{ color: 'var(--text-black)', fontSize: '0.9rem' }}>
                                        Get started by launching your first Bulk WhatsApp broadcast!
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Campaign Wizard Modal */}
            <Modal
                isOpen={isWizardOpen}
                onClose={() => !isSending && setIsWizardOpen(false)}
                title="Create Bulk WhatsApp Broadcast"
                size="lg"
            >
                {isSending ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1.5rem', textAlign: 'center' }}>
                        <RefreshCw size={48} className="animate-spin text-primary" style={{ marginBottom: '1.5rem', animation: 'spin 1.5s linear infinite' }} />
                        <h4 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.5rem' }}>
                            Sending Broadcast Messages...
                        </h4>
                        <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', marginBottom: '2rem', maxWidth: '350px' }}>
                            We are broadcasting the messages to eligible numbers via Meta API. Please do not close this window.
                        </p>
                        
                        <div style={{ width: '100%', background: '#e2e8f0', height: '10px', borderRadius: '5px', overflow: 'hidden', marginBottom: '0.75rem' }}>
                            <div style={{ width: `${sendProgress}%`, background: 'var(--primary)', height: '100%', transition: 'width 0.15s ease' }} />
                        </div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-dark)' }}>
                            Progress: {sendProgress}% ({sendCurrentIndex} of {selectedCustomers.length} sent)
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {/* Progress Steps Header */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: 'var(--bg-body)',
                            padding: '0.75rem 1rem',
                            borderRadius: '0.75rem',
                            border: '1px solid var(--border-light)',
                            fontSize: '0.85rem'
                        }}>
                            {[
                                { step: 1, label: 'Details' },
                                { step: 2, label: 'Schedule' },
                                { step: 3, label: 'Audience' },
                                { step: 4, label: 'Validation' },
                                { step: 5, label: 'Template' },
                                { step: 6, label: 'Review' }
                            ].map((s) => (
                                <div key={s.step} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    color: wizardStep === s.step ? 'var(--primary)' : wizardStep > s.step ? '#10B981' : 'var(--text-light)',
                                    fontWeight: wizardStep === s.step ? 700 : 500
                                }}>
                                    <span style={{
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '50%',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '0.75rem',
                                        background: wizardStep === s.step ? 'var(--primary)' : wizardStep > s.step ? '#dcfce7' : '#e2e8f0',
                                        color: wizardStep === s.step ? 'white' : wizardStep > s.step ? '#15803d' : 'var(--text-light)',
                                        fontWeight: 700
                                    }}>
                                        {wizardStep > s.step ? '✓' : s.step}
                                    </span>
                                    <span className="hidden sm:inline">{s.label}</span>
                                </div>
                            ))}
                        </div>

                        {/* Step Contents */}
                        <div style={{ minHeight: '260px' }}>
                            {/* Step 1: Details */}
                            {wizardStep === 1 && (
                                <div className="space-y-4" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <Input
                                        label="Campaign Name"
                                        value={campaignName}
                                        onChange={(e) => setCampaignName(e.target.value)}
                                        placeholder="e.g. July Summer Discount Offer"
                                        required
                                    />
                                    <Input
                                        label="Campaign Description"
                                        value={campaignDesc}
                                        onChange={(e) => setCampaignDesc(e.target.value)}
                                        placeholder="Brief notes about this campaign context..."
                                    />
                                </div>
                            )}

                            {/* Step 2: Schedule */}
                            {wizardStep === 2 && (
                                <div className="space-y-4" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <label className="input-label">Select Schedule Type</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <button
                                            type="button"
                                            onClick={() => setScheduleType('now')}
                                            style={{
                                                padding: '1.25rem',
                                                borderRadius: '0.75rem',
                                                border: scheduleType === 'now' ? '2px solid var(--primary)' : '1px solid var(--border)',
                                                background: scheduleType === 'now' ? '#eef2ff' : 'white',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                textAlign: 'center'
                                            }}
                                        >
                                            <Send size={24} style={{ color: scheduleType === 'now' ? 'var(--primary)' : '#64748b' }} />
                                            <span style={{ fontWeight: 700, color: 'var(--text-dark)' }}>Send Immediately</span>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Broadcast messages to target audience now</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setScheduleType('scheduled')}
                                            style={{
                                                padding: '1.25rem',
                                                borderRadius: '0.75rem',
                                                border: scheduleType === 'scheduled' ? '2px solid var(--primary)' : '1px solid var(--border)',
                                                background: scheduleType === 'scheduled' ? '#eef2ff' : 'white',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                textAlign: 'center'
                                            }}
                                        >
                                            <Calendar size={24} style={{ color: scheduleType === 'scheduled' ? 'var(--primary)' : '#64748b' }} />
                                            <span style={{ fontWeight: 700, color: 'var(--text-dark)' }}>Schedule for Later</span>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Pick a specific date & time to launch</span>
                                        </button>
                                    </div>

                                    {scheduleType === 'scheduled' && (
                                        <div style={{ marginTop: '1rem' }}>
                                            <label className="input-label">Date & Time</label>
                                            <input
                                                type="datetime-local"
                                                value={scheduleDateTime}
                                                onChange={(e) => setScheduleDateTime(e.target.value)}
                                                style={{
                                                    width: '100%',
                                                    padding: '0.75rem',
                                                    borderRadius: '0.5rem',
                                                    border: '1px solid var(--border)',
                                                    fontSize: '0.875rem',
                                                    outline: 'none',
                                                    background: 'white',
                                                    marginTop: '0.25rem'
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Step 3: Audience */}
                            {wizardStep === 3 && (
                                <div className="space-y-4" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <label className="input-label">Select Target Filter Group</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                                        {[
                                            { id: 'all', label: 'All Customers', desc: 'Broadcast to everyone in contacts database' },
                                            { id: 'top', label: 'Top Performing', desc: 'Clients with spend > ₹5k or > 5 visits' },
                                            { id: 'inactive', label: 'Never Visited Last Month', desc: 'Inactive for over 30 days' },
                                            { id: 'custom_date', label: 'Custom Date Range', desc: 'Filter by their last visit date' }
                                        ].map((filter) => (
                                            <button
                                                key={filter.id}
                                                type="button"
                                                onClick={() => setAudienceFilter(filter.id as any)}
                                                style={{
                                                    padding: '1rem',
                                                    borderRadius: '0.75rem',
                                                    border: audienceFilter === filter.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                                                    background: audienceFilter === filter.id ? '#eef2ff' : 'white',
                                                    cursor: 'pointer',
                                                    textAlign: 'left',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '0.25rem'
                                                }}
                                            >
                                                <span style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.9rem' }}>{filter.label}</span>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{filter.desc}</span>
                                            </button>
                                        ))}
                                    </div>

                                    {audienceFilter === 'custom_date' && (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                                            <div>
                                                <label className="input-label">Start Date</label>
                                                <input
                                                    type="date"
                                                    value={startDate}
                                                    onChange={(e) => setStartDate(e.target.value)}
                                                    style={{
                                                        width: '100%', padding: '0.75rem', borderRadius: '0.5rem',
                                                        border: '1px solid var(--border)', fontSize: '0.875rem', outline: 'none'
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <label className="input-label">End Date</label>
                                                <input
                                                    type="date"
                                                    value={endDate}
                                                    onChange={(e) => setEndDate(e.target.value)}
                                                    style={{
                                                        width: '100%', padding: '0.75rem', borderRadius: '0.5rem',
                                                        border: '1px solid var(--border)', fontSize: '0.875rem', outline: 'none'
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Preview banner */}
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        padding: '1rem',
                                        borderRadius: '0.75rem',
                                        background: '#f0fdf4',
                                        color: '#166534',
                                        border: '1px solid #bbf7d0',
                                        fontSize: '0.9rem',
                                        fontWeight: 600
                                    }}>
                                        <Users size={20} />
                                        This selection currently matches {filteredCustomers.length} customer(s).
                                    </div>
                                </div>
                            )}

                            {/* Step 4: Validation */}
                            {wizardStep === 4 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {/* Header stats */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', textAlign: 'center' }}>
                                        <div style={{ background: 'var(--bg-body)', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)' }}>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Total Selected</span>
                                            <span style={{ display: 'block', fontSize: '1.25rem', fontWeight: 700 }}>{filteredCustomers.length}</span>
                                        </div>
                                        <div style={{ background: '#ecfdf5', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #a7f3d0', color: '#065f46' }}>
                                            <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>Eligible Numbers</span>
                                            <span style={{ display: 'block', fontSize: '1.25rem', fontWeight: 700 }}>{eligibleCustomers.length}</span>
                                        </div>
                                        <div style={{ background: '#fef2f2', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #fecaca', color: '#991b1b' }}>
                                            <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>Invalid Format</span>
                                            <span style={{ display: 'block', fontSize: '1.25rem', fontWeight: 700 }}>{excludedCustomers.length}</span>
                                        </div>
                                    </div>

                                    {/* Tab switcher */}
                                    <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light)', gap: '1.5rem', marginTop: '0.5rem' }}>
                                        <button
                                            type="button"
                                            onClick={() => setValidationTab('eligible')}
                                            style={{
                                                padding: '0.5rem', border: 'none', background: 'none',
                                                borderBottom: validationTab === 'eligible' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
                                                color: validationTab === 'eligible' ? 'var(--primary)' : 'var(--text-light)',
                                                fontWeight: validationTab === 'eligible' ? 700 : 500, cursor: 'pointer'
                                            }}
                                        >
                                            Eligible List ({eligibleCustomers.length})
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setValidationTab('excluded')}
                                            style={{
                                                padding: '0.5rem', border: 'none', background: 'none',
                                                borderBottom: validationTab === 'excluded' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
                                                color: validationTab === 'excluded' ? 'var(--primary)' : 'var(--text-light)',
                                                fontWeight: validationTab === 'excluded' ? 700 : 500, cursor: 'pointer'
                                            }}
                                        >
                                            Excluded List ({excludedCustomers.length})
                                        </button>
                                    </div>

                                    {/* List view */}
                                    <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-light)', borderRadius: '0.5rem', padding: '0.5rem' }}>
                                        {validationTab === 'eligible' ? (
                                            eligibleCustomers.length === 0 ? (
                                                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-light)', fontSize: '0.85rem' }}>No eligible customers found.</div>
                                            ) : (
                                                eligibleCustomers.map(c => {
                                                    const isEditing = editingCustomerId === String(c.id);
                                                    return (
                                                        <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                                                            {isEditing ? (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '80%' }}>
                                                                    <input
                                                                        type="text"
                                                                        value={editNameValue}
                                                                        onChange={(e) => setEditNameValue(e.target.value)}
                                                                        placeholder="Name"
                                                                        style={{ padding: '0.25rem 0.5rem', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '0.8rem', width: '40%' }}
                                                                    />
                                                                    <input
                                                                        type="text"
                                                                        value={editPhoneValue}
                                                                        onChange={(e) => setEditPhoneValue(e.target.value)}
                                                                        placeholder="Phone"
                                                                        style={{ padding: '0.25rem 0.5rem', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '0.8rem', width: '50%' }}
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleSaveCustomerDetails(String(c.id), c)}
                                                                        disabled={isSavingCustomer}
                                                                        style={{ border: 'none', background: '#dcfce7', color: '#15803d', padding: '0.25rem', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                                        title="Save Changes"
                                                                    >
                                                                        <Check size={14} />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={handleCancelEditCustomer}
                                                                        style={{ border: 'none', background: '#fef2f2', color: '#b91c1c', padding: '0.25rem', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                                        title="Cancel"
                                                                    >
                                                                        <X size={14} />
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '80%' }}>
                                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={selectedCustomers.includes(String(c.id))}
                                                                            onChange={() => handleToggleCustomerSelection(String(c.id))}
                                                                            style={{ width: '15px', height: '15px' }}
                                                                        />
                                                                        <span style={{ fontWeight: 600 }}>{c.name}</span>
                                                                        <span style={{ color: 'var(--text-light)' }}>({c.phone})</span>
                                                                    </label>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleStartEditCustomer(String(c.id), c.name, c.phone)}
                                                                        style={{ border: 'none', background: 'none', color: 'var(--text-light)', cursor: 'pointer', padding: '0.2rem', display: 'flex', alignItems: 'center' }}
                                                                        title="Edit Details"
                                                                    >
                                                                        <Edit size={13} />
                                                                    </button>
                                                                </div>
                                                            )}
                                                            {!isEditing && (
                                                                <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '4px', background: '#dcfce7', color: '#15803d', fontWeight: 600 }}>Eligible</span>
                                                            )}
                                                        </div>
                                                    );
                                                })
                                            )
                                        ) : (
                                            excludedCustomers.length === 0 ? (
                                                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-light)', fontSize: '0.85rem' }}>No excluded customers found.</div>
                                            ) : (
                                                excludedCustomers.map(c => {
                                                    const isEditing = editingCustomerId === String(c.id);
                                                    return (
                                                        <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.5rem', borderBottom: '1px solid #f1f5f9', opacity: isEditing ? 1 : 0.85 }}>
                                                            {isEditing ? (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '80%' }}>
                                                                    <input
                                                                        type="text"
                                                                        value={editNameValue}
                                                                        onChange={(e) => setEditNameValue(e.target.value)}
                                                                        placeholder="Name"
                                                                        style={{ padding: '0.25rem 0.5rem', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '0.8rem', width: '40%' }}
                                                                    />
                                                                    <input
                                                                        type="text"
                                                                        value={editPhoneValue}
                                                                        onChange={(e) => setEditPhoneValue(e.target.value)}
                                                                        placeholder="Phone"
                                                                        style={{ padding: '0.25rem 0.5rem', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '0.8rem', width: '50%' }}
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleSaveCustomerDetails(String(c.id), c)}
                                                                        disabled={isSavingCustomer}
                                                                        style={{ border: 'none', background: '#dcfce7', color: '#15803d', padding: '0.25rem', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                                        title="Save Changes"
                                                                    >
                                                                        <Check size={14} />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={handleCancelEditCustomer}
                                                                        style={{ border: 'none', background: '#fef2f2', color: '#b91c1c', padding: '0.25rem', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                                        title="Cancel"
                                                                    >
                                                                        <X size={14} />
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '80%' }}>
                                                                    <input type="checkbox" disabled style={{ width: '15px', height: '15px' }} />
                                                                    <span style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{c.name}</span>
                                                                    <span style={{ color: '#ef4444' }}>({c.phone || 'No phone number'})</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleStartEditCustomer(String(c.id), c.name, c.phone)}
                                                                        style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.2rem', display: 'flex', alignItems: 'center' }}
                                                                        title="Fix Details"
                                                                    >
                                                                        <Edit size={13} />
                                                                    </button>
                                                                </div>
                                                            )}
                                                            {!isEditing && (
                                                                <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '4px', background: '#fef2f2', color: '#b91c1c', fontWeight: 600 }}>Invalid Format</span>
                                                            )}
                                                        </div>
                                                    );
                                                })
                                            )
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Step 5: Template */}
                            {wizardStep === 5 && (
                                <div className="space-y-4" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div>
                                        <label className="input-label">Select Message Template</label>
                                        <select
                                            value={selectedTemplateId}
                                            onChange={(e) => setSelectedTemplateId(e.target.value)}
                                            style={{
                                                width: '100%', padding: '0.75rem', borderRadius: '0.5rem',
                                                border: '1px solid var(--border)', fontSize: '0.875rem',
                                                outline: 'none', background: 'white', marginTop: '0.25rem'
                                            }}
                                        >
                                            {allTemplates.map(t => (
                                                <option key={t.id} value={t.id}>{t.name} ({t.language})</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Preview Customer Dropdown */}
                                    {selectedCustomers.length > 0 && (
                                        <div>
                                            <label className="input-label" style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-dark)', display: 'block', marginTop: '0.5rem', marginBottom: '0.25rem' }}>Preview Message For Customer</label>
                                            <select
                                                value={previewCustomerId}
                                                onChange={(e) => setPreviewCustomerId(e.target.value)}
                                                style={{
                                                    width: '100%', padding: '0.65rem 0.75rem', borderRadius: '0.5rem',
                                                    border: '1px solid var(--border)', fontSize: '0.875rem',
                                                    outline: 'none', background: 'white', marginTop: '0.25rem'
                                                }}
                                            >
                                                {selectedCustomers.map(id => {
                                                    const c = customers.find(cust => String(cust.id) === id);
                                                    return c ? <option key={c.id} value={c.id}>{c.name} ({c.phone})</option> : null;
                                                })}
                                            </select>
                                        </div>
                                    )}

                                    {/* Template Preview Box */}
                                    <div style={{ marginTop: '0.5rem' }}>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-light)', display: 'block', marginBottom: '0.35rem' }}>Template Preview (WhatsApp Format)</span>
                                        <div style={{
                                            background: '#dcf8c6',
                                            padding: '1rem 1.25rem',
                                            borderRadius: '0.75rem',
                                            borderTopLeftRadius: '0',
                                            border: '1px solid #c7e5ae',
                                            fontSize: '0.9rem',
                                            color: '#303030',
                                            position: 'relative',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                                            whiteSpace: 'pre-wrap'
                                        }}>
                                            <div style={{ position: 'absolute', top: '0', left: '-8px', width: '0', height: '0', borderTop: '10px solid #dcf8c6', borderLeft: '10px solid transparent' }} />
                                            {(() => {
                                                const currentTemplate = allTemplates.find(t => t.id === selectedTemplateId) || allTemplates[0];
                                                const targetCust = customers.find(cust => String(cust.id) === previewCustomerId) || customers[0] || { name: 'Client' };
                                                const customerName = targetCust.name || 'Client';
                                                const salonName = settings?.salonName || 'our Salon';

                                                let rawText = '';
                                                if (currentTemplate?.id === 'sys_promo') {
                                                    rawText = 'Hey {customer_name}! Get 15% off on your next services. Use code PROMO15.';
                                                } else if (currentTemplate?.id === 'sys_miss_you') {
                                                    rawText = 'Hi {customer_name}, we miss you! Book your next pampering session today and enjoy 10% off.';
                                                } else {
                                                    rawText = currentTemplate?.description || '';
                                                }

                                                // Perform substitutions
                                                let previewText = rawText || '';
                                                const vars: Record<string, string> = {
                                                    customer_name: customerName,
                                                    name: customerName,
                                                    customer: customerName,
                                                    salon_name: salonName,
                                                    salon: salonName,
                                                    date: new Date().toLocaleDateString()
                                                };
                                                for (const [key, value] of Object.entries(vars)) {
                                                    const regex = new RegExp(`\\{?\\{${key}\\}\\}?`, 'g');
                                                    previewText = previewText.replace(regex, value);
                                                }

                                                if (!rawText && currentTemplate) {
                                                    return `[Meta Broadcast Template: ${currentTemplate.name}]\n\nHello ${customerName},\nYour custom configured marketing message content will be sent as approved on your Meta Dashboard.`;
                                                }

                                                return previewText;
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Step 6: Review */}
                            {wizardStep === 6 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <h5 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-dark)', margin: 0 }}>Review Broadcast Campaign Summary</h5>
                                    
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: '1fr',
                                        gap: '0.75rem',
                                        background: 'var(--bg-body)',
                                        padding: '1rem',
                                        borderRadius: '0.75rem',
                                        border: '1px solid var(--border-light)',
                                        fontSize: '0.85rem'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                                            <span style={{ color: 'var(--text-light)' }}>Campaign Name</span>
                                            <span style={{ fontWeight: 700, color: 'var(--text-dark)' }}>{campaignName || 'Unnamed Campaign'}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                                            <span style={{ color: 'var(--text-light)' }}>Schedule Time</span>
                                            <span style={{ fontWeight: 700, color: 'var(--text-dark)' }}>
                                                {scheduleType === 'now' ? 'Send Immediately' : `Scheduled: ${new Date(scheduleDateTime).toLocaleString()}`}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                                            <span style={{ color: 'var(--text-light)' }}>Target Filters</span>
                                            <span style={{ fontWeight: 700, color: 'var(--text-dark)' }}>
                                                {audienceFilter === 'all' ? 'All Customers' :
                                                 audienceFilter === 'top' ? 'Top Performing' :
                                                 audienceFilter === 'inactive' ? 'Never Visited Last Month' : 'Custom Date Filter'}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                                            <span style={{ color: 'var(--text-light)' }}>WhatsApp Template</span>
                                            <span style={{ fontWeight: 700, color: 'var(--text-dark)', fontFamily: 'monospace' }}>
                                                {(allTemplates.find(t => t.id === selectedTemplateId) || allTemplates[0])?.name}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#166534', fontWeight: 700 }}>
                                            <span>Eligible Recipients</span>
                                            <span>{selectedCustomers.length} Customer(s)</span>
                                        </div>
                                    </div>

                                    {selectedCustomers.length === 0 && (
                                        <div style={{
                                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                                            padding: '0.75rem', borderRadius: '0.5rem', background: '#fef2f2',
                                            border: '1px solid #fecaca', color: '#991b1b', fontSize: '0.8rem'
                                        }}>
                                            <AlertTriangle size={16} />
                                            Warning: You have 0 eligible recipients selected. Please go back and select recipients.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer Controls */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            borderTop: '1px solid var(--border-light)',
                            paddingTop: '1rem',
                            marginTop: '0.5rem'
                        }}>
                            <Button
                                variant="outline"
                                onClick={() => wizardStep > 1 && setWizardStep(wizardStep - 1)}
                                style={{ visibility: wizardStep === 1 ? 'hidden' : 'visible', borderRadius: '0.75rem' }}
                            >
                                Back
                            </Button>
                            
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <Button
                                    variant="outline"
                                    onClick={() => setIsWizardOpen(false)}
                                    style={{ borderRadius: '0.75rem' }}
                                >
                                    Cancel
                                </Button>
                                
                                {wizardStep < 6 ? (
                                    <Button
                                        onClick={() => {
                                            if (wizardStep === 1 && !campaignName.trim()) {
                                                alert("Campaign Name is required.");
                                                return;
                                            }
                                            if (wizardStep === 2 && scheduleType === 'scheduled' && !scheduleDateTime) {
                                                alert("Please choose a schedule date and time.");
                                                return;
                                            }
                                            setWizardStep(wizardStep + 1);
                                        }}
                                        style={{
                                            background: 'var(--primary)',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '0.75rem',
                                            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.25rem'
                                        }}
                                    >
                                        Next <ChevronRight size={16} />
                                    </Button>
                                ) : (
                                    <Button
                                        onClick={handleLaunchCampaign}
                                        disabled={selectedCustomers.length === 0}
                                        style={{
                                            background: '#10B981',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '0.75rem',
                                            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.25rem'
                                        }}
                                    >
                                        {scheduleType === 'now' ? 'Launch Campaign' : 'Schedule Campaign'}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Confirmation Modal (automated resend) */}
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
        </div>
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
