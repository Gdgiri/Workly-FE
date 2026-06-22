import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, Search, Scissors, Package, User, Calendar, DollarSign,
    ChevronRight, ChevronDown, LayoutGrid, List, X, Check, Clock, Loader2,
    Ruler, Palette, Tag, Trash2, Edit2, RefreshCw, AlertCircle,
    Receipt, ExternalLink, Filter, FileText, CreditCard, MessageCircle
} from 'lucide-react';
import { Modal, Button, Input } from '../components/UI';
import api from '../utils/api';
import { useToast } from '../components/ToastContext';
import { useCurrency } from '../components/CurrencyContext';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Customer } from '../types';
import Select from 'react-select';


// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────
interface GarmentStatus {
    id: string;
    label: string;
    color: string;
    bg: string;
    border: string;
}

const GARMENT_STATUSES: GarmentStatus[] = [
    { id: 'PENDING',   label: 'Pending',   color: '#92400E', bg: '#FEF3C7', border: '#FDE68A' },
    { id: 'READY',     label: 'Ready',     color: '#166534', bg: '#DCFCE7', border: '#86EFAC' },
    { id: 'DELIVERED', label: 'Delivered', color: '#1E3A5F', bg: '#DBEAFE', border: '#93C5FD' },
    { id: 'CANCELLED', label: 'Cancelled', color: '#991B1B', bg: '#FEE2E2', border: '#FECACA' }
];

// Order-level work statuses
const ORDER_STATUSES = [
    { id: 'PENDING',     label: 'Pending',     color: '#92400E', bg: '#FEF3C7', border: '#FDE68A' },
    { id: 'READY',       label: 'Ready',       color: '#166534', bg: '#DCFCE7', border: '#86EFAC' },
    { id: 'DELIVERED',   label: 'Delivered',   color: '#1E3A5F', bg: '#DBEAFE', border: '#93C5FD' },
    { id: 'CANCELLED',   label: 'Cancelled',   color: '#991B1B', bg: '#FEE2E2', border: '#FECACA' }
];

interface Garment {
    id: string;
    name: string;
    garmentType: string;
    status: string;
    fabricDetails: any;
    stylePreferences: any;
    measurementSnapshot: any;
    price: number;
    quantity: number;
    notes?: string;
    estimatedCompletion?: string;
    master?: { id: string; name: string };
    tailor?: { id: string; name: string };
    assignedTailorId?: string;
}

interface TailorOrder {
    id: string;
    orderNumber: string;
    status: string;
    saleId?: string;          // Set after "Send to Billing"
    customer: Customer;
    customerId: string;
    totalAmount: number;
    paidAmount: number;
    balanceAmount: number;
    paymentStatus: string;
    orderDate: string;
    createdAt: string;
    updatedAt?: string;
    targetDeliveryDate?: string;
    notes?: string;
    garments: Garment[];
}

interface TailorOrdersProps {
    customers: Customer[];
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────
const statusConfig = (statusId: string) =>
    GARMENT_STATUSES.find(s => s.id === statusId) || GARMENT_STATUSES[0];

const OrderStatusBadge: React.FC<{ status: string, prefix?: string }> = ({ status, prefix }) => {
    const cfg = statusConfig(status);
    return (
        <span style={{
            padding: '0.25rem 0.75rem',
            borderRadius: '999px',
            fontSize: '0.7rem',
            fontWeight: 700,
            background: cfg.bg,
            color: cfg.color,
            border: `1px solid ${cfg.border}`,
            letterSpacing: '0.04em',
            textTransform: 'uppercase'
        }}>
            {cfg.label}
        </span>
    );
};

// ────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────────
const TailorOrders: React.FC<TailorOrdersProps> = ({ customers }) => {
    const { showToast } = useToast();
    const { symbol } = useCurrency();
    const navigate = useNavigate();
    const { appId, businessName } = useParams();
    const location = useLocation();

    // ── State ──────────────────────────────────────────────────
    const [orders, setOrders] = useState<TailorOrder[]>([]);
    const [settings, setSettings] = useState<any>(null);

    useEffect(() => {
        const fetchSettingsData = async () => {
            try {
                const res = await api.get('/settings');
                setSettings(res.data);
            } catch (err) {
                console.error('Failed to fetch settings in TailorOrders:', err);
            }
        };
        fetchSettingsData();
    }, []);

    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
    const [showStatusFilter, setShowStatusFilter] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
    const [selectedOrder, setSelectedOrder] = useState<TailorOrder | null>(null);
    const [sendingToBilling, setSendingToBilling] = useState(false);
    const [stylists, setStylists] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);


    // Order Detail Modal
    const [showDetailModal, setShowDetailModal] = useState(false);

    // Payment breakdown log (tailor module only)
    const [paymentLog, setPaymentLog] = useState<{ payments: any[]; summary: any } | null>(null);
    const [loadingPayments, setLoadingPayments] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);

    // Confirmation Modals
    const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
    const [orderToSendToBilling, setOrderToSendToBilling] = useState<TailorOrder | null>(null);
    const [statusConfirmPayload, setStatusConfirmPayload] = useState<{orderId: string, newStatus: string} | null>(null);
    const [tailorConfirmPayload, setTailorConfirmPayload] = useState<{ garmentId: string; newTailorId: string; orderId: string; tailorName: string } | null>(null);

    // ── Fetch Payments + refresh order data ─────────────────────
    const fetchPaymentLog = async (orderId: string) => {
        setLoadingPayments(true);
        setPaymentLog(null);
        try {
            // Fetch payments AND fresh order data in parallel
            const [payRes, orderRes] = await Promise.all([
                api.get(`/tailor/orders/${orderId}/payments`),
                api.get(`/tailor/orders/${orderId}`)
            ]);
            setPaymentLog(payRes.data);
            // Refresh selectedOrder so paidAmount / balanceAmount are current
            if (orderRes.data) {
                setSelectedOrder(orderRes.data);
                // Also update the order in the list
                setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...orderRes.data } : o));
            }
        } catch (err) {
            console.error('Failed to fetch payment log', err);
        } finally {
            setLoadingPayments(false);
        }
    };

    // ── Fetch ──────────────────────────────────────────────────
    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/tailor/orders');
            setOrders(res.data || []);
        } catch (err) {
            console.error('Failed to fetch tailor orders', err);
            showToast('Failed to load tailor orders', 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchOrders(); }, [fetchOrders]);

    useEffect(() => {
        const fetchStylistsAndProducts = async () => {
            try {
                const [stylistsRes, productsRes] = await Promise.all([
                    api.get('/stylists'),
                    api.get('/inventory')
                ]);
                setStylists(stylistsRes.data || []);
                setProducts(productsRes.data || []);
            } catch (err) {
                console.error('Failed to fetch stylists or products', err);
            }
        };
        fetchStylistsAndProducts();
    }, []);

    // ── Derived ────────────────────────────────────────────────
    const filteredOrders = orders.filter(o => {
        const effectiveStatus = o.status === 'DRAFT' ? 'PENDING' : o.status;
        const matchesStatus = filterStatuses.length === 0 || filterStatuses.includes(effectiveStatus);
        const t = searchTerm.toLowerCase();
        const matchesSearch = o.orderNumber.toLowerCase().includes(t) ||
            o.customer?.name?.toLowerCase().includes(t) ||
            o.customer?.phone?.includes(t);
        return matchesStatus && matchesSearch;
    });

    // ── Update garment status ──────────────────────────────────
    const handleStatusChange = async (garmentId: string, newStatus: string, orderId: string) => {
        try {
            await api.patch(`/tailor/garments/${garmentId}`, { status: newStatus });
            setOrders(prev => prev.map(o => {
                if (o.id !== orderId) return o;
                return {
                    ...o,
                    garments: o.garments.map(g =>
                        g.id === garmentId ? { ...g, status: newStatus } : g
                    )
                };
            }));
            if (selectedOrder?.id === orderId) {
                setSelectedOrder(prev => prev ? {
                    ...prev,
                    garments: prev.garments.map(g =>
                        g.id === garmentId ? { ...g, status: newStatus } : g
                    )
                } : prev);
            }
            showToast('Status updated', 'success');
        } catch {
            showToast('Failed to update status', 'error');
        }
    };

    const handleTailorChange = async (garmentId: string, newTailorId: string, orderId: string) => {
        try {
            await api.patch(`/tailor/garments/${garmentId}`, { assignedTailorId: newTailorId || null });
            
            // Find tailor name to update local state optimistically
            const newTailor = stylists.find(s => s.id === newTailorId);
            
            setOrders(prev => prev.map(o => {
                if (o.id !== orderId) return o;
                return {
                    ...o,
                    garments: o.garments.map(g =>
                        g.id === garmentId ? { ...g, assignedTailorId: newTailorId, tailor: newTailor } : g
                    )
                };
            }));
            if (selectedOrder?.id === orderId) {
                setSelectedOrder(prev => prev ? {
                    ...prev,
                    garments: prev.garments.map(g =>
                        g.id === garmentId ? { ...g, assignedTailorId: newTailorId, tailor: newTailor } : g
                    )
                } : prev);
            }
            showToast('Tailor reassigned', 'success');
        } catch {
            showToast('Failed to reassign tailor', 'error');
        }
    };

    // ── Update ORDER status directly from list ───────────────
    const handleOrderStatusChange = async (orderId: string, newStatus: string, updateGarmentsStatus = false) => {
        try {
            await api.patch(`/tailor/orders/${orderId}`, { status: newStatus, updateGarmentsStatus });
            setOrders(prev => prev.map(o => {
                if (o.id !== orderId) return o;
                const updated = { ...o, status: newStatus };
                if (updateGarmentsStatus && updated.garments) {
                    updated.garments = updated.garments.map(g => ({ ...g, status: newStatus }));
                }
                return updated;
            }));
            if (selectedOrder?.id === orderId) {
                setSelectedOrder(prev => {
                    if (!prev) return prev;
                    const updated = { ...prev, status: newStatus };
                    if (updateGarmentsStatus && updated.garments) {
                        updated.garments = updated.garments.map(g => ({ ...g, status: newStatus }));
                    }
                    return updated;
                });
            }
            showToast('Order status updated', 'success');
        } catch {
            showToast('Failed to update order status', 'error');
        }
    };

    // ── Delete Order ───────────────────────────────────────────
    const requestDeleteOrder = (id: string) => setOrderToDelete(id);
    
    const confirmDeleteOrder = async () => {
        if (!orderToDelete) return;
        try {
            await api.delete(`/tailor/orders/${orderToDelete}`);
            showToast('Order deleted', 'success');
            fetchOrders();
            setShowDetailModal(false);
        } catch {
            showToast('Failed to delete order', 'error');
        } finally {
            setOrderToDelete(null);
        }
    };

    // ── Send to Billing ────────────────────────────────────────
    const requestSendToBilling = (order?: TailorOrder | null) => setOrderToSendToBilling(order || selectedOrder);

    const confirmSendToBilling = async () => {
        if (!orderToSendToBilling) return;

        // Instead of calling backend, redirect to POS screen with tailor order data
        const pathParts = location.pathname.split('/').filter(Boolean);
        if (pathParts.length >= 2) {
            navigate(`/${pathParts[0]}/${pathParts[1]}/sales`, {
                state: {
                    tailorOrderData: {
                        id: orderToSendToBilling.id,
                        saleId: orderToSendToBilling.saleId,
                        customerId: orderToSendToBilling.customerId,
                        customerName: orderToSendToBilling.customer?.name,
                        garments: orderToSendToBilling.garments,
                        totalAmount: orderToSendToBilling.totalAmount,
                        paidAmount: orderToSendToBilling.paidAmount
                    }
                }
            });
        }
        setOrderToSendToBilling(null);
    };

    // ════════════════════════════════════════════════════════════
    // KANBAN VIEW
    // ════════════════════════════════════════════════════════════
    const renderKanban = () => {
        // Group ALL garments across all orders by status
        const allGarments: Array<Garment & { order: TailorOrder }> = [];
        filteredOrders.forEach(o => o.garments.forEach(g => allGarments.push({ ...g, order: o })));

        return (
            <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem', alignItems: 'flex-start' }}>
                {GARMENT_STATUSES.map(col => {
                    const colGarments = allGarments.filter(g => g.status === col.id);
                    return (
                        <div key={col.id} style={{
                            minWidth: '240px',
                            width: '240px',
                            background: 'var(--bg-card)',
                            borderRadius: 'var(--radius-xl)',
                            border: `1px solid ${col.border}`,
                            overflow: 'hidden',
                            flexShrink: 0
                        }}>
                            {/* Column Header */}
                            <div style={{
                                padding: '0.75rem 1rem',
                                background: col.bg,
                                borderBottom: `1px solid ${col.border}`,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <span style={{ fontWeight: 700, fontSize: '0.8rem', color: col.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                    {col.label}
                                </span>
                                <span style={{
                                    background: col.color,
                                    color: '#fff',
                                    borderRadius: '999px',
                                    padding: '0.1rem 0.5rem',
                                    fontSize: '0.7rem',
                                    fontWeight: 700
                                }}>
                                    {colGarments.length}
                                </span>
                            </div>

                            {/* Cards */}
                            <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.625rem', minHeight: '120px' }}>
                                <AnimatePresence>
                                    {colGarments.map(g => (
                                        <motion.div
                                            key={g.id}
                                            layout
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            style={{
                                                background: 'var(--bg-body)',
                                                border: '1px solid var(--border-light)',
                                                borderRadius: 'var(--radius-lg)',
                                                padding: '0.75rem',
                                                cursor: 'pointer',
                                                boxShadow: 'var(--shadow-sm)'
                                            }}
                                            onClick={() => {
                                                setSelectedOrder(g.order);
                                                setShowDetailModal(true);
                                                fetchPaymentLog(g.order.id);
                                            }}
                                            whileHover={{ y: -2, boxShadow: 'var(--shadow-md)' }}
                                        >
                                            <p style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-dark)' }}>{g.name}</p>
                                            <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-light)' }}>
                                                {g.garmentType} · #{g.order.orderNumber}
                                            </p>
                                            <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: 'var(--text-dark)', fontWeight: 500 }}>
                                                {g.order.customer?.name}
                                            </p>
                                            {/* Status change buttons */}
                                            <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.625rem', flexWrap: 'wrap' }}>
                                                {GARMENT_STATUSES.filter(s => s.id !== g.status).map(s => (
                                                    <button
                                                        key={s.id}
                                                        onClick={(e) => { e.stopPropagation(); handleStatusChange(g.id, s.id, g.order.id); }}
                                                        style={{
                                                            padding: '0.125rem 0.5rem',
                                                            fontSize: '0.65rem',
                                                            fontWeight: 600,
                                                            borderRadius: '999px',
                                                            border: `1px solid ${s.border}`,
                                                            background: s.bg,
                                                            color: s.color,
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        → {s.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                                {colGarments.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '1rem 0', color: 'var(--text-light)', fontSize: '0.8rem' }}>
                                        No garments
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    // ════════════════════════════════════════════════════════════
    // LIST VIEW
    // ════════════════════════════════════════════════════════════
    const renderList = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filteredOrders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-light)' }}>
                    <Scissors size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                    <p style={{ fontSize: '1rem', fontWeight: 500 }}>No tailor orders yet</p>
                    <p style={{ fontSize: '0.875rem' }}>Create your first order to get started</p>
                </div>
            ) : filteredOrders.map(order => (
                <motion.div
                    key={order.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ y: -2 }}
                    onClick={() => { setSelectedOrder(order); setShowDetailModal(true); fetchPaymentLog(order.id); }}
                    style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-xl)',
                        padding: '1.25rem 1.5rem',
                        cursor: 'pointer',
                        transition: 'all var(--transition-base)',
                        boxShadow: 'var(--shadow-sm)'
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-dark)' }}>
                                    #{order.orderNumber}
                                </span>
                                <OrderStatusBadge status={order.status} />
                            </div>
                            {/* ── Fixed 4-column info row ── */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '2.5fr 1.5fr 1.5fr 1.5fr',
                                alignItems: 'center',
                                gap: '1rem',
                                marginTop: '0.75rem',
                                paddingTop: '0.75rem',
                                borderTop: '1px solid var(--border-light)'
                            }}>
                                {/* Customer - Left */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-dark)', fontSize: '0.875rem', overflow: 'hidden' }}>
                                    <User size={14} color="var(--primary)" style={{ flexShrink: 0 }} />
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                                        {order.customer?.name || 'N/A'}
                                    </span>
                                </div>
                                {/* Garments - Center */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--text-light)', fontSize: '0.875rem' }}>
                                    <Scissors size={14} style={{ flexShrink: 0 }} />
                                    <span>{order.garments?.length || 0} garment{order.garments?.length !== 1 ? 's' : ''}</span>
                                </div>
                                {/* Amount - Right (with some padding so it doesn't touch Date) */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem', color: 'var(--text-dark)', fontSize: '0.9rem', fontWeight: 800, paddingRight: '1.5rem' }}>
                                    <DollarSign size={14} color="var(--primary)" style={{ flexShrink: 0 }} />
                                    <span>{symbol}{(order.totalAmount || 0).toFixed(2)}</span>
                                </div>
                                {/* Date - Center */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--text-light)', fontSize: '0.875rem' }}>
                                    <Calendar size={14} style={{ flexShrink: 0 }} />
                                    <span>
                                        {order.targetDeliveryDate
                                            ? new Date(order.targetDeliveryDate).toLocaleDateString()
                                            : '—'}
                                    </span>
                                </div>
                            </div>

                        </div>
                        {/* Right side: Order status changer + garment pills */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem', flexShrink: 0 }}>
                            {/* Order status quick-change dropdown */}
                            {(() => {
                                const osCfg = ORDER_STATUSES.find(s => s.id === order.status) || ORDER_STATUSES[0];
                                return (
                                    <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                                        <select
                                            value={order.status}
                                            onChange={e => handleOrderStatusChange(order.id, e.target.value)}
                                            style={{
                                                height: '32px',
                                                padding: '0 1.8rem 0 0.6rem',
                                                fontSize: '0.72rem',
                                                fontWeight: 700,
                                                borderRadius: '8px',
                                                border: `2px solid ${osCfg.border}`,
                                                background: osCfg.bg,
                                                color: osCfg.color,
                                                cursor: 'pointer',
                                                appearance: 'none',
                                                WebkitAppearance: 'none',
                                                outline: 'none',
                                                boxShadow: `0 1px 4px ${osCfg.border}88`,
                                                letterSpacing: '0.03em',
                                                textTransform: 'uppercase',
                                                minWidth: '110px'
                                            }}
                                        >
                                            {ORDER_STATUSES.map(s => (
                                                <option key={s.id} value={s.id}>{s.label}</option>
                                            ))}
                                        </select>
                                        <span style={{
                                            position: 'absolute', right: '0.4rem', top: '50%',
                                            transform: 'translateY(-50%)', pointerEvents: 'none',
                                            fontSize: '0.7rem', color: osCfg.color, fontWeight: 900
                                        }}>▾</span>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </motion.div>
            ))}
        </div>
    );

    // ════════════════════════════════════════════════════════════
    // CREATE ORDER MODAL

    const handleSendStatusWhatsApp = (order: TailorOrder) => {
        const customer = order.customer;
        if (!customer) {
            showToast('Customer information is missing!', 'error');
            return;
        }

        const rawPhone = customer.phone || '';
        const phone = rawPhone.replace(/[^\d+]/g, ''); // keep only numbers and optionally leading plus
        if (!phone) {
            showToast('Customer phone number is missing!', 'error');
            return;
        }

        const orderNumber = order.orderNumber;
        const status = order.status;
        const totalAmount = (order.totalAmount || 0).toFixed(2);
        const paidAmount = (order.paidAmount || 0).toFixed(2);
        const balanceAmount = (order.balanceAmount || 0).toFixed(2);

        const message = `Hello *${customer.name}*,\n\nYour Tailor Order *#${orderNumber}* status is now *${status}*.\n\n*Summary:*\n• Total Amount: ${symbol}${totalAmount}\n• Paid: ${symbol}${paidAmount}\n• Balance: ${symbol}${balanceAmount}\n\nThank you!`;

        const encodedMessage = encodeURIComponent(message);
        const url = `https://web.whatsapp.com/send?phone=${phone}&text=${encodedMessage}`;
        window.open(url, '_blank');
    };

    const handleShareBillWhatsApp = (order: TailorOrder, transaction: any) => {
        const customer = order.customer;
        if (!customer) {
            showToast('Customer information is missing!', 'error');
            return;
        }

        const rawPhone = customer.phone || '';
        const phone = rawPhone.replace(/[^\d+]/g, ''); // keep only numbers and optionally leading plus
        if (!phone) {
            showToast('Customer phone number is missing!', 'error');
            return;
        }

        const orderNumber = order.orderNumber;
        const invoiceNumber = transaction.invoiceNumber || order.orderNumber || 'N/A';
        const transactionAmount = (transaction.amount || 0).toFixed(2);
        const paymentMethod = transaction.paymentMethod || 'Cash';
        const balanceAmount = (order.balanceAmount || 0).toFixed(2);
        const totalAmount = (order.totalAmount || 0).toFixed(2);

        let invoiceLinkText = '';
        if (order.saleId) {
            const invoiceUrl = `${window.location.origin}/${appId}/${businessName}/invoice/${order.saleId}`;
            invoiceLinkText = `\n\n📥 *View and download your invoice here:*\n${invoiceUrl}`;
        }

        const message = `Hello *${customer.name}*,\n\nHere is your receipt for Tailor Order *#${orderNumber}* (Invoice: *#${invoiceNumber}*).\n\n*Receipt Details:*\n• Amount Received: ${symbol}${transactionAmount} via ${paymentMethod}\n• Remaining Balance: ${symbol}${balanceAmount}\n• Total Order Value: ${symbol}${totalAmount}${invoiceLinkText}\n\nThank you for choosing us!`;

        const encodedMessage = encodeURIComponent(message);
        const url = `https://web.whatsapp.com/send?phone=${phone}&text=${encodedMessage}`;
        window.open(url, '_blank');
    };

    // ════════════════════════════════════════════════════════════
    // ORDER DETAIL MODAL
    // ════════════════════════════════════════════════════════════
    const renderDetailModal = () => {
        if (!selectedOrder) return null;
        return (
            <Modal
                isOpen={showDetailModal}
                onClose={() => setShowDetailModal(false)}
                title={`Order #${selectedOrder.orderNumber}`}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Customer info */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                        gap: '0.75rem',
                        padding: '1rem',
                        background: 'var(--bg-body)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border-light)'
                    }}>
                        <div>
                            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', display: 'block' }}>Customer</label>
                            <p style={{ margin: '0.25rem 0 0', fontWeight: 600, color: 'var(--text-dark)' }}>{selectedOrder.customer?.name}</p>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', display: 'block' }}>Work Status</label>
                            <div style={{ marginTop: '0.25rem' }}>
                                {(() => {
                                    const dc = statusConfig(selectedOrder.status);
                                    const ICONS: Record<string, string> = {
                                        PENDING: '⏳', READY: '✅', DELIVERED: '📦', CANCELLED: '❌', BILLED: '🧾'
                                    };
                                    return (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <div style={{ position: 'relative', width: 'fit-content' }}>
                                                <select
                                                    value={selectedOrder.status}
                                                    onChange={e => {
                                                        setStatusConfirmPayload({ orderId: selectedOrder.id, newStatus: e.target.value });
                                                    }}
                                                    style={{
                                                        width: '100%',
                                                        height: '32px',
                                                        padding: '0 1.5rem 0 0.5rem',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 700,
                                                        borderRadius: '8px',
                                                        border: `1.5px solid ${dc.border}`,
                                                        background: dc.bg,
                                                        color: dc.color,
                                                        cursor: 'pointer',
                                                        appearance: 'none',
                                                        WebkitAppearance: 'none',
                                                        outline: 'none',
                                                        boxShadow: `0 1px 2px ${dc.border}55`,
                                                        letterSpacing: '0.02em',
                                                        textTransform: 'uppercase'
                                                    }}
                                                >
                                                    {ORDER_STATUSES.map(s => (
                                                        <option key={s.id} value={s.id}>{ICONS[s.id] || ''} {s.label}</option>
                                                    ))}
                                                    <option value="BILLED">🧾 Billed</option>
                                                </select>
                                                <div style={{
                                                    position: 'absolute', right: '0.4rem', top: '50%',
                                                    transform: 'translateY(-50%)', pointerEvents: 'none',
                                                    fontSize: '0.75rem', color: dc.color, fontWeight: 900
                                                }}>▾</div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                            {/* Payment status clarifier */}
                            <div style={{ marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>Payment:</span>
                                <span style={{
                                    fontSize: '0.65rem', fontWeight: 800, padding: '0.1rem 0.45rem',
                                    borderRadius: '999px', textTransform: 'uppercase',
                                    background: selectedOrder.paymentStatus === 'COMPLETED' ? '#DCFCE7' : selectedOrder.paymentStatus === 'PARTIAL' ? '#FEF3C7' : '#F3F4F6',
                                    color: selectedOrder.paymentStatus === 'COMPLETED' ? '#166534' : selectedOrder.paymentStatus === 'PARTIAL' ? '#92400E' : '#6B7280'
                                }}>
                                    {selectedOrder.paymentStatus === 'COMPLETED' ? '✓ Paid' : selectedOrder.paymentStatus === 'PARTIAL' ? '⚡ Partial' : '⏳ Unpaid'}
                                </span>
                            </div>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', display: 'block' }}>Total / Paid</label>
                            <p style={{ margin: '0.25rem 0 0', fontWeight: 700, color: 'var(--primary)', fontSize: '1.1rem' }}>
                                {symbol}{(selectedOrder.totalAmount || 0).toFixed(2)}
                            </p>
                            {(selectedOrder.paidAmount || 0) > 0 && (
                                <p style={{ margin: '0.125rem 0 0', fontSize: '0.75rem', color: 'var(--success)' }}>
                                    Paid: {symbol}{(selectedOrder.paidAmount || 0).toFixed(2)} <span style={{ color: 'var(--text-light)', marginLeft: '0.25rem' }}>Bal: {symbol}{(selectedOrder.balanceAmount || 0).toFixed(2)}</span>
                                </p>
                            )}
                        </div>
                        {selectedOrder.targetDeliveryDate && (
                            <div>
                                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', display: 'block' }}>Delivery</label>
                                <p style={{ margin: '0.25rem 0 0', color: 'var(--text-dark)' }}>
                                    {new Date(selectedOrder.targetDeliveryDate).toLocaleDateString()}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* ── Payment Breakdown Log ── */}
                    <div style={{
                        background: 'var(--bg-input, #F9FAFB)',
                        border: '1px solid var(--border)',
                        borderRadius: '12px',
                        padding: '1rem 1.25rem',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                            <h4 style={{ margin: 0, fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-dark)' }}>
                                💰 Payment Breakdown
                            </h4>
                            {/* Mini progress bar */}
                            {(selectedOrder.totalAmount || 0) > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{ width: '80px', height: '6px', background: '#E5E7EB', borderRadius: '3px', overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%',
                                            width: `${Math.min(100, ((selectedOrder.paidAmount || 0) / (selectedOrder.totalAmount || 1)) * 100)}%`,
                                            background: selectedOrder.paymentStatus === 'COMPLETED' ? '#10B981' : '#F59E0B',
                                            borderRadius: '3px',
                                            transition: 'width 0.4s'
                                        }} />
                                    </div>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: selectedOrder.paymentStatus === 'COMPLETED' ? '#10B981' : '#F59E0B' }}>
                                        {selectedOrder.paymentStatus}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Summary row */}
                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                            {[
                                { label: 'Total', val: selectedOrder.totalAmount || 0, color: 'var(--text-dark)' },
                                { label: 'Paid',  val: selectedOrder.paidAmount || 0,  color: '#10B981' },
                                { label: 'Balance', val: selectedOrder.balanceAmount || 0, color: (selectedOrder.balanceAmount || 0) > 0 ? '#F59E0B' : '#10B981' },
                            ].map(({ label, val, color }) => (
                                <div key={label} style={{ textAlign: 'center', minWidth: '60px' }}>
                                    <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color }}>{symbol}{val.toFixed(2)}</div>
                                </div>
                            ))}
                        </div>

                        {/* Payment entries */}
                        {loadingPayments ? (
                            <div style={{ textAlign: 'center', padding: '0.75rem', color: 'var(--text-light)', fontSize: '0.8rem' }}>
                                <Loader2 size={14} style={{ display: 'inline', marginRight: '0.375rem', animation: 'spin 1s linear infinite' }} />
                                Loading payments...
                            </div>
                        ) : !paymentLog || paymentLog.payments.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '0.5rem', color: 'var(--text-light)', fontSize: '0.8rem' }}>
                                {selectedOrder.paymentStatus === 'PENDING' ? '⏳ No payment received yet' : 'No payment records found'}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {paymentLog.payments.map((p: any, i: number) => {
                                    const METHOD_ICONS: Record<string, string> = { CASH: '💵', CARD: '💳', UPI: '📱', ONLINE: '🌐', BANK: '🏦' };
                                    const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
                                        ADVANCE:   { bg: '#FEF3C7', color: '#92400E' },
                                        REMAINING: { bg: '#DCFCE7', color: '#166534' },
                                        FULL:      { bg: '#EFF6FF', color: '#1D4ED8' },
                                    };
                                    const typeStyle = TYPE_COLORS[p.paymentType] || TYPE_COLORS.FULL;
                                    const icon = METHOD_ICONS[p.paymentMethod?.toUpperCase()] || '💰';
                                    return (
                                        <div key={p.id} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.75rem',
                                            background: '#fff',
                                            border: '1px solid var(--border)',
                                            borderRadius: '10px',
                                            padding: '0.6rem 0.875rem',
                                            cursor: 'pointer',
                                            transition: 'transform 0.2s',
                                        }}
                                        onClick={() => setSelectedTransaction(p)}
                                        onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                                        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                                            {/* Index bubble */}
                                            <div style={{
                                                width: '28px', height: '28px', borderRadius: '50%',
                                                background: 'var(--primary)', color: '#fff',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '0.75rem', fontWeight: 800, flexShrink: 0
                                            }}>
                                                {i + 1}
                                            </div>
                                            {/* Method icon */}
                                            <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{icon}</span>
                                            {/* Details */}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-dark)' }}>
                                                        {symbol}{(p.amount || 0).toFixed(2)}
                                                    </span>
                                                    <span style={{
                                                        padding: '0.1rem 0.5rem',
                                                        borderRadius: '999px',
                                                        fontSize: '0.65rem',
                                                        fontWeight: 700,
                                                        background: typeStyle.bg,
                                                        color: typeStyle.color,
                                                        textTransform: 'uppercase'
                                                    }}>
                                                        {p.paymentType}
                                                    </span>
                                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-light)', fontWeight: 600 }}>
                                                        {p.paymentMethod}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '0.68rem', color: 'var(--text-light)', marginTop: '0.15rem' }}>
                                                    {new Date(p.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    {p.cashierName && <span style={{ marginLeft: '0.4rem' }}>· {p.cashierName}</span>}
                                                    {p.invoiceNumber && <span style={{ marginLeft: '0.4rem', color: 'var(--primary)', fontWeight: 600 }}>· {p.invoiceNumber}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Items */}
                    <div>
                        <h4 style={{ margin: '0 0 0.75rem', color: 'var(--text-dark)', fontWeight: 600, fontSize: '0.9rem' }}>
                            Items ({selectedOrder.garments?.length || 0})
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                            {selectedOrder.garments?.map(g => {
                                const cfg = statusConfig(g.status);
                                return (
                                    <div key={g.id} style={{
                                        padding: '0.75rem 1rem',
                                        background: 'var(--bg-body)',
                                        border: `1px solid ${cfg.border}`,
                                        borderRadius: 'var(--radius-lg)',
                                        borderLeft: `4px solid ${cfg.color}`,
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: '0.75rem',
                                        alignItems: 'start'
                                    }}>
                                        {/* ── LEFT: garment info ── */}
                                        <div>
                                            <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.9rem' }}>{g.name}</p>
                                            <p style={{ margin: '0.1rem 0 0', fontSize: '0.78rem', color: 'var(--text-light)' }}>
                                                {g.garmentType} · Qty: {g.quantity} · {symbol}{(g.price * g.quantity).toFixed(2)}
                                            </p>
                                            {g.fabricDetails && (() => {
                                                const fd = g.fabricDetails;
                                                const isCustomer = fd.type === 'Customer' || fd.source === 'customer';
                                                const isShop = fd.type === 'Shop' || fd.source === 'shop';
                                                
                                                if (isCustomer) {
                                                    const desc = fd.description || fd.details || 'Customer Fabric';
                                                    return (
                                                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.72rem', color: 'var(--text-light)' }}>
                                                            🧵 <strong>Customer Fabric</strong> — {desc}
                                                        </p>
                                                    );
                                                }
                                                if (isShop) {
                                                    const product = products.find(p => p.id === fd.productId);
                                                    const prodName = product ? product.name : (fd.details || 'Shop Fabric');
                                                    const categoryName = product ? product.category : '';
                                                    const qty = fd.quantity || '';
                                                    return (
                                                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.72rem', color: 'var(--text-light)' }}>
                                                            🧵 <strong>Shop Fabric</strong> — {categoryName ? `[${categoryName}] ` : ''}{prodName} {qty ? `(Qty: ${qty})` : ''}
                                                        </p>
                                                    );
                                                }
                                                return null;
                                            })()}
                                            {selectedOrder.status !== 'DELIVERED' ? (
                                                <div style={{ marginTop: '0.5rem', width: '200px' }}>
                                                    <label style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-light)' }}>
                                                        Assign Tailor
                                                    </label>
                                                    <Select
                                                        value={g.assignedTailorId ? { value: g.assignedTailorId, label: stylists.find(s => s.id === g.assignedTailorId)?.name || (g as any).tailor?.name || 'Unknown' } : null}
                                                        onChange={(selected: any) => {
                                                            setTailorConfirmPayload({
                                                                garmentId: g.id,
                                                                newTailorId: selected ? selected.value : '',
                                                                orderId: selectedOrder.id,
                                                                tailorName: selected ? selected.label : 'None'
                                                            });
                                                        }}
                                                        options={stylists.map(s => ({ value: s.id, label: s.name }))}
                                                        placeholder="Select Tailor"
                                                        isClearable
                                                        styles={{ control: (base) => ({ ...base, minHeight: '28px', fontSize: '0.8rem', padding: '0', borderRadius: '6px' }), dropdownIndicator: (base) => ({...base, padding: '2px'}), clearIndicator: (base) => ({...base, padding: '2px'}) }}
                                                    />
                                                </div>
                                            ) : (
                                                (g as any).tailor && (
                                                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600 }}>
                                                        Tailor: {(g as any).tailor.name}
                                                    </p>
                                                )
                                            )}
                                            {g.stylePreferences?.notes && (
                                                <p style={{ margin: '0.1rem 0 0', fontSize: '0.72rem', color: 'var(--text-light)' }}>
                                                    🎨 {g.stylePreferences.notes}
                                                </p>
                                            )}
                                            {/* Measurement fields */}
                                            {g.measurementSnapshot && (() => {
                                                const snap = g.measurementSnapshot as any;
                                                const entries = Object.entries(snap.measurements || snap)
                                                    .filter(([k]) => k !== 'profileName' && k !== 'measurements' && k !== 'photoUrl' && k !== 'photoUrls');
                                                return entries.length > 0 ? (
                                                    <div style={{ marginTop: '0.625rem', padding: '0.5rem 0.75rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                                                        <p style={{ margin: '0 0 0.25rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>
                                                            Measurements {snap.profileName ? `— ${snap.profileName}` : ''}
                                                        </p>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                                                            {entries.map(([k, v]) => (
                                                                <span key={k} style={{ fontSize: '0.7rem', color: 'var(--text-dark)', background: 'var(--bg-body)', border: '1px solid var(--border)', borderRadius: '4px', padding: '0.125rem 0.375rem' }}>
                                                                    {k}: <strong>{v as string}</strong>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : null;
                                            })()}
                                        </div>

                                        {/* ── RIGHT: status dropdown + photo ── */}
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem', minWidth: '130px' }}>
                                            {/* Compact status badge */}
                                            {(() => {
                                                const dc = statusConfig(g.status);
                                                const ICONS: Record<string, string> = {
                                                    PENDING: '⏳', READY: '✅', DELIVERED: '📦', CANCELLED: '❌'
                                                };
                                                return (
                                                    <div style={{
                                                        width: '100%',
                                                        height: '38px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        padding: '0 0.6rem',
                                                        fontSize: '0.78rem',
                                                        fontWeight: 700,
                                                        borderRadius: '10px',
                                                        border: `2px solid ${dc.border}`,
                                                        background: dc.bg,
                                                        color: dc.color,
                                                        justifyContent: 'center',
                                                        letterSpacing: '0.02em',
                                                        textTransform: 'uppercase'
                                                    }}>
                                                        {ICONS[g.status] || ''} {g.status}
                                                    </div>
                                                );
                                            })()}
                                            {/* Photo thumbnails */}
                                            {(() => {
                                                const snap = g.measurementSnapshot as any;
                                                const urls: string[] = [];
                                                if (snap?.photoUrls && Array.isArray(snap.photoUrls)) {
                                                    urls.push(...snap.photoUrls);
                                                }
                                                if (snap?.photoUrl && typeof snap.photoUrl === 'string' && !urls.includes(snap.photoUrl)) {
                                                    urls.push(snap.photoUrl);
                                                }
                                                if (urls.length === 0) return null;

                                                return (
                                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', width: '100%', marginTop: '0.5rem' }}>
                                                        {urls.map((url, i) => (
                                                            <div
                                                                key={i}
                                                                style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)', cursor: 'pointer', width: '50px', height: '50px', flexShrink: 0 }}
                                                                onClick={() => window.open(url, '_blank')}
                                                                title="Tap to view"
                                                            >
                                                                <img
                                                                    src={url}
                                                                    alt={`Measurement ${i+1}`}
                                                                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1.25rem', borderTop: '1px solid var(--border)', flexWrap: 'wrap', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                            {selectedOrder.saleId ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: '#10B981', fontWeight: 700, fontSize: '0.875rem' }}>
                                        <Check size={16} /> Billed
                                    </span>
                                    <Button variant="ghost" onClick={() => {
                                        const pathParts = location.pathname.split('/').filter(Boolean);
                                        if (pathParts.length >= 2) navigate(`/${pathParts[0]}/${pathParts[1]}/payments`);
                                        setShowDetailModal(false);
                                    }} style={{ border: '1px solid var(--border)' }}>
                                        <ExternalLink size={14} style={{ marginRight: '0.375rem' }} /> View Invoice
                                    </Button>
                                </div>
                            ) : (
                                <Button
                                    onClick={() => requestSendToBilling(selectedOrder)}
                                    disabled={sendingToBilling}
                                    style={{ background: '#10B981', color: '#fff', border: 'none' }}
                                >
                                    {sendingToBilling ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Processing...</> : <><Receipt size={16} style={{ marginRight: '0.5rem' }} /> Send to Billing</>}
                                </Button>
                            )}

                            {selectedOrder.status === 'PENDING' && (
                                <Button
                                    onClick={() => setStatusConfirmPayload({ orderId: selectedOrder.id, newStatus: 'READY' })}
                                    style={{ background: '#3b82f6', color: '#fff', border: 'none' }}
                                >
                                    <Check size={16} style={{ marginRight: '0.5rem' }} /> Mark as Ready
                                </Button>
                            )}
                            
                            {selectedOrder.status === 'READY' && (
                                <Button
                                    onClick={() => setStatusConfirmPayload({ orderId: selectedOrder.id, newStatus: 'DELIVERED' })}
                                    style={{ background: '#1E3A5F', color: '#fff', border: 'none' }}
                                >
                                    <Package size={16} style={{ marginRight: '0.5rem' }} /> Mark as Delivered
                                </Button>
                            )}

                            {settings?.tailorWhatsappWebEnabled && (
                                <Button 
                                    onClick={() => handleSendStatusWhatsApp(selectedOrder)}
                                    style={{ background: '#22c55e', color: '#fff', border: 'none' }}
                                >
                                    <MessageCircle size={16} style={{ marginRight: '0.5rem' }} /> Send Status via WhatsApp
                                </Button>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <Button variant="ghost" onClick={() => requestDeleteOrder(selectedOrder.id)} style={{ color: 'var(--error)' }}>
                                <Trash2 size={16} style={{ marginRight: '0.375rem' }} /> Delete
                            </Button>
                            <Button variant="ghost" onClick={() => setShowDetailModal(false)}>Close</Button>
                        </div>
                    </div>
                </div>
            </Modal>
        );
    };

    // ════════════════════════════════════════════════════════════
    // MAIN RENDER
    // ════════════════════════════════════════════════════════════
    return (
        <div style={{ padding: '1.5rem', maxWidth: '100%' }}>
            {/* Unified One-Line Header: Filter, Search, Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                {/* Left Side: Filter and Search */}
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flex: 1, maxWidth: '600px' }}>
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setShowStatusFilter(!showStatusFilter)}
                            style={{
                                padding: '0.625rem 1rem',
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border)',
                                background: filterStatuses.length > 0 ? 'var(--primary-light)' : 'var(--bg-card)',
                                color: filterStatuses.length > 0 ? 'var(--primary-dark)' : 'var(--text-dark)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                minWidth: '160px',
                                justifyContent: 'space-between',
                                transition: 'all 0.2s'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                <Filter size={16} />
                                <span>{filterStatuses.length === 0 ? `All Statuses (${orders.length})` : `${filterStatuses.length} Selected`}</span>
                            </div>
                            <ChevronDown size={16} style={{ transform: showStatusFilter ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                        </button>
                        <AnimatePresence>
                            {showStatusFilter && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        marginTop: '0.5rem',
                                        width: '220px',
                                        background: 'var(--bg-card)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 'var(--radius-md)',
                                        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                                        zIndex: 50,
                                        overflow: 'hidden'
                                    }}
                                >
                                    <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>Filter by Status</span>
                                        {filterStatuses.length > 0 && (
                                            <button 
                                                onClick={() => setFilterStatuses([])} 
                                                style={{ border: 'none', background: 'none', fontSize: '0.7rem', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}
                                            >
                                                Clear
                                            </button>
                                        )}
                                    </div>
                                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                        {[
                                            ...GARMENT_STATUSES,
                                            { id: 'BILLED', label: 'Billed' },
                                            { id: 'CANCELLED', label: 'Cancelled' }
                                        ].map(s => {
                                            const isSelected = filterStatuses.includes(s.id);
                                            return (
                                                <div 
                                                    key={s.id} 
                                                    onClick={() => {
                                                        if (isSelected) setFilterStatuses(prev => prev.filter(id => id !== s.id));
                                                        else setFilterStatuses(prev => [...prev, s.id]);
                                                    }}
                                                    style={{
                                                        padding: '0.625rem 0.75rem',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '0.75rem',
                                                        cursor: 'pointer',
                                                        background: isSelected ? 'var(--primary-50)' : 'transparent',
                                                        borderBottom: '1px solid var(--border-light)',
                                                        transition: 'background 0.2s'
                                                    }}
                                                >
                                                    <div style={{ 
                                                        width: '16px', height: '16px', borderRadius: '4px', 
                                                        border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                                                        background: isSelected ? 'var(--primary)' : 'transparent',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                    }}>
                                                        {isSelected && <Check size={12} color="#fff" strokeWidth={3} />}
                                                    </div>
                                                    <span style={{ fontSize: '0.875rem', fontWeight: isSelected ? 600 : 500, color: isSelected ? 'var(--primary-dark)' : 'var(--text-dark)' }}>
                                                        {s.label}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                        <input
                            placeholder="Search by order #, customer name or phone..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.625rem 0.75rem 0.625rem 2.25rem',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-md)',
                                background: 'var(--bg-card)',
                                color: 'var(--text-dark)',
                                fontSize: '0.875rem',
                                outline: 'none',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>
                </div>

                {/* Right Side: Actions */}
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <button
                        onClick={fetchOrders}
                        title="Refresh"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '0.625rem', borderRadius: 'var(--radius-md)', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-dark)' }}
                    >
                        <RefreshCw size={16} />
                    </button>
                    <Button onClick={() => navigate(`/${appId}/${businessName}/tailor/new`)}>
                        <Plus size={16} /> New Order
                    </Button>
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '4rem 0' }}>
                    <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)', marginBottom: '1rem' }} />
                    <p style={{ color: 'var(--text-light)' }}>Loading orders...</p>
                </div>
            ) : renderList()}

            {/* Modals */}
            {/* renderCreateModal removed */}
            {renderDetailModal()}

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={!!orderToDelete}
                onClose={() => setOrderToDelete(null)}
                title="Delete Order"
            >
                <div style={{ padding: '1rem 0' }}>
                    <p style={{ margin: '0 0 1.5rem', color: 'var(--text-dark)' }}>
                        Are you sure you want to delete this order? This action cannot be undone.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                        <Button variant="ghost" onClick={() => setOrderToDelete(null)}>Cancel</Button>
                        <Button variant="danger" onClick={confirmDeleteOrder}>
                            <Trash2 size={16} /> Yes, Delete Order
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Tailor Assignment Confirmation Modal */}
            <Modal
                isOpen={!!tailorConfirmPayload}
                onClose={() => setTailorConfirmPayload(null)}
                title="Confirm Tailor Assignment"
            >
                <div style={{ padding: '1rem 0' }}>
                    <p style={{ margin: '0 0 1.5rem', color: 'var(--text-dark)' }}>
                        Are you sure you want to assign <strong>{tailorConfirmPayload?.tailorName}</strong> to this item?
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                        <Button variant="ghost" onClick={() => setTailorConfirmPayload(null)}>Cancel</Button>
                        <Button variant="primary" onClick={() => {
                            if (tailorConfirmPayload) {
                                handleTailorChange(tailorConfirmPayload.garmentId, tailorConfirmPayload.newTailorId, tailorConfirmPayload.orderId);
                                setTailorConfirmPayload(null);
                            }
                        }}>
                            Confirm Assignment
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Transaction Details Modal */}
            <Modal
                isOpen={!!selectedTransaction}
                onClose={() => setSelectedTransaction(null)}
                title="Transaction Details"
            >
                {selectedTransaction && selectedOrder && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '0.5rem 0' }}>
                        {/* Info Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                            {/* Identifiers */}
                            <div style={{
                                padding: '1rem',
                                borderRadius: '12px',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.75rem'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-light)', marginBottom: '0.25rem' }}>
                                    <FileText size={14} />
                                    <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>IDENTIFIERS</span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-light)', marginBottom: '0.15rem' }}>Transaction ID</p>
                                        <p style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.8rem', wordBreak: 'break-all', margin: 0 }}>
                                            {selectedTransaction.invoiceNumber || selectedTransaction.id}
                                        </p>
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-light)', marginBottom: '0.15rem' }}>Booking Time</p>
                                        <p style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.8rem', margin: 0 }}>
                                            {new Date(selectedOrder.createdAt).toLocaleString(undefined, { timeStyle: 'short', dateStyle: 'medium' })}
                                        </p>
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-light)', marginBottom: '0.15rem' }}>Invoice Number</p>
                                        <p style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)', fontSize: '0.8rem', margin: 0 }}>
                                            {selectedTransaction.invoiceNumber || selectedOrder.orderNumber || 'N/A'}
                                        </p>
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-light)', marginBottom: '0.15rem' }}>Trans. Date & Time</p>
                                        <p style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.8rem', margin: 0 }}>
                                            {new Date(selectedTransaction.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                                        </p>
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-light)', marginBottom: '0.15rem' }}>Customer</p>
                                        <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
                                            {selectedOrder.customer?.name || 'Walk-in'}
                                        </p>
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-light)', marginBottom: '0.15rem' }}>Appointment ID</p>
                                        <p style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.8rem', wordBreak: 'break-all', margin: 0 }}>
                                            N/A
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Payment Info */}
                            <div style={{
                                padding: '1rem',
                                borderRadius: '12px',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.75rem'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-light)', marginBottom: '0.25rem' }}>
                                    <CreditCard size={14} />
                                    <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>PAYMENT INFO</span>
                                </div>
                                <div>
                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-light)', marginBottom: '0.15rem' }}>Method</p>
                                    <p style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.9rem', margin: 0, textTransform: 'capitalize' }}>
                                        {selectedTransaction.paymentMethod || 'Cash'}
                                    </p>
                                </div>
                                <div>
                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-light)', marginBottom: '0.15rem' }}>Collection Type</p>
                                    <p style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.9rem', margin: 0, textTransform: 'uppercase' }}>
                                        {selectedTransaction.paymentType || 'REMAINING'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Order Summary */}
                        <div style={{
                            borderRadius: '12px',
                            border: '1px solid var(--border)',
                            overflow: 'hidden',
                            backgroundColor: 'var(--bg-card)'
                        }}>
                            <div style={{
                                padding: '1rem 1.25rem',
                                backgroundColor: 'var(--bg-hover)',
                                borderBottom: '1px solid var(--border)'
                            }}>
                                <p style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Order Summary</p>
                            </div>

                            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {(selectedOrder.garments || []).map((g: any, idx: number) => (
                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <p style={{ fontWeight: 700, color: 'var(--text-dark)', margin: '0 0 0.25rem', fontSize: '0.95rem' }}>
                                                {g.garmentType || 'Item'} {g.name ? `- ${g.name}` : ''}
                                            </p>
                                            <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', margin: 0 }}>Qty: {g.quantity}</p>
                                        </div>
                                        <p style={{ fontWeight: 700, color: 'var(--text-dark)', margin: 0 }}>
                                            {symbol}{(g.price * g.quantity).toFixed(2)}
                                        </p>
                                    </div>
                                ))}

                                <div style={{ height: '1px', backgroundColor: 'var(--border-light)', margin: '0.5rem 0' }} />

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', margin: 0 }}>Subtotal</p>
                                    <p style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.9rem', margin: 0 }}>
                                        {symbol}{(selectedOrder.totalAmount || 0).toFixed(2)}
                                    </p>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <p style={{ color: 'var(--text-dark)', fontWeight: 600, fontSize: '0.9rem', margin: 0 }}>Balance Due</p>
                                    <p style={{ fontWeight: 700, color: '#ef4444', fontSize: '0.9rem', margin: 0 }}>
                                        {symbol}{(selectedOrder.balanceAmount || 0).toFixed(2)}
                                    </p>
                                </div>

                                <div style={{ height: '1px', backgroundColor: 'var(--border)', margin: '0.5rem 0' }} />

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-body)', padding: '1rem', borderRadius: '8px' }}>
                                    <p style={{ fontWeight: 800, color: 'var(--text-dark)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>NET AMOUNT</p>
                                    <p style={{ fontWeight: 900, color: 'var(--primary)', fontSize: '1.4rem', margin: 0 }}>
                                        {symbol}{(selectedTransaction.amount || 0).toFixed(2)}
                                    </p>
                                </div>

                                {settings?.tailorWhatsappWebEnabled && (
                                    <div style={{ marginTop: '0.5rem' }}>
                                        <button
                                            onClick={() => handleShareBillWhatsApp(selectedOrder, selectedTransaction)}
                                            style={{
                                                width: '100%',
                                                height: '42px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '0.5rem',
                                                borderRadius: '8px',
                                                border: 'none',
                                                background: '#22c55e',
                                                color: '#fff',
                                                fontWeight: 700,
                                                fontSize: '0.9rem',
                                                cursor: 'pointer',
                                                boxShadow: '0 2px 4px rgba(34, 197, 94, 0.3)',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseOver={e => e.currentTarget.style.background = '#16a34a'}
                                            onMouseOut={e => e.currentTarget.style.background = '#22c55e'}
                                        >
                                            <MessageCircle size={18} /> Share Bill on WhatsApp
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Send to Billing Confirmation Modal */}
            <Modal
                isOpen={!!orderToSendToBilling}
                onClose={() => setOrderToSendToBilling(null)}
                title="Send to Billing"
            >
                <div style={{ padding: '1rem 0' }}>
                    <p style={{ margin: '0 0 1.5rem', color: 'var(--text-dark)' }}>
                        Send Order #{orderToSendToBilling?.orderNumber} to billing? This will create an invoice in the Sales module.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                        <Button variant="ghost" onClick={() => setOrderToSendToBilling(null)}>Cancel</Button>
                        <Button onClick={confirmSendToBilling} disabled={sendingToBilling}>
                            {sendingToBilling ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Processing...</> : <><Receipt size={16} /> Create Invoice</>}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Status Confirmation Modal */}
            <Modal
                isOpen={!!statusConfirmPayload}
                onClose={() => setStatusConfirmPayload(null)}
                title="Update Garments Status"
            >
                <div style={{ padding: '1rem 0' }}>
                    <p style={{ margin: '0 0 1.5rem', color: 'var(--text-dark)' }}>
                        Do you want to apply this status update to all individual garments in this order as well?
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                        <Button variant="ghost" onClick={() => {
                            if (statusConfirmPayload) {
                                handleOrderStatusChange(statusConfirmPayload.orderId, statusConfirmPayload.newStatus, false);
                            }
                            setStatusConfirmPayload(null);
                        }}>
                            No, just the order
                        </Button>
                        <Button onClick={() => {
                            if (statusConfirmPayload) {
                                handleOrderStatusChange(statusConfirmPayload.orderId, statusConfirmPayload.newStatus, true);
                            }
                            setStatusConfirmPayload(null);
                        }} style={{ background: 'var(--primary)', color: '#fff', border: 'none' }}>
                            Yes, update all garments
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Spinner keyframes */}
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default TailorOrders;
