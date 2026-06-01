import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '../components/UI';
import { useCurrency } from '../components/CurrencyContext';
import api from '../utils/api';
import { 
  Download, Search, ArrowUpDown, ChevronUp, ChevronDown, 
  ChevronLeft, ChevronRight, Filter, Calendar, DollarSign, 
  Users, ShoppingBag, Tag, Briefcase, FileText, X
} from 'lucide-react';

interface ColumnConfig {
  header: string;
  accessor: (row: any) => React.ReactNode;
  textAccessor?: (row: any) => string;
  sortKey?: string;
}

const getPaymentMethod = (row: any) => {
  const methods: string[] = [];

  // 1. Check direct paymentMethod property
  if (row.paymentMethod && row.paymentMethod !== 'N/A') {
    methods.push(row.paymentMethod);
  }

  // 2. Check payments array
  if (row.payments && row.payments.length > 0) {
    row.payments.forEach((p: any) => {
      if (p.paymentMethod && p.paymentMethod !== 'N/A') {
        methods.push(p.paymentMethod);
      }
    });
  }

  // 3. Fallbacks based on items and discount
  const items = Array.isArray(row.items) ? row.items : [];
  const hasPackageRedemption = items.some((item: any) => item && (item.redeemedFromPackageId || item.redeemedQuantity > 0));
  const hasVoucherRedemption = row.voucherDiscount > 0 || (row.discount > 0 && !hasPackageRedemption);

  if (hasPackageRedemption) {
    if (!methods.includes('PACKAGE')) {
      methods.push('PACKAGE');
    }
  }
  if (hasVoucherRedemption) {
    if (!methods.includes('VOUCHER')) {
      methods.push('VOUCHER');
    }
  }

  if (methods.length === 0) {
    if (row.paymentStatus === 'PENDING' && (row.paidAmount || 0) === 0) {
      return 'Pay Later';
    }
    return 'N/A';
  }

  return Array.from(new Set(methods)).join(', ');
};

const Reports: React.FC = () => {
  const { symbol, formatPrice } = useCurrency();

  const toLocalYYYYMMDD = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const checkDateInRange = (dateValue: any, startStr: string, endStr: string) => {
    if (!dateValue) return true;
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) return true;
    const localDay = toLocalYYYYMMDD(d);
    
    if (startStr && localDay < startStr) return false;
    if (endStr && localDay > endStr) return false;
    return true;
  };
  
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
  
  // Customer-specific reports states
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedCustomerDetail, setSelectedCustomerDetail] = useState<any>(null);
  const [fetchingCustomerDetail, setFetchingCustomerDetail] = useState(false);

  // Date Filter State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [datePreset, setDatePreset] = useState<string>('last_30_days');
  
  // Sorting State
  const [sortField, setSortField] = useState<string>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Details Modal State
  const [selectedDetailRow, setSelectedDetailRow] = useState<any>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  
  // Specialists and Filter States
  const [specialists, setSpecialists] = useState<any[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string>('ALL');
  const [selectedItemType, setSelectedItemType] = useState<string>('ALL');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Custom Styled Dropdown States & Ref
  const [isReportDropdownOpen, setIsReportDropdownOpen] = useState(false);
  const [reportSearchQuery, setReportSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Customer dropdown states & ref
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  // Staff dropdown states & ref
  const [isStaffDropdownOpen, setIsStaffDropdownOpen] = useState(false);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const staffDropdownRef = useRef<HTMLDivElement>(null);

  // Item type dropdown states & ref
  const [isItemTypeDropdownOpen, setIsItemTypeDropdownOpen] = useState(false);
  const itemTypeDropdownRef = useRef<HTMLDivElement>(null);

  const reportOptions = useMemo(() => [
    {
      category: "📊 Standard Business Catalogs",
      items: [
        { value: "sales", label: "All Sale Report", description: "Complete overview of all transactions and payments" },
        { value: "all_sold_items", label: "All Sold Items Details", description: "Granular breakdown of every service, product, package, and voucher sold" },
        { value: "service_consumption_by_payment", label: "Services Consumption by Method", description: "Granular list of services consumed via package redemptions, vouchers, cash, card, or dynamic payments" },
        { value: "customers", label: "By Customer Summary", description: "Total spending and visits per customer" },
        { value: "visits", label: "By Visit (Appointments)", description: "Appointment schedules, stylists, and dates" },
        { value: "products", label: "By Product Stock", description: "Inventory counts, categories, and retail price" },
        { value: "services", label: "By Service Catalog", description: "Offered services, durations, and pricing" },
        { value: "packages", label: "By Package Plans", description: "Active bundled package plans and details" },
        { value: "vouchers", label: "By Vouchers List", description: "Campaign codes, discounts, and validation status" },
      ]
    },
    {
      category: "📈 One Month History Trends",
      items: [
        { value: "one_month_sales", label: "One Month Sales History", description: "Historical sales transactions over past 30 days" },
        { value: "pkg_sales_history", label: "One Month Package Sales History", description: "Purchased package combos list" },
        { value: "pkg_qty_history", label: "One Month Package History (Qty Sold)", description: "Quantities and revenue per package type" },
        { value: "staff_sales_summary", label: "One Month Staff Sales Summary", description: "Overall performance and revenue per staff member" },
        { value: "staff_pkg_sales", label: "One Month Staff Package Sales History", description: "Packages sold by each staff member" },
        { value: "staff_pkg_used", label: "One Month Staff Package Used History", description: "Package redemptions served by staff" },
        { value: "staff_sales_details", label: "One Month Staff Sales Details", description: "Granular service-by-service sales per staff member" },
        { value: "top_selling_items", label: "Top Selling Service / Product", description: "Most popular salon items ranked by quantity" },
      ]
    },
    {
      category: "👤 Customer Packages & Usage",
      items: [
        { value: "cust_pkg_details", label: "Customer Package Details", description: "Active customer packages with breakdown" },
        { value: "cust_topup_history", label: "Customer Top up Package History", description: "Recharges and top-ups made by clients" },
        { value: "cust_pkg_usage_summary", label: "Customer Package Usage Summary", description: "Usage quantities and remaining balances" },
        { value: "cust_pkg_usage_details", label: "Customer Package Usage Details", description: "Individual service redemptions timeline" },
      ]
    },
    {
      category: "⚠️ Promotional & Activity Alerts",
      items: [
        { value: "cust_pkg_voucher", label: "Customers with Package or Voucher", description: "Clients holding active packages or vouchers" },
        { value: "cust_no_voucher", label: "Customers without Vouchers", description: "Clients who haven't claimed any vouchers" },
        { value: "cust_no_visit_last_month", label: "No Visit Last Month ⚠️", description: "Lapsed clients to target for re-engagement" },
        { value: "cust_birthday", label: "This Month Birthdays 🎂", description: "Clients celebrating their birthdays this month" },
      ]
    }
  ], []);

  // Click outside listener to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsReportDropdownOpen(false);
      }
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setIsCustomerDropdownOpen(false);
      }
      if (staffDropdownRef.current && !staffDropdownRef.current.contains(event.target as Node)) {
        setIsStaffDropdownOpen(false);
      }
      if (itemTypeDropdownRef.current && !itemTypeDropdownRef.current.contains(event.target as Node)) {
        setIsItemTypeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
        packagesRes,
        specialistsRes
      ] = await Promise.all([
        api.get('/appointments').catch(() => ({ data: [] })),
        api.get('/services').catch(() => ({ data: [] })),
        api.get('/sales').catch(() => ({ data: [] })),
        api.get('/customers').catch(() => ({ data: [] })),
        api.get('/vouchers').catch(() => ({ data: [] })),
        api.get('/vouchers/claims').catch(() => ({ data: [] })),
        api.get('/inventory').catch(() => ({ data: [] })),
        api.get('/packages').catch(() => ({ data: [] })),
        api.get('/stylists').catch(() => ({ data: [] }))
      ]);

      setAppointments(Array.isArray(appointmentsRes.data) ? appointmentsRes.data : []);
      setServices(Array.isArray(servicesRes.data) ? servicesRes.data : []);
      setSales(Array.isArray(salesRes.data) ? salesRes.data : (salesRes.data?.sales || []));
      setCustomers(Array.isArray(customersRes.data) ? customersRes.data : []);
      setVouchers(Array.isArray(vouchersRes.data) ? vouchersRes.data : []);
      setClaims(Array.isArray(claimsRes.data) ? claimsRes.data : []);
      setProducts(Array.isArray(inventoryRes.data) ? inventoryRes.data : []);
      setPackages(Array.isArray(packagesRes.data) ? packagesRes.data : (packagesRes.data?.packages || []));
      setSpecialists(Array.isArray(specialistsRes.data) ? specialistsRes.data : []);
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching reports data:', error);
      setLoading(false);
    }
  };

  // Prepopulate 30 days date range when switching reports
  useEffect(() => {
    if (!activeReport.startsWith('cust_')) {
      setSelectedCustomerId('');
      setSelectedCustomerDetail(null);
    }

    if (
      activeReport.startsWith('one_month_') || 
      activeReport.startsWith('pkg_') || 
      activeReport.startsWith('staff_') || 
      activeReport === 'top_selling_items'
    ) {
      handlePresetChange('last_30_days');
    } else {
      setStartDate('');
      setEndDate('');
      setDatePreset('custom');
    }
  }, [activeReport]);

  // Fetch selected customer package/usage details
  useEffect(() => {
    if (selectedCustomerId) {
      const fetchCustomerDetail = async () => {
        try {
          setFetchingCustomerDetail(true);
          const res = await api.get(`/customers/${selectedCustomerId}`);
          setSelectedCustomerDetail(res.data);
          setFetchingCustomerDetail(false);
        } catch (error) {
          console.error('Error fetching customer details:', error);
          setFetchingCustomerDetail(false);
        }
      };
      fetchCustomerDetail();
    } else {
      setSelectedCustomerDetail(null);
    }
  }, [selectedCustomerId]);

  const handlePresetChange = (preset: string) => {
    setDatePreset(preset);
    if (preset === 'custom') return;
    
    const end = new Date();
    const start = new Date();
    
    switch (preset) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        setStartDate(toLocalYYYYMMDD(start));
        setEndDate(toLocalYYYYMMDD(end));
        break;
      case 'yesterday':
        start.setDate(end.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        end.setDate(end.getDate() - 1);
        end.setHours(23, 59, 59, 999);
        setStartDate(toLocalYYYYMMDD(start));
        setEndDate(toLocalYYYYMMDD(end));
        break;
      case 'this_month':
        const startOfMonth = new Date(end.getFullYear(), end.getMonth(), 1);
        setStartDate(toLocalYYYYMMDD(startOfMonth));
        setEndDate(toLocalYYYYMMDD(end));
        break;
      case 'last_month':
        const startOfLast = new Date(end.getFullYear(), end.getMonth() - 1, 1);
        const endOfLast = new Date(end.getFullYear(), end.getMonth(), 0);
        setStartDate(toLocalYYYYMMDD(startOfLast));
        setEndDate(toLocalYYYYMMDD(endOfLast));
        break;
      case 'last_30_days':
      default:
        start.setDate(end.getDate() - 30);
        setStartDate(toLocalYYYYMMDD(start));
        setEndDate(toLocalYYYYMMDD(end));
        break;
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
    const getFilteredSales = () => {
      return sales.filter((sale: any) => {
        if (!checkDateInRange(sale.createdAt, startDate, endDate)) return false;

        // Staff (Specialist) filter
        if (selectedStaff !== 'ALL') {
          const items = Array.isArray(sale.items) ? sale.items : [];
          const mainMatch = String(sale.specialistId) === String(selectedStaff) || 
                            String(sale.stylistId) === String(selectedStaff) ||
                            (sale.specialist && String(sale.specialist.id) === String(selectedStaff)) ||
                            (sale.stylist && String(sale.stylist.id) === String(selectedStaff));
          const itemsMatch = items.some((item: any) => 
            String(item.specialistId) === String(selectedStaff) || 
            String(item.stylistId) === String(selectedStaff) ||
            (item.specialist && String(item.specialist.id) === String(selectedStaff))
          );
          if (!mainMatch && !itemsMatch) return false;
        }

        // Item Type filter (SERVICE, PRODUCT, PACKAGE, VOUCHER)
        if (selectedItemType !== 'ALL') {
          const items = Array.isArray(sale.items) ? sale.items : [];
          const paymentMethod = getPaymentMethod(sale).toUpperCase();
          
          if (selectedItemType === 'SERVICE') {
            const hasService = items.some((item: any) => {
              if (!item) return false;
              const t = String(item.type || '').toUpperCase();
              return t === 'SERVICE';
            });
            if (!hasService) return false;
          } else if (selectedItemType === 'PRODUCT') {
            const hasProduct = items.some((item: any) => {
              if (!item) return false;
              const t = String(item.type || '').toUpperCase();
              return t === 'PRODUCT';
            });
            if (!hasProduct) return false;
          } else if (selectedItemType === 'PACKAGE') {
            const hasPackage = items.some((item: any) => {
              if (!item) return false;
              const t = String(item.type || '').toUpperCase();
              return t === 'COMBO' || t === 'PACKAGE' || item.redeemedFromPackageId || item.packageName;
            }) || paymentMethod.includes('PACKAGE');
            if (!hasPackage) return false;
          } else if (selectedItemType === 'VOUCHER') {
            const hasVoucher = sale.voucherDiscount > 0 || sale.voucherCode || items.some((item: any) => {
              if (!item) return false;
              const t = String(item.type || '').toUpperCase();
              return t === 'VOUCHER';
            }) || paymentMethod.includes('VOUCHER');
            if (!hasVoucher) return false;
          }
        }

        return true;
      });
    };

    const getFilteredAppointments = () => {
      return appointments.filter((apt: any) => {
        if (!checkDateInRange(apt.startTime, startDate, endDate)) return false;

        // Staff filter
        if (selectedStaff !== 'ALL') {
          if (String(apt.stylistId) !== String(selectedStaff)) return false;
        }

        return true;
      });
    };

    const fSales = getFilteredSales();
    const fAppointments = getFilteredAppointments();

    switch (activeReport) {
      case 'sales': // All Sale Report
        return fSales;

      case 'all_sold_items': {
        const soldItems: any[] = [];
        sales.forEach((sale: any) => {
          if (sale.saleStatus !== 'COMPLETED') return;
          if (!checkDateInRange(sale.createdAt, startDate, endDate)) return;

          const items = Array.isArray(sale.items) ? sale.items : [];
          
          items.forEach((item: any) => {
            const itemType = String(item.type || '').toUpperCase();
            
            let typeLabel = 'Service';
            let filterType = 'SERVICE';
            if (itemType === 'SERVICE') {
              typeLabel = 'Service';
              filterType = 'SERVICE';
            } else if (itemType === 'PRODUCT') {
              typeLabel = 'Product';
              filterType = 'PRODUCT';
            } else if (itemType === 'COMBO' || itemType === 'PACKAGE' || item.redeemedFromPackageId || item.packageName) {
              typeLabel = 'Package';
              filterType = 'PACKAGE';
            } else if (itemType === 'VOUCHER') {
              typeLabel = 'Voucher';
              filterType = 'VOUCHER';
            }

            const staffId = item.specialistId || item.stylistId || sale.specialistId || sale.stylistId || '';
            const staffName = item.specialistName || 
                              (item.specialist && item.specialist.name) || 
                              sale.specialist?.name || 
                              sale.stylist?.name || 
                              (staffId ? 'Staff ID: ' + staffId : 'Unassigned');

            if (selectedStaff !== 'ALL' && String(staffId) !== String(selectedStaff) && (!item.specialist || String(item.specialist.id) !== String(selectedStaff))) {
              return;
            }

            if (selectedItemType !== 'ALL' && filterType !== selectedItemType) {
              return;
            }

            soldItems.push({
              id: `${sale.id}-${item.itemId || item.name}-${itemType}`,
              invoiceId: sale.saleNumber || sale.id.substring(0, 8),
              date: sale.createdAt,
              createdAt: sale.createdAt,
              customerName: sale.customerName || sale.customer?.name || 'Walk-in',
              itemName: item.name,
              type: typeLabel,
              staffName,
              price: item.price,
              quantity: item.quantity,
              totalPrice: (item.price * item.quantity) - (item.discount || 0)
            });
          });

          if (sale.voucherCode || sale.voucherDiscount > 0) {
            const staffId = sale.specialistId || sale.stylistId || '';
            const staffName = sale.specialist?.name || sale.stylist?.name || (staffId ? 'Staff ID: ' + staffId : 'Unassigned');

            const matchesStaff = selectedStaff === 'ALL' || String(staffId) === String(selectedStaff);
            const matchesType = selectedItemType === 'ALL' || selectedItemType === 'VOUCHER';

            if (matchesStaff && matchesType) {
              soldItems.push({
                id: `${sale.id}-voucher-discount`,
                invoiceId: sale.saleNumber || sale.id.substring(0, 8),
                date: sale.createdAt,
                createdAt: sale.createdAt,
                customerName: sale.customerName || sale.customer?.name || 'Walk-in',
                itemName: sale.voucherCode ? `Voucher: ${sale.voucherCode}` : 'Voucher Redemption',
                type: 'Voucher',
                staffName,
                price: sale.voucherDiscount || sale.discount || 0,
                quantity: 1,
                totalPrice: sale.voucherDiscount || sale.discount || 0
              });
            }
          }
        });
        return soldItems;
      }

      case 'service_consumption_by_payment': {
        const consumptionItems: any[] = [];
        sales.forEach((sale: any) => {
          if (sale.saleStatus !== 'COMPLETED') return;
          if (!checkDateInRange(sale.createdAt, startDate, endDate)) return;

          const items = Array.isArray(sale.items) ? sale.items : [];
          
          items.forEach((item: any) => {
            const itemType = String(item.type || '').toUpperCase();
            if (itemType !== 'SERVICE') return;

            const staffId = item.specialistId || item.stylistId || sale.specialistId || sale.stylistId || '';
            const staffName = item.specialistName || 
                              (item.specialist && item.specialist.name) || 
                              sale.specialist?.name || 
                              sale.stylist?.name || 
                              (staffId ? 'Staff ID: ' + staffId : 'Unassigned');

            if (selectedStaff !== 'ALL' && String(staffId) !== String(selectedStaff) && (!item.specialist || String(item.specialist.id) !== String(selectedStaff))) {
              return;
            }

            // Determine method of payment/consumption:
            let method = 'Cash';
            const directMethod = String(sale.paymentMethod || '').toUpperCase();

            if (item.redeemedFromPackageId || item.redeemedQuantity > 0) {
              method = 'Package Redemption';
            } else if (sale.voucherCode || sale.voucherDiscount > 0 || directMethod.includes('VOUCHER')) {
              method = 'Voucher';
            } else if (directMethod === 'CASH') {
              method = 'Cash';
            } else if (directMethod && directMethod !== 'N/A') {
              method = directMethod.charAt(0) + directMethod.slice(1).toLowerCase();
            } else if (sale.payments && sale.payments.length > 0) {
              const paymentMethodsList = sale.payments
                .map((p: any) => String(p.paymentMethod || '').trim().toUpperCase())
                .filter((m: string) => m && m !== 'N/A');
              
              if (paymentMethodsList.includes('CASH')) {
                method = 'Cash';
              } else if (paymentMethodsList.length > 0) {
                const uniqMethods = Array.from(new Set(paymentMethodsList));
                method = uniqMethods.map((m: string) => m.charAt(0) + m.slice(1).toLowerCase()).join(', ');
              } else {
                method = 'Dynamic/Other';
              }
            } else {
              method = 'Dynamic/Other';
            }

            consumptionItems.push({
              id: `${sale.id}-${item.itemId || item.name}-consumption`,
              invoiceId: sale.saleNumber || sale.id.substring(0, 8),
              date: sale.createdAt,
              createdAt: sale.createdAt,
              customerName: sale.customerName || sale.customer?.name || 'Walk-in',
              serviceName: item.name,
              qty: item.quantity,
              price: item.price,
              totalPrice: (item.price * item.quantity) - (item.discount || 0),
              method,
              staffName
            });
          });
        });
        return consumptionItems;
      }

      case 'customers': // By Customer
        return customers.map(c => ({
          ...c,
          totalSpent: c.totalSpend !== undefined ? c.totalSpend : (customerStats[c.id]?.spent || 0),
          visitsCount: c.visitCount !== undefined ? c.visitCount : (customerStats[c.id]?.visits || 0)
        }));

      case 'visits': // By Visit
        return fAppointments;

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
              const parts = c.dateOfBirth.split(/[-/]/);
              if (parts.length === 3) {
                if (parts[0].length === 4) { // YYYY-MM-DD
                  return (parseInt(parts[1], 10) - 1) === currentMonth;
                }
                if (parts[2].length === 4) { // MM-DD-YYYY or DD-MM-YYYY
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

      // --- GROUP 1: ONE MONTH BUSINESS TRENDS ---
      case 'one_month_sales':
        return fSales;

      case 'pkg_sales_history': {
        const pkgSales: any[] = [];
        fSales.forEach((sale: any) => {
          if (sale.saleStatus !== 'COMPLETED') return;
          const items = Array.isArray(sale.items) ? sale.items : [];
          items.forEach((item: any) => {
            if (item.type === 'combo') {
              pkgSales.push({
                id: `${sale.id}-${item.itemId}`,
                saleNumber: sale.saleNumber,
                customerName: sale.customerName || sale.customer?.name || 'Walk-in',
                createdAt: sale.createdAt,
                packageName: item.name,
                price: item.price,
                quantity: item.quantity,
                totalAmount: item.price * item.quantity,
                paymentMethod: getPaymentMethod(sale)
              });
            }
          });
        });
        return pkgSales;
      }

      case 'pkg_qty_history': {
        const pkgSummaryMap: Record<string, { name: string; price: number; quantity: number; revenue: number }> = {};
        fSales.forEach((sale: any) => {
          if (sale.saleStatus !== 'COMPLETED') return;
          const items = Array.isArray(sale.items) ? sale.items : [];
          items.forEach((item: any) => {
            if (item.type === 'combo') {
              const key = item.name;
              if (!pkgSummaryMap[key]) {
                pkgSummaryMap[key] = {
                  name: item.name,
                  price: item.price,
                  quantity: 0,
                  revenue: 0
                };
              }
              pkgSummaryMap[key].quantity += item.quantity;
              pkgSummaryMap[key].revenue += (item.price * item.quantity);
            }
          });
        });
        return Object.values(pkgSummaryMap);
      }

      case 'staff_sales_summary': {
        const staffMap: Record<string, { name: string; servicesRevenue: number; productsRevenue: number; packagesRevenue: number; totalRevenue: number; salesCount: number }> = {};
        fSales.forEach((sale: any) => {
          if (sale.saleStatus !== 'COMPLETED') return;
          const items = Array.isArray(sale.items) ? sale.items : [];
          
          items.forEach((item: any) => {
            const staffName = item.specialistName || sale.specialist?.name || (sale.specialistId ? 'Staff ID: ' + sale.specialistId : 'Unassigned');
            if (!staffMap[staffName]) {
              staffMap[staffName] = {
                name: staffName,
                servicesRevenue: 0,
                productsRevenue: 0,
                packagesRevenue: 0,
                totalRevenue: 0,
                salesCount: 0
              };
            }
            
            const itemRevenue = (item.price * item.quantity) - (item.discount || 0);
            if (item.type === 'service') {
              staffMap[staffName].servicesRevenue += itemRevenue;
            } else if (item.type === 'product') {
              staffMap[staffName].productsRevenue += itemRevenue;
            } else if (item.type === 'combo') {
              staffMap[staffName].packagesRevenue += itemRevenue;
            }
            staffMap[staffName].totalRevenue += itemRevenue;
          });

          const mainStaff = sale.specialist?.name || (sale.specialistId ? 'Staff ID: ' + sale.specialistId : 'Unassigned');
          if (staffMap[mainStaff]) {
            staffMap[mainStaff].salesCount += 1;
          }
        });
        return Object.values(staffMap);
      }

      case 'staff_pkg_sales': {
        const staffPkgSales: any[] = [];
        fSales.forEach((sale: any) => {
          if (sale.saleStatus !== 'COMPLETED') return;
          const items = Array.isArray(sale.items) ? sale.items : [];
          items.forEach((item: any) => {
            if (item.type === 'combo') {
              const staffName = item.specialistName || sale.specialist?.name || (sale.specialistId ? 'Staff ID: ' + sale.specialistId : 'Unassigned');
              staffPkgSales.push({
                id: `${sale.id}-${item.itemId}`,
                date: sale.createdAt,
                createdAt: sale.createdAt,
                staffName,
                customerName: sale.customerName || sale.customer?.name || 'Walk-in',
                packageName: item.name,
                purchasePrice: item.price,
                invoiceId: sale.saleNumber || sale.id.substring(0, 8)
              });
            }
          });
        });
        return staffPkgSales;
      }

      case 'staff_pkg_used': {
        const staffPkgRedemptions: any[] = [];
        fSales.forEach((sale: any) => {
          if (sale.saleStatus !== 'COMPLETED') return;
          const items = Array.isArray(sale.items) ? sale.items : [];
          items.forEach((item: any) => {
            const isRedeemed = item.redeemedFromPackageId || item.redeemedQuantity > 0 || (item.price === 0 && item.type === 'service' && sale.totalAmount < sale.subtotal);
            if (isRedeemed) {
              const staffName = item.specialistName || sale.specialist?.name || (sale.specialistId ? 'Staff ID: ' + sale.specialistId : 'Unassigned');
              staffPkgRedemptions.push({
                id: `${sale.id}-${item.itemId}`,
                date: sale.createdAt,
                createdAt: sale.createdAt,
                staffName,
                customerName: sale.customerName || sale.customer?.name || 'Walk-in',
                serviceName: item.name,
                quantity: item.redeemedQuantity || item.quantity || 1,
                invoiceId: sale.saleNumber || sale.id.substring(0, 8)
              });
            }
          });
        });
        return staffPkgRedemptions;
      }

      case 'staff_sales_details': {
        const staffDetails: any[] = [];
        fSales.forEach((sale: any) => {
          if (sale.saleStatus !== 'COMPLETED') return;
          const items = Array.isArray(sale.items) ? sale.items : [];
          items.forEach((item: any) => {
            const staffName = item.specialistName || sale.specialist?.name || (sale.specialistId ? 'Staff ID: ' + sale.specialistId : 'Unassigned');
            staffDetails.push({
              id: `${sale.id}-${item.itemId}-${item.name}`,
              date: sale.createdAt,
              createdAt: sale.createdAt,
              staffName,
              customerName: sale.customerName || sale.customer?.name || 'Walk-in',
              itemName: item.name,
              type: item.type === 'service' ? 'Service' : item.type === 'product' ? 'Product' : item.type === 'combo' ? 'Package' : 'Other',
              price: item.price,
              quantity: item.quantity,
              totalPrice: (item.price * item.quantity) - (item.discount || 0)
            });
          });
        });
        return staffDetails;
      }

      case 'top_selling_items': {
        const popularityMap: Record<string, { name: string; type: string; quantity: number; revenue: number }> = {};
        fSales.forEach((sale: any) => {
          if (sale.saleStatus !== 'COMPLETED') return;
          const items = Array.isArray(sale.items) ? sale.items : [];
          items.forEach((item: any) => {
            if (item.type === 'service' || item.type === 'product') {
              const key = `${item.type}-${item.name}`;
              if (!popularityMap[key]) {
                popularityMap[key] = {
                  name: item.name,
                  type: item.type === 'service' ? 'Service' : 'Product',
                  quantity: 0,
                  revenue: 0
                };
              }
              popularityMap[key].quantity += item.quantity;
              popularityMap[key].revenue += ((item.price * item.quantity) - (item.discount || 0));
            }
          });
        });
        const ranked = Object.values(popularityMap).sort((a, b) => b.quantity - a.quantity);
        return ranked.map((item, idx) => ({
          ...item,
          id: `rank-${idx}-${item.name}`,
          rank: idx + 1
        }));
      }

      // --- GROUP 2: CUSTOMER PACKAGES & USAGE ---
      case 'cust_pkg_details':
        return selectedCustomerDetail?.combos || [];

      case 'cust_topup_history':
        return selectedCustomerDetail?.packages || [];

      case 'cust_pkg_usage_summary': {
        if (!selectedCustomerDetail) return [];
        const combos = selectedCustomerDetail.combos || [];
        const consolidatedMap: Record<string, { serviceName: string; total: number; used: number; remaining: number }> = {};
        
        combos.forEach((c: any) => {
          const usageDetails = Array.isArray(c.usageDetails) ? c.usageDetails : [];
          usageDetails.forEach((item: any) => {
            const name = item.name || item.serviceName || 'Service';
            if (!consolidatedMap[name]) {
              consolidatedMap[name] = {
                serviceName: name,
                total: 0,
                used: 0,
                remaining: 0
              };
            }
            consolidatedMap[name].total += (item.totalQuantity || item.quantity || 1);
            consolidatedMap[name].used += (item.usedQuantity || 0);
            consolidatedMap[name].remaining += (item.remainingQuantity !== undefined ? item.remainingQuantity : (item.totalQuantity - item.usedQuantity));
          });
        });
        return Object.values(consolidatedMap);
      }

      case 'cust_pkg_usage_details': {
        if (!selectedCustomerDetail) return [];
        const usageLogs: any[] = [];
        const customerSales = selectedCustomerDetail.sales || [];
        
        customerSales.forEach((sale: any) => {
          if (sale.saleStatus !== 'COMPLETED') return;
          const items = Array.isArray(sale.items) ? sale.items : [];
          items.forEach((item: any) => {
            if (item.redeemedFromPackageId || item.redeemedQuantity > 0 || (item.price === 0 && item.type === 'service')) {
              usageLogs.push({
                id: `${sale.id}-${item.itemId}`,
                date: sale.createdAt,
                createdAt: sale.createdAt,
                serviceName: item.name,
                packageName: 'Package Redemption',
                quantity: item.redeemedQuantity || item.quantity || 1,
                cashier: sale.cashierName || sale.createdBy || 'Staff'
              });
            }
          });
        });
        return usageLogs;
      }

      default:
        return [];
    }
  }, [activeReport, sales, customers, appointments, products, services, packages, vouchers, claims, customerStats, selectedCustomerDetail, startDate, endDate, selectedStaff, selectedItemType]);

  // Filter & Search Logic
  const filteredData = useMemo(() => {
    let data = reportData;

    const skipDateFilter = [
      'one_month_sales',
      'all_sold_items',
      'service_consumption_by_payment',
      'pkg_sales_history',
      'pkg_qty_history',
      'staff_sales_summary',
      'staff_pkg_sales',
      'staff_pkg_used',
      'staff_sales_details',
      'top_selling_items',
      'cust_pkg_details',
      'cust_topup_history',
      'cust_pkg_usage_summary',
      'cust_pkg_usage_details'
    ].includes(activeReport);

    if (!skipDateFilter) {
      if (startDate || endDate) {
        data = data.filter((row: any) => {
          const dateValue = row.createdAt || row.startTime || row.dateOfBirth;
          return checkDateInRange(dateValue, startDate, endDate);
        });
      }
    }

    if (!searchTerm.trim()) return data;
    const lowerSearch = searchTerm.toLowerCase();

    return data.filter((row: any) => {
      if (activeReport === 'service_consumption_by_payment') {
        return (
          String(row.invoiceId || '').toLowerCase().includes(lowerSearch) ||
          String(row.customerName || '').toLowerCase().includes(lowerSearch) ||
          String(row.serviceName || '').toLowerCase().includes(lowerSearch) ||
          String(row.method || '').toLowerCase().includes(lowerSearch) ||
          String(row.staffName || '').toLowerCase().includes(lowerSearch)
        );
      }
      if (activeReport === 'all_sold_items') {
        return (
          String(row.invoiceId || '').toLowerCase().includes(lowerSearch) ||
          String(row.customerName || '').toLowerCase().includes(lowerSearch) ||
          String(row.itemName || '').toLowerCase().includes(lowerSearch) ||
          String(row.type || '').toLowerCase().includes(lowerSearch) ||
          String(row.staffName || '').toLowerCase().includes(lowerSearch)
        );
      }
      if (activeReport === 'sales' || activeReport === 'one_month_sales' || activeReport === 'pkg_sales_history') {
        return (
          String(row.invoiceId || row.saleNumber || '').toLowerCase().includes(lowerSearch) ||
          String(row.customerName || '').toLowerCase().includes(lowerSearch) ||
          String(row.packageName || '').toLowerCase().includes(lowerSearch) ||
          String(row.paymentMethod || '').toLowerCase().includes(lowerSearch)
        );
      }
      if (activeReport === 'customers' || activeReport.startsWith('cust_')) {
        return (
          String(row.name || row.packageName || row.serviceName || '').toLowerCase().includes(lowerSearch) ||
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
      if (activeReport === 'packages' || activeReport === 'pkg_qty_history' || activeReport === 'top_selling_items') {
        return String(row.name || '').toLowerCase().includes(lowerSearch);
      }
      if (activeReport === 'staff_sales_summary') {
        return String(row.name || '').toLowerCase().includes(lowerSearch);
      }
      if (activeReport === 'staff_pkg_sales' || activeReport === 'staff_pkg_used' || activeReport === 'staff_sales_details') {
        return (
          String(row.staffName || '').toLowerCase().includes(lowerSearch) ||
          String(row.customerName || '').toLowerCase().includes(lowerSearch) ||
          String(row.packageName || row.serviceName || row.itemName || '').toLowerCase().includes(lowerSearch)
        );
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

      if (sortField === 'date') {
        aVal = new Date(a.createdAt || a.startTime || a.date || 0).getTime();
        bVal = new Date(b.createdAt || b.startTime || b.date || 0).getTime();
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
  }, [activeReport, searchTerm, startDate, endDate, selectedStaff, selectedItemType]);

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
  const handleRowClick = (row: any) => {
    setSelectedDetailRow(row);
    setDetailModalOpen(true);
  };

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
        } else {
          // Fallback to accessing row directly
          const key = c.sortKey || '';
          const res = row[key];
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
        accessor: row => row.customerName || row.customer?.name || 'Walk-in',
        textAccessor: row => row.customerName || row.customer?.name || 'Walk-in',
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
        accessor: row => <span className="badge badge-neutral">{getPaymentMethod(row)}</span>,
        textAccessor: row => getPaymentMethod(row),
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
    all_sold_items: [
      { 
        header: 'Invoice ID', 
        accessor: row => <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{row.invoiceId}</span>,
        textAccessor: row => row.invoiceId,
        sortKey: 'invoiceId'
      },
      { 
        header: 'Date', 
        accessor: row => new Date(row.createdAt).toLocaleDateString(),
        textAccessor: row => new Date(row.createdAt).toLocaleDateString(),
        sortKey: 'date'
      },
      { 
        header: 'Customer', 
        accessor: row => row.customerName, 
        textAccessor: row => row.customerName, 
        sortKey: 'customerName' 
      },
      { 
        header: 'Item Name', 
        accessor: row => <span style={{ fontWeight: 600 }}>{row.itemName}</span>, 
        textAccessor: row => row.itemName, 
        sortKey: 'itemName' 
      },
      { 
        header: 'Item Type', 
        accessor: row => {
          const type = String(row.type || '').toUpperCase();
          let bg = 'rgba(14, 165, 233, 0.1)';
          let text = 'rgb(3, 105, 161)';
          if (type === 'PRODUCT') {
            bg = 'rgba(34, 197, 94, 0.1)';
            text = 'rgb(21, 128, 61)';
          } else if (type === 'PACKAGE') {
            bg = 'rgba(234, 179, 8, 0.1)';
            text = 'rgb(161, 98, 7)';
          } else if (type === 'VOUCHER') {
            bg = 'rgba(239, 68, 68, 0.1)';
            text = 'rgb(185, 28, 28)';
          }
          return (
            <span style={{ 
              fontSize: '0.75rem', 
              fontWeight: 700, 
              padding: '0.2rem 0.5rem', 
              borderRadius: 'var(--radius-md)', 
              backgroundColor: bg, 
              color: text,
              textTransform: 'uppercase',
              letterSpacing: '0.025em'
            }}>
              {row.type}
            </span>
          );
        }, 
        textAccessor: row => row.type, 
        sortKey: 'type' 
      },
      { 
        header: 'Staff Name', 
        accessor: row => row.staffName, 
        textAccessor: row => row.staffName, 
        sortKey: 'staffName' 
      },
      { 
        header: 'Unit Price', 
        accessor: row => formatPrice(row.price), 
        textAccessor: row => String(row.price), 
        sortKey: 'price' 
      },
      { 
        header: 'Qty', 
        accessor: row => row.quantity, 
        textAccessor: row => String(row.quantity), 
        sortKey: 'quantity' 
      },
      { 
        header: 'Total Price', 
        accessor: row => <span style={{ fontWeight: 700 }}>{formatPrice(row.totalPrice)}</span>, 
        textAccessor: row => String(row.totalPrice), 
        sortKey: 'totalPrice' 
      }
    ],
    service_consumption_by_payment: [
      { 
        header: 'Invoice ID', 
        accessor: row => <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{row.invoiceId}</span>,
        textAccessor: row => row.invoiceId,
        sortKey: 'invoiceId'
      },
      { 
        header: 'Date', 
        accessor: row => new Date(row.createdAt).toLocaleDateString(),
        textAccessor: row => new Date(row.createdAt).toLocaleDateString(),
        sortKey: 'date'
      },
      { 
        header: 'Customer', 
        accessor: row => row.customerName, 
        textAccessor: row => row.customerName, 
        sortKey: 'customerName' 
      },
      { 
        header: 'Service Name', 
        accessor: row => <span style={{ fontWeight: 600 }}>{row.serviceName}</span>, 
        textAccessor: row => row.serviceName, 
        sortKey: 'serviceName' 
      },
      { 
        header: 'Consumption Method', 
        accessor: row => {
          const method = String(row.method || '').toUpperCase();
          let bg = 'rgba(100, 116, 139, 0.1)';
          let text = 'rgb(71, 85, 105)';
          if (method === 'PACKAGE REDEMPTION') {
            bg = 'rgba(234, 179, 8, 0.1)';
            text = 'rgb(161, 98, 7)';
          } else if (method === 'VOUCHER') {
            bg = 'rgba(239, 68, 68, 0.1)';
            text = 'rgb(185, 28, 28)';
          } else if (method === 'CASH') {
            bg = 'rgba(34, 197, 94, 0.1)';
            text = 'rgb(21, 128, 61)';
          } else if (method === 'CARD') {
            bg = 'rgba(14, 165, 233, 0.1)';
            text = 'rgb(3, 105, 161)';
          } else if (method === 'UPI') {
            bg = 'rgba(139, 92, 246, 0.1)';
            text = 'rgb(109, 40, 217)';
          }
          return (
            <span style={{ 
              fontSize: '0.75rem', 
              fontWeight: 700, 
              padding: '0.2rem 0.5rem', 
              borderRadius: 'var(--radius-md)', 
              backgroundColor: bg, 
              color: text,
              textTransform: 'uppercase',
              letterSpacing: '0.025em'
            }}>
              {row.method}
            </span>
          );
        }, 
        textAccessor: row => row.method, 
        sortKey: 'method' 
      },
      { 
        header: 'Performed By (Staff)', 
        accessor: row => row.staffName, 
        textAccessor: row => row.staffName, 
        sortKey: 'staffName' 
      },
      { 
        header: 'Price', 
        accessor: row => formatPrice(row.price), 
        textAccessor: row => String(row.price), 
        sortKey: 'price' 
      },
      { 
        header: 'Qty', 
        accessor: row => row.qty, 
        textAccessor: row => String(row.qty), 
        sortKey: 'qty' 
      },
      { 
        header: 'Total Value', 
        accessor: row => <span style={{ fontWeight: 700 }}>{formatPrice(row.totalPrice)}</span>, 
        textAccessor: row => String(row.totalPrice), 
        sortKey: 'totalPrice' 
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
    ],
    
    // --- GROUP 1: ONE MONTH HISTORY TRENDS ---
    one_month_sales: [
      { 
        header: 'Invoice ID', 
        accessor: row => <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{row.saleNumber || row.id.substring(0, 8)}</span>,
        textAccessor: row => row.saleNumber || row.id,
        sortKey: 'saleNumber'
      },
      { header: 'Customer', accessor: row => row.customerName || row.customer?.name || 'Walk-in', textAccessor: row => row.customerName || row.customer?.name || 'Walk-in', sortKey: 'customerName' },
      { header: 'Date', accessor: row => new Date(row.createdAt).toLocaleDateString(), textAccessor: row => new Date(row.createdAt).toLocaleDateString(), sortKey: 'date' },
      { header: 'Items Purchased', accessor: row => row.items?.map((i: any) => `${i.name} (x${i.quantity})`).join(', ') || 'N/A', textAccessor: row => row.items?.map((i: any) => `${i.name} (x${i.quantity})`).join(', '), sortKey: 'items' },
      { header: 'Subtotal', accessor: row => formatPrice(row.subtotal), textAccessor: row => String(row.subtotal), sortKey: 'subtotal' },
      { header: 'Discount', accessor: row => formatPrice(row.discount), textAccessor: row => String(row.discount), sortKey: 'discount' },
      { header: 'Tax', accessor: row => formatPrice(row.tax), textAccessor: row => String(row.tax), sortKey: 'tax' },
      { header: 'Total Paid', accessor: row => formatPrice(row.paidAmount), textAccessor: row => String(row.paidAmount), sortKey: 'paidAmount' },
      { header: 'Payment Method', accessor: row => <span className="badge badge-neutral">{getPaymentMethod(row)}</span>, textAccessor: row => getPaymentMethod(row), sortKey: 'paymentMethod' }
    ],
    pkg_sales_history: [
      { header: 'Invoice ID', accessor: row => <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{row.saleNumber}</span>, textAccessor: row => row.saleNumber, sortKey: 'saleNumber' },
      { header: 'Customer', accessor: row => row.customerName || row.customer?.name || 'Walk-in', textAccessor: row => row.customerName || row.customer?.name || 'Walk-in', sortKey: 'customerName' },
      { header: 'Purchase Date', accessor: row => new Date(row.createdAt).toLocaleDateString(), textAccessor: row => new Date(row.createdAt).toLocaleDateString(), sortKey: 'date' },
      { header: 'Package Name', accessor: row => <span style={{ fontWeight: 600 }}>{row.packageName}</span>, textAccessor: row => row.packageName, sortKey: 'packageName' },
      { header: 'Price', accessor: row => formatPrice(row.price), textAccessor: row => String(row.price), sortKey: 'price' },
      { header: 'Qty', accessor: row => row.quantity, textAccessor: row => String(row.quantity), sortKey: 'quantity' },
      { header: 'Total Amount', accessor: row => formatPrice(row.totalAmount), textAccessor: row => String(row.totalAmount), sortKey: 'totalAmount' },
      { header: 'Payment Method', accessor: row => <span className="badge badge-neutral">{getPaymentMethod(row)}</span>, textAccessor: row => getPaymentMethod(row), sortKey: 'paymentMethod' }
    ],
    pkg_qty_history: [
      { header: 'Package Name', accessor: row => <span style={{ fontWeight: 600 }}>{row.name}</span>, textAccessor: row => row.name, sortKey: 'name' },
      { header: 'Unit Price', accessor: row => formatPrice(row.price), textAccessor: row => String(row.price), sortKey: 'price' },
      { header: 'Total Quantity Sold', accessor: row => <span className="badge badge-success">{row.quantity} sold</span>, textAccessor: row => String(row.quantity), sortKey: 'quantity' },
      { header: 'Total Revenue', accessor: row => <span style={{ fontWeight: 700, color: 'var(--success)' }}>{formatPrice(row.revenue)}</span>, textAccessor: row => String(row.revenue), sortKey: 'revenue' }
    ],
    staff_sales_summary: [
      { header: 'Staff Name', accessor: row => <span style={{ fontWeight: 600 }}>{row.name}</span>, textAccessor: row => row.name, sortKey: 'name' },
      { header: 'Services Revenue', accessor: row => formatPrice(row.servicesRevenue), textAccessor: row => String(row.servicesRevenue), sortKey: 'servicesRevenue' },
      { header: 'Products Revenue', accessor: row => formatPrice(row.productsRevenue), textAccessor: row => String(row.productsRevenue), sortKey: 'productsRevenue' },
      { header: 'Packages Revenue', accessor: row => formatPrice(row.packagesRevenue), textAccessor: row => String(row.packagesRevenue), sortKey: 'packagesRevenue' },
      { header: 'Total Revenue Generated', accessor: row => <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{formatPrice(row.totalRevenue)}</span>, textAccessor: row => String(row.totalRevenue), sortKey: 'totalRevenue' },
      { header: 'Transactions Count', accessor: row => <span className="badge badge-neutral">{row.salesCount} tx</span>, textAccessor: row => String(row.salesCount), sortKey: 'salesCount' }
    ],
    staff_pkg_sales: [
      { header: 'Date', accessor: row => new Date(row.date).toLocaleDateString(), textAccessor: row => new Date(row.date).toLocaleDateString(), sortKey: 'date' },
      { header: 'Staff Name', accessor: row => <span style={{ fontWeight: 600 }}>{row.staffName}</span>, textAccessor: row => row.staffName, sortKey: 'staffName' },
      { header: 'Customer', accessor: row => row.customerName, textAccessor: row => row.customerName, sortKey: 'customerName' },
      { header: 'Package Sold', accessor: row => row.packageName, textAccessor: row => row.packageName, sortKey: 'packageName' },
      { header: 'Purchase Price', accessor: row => formatPrice(row.purchasePrice), textAccessor: row => String(row.purchasePrice), sortKey: 'purchasePrice' },
      { header: 'Invoice ID', accessor: row => <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{row.invoiceId}</span>, textAccessor: row => row.invoiceId, sortKey: 'invoiceId' }
    ],
    staff_pkg_used: [
      { header: 'Date of Usage', accessor: row => new Date(row.date).toLocaleDateString(), textAccessor: row => new Date(row.date).toLocaleDateString(), sortKey: 'date' },
      { header: 'Staff Name', accessor: row => <span style={{ fontWeight: 600 }}>{row.staffName}</span>, textAccessor: row => row.staffName, sortKey: 'staffName' },
      { header: 'Customer', accessor: row => row.customerName, textAccessor: row => row.customerName, sortKey: 'customerName' },
      { header: 'Service Redeemed', accessor: row => row.serviceName, textAccessor: row => row.serviceName, sortKey: 'serviceName' },
      { header: 'Qty Used', accessor: row => row.quantity, textAccessor: row => String(row.quantity), sortKey: 'quantity' },
      { header: 'Invoice Reference', accessor: row => <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{row.invoiceId}</span>, textAccessor: row => row.invoiceId, sortKey: 'invoiceId' }
    ],
    staff_sales_details: [
      { header: 'Date', accessor: row => new Date(row.date).toLocaleDateString(), textAccessor: row => new Date(row.date).toLocaleDateString(), sortKey: 'date' },
      { header: 'Staff Name', accessor: row => <span style={{ fontWeight: 600 }}>{row.staffName}</span>, textAccessor: row => row.staffName, sortKey: 'staffName' },
      { header: 'Customer', accessor: row => row.customerName, textAccessor: row => row.customerName, sortKey: 'customerName' },
      { header: 'Item Name', accessor: row => row.itemName, textAccessor: row => row.itemName, sortKey: 'itemName' },
      { header: 'Type', accessor: row => <span className="badge badge-neutral">{row.type}</span>, textAccessor: row => row.type, sortKey: 'type' },
      { header: 'Unit Price', accessor: row => formatPrice(row.price), textAccessor: row => String(row.price), sortKey: 'price' },
      { header: 'Quantity', accessor: row => row.quantity, textAccessor: row => String(row.quantity), sortKey: 'quantity' },
      { header: 'Total Price', accessor: row => <span style={{ fontWeight: 700 }}>{formatPrice(row.totalPrice)}</span>, textAccessor: row => String(row.totalPrice), sortKey: 'totalPrice' }
    ],
    top_selling_items: [
      { header: 'Popularity Rank', accessor: row => <span style={{ fontWeight: 800, color: row.rank === 1 ? 'gold' : row.rank === 2 ? 'silver' : row.rank === 3 ? '#cd7f32' : 'var(--text-light)' }}>#{row.rank}</span>, textAccessor: row => String(row.rank), sortKey: 'rank' },
      { header: 'Item Name', accessor: row => <span style={{ fontWeight: 600 }}>{row.name}</span>, textAccessor: row => row.name, sortKey: 'name' },
      { header: 'Type', accessor: row => <span className={`badge ${row.type === 'Service' ? 'badge-success' : 'badge-warning'}`}>{row.type}</span>, textAccessor: row => row.type, sortKey: 'type' },
      { header: 'Units Sold', accessor: row => <span className="badge badge-neutral">{row.quantity} units</span>, textAccessor: row => String(row.quantity), sortKey: 'quantity' },
      { header: 'Total Revenue Generated', accessor: row => <span style={{ fontWeight: 700, color: 'var(--success)' }}>{formatPrice(row.revenue)}</span>, textAccessor: row => String(row.revenue), sortKey: 'revenue' }
    ],

    // --- GROUP 2: CUSTOMER PACKAGES & USAGE ---
    cust_pkg_details: [
      { header: 'Package Name', accessor: row => <span style={{ fontWeight: 600 }}>{row.package?.name || row.comboPack?.name || 'Combo Pack'}</span>, textAccessor: row => row.package?.name || row.comboPack?.name || 'Combo Pack', sortKey: 'packageName' },
      { header: 'Purchase Date', accessor: row => new Date(row.purchaseDate || row.createdAt).toLocaleDateString(), textAccessor: row => new Date(row.purchaseDate || row.createdAt).toLocaleDateString(), sortKey: 'purchaseDate' },
      { header: 'Expiry Date', accessor: row => row.expiryDate ? new Date(row.expiryDate).toLocaleDateString() : 'No Expiry', textAccessor: row => row.expiryDate ? new Date(row.expiryDate).toLocaleDateString() : 'No Expiry', sortKey: 'expiryDate' },
      { header: 'Price Paid', accessor: row => formatPrice(row.purchasePrice), textAccessor: row => String(row.purchasePrice), sortKey: 'purchasePrice' },
      { header: 'Total Quantity', accessor: row => row.totalQuantity || row.totalVisits || 0, textAccessor: row => String(row.totalQuantity || row.totalVisits || 0), sortKey: 'totalQuantity' },
      { header: 'Used Qty', accessor: row => <span className="badge badge-danger">{row.usedQuantity || row.usedVisits || 0}</span>, textAccessor: row => String(row.usedQuantity || row.usedVisits || 0), sortKey: 'usedQuantity' },
      { header: 'Remaining Qty', accessor: row => <span className="badge badge-success">{row.remainingQuantity || 0}</span>, textAccessor: row => String(row.remainingQuantity || 0), sortKey: 'remainingQuantity' },
      { header: 'Status', accessor: row => <span className={`badge ${row.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}`}>{row.status}</span>, textAccessor: row => row.status, sortKey: 'status' }
    ],
    cust_topup_history: [
      { header: 'Date of Top-up', accessor: row => new Date(row.purchaseDate || row.createdAt).toLocaleDateString(), textAccessor: row => new Date(row.purchaseDate || row.createdAt).toLocaleDateString(), sortKey: 'purchaseDate' },
      { header: 'Package Name', accessor: row => <span style={{ fontWeight: 600 }}>{row.package?.name || 'Combo Pack'}</span>, textAccessor: row => row.package?.name || 'Combo Pack', sortKey: 'packageName' },
      { header: 'Top-up Amount', accessor: row => formatPrice(row.purchasePrice), textAccessor: row => String(row.purchasePrice), sortKey: 'purchasePrice' },
      { header: 'Added Quantity', accessor: row => row.totalQuantity, textAccessor: row => String(row.totalQuantity), sortKey: 'totalQuantity' },
      { header: 'Expiry Date', accessor: row => row.expiryDate ? new Date(row.expiryDate).toLocaleDateString() : 'No Expiry', textAccessor: row => row.expiryDate ? new Date(row.expiryDate).toLocaleDateString() : 'No Expiry', sortKey: 'expiryDate' }
    ],
    cust_pkg_usage_summary: [
      { header: 'Service Name', accessor: row => <span style={{ fontWeight: 600 }}>{row.serviceName}</span>, textAccessor: row => row.serviceName, sortKey: 'serviceName' },
      { header: 'Total Quantity Purchased', accessor: row => row.total, textAccessor: row => String(row.total), sortKey: 'total' },
      { header: 'Total Quantity Used', accessor: row => <span className="badge badge-danger">{row.used} used</span>, textAccessor: row => String(row.used), sortKey: 'used' },
      { header: 'Total Quantity Remaining', accessor: row => <span className="badge badge-success">{row.remaining} left</span>, textAccessor: row => String(row.remaining), sortKey: 'remaining' }
    ],
    cust_pkg_usage_details: [
      { header: 'Date of Usage', accessor: row => new Date(row.date).toLocaleDateString(), textAccessor: row => new Date(row.date).toLocaleDateString(), sortKey: 'date' },
      { header: 'Service Used', accessor: row => <span style={{ fontWeight: 600 }}>{row.serviceName}</span>, textAccessor: row => row.serviceName, sortKey: 'serviceName' },
      { header: 'Package Source', accessor: row => row.packageName, textAccessor: row => row.packageName, sortKey: 'packageName' },
      { header: 'Quantity Redeemed', accessor: row => <span className="badge badge-success">{row.quantity} redemption</span>, textAccessor: row => String(row.quantity), sortKey: 'quantity' },
      { header: 'Processed By', accessor: row => row.cashier, textAccessor: row => row.cashier, sortKey: 'cashier' }
    ]
  };

  const kpis = useMemo(() => {
    if (activeReport === 'service_consumption_by_payment') {
      const totalVal = sortedData.reduce((sum, r) => sum + (r.totalPrice || 0), 0);
      const totalQty = sortedData.reduce((sum, r) => sum + (r.qty || 0), 0);
      
      const countsByMethod: Record<string, number> = {};
      sortedData.forEach(r => {
        const method = r.method || 'Cash';
        countsByMethod[method] = (countsByMethod[method] || 0) + (r.qty || 0);
      });

      const pkgCount = countsByMethod['Package Redemption'] || 0;
      const voucherCount = countsByMethod['Voucher'] || 0;
      const cashCount = countsByMethod['Cash'] || 0;
      const otherCount = Object.keys(countsByMethod)
        .filter(m => m !== 'Package Redemption' && m !== 'Voucher' && m !== 'Cash')
        .reduce((sum, m) => sum + countsByMethod[m], 0);

      return [
        { label: 'Total Services Consumed', value: `${totalQty} services`, color: 'var(--primary)' },
        { label: 'Total Consumption Value', value: formatPrice(totalVal), color: 'var(--success)' },
        { label: 'Redeemed by Package / Voucher', value: `${pkgCount} pkg / ${voucherCount} vchr`, color: 'var(--warning)' },
        { label: 'Paid by Cash / Other', value: `${cashCount} cash / ${otherCount} other`, color: 'var(--danger)' }
      ];
    }
    if (activeReport === 'all_sold_items') {
      const total = sortedData.reduce((sum, r) => sum + (r.totalPrice || 0), 0);
      const count = sortedData.reduce((sum, r) => sum + (r.quantity || 0), 0);
      return [
        { label: 'Total Sold Revenue', value: formatPrice(total), color: 'var(--success)' },
        { label: 'Total Items Sold', value: `${count} units`, color: 'var(--primary)' }
      ];
    }
    if (activeReport === 'one_month_sales') {
      const total = sortedData.reduce((sum, r) => sum + (r.paidAmount || r.totalAmount || 0), 0);
      const count = sortedData.length;
      const avg = count > 0 ? total / count : 0;
      return [
        { label: 'Total Sales Revenue', value: formatPrice(total), color: 'var(--success)' },
        { label: 'Total Invoices Count', value: String(count), color: 'var(--primary)' },
        { label: 'Average Invoice Value', value: formatPrice(avg), color: 'var(--warning)' }
      ];
    }
    if (activeReport === 'pkg_sales_history' || activeReport === 'pkg_qty_history') {
      const revenue = sortedData.reduce((sum, r) => sum + (r.totalAmount || r.revenue || 0), 0);
      const count = sortedData.reduce((sum, r) => sum + (r.quantity || 0), 0);
      return [
        { label: 'Total Package Revenue', value: formatPrice(revenue), color: 'var(--success)' },
        { label: 'Total Packages Sold', value: `${count} units`, color: 'var(--primary)' }
      ];
    }
    if (activeReport === 'staff_sales_summary') {
      const total = sortedData.reduce((sum, r) => sum + (r.totalRevenue || 0), 0);
      let topStaff = 'N/A';
      let maxRev = -1;
      sortedData.forEach(r => {
        if (r.totalRevenue > maxRev) {
          maxRev = r.totalRevenue;
          topStaff = r.name;
        }
      });
      return [
        { label: 'Total Staff Revenue', value: formatPrice(total), color: 'var(--success)' },
        { label: 'Top Staff Performer', value: topStaff, color: 'var(--primary)' }
      ];
    }
    if (activeReport === 'top_selling_items') {
      let topService = 'N/A';
      let topProduct = 'N/A';
      let maxServ = -1;
      let maxProd = -1;
      sortedData.forEach(r => {
        if (r.type === 'Service' && r.quantity > maxServ) {
          maxServ = r.quantity;
          topService = r.name;
        }
        if (r.type === 'Product' && r.quantity > maxProd) {
          maxProd = r.quantity;
          topProduct = r.name;
        }
      });
      return [
        { label: 'Top Selling Service', value: topService, color: 'var(--success)' },
        { label: 'Top Selling Product', value: topProduct, color: 'var(--primary)' }
      ];
    }
    if (activeReport.startsWith('cust_') && selectedCustomerDetail) {
      const combos = selectedCustomerDetail.combos || [];
      const totalPkgs = combos.length;
      const totalRemaining = combos.reduce((sum: number, c: any) => sum + (c.remainingQuantity || 0), 0);
      const totalUsed = combos.reduce((sum: number, c: any) => sum + (c.usedQuantity || c.usedVisits || 0), 0);
      return [
        { label: 'Packages Purchased', value: String(totalPkgs), color: 'var(--primary)' },
        { label: 'Services Used', value: String(totalUsed), color: 'var(--danger)' },
        { label: 'Remaining Services', value: String(totalRemaining), color: 'var(--success)' }
      ];
    }
    return [];
  }, [activeReport, sortedData, selectedCustomerDetail, formatPrice]);

  return (
    <div className="space-y-6">
      {/* Dynamic Metric Cards */}
      {kpis.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1.25rem',
          marginBottom: '0.25rem'
        }}>
          {kpis.map((kpi, idx) => (
            <div key={idx} style={{
              background: 'var(--bg-card)',
              border: '1.5px solid var(--border)',
              borderRadius: 'var(--radius-xl)',
              padding: '1.25rem',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem'
            }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {kpi.label}
              </span>
              <span style={{ fontSize: '1.75rem', fontWeight: 800, color: kpi.color }}>
                {kpi.value}
              </span>
            </div>
          ))}
        </div>
      )}

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
            <div 
              ref={dropdownRef}
              style={{ 
                position: 'relative', 
                display: 'flex', 
                flexDirection: 'column', 
                flex: 1, 
                minWidth: '280px',
                zIndex: 50
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
                <div style={{
                  background: 'var(--bg-hover)',
                  padding: '0.5rem',
                  borderRadius: 'var(--radius-lg)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '38px',
                  height: '38px'
                }}>
                  <Filter size={20} />
                </div>
                
                {/* Trigger Button */}
                <button
                  onClick={() => setIsReportDropdownOpen(prev => !prev)}
                  type="button"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '0.625rem 1rem',
                    border: '1.5px solid var(--border)',
                    borderRadius: 'var(--radius-xl)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-black)',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    outline: 'none',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'all 0.2s',
                    textAlign: 'left',
                    gap: '0.5rem'
                  }}
                >
                  <span style={{ flex: 1 }}>
                    {(() => {
                      const allItems = reportOptions.flatMap(cat => cat.items);
                      const current = allItems.find(item => item.value === activeReport);
                      return current ? current.label : "Select Report";
                    })()}
                  </span>
                  <ChevronDown 
                    size={18} 
                    style={{ 
                      color: 'var(--text-light)', 
                      transform: isReportDropdownOpen ? 'rotate(180deg)' : 'none', 
                      transition: 'transform 0.2s' 
                    }} 
                  />
                </button>
              </div>

              {/* Dropdown Popover */}
              <AnimatePresence>
                {isReportDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.15 }}
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 0.5rem)',
                      left: 0,
                      right: 0,
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-2xl)',
                      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.12)',
                      padding: '0.75rem',
                      maxHeight: '420px',
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem'
                    }}
                  >
                    {/* Search Bar */}
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                      <Search 
                        size={16} 
                        style={{ 
                          position: 'absolute', 
                          left: '0.75rem', 
                          color: 'var(--text-light)' 
                        }} 
                      />
                      <input
                        type="text"
                        placeholder="Search reports..."
                        value={reportSearchQuery}
                        onChange={e => setReportSearchQuery(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.5rem 1rem 0.5rem 2.25rem',
                          border: '1.5px solid var(--border)',
                          borderRadius: 'var(--radius-lg)',
                          fontSize: '0.875rem',
                          outline: 'none',
                          background: 'var(--bg-hover)',
                          color: 'var(--text-black)'
                        }}
                      />
                      {reportSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setReportSearchQuery('')}
                          style={{
                            position: 'absolute',
                            right: '0.75rem',
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            color: 'var(--text-light)'
                          }}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    {/* Report List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {reportOptions.map((cat, catIdx) => {
                        // Filter items inside category
                        const filteredItems = cat.items.filter(item => 
                          item.label.toLowerCase().includes(reportSearchQuery.toLowerCase()) ||
                          item.description.toLowerCase().includes(reportSearchQuery.toLowerCase())
                        );

                        if (filteredItems.length === 0) return null;

                        return (
                          <div key={catIdx} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <div style={{ 
                              fontSize: '0.75rem', 
                              fontWeight: 700, 
                              color: 'var(--text-light)', 
                              padding: '0.25rem 0.5rem', 
                              letterSpacing: '0.05em',
                              textTransform: 'uppercase'
                            }}>
                              {cat.category}
                            </div>
                            
                            {filteredItems.map((item, itemIdx) => {
                              const isActive = activeReport === item.value;
                              return (
                                <button
                                  key={itemIdx}
                                  type="button"
                                  onClick={() => {
                                    setActiveReport(item.value);
                                    setIsReportDropdownOpen(false);
                                    setReportSearchQuery('');
                                  }}
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'flex-start',
                                    textAlign: 'left',
                                    width: '100%',
                                    padding: '0.625rem 0.75rem',
                                    borderRadius: 'var(--radius-xl)',
                                    background: isActive ? 'var(--primary-light)' : 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                    gap: '0.125rem'
                                  }}
                                  onMouseEnter={e => {
                                    if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)';
                                  }}
                                  onMouseLeave={e => {
                                    if (!isActive) e.currentTarget.style.background = 'transparent';
                                  }}
                                >
                                  <span style={{ 
                                    fontSize: '0.9rem', 
                                    fontWeight: 600, 
                                    color: isActive ? 'var(--primary)' : 'var(--text-black)' 
                                  }}>
                                    {item.label}
                                  </span>
                                  <span style={{ 
                                    fontSize: '0.75rem', 
                                    color: isActive ? 'var(--primary-dark)' : 'var(--text-light)',
                                    opacity: 0.85
                                  }}>
                                    {item.description}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Customer Search Selector for Customer Reports */}
            {activeReport.startsWith('cust_') && 
             activeReport !== 'cust_pkg_voucher' && 
             activeReport !== 'cust_no_voucher' && 
             activeReport !== 'cust_no_visit_last_month' && 
             activeReport !== 'cust_birthday' && (
              <div 
                ref={customerDropdownRef}
                style={{ 
                  position: 'relative', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  flex: 1, 
                  minWidth: '280px',
                  zIndex: 49
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
                  <div style={{
                    background: 'var(--bg-hover)',
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-lg)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '38px',
                    height: '38px'
                  }}>
                    <Users size={20} />
                  </div>
                  
                  {/* Trigger Button */}
                  <button
                    onClick={() => setIsCustomerDropdownOpen(prev => !prev)}
                    type="button"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '0.625rem 1rem',
                      border: '1.5px solid var(--border)',
                      borderRadius: 'var(--radius-xl)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-black)',
                      fontSize: '0.95rem',
                      fontWeight: 600,
                      outline: 'none',
                      cursor: 'pointer',
                      boxShadow: 'var(--shadow-sm)',
                      transition: 'all 0.2s',
                      textAlign: 'left',
                      gap: '0.5rem'
                    }}
                  >
                    <span style={{ flex: 1 }}>
                      {(() => {
                        const current = customers.find(c => String(c.id) === String(selectedCustomerId));
                        return current ? `${current.name} (${current.phone || 'No Phone'})` : "-- Select Customer --";
                      })()}
                    </span>
                    <ChevronDown 
                      size={18} 
                      style={{ 
                        color: 'var(--text-light)', 
                        transform: isCustomerDropdownOpen ? 'rotate(180deg)' : 'none', 
                        transition: 'transform 0.2s' 
                      }} 
                    />
                  </button>
                </div>

                {/* Dropdown Popover */}
                <AnimatePresence>
                  {isCustomerDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.15 }}
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 0.5rem)',
                        left: 0,
                        right: 0,
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-2xl)',
                        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.12)',
                        padding: '0.75rem',
                        maxHeight: '350px',
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                        zIndex: 100
                      }}
                    >
                      {/* Search Bar */}
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                        <Search 
                          size={16} 
                          style={{ 
                            position: 'absolute', 
                            left: '0.75rem', 
                            color: 'var(--text-light)' 
                          }} 
                        />
                        <input
                          type="text"
                          placeholder="Search customers..."
                          value={customerSearchQuery}
                          onChange={e => setCustomerSearchQuery(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.5rem 1rem 0.5rem 2.25rem',
                            border: '1.5px solid var(--border)',
                            borderRadius: 'var(--radius-lg)',
                            fontSize: '0.875rem',
                            outline: 'none',
                            background: 'var(--bg-hover)',
                            color: 'var(--text-black)'
                          }}
                        />
                        {customerSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setCustomerSearchQuery('')}
                            style={{
                              position: 'absolute',
                              right: '0.75rem',
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              color: 'var(--text-light)'
                            }}
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>

                      {/* Customer List */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCustomerId('');
                            setIsCustomerDropdownOpen(false);
                            setCustomerSearchQuery('');
                          }}
                          style={{
                            width: '100%',
                            padding: '0.625rem 0.75rem',
                            borderRadius: 'var(--radius-xl)',
                            background: !selectedCustomerId ? 'var(--primary-light)' : 'transparent',
                            border: 'none',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            color: !selectedCustomerId ? 'var(--primary)' : 'var(--text-black)',
                            transition: 'all 0.15s'
                          }}
                          onMouseEnter={e => {
                            if (selectedCustomerId) e.currentTarget.style.background = 'var(--bg-hover)';
                          }}
                          onMouseLeave={e => {
                            if (selectedCustomerId) e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          -- Select Customer --
                        </button>

                        {customers
                          .filter(c => 
                            c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
                            (c.phone || '').includes(customerSearchQuery)
                          )
                          .map((c, idx) => {
                            const isActive = String(c.id) === String(selectedCustomerId);
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  setSelectedCustomerId(String(c.id));
                                  setIsCustomerDropdownOpen(false);
                                  setCustomerSearchQuery('');
                                }}
                                style={{
                                  width: '100%',
                                  padding: '0.625rem 0.75rem',
                                  borderRadius: 'var(--radius-xl)',
                                  background: isActive ? 'var(--primary-light)' : 'transparent',
                                  border: 'none',
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  fontSize: '0.9rem',
                                  fontWeight: 600,
                                  color: isActive ? 'var(--primary)' : 'var(--text-black)',
                                  transition: 'all 0.15s'
                                }}
                                onMouseEnter={e => {
                                  if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)';
                                }}
                                onMouseLeave={e => {
                                  if (!isActive) e.currentTarget.style.background = 'transparent';
                                }}
                              >
                                {c.name} ({c.phone || 'No Phone'})
                              </button>
                            );
                          })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Search and Download Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              {/* Date Filters */}
              {!activeReport.startsWith('cust_') && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {/* Date Preset Dropdown */}
                  <select
                    value={datePreset}
                    onChange={e => handlePresetChange(e.target.value)}
                    style={{
                      padding: '0.625rem 1rem',
                      border: '1.5px solid var(--border)',
                      borderRadius: 'var(--radius-xl)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-black)',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      outline: 'none',
                      cursor: 'pointer',
                      boxShadow: 'var(--shadow-sm)',
                      transition: 'all 0.2s'
                    }}
                  >
                    <option value="last_30_days">Last 30 Days</option>
                    <option value="this_month">This Month</option>
                    <option value="last_month">Last Month</option>
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="custom">Custom Range</option>
                  </select>

                  {/* Staff Select Filter */}
                  <div 
                    ref={staffDropdownRef}
                    style={{ position: 'relative', display: 'flex', flexDirection: 'column', zIndex: 48 }}
                  >
                    <button
                      onClick={() => setIsStaffDropdownOpen(prev => !prev)}
                      type="button"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.625rem 1rem',
                        border: '1.5px solid var(--border)',
                        borderRadius: 'var(--radius-xl)',
                        background: 'var(--bg-card)',
                        color: 'var(--text-black)',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        outline: 'none',
                        cursor: 'pointer',
                        boxShadow: 'var(--shadow-sm)',
                        transition: 'all 0.2s',
                        gap: '0.5rem',
                        minWidth: '150px'
                      }}
                    >
                      <span>
                        {selectedStaff === 'ALL' 
                          ? "All Staff" 
                          : (specialists.find(s => String(s.id) === String(selectedStaff))?.name || "All Staff")
                        }
                      </span>
                      <ChevronDown 
                        size={16} 
                        style={{ 
                          color: 'var(--text-light)', 
                          transform: isStaffDropdownOpen ? 'rotate(180deg)' : 'none', 
                          transition: 'transform 0.2s' 
                        }} 
                      />
                    </button>

                    <AnimatePresence>
                      {isStaffDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          transition={{ duration: 0.15 }}
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 0.5rem)',
                            left: 0,
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-xl)',
                            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
                            padding: '0.5rem',
                            minWidth: '200px',
                            maxHeight: '280px',
                            overflowY: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.25rem',
                            zIndex: 100
                          }}
                        >
                          {/* Search bar inside Staff dropdown */}
                          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }} onClick={e => e.stopPropagation()}>
                            <Search size={14} style={{ position: 'absolute', left: '0.5rem', color: 'var(--text-light)' }} />
                            <input
                              type="text"
                              placeholder="Search staff..."
                              value={staffSearchQuery}
                              onChange={e => setStaffSearchQuery(e.target.value)}
                              style={{
                                width: '100%',
                                padding: '0.375rem 0.5rem 0.375rem 1.75rem',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '0.75rem',
                                outline: 'none',
                                background: 'var(--bg-hover)',
                                color: 'var(--text-black)'
                              }}
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStaff('ALL');
                              setIsStaffDropdownOpen(false);
                              setStaffSearchQuery('');
                            }}
                            style={{
                              width: '100%',
                              padding: '0.5rem 0.75rem',
                              borderRadius: 'var(--radius-lg)',
                              background: selectedStaff === 'ALL' ? 'var(--primary-light)' : 'transparent',
                              border: 'none',
                              textAlign: 'left',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              color: selectedStaff === 'ALL' ? 'var(--primary)' : 'var(--text-black)',
                              transition: 'all 0.15s'
                            }}
                          >
                            All Staff
                          </button>

                          {specialists
                            .filter((s: any) => s.name.toLowerCase().includes(staffSearchQuery.toLowerCase()))
                            .map((s: any, idx: number) => {
                              const isActive = String(s.id) === String(selectedStaff);
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => {
                                    setSelectedStaff(String(s.id));
                                    setIsStaffDropdownOpen(false);
                                    setStaffSearchQuery('');
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '0.5rem 0.75rem',
                                    borderRadius: 'var(--radius-lg)',
                                    background: isActive ? 'var(--primary-light)' : 'transparent',
                                    border: 'none',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    color: isActive ? 'var(--primary)' : 'var(--text-black)',
                                    transition: 'all 0.15s'
                                  }}
                                  onMouseEnter={e => {
                                    if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)';
                                  }}
                                  onMouseLeave={e => {
                                    if (!isActive) e.currentTarget.style.background = 'transparent';
                                  }}
                                >
                                  {s.name}
                                </button>
                              );
                            })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                        {/* Item Type Select Filter */}
                  {activeReport === 'all_sold_items' && (
                    <div 
                      ref={itemTypeDropdownRef}
                      style={{ position: 'relative', display: 'flex', flexDirection: 'column', zIndex: 47 }}
                    >
                      <button
                        onClick={() => setIsItemTypeDropdownOpen(prev => !prev)}
                        type="button"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.625rem 1rem',
                          border: '1.5px solid var(--border)',
                          borderRadius: 'var(--radius-xl)',
                          background: 'var(--bg-card)',
                          color: 'var(--text-black)',
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          outline: 'none',
                          cursor: 'pointer',
                          boxShadow: 'var(--shadow-sm)',
                          transition: 'all 0.2s',
                          gap: '0.5rem',
                          minWidth: '150px'
                        }}
                      >
                        <span>
                          {(() => {
                            switch (selectedItemType) {
                              case 'ALL': return 'All Item Types';
                              case 'SERVICE': return 'Services';
                              case 'PRODUCT': return 'Products';
                              case 'PACKAGE': return 'Packages';
                              case 'VOUCHER': return 'Vouchers';
                              default: return 'All Item Types';
                            }
                          })()}
                        </span>
                        <ChevronDown 
                          size={16} 
                          style={{ 
                            color: 'var(--text-light)', 
                            transform: isItemTypeDropdownOpen ? 'rotate(180deg)' : 'none', 
                            transition: 'transform 0.2s' 
                          }} 
                        />
                      </button>

                      <AnimatePresence>
                        {isItemTypeDropdownOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            transition={{ duration: 0.15 }}
                            style={{
                              position: 'absolute',
                              top: 'calc(100% + 0.5rem)',
                              left: 0,
                              background: 'var(--bg-card)',
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-xl)',
                              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
                              padding: '0.5rem',
                              minWidth: '180px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.25rem',
                              zIndex: 100
                            }}
                          >
                            {[
                              { value: 'ALL', label: 'All Item Types' },
                              { value: 'SERVICE', label: 'Services' },
                              { value: 'PRODUCT', label: 'Products' },
                              { value: 'PACKAGE', label: 'Packages' },
                              { value: 'VOUCHER', label: 'Vouchers' }
                            ].map((item, idx) => {
                              const isActive = selectedItemType === item.value;
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => {
                                    setSelectedItemType(item.value);
                                    setIsItemTypeDropdownOpen(false);
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '0.5rem 0.75rem',
                                    borderRadius: 'var(--radius-lg)',
                                    background: isActive ? 'var(--primary-light)' : 'transparent',
                                    border: 'none',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    color: isActive ? 'var(--primary)' : 'var(--text-black)',
                                    transition: 'all 0.15s'
                                  }}
                                  onMouseEnter={e => {
                                    if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)';
                                  }}
                                  onMouseLeave={e => {
                                    if (!isActive) e.currentTarget.style.background = 'transparent';
                                  }}
                                >
                                  {item.label}
                                </button>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}              </div>

                  <input
                    type="date"
                    placeholder="Start Date"
                    value={startDate}
                    onChange={e => {
                      setStartDate(e.target.value);
                      setDatePreset('custom');
                    }}
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
                    onChange={e => {
                      setEndDate(e.target.value);
                      setDatePreset('custom');
                    }}
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
                      onClick={() => { setStartDate(''); setEndDate(''); setDatePreset('custom'); }}
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
              )}

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
          ) : activeReport.startsWith('cust_') && 
             activeReport !== 'cust_pkg_voucher' && 
             activeReport !== 'cust_no_voucher' && 
             activeReport !== 'cust_no_visit_last_month' && 
             activeReport !== 'cust_birthday' && 
             !selectedCustomerId ? (
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
                <Users style={{ color: 'var(--primary)' }} size={32} />
              </div>
              <p style={{ fontWeight: 600, color: 'var(--text-black)', fontSize: '1.1rem' }}>Please select a customer to view reports</p>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-light)', marginTop: '0.25rem' }}>
                Use the customer selector dropdown above to search and load customer specific details.
              </p>
            </div>
          ) : fetchingCustomerDetail ? (
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
              <p style={{ fontWeight: 600, color: 'var(--text-light)' }}>Fetching customer package history...</p>
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
                    onClick={() => handleRowClick(row)}
                    style={{
                      borderBottom: '1px solid var(--border-light)',
                      background: index % 2 === 0 ? 'transparent' : 'rgba(248, 250, 252, 0.3)',
                      transition: 'all 0.2s',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = index % 2 === 0 ? 'transparent' : 'rgba(248, 250, 252, 0.3)'}
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

      {/* Detail View Modal */}
      {detailModalOpen && selectedDetailRow && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 'var(--radius-2xl)',
            width: '100%',
            maxWidth: '32rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border-light)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'linear-gradient(135deg, var(--bg-hover) 0%, #ffffff 100%)'
            }}>
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-black)', margin: 0 }}>
                  Report Row Details
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', margin: '0.25rem 0 0 0' }}>
                  Detailed data breakdown for the selected record
                </p>
              </div>
              <button 
                onClick={() => setDetailModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-light)',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content Body */}
            <div style={{
              padding: '1.5rem',
              maxHeight: '70vh',
              overflowY: 'auto'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Dynamically render table headers and their accessor values */}
                {columnsMap[activeReport].map(col => {
                  const val = col.accessor(selectedDetailRow);
                  return (
                    <div key={col.header} style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem',
                      paddingBottom: '0.75rem',
                      borderBottom: '1px dashed var(--border-light)'
                    }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {col.header}
                      </span>
                      <div style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--text-black)' }}>
                        {val}
                      </div>
                    </div>
                  );
                })}

                {/* Extra detailed item lists if the selected row is a Sale and contains items */}
                {Array.isArray(selectedDetailRow.items) && selectedDetailRow.items.length > 0 && (
                  <div style={{
                    marginTop: '0.5rem',
                    background: 'var(--bg-hover)',
                    borderRadius: 'var(--radius-xl)',
                    padding: '1rem'
                  }}>
                    <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-black)', margin: '0 0 0.75rem 0' }}>
                      Items & Services Breakdown
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {selectedDetailRow.items.map((item: any, i: number) => {
                        const typeBadge = (() => {
                          const type = String(item.type || '').toUpperCase();
                          if (type === 'SERVICE') {
                            return { label: 'Service', bg: 'rgba(14, 165, 233, 0.1)', text: 'rgb(3, 105, 161)' };
                          }
                          if (type === 'PRODUCT') {
                            return { label: 'Product', bg: 'rgba(34, 197, 94, 0.1)', text: 'rgb(21, 128, 61)' };
                          }
                          if (type === 'COMBO' || type === 'PACKAGE' || item.redeemedFromPackageId || item.packageName) {
                            return { label: 'Package', bg: 'rgba(234, 179, 8, 0.1)', text: 'rgb(161, 98, 7)' };
                          }
                          if (type === 'VOUCHER') {
                            return { label: 'Voucher', bg: 'rgba(239, 68, 68, 0.1)', text: 'rgb(185, 28, 28)' };
                          }
                          return { label: 'Service', bg: 'rgba(14, 165, 233, 0.1)', text: 'rgb(3, 105, 161)' };
                        })();

                        return (
                          <div key={i} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.8125rem',
                            background: '#ffffff',
                            padding: '0.5rem 0.75rem',
                            borderRadius: 'var(--radius-md)',
                            boxShadow: 'var(--shadow-sm)'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontWeight: 600, color: 'var(--text-black)' }}>{item.name}</span>
                              <span style={{ 
                                fontSize: '0.7rem', 
                                fontWeight: 700, 
                                padding: '0.125rem 0.375rem', 
                                borderRadius: 'var(--radius-md)', 
                                background: typeBadge.bg, 
                                color: typeBadge.text,
                                textTransform: 'uppercase',
                                letterSpacing: '0.025em'
                              }}>
                                {typeBadge.label}
                              </span>
                              <span style={{ color: 'var(--text-light)' }}>x{item.quantity}</span>
                            </div>
                            <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                              {formatPrice(item.price * item.quantity)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--border-light)',
              display: 'flex',
              justifyContent: 'flex-end',
              background: 'var(--bg-hover)'
            }}>
              <button
                onClick={() => setDetailModalOpen(false)}
                style={{
                  background: 'var(--primary)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--radius-xl)',
                  padding: '0.5rem 1.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-md)',
                  transition: 'opacity 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
