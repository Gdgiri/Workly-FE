import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../redux/store';
import { fetchMessages, resendMessage } from '../redux/slices/messageSlice';
import { fetchCustomers } from '../redux/slices/customerSlice';
import { fetchSettings } from '../redux/slices/settingSlice';
import { useCurrency } from '../components/CurrencyContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    RefreshCw, Send, CheckCircle2, Clock, AlertTriangle,
    Phone, ArrowRight, MessageSquare, Search, ChevronRight, X, QrCode
} from 'lucide-react';
import { Button, Card, KPICard, Modal, Skeleton, Input } from '../components/UI';
import { useToast } from '../components/ToastContext';
import api from '../utils/api';

const PersonalLog: React.FC = () => {
    const { formatPrice } = useCurrency();
    const { showToast } = useToast();
    const dispatch = useDispatch<AppDispatch>();

    // Search and filter states
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState<'all' | 'sent' | 'pending' | 'failed'>('all');
    const [confirmModal, setConfirmModal] = useState<{ id: string | number; message?: any } | null>(null);
    const [resendingId, setResendingId] = useState<string | number | null>(null);

    // WA-Personal Config state
    const [personalTemplateName, setPersonalTemplateName] = useState('');
    const [personalTemplateMessage, setPersonalTemplateMessage] = useState('');
    const [activeConfigTab, setActiveConfigTab] = useState<'device' | 'template'>('device');
    const [isRefreshingQr, setIsRefreshingQr] = useState(false);
    const [qrCodeData, setQrCodeData] = useState('');
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [newTemplateMessage, setNewTemplateMessage] = useState('');
    const [editingTemplateIndex, setEditingTemplateIndex] = useState<number | null>(null);
    const [templates, setTemplates] = useState<{ name: string, message: string }[]>([]);
    const [isDeviceLinked, setIsDeviceLinked] = useState(false);
    const [isLinking, setIsLinking] = useState(false);
    const [backendStatus, setBackendStatus] = useState<string>('DISCONNECTED');
    const [isSavingConfig, setIsSavingConfig] = useState(false);
    const hasLinkedRef = React.useRef(false);

    // Polling logic for WhatsApp Status
    useEffect(() => {
        if (activeConfigTab !== 'device' || isDeviceLinked) return;

        const checkStatus = async () => {
            try {
                const response = await api.get('/personal-whatsapp/status');
                const data = response.data;
                setBackendStatus(data.status);

                if (data.status === 'CONNECTED') {
                    if (!isDeviceLinked && !hasLinkedRef.current) {
                        hasLinkedRef.current = true;
                        setIsLinking(false);
                        setIsDeviceLinked(true);
                        showToast('WhatsApp Device Linked Successfully!', 'success');
                    }
                } else if (data.status === 'CONNECTING') {
                    setIsLinking(true);
                } else if (data.status === 'FAILED') {
                    setIsLinking(false);
                } else if (data.status === 'QR_EXPIRED') {
                    setIsLinking(false);
                } else if (data.status === 'DISCONNECTED') {
                    setIsLinking(false);
                    setIsDeviceLinked(false);
                    hasLinkedRef.current = false;
                } else if (data.status === 'QR_READY') {
                    setIsLinking(false);
                    if (data.qrCodeData && data.qrCodeData !== qrCodeData) {
                        setQrCodeData(data.qrCodeData);
                    }
                }
            } catch (err) {
                console.error('Error checking WhatsApp status', err);
            } 
        };

        // Check immediately
        checkStatus();

        // Then poll every 3 seconds
        const interval = setInterval(checkStatus, 3000);
        return () => clearInterval(interval);
    }, [activeConfigTab, isDeviceLinked, qrCodeData, showToast]);

    const handleRefreshQR = async () => {
        setIsRefreshingQr(true);
        try {
            const response = await api.get('/personal-whatsapp/qr');
            if (response.data.qrCodeData) {
                setQrCodeData(response.data.qrCodeData);
                showToast('QR Code Refreshed!', 'success');
            }
        } catch (err) {
            console.error('Failed to refresh QR', err);
            showToast('Failed to refresh QR code', 'error');
        } finally {
            setIsRefreshingQr(false);
        }
    };

    const handleDisconnect = async () => {
        try {
            await api.post('/personal-whatsapp/unlink');
            setIsDeviceLinked(false);
            hasLinkedRef.current = false;
            setQrCodeData('');
            showToast('Device Disconnected', 'info');
        } catch (err) {
            console.error('Failed to disconnect', err);
            showToast('Failed to disconnect device', 'error');
        }
    };

    const handleSaveConfiguration = async () => {
        if (activeConfigTab === 'template') {
            setIsSavingConfig(true);
            try {
                await api.post('/personal-whatsapp/templates', { templates });
                showToast('Configuration saved successfully!', 'success');
            } catch (err) {
                console.error('Failed to save templates', err);
                showToast('Failed to save configuration', 'error');
            } finally {
                setIsSavingConfig(false);
            }
        } else {
            showToast('Configuration saved successfully!', 'success');
        }
    };

    // Redux selectors
    const { messages, loading: messagesLoading } = useSelector((state: RootState) => state.messages);
    const { customers, loading: customersLoading } = useSelector((state: RootState) => state.customers);
    const { settings, loading: settingsLoading } = useSelector((state: RootState) => state.settings);

    const loading = messagesLoading || customersLoading || settingsLoading;

    useEffect(() => {
        dispatch(fetchMessages());
        dispatch(fetchCustomers());
        dispatch(fetchSettings());
    }, [dispatch]);

    useEffect(() => {
        const fetchTemplates = async () => {
            try {
                const response = await api.get('/personal-whatsapp/templates');
                if (response.data.success) {
                    setTemplates(response.data.templates || []);
                }
            } catch (err) {
                console.error('Failed to fetch templates', err);
            }
        };
        fetchTemplates();
    }, []);

    const handleRefresh = () => {
        dispatch(fetchMessages());
        showToast('Refreshing personal logs...', 'info');
    };

    const handleResendClick = (id: string | number, e: React.MouseEvent) => {
        e.stopPropagation();
        const msg = messages.find(m => m.id === id);
        setConfirmModal({ id, message: msg });
    };

    const executeResend = async () => {
        if (!confirmModal) return;
        setResendingId(confirmModal.id);
        try {
            await dispatch(resendMessage(confirmModal.id)).unwrap();
            showToast('Message resent successfully!', 'success');
            dispatch(fetchMessages());
            setConfirmModal(null);
        } catch (error: any) {
            console.error('Failed to resend message:', error);
            showToast(error.message || 'Failed to resend message', 'error');
        } finally {
            setResendingId(null);
        }
    };

    // Calculate stats based on messages
    const stats = React.useMemo(() => {
        return {
            total: messages.length,
            sent: messages.filter((m: any) => m.status === 'SENT').length,
            pending: messages.filter((m: any) => m.status === 'PENDING').length,
            failed: messages.filter((m: any) => m.status === 'FAILED').length
        };
    }, [messages]);

    // Filter and search messages
    const filteredMessages = React.useMemo(() => {
        return messages.filter(msg => {
            // Filter by status
            if (activeFilter === 'sent' && msg.status !== 'SENT') return false;
            if (activeFilter === 'pending' && msg.status !== 'PENDING') return false;
            if (activeFilter === 'failed' && msg.status !== 'FAILED') return false;

            // Filter by search term (phone or customer name if matching phone)
            if (searchTerm.trim() !== '') {
                const searchLower = searchTerm.toLowerCase();
                const phone = msg.customerPhone || '';
                const content = msg.content || '';

                // Find matching customer name
                const customer = customers.find(c => c.phone === msg.customerPhone);
                const customerName = customer ? customer.name.toLowerCase() : '';

                return (
                    phone.includes(searchLower) ||
                    content.toLowerCase().includes(searchLower) ||
                    customerName.includes(searchLower)
                );
            }

            return true;
        });
    }, [messages, activeFilter, searchTerm, customers]);

    // Format date beautifully
    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString);
            return date.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return dateString;
        }
    };

    // Find customer by phone
    const getCustomerName = (phone: string) => {
        const customer = customers.find(c => c.phone === phone);
        return customer ? customer.name : 'Unknown Customer';
    };

    // Render variables like [Var] or {{Var}} in bold
    const renderBoldVariables = (text: string) => {
        if (!text) return null;
        const parts = text.split(/(\[.*?\]|\{\{.*?\}\})/g);
        return parts.map((part, index) => {
            if ((part.startsWith('[') && part.endsWith(']')) || (part.startsWith('{{') && part.endsWith('}}'))) {
                return <strong key={index} style={{ fontWeight: 600, color: '#111827' }}>{part}</strong>;
            }
            return <React.Fragment key={index}>{part}</React.Fragment>;
        });
    };

    return (
        <div style={{ padding: '1.5rem', maxWidth: '1600px', margin: '0 auto' }} className="space-y-6">
            {/* Header section */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <Button
                    variant="outline"
                    onClick={handleRefresh}
                    disabled={loading}
                    icon={<RefreshCw size={16} className={loading ? 'animate-spin' : ''} />}
                >
                    Refresh Logs
                </Button>
            </div>

            {/* WA-Personal Configuration Panel */}
            <Card title="WA-Personal Configuration" icon={<Phone size={20} />}>
                <div style={{ display: 'flex', background: '#f1f5f9', padding: '0.25rem', borderRadius: '0.5rem', gap: '0.25rem', marginBottom: '1.5rem', width: 'fit-content' }}>
                    <button
                        onClick={() => setActiveConfigTab('device')}
                        style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: 500, border: 'none', background: activeConfigTab === 'device' ? '#ffffff' : 'transparent', color: activeConfigTab === 'device' ? 'var(--text-dark)' : 'var(--text-light)', boxShadow: activeConfigTab === 'device' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                        Device Link (QR Scan)
                    </button>
                    <button
                        onClick={() => setActiveConfigTab('template')}
                        style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: 500, border: 'none', background: activeConfigTab === 'template' ? '#ffffff' : 'transparent', color: activeConfigTab === 'template' ? 'var(--text-dark)' : 'var(--text-light)', boxShadow: activeConfigTab === 'template' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                        Template Configuration
                    </button>
                </div>

                <div>
                    {activeConfigTab === 'device' ? (
                        <div className="max-w-md mx-auto">
                            <h5 className="font-medium text-sm text-gray-700">Link your WhatsApp Device</h5>
                            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col p-6">
                                {isDeviceLinked ? (
                                    <div className="flex flex-col items-center justify-center py-6">
                                        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-5 shadow-sm">
                                            <CheckCircle2 size={40} />
                                        </div>
                                        <h3 className="text-xl font-semibold text-gray-800 mb-2">✓ Connected</h3>
                                        <p className="text-gray-500 mb-8 text-center text-sm px-4">Your WhatsApp account is connected and ready to send automated messages.</p>
                                        <button
                                            onClick={handleDisconnect}
                                            style={{
                                                backgroundColor: '#dc2626',
                                                color: '#ffffff',
                                                padding: '0.625rem 1.5rem',
                                                borderRadius: '0.5rem',
                                                fontSize: '0.875rem',
                                                fontWeight: 500,
                                                border: 'none',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                                                transition: 'background-color 0.2s'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                                        >
                                            <X size={16} /> Disconnect Device
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-center justify-center gap-2 mb-6 text-[#1a56db]" style={{ marginBottom: '2.5rem' }}>
                                            <QrCode size={20} className="text-[#1a56db]" />
                                            <span className="text-lg font-semibold text-[#0f172a]">
                                                {backendStatus === 'DISCONNECTED' ? 'Scan to Connect' : 'Scan to Connect'}
                                            </span>
                                        </div>

                                        <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'center', position: 'relative' }}>
                                            <img
                                                src={qrCodeData || '/Whatsappimage.jpeg'}
                                                alt="WhatsApp Device QR Code"
                                                style={{
                                                    width: '14rem',
                                                    height: '14rem',
                                                    objectFit: 'contain',
                                                    transition: 'all 0.3s ease',
                                                    opacity: (isRefreshingQr || backendStatus === 'INITIALIZING' || backendStatus === 'CONNECTING' || backendStatus === 'FAILED' || backendStatus === 'QR_EXPIRED') ? 0.3 : 1,
                                                    filter: (isRefreshingQr || backendStatus === 'INITIALIZING' || backendStatus === 'CONNECTING' || backendStatus === 'FAILED' || backendStatus === 'QR_EXPIRED') ? 'blur(2px)' : 'none'
                                                }}
                                            />
                                            {backendStatus === 'INITIALIZING' && (
                                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                                                    <RefreshCw size={32} className="animate-spin" style={{ color: '#1a56db', marginBottom: '0.5rem' }} />
                                                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#1a56db', backgroundColor: 'rgba(255, 255, 255, 0.9)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>Generating QR Code...</span>
                                                </div>
                                            )}
                                            {backendStatus === 'CONNECTING' && (
                                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                                                    <RefreshCw size={32} className="animate-spin" style={{ color: '#1a56db', marginBottom: '0.5rem' }} />
                                                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#1a56db', backgroundColor: 'rgba(255, 255, 255, 0.9)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>Connecting...</span>
                                                </div>
                                            )}
                                            {backendStatus === 'FAILED' && (
                                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                                                    <AlertTriangle size={32} style={{ color: '#ef4444', marginBottom: '0.5rem' }} />
                                                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#dc2626', backgroundColor: 'rgba(255, 255, 255, 0.9)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', textAlign: 'center' }}>
                                                        Connection failed.<br />Please scan the QR code again.
                                                    </span>
                                                </div>
                                            )}
                                            {backendStatus === 'QR_EXPIRED' && (
                                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '0.25rem' }}>
                                                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#dc2626', marginBottom: '0.75rem' }}>QR code expired.</span>
                                                    <button
                                                        type="button"
                                                        onClick={handleRefreshQR}
                                                        disabled={isRefreshingQr}
                                                        style={{
                                                            backgroundColor: '#1a56db',
                                                            color: '#ffffff',
                                                            padding: '0.5rem 1rem',
                                                            borderRadius: '0.5rem',
                                                            fontSize: '0.875rem',
                                                            fontWeight: 500,
                                                            border: 'none',
                                                            cursor: isRefreshingQr ? 'not-allowed' : 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.5rem',
                                                            transition: 'background-color 0.2s',
                                                            opacity: isRefreshingQr ? 0.7 : 1
                                                        }}
                                                        onMouseEnter={(e) => !isRefreshingQr && (e.currentTarget.style.backgroundColor = '#1e40af')}
                                                        onMouseLeave={(e) => !isRefreshingQr && (e.currentTarget.style.backgroundColor = '#1a56db')}
                                                    >
                                                        <RefreshCw size={16} className={isRefreshingQr ? 'animate-spin' : ''} />
                                                        {isRefreshingQr ? 'Refreshing...' : 'Refresh QR Code'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="text-center space-y-1.5 mb-6">
                                            <p className="text-[#64748b] text-[15px]">Open WhatsApp on your phone</p>
                                            <p className="text-[#64748b] text-[13px]">Settings &rarr; Linked Devices &rarr; Link a Device</p>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
                                            <button
                                                type="button"
                                                onClick={handleRefreshQR}
                                                disabled={isRefreshingQr || backendStatus === 'INITIALIZING'}
                                                style={{
                                                    backgroundColor: '#1a56db',
                                                    color: '#ffffff',
                                                    padding: '0.625rem 1.5rem',
                                                    borderRadius: '0.5rem',
                                                    fontSize: '0.875rem',
                                                    fontWeight: 500,
                                                    border: 'none',
                                                    cursor: (isRefreshingQr || backendStatus === 'INITIALIZING') ? 'not-allowed' : 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.5rem',
                                                    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                                                    transition: 'background-color 0.2s',
                                                    opacity: (isRefreshingQr || backendStatus === 'INITIALIZING') ? 0.7 : 1
                                                }}
                                                onMouseEnter={(e) => !(isRefreshingQr || backendStatus === 'INITIALIZING') && (e.currentTarget.style.backgroundColor = '#1e40af')}
                                                onMouseLeave={(e) => !(isRefreshingQr || backendStatus === 'INITIALIZING') && (e.currentTarget.style.backgroundColor = '#1a56db')}
                                            >
                                                <RefreshCw size={16} className={(isRefreshingQr || backendStatus === 'INITIALIZING') ? 'animate-spin' : ''} />
                                                {(isRefreshingQr || backendStatus === 'INITIALIZING') ? 'Generating...' : 'Refresh QR Code'}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 max-w-md">
                            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '1rem' }}>
                                {/* <h5 style={{ margin: 0, fontWeight: 500, fontSize: '0.875rem', color: '#374151' }}>Configure Default Message Template</h5> */}
                                <button
                                    type="button"
                                    style={{
                                        padding: '0.375rem 0.75rem',
                                        backgroundColor: '#10B981',
                                        color: '#ffffff',
                                        borderRadius: '0.375rem',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        border: 'none',
                                        cursor: 'pointer',
                                        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                                    }}
                                    onClick={() => {
                                        setEditingTemplateIndex(null);
                                        setNewTemplateName('');
                                        setNewTemplateMessage('');
                                        setIsTemplateModalOpen(true);
                                    }}
                                >
                                    + New Template
                                </button>
                            </div>

                            <div className="space-y-3 mt-4 w-full">
                                {templates.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280', background: '#f9fafb', borderRadius: '0.5rem', border: '1px dashed #d1d5db', fontSize: '0.875rem' }}>
                                        No templates created yet. Click "+ New Template" to add one.
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {templates.map((tpl, idx) => (
                                            <div 
                                                key={idx} 
                                                onClick={() => {
                                                    setEditingTemplateIndex(idx);
                                                    setNewTemplateName(tpl.name);
                                                    setNewTemplateMessage(tpl.message);
                                                    setIsTemplateModalOpen(true);
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                                    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                    e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
                                                }}
                                                style={{ padding: '1rem', background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '0.5rem', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', cursor: 'pointer', transition: 'all 0.2s' }}
                                            >
                                                <h6 style={{ margin: '0 0 0.25rem 0', fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>{tpl.name}</h6>
                                                <p style={{ margin: 0, fontSize: '0.8125rem', color: '#4b5563', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                    {renderBoldVariables(tpl.message)}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex justify-end" style={{ marginTop: '2.5rem' }}>
                    <Button onClick={handleSaveConfiguration} isLoading={isSavingConfig}>Save Configuration</Button>
                </div>
            </Card>

            {/* Resend Confirmation Modal */}
            <AnimatePresence>
                {confirmModal && (
                    <Modal
                        isOpen={!!confirmModal}
                        onClose={() => setConfirmModal(null)}
                        title="Resend WhatsApp Message"
                    >
                        <div className="space-y-4">
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-dark)', margin: 0 }}>
                                Are you sure you want to resend this message to <strong>{getCustomerName(confirmModal.message?.customerPhone)}</strong> ({confirmModal.message?.customerPhone})?
                            </p>

                            <div style={{
                                padding: '1rem',
                                background: '#f8fafc',
                                border: '1px solid var(--border)',
                                borderRadius: '0.5rem',
                                fontSize: '0.875rem',
                                color: 'var(--text-dark)',
                                fontStyle: 'italic',
                                maxHeight: '150px',
                                overflowY: 'auto'
                            }}>
                                "{confirmModal.message?.content}"
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
                                <Button
                                    variant="outline"
                                    onClick={() => setConfirmModal(null)}
                                    disabled={resendingId === confirmModal.id}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={executeResend}
                                    isLoading={resendingId === confirmModal.id}
                                    icon={<Send size={16} />}
                                >
                                    Send Now
                                </Button>
                            </div>
                        </div>
                    </Modal>
                )}

                {/* Add New Template Modal */}
                {isTemplateModalOpen && (
                    <Modal
                        isOpen={isTemplateModalOpen}
                        onClose={() => setIsTemplateModalOpen(false)}
                        title="Add New Template"
                    >
                        <div className="space-y-4">
                            <Input
                                label="Template Name"
                                value={newTemplateName}
                                onChange={(e) => setNewTemplateName(e.target.value)}
                                placeholder="e.g. promo_message"
                            />
                            <div>
                                <label className="input-label mb-1 block text-sm font-medium text-gray-700">Template Message</label>
                                <textarea
                                    value={newTemplateMessage}
                                    onChange={(e) => setNewTemplateMessage(e.target.value)}
                                    placeholder="Enter your message here..."
                                    style={{
                                        width: '100%', padding: '0.75rem', borderRadius: '0.5rem',
                                        border: '1px solid var(--border)', fontSize: '0.875rem',
                                        minHeight: '120px', fontFamily: 'inherit',
                                        outline: 'none', background: '#ffffff'
                                    }}
                                />
                            </div>

                            {/* Preview Section */}
                            <div>
                                <label className="input-label mb-2 block text-sm font-medium text-gray-700">Preview Message</label>
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    background: '#efeae2',
                                    padding: '1.5rem',
                                    borderRadius: '0.5rem',
                                    border: '1px solid var(--border)',
                                    backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")',
                                    backgroundRepeat: 'repeat',
                                    backgroundSize: '300px'
                                }}>
                                    <div style={{
                                        alignSelf: 'flex-start',
                                        background: '#ffffff',
                                        padding: '0.5rem 0.75rem',
                                        borderRadius: '0 0.5rem 0.5rem 0.5rem',
                                        fontSize: '0.875rem',
                                        color: '#111b21',
                                        minHeight: '40px',
                                        minWidth: '120px',
                                        maxWidth: '90%',
                                        whiteSpace: 'pre-wrap',
                                        boxShadow: '0 1px 0.5px rgba(11,20,26,.13)',
                                        position: 'relative'
                                    }}>
                                        <div style={{ position: 'absolute', top: 0, left: '-8px', width: '8px', height: '13px', background: 'radial-gradient(circle at top left, transparent 8px, #ffffff 0)' }}></div>
                                        {newTemplateMessage ? renderBoldVariables(newTemplateMessage) : <span style={{ color: '#8696a0', fontStyle: 'italic' }}>Preview will appear here...</span>}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
                                <Button
                                    variant="outline"
                                    onClick={() => setIsTemplateModalOpen(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={() => {
                                        if (newTemplateName.trim() && newTemplateMessage.trim()) {
                                            if (editingTemplateIndex !== null) {
                                                const updatedTemplates = [...templates];
                                                updatedTemplates[editingTemplateIndex] = { name: newTemplateName, message: newTemplateMessage };
                                                setTemplates(updatedTemplates);
                                                // Auto-save to backend
                                                api.post('/personal-whatsapp/templates', { templates: updatedTemplates })
                                                    .catch(err => console.error('Failed to auto-save template', err));
                                            } else {
                                                const newTemplates = [...templates, { name: newTemplateName, message: newTemplateMessage }];
                                                setTemplates(newTemplates);
                                                // Auto-save to backend
                                                api.post('/personal-whatsapp/templates', { templates: newTemplates })
                                                    .catch(err => console.error('Failed to auto-save template', err));
                                            }
                                            showToast('Template saved successfully!', 'success');
                                            setIsTemplateModalOpen(false);
                                            setNewTemplateName('');
                                            setNewTemplateMessage('');
                                            setEditingTemplateIndex(null);
                                        } else {
                                            showToast('Please fill in both fields', 'error');
                                        }
                                    }}
                                >
                                    Save Template
                                </Button>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
};

export default PersonalLog;
