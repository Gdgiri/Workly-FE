import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Search, Filter, Download, DollarSign, CreditCard, Smartphone,
    Calendar, CheckCircle, Clock, XCircle, ArrowUpRight, ArrowDownLeft, Eye,
    FileText, Printer, Trash2, ChevronLeft, ChevronRight, Play, TrendingUp, Wallet, MessageCircle, Paperclip, ExternalLink, RefreshCw, AlertTriangle, Package
} from 'lucide-react';
import { Card, Table, Button, Input, Select, KPICard, Modal } from '../components/UI';
import { Skeleton } from '../components/Skeleton';
import { Payment, PaymentMethod } from '../types';
import api from '../utils/api';
import { useToast } from '../components/ToastContext';
import { useCurrency } from '../components/CurrencyContext';

import { useAuth } from '../hooks/useAuth';
import { generateInvoicePDF, getInvoicePDFFile } from '../utils/pdfGenerator';
import { generateReceiptHtml } from '../utils/receiptGenerator';
import { uploadToCloudinary } from '../utils/cloudinary';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../redux/store';
import { fetchPayments, fetchSpecialists, invalidatePaymentCache } from '../redux/slices/paymentSlice';
import { fetchAppointments } from '../redux/slices/appointmentSlice';
import { fetchSettings } from '../redux/slices/settingSlice';
import { cancelSale } from '../redux/slices/saleSlice';
import { cancelAppointment } from '../redux/slices/appointmentSlice';
import { fetchInventory, fetchInventoryHistory, invalidateInventoryCache } from '../redux/slices/inventorySlice';


interface PaymentsProps {
    paymentMethods?: PaymentMethod[];
    fraudProtection?: boolean;
}

const StatCard = ({ title, value, icon: Icon, trend, color, secondaryColor, onClick, loading }: any) => (
    <motion.div
        whileHover={{ y: -5, scale: 1.02 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
            background: `linear-gradient(135deg, ${color} 0%, ${secondaryColor} 100%)`,
            borderRadius: '1.5rem',
            padding: '1.25rem',
            color: 'white',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '120px',
            boxShadow: `0 10px 20px ${color}33`,
            position: 'relative',
            overflow: 'hidden',
            border: 'none',
            cursor: onClick ? 'pointer' : 'default'
        }}
        onClick={onClick}
    >
        {/* Decorative background circle */}
        <div style={{
            position: 'absolute',
            bottom: '-20%',
            right: '-10%',
            width: '10rem',
            height: '10rem',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.1)',
            zIndex: 0
        }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
                <p style={{ fontSize: '0.875rem', fontWeight: 600, opacity: 0.9, marginBottom: '0.25rem' }}>{title}</p>
                {loading ? (
                    <Skeleton width="120px" height="2.2rem" style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '0.5rem' }} />
                ) : (
                    <h3 style={{ fontSize: '1.875rem', fontWeight: 900, margin: 0, letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</h3>
                )}
            </div>
            <div style={{
                background: 'rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(4px)',
                padding: '0.75rem',
                borderRadius: '1rem',
                border: '1px solid rgba(255, 255, 255, 0.3)'
            }}>
                <Icon size={24} strokeWidth={2.5} />
            </div>
        </div>

        <div style={{ position: 'relative', zIndex: 1, marginTop: '1rem' }}>
            {loading ? (
                <Skeleton width="100px" height="1.2rem" style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '1rem' }} />
            ) : trend && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    background: 'rgba(255, 255, 255, 0.2)',
                    padding: '0.4rem 0.75rem',
                    borderRadius: '2rem',
                    width: 'fit-content',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                    <ArrowUpRight size={14} />
                    {trend}
                </div>
            )}
        </div>
    </motion.div>
);

const Payments: React.FC<PaymentsProps> = ({ paymentMethods = [], fraudProtection = false }) => {
    const dispatch = useDispatch<AppDispatch>();
    const { payments, stats, pagination, loading: paymentsLoading, specialists } = useSelector((state: RootState) => state.payments);
    const { appointments } = useSelector((state: RootState) => state.appointments);
    const { settings } = useSelector((state: RootState) => state.settings); // Use global settings

    const navigate = useNavigate();
    const { user, isStaff, isAdmin, isManager, hasPermission } = useAuth();
    const canCancel = hasPermission('payments', 'edit');
    const { showToast } = useToast();
    const { formatPrice, currency, symbol } = useCurrency();

    const maskPhone = (phone: string | undefined | null) => {
        if (!phone || phone === 'N/A') return 'N/A';
        if (phone.length <= 4) return phone;
        return phone.slice(0, phone.length - 4) + '****';
    };

    const getLabel = (m: string) => {
        if (!m) return 'N/A';
        const clean = m.toUpperCase().trim();
        
        let matched = paymentMethods.find(pm => 
            pm.id.toUpperCase() === clean || 
            pm.name.toUpperCase().trim() === clean
        );
        
        if (!matched && settings) {
            const activeMethods = settings.paymentMethods || [];
            matched = activeMethods.find((pm: any) => 
                pm.id?.toUpperCase() === clean || 
                pm.name?.toUpperCase().trim() === clean
            );
        }
        
        if (matched) return matched.name;
        
        if (clean === 'GOOGLEPAY' || clean === 'GPAY') return 'GPay';
        if (clean === 'PHONEPE' || clean === 'PHONEPA') return 'PhonePe';
        if (clean === 'PAYTM') return 'Paytm';
        if (clean === 'CASH') return 'Cash';
        if (clean === 'CARD') return 'Card';
        if (clean === 'UPI') return 'UPI';
        if (clean === 'RAZORPAY') return 'Razorpay';
        if (clean === 'VOUCHER') return 'Voucher';
        if (clean === 'PACKAGE') return 'Package';
        
        return m;
    };

    const getSaleSettlementDetails = (row: Payment) => {
        if (!row.sale) {
            return {
                actualPayments: [{ id: row.id, method: row.paymentMethod, amount: row.amount }],
                totalRedemptionValue: 0,
                effectiveDisc: 0,
                originalSubtotal: row.amount,
                totalPayable: row.amount,
                isSplit: false,
                allMethods: [row.paymentMethod]
            };
        }

        const { originalSubtotal, totalRedemptionValue } = (row.sale.items || []).reduce(
            (sums: { originalSubtotal: number; totalRedemptionValue: number }, item: any) => {
                const isRed = item.price === 0 || item.redeemedQuantity > 0 || item.redeemedFromPackageId;
                let origPrice = item.price || 0;
                if (isRed && origPrice === 0) {
                    const foundService = services.find((s: any) => 
                        (item.serviceId && String(s.id) === String(item.serviceId)) || 
                        (item.itemId && String(s.id) === String(item.itemId)) ||
                        (item.id && String(s.id) === String(item.id)) ||
                        (s.name && s.name.toLowerCase() === item.name.toLowerCase())
                    );
                    if (foundService) {
                        origPrice = foundService.price || 0;
                    } else {
                        const foundProduct = products.find((p: any) => 
                            (item.productId && String(p.id) === String(item.productId)) ||
                            (item.itemId && String(p.id) === String(item.itemId)) ||
                            (item.id && String(p.id) === String(item.id)) ||
                            (p.name && p.name.toLowerCase() === item.name.toLowerCase())
                        );
                        if (foundProduct) {
                            origPrice = foundProduct.sellingPrice || foundProduct.price || foundProduct.retailPrice || 0;
                        }
                    }
                }
                sums.originalSubtotal += (origPrice * item.quantity);
                if (isRed) {
                    sums.totalRedemptionValue += (origPrice * item.quantity);
                }
                return sums;
            },
            { originalSubtotal: 0, totalRedemptionValue: 0 }
        );

        const nonRedeemedSubtotal = originalSubtotal - totalRedemptionValue;
        const totalPayable = (row.sale as any)?.totalAmount || row.amount || 0;
        const explicitDisc = (row.sale as any)?.discount || 0;
        const effectiveDisc = explicitDisc > 0 ? explicitDisc : Math.max(0, nonRedeemedSubtotal - totalPayable);

        const actualPayments = row.sale.payments && row.sale.payments.length > 0
            ? row.sale.payments.map((p: any) => ({ id: p.id, method: p.paymentMethod, amount: p.amount }))
            : [{ id: row.id, method: row.paymentMethod, amount: row.amount }];

        const allMethods: string[] = [];
        actualPayments.forEach(p => {
            if (p.amount > 0 || actualPayments.length === 1) {
                allMethods.push(p.method);
            }
        });

        if (totalRedemptionValue > 0) {
            allMethods.push('PACKAGE');
        }
        if (effectiveDisc > 0) {
            allMethods.push('VOUCHER');
        }

        const uniqueMethods = [...new Set(allMethods)];
        const isSplit = uniqueMethods.length > 1;

        return {
            actualPayments,
            totalRedemptionValue,
            effectiveDisc,
            originalSubtotal,
            totalPayable,
            isSplit,
            allMethods: uniqueMethods
        };
    };

    const getRowDisplayAmount = (row: Payment) => {
        if ((row as any).isPendingSale) {
            return row.amount;
        }
        if (!row.sale) {
            let method = row.paymentMethod?.toUpperCase() || 'UNKNOWN';
            if (row.notes && typeof row.notes === 'string' && row.notes.includes('Method:')) {
                const match = row.notes.match(/Method:\s*([^|]+)/);
                if (match && match[1]) method = match[1].trim().toUpperCase();
            }
            const isRedemption = method === 'VOUCHER' || method === 'PACKAGE' || method === 'REDEEM';
            return isRedemption ? 0 : row.amount;
        }

        const actualPayments = row.sale.payments && row.sale.payments.length > 0
            ? row.sale.payments
            : [row];

        return actualPayments.reduce((sum: number, p: any) => {
            let method = p.paymentMethod?.toUpperCase() || 'UNKNOWN';
            if (p.notes && typeof p.notes === 'string' && p.notes.includes('Method:')) {
                const match = p.notes.match(/Method:\s*([^|]+)/);
                if (match && match[1]) method = match[1].trim().toUpperCase();
            }
            const isRedemption = method === 'VOUCHER' || method === 'PACKAGE' || method === 'REDEEM';
            return sum + (isRedemption ? 0 : p.amount);
        }, 0);
    };

    // Removed local payments, stats, cashiers, settings state
    // const [payments, setPayments] = useState<Payment[]>();
    // const [stats, setStats] = useState({...});
    // const [loading, setLoading] = useState(true);
    // const [settings, setSettings] = useState<any>(null);

    const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [previewAttachment, setPreviewAttachment] = useState<{ url: string, name: string } | null>(null);

    // Cancellation State
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [isCancelling, setIsCancelling] = useState(false);

    // Fetch catalog data for actual price lookups on package redemptions
    const [services, setServices] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);

    useEffect(() => {
        const fetchCatalogData = async () => {
            try {
                const [servicesRes, productsRes] = await Promise.all([
                    api.get('/services').catch(() => ({ data: [] })),
                    api.get('/inventory').catch(() => ({ data: [] }))
                ]);
                setServices(Array.isArray(servicesRes.data) ? servicesRes.data : []);
                setProducts(Array.isArray(productsRes.data) ? productsRes.data : []);
            } catch (err) {
                console.error('Failed to fetch catalog data for pricing lookups:', err);
            }
        };
        fetchCatalogData();
    }, []);

    // Intelligence Matcher (Same logic as Reconciliation for consistency)
    const isMatching = (backendKey: string, settingsName: string): boolean => {
        if (!backendKey || !settingsName) return false;
        const normalizedBackend = backendKey.toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
        const normalizedSettings = settingsName.toUpperCase().replace(/[^A-Z0-9]/g, '').trim();

        // Direct check
        if (normalizedBackend === normalizedSettings) return true;

        // Prefix check (e.g., GPAY matches GOOGLEPAY)
        if (normalizedSettings.startsWith(normalizedBackend) || normalizedBackend.startsWith(normalizedSettings)) return true;

        // Alias Library
        const aliases: Record<string, string[]> = {
            'ONLINEPAY': ['AMAZON', 'ONLINE', 'RAZORPAY', 'TEST'],
            'GPAY': ['GOOGLEPAY', 'GOOGLE', 'GPAY'],
            'PHONEPE': ['PHONEPA', 'PHONE', 'PE'],
            'CASH': ['PHYSICAL', 'CASH'],
            'CARD': ['VISA', 'MASTERCARD', 'CREDIT', 'DEBIT']
        };

        for (const [key, variants] of Object.entries(aliases)) {
            const isBackendMatchingKey = normalizedBackend === key || variants.includes(normalizedBackend);
            const isSettingsMatchingKey = normalizedSettings === key || variants.includes(normalizedSettings);
            if (isBackendMatchingKey && isSettingsMatchingKey) return true;
        }

        return false;
    };

    // Breakdown State
    const [breakdownData, setBreakdownData] = useState<any>(null);
    const [isBreakdownModalOpen, setIsBreakdownModalOpen] = useState(false);
    const [breakdownLoading, setBreakdownLoading] = useState(false);
    const [breakdownTitle, setBreakdownTitle] = useState('');

    // Filters
    const getToday = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const [dateRange, setDateRange] = useState({ start: getToday(), end: getToday() });
    const [minAmount, setMinAmount] = useState('');
    const [customerSearch, setCustomerSearch] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('ALL');
    const [status, setStatus] = useState('ALL');
    const [selectedSpecialist, setSelectedSpecialist] = useState('ALL');
    // const [cashiers, setCashiers] = useState<string[]>();

    // Use Redux pagination or local override? 
    // Let's stick to local page control triggering Redux fetch
    const [currentPage, setCurrentPage] = useState(1);
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(customerSearch);
        }, 500);
        return () => clearTimeout(timer);
    }, [customerSearch]);

    const isFirstLoad = React.useRef(true);
    // Debounce min amount changes

    const handleExport = () => {
        if (filteredPayments.length === 0) return showToast('No data to export', 'error');

        const headers = ['Date', 'ID', 'Customer', 'Specialist', 'Amount', 'Method', 'Status', 'Type', 'Phone'];
        const rows = filteredPayments.map(p => {
            const phone = p.appointment?.customer?.mobile || (p.sale as any)?.customer?.mobile || '';
            const details = getSaleSettlementDetails(p);
            const methodLabel = details.isSplit 
                ? `Split (${details.allMethods.map(m => getLabel(m)).join(' + ')})` 
                : getLabel(p.paymentMethod);
            return [
                new Date(p.createdAt).toLocaleDateString(),
                p.transactionId || p.id,
                p.appointment?.customer?.name || (p.sale as any)?.customer?.name || 'Walk-in',
                p.appointment?.stylist?.name || p.sale?.specialist?.name || '-',
                getRowDisplayAmount(p),
                methodLabel,
                p.isPendingSale ? (p.appointment?.status?.toUpperCase() === 'CANCELLED' ? 'CANCELLED' : 'PENDING') : (p.sale?.saleStatus || p.paymentStatus),
                p.paymentType,
                (isStaff && fraudProtection) ? maskPhone(phone) : phone
            ];
        });

        const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `payments_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrintReceipt = () => {
        const data = getInvoiceData();
        if (!data) return;

        const receiptHtml = generateReceiptHtml({
            storeName: data.salonName,
            storeAddress: data.salonAddress,
            storePhone: data.salonPhone,
            invoiceNumber: data.invoiceNumber,
            date: new Date(selectedPayment!.createdAt).toLocaleString(),
            customerName: data.customerName,
            items: data.items,
            subtotal: data.subtotal,
            discount: data.discount,
            total: data.total,
            paymentMethod: data.paymentMethod,
            cashierName: data.cashierName,
            currencySymbol: data.currencySymbol === 'Rs.' ? '₹' : data.currencySymbol,
            payments: data.payments.length > 1 ? data.payments : undefined
        });

        const printWindow = window.open('', '_blank', 'width=400,height=600');
        if (printWindow) {
            printWindow.document.write(receiptHtml);
            printWindow.document.close();
        }
    };

    useEffect(() => {
        setCurrentPage(1); // Reset to page 1 when filters change
    }, [dateRange, paymentMethod, status, minAmount, customerSearch, selectedSpecialist]);

    const getSymbol = (curr: string) => {
        switch (curr) {
            case 'INR': return '₹';
            case 'USD': return '$';
            case 'EUR': return '€';
            case 'GBP': return '£';
            case 'SGD': return '$';
            default: return curr;
        }
    };

    const formatDate = (date: string) => {
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}-${month}-${year}`;
    };

    // Initial Fetch (Cashiers & Settings)
    useEffect(() => {
        dispatch(fetchSettings());
        dispatch(fetchSpecialists());
    }, [dispatch]);

    const getInvoiceData = () => {
        if (!selectedPayment) return null;

        const invoiceNum = selectedPayment.invoiceNumber || (selectedPayment.sale as any)?.saleNumber || selectedPayment.transactionId || selectedPayment.id;

        const details = getSaleSettlementDetails(selectedPayment);
        const originalSubtotal = details.originalSubtotal;
        const totalRedemptionValue = details.totalRedemptionValue;
        const totalPayable = details.totalPayable;
        const effectiveDisc = details.effectiveDisc;
        const isSplit = details.isSplit;

        const paymentsList: Array<{ paymentMethod: string; amount: number }> = [];
        
        details.actualPayments.forEach((p: any) => {
            if (p.amount > 0 || details.actualPayments.length === 1) {
                paymentsList.push({
                    paymentMethod: getLabel(p.method),
                    amount: p.amount
                });
            }
        });
        
        if (totalRedemptionValue > 0) {
            paymentsList.push({
                paymentMethod: 'Package Redemption',
                amount: totalRedemptionValue
            });
        }
        
        if (effectiveDisc > 0) {
            paymentsList.push({
                paymentMethod: 'Voucher / Discount',
                amount: effectiveDisc
            });
        }

        const formattedItems = selectedPayment.sale?.items 
            ? selectedPayment.sale.items.map((item: any) => {
                const isRed = item.price === 0 || item.redeemedQuantity > 0 || item.redeemedFromPackageId;
                let origPrice = item.price || 0;
                if (isRed && origPrice === 0) {
                    const foundService = services.find((s: any) => 
                        (item.serviceId && String(s.id) === String(item.serviceId)) || 
                        (item.itemId && String(s.id) === String(item.itemId)) ||
                        (item.id && String(s.id) === String(item.id)) ||
                        (s.name && s.name.toLowerCase() === item.name.toLowerCase())
                    );
                    if (foundService) {
                        origPrice = foundService.price || 0;
                    } else {
                        const foundProduct = products.find((p: any) => 
                            (item.productId && String(p.id) === String(item.productId)) ||
                            (item.itemId && String(p.id) === String(item.itemId)) ||
                            (item.id && String(p.id) === String(item.id)) ||
                            (p.name && p.name.toLowerCase() === item.name.toLowerCase())
                        );
                        if (foundProduct) {
                            origPrice = foundProduct.sellingPrice || foundProduct.price || foundProduct.retailPrice || 0;
                        }
                    }
                }
                return {
                    name: item.name + (isRed ? ' (Redeemed)' : ''),
                    quantity: item.quantity,
                    price: origPrice
                };
            })
            : [
                {
                    name: selectedPayment.appointment?.service?.name || 'General Service',
                    quantity: 1,
                    price: selectedPayment.amount
                }
            ];

        return {
            salonName: settings?.salonName || 'Lumière Salon',
            salonAddress: settings?.salonAddress || '',
            salonPhone: settings?.salonPhone || '',
            invoiceNumber: invoiceNum,
            date: formatDate(selectedPayment.createdAt),
            customerName: selectedPayment.appointment?.customer?.name || (selectedPayment.sale as any)?.customer?.name || 'Walk-in Customer',
            customerPhone: selectedPayment.appointment?.customer?.mobile || (selectedPayment.sale as any)?.customer?.mobile || '',
            items: formattedItems,
            subtotal: originalSubtotal || selectedPayment.amount,
            discount: effectiveDisc + totalRedemptionValue,
            total: totalPayable,
            paymentMethod: isSplit ? 'Split Payment' : getLabel(selectedPayment.paymentMethod),
            cashierName: selectedPayment.cashierName || 'Admin',
            currencySymbol: settings?.currency === 'INR' || currency === 'INR' ? 'Rs.' : (settings?.currency ? getSymbol(settings.currency) : symbol),
            payments: paymentsList
        };
    };

    const handleDownloadPDF = () => {
        const data = getInvoiceData();
        if (data) generateInvoicePDF(data);
    };

    const loadPayments = () => {
        const params: any = {
            page: currentPage,
            limit: 10
        };
        if (dateRange.start) params.startDate = dateRange.start;
        if (dateRange.end) params.endDate = dateRange.end;
        
        // Only send paymentMethod to backend if it's a real stored method
        // PACKAGE and VOUCHER are system-calculated client-side from zero-amount sales
        if (paymentMethod !== 'ALL' && paymentMethod !== 'PACKAGE' && paymentMethod !== 'VOUCHER') {
            params.paymentMethod = paymentMethod;
        }
        
        if (status !== 'ALL') params.status = status;
        if (selectedSpecialist !== 'ALL') params.specialist = selectedSpecialist;
        if (debouncedSearch) {
            params.customerSearch = debouncedSearch;
            params.search = debouncedSearch; // Dual-param for better backend compatibility
        }
        if (minAmount) params.minAmount = Number(minAmount);

        dispatch(fetchPayments(params));
        dispatch(fetchAppointments());
    };

    useEffect(() => {
        loadPayments();
    }, [dateRange, paymentMethod, status, currentPage, minAmount, debouncedSearch, selectedSpecialist]);

    // Also trigger load on Refresh button
    const fetchPaymentsHandler = () => {
        dispatch(invalidatePaymentCache());
        dispatch(fetchSpecialists());
        loadPayments();
    };

    const handleShowBreakdown = async (type: 'total' | 'cash' | 'digital') => {
        setBreakdownTitle(type === 'total' ? 'Revenue Breakdown' : type === 'cash' ? 'Cash Breakdown' : 'Digital Breakdown');
        setIsBreakdownModalOpen(true);
        setBreakdownLoading(true);

        try {
            const params: any = {
                page: 1,
                limit: 1000 // Fetch a large sample for accurate breakdown
            };
            if (dateRange.start) params.startDate = dateRange.start;
            if (dateRange.end) params.endDate = dateRange.end;
            if (status !== 'ALL') params.status = status;
            if (paymentMethod !== 'ALL') params.paymentMethod = paymentMethod;
            if (selectedSpecialist !== 'ALL') params.specialist = selectedSpecialist;
            if (debouncedSearch) {
                params.customerSearch = debouncedSearch;
            }

            const response = await api.get('/payments', { params });
            const allItems = response.data.payments || [];

            const breakdown: Record<string, number> = {};

            // Get current active methods from settings to map breakdown rows
            const activeMethods = settings?.paymentMethods || [];

            allItems.forEach((p: any) => {
                // Only count COMPLETED payments to match the summary cards
                if (p.paymentStatus !== 'COMPLETED') return;

                const method = (p.paymentMethod || 'UNKNOWN').toUpperCase();
                const isCash = method === 'CASH';

                if (type === 'total' || (type === 'cash' && isCash) || (type === 'digital' && !isCash)) {
                    // Try to get custom method from notes
                    let rawMethod = method;
                    if (p.notes && typeof p.notes === 'string' && p.notes.includes('Method:')) {
                        const match = p.notes.match(/Method:\s*([^|]+)/);
                        if (match && match[1]) rawMethod = match[1].trim().toUpperCase();
                    }

                    // Map raw backend key to a friendly name from Settings using isMatching
                    let displayLabel = rawMethod;
                    const matchedSetting = activeMethods.find((m: any) => isMatching(rawMethod, m.name));
                    if (matchedSetting) {
                        displayLabel = matchedSetting.name;
                    } else {
                        // Special labels for legacy/system keys
                        if (rawMethod === 'ONLINEPAY' || rawMethod === 'RAZORPAY') displayLabel = 'Online Pay (System)';
                        if (rawMethod === 'CASH') displayLabel = 'Cash';
                    }

                    breakdown[displayLabel] = (breakdown[displayLabel] || 0) + p.amount;
                }
            });

            setBreakdownData(breakdown);
        } catch (error) {
            console.error('Failed to fetch breakdown:', error);
            showToast('Failed to load breakdown data', 'error');
        } finally {
            setBreakdownLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'COMPLETED': return 'bg-emerald-100 text-emerald-700';
            case 'PENDING': return 'bg-amber-100 text-amber-700';
            case 'FAILED': return 'bg-red-100 text-red-700';
            case 'REFUNDED': return 'bg-purple-100 text-purple-700';
            case 'PARTIAL': return 'bg-blue-100 text-blue-700';
            case 'DRAFT': return 'bg-slate-200 text-black';
            case 'CANCELLED': return 'bg-red-50 text-red-600 font-black border-red-200';
            default: return 'bg-slate-100 text-black';
        }
    };

    // Memoize the combined list of real payments + synthesized pending appointments
    const combinedPayments = React.useMemo(() => {
        // 1. Base payments from API
        // Normalize amounts for redemptions to ensure consistency with Sales History ($0 cash impact)
        let list = payments.map(p => {
            let method = p.paymentMethod?.toUpperCase() || 'UNKNOWN';
            if (p.notes && typeof p.notes === 'string' && p.notes.includes('Method:')) {
                const match = p.notes.match(/Method:\s*([^|]+)/);
                if (match && match[1]) method = match[1].trim().toUpperCase();
            }

            // Broad check for redemptions
            const isRedemption = method === 'VOUCHER' || method === 'PACKAGE' || method === 'REDEEM';
            
            // If it's a redemption payment, it shouldn't show a cash impact in this list (consistent with Sales History)
            if (isRedemption && p.amount !== 0) {
                return { ...p, amount: 0, originalAmount: p.amount };
            }
            return p;
        });

        // 2. Synthesize pending payments from CONFIRMED appointments
        if (appointments && appointments.length > 0) {
            const confirmedAppts = appointments.filter(a => {
                const apptStatus = a.status?.toUpperCase();
                const payStatus = a.paymentStatus?.toUpperCase() || 'PENDING';
                return (apptStatus === 'CONFIRMED' || apptStatus === 'CANCELLED') && payStatus !== 'COMPLETED' && payStatus !== 'PAID' && payStatus !== 'PARTIAL';
            });

            const synthesized: Payment[] = confirmedAppts.map(appt => ({
                id: `pending-${appt.id}`,
                transactionId: `PENDING-CHECKOUT-${appt.id.toString().slice(-6).toUpperCase()}`,
                appointmentId: appt.id.toString(),
                amount: appt.totalAmount || appt.price || (appt.service?.price || 0),
                paymentMethod: 'PENDING',
                paymentStatus: 'PENDING',
                paymentType: 'SALE',
                createdAt: appt.startTime || (appt as any).date || (appt as any).createdAt || new Date().toISOString(),
                updatedAt: (appt as any).updatedAt || new Date().toISOString(),
                // Attach the appointment object so the table renderer knows who the customer etc. is
                appointment: appt as any,
                // Flag to help UI know this isn't a real saved transaction yet
                isPendingSale: true,
                sale: {
                    saleStatus: 'PENDING',
                    saleNumber: 'Awaiting Checkout...',
                    invoiceNumber: '--'
                } as any
            }));

            // Only add synthesized ones if they aren't somehow already in the actual payments list
            const existingApptIds = new Set(payments.map(p => p.appointmentId).filter(Boolean));
            const uniqueSynthesized = synthesized.filter(s => !existingApptIds.has(s.appointmentId));

            list = [...uniqueSynthesized, ...list];
        }

        // 3. De-duplicate list by saleId (if present) to group split payment rows client-side
        const seenSaleIds = new Set<string>();
        const deDuplicatedList: Payment[] = [];
        
        for (const p of list) {
            const saleId = p.sale?.id || p.saleId;
            if (saleId) {
                if (seenSaleIds.has(saleId)) {
                    continue; // Skip subsequent duplicate rows for the same sale
                }
                seenSaleIds.add(saleId);
            }
            deDuplicatedList.push(p);
        }

        return deDuplicatedList;
    }, [payments, appointments]);

    // Memoize the filtered list of payments based on active filters and search
    const filteredPayments = React.useMemo(() => {
        let filtered = [...combinedPayments];

        // Client-side Date Filter (crucial for synthesized appointments from Redux)
        if (dateRange.start) {
            const startObj = new Date(dateRange.start);
            startObj.setHours(0, 0, 0, 0);
            filtered = filtered.filter(p => {
                const d = new Date(p.createdAt);
                d.setHours(0, 0, 0, 0);
                return d.getTime() >= startObj.getTime();
            });
        }
        if (dateRange.end) {
            const endObj = new Date(dateRange.end);
            endObj.setHours(0, 0, 0, 0);
            filtered = filtered.filter(p => {
                const d = new Date(p.createdAt);
                d.setHours(0, 0, 0, 0);
                return d.getTime() <= endObj.getTime();
            });
        }
        
        // Client-side Method Filter
        if (paymentMethod !== 'ALL') {
            filtered = filtered.filter(p => {
                let displayMethod = p.paymentMethod?.toUpperCase() || 'UNKNOWN';
                if (p.notes && typeof p.notes === 'string' && p.notes.includes('Method:')) {
                    const match = p.notes.match(/Method:\s*([^|]+)/);
                    if (match && match[1]) displayMethod = match[1].trim().toUpperCase();
                }

                // Sync filter detection with table display logic
                if ((displayMethod === 'PENDING' || displayMethod === 'UNKNOWN' || displayMethod === 'CASH') &&
                    p.amount === 0 &&
                    !p.isPendingSale &&
                    (p.sale?.saleStatus === 'COMPLETED' || p.paymentStatus === 'COMPLETED')) {

                    const isPackageRedemption = p.sale?.items?.some((item: any) => item.redeemedFromPackageId);
                    displayMethod = isPackageRedemption ? 'PACKAGE' : 'VOUCHER';
                }
                return displayMethod === paymentMethod;
            });
        }

        // Client-side Status Filter
        if (status !== 'ALL') {
            filtered = filtered.filter(p => {
                const pStatus = p.isPendingSale ? (p.appointment?.status?.toUpperCase() === 'CANCELLED' ? 'CANCELLED' : 'PENDING') : (p.sale?.saleStatus || p.paymentStatus);
                return pStatus === status;
            });
        }

        // Client-side Specialist Filter
        if (selectedSpecialist !== 'ALL') {
            filtered = filtered.filter(p => {
                const spec = p.appointment?.stylist?.name || p.sale?.specialist?.name || '-';
                return spec === selectedSpecialist;
            });
        }

        // Client-side fallback filter to ensure "correct" filtering for current page
        if (customerSearch.trim()) {
            const term = customerSearch.toLowerCase();
            filtered = filtered.filter(p => {
                const name = (p.appointment?.customer?.name || (p.sale as any)?.customer?.name || '').toLowerCase();
                const phone = (p.appointment?.customer?.mobile || (p.sale as any)?.customer?.mobile || '');
                const invoice = (p.sale?.invoiceNumber || p.invoiceNumber || '').toLowerCase();
                const saleNum = (p.sale?.saleNumber || '').toLowerCase();
                return name.includes(term) || phone.includes(term) || invoice.includes(term) || saleNum.includes(term);
            });
        }

        // [LAST-RESORT VISUAL SAFEGUARD]
        const min = minAmount ? Number(minAmount) : 0;
        if (min > 0) {
            filtered = filtered.filter(p => (getRowDisplayAmount(p) >= min));
        }
        return filtered;
    }, [combinedPayments, dateRange, paymentMethod, status, selectedSpecialist, customerSearch, minAmount]);

    const columns = [
        {
            header: 'Date',
            accessor: (row: Payment) => (
                <div className="font-bold text-black dark:text-black">
                    {new Date(row.createdAt).toLocaleDateString()}
                </div>
            )
        },
        {
            header: 'Invoice #',
            accessor: (row: Payment) => (
                <div className="text-xs font-mono text-black font-medium">
                    {/* Prioritize Invoice Number field, fallback to saleNumber only if needed (for legacy data) */}
                    {row.sale?.invoiceNumber || row.invoiceNumber || (row.sale?.saleNumber?.startsWith('INV') ? row.sale?.saleNumber : '-')}
                </div>
            )
        },
        {
            header: 'Customer',
            accessor: (row: Payment) => {
                const hasCombo = row.sale?.items?.some((item: any) => item.type === 'combo');
                return (
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="font-medium text-black dark:text-black">
                                {row.appointment?.customer?.name || (row.sale as any)?.customer?.name || 'Walk-in'}
                            </div>
                            {hasCombo && (
                                <span className="text-[10px] font-bold px-1 py-0.5 rounded bg-orange-100 text-orange-600 uppercase tracking-wider">Combo</span>
                            )}
                        </div>
                        {/* Display Sale Number if available */}
                        {row.sale?.saleNumber && (
                            <div className="text-[11px] text-indigo-600 font-medium">
                                {row.sale.saleNumber}
                            </div>
                        )}
                        <div className="text-xs text-black">
                            {/* {(row.appointment?.service?.name && `Appt: ${row.appointment.service.name}`)} */}
                            {(row.appointment?.customer?.mobile || (row.sale as any)?.customer?.mobile) && (
                                <span className="ml-1 opacity-60">• {(isStaff && fraudProtection) ? maskPhone(row.appointment?.customer?.mobile || (row.sale as any)?.customer?.mobile) : (row.appointment?.customer?.mobile || (row.sale as any)?.customer?.mobile)}</span>
                            )}
                        </div>
                    </div>
                );
            }
        },
        {
            header: 'Amount',
            accessor: (row: Payment) => {
                return (
                    <div className="font-bold text-black dark:text-black">
                        {formatPrice(getRowDisplayAmount(row))}
                    </div>
                );
            }
        },
        {
            header: 'Specialist',
            accessor: (row: Payment) => {
                // Collect unique specialists from all items
                const itemSpecialists = row.sale?.items
                    ?.map((item: any) => item.specialistName)
                    .filter((name: string | undefined): name is string => !!name) || [];
                
                const uniqueSpecialists = [...new Set(itemSpecialists)];
                
                if (uniqueSpecialists.length > 0) {
                    return (
                        <div className="text-sm text-black dark:text-black font-medium">
                            {uniqueSpecialists.join(', ')}
                        </div>
                    );
                }

                return (
                    <div className="text-sm text-black dark:text-black">
                        {row.appointment?.stylist?.name || row.sale?.specialist?.name || '-'}
                    </div>
                );
            }
        },
        {
            header: 'Method',
            accessor: (row: Payment) => {
                const details = getSaleSettlementDetails(row);
                if (details.isSplit) {
                    const uniqueMethods = [...new Set(details.allMethods.map(m => getLabel(m)))];
                    const tooltipParts: string[] = [];
                    details.actualPayments.forEach(p => {
                        if (p.amount > 0) {
                            tooltipParts.push(`${getLabel(p.method)}: ${formatPrice(p.amount)}`);
                        }
                    });
                    if (details.totalRedemptionValue > 0) {
                        tooltipParts.push(`Package: ${formatPrice(details.totalRedemptionValue)}`);
                    }
                    if (details.effectiveDisc > 0) {
                        tooltipParts.push(`Voucher/Discount: ${formatPrice(details.effectiveDisc)}`);
                    }

                    return (
                        <div className="flex items-center">
                            <span
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border"
                                style={{
                                    backgroundColor: '#fffbeb', // amber-50
                                    color: '#b45309', // amber-700
                                    borderColor: '#fde68a', // amber-200
                                }}
                                title={tooltipParts.join(', ')}
                            >
                                <RefreshCw size={10} />
                                Split ({uniqueMethods.join(' + ')})
                            </span>
                        </div>
                    );
                }

                // Extract custom method from notes if available
                let displayMethod = row.paymentMethod?.toUpperCase() || 'UNKNOWN';

                if (row.notes && (row.notes as string).includes('Method:')) {
                    const match = (row.notes as string).match(/Method:\s*([^|]+)/);
                    if (match && match[1]) {
                        displayMethod = match[1].trim().toUpperCase();
                    }
                }

                // Check for Voucher/Package Redemption (Zero amount completed sales)
                // [FIX] Ensure we don't label PENDING invoices (like converted quotations) as Vouchers
                if ((displayMethod === 'UNKNOWN' || displayMethod === 'CASH') &&
                    row.amount === 0 &&
                    !row.isPendingSale &&
                    (row.sale?.saleStatus === 'COMPLETED' || row.paymentStatus === 'COMPLETED')) {
                    
                    // Distinguish between Package and Voucher
                    const isPackageRedemption = row.sale?.items?.some((item: any) => item.redeemedFromPackageId);
                    if (isPackageRedemption) {
                        displayMethod = 'PACKAGE';
                    } else {
                        displayMethod = 'VOUCHER';
                    }
                }

                const method = displayMethod;

                // Handle different payment methods with specific colors
                const getMethodStyles = (m: string) => {
                    switch (m) {
                        case 'CASH':
                            return { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0', icon: <DollarSign size={12} /> };
                        case 'GPAY':
                        case 'GOOGLEPAY':
                            return { bg: '#eef2ff', text: '#4338ca', border: '#e0e7ff', icon: <Smartphone size={12} /> };
                        case 'PHONEPE':
                        case 'PHONEPA':
                            return { bg: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe', icon: <Smartphone size={12} /> };
                        case 'PAYTM':
                            return { bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd', icon: <Smartphone size={12} /> };
                        case 'RAZORPAY':
                            return { bg: '#eff6ff', text: '#1d4ed8', border: '#dbeafe', icon: <CreditCard size={12} /> };
                        case 'UPI':
                            return { bg: '#ecfeff', text: '#0891b2', border: '#cffafe', icon: <Smartphone size={12} /> };
                        case 'VOUCHER':
                            return { bg: '#fce7f3', text: '#be185d', border: '#fbcfe8', icon: <Wallet size={12} /> };
                        case 'PACKAGE':
                            return { bg: '#fef3c7', text: '#92400e', border: '#fde68a', icon: <Package size={12} /> };
                        default:
                            return { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0', icon: <CreditCard size={12} /> };
                    }
                };

                const styles = getMethodStyles(method);

                return (
                    <div className="flex items-center">
                        <span
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border"
                            style={{
                                backgroundColor: styles.bg,
                                color: styles.text,
                                borderColor: styles.border
                            }}
                        >
                            {styles.icon}
                            {getLabel(method)}
                        </span>
                    </div>
                );
            }
        },
        {
            header: 'Status',
            accessor: (row: Payment) => {
                const displayStatus = row.isPendingSale 
                    ? (row.appointment?.status?.toUpperCase() === 'CANCELLED' ? 'CANCELLED' : 'PENDING') 
                    : (row.sale?.saleStatus || row.paymentStatus);
                return (
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider border ${getStatusColor(displayStatus)}`}>
                        {displayStatus}
                    </span>
                );
            }
        },
        {
            header: 'Actions',
            accessor: (row: Payment) => (
                <div style={{ display: 'flex', gap: '0.5rem' }} >
                    {
                        (row.sale && (row.sale as any).balanceAmount > 0) && (
                            <Button
                                variant="ghost"
                                icon={<Play size={16} />}
                                style={{
                                    backgroundColor: '#dbeafe', // blue-100
                                    color: '#1d4ed8', // blue-700
                                    border: '1px solid #bfdbfe',
                                    padding: '0.4rem 0.75rem',
                                    borderRadius: '0.625rem',
                                    transition: 'all 0.2s'
                                }}
                                className="hover:bg-blue-200"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const subtotalAmount = (row.sale as any)?.subtotal || (row.sale?.items || []).reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0);
                                    const totalPayable = (row.sale as any)?.totalAmount || row.amount || 0;
                                    const explicitDiscount = (row.sale as any)?.discount || 0;
                                    // Fail-safe: if explicit discount is 0 but total < subtotal, infer the discount
                                    const effectiveDiscount = explicitDiscount > 0 ? explicitDiscount : Math.max(0, subtotalAmount - totalPayable);

                                    const partialData = {
                                        customerId: row.appointment?.customer?.id || (row.sale as any)?.customer?.id,
                                        customerName: row.appointment?.customer?.name || (row.sale as any)?.customer?.name,
                                        customerPhone: row.appointment?.customer?.mobile || (row.sale as any)?.customer?.mobile,
                                        paidAmount: row.sale?.paidAmount ?? 0,
                                        items: (row.sale as any)?.items || [],
                                        discount: effectiveDiscount,
                                        transactionId: row.transactionId || row.id,
                                        saleId: row.sale?.id,
                                        saleNumber: (row.sale as any)?.saleNumber,
                                        autoCheckout: true
                                    };
                                    const appId = (user as any)?.app_id || 'salon';
                                    const businessName = (user as any)?.businessName || 'admin';
                                    navigate(`/${appId}/${businessName}/sales`, { state: { partialPaymentData: partialData } });
                                }}
                            >
                                Continue
                            </Button>
                        )
                    }
                    <Button
                        variant="ghost"
                        icon={<Eye size={16} />}
                        style={{
                            backgroundColor: '#f1f5f9',
                            color: '#475569',
                            border: '1px solid #e2e8f0',
                            padding: '0.4rem 0.75rem',
                            borderRadius: '0.625rem',
                            transition: 'all 0.2s'
                        }}
                        className="hover:bg-slate-200 hover:text-black"
                        onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPayment(row);
                            setIsModalOpen(true);
                        }}
                    >
                        View
                    </Button>
                    {row.sale?.saleStatus !== 'CANCELLED' && 
                     row.appointment?.status?.toUpperCase() !== 'CANCELLED' && 
                     row.sale?.saleStatus !== 'COMPLETED' && 
                     row.paymentStatus !== 'COMPLETED' && (
                        <Button
                            variant="ghost"
                            icon={<XCircle size={16} />}
                            style={{
                                backgroundColor: 'rgba(239, 68, 68, 0.05)',
                                color: '#ef4444',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                padding: '0.4rem 0.75rem',
                                borderRadius: '0.625rem',
                                transition: 'all 0.2s',
                                opacity: !canCancel ? 0.5 : 1,
                                cursor: !canCancel ? 'not-allowed' : 'pointer'
                            }}
                            className="hover:bg-red-100"
                            disabled={!canCancel}
                            title={!canCancel ? "Ask Admin for permission" : ""}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!canCancel) { showToast("Ask Admin for permission", "error"); return; }
                                setSelectedPayment(row);
                                setIsCancelModalOpen(true);
                            }}
                        >
                            Cancel
                        </Button>
                    )}
                </div >
            )
        }
    ];

    const actions = [
        {
            icon: <Download size={18} />,
            label: 'Export',
            onClick: handleExport,
            variant: 'outline' as const
        }
    ];



    return (
        <div className="space-y-6 animate-in fade-in duration-500" style={{ position: 'relative' }}>
            <div className="flex justify-end items-center">
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <Button
                        onClick={fetchPaymentsHandler}
                        variant="primary"
                        icon={<RefreshCw size={18} className={paymentsLoading ? 'animate-spin' : ''} />}
                    >
                        Refresh
                    </Button>
                    <Button onClick={handleExport} icon={<Download size={18} />} variant="outline">
                        Export CSV
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid md-grid-cols-2 lg-grid-cols-4 gap-4 md:gap-6">
                <StatCard
                    title="Total Revenue"
                    value={formatPrice(stats.totalRevenue)}
                    icon={TrendingUp}
                    trend="+12% vs last month"
                    color="#4F46E5" // Indigo 600
                    secondaryColor="#9333EA" // Purple 600
                    loading={paymentsLoading}
                    onClick={() => handleShowBreakdown('total')}
                />
                <StatCard
                    title="Cash Collected"
                    value={formatPrice(stats.totalCash)}
                    icon={Wallet}
                    trend="Physical sales"
                    color="#059669" // Emerald 600
                    secondaryColor="#10B981" // Emerald 500
                    loading={paymentsLoading}
                    onClick={() => handleShowBreakdown('cash')}
                />
                <StatCard
                    title="Digital Payments"
                    value={formatPrice(stats.totalDigital)}
                    icon={CreditCard}
                    trend="PhonePe, Grab.."
                    color="#2563EB" // Blue 600
                    secondaryColor="#3B82F6" // Blue 500
                    loading={paymentsLoading}
                    onClick={() => handleShowBreakdown('digital')}
                />
                <StatCard
                    title="Balance Amount"
                    value={
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                            <span>{formatPrice(stats.totalBalanceAmount)}</span>
                            <span style={{ fontSize: '1rem', opacity: 0.8 }}>({stats.totalBalanceCount})</span>
                        </div>
                    }
                    icon={Clock}
                    color="#f59e0b" // Amber 500
                    secondaryColor="#fbbf24" // Amber 400
                    trend="Balance Collection"
                    onClick={() => {
                        setStatus('PARTIAL');
                        setCurrentPage(1);
                    }}
                    loading={paymentsLoading}
                />
            </div>

            {/* Filters */}
            <Card style={{ padding: '1.25rem' }}>
                <div className="flex flex-wrap items-end" style={{ gap: '6px 6px' }}>
                    <div className="space-y-1 min-w-[140px]">
                        <label className="text-xs font-semibold text-black block">Search</label>
                        <Input
                            type="text"
                            placeholder="Search by name, mobile, invoice or sale #"
                            value={customerSearch}
                            onChange={(e) => setCustomerSearch(e.target.value)}
                        />
                    </div>
                    {isAdmin && (
                        <>
                            <div className="space-y-1 min-w-[110px]">
                                <label className="text-xs font-semibold text-black block">Start Date</label>
                                <Input
                                    type="date"
                                    value={dateRange.start}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                    style={{ height: '44px', paddingTop: '0', paddingBottom: '0' }}
                                />
                            </div>
                            <div className="space-y-1 min-w-[110px]">
                                <label className="text-xs font-semibold text-black block">End Date</label>
                                <Input
                                    type="date"
                                    value={dateRange.end}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                    style={{ height: '44px', paddingTop: '0', paddingBottom: '0' }}
                                />
                            </div>
                        </>
                    )}
                    <div className="space-y-1 min-w-[180px]">
                        <label className="text-xs font-semibold text-black block">Amount</label>
                        <Select
                            // label prop removed
                            value={minAmount}
                            onChange={(e) => setMinAmount(e.target.value)}
                            style={{ height: '44px', paddingTop: '0', paddingBottom: '0' }}
                            options={[
                                { value: '', label: 'Any Amount' },
                                { value: '100', label: '100+' },
                                { value: '250', label: '250+' },
                                { value: '500', label: '500+' },
                                { value: '1000', label: '1000+' },
                                { value: '2000', label: '2000+' },
                                { value: '5000', label: '5000+' },
                                { value: '10000', label: '10000+' }
                            ]}
                        />
                    </div>
                    <div className="space-y-1 min-w-[180px]">
                        <label className="text-xs font-semibold text-black block">Method</label>
                        <Select
                            // label prop removed
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                            style={{ height: '44px', paddingTop: '0', paddingBottom: '0' }}
                            options={[
                                { value: 'ALL', label: 'All Methods' },
                                { value: 'PACKAGE', label: 'Package' },
                                { value: 'VOUCHER', label: 'Voucher' },
                                ...paymentMethods.map(m => ({
                                    value: m.id.toUpperCase(),
                                    label: m.name
                                }))
                            ]}
                        />
                    </div>
                    <div className="space-y-1 min-w-[150px]">
                        <label className="text-xs font-semibold text-black block">Status</label>
                        <Select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            style={{ height: '44px', paddingTop: '0', paddingBottom: '0' }}
                            options={[
                                { value: 'ALL', label: 'All Statuses' },
                                { value: 'COMPLETED', label: 'Completed' },
                                { value: 'PARTIAL', label: 'Partial' },
                                { value: 'DEPOSIT', label: 'Deposit (Advance)' },
                                { value: 'PENDING', label: 'Pending' },
                                { value: 'FAILED', label: 'Failed' },
                                { value: 'REFUNDED', label: 'Refunded' }
                            ]}
                        />
                    </div>
                    <div className="space-y-1 min-w-[110px]">
                        <label className="text-xs font-semibold text-black block">Specialist</label>
                        <Select
                            value={selectedSpecialist}
                            onChange={(e) => setSelectedSpecialist(e.target.value)}
                            style={{ height: '44px', paddingTop: '0', paddingBottom: '0' }}
                            options={[
                                { value: 'ALL', label: 'All Specialists' },
                                ...specialists.map(c => ({
                                    value: c,
                                    label: c
                                }))
                            ]}
                        />
                    </div>
                    <div className="space-y-1 flex-1 flex flex-col items-end">
                        <label className="text-xs font-semibold text-black block" style={{ visibility: 'hidden' }}>Actions</label>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <Button
                                onClick={() => {
                                    setCurrentPage(1);
                                    loadPayments();
                                }}
                                variant="primary"
                                className="font-medium"
                                style={{
                                    height: '44px',
                                    padding: '0 20px'
                                }}
                                icon={<Search size={16} />}
                            >
                                Search
                            </Button>

                            <Button
                                onClick={() => {
                                    setDateRange({ start: getToday(), end: getToday() });
                                    setMinAmount('');
                                    setCustomerSearch('');
                                    setPaymentMethod('ALL');
                                    setStatus('ALL');
                                    setSelectedSpecialist('ALL');
                                }}
                                variant="ghost"
                                className="font-medium"
                                style={{
                                    backgroundColor: '#e2e8f0', // slate-200
                                    color: '#475569', // slate-600
                                    borderColor: '#cbd5e1', // slate-300
                                    height: '44px',
                                    padding: '0 20px'
                                }}
                                icon={<RefreshCw size={16} />}
                            >
                                Reset
                            </Button>
                        </div>
                    </div>
                </div>
            </Card>


            {/* Payments Table */}
            < div className="space-y-4" >
                {/* {paymentsLoading && payments.length > 0 && (
                    <div className="flex items-center gap-2 text-xs font-semibold text-indigo-500 animate-pulse bg-indigo-50/50 px-3 py-1.5 rounded-full w-fit">
                        <RefreshCw size={12} className="animate-spin" />
                        Updating data...
                    </div>
                )} */}
                <Table
                    columns={columns}
                    data={filteredPayments}
                    isLoading={paymentsLoading}
                    onRowClick={(row) => {
                        setSelectedPayment(row);
                        setIsModalOpen(true);
                    }}
                />

                {/* Pagination Footer */}
                <div className="flex justify-between items-center bg-white dark:bg-slate-900 px-6 py-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="text-sm text-black font-medium">
                        Showing <span className="text-black dark:text-white font-bold">{combinedPayments.length}</span> of <span className="text-black dark:text-white font-bold">{pagination.totalCount + (combinedPayments.length - payments.length)}</span> transactions
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-xs text-black font-bold uppercase tracking-widest hidden md:block">
                            Page {pagination.currentPage} of {pagination.totalPages}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                className="w-10 h-10 p-0 rounded-xl flex items-center justify-center"
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1 || paymentsLoading}
                            >
                                <ChevronLeft size={18} />
                            </Button>
                            <Button
                                variant="outline"
                                className="w-10 h-10 p-0 rounded-xl flex items-center justify-center font-bold"
                                disabled={true}
                            >
                                {currentPage}
                            </Button>
                            <Button
                                variant="outline"
                                className="w-10 h-10 p-0 rounded-xl flex items-center justify-center"
                                onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
                                disabled={currentPage === pagination.totalPages || paymentsLoading}
                            >
                                <ChevronRight size={18} />
                            </Button>
                        </div>
                    </div>
                </div>
            </div >

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Transaction Details"
            >
                {selectedPayment && (() => {
                    const details = getSaleSettlementDetails(selectedPayment);
                    const originalSubtotal = details.originalSubtotal;
                    const totalRedemptionValue = details.totalRedemptionValue;
                    const effectiveDisc = details.effectiveDisc;
                    const total = details.totalPayable;
                    const paid = (selectedPayment.sale as any)?.paidAmount || 0;
                    const balance = Math.max(0, total - paid);

                    return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                        {/* Info Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div style={{
                                padding: '0.5rem',
                                borderRadius: 'var(--radius-xl)',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.2rem'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-light)', marginBottom: '0.5rem' }}>
                                    <FileText size={14} />
                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>IDENTIFIERS</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {/* Helper to find appointment info */}
                                    {(() => {
                                        const saleAppointment = (selectedPayment.sale as any)?.appointment;
                                        const directAppointment = selectedPayment.appointment;
                                        const appointment = directAppointment || saleAppointment;
                                        const apptId = selectedPayment.appointmentId || saleAppointment?.id;

                                        return (
                                            <>
                                                {/* Row 1: Transaction ID | Booking Time */}
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                                    <div>
                                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-black)', marginBottom: '0.15rem' }}>Transaction ID</p>
                                                        <p style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.75rem', wordBreak: 'break-all', margin: 0 }}>
                                                            {(selectedPayment.sale as any)?.saleNumber || selectedPayment.transactionId || selectedPayment.id}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-black)', marginBottom: '0.15rem' }}>Booking Time</p>
                                                        <p style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.75rem', margin: 0 }}>
                                                            {appointment?.startTime ? new Date(appointment.startTime).toLocaleString(undefined, {
                                                                timeStyle: 'short',
                                                                dateStyle: 'medium'
                                                            }) : 'Direct Sale'}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Row 2: Invoice Number | Transaction Date & Time */}
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                                    <div>
                                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-black)', marginBottom: '0.15rem' }}>Invoice Number</p>
                                                        <p style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)', fontSize: '0.75rem', margin: 0 }}>
                                                            {selectedPayment.invoiceNumber || (selectedPayment.sale as any)?.invoiceNumber || 'N/A'}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-black)', marginBottom: '0.15rem' }}>Trans. Date & Time</p>
                                                        <p style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.75rem', margin: 0 }}>
                                                            {new Date(selectedPayment.createdAt).toLocaleString(undefined, {
                                                                dateStyle: 'medium',
                                                                timeStyle: 'short'
                                                            })}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Row 3: Customer | Appointment ID */}
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                                    <div>
                                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-black)', marginBottom: '0.15rem' }}>Customer</p>
                                                        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
                                                            {appointment?.customer?.name || (selectedPayment.sale as any)?.customer?.name || 'Walk-in'}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-black)', marginBottom: '0.15rem' }}>Appointment ID</p>
                                                        <p style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.65rem', wordBreak: 'break-all', margin: 0 }}>
                                                            {apptId || 'N/A'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>

                            <div style={{
                                padding: '0.5rem',
                                borderRadius: 'var(--radius-xl)',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.1rem'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-light)' }}>
                                    <CreditCard size={14} />
                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, uppercase: 'true', letterSpacing: '0.1em' }}>PAYMENT INFO</span>
                                </div>
                                <div>
                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-black)', marginBottom: '0.15rem' }}>Method</p>
                                    <p style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.85rem', margin: 0 }}>
                                        {details.isSplit 
                                            ? `Split (${details.allMethods.map(m => getLabel(m)).join(' + ')})` 
                                            : getLabel(selectedPayment.paymentMethod)
                                        }
                                    </p>
                                </div>
                                <div>
                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-black)', marginBottom: '0.15rem' }}>Collection Type</p>
                                    <p style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.85rem', margin: 0 }}>{selectedPayment.paymentType}</p>
                                </div>
                            </div>
                        </div>

                        {/* Customer & Cashier */}
                        {/* <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div style={{
                                padding: '1rem',
                                borderRadius: 'var(--radius-xl)',
                                backgroundColor: 'var(--bg-hover)',
                                border: '1px solid var(--border-light)'
                            }}>
                                <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.25rem' }}>Customer</p>
                                <p style={{ fontWeight: 700, color: 'var(--text-dark)', margin: 0 }}>
                                    {selectedPayment.appointment?.customer?.name || (selectedPayment.sale as any)?.customer?.name || 'Walk-in'}
                                </p>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-black)', marginTop: '0.15rem', margin: 0 }}>
                                    {(isStaff && fraudProtection) ? maskPhone(selectedPayment.appointment?.customer?.mobile || (selectedPayment.sale as any)?.customer?.mobile) : (selectedPayment.appointment?.customer?.mobile || (selectedPayment.sale as any)?.customer?.mobile || 'No contact info')}
                                </p>
                            </div>
                            <div style={{
                                padding: '1rem',
                                borderRadius: 'var(--radius-xl)',
                                backgroundColor: 'var(--bg-hover)',
                                border: '1px solid var(--border-light)'
                            }}>
                                <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.25rem' }}>Processed By</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{
                                        width: '1.5rem',
                                        height: '1.5rem',
                                        borderRadius: 'var(--radius-full)',
                                        backgroundColor: 'var(--primary-light)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '0.65rem',
                                        fontWeight: 800,
                                        color: 'var(--primary)'
                                    }}>
                                        {(selectedPayment.cashierName || 'A')[0]}
                                    </div>
                                    <p style={{ fontWeight: 700, color: 'var(--text-dark)', margin: 0 }}>
                                        {selectedPayment.cashierName || 'Admin'}
                                    </p>
                                </div>
                            </div>
                        </div> */}

                        {/* Attachments */}
                        {selectedPayment.sale && selectedPayment.sale.attachments && selectedPayment.sale.attachments.length > 0 && (
                            <div style={{
                                borderRadius: 'var(--radius-xl)',
                                border: '1px solid var(--border)',
                                overflow: 'hidden',
                                backgroundColor: 'var(--bg-card)'
                            }}>
                                <div style={{
                                    padding: '0.75rem 1.25rem',
                                    backgroundColor: 'var(--bg-hover)',
                                    borderBottom: '1px solid var(--border)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}>
                                    <Paperclip size={14} className="text-black" />
                                    <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Attachments</p>
                                </div>
                                <div style={{
                                    padding: '1.25rem',
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '1rem'
                                }}>
                                    {selectedPayment.sale.attachments.map((att: any, idx: number) => {
                                        const isImage = att.url?.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/) ||
                                            att.url?.toLowerCase().includes('image/upload');

                                        return (
                                            <div key={idx} style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '0.5rem',
                                                width: isImage ? '120px' : '100%'
                                            }}>
                                                {isImage && (
                                                    <div
                                                        onClick={() => setPreviewAttachment(att)}
                                                        style={{
                                                            width: '120px',
                                                            height: '100px',
                                                            borderRadius: 'var(--radius-lg)',
                                                            overflow: 'hidden',
                                                            border: '1px solid var(--border)',
                                                            cursor: 'pointer',
                                                            backgroundColor: 'var(--bg-hover)',
                                                            position: 'relative',
                                                            transition: 'transform 0.2s'
                                                        }}
                                                        onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                                                        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                                    >
                                                        <img
                                                            src={att.url}
                                                            alt={att.name}
                                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                        />
                                                        <div style={{
                                                            position: 'absolute',
                                                            inset: 0,
                                                            backgroundColor: 'rgba(0,0,0,0.1)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            opacity: 0,
                                                            transition: 'opacity 0.2s'
                                                        }}
                                                            onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                                                            onMouseOut={(e) => e.currentTarget.style.opacity = '0'}
                                                        >
                                                            <Eye size={24} color="white" />
                                                        </div>
                                                    </div>
                                                )}
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                                                    <a
                                                        href={att.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-blue-600 hover:underline flex items-center gap-1 text-xs font-medium truncate"
                                                        style={{ textDecoration: 'none', maxWidth: isImage ? '80px' : 'none' }}
                                                    >
                                                        {att.name || `Attachment ${idx + 1}`} <ExternalLink size={10} />
                                                    </a>
                                                    {/* <button
                                                        onClick={() => setPreviewAttachment(att)}
                                                        style={{
                                                            background: 'var(--primary-light)',
                                                            border: 'none',
                                                            width: '28px',
                                                            height: '28px',
                                                            cursor: 'pointer',
                                                            color: 'var(--primary)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            borderRadius: 'var(--radius-full)',
                                                            transition: 'all 0.2s'
                                                        }}
                                                        title="Preview Attachment"
                                                    >
                                                        <Eye size={14} />
                                                    </button> */}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Order Summary */}
                        <div style={{
                            borderRadius: 'var(--radius-xl)',
                            border: '1px solid var(--border)',
                            overflow: 'hidden',
                            backgroundColor: 'var(--bg-card)'
                        }}>
                            <div style={{
                                padding: '0.75rem 1.25rem',
                                backgroundColor: 'var(--bg-hover)',
                                borderBottom: '1px solid var(--border)'
                            }}>
                                <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Order Summary</p>
                            </div>

                            <div style={{ padding: '1.25rem', maxHeight: '200px', overflowY: 'auto' }}>
                                {selectedPayment.sale ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        {(selectedPayment.sale.items || []).map((item: any, idx: number) => {
                                            const isRedemption = item.price === 0 || item.redeemedQuantity > 0 || item.redeemedFromPackageId;
                                            
                                            // Find catalog/original price for redeemed item
                                            let originalPrice = item.price || 0;
                                            if (isRedemption && originalPrice === 0) {
                                                const foundService = services.find((s: any) => 
                                                    (item.serviceId && String(s.id) === String(item.serviceId)) || 
                                                    (item.itemId && String(s.id) === String(item.itemId)) ||
                                                    (item.id && String(s.id) === String(item.id)) ||
                                                    (s.name && s.name.toLowerCase() === item.name.toLowerCase())
                                                );
                                                
                                                if (foundService) {
                                                    originalPrice = foundService.price || 0;
                                                } else {
                                                    const foundProduct = products.find((p: any) => 
                                                        (item.productId && String(p.id) === String(item.productId)) ||
                                                        (item.itemId && String(p.id) === String(item.itemId)) ||
                                                        (item.id && String(p.id) === String(item.id)) ||
                                                        (p.name && p.name.toLowerCase() === item.name.toLowerCase())
                                                    );
                                                    if (foundProduct) {
                                                        originalPrice = foundProduct.sellingPrice || foundProduct.price || foundProduct.retailPrice || 0;
                                                    }
                                                }
                                            }

                                            return (
                                                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', borderBottom: idx === (selectedPayment.sale.items || []).length - 1 ? 'none' : '1px dashed var(--border-light)', paddingBottom: idx === (selectedPayment.sale.items || []).length - 1 ? '0' : '0.5rem', marginBottom: idx === (selectedPayment.sale.items || []).length - 1 ? '0' : '0.5rem' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                            <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-dark)', margin: 0 }}>{item.name}</p>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-black)' }}>Qty: {item.quantity}</span>
                                                                {item.specialistName && (
                                                                    <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>• {item.specialistName}</span>
                                                                )}
                                                                {item.type === 'combo' && (
                                                                    <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: 'var(--radius-sm)', backgroundColor: '#ffedd5', color: '#ea580c', textTransform: 'uppercase' }}>Combo</span>
                                                                )}
                                                                {isRedemption && (
                                                                    <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: 'var(--radius-sm)', backgroundColor: '#ecfdf5', color: '#059669', textTransform: 'uppercase' }}>Redeemed</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <p style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.85rem', margin: 0 }}>
                                                            {formatPrice(originalPrice * item.quantity)}
                                                        </p>
                                                    </div>
                                                    {isRedemption && originalPrice > 0 && (
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: '#059669', paddingLeft: '0.5rem', marginTop: '0.1rem' }}>
                                                            <span style={{ fontStyle: 'italic', fontWeight: 500 }}>Package Redemption</span>
                                                            <span style={{ fontWeight: 700 }}>-{formatPrice(originalPrice * item.quantity)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : selectedPayment.appointment ? (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                            <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-dark)', margin: 0 }}>{selectedPayment.appointment.service?.name}</p>
                                            {selectedPayment.appointment.stylist?.name && (
                                                <p style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600, margin: 0 }}>Stylist: {selectedPayment.appointment.stylist.name}</p>
                                            )}
                                        </div>
                                        <p style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.85rem', margin: 0 }}>{formatPrice(selectedPayment.amount)}</p>
                                    </div>
                                ) : (
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-black)', fontStyle: 'italic', margin: 0 }}>No items found</p>
                                )}
                            </div>

                            <div style={{
                                padding: '1.25rem',
                                backgroundColor: 'var(--bg-hover)',
                                borderTop: '1px solid var(--border)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.5rem'
                            }}>
                                {selectedPayment.sale && (
                                    <>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                                            <span style={{ color: 'var(--text-black)' }}>Subtotal</span>
                                            <span style={{ fontWeight: 700, color: 'var(--text-dark)' }}>
                                                {formatPrice(originalSubtotal)}
                                            </span>
                                        </div>
                                        {totalRedemptionValue > 0 && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#059669' }}>
                                                <span style={{ fontWeight: 500 }}>Package Redemption</span>
                                                <span style={{ fontWeight: 700 }}>-{formatPrice(totalRedemptionValue)}</span>
                                            </div>
                                        )}
                                        {effectiveDisc > 0 && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                                                <span style={{ color: 'var(--text-black)' }}>Discount</span>
                                                <span style={{ fontWeight: 700, color: 'var(--success)' }}>-{formatPrice(effectiveDisc)}</span>
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', marginTop: '0.25rem', paddingTop: '0.25rem', borderTop: '1px dashed var(--border)' }}>
                                            <span style={{ color: 'var(--text-black)', fontWeight: 600 }}>Balance Due</span>
                                            <span style={{ fontWeight: 700, color: (selectedPayment.sale as any).paymentStatus === 'COMPLETED' ? 'var(--success)' : '#ef4444' }}>
                                                {formatPrice(balance)}
                                            </span>
                                        </div>
                                    </>
                                )}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    paddingTop: '0.75rem',
                                    marginTop: '0.25rem',
                                    borderTop: '1px solid var(--border)'
                                }}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontSize: '0.85rem', fontWeight: 900, color: 'var(--text-dark)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            Net Amount
                                        </span>
                                    </div>
                                    <span style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--primary)' }}>{formatPrice(getRowDisplayAmount(selectedPayment))}</span>
                                </div>

                                {/* Settlement Breakdown (including Payments, Package Redemptions, and Vouchers/Discounts) */}
                                {(() => {
                                    if (!details.isSplit) return null;

                                    return (
                                        <div style={{ marginTop: '1rem', borderTop: '1px dashed var(--border)', paddingTop: '1rem' }}>
                                            <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Settlement Breakdown</p>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                {/* 1. Actual Payments */}
                                                {details.actualPayments.map((p: any, idx: number) => (
                                                    <div key={`pay-${idx}`} style={{
                                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                        padding: '0.5rem', background: p.id === selectedPayment.id ? 'var(--bg-hover)' : 'transparent',
                                                        borderRadius: '0.5rem', border: p.id === selectedPayment.id ? '1px solid var(--border)' : 'none'
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dark)' }}>{getLabel(p.method)}</span>
                                                            {p.id === selectedPayment.id && <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem', borderRadius: '4px', background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 700 }}>CURRENT</span>}
                                                        </div>
                                                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-dark)' }}>{formatPrice(p.amount)}</span>
                                                    </div>
                                                ))}

                                                {/* 2. Package Redemptions */}
                                                {totalRedemptionValue > 0 && (
                                                    <div style={{
                                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                        padding: '0.5rem', borderRadius: '0.5rem', background: 'rgba(254, 243, 199, 0.3)', border: '1px dashed #fde68a'
                                                    }}>
                                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#92400e' }}>Package Redemption</span>
                                                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#92400e' }}>{formatPrice(totalRedemptionValue)}</span>
                                                    </div>
                                                )}

                                                {/* 3. Voucher / Discount */}
                                                {effectiveDisc > 0 && (
                                                    <div style={{
                                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                        padding: '0.5rem', borderRadius: '0.5rem', background: 'rgba(252, 231, 243, 0.3)', border: '1px dashed #fbcfe8'
                                                    }}>
                                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#be185d' }}>Voucher / Discount</span>
                                                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#be185d' }}>{formatPrice(effectiveDisc)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>



                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
                            <Button
                                variant="outline"
                                className="flex-1"
                                style={{ height: '3rem', borderRadius: 'var(--radius-xl)' }}
                                icon={<Printer size={18} />}
                                onClick={handlePrintReceipt}
                            >
                                Receipt
                            </Button>
                            <Button
                                variant="outline"
                                className="flex-1"
                                style={{
                                    height: '3rem',
                                    borderRadius: 'var(--radius-xl)',
                                    borderColor: 'var(--primary)',
                                    color: 'var(--primary)',
                                    backgroundColor: 'rgba(35, 76, 106, 0.05)'
                                }}
                                icon={<FileText size={18} />}
                                onClick={handleDownloadPDF}
                            >
                                Invoice PDF
                            </Button>
                            <Button
                                variant="outline"
                                className="flex-1"
                                style={{
                                    height: '3rem',
                                    borderRadius: 'var(--radius-xl)',
                                    borderColor: '#25D366',
                                    color: '#25D366',
                                    backgroundColor: 'rgba(37, 211, 102, 0.05)'
                                }}
                                icon={<MessageCircle size={18} />}
                                onClick={async () => {
                                    if (!selectedPayment) return;
                                    if (isStaff && fraudProtection) {
                                        showToast('WhatsApp messaging is disabled during Fraud Protection.', 'info');
                                        return;
                                    }
                                    const customer = selectedPayment.appointment?.customer || (selectedPayment.sale as any)?.customer;
                                    const customerName = customer?.name || 'Customer';

                                    // Check both phone (Prisma default for Customer) and mobile (Prisma default for User/Stylist)
                                    let mobile = customer?.phone || customer?.mobile;

                                    // If no mobile found (e.g. Walk-In), prompt the user to enter one
                                    if (!mobile) {
                                        const manualMobile = window.prompt("No mobile number found for this customer. Please enter mobile number to send WhatsApp:");
                                        if (manualMobile) {
                                            mobile = manualMobile;
                                        } else {
                                            return; // User cancelled
                                        }
                                    }

                                    try {
                                        showToast('Preparing invoice and opening WhatsApp...', 'info');

                                        // 1. Generate PDF Blob
                                        const data = getInvoiceData();
                                        if (!data) return;
                                        const file = getInvoicePDFFile(data);

                                        // 2. Upload to Cloudinary
                                        // Use 'raw' resource type for PDFs to ensure direct, stable delivery as a document
                                        const invoiceNum = data.invoiceNumber || 'Invoice_Download';
                                        const pdfUrl = await uploadToCloudinary(file, 'raw', invoiceNum);

                                        // 3. Construct message with link
                                        const message = `Hi ${customerName}, thank you for visiting ${settings?.salonName || 'our salon'}! 🌸\n\n` +
                                            `Your invoice *${invoiceNum}* for *${formatPrice(selectedPayment.amount)}* is ready.\n\n` +
                                            `📥 *Download your invoice here:*\n${pdfUrl}\n\n` +
                                            `We look forward to seeing you again! ✨`;

                                        const encodedMessage = encodeURIComponent(message);
                                        window.open(`https://web.whatsapp.com/send?phone=${mobile}&text=${encodedMessage}`, '_blank');
                                    } catch (error: any) {
                                        console.error('WhatsApp Error:', error);
                                        showToast(error.message || 'Failed to prepare invoice PDF', 'error');
                                    }
                                }}
                            >
                                WhatsApp
                            </Button>
                            {selectedPayment.sale && (selectedPayment.sale as any).balanceAmount > 0 && (
                                <Button
                                    variant="primary"
                                    className="flex-1"
                                    style={{ height: '3rem', borderRadius: 'var(--radius-xl)', backgroundColor: '#4f46e5' }}
                                    icon={<Play size={18} />}
                                    onClick={() => {
                                        const subtotalAmount = (selectedPayment.sale as any)?.subtotal || (selectedPayment.sale?.items || []).reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0);
                                        const totalPayable = (selectedPayment.sale as any)?.totalAmount || selectedPayment.amount || 0;
                                        const explicitDiscount = (selectedPayment.sale as any)?.discount || 0;
                                        // Fail-safe: if explicit discount is 0 but total < subtotal, infer the discount
                                        const effectiveDiscount = explicitDiscount > 0 ? explicitDiscount : Math.max(0, subtotalAmount - totalPayable);

                                        const partialData = {
                                            customerId: selectedPayment.appointment?.customer?.id || (selectedPayment.sale as any)?.customer?.id,
                                            customerName: selectedPayment.appointment?.customer?.name || (selectedPayment.sale as any)?.customer?.name,
                                            customerPhone: selectedPayment.appointment?.customer?.mobile || (selectedPayment.sale as any)?.customer?.mobile,
                                            paidAmount: (selectedPayment.sale as any)?.paidAmount || 0,
                                            items: (selectedPayment.sale as any)?.items || [],
                                            discount: effectiveDiscount,
                                            transactionId: selectedPayment.transactionId || selectedPayment.id,
                                            saleId: selectedPayment.sale?.id,
                                            saleNumber: (selectedPayment.sale as any)?.saleNumber,
                                            autoCheckout: true
                                        };
                                        const appId = (user as any)?.app_id || 'salon';
                                        const businessName = (user as any)?.businessName || 'admin';
                                        navigate(`/${appId}/${businessName}/sales`, { state: { partialPaymentData: partialData } });
                                    }}
                                >
                                    Continue
                                </Button>
                            )}
                            <Button
                                variant="primary"
                                className="flex-1"
                                style={{ height: '3rem', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-colored)' }}
                                onClick={() => setIsModalOpen(false)}
                            >
                                Close
                            </Button>
                        </div>

                        {/* Cancel Bill Button Section - Restricted to Admin/Manager or anyone with payment edit permission */}
                        {(isAdmin || isManager || canCancel) && ((selectedPayment.isPendingSale && selectedPayment.appointment?.status?.toUpperCase() !== 'CANCELLED') || (selectedPayment.sale?.saleStatus !== 'CANCELLED')) && (
                            <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border)', marginTop: '0.5rem' }}>
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    style={{
                                        height: '3rem',
                                        borderRadius: 'var(--radius-xl)',
                                        borderColor: '#ef4444',
                                        color: '#ef4444',
                                        backgroundColor: 'rgba(239, 68, 68, 0.05)'
                                    }}
                                    icon={<XCircle size={18} />}
                                    onClick={() => setIsCancelModalOpen(true)}
                                >
                                    Cancel Bill
                                </Button>
                                <p style={{ fontSize: '0.65rem', color: 'var(--text-black)', textAlign: 'center', marginTop: '0.5rem' }}>
                                    Cancelling will revert all stock, voucher balances, and package redemptions.
                                </p>
                            </div>
                        )}
                        </div>
                    );
                })()}
            </Modal>

            {/* Sale Cancellation Modal */}
            <Modal
                isOpen={isCancelModalOpen}
                onClose={() => {
                    if (!isCancelling) {
                        setIsCancelModalOpen(false);
                        setCancelReason('');
                    }
                }}
                title="Cancel Bill"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '0.5rem' }}>
                    {/* Premium Blue Warning Box */}
                    <div style={{
                        padding: '1.25rem',
                        background: 'linear-gradient(135deg, rgba(239, 246, 255, 0.9) 0%, rgba(219, 234, 254, 0.6) 100%)',
                        border: '1.5px solid rgba(37, 99, 235, 0.2)',
                        borderRadius: 'var(--radius-xl)',
                        display: 'flex',
                        gap: '1rem',
                        boxShadow: '0 4px 15px rgba(37, 99, 235, 0.05)',
                        position: 'relative',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '12px',
                            background: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#2563EB',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            flexShrink: 0
                        }}>
                            <AlertTriangle size={22} strokeWidth={2.5} />
                        </div>
                        <div>
                            <p style={{
                                fontSize: '0.925rem',
                                fontWeight: 800,
                                color: '#1E40AF',
                                marginBottom: '0.375rem',
                                letterSpacing: '-0.01em'
                            }}>
                                Warning: Destructive Action
                            </p>
                            <p style={{
                                fontSize: '0.8125rem',
                                color: '#475569',
                                lineHeight: 1.6,
                                fontWeight: 500
                            }}>
                                This will permanently cancel bill <strong style={{ color: '#1E293B' }}>{selectedPayment?.sale?.saleNumber}</strong>.
                                Stock levels, voucher balances, and package usage will be automatically reverted.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2.5">
                        <label style={{
                            fontSize: '0.875rem',
                            fontWeight: 700,
                            color: 'var(--text-dark)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}>
                            Cancellation Reason <span style={{ color: '#2563EB' }}>*</span>
                        </label>
                        <div style={{ position: 'relative' }}>
                            <textarea
                                className="w-full p-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-sm focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none"
                                style={{
                                    minHeight: '120px',
                                    resize: 'none',
                                    fontSize: '0.875rem',
                                    lineHeight: 1.5,
                                    color: 'var(--text-dark)'
                                }}
                                placeholder="Enter a reason for this cancellation..."
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                            />
                        </div>
                    </div>

                    <div style={{
                        display: 'flex',
                        gap: '1rem',
                        marginTop: '0.75rem',
                        borderTop: '1px solid var(--border-light)',
                        paddingTop: '1.5rem'
                    }}>
                        <Button
                            variant="outline"
                            className="flex-1"
                            style={{
                                height: '52px',
                                borderRadius: 'var(--radius-xl)',
                                fontWeight: 700,
                                border: '2px solid var(--border)',
                                fontSize: '0.9375rem'
                            }}
                            onClick={() => {
                                setIsCancelModalOpen(false);
                                setCancelReason('');
                            }}
                            disabled={isCancelling}
                        >
                            Back
                        </Button>
                        <motion.div
                            whileHover={{ scale: (cancelReason.trim() !== '' && !isCancelling) ? 1.02 : 1 }}
                            whileTap={{ scale: (cancelReason.trim() !== '' && !isCancelling) ? 0.98 : 1 }}
                            className="flex-1"
                        >
                            <Button
                                variant="primary"
                                style={{
                                    width: '100%',
                                    height: '52px',
                                    borderRadius: 'var(--radius-xl)',
                                    fontWeight: 700,
                                    fontSize: '0.9375rem',
                                    background: cancelReason.trim() === '' ? 'var(--bg-button-disabled)' : 'linear-gradient(135deg, #2563EB 0%, #1E40AF 100%)',
                                    border: 'none',
                                    boxShadow: cancelReason.trim() === '' ? 'none' : '0 10px 15px -3px rgba(37, 99, 235, 0.3)',
                                    opacity: cancelReason.trim() === '' ? 0.6 : 1,
                                    cursor: cancelReason.trim() === '' ? 'not-allowed' : 'pointer'
                                }}
                                disabled={cancelReason.trim() === '' || isCancelling}
                                onClick={async () => {
                                    if (!selectedPayment) return;
                                    const isPending = selectedPayment.isPendingSale;
                                    const id = isPending ? selectedPayment.appointmentId : selectedPayment.sale?.id;
                                    
                                    if (!id) {
                                        showToast('No valid ID found for cancellation', 'error');
                                        return;
                                    }

                                    try {
                                        setIsCancelling(true);
                                        
                                        if (isPending) {
                                            // Handle cancellation for synthesized pending checkouts (Appointments)
                                            await dispatch(cancelAppointment({
                                                id: id,
                                                reason: cancelReason
                                            })).unwrap();
                                        } else {
                                            // Handle cancellation for real sales
                                            await dispatch(cancelSale({
                                                id: id as string,
                                                reason: cancelReason
                                            })).unwrap();
                                        }

                                        showToast('Bill cancelled successfully', 'success');
                                        setIsCancelModalOpen(false);
                                        setIsModalOpen(false);
                                        setCancelReason('');

                                        // Refresh data
                                        fetchPaymentsHandler();

                                        // Also refresh inventory to ensure stock levels are updated in UI
                                        dispatch(invalidateInventoryCache());
                                        dispatch(fetchInventory());
                                        dispatch(fetchInventoryHistory());
                                    } catch (error: any) {
                                        showToast(error?.message || error || 'Failed to cancel bill', 'error');
                                    } finally {
                                        setIsCancelling(false);
                                    }
                                }}
                                icon={isCancelling ? <RefreshCw size={20} className="animate-spin" /> : <CheckCircle size={20} />}
                            >
                                {isCancelling ? 'Processing...' : 'Confirm Cancellation'}
                            </Button>
                        </motion.div>
                    </div>
                </div>
            </Modal>

            {/* Breakdown Modal */}
            <Modal
                isOpen={isBreakdownModalOpen}
                onClose={() => setIsBreakdownModalOpen(false)}
                title={breakdownTitle}
                width="450px"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '0.5rem' }}>
                    {breakdownLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                            <RefreshCw className="animate-spin text-blue-500" size={40} />
                            <p className="text-sm font-medium text-black">Calculating breakdown...</p>
                        </div>
                    ) : (
                        <>
                            <div style={{
                                padding: '1.25rem',
                                background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.05) 0%, rgba(147, 51, 234, 0.05) 100%)',
                                borderRadius: '1.25rem',
                                border: '1px solid rgba(79, 70, 229, 0.1)',
                                textAlign: 'center'
                            }}>
                                <p className="text-xs font-bold text-black uppercase tracking-widest mb-1">
                                    {breakdownTitle.split(' ')[0]} for {new Date(dateRange.start).toLocaleDateString()}
                                    {dateRange.start !== dateRange.end && ` - ${new Date(dateRange.end).toLocaleDateString()}`}
                                </p>
                                <h3 className="text-3xl font-black text-black tracking-tighter">
                                    {formatPrice(Object.values(breakdownData || {}).reduce((a: any, b: any) => a + Number(b), 0))}
                                </h3>
                                {(status !== 'ALL' || paymentMethod !== 'ALL' || selectedSpecialist !== 'ALL') && (
                                    <div className="mt-2 flex items-center justify-center gap-1.5 px-3 py-1 bg-amber-50 rounded-full border border-amber-200 w-fit mx-auto">
                                        <AlertTriangle size={12} className="text-amber-600" />
                                        <span className="text-[10px] font-bold text-amber-700 uppercase">
                                            Filters Active: {status !== 'ALL' ? status : ''} {paymentMethod !== 'ALL' ? paymentMethod : ''}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                {Object.entries(breakdownData || {}).length > 0 ? (
                                    Object.entries(breakdownData || {}).sort((a: any, b: any) => b[1] - a[1]).map(([method, amount]: any) => {
                                        const total = Object.values(breakdownData || {}).reduce((a: any, b: any) => a + Number(b), 0) as number;
                                        const percentage = Math.round((Number(amount) / total) * 100);

                                        return (
                                            <div key={method} className="space-y-1.5">
                                                <div className="flex justify-between items-center px-1">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                                                        <span className="text-sm font-bold text-black">{method}</span>
                                                    </div>
                                                    <span className="text-sm font-black text-black">{formatPrice(amount)}</span>
                                                </div>
                                                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${percentage}%` }}
                                                        transition={{ duration: 1, ease: 'easeOut' }}
                                                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full shadow-[0_0_12px_rgba(59,130,246,0.2)]"
                                                    />
                                                </div>
                                                <div className="flex justify-end pr-1">
                                                    <span className="text-[10px] font-black text-black uppercase tracking-tighter">{percentage}% OF {breakdownTitle.split(' ')[0]}</span>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="text-center py-8 text-black font-medium">No payments found for this selection</div>
                                )}
                            </div>

                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    style={{
                                        height: '52px',
                                        borderRadius: 'var(--radius-xl)',
                                        fontWeight: 700,
                                        marginTop: '1rem',
                                        border: '2px solid var(--border)'
                                    }}
                                    onClick={() => setIsBreakdownModalOpen(false)}
                                >
                                    Close
                                </Button>
                                {(status !== 'ALL' || paymentMethod !== 'ALL') && (
                                    <Button
                                        variant="primary"
                                        className="flex-1"
                                        style={{
                                            height: '52px',
                                            borderRadius: 'var(--radius-xl)',
                                            fontWeight: 700,
                                            marginTop: '1rem'
                                        }}
                                        onClick={() => {
                                            setStatus('ALL');
                                            setPaymentMethod('ALL');
                                            setIsBreakdownModalOpen(false);
                                            // Page will refresh due to status change
                                        }}
                                    >
                                        Show All Data
                                    </Button>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default Payments;
