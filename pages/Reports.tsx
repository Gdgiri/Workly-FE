import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../components/UI';
import { useCurrency } from '../components/CurrencyContext';
import api from '../utils/api';
import { 
  Download, Search, ArrowUpDown, ChevronUp, ChevronDown, 
  ChevronLeft, ChevronRight, Filter, Calendar, DollarSign, 
  Users, ShoppingBag, Tag, Briefcase, FileText
} from 'lucide-react';

interface ColumnConfig {
  header: string;
  accessor: (row: any) => React.ReactNode;
  textAccessor?: (row: any) => string;
  sortKey?: string;
}

const Reports: React.FC = () => {
  const { symbol, formatPrice } = useCurrency();
  
  // State for data
  const [appointments, setAppointments] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeReport, setActiveReport] = useState<string>('sales');
  
  // Date Filter State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Sorting State
  const [sortField, setSortField] = useState<string>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchLiveData();
  }, []);

  const fetchLiveData = async () => {
    try {
      setLoading(true);
      const [
        appointmentsRes, 
        servicesRes, 
        salesRes, 
        customersRes, 
        vouchersRes, 
        claimsRes, 
        inventoryRes,
        packagesRes
      ] = await Promise.all([
        api.get('/appointments').catch(() => ({ data: [] })),
        api.get('/services').catch(() => ({ data: [] })),
        api.get('/sales').catch(() => ({ data: [] })),
        api.get('/customers').catch(() => ({ data: [] })),
        api.get('/vouchers').catch(() => ({ data: [] })),
        api.get('/vouchers/claims').catch(() => ({ data: [] })),
        api.get('/inventory').catch(() => ({ data: [] })),
        api.get('/packages').catch(() => ({ data: [] }))
      ]);

      setAppointments(Array.isArray(appointmentsRes.data) ? appointmentsRes.data : []);
      setServices(Array.isArray(servicesRes.data) ? servicesRes.data : []);
      setSales(Array.isArray(salesRes.data) ? salesRes.data : (salesRes.data?.sales || []));
      setCustomers(Array.isArray(customersRes.data) ? customersRes.data : []);
      setVouchers(Array.isArray(vouchersRes.data) ? vouchersRes.data : []);
      setClaims(Array.isArray(claimsRes.data) ? claimsRes.data : []);
      setProducts(Array.isArray(inventoryRes.data) ? inventoryRes.data : []);
      setPackages(Array.isArray(packagesRes.data) ? packagesRes.data : (packagesRes.data?.packages || []));
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching reports data:', error);
      setLoading(false);
    }
  };

  // Helper: Calculate total spent & visits count for a customer
  const customerStats = useMemo(() => {
    const stats: Record<string, { spent: number; visits: number; packagesCount: number; vouchersCount: number }> = {};
    
    // Initialize stats for all customers
    customers.forEach(c => {
      stats[c.id] = { spent: 0, visits: 0, packagesCount: 0, vouchersCount: 0 };
    });

    // Sum sales spent
    sales.forEach(sale => {
      if (sale.customerId && stats[sale.customerId]) {
        stats[sale.customerId].spent += (sale.paidAmount || sale.totalAmount || 0);
      }
    });

    // Count appointments
    appointments.forEach(apt => {
      const cId = apt.userId || apt.customerId;
      if (cId && stats[cId]) {
        stats[cId].visits += 1;
      }
    });

    // Count voucher claims
    claims.forEach(claim => {
      if (claim.customerId && stats[claim.customerId]) {
        stats[claim.customerId].vouchersCount += 1;
      }
    });

    return stats;
  }, [customers, sales, appointments, claims]);

  // Aggregate Data based on selected report type
  const reportData = useMemo(() => {
    switch (activeReport) {
      case 'sales': // All Sale Report
        return sales;

      case 'customers': // By Customer
        return customers.map(c => ({
          ...c,
          totalSpent: c.totalSpend !== undefined ? c.totalSpend : (customerStats[c.id]?.spent || 0),
          visitsCount: c.visitCount !== undefined ? c.visitCount : (customerStats[c.id]?.visits || 0)
        }));

      case 'visits': // By Visit
        return appointments;

      case 'products': // By Product
        return products;

      case 'services': // By Service
        return services;

      case 'packages': // By Package Combos
        return packages;

      case 'vouchers': // By Voucher Campaigns
        return vouchers;

      case 'cust_pkg_voucher': // Customers with Packages or Vouchers
        return customers
          .map(c => ({
            ...c,
            packagesCount: c.packages?.length || c.customerPackages?.length || 0,
            vouchersCount: customerStats[c.id]?.vouchersCount || 0
          }))
          .filter(c => c.packagesCount > 0 || c.vouchersCount > 0);

      case 'cust_no_voucher': // Customers without vouchers
        const claimedCustomerIds = new Set(claims.map(cl => cl.customerId).filter(Boolean));
        return customers.filter(c => !claimedCustomerIds.has(c.id));

      case 'cust_no_visit_last_month': // Customers who did not visit last month
        const now = new Date();
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        const visitedLastMonthCustomerIds = new Set();
        appointments.forEach(apt => {
          if (apt.startTime) {
            const aptDate = new Date(apt.startTime);
            if (aptDate >= startOfLastMonth && aptDate <= endOfLastMonth) {
              const cId = apt.userId || apt.customerId;
              if (cId) visitedLastMonthCustomerIds.add(cId);
            }
          }
        });
        return customers.filter(c => !visitedLastMonthCustomerIds.has(c.id));

      case 'cust_birthday': // This Month Birthday
        const currentMonth = new Date().getMonth(); // 0-indexed
        return customers.filter(c => {
          if (!c.dateOfBirth) return false;
          try {
            const birthDate = new Date(c.dateOfBirth);
            if (isNaN(birthDate.getTime())) {
              // Fallback split for formats like YYYY-MM-DD
              const parts = c.dateOfBirth.split(/[-/]/);
              if (parts.length === 3) {
                if (parts[0].length === 4) { // YYYY-MM-DD
                  return (parseInt(parts[1], 10) - 1) === currentMonth;
                }
                if (parts[2].length === 4) { // MM-DD-YYYY or DD-MM-YYYY
                  // Since MM/DD is ambiguous, we'll try to check both parts if date is invalid,
                  // but usually standard Date parses it.
                  return (parseInt(parts[0], 10) - 1) === currentMonth || (parseInt(parts[1], 10) - 1) === currentMonth;
                }
              }
              return false;
            }
            return birthDate.getMonth() === currentMonth;
          } catch {
            return false;
          }
        });

      default:
        return [];
    }
  }, [activeReport, sales, customers, appointments, products, services, packages, vouchers, claims, customerStats]);

  // Filter & Search Logic
  const filteredData = useMemo(() => {
    let data = reportData;

    // Apply Date Range filters dynamically
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      data = data.filter((row: any) => {
        const dateValue = row.createdAt || row.startTime || row.dateOfBirth;
        if (!dateValue) return false;
        const rowDate = new Date(dateValue);
        return !isNaN(rowDate.getTime()) && rowDate >= start;
      });
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      data = data.filter((row: any) => {
        const dateValue = row.createdAt || row.startTime || row.dateOfBirth;
        if (!dateValue) return false;
        const rowDate = new Date(dateValue);
        return !isNaN(rowDate.getTime()) && rowDate <= end;
      });
    }

    if (!searchTerm.trim()) return data;
    const lowerSearch = searchTerm.toLowerCase();

    return data.filter((row: any) => {
      // General field search logic depending on active report schema
      if (activeReport === 'sales') {
        return (
          String(row.invoiceId || '').toLowerCase().includes(lowerSearch) ||
          String(row.customerName || '').toLowerCase().includes(lowerSearch) ||
          String(row.paymentMethod || '').toLowerCase().includes(lowerSearch)
        );
      }
      if (activeReport === 'customers' || activeReport.startsWith('cust_')) {
        return (
          String(row.name || '').toLowerCase().includes(lowerSearch) ||
          String(row.phone || '').toLowerCase().includes(lowerSearch) ||
          String(row.email || '').toLowerCase().includes(lowerSearch)
        );
      }
      if (activeReport === 'visits') {
        return (
          String(row.customerName || '').toLowerCase().includes(lowerSearch) ||
          String(row.serviceName || '').toLowerCase().includes(lowerSearch) ||
          String(row.stylistName || '').toLowerCase().includes(lowerSearch)
        );
      }
      if (activeReport === 'products') {
        return (
          String(row.name || '').toLowerCase().includes(lowerSearch) ||
          String(row.sku || '').toLowerCase().includes(lowerSearch) ||
          String(row.category || '').toLowerCase().includes(lowerSearch)
        );
      }
      if (activeReport === 'services') {
        return (
          String(row.name || '').toLowerCase().includes(lowerSearch) ||
          String(row.category || '').toLowerCase().includes(lowerSearch)
        );
      }
      if (activeReport === 'packages') {
        return String(row.name || '').toLowerCase().includes(lowerSearch);
      }
      if (activeReport === 'vouchers') {
        return (
          String(row.voucherCode || row.code || '').toLowerCase().includes(lowerSearch) ||
          String(row.discountType || '').toLowerCase().includes(lowerSearch)
        );
      }
      return false;
    });
  }, [reportData, searchTerm, activeReport, startDate, endDate]);

  // Sorting Logic
  const sortedData = useMemo(() => {
    if (!sortField) return filteredData;

    return [...filteredData].sort((a: any, b: any) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      // Handle nested or custom sort fields if needed
      if (sortField === 'date') {
        aVal = new Date(a.createdAt || a.startTime || 0).getTime();
        bVal = new Date(b.createdAt || b.startTime || 0).getTime();
      }

      if (typeof aVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal) 
          : bVal.localeCompare(aVal);
      }

      if (typeof aVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      return 0;
    });
  }, [filteredData, sortField, sortDirection]);

  // Paginated Data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedData.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedData, currentPage]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / itemsPerPage));

  // Reset pagination on report type, search, or date changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeReport, searchTerm, startDate, endDate]);

  // Change sorting details
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // CSV Excel Exporter
  const downloadExcel = () => {
    if (sortedData.length === 0) return;

    const cols = columnsMap[activeReport];
    const headers = cols.map(c => c.header);
    
    // Header Row
    const csvRows = [
      headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',')
    ];

    // Data Rows
    sortedData.forEach(row => {
      const values = cols.map(c => {
        let val = '';
        if (c.textAccessor) {
          const res = c.textAccessor(row);
          val = res !== undefined && res !== null ? String(res) : '';
        } else if (typeof c.accessor === 'function') {
          const res = row[c.sortKey || ''];
          val = res !== undefined && res !== null ? String(res) : '';
        } else {
          const res = row[c.sortKey || ''];
          val = res !== undefined && res !== null ? String(res) : '';
        }
        return `"${val.replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    });

    const csvContent = "\uFEFF" + csvRows.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${activeReport}_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Define Columns and Text Accessors for each report category
  const columnsMap: Record<string, ColumnConfig[]> = {
    sales: [
      { 
        header: 'Invoice ID', 
        accessor: row => <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{row.invoiceId || row.id.substring(0, 8)}</span>,
        textAccessor: row => row.invoiceId || row.id,
        sortKey: 'invoiceId'
      },
      { 
        header: 'Customer', 
        accessor: row => row.customerName || 'Walk-in',
        textAccessor: row => row.customerName || 'Walk-in',
        sortKey: 'customerName'
      },
      { 
        header: 'Date', 
        accessor: row => new Date(row.createdAt).toLocaleDateString(),
        textAccessor: row => new Date(row.createdAt).toLocaleDateString(),
        sortKey: 'date'
      },
      { 
        header: 'Total Amount', 
        accessor: row => formatPrice(row.totalAmount),
        textAccessor: row => String(row.totalAmount),
        sortKey: 'totalAmount'
      },
      { 
        header: 'Paid Amount', 
        accessor: row => formatPrice(row.paidAmount),
        textAccessor: row => String(row.paidAmount),
        sortKey: 'paidAmount'
      },
      { 
        header: 'Payment Method', 
        accessor: row => <span className="badge badge-neutral">{row.paymentMethod}</span>,
        textAccessor: row => row.paymentMethod,
        sortKey: 'paymentMethod'
      },
      { 
        header: 'Status', 
        accessor: row => (
          <span className={`badge ${row.saleStatus === 'COMPLETED' ? 'badge-success' : 'badge-danger'}`}>
            {row.saleStatus}
          </span>
        ),
        textAccessor: row => row.saleStatus,
        sortKey: 'saleStatus'
      }
    ],
    customers: [
      { header: 'Name', accessor: row => <span style={{ fontWeight: 600 }}>{row.name}</span>, textAccessor: row => row.name, sortKey: 'name' },
      { header: 'Phone', accessor: row => row.phone, textAccessor: row => row.phone, sortKey: 'phone' },
      { header: 'Email', accessor: row => row.email || 'N/A', textAccessor: row => row.email || 'N/A', sortKey: 'email' },
      { 
        header: 'Birthday', 
        accessor: row => row.dateOfBirth ? new Date(row.dateOfBirth).toLocaleDateString() : 'N/A',
        textAccessor: row => row.dateOfBirth ? new Date(row.dateOfBirth).toLocaleDateString() : 'N/A',
        sortKey: 'dateOfBirth'
      },
      { 
        header: 'Total Spent', 
        accessor: row => formatPrice(row.totalSpent),
        textAccessor: row => String(row.totalSpent),
        sortKey: 'totalSpent'
      },
      { 
        header: 'Visits Count', 
        accessor: row => <span className="badge badge-success">{row.visitsCount} visits</span>,
        textAccessor: row => String(row.visitsCount),
        sortKey: 'visitsCount'
      }
    ],
    visits: [
      { header: 'Customer', accessor: row => row.customerName || row.customer?.name || 'Walk-in', textAccessor: row => row.customerName || row.customer?.name || 'Walk-in', sortKey: 'customerName' },
      { header: 'Service', accessor: row => row.serviceName || row.service?.name || 'N/A', textAccessor: row => row.serviceName || row.service?.name || 'N/A', sortKey: 'serviceName' },
      { header: 'Specialist', accessor: row => row.stylistName || row.stylist?.name || 'N/A', textAccessor: row => row.stylistName || row.stylist?.name || 'N/A', sortKey: 'stylistName' },
      { 
        header: 'Date', 
        accessor: row => new Date(row.startTime).toLocaleDateString(),
        textAccessor: row => new Date(row.startTime).toLocaleDateString(),
        sortKey: 'date'
      },
      { 
        header: 'Time', 
        accessor: row => new Date(row.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        textAccessor: row => new Date(row.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sortKey: 'startTime'
      },
      { 
        header: 'Status', 
        accessor: row => (
          <span className={`badge ${row.status === 'COMPLETED' ? 'badge-success' : row.status === 'PENDING' ? 'badge-warning' : 'badge-danger'}`}>
            {row.status}
          </span>
        ),
        textAccessor: row => row.status,
        sortKey: 'status'
      }
    ],
    products: [
      { header: 'Product Name', accessor: row => <span style={{ fontWeight: 600 }}>{row.name}</span>, textAccessor: row => row.name, sortKey: 'name' },
      { header: 'SKU', accessor: row => row.sku, textAccessor: row => row.sku, sortKey: 'sku' },
      { header: 'Category', accessor: row => row.category, textAccessor: row => row.category, sortKey: 'category' },
      { 
        header: 'Stock Level', 
        accessor: row => (
          <span className={`badge ${row.stock < 10 ? 'badge-danger' : 'badge-success'}`}>
            {row.stock} Units
          </span>
        ),
        textAccessor: row => String(row.stock),
        sortKey: 'stock'
      },
      { header: 'Price', accessor: row => formatPrice(row.price), textAccessor: row => String(row.price), sortKey: 'price' },
      { header: 'Status', accessor: row => row.isActive ? 'Active' : 'Inactive', textAccessor: row => row.isActive ? 'Active' : 'Inactive', sortKey: 'isActive' }
    ],
    services: [
      { header: 'Service Name', accessor: row => <span style={{ fontWeight: 600 }}>{row.name}</span>, textAccessor: row => row.name, sortKey: 'name' },
      { header: 'Category', accessor: row => row.category, textAccessor: row => row.category, sortKey: 'category' },
      { header: 'Price', accessor: row => formatPrice(row.price), textAccessor: row => String(row.price), sortKey: 'price' },
      { header: 'Duration', accessor: row => `${row.duration} min`, textAccessor: row => `${row.duration} min`, sortKey: 'duration' },
      { header: 'Status', accessor: row => row.isActive ? 'Active' : 'Inactive', textAccessor: row => row.isActive ? 'Active' : 'Inactive', sortKey: 'isActive' }
    ],
    packages: [
      { header: 'Package Name', accessor: row => <span style={{ fontWeight: 600 }}>{row.name}</span>, textAccessor: row => row.name, sortKey: 'name' },
      { header: 'Price', accessor: row => formatPrice(row.price), textAccessor: row => String(row.price), sortKey: 'price' },
      { header: 'Items Count', accessor: row => row.items?.length || 0, textAccessor: row => String(row.items?.length || 0), sortKey: 'items' },
      { header: 'Description', accessor: row => row.description || 'N/A', textAccessor: row => row.description || 'N/A', sortKey: 'description' }
    ],
    vouchers: [
      { header: 'Voucher Code', accessor: row => <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{row.voucherCode || row.code}</span>, textAccessor: row => row.voucherCode || row.code, sortKey: 'voucherCode' },
      { 
        header: 'Discount', 
        accessor: row => row.discountType === 'PERCENT' ? `${row.discountValue}%` : formatPrice(row.discountValue),
        textAccessor: row => `${row.discountValue} ${row.discountType}`,
        sortKey: 'discountValue'
      },
      { header: 'Type', accessor: row => row.discountType, textAccessor: row => row.discountType, sortKey: 'discountType' },
      { header: 'Claim Limit', accessor: row => row.claimLimit || 'Unlimited', textAccessor: row => String(row.claimLimit || 'Unlimited'), sortKey: 'claimLimit' },
      { header: 'Active', accessor: row => row.isActive ? 'Yes' : 'No', textAccessor: row => row.isActive ? 'Yes' : 'No', sortKey: 'isActive' }
    ],
    cust_pkg_voucher: [
      { header: 'Customer Name', accessor: row => <span style={{ fontWeight: 600 }}>{row.name}</span>, textAccessor: row => row.name, sortKey: 'name' },
      { header: 'Phone', accessor: row => row.phone, textAccessor: row => row.phone, sortKey: 'phone' },
      { header: 'Packages Active', accessor: row => <span className="badge badge-success">{row.packagesCount} Purchased</span>, textAccessor: row => String(row.packagesCount), sortKey: 'packagesCount' },
      { header: 'Vouchers Claimed', accessor: row => <span className="badge badge-neutral">{row.vouchersCount} claimed</span>, textAccessor: row => String(row.vouchersCount), sortKey: 'vouchersCount' }
    ],
    cust_no_voucher: [
      { header: 'Customer Name', accessor: row => <span style={{ fontWeight: 600 }}>{row.name}</span>, textAccessor: row => row.name, sortKey: 'name' },
      { header: 'Phone', accessor: row => row.phone, textAccessor: row => row.phone, sortKey: 'phone' },
      { header: 'Email', accessor: row => row.email || 'N/A', textAccessor: row => row.email || 'N/A', sortKey: 'email' },
      { header: 'Birthday', accessor: row => row.dateOfBirth ? new Date(row.dateOfBirth).toLocaleDateString() : 'N/A', textAccessor: row => row.dateOfBirth ? new Date(row.dateOfBirth).toLocaleDateString() : 'N/A', sortKey: 'dateOfBirth' }
    ],
    cust_no_visit_last_month: [
      { header: 'Customer Name', accessor: row => <span style={{ fontWeight: 600 }}>{row.name}</span>, textAccessor: row => row.name, sortKey: 'name' },
      { header: 'Phone', accessor: row => row.phone, textAccessor: row => row.phone, sortKey: 'phone' },
      { header: 'Email', accessor: row => row.email || 'N/A', textAccessor: row => row.email || 'N/A', sortKey: 'email' },
      { 
        header: 'Last Visit Date', 
        accessor: row => row.lastVisit ? new Date(row.lastVisit).toLocaleDateString() : 'Never Visited', 
        textAccessor: row => row.lastVisit ? new Date(row.lastVisit).toLocaleDateString() : 'Never Visited', 
        sortKey: 'lastVisit' 
      }
    ],
    cust_birthday: [
      { header: 'Customer Name', accessor: row => <span style={{ fontWeight: 600 }}>{row.name}</span>, textAccessor: row => row.name, sortKey: 'name' },
      { header: 'Phone', accessor: row => row.phone, textAccessor: row => row.phone, sortKey: 'phone' },
      { header: 'Birthday', accessor: row => <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{row.dateOfBirth ? new Date(row.dateOfBirth).toLocaleDateString() : 'N/A'}</span>, textAccessor: row => row.dateOfBirth ? new Date(row.dateOfBirth).toLocaleDateString() : 'N/A', sortKey: 'dateOfBirth' },
      { header: 'Email', accessor: row => row.email || 'N/A', textAccessor: row => row.email || 'N/A', sortKey: 'email' }
    ]
  };

  const reportOptions = [
    { value: 'sales', label: 'All Sale Report', icon: FileText },
    { value: 'customers', label: 'By Customer Summary', icon: Users },
    { value: 'visits', label: 'By Visit (Appointments)', icon: Calendar },
    { value: 'products', label: 'By Product Stock', icon: ShoppingBag },
    { value: 'services', label: 'By Service Catalog', icon: Briefcase },
    { value: 'packages', label: 'By Package Plans', icon: Tag },
    { value: 'vouchers', label: 'By Vouchers List', icon: Tag },
    { value: 'cust_pkg_voucher', label: 'Customers with Package or Voucher', icon: Users },
    { value: 'cust_no_voucher', label: 'Customers without Vouchers', icon: Users },
    { value: 'cust_no_visit_last_month', label: 'No Visit Last Month ⚠️', icon: Users },
    { value: 'cust_birthday', label: 'This Month Birthdays 🎂', icon: Calendar }
  ];

  return (
    <div className="space-y-6">
      <Card title="Administrative Custom Business Reports" className="w-full">
        {/* Controls Layout */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          borderBottom: '1px solid var(--border-light)',
          paddingBottom: '1.25rem',
          marginBottom: '1rem'
        }}>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem'
          }}>
            {/* Report Type Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '280px' }}>
              <div style={{
                background: 'var(--bg-hover)',
                padding: '0.5rem',
                borderRadius: 'var(--radius-lg)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Filter size={20} />
              </div>
              <select
                value={activeReport}
                onChange={e => setActiveReport(e.target.value)}
                style={{
                  padding: '0.625rem 1rem',
                  border: '1.5px solid var(--border)',
                  borderRadius: 'var(--radius-xl)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-black)',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer',
                  flex: 1,
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'all 0.2s'
                }}
              >
                {reportOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Search and Download Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              {/* Date Filters */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <input
                  type="date"
                  placeholder="Start Date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  style={{
                    padding: '0.625rem 0.875rem',
                    border: '1.5px solid var(--border)',
                    borderRadius: 'var(--radius-xl)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-black)',
                    fontSize: '0.875rem',
                    outline: 'none',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'all 0.2s'
                  }}
                />
                <span style={{ color: 'var(--text-light)', fontSize: '0.875rem', fontWeight: 500 }}>to</span>
                <input
                  type="date"
                  placeholder="End Date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  style={{
                    padding: '0.625rem 0.875rem',
                    border: '1.5px solid var(--border)',
                    borderRadius: 'var(--radius-xl)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-black)',
                    fontSize: '0.875rem',
                    outline: 'none',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'all 0.2s'
                  }}
                />
                {(startDate || endDate) && (
                  <button
                    onClick={() => { setStartDate(''); setEndDate(''); }}
                    style={{
                      padding: '0.625rem 1rem',
                      border: '1.5px solid var(--danger)',
                      background: 'transparent',
                      color: 'var(--danger)',
                      borderRadius: 'var(--radius-xl)',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    Clear Dates
                  </button>
                )}
              </div>

              <div style={{ position: 'relative' }}>
                <Search style={{
                  position: 'absolute',
                  left: '0.875rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-light)',
                  width: 18,
                  height: 18
                }} />
                <input
                  type="text"
                  placeholder="Quick search report..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{
                    padding: '0.625rem 1rem 0.625rem 2.5rem',
                    border: '1.5px solid var(--border)',
                    borderRadius: 'var(--radius-xl)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-black)',
                    fontSize: '0.875rem',
                    outline: 'none',
                    width: '18rem',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'all 0.2s'
                  }}
                />
              </div>

              <button
                onClick={downloadExcel}
                disabled={sortedData.length === 0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: sortedData.length === 0 ? 'var(--bg-hover)' : 'var(--primary)',
                  color: sortedData.length === 0 ? 'var(--text-light)' : '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--radius-xl)',
                  padding: '0.625rem 1.25rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: sortedData.length === 0 ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(35, 76, 106, 0.15)',
                  transition: 'all 0.2s'
                }}
              >
                <Download size={18} /> Download Excel
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Table Layout */}
        <div style={{ overflowX: 'auto', width: '100%' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
              <div style={{
                border: '3px solid var(--bg-hover)',
                borderTop: '3px solid var(--primary)',
                borderRadius: '50%',
                width: '2.5rem',
                height: '2.5rem',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 1rem auto'
              }} />
              <p style={{ fontWeight: 600, color: 'var(--text-light)' }}>Assembling dynamic dataset...</p>
            </div>
          ) : sortedData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
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
                <Filter style={{ color: 'var(--text-light)' }} size={32} />
              </div>
              <p style={{ fontWeight: 600, color: 'var(--text-black)' }}>No data matched your filter</p>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-light)' }}>Try refining your search keyword or selecting a different category.</p>
            </div>
          ) : (
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-light)' }}>
                  {columnsMap[activeReport].map(col => {
                    const isSorted = sortField === col.sortKey;
                    return (
                      <th
                        key={col.header}
                        onClick={() => col.sortKey && handleSort(col.sortKey)}
                        style={{
                          padding: '1rem',
                          fontSize: '0.8125rem',
                          fontWeight: 700,
                          color: 'var(--text-light)',
                          cursor: col.sortKey ? 'pointer' : 'default',
                          userSelect: 'none',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          {col.header}
                          {col.sortKey && (
                            <span style={{ color: isSorted ? 'var(--primary)' : 'var(--text-light)', opacity: isSorted ? 1 : 0.4 }}>
                              {isSorted ? (
                                sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                              ) : (
                                <ArrowUpDown size={12} />
                              )}
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((row, index) => (
                  <tr
                    key={row.id || index}
                    style={{
                      borderBottom: '1px solid var(--border-light)',
                      background: index % 2 === 0 ? 'transparent' : 'rgba(248, 250, 252, 0.3)',
                      transition: 'all 0.2s'
                    }}
                  >
                    {columnsMap[activeReport].map(col => (
                      <td key={col.header} style={{ padding: '1rem', fontSize: '0.875rem', color: 'var(--text-dark)' }}>
                        {col.accessor(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Control Bar */}
        {!loading && sortedData.length > itemsPerPage && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: '1.25rem',
            borderTop: '1px solid var(--border-light)',
            marginTop: '1.25rem'
          }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-light)', fontWeight: 600 }}>
              Showing {Math.min((currentPage - 1) * itemsPerPage + 1, sortedData.length)}–
              {Math.min(currentPage * itemsPerPage, sortedData.length)} of {sortedData.length} records
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-light)',
                  background: currentPage === 1 ? 'var(--bg-hover)' : 'var(--bg-card)',
                  color: currentPage === 1 ? 'var(--text-light)' : 'var(--text-dark)',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  transition: 'all 0.2s'
                }}
              >
                <ChevronLeft size={16} style={{ marginRight: '2px' }} /> Previous
              </button>
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-dark)', minWidth: '4.5rem', textAlign: 'center' }}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-light)',
                  background: currentPage === totalPages ? 'var(--bg-hover)' : 'var(--bg-card)',
                  color: currentPage === totalPages ? 'var(--text-light)' : 'var(--text-dark)',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  transition: 'all 0.2s'
                }}
              >
                Next <ChevronRight size={16} style={{ marginLeft: '2px' }} />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Reports;
