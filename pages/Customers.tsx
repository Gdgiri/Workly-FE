import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AppDispatch, RootState } from '../redux/store';
import { fetchCustomers, invalidateCustomerCache } from '../redux/slices/customerSlice';
import { fetchPackages } from '../redux/slices/packageSlice';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, ChevronLeft, ChevronRight, Download, Users, Mail, Phone, MapPin, Calendar, DollarSign, TrendingUp, RefreshCw, Ticket } from 'lucide-react';
import { Table, Button, Modal, Input, Checkbox } from '../components/UI';
import { LoadingSpinner } from '../components/LoadingSpinner';
import api from '../utils/api';
import { useToast } from '../components/ToastContext';
import { useCurrency } from '../components/CurrencyContext';
import { AttachmentsInput, Attachment } from '../components/AttachmentsInput';
import { useAuth } from '../hooks/useAuth';
import { Customer, Appointment, VoucherClaim } from '../types';

interface Sale {
    id: string;
    saleNumber: string;
    createdAt: string;
    totalAmount: number;
    items: any[];
    saleStatus: string;
    paymentStatus: string;
}

interface CustomersProps {
    fraudProtection?: boolean;
}

// Local interfaces removed in favor of global types in ../types.ts

const Customers: React.FC<CustomersProps> = ({ fraudProtection = false }) => {
    const { showToast } = useToast();
    const { symbol } = useCurrency();
    const { isStaff } = useAuth();
    const { user } = useSelector((state: RootState) => state.auth);
    const { appId: appIdParam, businessName: businessNameParam } = useParams<{ appId: string; businessName: string }>();
    const [searchParams, setSearchParams] = useSearchParams();

    // Robust extraction of business info
    const businessName = businessNameParam || (user as any)?.businessName || localStorage.getItem('businessName') || '';
    const appId = appIdParam || (user as any)?.appName || localStorage.getItem('appId') || '';

    // Save to localStorage for survival across reloads/navs if needed
    useEffect(() => {
        if (businessName) localStorage.setItem('businessName', businessName);
        if (appId) localStorage.setItem('appId', appId);
    }, [businessName, appId]);

    const maskPhone = (phone: string | undefined) => {
        if (!phone) return 'N/A';
        if (phone.length <= 4) return phone;
        return phone.slice(0, phone.length - 4) + '****';
    };
    const dispatch = useDispatch<AppDispatch>();
    const { customers, loading: customersLoading } = useSelector((state: RootState) => state.customers);
    const { packages: globalPackages } = useSelector((state: RootState) => state.packages);

    // const [customers, setCustomers] = useState<Customer[]>([]); // Removed local state
    // const [loading, setLoading] = useState(false); // Removed local state
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const isModalOpen = searchParams.get('modal') === 'add-customer';
    const setIsModalOpen = (open: boolean) => {
        if (open) {
            searchParams.set('modal', 'add-customer');
        } else {
            searchParams.delete('modal');
        }
        setSearchParams(searchParams);
    };
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    // Derive the live customer from Redux so stats always reflect the freshest data
    const selectedCustomer = selectedCustomerId
        ? (customers.find(c => c.id.toString() === selectedCustomerId) ?? null)
        : null;
    const [customerAppointments, setCustomerAppointments] = useState<Appointment[]>([]);
    const [loadingAppointments, setLoadingAppointments] = useState(false);
    const [customerSales, setCustomerSales] = useState<Sale[]>([]);
    const [loadingSales, setLoadingSales] = useState(false);
    const [activePackages, setActivePackages] = useState<any[]>([]);
    const [loadingPackages, setLoadingPackages] = useState(false);
    const [customerVoucherClaims, setCustomerVoucherClaims] = useState<VoucherClaim[]>([]);
    const [loadingVoucherClaims, setLoadingVoucherClaims] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        city: '',
        role: 'CUSTOMER',
        dateOfBirth: '',
        ageGroup: '',
        attachments: [] as Attachment[]
    });
    const [acceptedTerms, setAcceptedTerms] = useState(true);
    const [termsError, setTermsError] = useState('');

    // Import State
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [isImporting, setIsImporting] = useState(false);

    // const fetchCustomers = async () => { ... } // Removed local fetch logic

    useEffect(() => {
        dispatch(fetchCustomers());
        dispatch(fetchPackages());
    }, [dispatch]);

    // When Redux refreshes the customer list (e.g. after a sale), re-fetch the
    // active packages and voucher claims for the currently open profile so new
    // purchases appear immediately without closing and reopening the modal.
    useEffect(() => {
        if (isProfileModalOpen && selectedCustomerId) {
            fetchCustomerActivePackages(selectedCustomerId);
            fetchCustomerVoucherClaims(selectedCustomerId);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [customers, isProfileModalOpen, selectedCustomerId]);


    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const fetchCustomerAppointments = async (customerId: string) => {
        setLoadingAppointments(true);
        try {
            const response = await api.get('/appointments');
            const data = response.data;
            // Filter appointments for this customer
            const customerAppts = data.filter((apt: any) =>
                apt.userId?.toString() === customerId.toString() || (apt.customer && apt.customer.id?.toString() === customerId.toString())
            );

            // Sort by start time descending (most recent first)
            customerAppts.sort((a: Appointment, b: Appointment) =>
                new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
            );
            setCustomerAppointments(customerAppts);
        } catch (err) {
            console.error('Failed to fetch appointments', err);
        } finally {
            setLoadingAppointments(false);
        }
    };

    const fetchCustomerSales = async (customerId: string) => {
        setLoadingSales(true);
        try {
            const response = await api.get(`/sales?customerId=${customerId}`);
            setCustomerSales(response.data.sales || []);
        } catch (err) {
            console.error('Failed to fetch sales', err);
        } finally {
            setLoadingSales(false);
        }
    };

    const fetchCustomerActivePackages = async (customerId: string) => {
        setLoadingPackages(true);
        try {
            // 1. Fetch regular (package-type) active packages from the dedicated endpoint
            const packageRes = await api.get(`/customers/${customerId}/packages/active`);
            const regularPackages: any[] = Array.isArray(packageRes.data) ? packageRes.data : [];

            // 2. Fetch ALL sales to calculate combo balances (since backend doesn't track them)
            const salesRes = await api.get(`/sales?customerId=${customerId}`);
            const sales: any[] = salesRes.data?.sales || salesRes.data || [];
            
            // Sort sales by date ASC for FIFO
            const sortedSales = [...sales].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

            // Step A: Extract all combo purchases ("Supply")
            let comboPool: any[] = [];
            sortedSales
                .filter(s => s.saleStatus !== 'CANCELLED')
                .forEach(s => {
                    (s.items || []).filter((item: any) => item.type === 'combo').forEach((item: any) => {
                        // De-duplicate: If already in regularPackages, skip
                        const isDup = regularPackages.some(rp => 
                            (rp.package?.name === item.name || rp.packageName === item.name) &&
                            rp.purchaseDate?.split('T')[0] === s.createdAt?.split('T')[0]
                        );
                        if (isDup) return;

                        const comboDef = globalPackages.find(gp => gp.name === item.name);
                        comboPool.push({
                            id: `combo-${s.id}-${item.itemId || item.name}`,
                            name: item.name,
                            purchaseDate: s.createdAt,
                            items: comboDef?.items?.map(ci => ({
                                name: ci.name,
                                total: ci.quantity * item.quantity,
                                remaining: ci.quantity * item.quantity
                            })) || []
                        });
                    });
                });

            // Step B: Extract all redemptions ("Demand")
            const redemptions = sortedSales
                .filter(s => s.saleStatus !== 'CANCELLED')
                .flatMap(s => (s.items || []).map((item: any) => ({ ...item, saleDate: s.createdAt })))
                .filter(item => (item.price === 0 || item.redeemedQuantity > 0) && item.type !== 'combo');

            // Step C: Apply FIFO (Subtract demand from supply)
            redemptions.forEach(red => {
                // Try to find the oldest combo that has this item and has remaining balance
                const targetCombo = comboPool.find(c => 
                    new Date(c.purchaseDate) <= new Date(red.saleDate) &&
                    c.items.some((i: any) => i.name === red.name && i.remaining > 0)
                );

                if (targetCombo) {
                    const comboItem = targetCombo.items.find((i: any) => i.name === red.name);
                    if (comboItem) {
                        const qtyToDeduct = red.quantity || 1;
                        comboItem.remaining = Math.max(0, comboItem.remaining - qtyToDeduct);
                    }
                }
            });

            // Step D: Map the remaining pool to the activePackages format
            const activeCombos = comboPool
                .filter(c => c.items.some((i: any) => i.remaining > 0)) // Only show if something left
                .map(c => ({
                    id: c.id,
                    isCombo: true,
                    package: { name: c.name },
                    purchaseDate: c.purchaseDate,
                    expiryDate: null,
                    usageDetails: c.items.map((i: any) => ({
                        name: i.name,
                        totalQuantity: i.total,
                        remainingQuantity: i.remaining
                    }))
                }));

            setActivePackages([...regularPackages, ...activeCombos]);
        } catch (err) {
            console.error('Failed to fetch active packages', err);
        } finally {
            setLoadingPackages(false);
        }
    };


    const fetchCustomerVoucherClaims = async (customerId: string) => {
        setLoadingVoucherClaims(true);
        try {
            const response = await api.get('/vouchers/claims');
            const data = response.data;
            if (Array.isArray(data)) {
                const filtered = data.filter((c: VoucherClaim) =>
                    c.customerId?.toString() === customerId.toString()
                );
                setCustomerVoucherClaims(filtered);
            } else {
                setCustomerVoucherClaims([]);
            }
        } catch (err) {
            console.error('Failed to fetch voucher claims', err);
        } finally {
            setLoadingVoucherClaims(false);
        }
    };

    const handleViewProfile = (customer: Customer) => {
        setSelectedCustomerId(customer.id.toString());
        setIsProfileModalOpen(true);
        fetchCustomerAppointments(customer.id.toString());
        fetchCustomerSales(customer.id.toString());
        fetchCustomerActivePackages(customer.id.toString());
        fetchCustomerVoucherClaims(customer.id.toString());
    };

    const handleEdit = (customer: Customer) => {
        setEditingCustomer(customer);
        setFormData({
            name: customer.name,
            email: customer.email,
            phone: customer.phone || '',
            city: customer.city || '',
            role: customer.role || 'CUSTOMER',
            dateOfBirth: customer.dateOfBirth || '',
            ageGroup: customer.ageGroup || '',
            attachments: customer.attachments || []
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this customer?')) return;

        try {
            await api.delete(`/customers/${id}`);
            dispatch(invalidateCustomerCache());
            dispatch(fetchCustomers());
        } catch (error: any) {
            console.error('Error deleting customer:', error);
            showToast(error.response?.data?.error || 'Failed to delete customer', 'error');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!editingCustomer && !acceptedTerms) {
            setTermsError('You must agree to the Terms and Conditions');
            showToast('Please agree to the Terms and Conditions', 'error');
            return;
        }
        setTermsError('');

        setError(null);
        const token = localStorage.getItem('accessToken');

        try {
            const endpoint = editingCustomer
                ? `/customers/${editingCustomer.id}`
                : '/customers';
            const method = editingCustomer ? 'put' : 'post';

            await api[method](endpoint, {
                ...formData,
                attachments: (formData.attachments || []).map(a => ({
                    ...a,
                    imgUrl: a.url // Map url to imgUrl for backend compatibility
                }))
            });

            setIsModalOpen(false);
            setEditingCustomer(null);
            dispatch(invalidateCustomerCache());
            dispatch(fetchCustomers());
            setFormData({
                name: '',
                email: '',
                phone: '',
                city: '',
                role: 'CUSTOMER',
                dateOfBirth: '',
                ageGroup: '',
                attachments: []
            });
            setAcceptedTerms(true);
            setTermsError('');
        } catch (err: any) {
            setError(err.response?.data?.error || err.message);
        } finally {

        }
    };

    const columns = [
        { header: 'Name', accessor: 'name' as keyof Customer, className: 'w-[10%]' },
        { header: 'Email', accessor: 'email' as keyof Customer, className: 'w-[15%]' },
        {
            header: 'Phone',
            accessor: (row: Customer) => (isStaff && fraudProtection) ? maskPhone(row.phone) : (row.phone || 'N/A'),
            className: 'w-[18%]'
        },
        {
            header: 'Visits',
            accessor: (row: Customer) => row.visitCount || 0
        },
        {
            header: 'Spend',
            accessor: (row: Customer) => `${symbol}${(row.totalSpend || 0).toFixed(2)}`
        },
        {
            header: 'LastVisit',
            className: 'w-[8%]',
            style: { minWidth: '85px', maxWidth: '100px' },
            accessor: (row: Customer) => row.lastVisit ? new Date(row.lastVisit).toLocaleDateString() : 'No Visit'
        },
        {
            header: 'Status',
            className: 'w-[6%]',
            style: { minWidth: '80px', maxWidth: '95px' },
            accessor: (row: Customer) => {
                const isInactive = row.role === 'INACTIVE' || row.role === 'inactive';
                const isActive = !isInactive;

                return (
                    <span style={{
                        padding: '0.375rem 0.875rem',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        background: isActive
                            ? 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)'
                            : 'linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)',
                        color: isActive ? '#047857' : '#B91C1C',
                        border: `1px solid ${isActive ? '#A7F3D0' : '#FECACA'}`,
                        whiteSpace: 'nowrap',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.375rem',
                        boxShadow: 'var(--shadow-sm)'
                    }}>
                        <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: isActive ? '#10B981' : '#EF4444',
                            boxShadow: `0 0 6px ${isActive ? '#10B981' : '#EF4444'}40`
                        }} />
                        {isActive ? 'Active' : 'Inactive'}
                    </span>
                );
            }
        },
        {
            header: 'Actions',
            className: 'w-[24%]',
            style: { minWidth: '220px', maxWidth: '250px' },
            accessor: (row: Customer) => (
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-start', alignItems: 'center' }}>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleViewProfile(row)}
                        style={{
                            color: 'white',
                            background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
                            border: 'none',
                            padding: '0.5rem 1rem',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            boxShadow: 'var(--shadow-sm)',
                            transition: 'all var(--transition-base)'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                    >
                        View
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleEdit(row)}
                        style={{
                            color: 'var(--text-dark)',
                            background: 'var(--bg-hover)',
                            border: '1px solid var(--border)',
                            padding: '0.5rem 1rem',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            boxShadow: 'var(--shadow-sm)',
                            transition: 'all var(--transition-base)'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--bg-active)';
                            e.currentTarget.style.borderColor = 'var(--primary)';
                            e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'var(--bg-hover)';
                            e.currentTarget.style.borderColor = 'var(--border)';
                            e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                    >
                        Edit
                    </motion.button>
                </div>
            )
        }
    ];

    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const [visitCountFilter, setVisitCountFilter] = useState<string>('all');
    const [totalSpendFilter, setTotalSpendFilter] = useState<string>('all');
    const [lastVisitFilter, setLastVisitFilter] = useState<string>('all');

    // --- Search & Pagination Logic ---
    const filteredCustomers = Array.isArray(customers) ? customers.filter(customer => {
        const term = searchTerm.toLowerCase();
        const termDigits = searchTerm.replace(/\D/g, '');
        const searchMatch = (
            (customer.name || '').toLowerCase().includes(term) ||
            (customer.email || '').toLowerCase().includes(term) ||
            (customer.phone && (
                customer.phone.includes(term) ||
                (termDigits && customer.phone.replace(/\D/g, '').includes(termDigits))
            )) ||
            (customer.city && customer.city.toLowerCase().includes(term))
        );

        // Visit Count Filter
        let visitMatch = true;
        if (visitCountFilter === '0') visitMatch = customer.visitCount === 0;
        else if (visitCountFilter === '1-5') visitMatch = customer.visitCount >= 1 && customer.visitCount <= 5;
        else if (visitCountFilter === '6-10') visitMatch = customer.visitCount >= 6 && customer.visitCount <= 10;
        else if (visitCountFilter === '11+') visitMatch = customer.visitCount >= 11;

        // Total Spend Filter
        let spendMatch = true;
        if (totalSpendFilter === '0') spendMatch = customer.totalSpend === 0;
        else if (totalSpendFilter === '1-100') spendMatch = customer.totalSpend > 0 && customer.totalSpend <= 100;
        else if (totalSpendFilter === '101-500') spendMatch = customer.totalSpend > 100 && customer.totalSpend <= 500;
        else if (totalSpendFilter === '501+') spendMatch = customer.totalSpend > 500;

        // Last Visit Filter
        let lastVisitMatch = true;
        if (lastVisitFilter !== 'all') {
            if (lastVisitFilter === 'never') {
                lastVisitMatch = !customer.lastVisit;
            } else if (customer.lastVisit) {
                const lastVisitDate = new Date(customer.lastVisit);
                const now = new Date();
                const diffTime = Math.abs(now.getTime() - lastVisitDate.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (lastVisitFilter === '30days') lastVisitMatch = diffDays <= 30;
                else if (lastVisitFilter === '3months') lastVisitMatch = diffDays <= 90;
                else if (lastVisitFilter === '6months') lastVisitMatch = diffDays <= 180;
                else if (lastVisitFilter === 'over6months') lastVisitMatch = diffDays > 180;
            } else {
                lastVisitMatch = false; // Has filter but no visit date
            }
        }

        return searchMatch && visitMatch && spendMatch && lastVisitMatch;
    }) : [];

    const totalVoucherBalance = customerVoucherClaims.reduce((sum, claim) => sum + claim.balance, 0);

    const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
    const paginatedCustomers = filteredCustomers.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // --- Export Functionality ---
    const handleExportCSV = () => {
        const headers = ['Name', 'Email', 'Phone', 'City', 'Visit Count', 'Total Spend', 'Last Visit'];
        const rows = filteredCustomers.map(c => [
            c.name,
            c.email,
            (isStaff && fraudProtection) ? maskPhone(c.phone) : (c.phone || ''),
            c.city || '',
            c.visitCount,
            c.totalSpend,
            c.lastVisit ? new Date(c.lastVisit).toLocaleDateString() : ''
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(r => r.map(val => `"${val}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `customers_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadTemplate = () => {
        const headers = ['Name', 'Email', 'Phone', 'City', 'Status'];
        const sampleRow = ['John Doe', 'john@example.com', '12345678', 'New York', 'Active'];
        const csvContent = [headers.join(','), sampleRow.join(',')].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'customer_import_template.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleImportSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!importFile) return;

        setIsImporting(true);
        const reader = new FileReader();

        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string;
                const lines = text.split('\n').filter(line => line.trim());

                if (lines.length < 2) {
                    showToast('CSV file is empty or invalid', 'error');
                    setIsImporting(false);
                    return;
                }

                // Parse headers
                const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
                const columnMap: any = {};
                headers.forEach((header, index) => {
                    if (header.includes('name')) columnMap.name = index;
                    else if (header.includes('email')) columnMap.email = index;
                    else if (header.includes('phone')) columnMap.phone = index;
                    else if (header.includes('city')) columnMap.city = index;
                    else if (header.includes('status') || header.includes('role')) columnMap.role = index;
                });

                // Validation
                if (columnMap.name === undefined || columnMap.email === undefined) {
                    showToast('CSV must have columns for Name and Email', 'error');
                    setIsImporting(false);
                    return;
                }

                let successCount = 0;
                let errorCount = 0;
                const token = localStorage.getItem('accessToken');

                for (let i = 1; i < lines.length; i++) {
                    const values = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
                    if (values.length < 2) continue;

                    try {
                        const payload = {
                            name: values[columnMap.name],
                            email: values[columnMap.email],
                            phone: values[columnMap.phone] || '',
                            city: values[columnMap.city] || '',
                            role: (values[columnMap.role]?.toLowerCase() === 'inactive' || values[columnMap.role]?.toLowerCase() === '0') ? 'INACTIVE' : 'CUSTOMER'
                        };

                        await api.post('/customers', payload);
                        successCount++;
                    } catch (err: any) {
                        console.error(`Error importing row ${i}:`, err.response?.data?.error || err.message);
                        errorCount++;
                    }
                }

                if (errorCount > 0) {
                    showToast(`Import completed! ${successCount} successful, ${errorCount} failed. Already imported details.`, 'warning');
                } else {
                    showToast(`Successfully imported ${successCount} customers`, 'success');
                }
                dispatch(invalidateCustomerCache());
                dispatch(fetchCustomers());
                setIsImportModalOpen(false);
                setImportFile(null);
            } catch (error) {
                console.error('Error reading file:', error);
                showToast('Error processing file', 'error');
            } finally {
                setIsImporting(false);
            }
        };

        reader.readAsText(importFile);
    };



    return (
        <div className="space-y-6" style={{ position: 'relative' }}>


            {/* Enhanced Header Section */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1.5rem',
                marginBottom: '1.5rem',
                padding: '1.5rem',
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius-xl)',
                boxShadow: 'var(--shadow-md)',
                border: '1px solid var(--border-light)'
            }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flex: 1 }}>
                    {/* Enhanced Search Input */}
                    <div className="relative" style={{ position: 'relative' }}>
                        <input
                            type="text"
                            placeholder="Search name, phone or email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                height: '44px',
                                padding: '0 1rem 0 3rem',
                                border: '1.5px solid var(--border)',
                                borderRadius: 'var(--radius-lg)',
                                fontSize: '0.875rem',
                                outline: 'none',
                                width: '280px',
                                background: 'var(--bg-card)',
                                color: 'var(--text-dark)',
                                transition: 'all var(--transition-base)'
                            }}
                            onFocus={(e) => {
                                e.currentTarget.style.borderColor = 'var(--primary)';
                                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(35, 76, 106, 0.1), var(--shadow-md)';
                                // e.currentTarget.style.width = '320px';
                            }}
                            onBlur={(e) => {
                                e.currentTarget.style.borderColor = 'var(--border)';
                                e.currentTarget.style.boxShadow = 'none';
                                e.currentTarget.style.width = '280px';
                            }}
                        />
                        <div style={{
                            position: 'absolute',
                            left: '1rem',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'var(--text-light)',
                            display: 'flex',
                            pointerEvents: 'none',
                            zIndex: 1
                        }}>
                            <Search size={18} />
                        </div>
                    </div>

                    {/* Enhanced Visit Count Filter */}
                    <select
                        value={visitCountFilter}
                        onChange={(e) => setVisitCountFilter(e.target.value)}
                        style={{
                            height: '44px',
                            padding: '0 1rem 0 2.5rem',
                            border: '1.5px solid var(--border)',
                            borderRadius: 'var(--radius-lg)',
                            fontSize: '0.875rem',
                            outline: 'none',
                            cursor: 'pointer',
                            backgroundColor: 'var(--bg-card)',
                            color: 'var(--text-dark)',
                            transition: 'all var(--transition-base)',
                            backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%2364748B\' d=\'M6 9L1 4h10z\'/%3E%3C/svg%3E")',
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 0.75rem center',
                            appearance: 'none',
                            paddingRight: '2.5rem'
                        }}
                        onFocus={(e) => {
                            e.currentTarget.style.borderColor = 'var(--primary)';
                            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(35, 76, 106, 0.1)';
                        }}
                        onBlur={(e) => {
                            e.currentTarget.style.borderColor = 'var(--border)';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                    >
                        <option value="all">All Visits</option>
                        <option value="0">No Visits (0)</option>
                        <option value="1-5">1-5 Visits</option>
                        <option value="6-10">6-10 Visits</option>
                        <option value="11+">11+ Visits</option>
                    </select>

                    {/* Enhanced Total Spend Filter */}
                    <select
                        value={totalSpendFilter}
                        onChange={(e) => setTotalSpendFilter(e.target.value)}
                        style={{
                            height: '44px',
                            padding: '0 1rem 0 2.5rem',
                            border: '1.5px solid var(--border)',
                            borderRadius: 'var(--radius-lg)',
                            fontSize: '0.875rem',
                            outline: 'none',
                            cursor: 'pointer',
                            backgroundColor: 'var(--bg-card)',
                            color: 'var(--text-dark)',
                            transition: 'all var(--transition-base)',
                            backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%2364748B\' d=\'M6 9L1 4h10z\'/%3E%3C/svg%3E")',
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 0.75rem center',
                            appearance: 'none',
                            paddingRight: '2.5rem'
                        }}
                        onFocus={(e) => {
                            e.currentTarget.style.borderColor = 'var(--primary)';
                            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(35, 76, 106, 0.1)';
                        }}
                        onBlur={(e) => {
                            e.currentTarget.style.borderColor = 'var(--border)';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                    >
                        <option value="all">All Spend</option>
                        <option value="0">No Spend ({symbol}0)</option>
                        <option value="1-100">{symbol}1-{symbol}100</option>
                        <option value="101-500">{symbol}101-{symbol}500</option>
                        <option value="501+">{symbol}501+</option>
                    </select>

                    {/* Enhanced Last Visit Filter */}
                    <select
                        value={lastVisitFilter}
                        onChange={(e) => setLastVisitFilter(e.target.value)}
                        style={{
                            height: '44px',
                            padding: '0 1rem 0 2.5rem',
                            border: '1.5px solid var(--border)',
                            borderRadius: 'var(--radius-lg)',
                            fontSize: '0.875rem',
                            outline: 'none',
                            cursor: 'pointer',
                            backgroundColor: 'var(--bg-card)',
                            color: 'var(--text-dark)',
                            transition: 'all var(--transition-base)',
                            backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%2364748B\' d=\'M6 9L1 4h10z\'/%3E%3C/svg%3E")',
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 0.75rem center',
                            appearance: 'none',
                            paddingRight: '2.5rem'
                        }}
                        onFocus={(e) => {
                            e.currentTarget.style.borderColor = 'var(--primary)';
                            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(35, 76, 106, 0.1)';
                        }}
                        onBlur={(e) => {
                            e.currentTarget.style.borderColor = 'var(--border)';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                    >
                        <option value="all">All Time</option>
                        <option value="30days">Last 30 Days</option>
                        <option value="3months">Last 3 Months</option>
                        <option value="6months">Last 6 Months</option>
                        <option value="over6months">&gt; 6 Months</option>
                        <option value="never">Never Visited</option>
                    </select>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <Button
                        onClick={() => setIsImportModalOpen(true)}
                        variant="secondary"
                        icon={<Download size={18} />}
                        style={{ height: '44px' }}
                    >
                        Import
                    </Button>
                    <Button
                        onClick={handleExportCSV}
                        variant="secondary"
                        icon={<Download size={18} />}
                        style={{ height: '44px' }}
                    >
                        Export
                    </Button>
                    <Button
                        onClick={() => setIsModalOpen(true)}
                        icon={<Plus size={18} />}
                        style={{ height: '44px', fontWeight: 600 }}
                    >
                        Add Customer
                    </Button>
                    <Button
                        onClick={() => {
                            dispatch(invalidateCustomerCache());
                            dispatch(fetchCustomers());
                        }}
                        disabled={customersLoading}
                        style={{
                            height: '44px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            background: 'var(--primary)',
                            color: 'white',
                            padding: '0 1rem',
                            borderRadius: 'var(--radius-md)',
                            boxShadow: 'var(--shadow-sm)'
                        }}
                    >
                        <RefreshCw size={18} className={customersLoading ? 'animate-spin' : ''} />
                    </Button>
                </div>
            </div>

            <Table columns={columns} data={paginatedCustomers} isLoading={customersLoading} skeletonCount={10} />

            {/* Enhanced Pagination Controls */}
            {filteredCustomers.length > 0 && (
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '2rem',
                    padding: '1.5rem',
                    background: 'var(--bg-card)',
                    borderRadius: 'var(--radius-xl)',
                    boxShadow: 'var(--shadow-md)',
                    border: '1px solid var(--border-light)'
                }}>
                    <div style={{
                        fontSize: '0.875rem',
                        color: 'var(--text-gray)',
                        fontWeight: 500
                    }}>
                        Showing <span style={{ fontWeight: 700, color: 'var(--text-dark)' }}>{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                        <span style={{ fontWeight: 700, color: 'var(--text-dark)' }}>{Math.min(currentPage * itemsPerPage, filteredCustomers.length)}</span> of{' '}
                        <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{filteredCustomers.length}</span> customers
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '44px',
                                height: '44px',
                                borderRadius: 'var(--radius-md)',
                                border: '1.5px solid var(--border)',
                                background: currentPage === 1 ? 'var(--bg-body)' : 'var(--bg-card)',
                                color: currentPage === 1 ? 'var(--text-light)' : 'var(--text-dark)',
                                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                transition: 'all var(--transition-base)',
                                boxShadow: currentPage === 1 ? 'none' : 'var(--shadow-sm)'
                            }}
                            onMouseEnter={(e) => {
                                if (currentPage !== 1) {
                                    e.currentTarget.style.borderColor = 'var(--primary)';
                                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (currentPage !== 1) {
                                    e.currentTarget.style.borderColor = 'var(--border)';
                                    e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                                }
                            }}
                        >
                            <ChevronLeft size={20} />
                        </motion.button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum = i + 1;
                                if (totalPages > 5 && currentPage > 3) {
                                    pageNum = currentPage - 2 + i;
                                }
                                if (pageNum > totalPages) return null;

                                return (
                                    <motion.button
                                        key={pageNum}
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => setCurrentPage(pageNum)}
                                        style={{
                                            width: '40px',
                                            height: '40px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderRadius: 'var(--radius-md)',
                                            border: pageNum === currentPage ? '1.5px solid var(--primary)' : '1.5px solid var(--border)',
                                            background: pageNum === currentPage
                                                ? 'linear-gradient(135deg, var(--primary-light) 0%, rgba(232, 244, 248, 0.6) 100%)'
                                                : 'var(--bg-card)',
                                            color: pageNum === currentPage ? 'var(--primary)' : 'var(--text-gray)',
                                            fontWeight: pageNum === currentPage ? 700 : 500,
                                            cursor: 'pointer',
                                            fontSize: '0.875rem',
                                            transition: 'all var(--transition-base)',
                                            boxShadow: pageNum === currentPage ? 'var(--shadow-sm)' : 'none'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (pageNum !== currentPage) {
                                                e.currentTarget.style.background = 'var(--bg-hover)';
                                                e.currentTarget.style.borderColor = 'var(--primary)';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (pageNum !== currentPage) {
                                                e.currentTarget.style.background = 'var(--bg-card)';
                                                e.currentTarget.style.borderColor = 'var(--border)';
                                            }
                                        }}
                                    >
                                        {pageNum}
                                    </motion.button>
                                );
                            })}
                        </div>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '44px',
                                height: '44px',
                                borderRadius: 'var(--radius-md)',
                                border: '1.5px solid var(--border)',
                                background: currentPage === totalPages ? 'var(--bg-body)' : 'var(--bg-card)',
                                color: currentPage === totalPages ? 'var(--text-light)' : 'var(--text-dark)',
                                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                                transition: 'all var(--transition-base)',
                                boxShadow: currentPage === totalPages ? 'none' : 'var(--shadow-sm)'
                            }}
                            onMouseEnter={(e) => {
                                if (currentPage !== totalPages) {
                                    e.currentTarget.style.borderColor = 'var(--primary)';
                                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (currentPage !== totalPages) {
                                    e.currentTarget.style.borderColor = 'var(--border)';
                                    e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                                }
                            }}
                        >
                            <ChevronRight size={20} />
                        </motion.button>
                    </div>
                </div>
            )}

            <Modal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingCustomer(null); }}
                title={editingCustomer ? "Edit Customer" : "Add New Customer"}
            >
                <form className="space-y-6" onSubmit={handleSubmit}>
                    {error && <div style={{ color: 'red', fontSize: '0.875rem' }}>{error}</div>}
                    <div className="grid md-grid-cols-3 gap-4">
                        <Input
                            label="Name"
                            name="name"
                            placeholder="e.g. John Doe"
                            value={formData.name}
                            onChange={handleInputChange}
                            required
                        />
                        <Input
                            label="Email Address"
                            name="email"
                            type="email"
                            placeholder="john@example.com"
                            value={formData.email}
                            onChange={handleInputChange}
                        />
                        <Input
                            label="Date of Birth (DD/MM)"
                            name="dateOfBirth"
                            placeholder="DD/MM"
                            value={formData.dateOfBirth || ''}
                            onChange={(e) => {
                                // Simple input mask for DD/MM
                                let val = e.target.value.replace(/\D/g, '');
                                if (val.length > 4) val = val.slice(0, 4);
                                if (val.length > 2) val = val.slice(0, 2) + '/' + val.slice(2);
                                setFormData({ ...formData, dateOfBirth: val });
                            }}
                            maxLength={5}
                        />
                    </div>

                    <div className="grid md-grid-cols-4 gap-4">
                        <Input
                            label="Phone Number"
                            name="phone"
                            placeholder="(555) 000-0000"
                            value={formData.phone}
                            onChange={handleInputChange}
                        />
                        <Input
                            label="Location"
                            name="city"
                            placeholder="Springfield"
                            value={formData.city}
                            onChange={handleInputChange}
                        />
                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>Status</label>
                            <select
                                name="role"
                                value={formData.role}
                                onChange={handleInputChange}
                                style={{
                                    width: '100%',
                                    padding: '0.6rem 1rem',
                                    border: '1px solid var(--border)',
                                    borderRadius: '0.5rem',
                                    fontSize: '0.9rem',
                                    outline: 'none',
                                    cursor: 'pointer',
                                    backgroundColor: 'white',
                                    height: '44px'
                                }}
                            >
                                <option value="CUSTOMER">Active</option>
                                <option value="INACTIVE">Inactive</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>Age Group</label>
                            <select
                                name="ageGroup"
                                value={formData.ageGroup || ''}
                                onChange={handleInputChange}
                                style={{
                                    width: '100%',
                                    padding: '0.6rem 1rem',
                                    border: '1px solid var(--border)',
                                    borderRadius: '0.5rem',
                                    fontSize: '0.9rem',
                                    outline: 'none',
                                    cursor: 'pointer',
                                    backgroundColor: 'white',
                                    height: '44px'
                                }}
                            >
                                <option value="">Select Age Group</option>
                                <option value="5+">5+</option>
                                <option value="10+">10+</option>
                                <option value="15+">15+</option>
                                <option value="20+">20+</option>
                                <option value="25+">25+</option>
                                <option value="30+">30+</option>
                                <option value="35+">35+</option>
                                <option value="40+">40+</option>
                                <option value="45+">45+</option>
                                <option value="50+">50+</option>
                                <option value="55+">55+</option>
                                <option value="60+">60+</option>
                                <option value="65+">65+</option>
                            </select>
                        </div>
                    </div>





                    <AttachmentsInput
                        attachments={formData.attachments}
                        onChange={(newAttachments) => setFormData({ ...formData, attachments: newAttachments })}
                    />

                    {!editingCustomer && (
                        <div>
                            {(user as any)?.adminId === '25945aeb-b1d1-4020-913e-ebcd4b51f7f6' || user?.id === '25945aeb-b1d1-4020-913e-ebcd4b51f7f6' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #E2E8F0' }}>
                                        <Checkbox
                                            label={
                                                <span style={{ fontSize: '0.85rem', lineHeight: '1.5', color: '#475569', display: 'block' }}>
                                                    By checking this box, I agree to receive transaction and recurring promotional and personalized advertising messages (SMS and MMS) from <strong>Indian Beauty Art - Bugis</strong>, and I consent to these text messages being sent via autodialer to the mobile number I provided above. I understand consent is not a condition of purchase, message and data rates may apply, message frequency varies, and I can reply "STOP" to any Indian Beauty Art - Bugis text to stop receiving texts or "HELP" for help. I also agree to the <strong>Indian Beauty Art - Bugis</strong> <Link to={`/${appId}/${businessName}/terms-and-conditions`} style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'underline' }}>Terms & Conditions</Link> and <Link to={`/${appId}/${businessName}/privacy-policy`} style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'underline' }}>Privacy Policy</Link>.
                                                </span>
                                            }
                                            checked={acceptedTerms}
                                            onChange={(e) => {
                                                setAcceptedTerms(e.target.checked);
                                                if (e.target.checked) setTermsError('');
                                            }}
                                            error={termsError}
                                        />
                                    </div>
                                    <div style={{ textAlign: 'center', borderTop: '1px solid #F1F5F9', paddingTop: '1rem' }}>
                                        <div style={{ fontSize: '0.75rem', color: '#64748B', marginBottom: '1.25rem' }}>
                                            By submitting this feedback, I understand and agree to the <Link to={`/${appId}/${businessName}/terms-and-conditions`} style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'underline' }}>Review and Mobile Marketing Policy</Link>.
                                        </div>
                                        <div style={{ fontWeight: 700, fontSize: '0.925rem', color: '#1E293B', marginBottom: '0.25rem' }}>Indian Beauty Art - Bugis</div>
                                        <div style={{ fontSize: '0.8125rem', color: '#64748B', lineHeight: '1.4' }}>
                                            3 New Bugis Street 2nd Floor CSL A08/09
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <Checkbox
                                    label={
                                        <span>
                                            I agree to the <Link to={`/${appId}/${businessName}/terms-and-conditions`} style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'underline' }}>Terms and Conditions</Link> and <Link to={`/${appId}/${businessName}/privacy-policy`} style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'underline' }}>Privacy Policy</Link>
                                        </span>
                                    }
                                    checked={acceptedTerms}
                                    onChange={(e) => {
                                        setAcceptedTerms(e.target.checked);
                                        if (e.target.checked) setTermsError('');
                                    }}
                                    error={termsError}
                                />
                            )}
                        </div>
                    )}

                    <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                        <Button type="button" variant="ghost" onClick={() => { setIsModalOpen(false); setEditingCustomer(null); }}>Cancel</Button>
                        <Button type="submit" disabled={customersLoading}>{editingCustomer ? 'Update' : 'Save'} Customer</Button>
                    </div>
                </form>
            </Modal>

            {/* Customer Profile Modal */}
            <Modal
                isOpen={isProfileModalOpen}
                onClose={() => { setIsProfileModalOpen(false); setSelectedCustomerId(null); }}
                title="Customer Profile"
            >
                {selectedCustomer && (
                    <div className="space-y-6">
                        {/* Enhanced Customer Info Section */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, 1fr)',
                            gap: '1rem',
                            padding: '1.5rem',
                            background: 'var(--bg-body)',
                            borderRadius: 'var(--radius-lg)',
                            border: '1px solid var(--border-light)'
                        }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.4rem 0.75rem',
                                background: 'var(--bg-card)',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border-light)'
                            }}>
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: 'var(--radius-md)',
                                    background: 'linear-gradient(135deg, var(--primary-light) 0%, rgba(232, 244, 248, 0.6) 100%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--primary)',
                                    flexShrink: 0
                                }}>
                                    <Users size={18} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.125rem' }}>Name</label>
                                    <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-dark)' }}>{selectedCustomer.name}</p>
                                </div>
                            </div>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.4rem 0.75rem',
                                background: 'var(--bg-card)',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border-light)'
                            }}>
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: 'var(--radius-md)',
                                    background: 'linear-gradient(135deg, var(--primary-light) 0%, rgba(232, 244, 248, 0.6) 100%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--primary)',
                                    flexShrink: 0
                                }}>
                                    <Mail size={18} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <label style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.125rem' }}>Email</label>
                                    <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 500, color: 'var(--text-dark)', wordBreak: 'break-word' }}>{selectedCustomer.email}</p>
                                </div>
                            </div>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.4rem 0.75rem',
                                background: 'var(--bg-card)',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border-light)'
                            }}>
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: 'var(--radius-md)',
                                    background: 'linear-gradient(135deg, var(--primary-light) 0%, rgba(232, 244, 248, 0.6) 100%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--primary)',
                                    flexShrink: 0
                                }}>
                                    <Phone size={18} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.125rem' }}>Phone</label>
                                    <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 500, color: 'var(--text-dark)' }}>{selectedCustomer.phone || 'N/A'}</p>
                                </div>
                            </div>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.4rem 0.75rem',
                                background: 'var(--bg-card)',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border-light)'
                            }}>
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: 'var(--radius-md)',
                                    background: 'linear-gradient(135deg, var(--primary-light) 0%, rgba(232, 244, 248, 0.6) 100%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--primary)',
                                    flexShrink: 0
                                }}>
                                    <MapPin size={18} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.125rem' }}>City</label>
                                    <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 500, color: 'var(--text-dark)' }}>{selectedCustomer.city || 'N/A'}</p>
                                </div>
                            </div>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.4rem 0.75rem',
                                background: 'var(--bg-card)',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border-light)'
                            }}>
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: 'var(--radius-md)',
                                    background: 'linear-gradient(135deg, var(--primary-light) 0%, rgba(232, 244, 248, 0.6) 100%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--primary)',
                                    flexShrink: 0
                                }}>
                                    <Calendar size={18} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.125rem' }}>Birthday</label>
                                    <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 500, color: 'var(--text-dark)' }}>{selectedCustomer.dateOfBirth || 'N/A'}</p>
                                </div>
                            </div>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.4rem 0.75rem',
                                background: 'var(--bg-card)',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border-light)'
                            }}>
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: 'var(--radius-md)',
                                    background: 'linear-gradient(135deg, var(--primary-light) 0%, rgba(232, 244, 248, 0.6) 100%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--primary)',
                                    flexShrink: 0
                                }}>
                                    <TrendingUp size={18} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.125rem' }}>Age Group</label>
                                    <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 500, color: 'var(--text-dark)' }}>{selectedCustomer.ageGroup || 'N/A'}</p>
                                </div>
                            </div>
                        </div>


                        {/* Enhanced Statistics Section */}
                        <div style={{
                            borderTop: '1px solid var(--border-light)',
                            paddingTop: '1.5rem',
                            marginTop: '1.5rem'
                        }}>
                            <h3 style={{
                                fontSize: '1.125rem',
                                fontWeight: 700,
                                marginBottom: '1rem',
                                letterSpacing: '-0.025em',
                                background: 'linear-gradient(135deg, var(--text-dark) 0%, var(--text-gray) 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text'
                            }}>
                                Statistics
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                                <motion.div
                                    whileHover={{ y: -4, scale: 1.02 }}
                                    style={{
                                        padding: '1.25rem',
                                        background: 'var(--bg-card)',
                                        borderRadius: 'var(--radius-lg)',
                                        border: '1px solid var(--border-light)',
                                        boxShadow: 'var(--shadow-sm)',
                                        position: 'relative',
                                        overflow: 'hidden'
                                    }}
                                >
                                    <div style={{
                                        position: 'absolute',
                                        top: '-20%',
                                        right: '-20%',
                                        width: '80px',
                                        height: '80px',
                                        borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
                                        opacity: 0.1,
                                        filter: 'blur(30px)'
                                    }} />
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                        <div style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: 'var(--radius-md)',
                                            background: 'linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 100%)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#3B82F6'
                                        }}>
                                            <Calendar size={18} />
                                        </div>
                                        <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Visit Count</label>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-dark)', letterSpacing: '-0.03em' }}>{selectedCustomer.visitCount || 0}</p>
                                </motion.div>
                                <motion.div
                                    whileHover={{ y: -4, scale: 1.02 }}
                                    style={{
                                        padding: '1.25rem',
                                        background: 'var(--bg-card)',
                                        borderRadius: 'var(--radius-lg)',
                                        border: '1px solid var(--border-light)',
                                        boxShadow: 'var(--shadow-sm)',
                                        position: 'relative',
                                        overflow: 'hidden'
                                    }}
                                >
                                    <div style={{
                                        position: 'absolute',
                                        top: '-20%',
                                        right: '-20%',
                                        width: '80px',
                                        height: '80px',
                                        borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #10B981, #059669)',
                                        opacity: 0.1,
                                        filter: 'blur(30px)'
                                    }} />
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                        <div style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: 'var(--radius-md)',
                                            background: 'linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#10B981'
                                        }}>
                                            <DollarSign size={18} />
                                        </div>
                                        <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Spend</label>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: '#10B981', letterSpacing: '-0.03em' }}>
                                        {symbol}{(selectedCustomer.totalSpend || 0).toFixed(2)}
                                    </p>
                                </motion.div>
                                <motion.div
                                    whileHover={{ y: -4, scale: 1.02 }}
                                    style={{
                                        padding: '1.25rem',
                                        background: 'var(--bg-card)',
                                        borderRadius: 'var(--radius-lg)',
                                        border: '1px solid var(--border-light)',
                                        boxShadow: 'var(--shadow-sm)',
                                        position: 'relative',
                                        overflow: 'hidden'
                                    }}
                                >
                                    <div style={{
                                        position: 'absolute',
                                        top: '-20%',
                                        right: '-20%',
                                        width: '80px',
                                        height: '80px',
                                        borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
                                        opacity: 0.1,
                                        filter: 'blur(30px)'
                                    }} />
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                        <div style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: 'var(--radius-md)',
                                            background: 'linear-gradient(135deg, #EDE9FE 0%, #DDD6FE 100%)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#8B5CF6'
                                        }}>
                                            <TrendingUp size={18} />
                                        </div>
                                        <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Last Visit</label>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-dark)' }}>
                                        {selectedCustomer.lastVisit ? new Date(selectedCustomer.lastVisit).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No Visit'}
                                    </p>
                                </motion.div>
                                <motion.div
                                    whileHover={{ y: -4, scale: 1.02 }}
                                    style={{
                                        padding: '1.25rem',
                                        background: 'var(--bg-card)',
                                        borderRadius: 'var(--radius-lg)',
                                        border: '1px solid var(--border-light)',
                                        boxShadow: 'var(--shadow-sm)',
                                        position: 'relative',
                                        overflow: 'hidden'
                                    }}
                                >
                                    <div style={{
                                        position: 'absolute',
                                        top: '-20%',
                                        right: '-20%',
                                        width: '80px',
                                        height: '80px',
                                        borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                                        opacity: 0.1,
                                        filter: 'blur(30px)'
                                    }} />
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                        <div style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: 'var(--radius-md)',
                                            background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#D97706'
                                        }}>
                                            <Ticket size={18} />
                                        </div>
                                        <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Voucher Bal</label>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: '#D97706', letterSpacing: '-0.03em' }}>
                                        {symbol}{totalVoucherBalance.toFixed(2)}
                                    </p>
                                </motion.div>
                            </div>
                        </div>

                        {/* Active Packages / Memberships */}
                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Active Memberships & Packages</h3>
                                <button
                                    onClick={() => selectedCustomerId && fetchCustomerActivePackages(selectedCustomerId)}
                                    title="Refresh packages"
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', display: 'flex', alignItems: 'center', padding: '0.25rem' }}
                                >
                                    <RefreshCw size={15} className={loadingPackages ? 'animate-spin' : ''} />
                                </button>
                            </div>
                            {loadingPackages ? (
                                <p style={{ textAlign: 'center', color: 'var(--text-gray)', padding: '1rem' }}>Loading packages...</p>
                            ) : activePackages.length === 0 ? (
                                <p style={{ textAlign: 'center', color: 'var(--text-gray)', padding: '1rem', fontSize: '0.9rem' }}>No active packages</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {activePackages.map(pkg => (
                                        <div key={pkg.id} style={{
                                            border: '1px solid var(--border)',
                                            borderRadius: '0.5rem',
                                            padding: '0.4rem 0.75rem',
                                            backgroundColor: '#f8fafc'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{pkg.package?.name}</span>
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-gray)' }}>
                                                        Purchased: {pkg.purchaseDate ? new Date(pkg.purchaseDate).toLocaleDateString() : 'N/A'}
                                                    </span>
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-gray)' }}>
                                                        Expires: {pkg.expiryDate ? new Date(pkg.expiryDate).toLocaleDateString() : 'Never'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Usage Details / Balances */}
                                            {pkg.usageDetails && Array.isArray(pkg.usageDetails) && pkg.usageDetails.length > 0 ? (
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.5rem' }}>
                                                    {pkg.usageDetails.map((item: any, idx: number) => (
                                                        <div key={idx} style={{
                                                            backgroundColor: 'white', padding: '0.5rem', borderRadius: '0.375rem',
                                                            border: '1px solid #e2e8f0', fontSize: '0.8rem'
                                                        }}>
                                                            <div style={{ fontWeight: 500, marginBottom: '0.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                                                                <span>Rem: <span style={{ fontWeight: 600, color: item.remainingQuantity > 0 ? 'var(--success)' : 'var(--danger)' }}>{item.remainingQuantity}</span></span>
                                                                <span>Total: {item.totalQuantity}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : pkg.isCombo ? (
                                                /* Combo purchase fallback if definition not found */
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                                                    <Ticket size={14} style={{ color: 'var(--text-gray)' }} />
                                                    <span style={{ color: 'var(--text-gray)', fontStyle: 'italic' }}>
                                                        Combo items available for redemption
                                                    </span>
                                                </div>
                                            ) : (
                                                /* Legacy View */
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                                                    <div style={{ flex: 1, height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                                        <div style={{
                                                            width: `${(pkg.remainingQuantity / pkg.totalQuantity) * 100}%`,
                                                            height: '100%', backgroundColor: 'var(--success)'
                                                        }} />
                                                    </div>
                                                    <span style={{ fontWeight: 600 }}>{pkg.remainingQuantity}/{pkg.totalQuantity} left</span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Attachments Section */}
                        {selectedCustomer.attachments && selectedCustomer.attachments.length > 0 && (
                            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '1rem' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Attachments</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
                                    {selectedCustomer.attachments.map((att, idx) => (
                                        <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: '0.5rem', overflow: 'hidden' }}>
                                            <a href={att.url} target="_blank" rel="noopener noreferrer">
                                                <img
                                                    src={att.url}
                                                    alt={att.title || 'Attachment'}
                                                    style={{ width: '100%', height: '120px', objectFit: 'cover' }}
                                                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/150x120?text=File'; }}
                                                />
                                            </a>
                                            <div style={{ padding: '0.5rem' }}>
                                                <div style={{ fontWeight: 500, fontSize: '0.85rem', marginBottom: '0.25rem' }}>{att.title || 'Untitled'}</div>
                                                {att.remarks && <div style={{ fontSize: '0.75rem', color: 'var(--text-gray)' }}>{att.remarks}</div>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Enhanced Appointment History Timeline */}
                        <div style={{
                            borderTop: '1px solid var(--border-light)',
                            paddingTop: '1.5rem',
                            marginTop: '1.5rem'
                        }}>
                            <h3 style={{
                                fontSize: '1.125rem',
                                fontWeight: 700,
                                marginBottom: '1rem',
                                letterSpacing: '-0.025em',
                                background: 'linear-gradient(135deg, var(--text-dark) 0%, var(--text-gray) 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text'
                            }}>
                                Appointment History
                            </h3>
                            {loadingAppointments ? (
                                <p style={{ textAlign: 'center', color: 'var(--text-gray)', padding: '2rem' }}>Loading appointments...</p>
                            ) : customerAppointments.length === 0 ? (
                                <p style={{ textAlign: 'center', color: 'var(--text-gray)', padding: '2rem' }}>No appointments found</p>
                            ) : (
                                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                    {customerAppointments.map((appointment, index) => (
                                        <motion.div
                                            key={appointment.id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            style={{
                                                display: 'flex',
                                                gap: '1rem',
                                                padding: '1rem',
                                                marginBottom: '0.75rem',
                                                background: 'var(--bg-card)',
                                                borderRadius: 'var(--radius-lg)',
                                                border: '1px solid var(--border-light)',
                                                boxShadow: 'var(--shadow-sm)',
                                                transition: 'all var(--transition-base)'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                                                e.currentTarget.style.transform = 'translateX(4px)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                                                e.currentTarget.style.transform = 'translateX(0)';
                                            }}
                                        >
                                            {/* Enhanced Timeline dot */}
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                <div style={{
                                                    width: '16px',
                                                    height: '16px',
                                                    borderRadius: '50%',
                                                    background: appointment.status === 'COMPLETED'
                                                        ? 'linear-gradient(135deg, #10B981, #059669)'
                                                        : appointment.status === 'CANCELLED'
                                                            ? 'linear-gradient(135deg, #EF4444, #DC2626)'
                                                            : 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                                                    marginTop: '0.25rem',
                                                    border: '3px solid var(--bg-card)',
                                                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                                                    position: 'relative',
                                                    zIndex: 1
                                                }} />
                                                {index < customerAppointments.length - 1 && (
                                                    <div style={{
                                                        width: '2px',
                                                        flex: 1,
                                                        background: 'linear-gradient(to bottom, var(--border), transparent)',
                                                        minHeight: '60px',
                                                        marginTop: '0.25rem'
                                                    }} />
                                                )}
                                            </div>

                                            {/* Enhanced Appointment details */}
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
                                                    <div style={{ flex: 1 }}>
                                                        <h4 style={{
                                                            fontSize: '0.9375rem',
                                                            fontWeight: 700,
                                                            marginBottom: '0.375rem',
                                                            color: 'var(--text-dark)',
                                                            letterSpacing: '-0.01em'
                                                        }}>
                                                            {appointment.service.name}
                                                        </h4>
                                                        <p style={{
                                                            fontSize: '0.8125rem',
                                                            color: 'var(--text-gray)',
                                                            margin: 0
                                                        }}>
                                                            with {appointment.stylist?.name || 'Unassigned'}
                                                        </p>
                                                    </div>
                                                    <span style={{
                                                        padding: '0.375rem 0.875rem',
                                                        borderRadius: 'var(--radius-full)',
                                                        fontSize: '0.7rem',
                                                        fontWeight: 600,
                                                        background: appointment.status === 'COMPLETED'
                                                            ? 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)'
                                                            : appointment.status === 'CANCELLED'
                                                                ? 'linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)'
                                                                : appointment.status === 'CONFIRMED'
                                                                    ? 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)'
                                                                    : 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
                                                        color: appointment.status === 'COMPLETED' ? '#047857' :
                                                            appointment.status === 'CANCELLED' ? '#B91C1C' :
                                                                appointment.status === 'CONFIRMED' ? '#1D4ED8' :
                                                                    '#92400E',
                                                        border: `1px solid ${appointment.status === 'COMPLETED' ? '#A7F3D0' :
                                                            appointment.status === 'CANCELLED' ? '#FECACA' :
                                                                appointment.status === 'CONFIRMED' ? '#BFDBFE' :
                                                                    '#FDE68A'}`,
                                                        whiteSpace: 'nowrap',
                                                        boxShadow: 'var(--shadow-sm)'
                                                    }}>
                                                        {appointment.status}
                                                    </span>
                                                </div>
                                                <div style={{
                                                    display: 'flex',
                                                    gap: '1rem',
                                                    flexWrap: 'wrap',
                                                    padding: '0.4rem 0.75rem',
                                                    background: 'var(--bg-body)',
                                                    borderRadius: 'var(--radius-md)',
                                                    border: '1px solid var(--border-light)'
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: 'var(--text-gray)' }}>
                                                        <Calendar size={14} />
                                                        <span>{new Date(appointment.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: 'var(--text-gray)' }}>
                                                        <span>🕐</span>
                                                        <span>{new Date(appointment.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', fontWeight: 600, color: '#10B981' }}>
                                                        <DollarSign size={14} />
                                                        <span>{symbol}{appointment.service.price.toFixed(2)}</span>
                                                    </div>
                                                </div>
                                                {appointment.notes && (
                                                    <div style={{
                                                        marginTop: '0.75rem',
                                                        padding: '0.4rem 0.75rem',
                                                        background: 'var(--primary-light)',
                                                        borderRadius: 'var(--radius-md)',
                                                        border: '1px solid var(--primary)',
                                                        borderLeft: '3px solid var(--primary)'
                                                    }}>
                                                        <p style={{
                                                            fontSize: '0.8125rem',
                                                            color: 'var(--text-dark)',
                                                            margin: 0,
                                                            fontStyle: 'italic'
                                                        }}>
                                                            <strong>Note:</strong> {appointment.notes}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Enhanced Sales History Timeline */}
                        <div style={{
                            borderTop: '1px solid var(--border-light)',
                            paddingTop: '1.5rem',
                            marginTop: '1.5rem'
                        }}>
                            <h3 style={{
                                fontSize: '1.125rem',
                                fontWeight: 700,
                                marginBottom: '1rem',
                                letterSpacing: '-0.025em',
                                background: 'linear-gradient(135deg, var(--text-dark) 0%, var(--text-gray) 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text'
                            }}>
                                Sales History
                            </h3>
                            {loadingSales ? (
                                <p style={{ textAlign: 'center', color: 'var(--text-gray)', padding: '2rem' }}>Loading sales...</p>
                            ) : customerSales.length === 0 ? (
                                <p style={{ textAlign: 'center', color: 'var(--text-gray)', padding: '2rem' }}>No sales found</p>
                            ) : (
                                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                    {customerSales.map((sale, index) => (
                                        <motion.div
                                            key={sale.id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            style={{
                                                display: 'flex',
                                                gap: '1rem',
                                                padding: '1rem',
                                                marginBottom: '0.75rem',
                                                background: 'var(--bg-card)',
                                                borderRadius: 'var(--radius-lg)',
                                                border: '1px solid var(--border-light)',
                                                boxShadow: 'var(--shadow-sm)',
                                                transition: 'all var(--transition-base)'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                                                e.currentTarget.style.transform = 'translateX(4px)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                                                e.currentTarget.style.transform = 'translateX(0)';
                                            }}
                                        >
                                            {/* Enhanced Timeline dot */}
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                <div style={{
                                                    width: '16px',
                                                    height: '16px',
                                                    borderRadius: '50%',
                                                    background: sale.saleStatus === 'COMPLETED'
                                                        ? 'linear-gradient(135deg, #10B981, #059669)'
                                                        : sale.saleStatus === 'CANCELLED'
                                                            ? 'linear-gradient(135deg, #EF4444, #DC2626)'
                                                            : 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                                                    marginTop: '0.25rem',
                                                    border: '3px solid var(--bg-card)',
                                                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                                                    position: 'relative',
                                                    zIndex: 1
                                                }} />
                                                {index < customerSales.length - 1 && (
                                                    <div style={{
                                                        width: '2px',
                                                        flex: 1,
                                                        background: 'linear-gradient(to bottom, var(--border), transparent)',
                                                        minHeight: '60px',
                                                        marginTop: '0.25rem'
                                                    }} />
                                                )}
                                            </div>

                                            {/* Sale details */}
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                                                    <div>
                                                        <div style={{ marginBottom: '0.5rem' }}>
                                                            {sale.items && sale.items.length > 0 ? (
                                                                sale.items.map((item: any, i: number) => (
                                                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                                                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                                                            {item.quantity > 1 ? `${item.quantity}x ` : ''}{item.name}
                                                                        </span>
                                                                        {item.type === 'combo' && (
                                                                            <span style={{
                                                                                fontSize: '0.65rem',
                                                                                padding: '0.1rem 0.4rem',
                                                                                borderRadius: '4px',
                                                                                backgroundColor: '#ffedd5',
                                                                                color: '#9a3412',
                                                                                fontWeight: 700,
                                                                                textTransform: 'uppercase',
                                                                                border: '1px solid #fed7aa'
                                                                            }}>
                                                                                Combo
                                                                            </span>
                                                                        )}
                                                                        {(item.price === 0 || item.redeemedQuantity > 0) && (
                                                                            <span style={{
                                                                                fontSize: '0.65rem',
                                                                                padding: '0.1rem 0.4rem',
                                                                                borderRadius: '4px',
                                                                                backgroundColor: '#dcfce7',
                                                                                color: '#166534',
                                                                                fontWeight: 700,
                                                                                textTransform: 'uppercase',
                                                                                border: '1px solid #bbf7d0'
                                                                            }}>
                                                                                Redeemed
                                                                            </span>
                                                                        )}
                                                                        {item.type !== 'combo' && !(item.price === 0 || item.redeemedQuantity > 0) && (
                                                                            <span style={{
                                                                                fontSize: '0.7rem',
                                                                                padding: '0.1rem 0.4rem',
                                                                                borderRadius: '4px',
                                                                                backgroundColor: '#e2e8f0',
                                                                                color: '#475569',
                                                                                textTransform: 'uppercase'
                                                                            }}>
                                                                                {item.type}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <span style={{ fontStyle: 'italic', color: 'var(--text-gray)' }}>No items listed</span>
                                                            )}
                                                        </div>
                                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-gray)' }}>
                                                            {sale.saleNumber}
                                                        </p>
                                                    </div>
                                                    <span style={{
                                                        padding: '0.375rem 0.875rem',
                                                        borderRadius: 'var(--radius-full)',
                                                        fontSize: '0.7rem',
                                                        fontWeight: 600,
                                                        background: sale.saleStatus === 'COMPLETED'
                                                            ? 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)'
                                                            : sale.saleStatus === 'CANCELLED'
                                                                ? 'linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)'
                                                                : 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
                                                        color: sale.saleStatus === 'COMPLETED' ? '#047857' :
                                                            sale.saleStatus === 'CANCELLED' ? '#B91C1C' : '#92400E',
                                                        border: `1px solid ${sale.saleStatus === 'COMPLETED' ? '#A7F3D0' :
                                                            sale.saleStatus === 'CANCELLED' ? '#FECACA' : '#FDE68A'}`,
                                                        whiteSpace: 'nowrap',
                                                        boxShadow: 'var(--shadow-sm)'
                                                    }}>
                                                        {sale.saleStatus}
                                                    </span>
                                                </div>
                                                <div style={{
                                                    display: 'flex',
                                                    gap: '1rem',
                                                    flexWrap: 'wrap',
                                                    padding: '0.4rem 0.75rem',
                                                    background: 'var(--bg-body)',
                                                    borderRadius: 'var(--radius-md)',
                                                    border: '1px solid var(--border-light)'
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: 'var(--text-gray)' }}>
                                                        <Calendar size={14} />
                                                        <span>{new Date(sale.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', fontWeight: 700, color: '#10B981' }}>
                                                        <DollarSign size={14} />
                                                        <span>{symbol}{sale.totalAmount.toFixed(2)}</span>
                                                    </div>
                                                    <div style={{
                                                        padding: '0.25rem 0.625rem',
                                                        borderRadius: 'var(--radius-full)',
                                                        fontSize: '0.7rem',
                                                        fontWeight: 600,
                                                        background: sale.paymentStatus === 'COMPLETED'
                                                            ? 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)'
                                                            : sale.paymentStatus === 'PENDING'
                                                                ? 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)'
                                                                : 'linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)',
                                                        color: sale.paymentStatus === 'COMPLETED' ? '#047857' :
                                                            sale.paymentStatus === 'PENDING' ? '#92400E' : '#B91C1C',
                                                        border: `1px solid ${sale.paymentStatus === 'COMPLETED' ? '#A7F3D0' :
                                                            sale.paymentStatus === 'PENDING' ? '#FDE68A' : '#FECACA'}`,
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        {sale.paymentStatus}
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Voucher History */}
                        <div style={{
                            borderTop: '1px solid var(--border-light)',
                            paddingTop: '1.5rem',
                            marginTop: '1.5rem'
                        }}>
                            <h3 style={{
                                fontSize: '1.125rem',
                                fontWeight: 700,
                                marginBottom: '1rem',
                                letterSpacing: '-0.025em',
                                background: 'linear-gradient(135deg, var(--text-dark) 0%, var(--text-gray) 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text'
                            }}>
                                Voucher History
                            </h3>
                            {loadingVoucherClaims ? (
                                <p style={{ textAlign: 'center', color: 'var(--text-gray)', padding: '2rem' }}>Loading vouchers...</p>
                            ) : customerVoucherClaims.length === 0 ? (
                                <p style={{ textAlign: 'center', color: 'var(--text-gray)', padding: '2rem' }}>No voucher history found</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto' }}>
                                    {customerVoucherClaims.map((claim) => (
                                        <div key={claim.id} style={{
                                            padding: '1rem',
                                            background: 'var(--bg-card)',
                                            borderRadius: 'var(--radius-lg)',
                                            border: '1px solid var(--border-light)',
                                            boxShadow: 'var(--shadow-sm)'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                                <div>
                                                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-dark)' }}>
                                                        {claim.voucherCode}
                                                    </h4>
                                                    {claim.voucher && (
                                                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-gray)' }}>
                                                            {claim.voucher.name}
                                                        </p>
                                                    )}
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <span style={{
                                                        fontSize: '0.75rem',
                                                        fontWeight: 600,
                                                        background: claim.balance > 0 ? '#dcfce7' : '#fee2e2',
                                                        color: claim.balance > 0 ? '#166534' : '#991b1b',
                                                        padding: '0.2rem 0.6rem',
                                                        borderRadius: '1rem',
                                                        display: 'inline-block',
                                                        marginBottom: '0.25rem'
                                                    }}>
                                                        Balance: {symbol}{claim.balance.toFixed(2)}
                                                    </span>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>
                                                        Status: {claim.status.replace('_', ' ')}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Usage History */}
                                            {claim.usageHistory && (Array.isArray(claim.usageHistory) ? claim.usageHistory : JSON.parse(claim.usageHistory as any)).length > 0 && (
                                                <div style={{ background: 'var(--bg-body)', padding: '0.75rem', borderRadius: '0.5rem', marginTop: '0.5rem' }}>
                                                    <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-gray)' }}>Usage Activity</p>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                        {(Array.isArray(claim.usageHistory) ? claim.usageHistory : JSON.parse(claim.usageHistory as any)).map((usage: any, idx: number) => (
                                                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                                                <span style={{ color: 'var(--text-dark)' }}>Sale #{usage.saleId ? usage.saleId.substring(0, 8) : 'N/A'}</span>
                                                                <span style={{ color: '#ef4444', fontWeight: 500 }}>-{symbol}{usage.amount.toFixed(2)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Package Usage History (Grouped by Package) */}
                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '1rem' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Package Usage History</h3>
                            {loadingSales || loadingPackages ? (
                                <p style={{ textAlign: 'center', color: 'var(--text-gray)', padding: '2rem' }}>Loading history...</p>
                            ) : (
                                <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    {/* 1. Group items by Package ID */}
                                    {(() => {
                                        const redeemedItems = customerSales
                                            .flatMap(sale => (sale.items || [])
                                                .filter((item: any) => item.redeemedFromPackageId)
                                                .map((item: any) => ({
                                                    ...item,
                                                    saleDate: sale.createdAt,
                                                    saleNumber: sale.saleNumber
                                                }))
                                            );

                                        if (redeemedItems.length === 0) {
                                            return <p style={{ textAlign: 'center', color: 'var(--text-gray)', padding: '2rem' }}>No usage history found</p>;
                                        }

                                        // Helper to render a list of items
                                        const renderItems = (items: any[]) => (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                {items.sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime()).map((usage, idx) => (
                                                    <div key={idx} style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        padding: '0.4rem 0.75rem',
                                                        backgroundColor: 'white',
                                                        borderRadius: '0.5rem',
                                                        border: '1px solid #e2e8f0',
                                                        marginLeft: '0.5rem',
                                                        borderLeft: '3px solid var(--primary)'
                                                    }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                            <span style={{ fontWeight: 600, color: 'var(--text-dark)' }}>
                                                                {usage.quantity > 1 ? `${usage.quantity}x ` : ''}{usage.name}
                                                            </span>
                                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-gray)' }}>
                                                                {new Date(usage.saleDate).toLocaleDateString()} • {new Date(usage.saleDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                        <div style={{ textAlign: 'right' }}>
                                                            {/* <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Used from package</span> */}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        );

                                        // usedPackageIds tracks which packages we have shown
                                        const usedPackageIds = new Set();

                                        return (
                                            <>
                                                {/* ACTIVE PACKAGES */}
                                                {activePackages.map(pkg => {
                                                    const pkgItems = redeemedItems.filter(i => i.redeemedFromPackageId === pkg.id);
                                                    if (pkgItems.length > 0) usedPackageIds.add(pkg.id);

                                                    // Even if no items, we might want to show the active package exists? 
                                                    // User asked for "Usage History", so let's show it if it has usage OR if it's active (to show "No usage yet").
                                                    // Let's show all active packages here.

                                                    return (
                                                        <div key={pkg.id} style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                                                <div>
                                                                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary)' }}>
                                                                        {pkg.package?.name || 'Unknown Package'}
                                                                    </h4>
                                                                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                                                                        Expires: {pkg.expiryDate ? new Date(pkg.expiryDate).toLocaleDateString() : 'Never'}
                                                                    </p>
                                                                </div>
                                                                <span style={{ fontSize: '0.75rem', fontWeight: 600, background: '#dcfce7', color: '#166534', padding: '0.2rem 0.6rem', borderRadius: '1rem' }}>Active</span>
                                                            </div>

                                                            {pkgItems.length > 0 ? renderItems(pkgItems) : (
                                                                <p style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic', margin: 0, paddingLeft: '0.5rem' }}>No items redeemed yet.</p>
                                                            )}
                                                        </div>
                                                    );
                                                })}

                                                {/* PAST / EXPIRED PACKAGES (Items that don't belong to any active package) */}
                                                {(() => {
                                                    const orphanItems = redeemedItems.filter(i => !activePackages.find(p => p.id === i.redeemedFromPackageId));
                                                    if (orphanItems.length === 0) return null;

                                                    // Group orphans by ID to try and reconstruct package groups if possible, or just list them
                                                    // Since we don't have the package name for expired packages easily (unless we fetch all), we grouping by ID
                                                    const orphanGroups = orphanItems.reduce((acc: any, item: any) => {
                                                        const pid = item.redeemedFromPackageId;
                                                        if (!acc[pid]) acc[pid] = [];
                                                        acc[pid].push(item);
                                                        return acc;
                                                    }, {});

                                                    return Object.entries(orphanGroups).map(([pkgId, items]: [string, any]) => (
                                                        <div key={pkgId} style={{ background: '#fff1f2', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #ffe4e6' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                                                <div>
                                                                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#9f1239' }}>
                                                                        Expired / Past Package
                                                                    </h4>
                                                                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#9f1239', opacity: 0.8 }}>
                                                                        ID: {pkgId.substring(0, 8)}...
                                                                    </p>
                                                                </div>
                                                                <span style={{ fontSize: '0.75rem', fontWeight: 600, background: '#fee2e2', color: '#991b1b', padding: '0.2rem 0.6rem', borderRadius: '1rem' }}>Inactive</span>
                                                            </div>
                                                            {renderItems(items as any[])}
                                                        </div>
                                                    ));
                                                })()}
                                            </>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>

                        <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                            <Button type="button" onClick={() => { setIsProfileModalOpen(false); setSelectedCustomerId(null); }}>Close</Button>
                        </div>
                    </div>
                )}
            </Modal>
            {/* Import Modal */}
            <Modal
                isOpen={isImportModalOpen}
                onClose={() => {
                    setIsImportModalOpen(false);
                    setImportFile(null);
                }}
                title="Import Customers from CSV"
            >
                <form onSubmit={handleImportSubmit} className="space-y-6">
                    <div style={{
                        padding: '2rem',
                        border: '2px dashed var(--border)',
                        borderRadius: '0.5rem',
                        textAlign: 'center',
                        backgroundColor: '#f8fafc'
                    }}>
                        <input
                            type="file"
                            accept=".csv"
                            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                            style={{ display: 'none' }}
                            id="customer-csv-upload"
                        />
                        <label
                            htmlFor="customer-csv-upload"
                            style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}
                        >
                            <Download size={40} className="text-gray-400" />
                            <div>
                                <p style={{ fontWeight: 600 }}>{importFile ? importFile.name : 'Click to upload or drag and drop'}</p>
                                <p style={{ fontSize: '0.875rem', color: 'var(--text-gray)' }}>CSV files only</p>
                            </div>
                        </label>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <button
                            type="button"
                            onClick={handleDownloadTemplate}
                            style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}
                        >
                            Download Template
                        </button>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => {
                                    setIsImportModalOpen(false);
                                    setImportFile(null);
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={!importFile || isImporting}
                            >
                                Upload & Import
                            </Button>
                        </div>
                    </div>
                </form>
            </Modal>
        </div >
    );
};

export default Customers;
