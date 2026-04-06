import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Users, DollarSign, Clock, ArrowRight, RefreshCw } from 'lucide-react';
import { KPICard, Card, Button } from '../components/UI';
import { Skeleton } from '../components/Skeleton';
import { WeeklyCalendar } from '../components/WeeklyCalendar';
import { useToast } from '../components/ToastContext';
import { useCurrency } from '../components/CurrencyContext';
import { useNavigate } from 'react-router-dom';
import { RevenueChart } from '../components/dashboard/RevenueChart';
import { TopServicesChart } from '../components/dashboard/TopServicesChart';
import { TopStylists } from '../components/dashboard/TopStylists';
import { DashboardFilter, FilterType } from '../components/DashboardFilter';
import { ComparisonFilter, ComparisonType } from '../components/ComparisonFilter';
import api from '../utils/api';
import { PendingPaymentsCard } from '../components/dashboard/PendingPaymentsCard';
import { InventoryAlertsCard } from '../components/dashboard/InventoryAlertsCard';
import { CashierSummaryCard } from '../components/dashboard/CashierSummaryCard';
import { NewCustomersCard } from '../components/dashboard/NewCustomersCard';
import { SpecialistStatsCard } from '../components/dashboard/SpecialistStatsCard';

/* 
  GET /appointments/upcoming -> Array<Appointment>
*/

// Helper to get YYYY-MM-DD in LOCAL time
const getLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getFilterDateRange = (filter: FilterType, customStart?: string, customEnd?: string) => {
  const now = new Date();
  let start = new Date(now);
  let end = new Date(now);

  // Helper to reset time to start of day
  const setStart = (d: Date) => { d.setHours(0, 0, 0, 0); return d; };
  // Helper to reset time to end of day
  const setEnd = (d: Date) => { d.setHours(23, 59, 59, 999); return d; };

  switch (filter) {
    case 'today':
      start = setStart(new Date(now));
      end = setEnd(new Date(now));
      break;
    case 'weekly':
      // Get Monday of current week
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
      start = setStart(new Date(now.setDate(diff)));
      end = setEnd(new Date(now.setDate(diff + 6)));
      break;
    case 'monthly':
      start = setStart(new Date(now.getFullYear(), now.getMonth(), 1));
      end = setEnd(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      break;
    case 'yearly':
      start = setStart(new Date(now.getFullYear(), 0, 1));
      end = setEnd(new Date(now.getFullYear(), 11, 31));
      break;
    case 'custom':
      if (customStart) start = setStart(new Date(customStart));
      if (customEnd) end = setEnd(new Date(customEnd));
      break;
  }

  return { start, end };
};

const getPreviousDateRange = (currentStart: Date, currentEnd: Date, comparisonType: ComparisonType, customCompareRange?: { start: string; end: string }) => {
  const setStart = (d: Date) => { d.setHours(0, 0, 0, 0); return d; };
  const setEnd = (d: Date) => { d.setHours(23, 59, 59, 999); return d; };

  let start: Date;
  let end: Date;
  let label: string;

  switch (comparisonType) {
    case 'previousDay':
      start = setStart(new Date(currentStart));
      start.setDate(start.getDate() - 1);
      end = setEnd(new Date(start));
      label = 'vs Yesterday';
      break;
    case 'previousWeek':
      start = setStart(new Date(currentStart));
      start.setDate(start.getDate() - 7);
      end = setEnd(new Date(currentEnd));
      end.setDate(end.getDate() - 7);
      label = 'vs Last Week';
      break;
    case 'previousMonth':
      start = setStart(new Date(currentStart));
      start.setMonth(start.getMonth() - 1);
      end = setEnd(new Date(start.getFullYear(), start.getMonth() + 1, 0));
      label = 'vs Last Month';
      break;
    case 'previousYear':
      start = setStart(new Date(currentStart));
      start.setFullYear(start.getFullYear() - 1);
      end = setEnd(new Date(start.getFullYear(), 11, 31));
      label = 'vs Last Year';
      break;
    case 'custom':
      if (customCompareRange?.start) start = setStart(new Date(customCompareRange.start));
      else start = setStart(new Date(currentStart));
      if (customCompareRange?.end) end = setEnd(new Date(customCompareRange.end));
      else end = setEnd(new Date(currentEnd));
      label = 'vs Custom Period';
      break;
  }

  return { start, end, label };
};

const Dashboard: React.FC = () => {
  const { showToast } = useToast();
  const { formatPrice } = useCurrency();
  const navigate = useNavigate();

  // Filter State
  const [filterType, setFilterType] = useState<FilterType>('today');
  const [customRange, setCustomRange] = useState<{ start: string; end: string }>({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [isCompareEnabled, setIsCompareEnabled] = useState(false);
  const [comparisonType, setComparisonType] = useState<ComparisonType>('previousDay');
  const [customCompareRange, setCustomCompareRange] = useState<{ start: string; end: string }>({
    start: new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().split('T')[0],
    end: new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().split('T')[0]
  });

  const [dashboardData, setDashboardData] = useState<any>(() => {
    try {
      const cached = localStorage.getItem('cached_dashboard_summary');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object') {
          // Handle both raw response (from previous buggy versions) and mapped state
          return {
            todayAppointments: parsed.todayAppointments ?? parsed.todayAppointmentsCount ?? 0,
            todaySalesCount: parsed.todaySalesCount ?? 0,
            staffWorking: parsed.staffWorking ?? 0,
            revenueToday: parsed.revenueToday ?? 0,
            pendingRequests: parsed.pendingRequests ?? parsed.pendingRequestsCount ?? 0,
            comparisons: parsed.comparisons,
            newCustomersToday: parsed.newCustomersToday || []
          };
        }
      }
    } catch (e) {
      console.error('Failed to parse cached dashboard summary:', e);
    }
    return {
      todayAppointments: 0,
      todaySalesCount: 0,
      staffWorking: 0,
      revenueToday: 0,
      pendingRequests: 0,
      comparisons: undefined,
      newCustomersToday: []
    };
  });

  const [revenueData, setRevenueData] = useState<any[]>([]); // Data for chart
  const [serviceData, setServiceData] = useState<any[]>([]); // Data for services chart
  const [specialistData, setSpecialistData] = useState<{ name: string; value: number }[]>([]); // Data for top specialists

  const [upcomingAppointments, setUpcomingAppointments] = useState<any[]>([]);
  const [allAppointments, setAllAppointments] = useState<any[]>([]);
  const [allSalesCache, setAllSalesCache] = useState<any[]>([]); // Store raw sales
  const [inventoryProducts, setInventoryProducts] = useState<any[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [appointmentsLoading, setAppointmentsLoading] = useState(true);
  const [salesLoading, setSalesLoading] = useState(true);
  const [inventoryLoading, setInventoryLoading] = useState(false);

  // Fetch Dashboard Summary (KPIs)
  const fetchSummary = async () => {
    try {
      setStatsLoading(true);
      const res = await api.get('/dashboard');
      const dashData = res.data?.data || res.data;

      const mappedData = {
        todayAppointments: dashData.todayAppointmentsCount || 0,
        todaySalesCount: dashData.todaySalesCount || 0,
        staffWorking: dashData.availableSpecialists?.length || 0,
        revenueToday: dashData.todayRevenue || 0,
        pendingRequests: dashData.pendingRequestsCount || 0,
        pendingPayments: dashData.pendingPayments || [],
        recentTransactions: dashData.recentTransactions || [],
        topServices: dashData.topServices || [],
        topStylists: dashData.topStylists || [],
        lowStockAlerts: dashData.lowStockAlerts || [],
        newCustomersToday: dashData.newCustomersToday || [],
        comparisons: undefined // Comparisons are calculated separately
      };

      setDashboardData((prev: any) => ({
        ...prev,
        ...mappedData
      }));
      // Cache for instant load next time
      localStorage.setItem('cached_dashboard_summary', JSON.stringify(mappedData));

      console.log('👥 [Dashboard] New Customers Data:', dashData.newCustomersToday);

      if (dashData.topServices) setServiceData(dashData.topServices);
      if (dashData.topStylists) setSpecialistData(dashData.topStylists);
    } catch (error) {
      console.error('❌ Error fetching dashboard summary:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  // Fetch Appointments
  const fetchAppointments = async () => {
    try {
      setAppointmentsLoading(true);
      // Only fetch last 90 days of appointments to speed up loading
      const fromDate = new Date();
      fromDate.setMonth(fromDate.getMonth() - 3);
      const res = await api.get(`/appointments?from=${fromDate.toISOString()}`);
      const appointments = Array.isArray(res.data) ? res.data : (res.data?.appointments || []);
      setAllAppointments(appointments);

      // Calculate upcoming
      const todayStr = getLocalDateString(new Date());
      const upcoming = appointments
        .filter((apt: any) => {
          const d = apt.date ? getLocalDateString(new Date(apt.date)) : (apt.startTime ? getLocalDateString(new Date(apt.startTime)) : '');
          return d === todayStr && (apt.status === 'CONFIRMED' || apt.status === 'PENDING');
        })
        .sort((a: any, b: any) => (a.time || '').localeCompare(b.time || ''))
        .slice(0, 5)
        .map((apt: any) => ({
          time: apt.time || (apt.startTime ? new Date(apt.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'),
          client: apt.customerName || apt.customer?.name || 'Walk-in',
          service: apt.serviceName || apt.service?.name || 'Service',
          stylist: apt.stylistName || apt.stylist?.name || 'Staff'
        }));
      setUpcomingAppointments(upcoming);
    } catch (error) {
      console.error('❌ Error fetching appointments:', error);
    } finally {
      setAppointmentsLoading(false);
    }
  };

  // Fetch Sales
  const fetchSales = async () => {
    try {
      setSalesLoading(true);
      // Date range limit for sales
      const fromDate = new Date();
      fromDate.setMonth(fromDate.getMonth() - 3);
      const res = await api.get(`/sales?from=${fromDate.toISOString()}`);
      const sales = Array.isArray(res.data.sales) ? res.data.sales : (Array.isArray(res.data) ? res.data : []);
      setAllSalesCache(sales);
    } catch (error) {
      console.error('❌ Error fetching sales:', error);
    } finally {
      setSalesLoading(false);
    }
  };

  // Fetch Payments (New for Cashier Summary)
  const [allPaymentsCache, setAllPaymentsCache] = useState<any[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);

  const fetchPayments = async () => {
    try {
      setPaymentsLoading(true);
      // Date range limit for payments
      const fromDate = new Date();
      fromDate.setMonth(fromDate.getMonth() - 3);
      // Assuming /payments supports a 'startDate' or 'from' param similar to others, 
      // or we fetch recent payments. Payments.tsx uses startDate param.
      // Let's use startDate format YYYY-MM-DD
      const fromDateStr = fromDate.toISOString().split('T')[0];
      const res = await api.get(`/payments?startDate=${fromDateStr}&limit=1000`); // Fetch distinct payments

      const payments = res.data.payments || [];
      setAllPaymentsCache(payments);
    } catch (error) {
      console.error('❌ Error fetching payments:', error);
    } finally {
      setPaymentsLoading(false);
    }
  };

  // Fetch Inventory
  const fetchInventory = async () => {
    try {
      setInventoryLoading(true);
      const res = await api.get('/inventory');
      const products = Array.isArray(res.data) ? res.data : (res.data?.products || []);
      setInventoryProducts(products);
    } catch (error) {
      console.error('❌ Error fetching inventory:', error);
    } finally {
      setInventoryLoading(false);
    }
  };

  const handleRefresh = async () => {
    // Priority: Summary first
    await fetchSummary();

    // Others in background
    Promise.all([
      fetchAppointments(),
      fetchSales(),
      fetchPayments(),
      fetchInventory()
    ]);
  };

  useEffect(() => {
    // Initial Load - Critical First
    const init = async () => {
      // 1. Fetch Summary immediately for KPIs
      await fetchSummary();

      // 2. Fetch non-critical data in background
      fetchAppointments();
      fetchSales();
      fetchPayments();
      fetchInventory();
    };
    init();
  }, []);

  // ─── OPTIMIZED METRICS CALCULATION ─────────────────────────────────────────
  const metrics = useMemo(() => {
    const { start, end } = getFilterDateRange(filterType, customRange.start, customRange.end);

    // 1. Filter Appointments
    const filteredAppointments = allAppointments.filter((apt: any) => {
      let aptDateStr = '';
      if (apt.date) aptDateStr = getLocalDateString(new Date(apt.date));
      else if (apt.startTime) aptDateStr = getLocalDateString(new Date(apt.startTime));
      const aptDate = new Date(aptDateStr);
      aptDate.setHours(0, 0, 0, 0);
      return aptDate >= start && aptDate <= end && apt.status !== 'CANCELLED';
    });

    // 2. Filter Sales
    const filteredSales = allSalesCache.filter((sale: any) => {
      const saleDate = new Date(new Date(sale.createdAt).setHours(0, 0, 0, 0));
      return (
        saleDate >= start &&
        saleDate <= end &&
        sale.saleStatus === 'COMPLETED' &&
        (sale.totalAmount || 0) > 0
      );
    });

    // 3. Filter Payments
    const filteredPayments = allPaymentsCache.filter((payment: any) => {
      const paymentDate = new Date(new Date(payment.createdAt).setHours(0, 0, 0, 0));
      return paymentDate >= start && paymentDate <= end && payment.paymentStatus !== 'FAILED' && payment.paymentStatus !== 'REFUNDED';
    });

    // 4. Calculate Current Period Totals
    const aptCount = filteredAppointments.length;
    const salesCount = filteredSales.length;
    const uniqueSpecialists = new Set(
      filteredAppointments
        .map((a: any) => a.stylistId || a.stylistName)
        .filter((val: any) => val && val !== 'null' && val !== 'undefined' && val !== 'Unassigned' && val !== 'Walk-in')
    ).size;

    const revenue = filteredPayments.reduce((sum: number, payment: any) =>
      payment.paymentStatus === 'COMPLETED' ? sum + (payment.amount || 0) : sum, 0
    );
    const pending = filteredAppointments.filter((apt: any) =>
      apt.status === 'PENDING' || apt.status === 'CONFIRMED'
    ).length;

    // 5. Comparison Calculations
    let comparisons: any = undefined;
    if (isCompareEnabled) {
      const { start: prevStart, end: prevEnd, label } = getPreviousDateRange(start, end, comparisonType, customCompareRange);

      const prevAppointments = allAppointments.filter((apt: any) => {
        let aptDateStr = '';
        if (apt.date) aptDateStr = getLocalDateString(new Date(apt.date));
        else if (apt.startTime) aptDateStr = getLocalDateString(new Date(apt.startTime));
        const aptDate = new Date(aptDateStr);
        aptDate.setHours(0, 0, 0, 0);
        return aptDate >= prevStart && aptDate <= prevEnd && apt.status !== 'CANCELLED';
      });

      const prevSales = allSalesCache.filter((sale: any) => {
        const saleDate = new Date(new Date(sale.createdAt).setHours(0, 0, 0, 0));
        return (
          saleDate >= prevStart &&
          saleDate <= prevEnd &&
          sale.saleStatus === 'COMPLETED' &&
          (sale.totalAmount || 0) > 0
        );
      });

      const prevPayments = allPaymentsCache.filter((payment: any) => {
        const paymentDate = new Date(new Date(payment.createdAt).setHours(0, 0, 0, 0));
        return paymentDate >= prevStart && paymentDate <= prevEnd && payment.paymentStatus !== 'FAILED' && payment.paymentStatus !== 'REFUNDED';
      });

      const prevAptCount = prevAppointments.length;
      const prevSpecialists = new Set(prevAppointments.map((a: any) => a.stylistId || a.stylistName)).size;
      const prevRevenue = prevPayments.reduce((sum: number, payment: any) =>
        payment.paymentStatus === 'COMPLETED' ? sum + (payment.amount || 0) : sum, 0
      );
      const prevPending = prevAppointments.filter((apt: any) => apt.status === 'PENDING' || apt.status === 'CONFIRMED').length;

      const calcChange = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
      };

      comparisons = {
        appointments: {
          value: `${calcChange(aptCount, prevAptCount) >= 0 ? '+' : ''}${calcChange(aptCount, prevAptCount).toFixed(1)}%`,
          label,
          trend: aptCount > prevAptCount ? 'up' : aptCount < prevAptCount ? 'down' : 'neutral'
        },
        staff: {
          value: `${calcChange(uniqueSpecialists, prevSpecialists) >= 0 ? '+' : ''}${calcChange(uniqueSpecialists, prevSpecialists).toFixed(1)}%`,
          label,
          trend: uniqueSpecialists > prevSpecialists ? 'up' : uniqueSpecialists < prevSpecialists ? 'down' : 'neutral'
        },
        revenue: {
          value: `${calcChange(revenue, prevRevenue) >= 0 ? '+' : ''}${calcChange(revenue, prevRevenue).toFixed(1)}%`,
          label,
          trend: revenue > prevRevenue ? 'up' : revenue < prevRevenue ? 'down' : 'neutral'
        },
        pending: {
          value: `${calcChange(pending, prevPending) >= 0 ? '+' : ''}${calcChange(pending, prevPending).toFixed(1)}%`,
          label,
          trend: pending > prevPending ? 'up' : pending < prevPending ? 'down' : 'neutral'
        },
        sales: {
          value: `${calcChange(salesCount, prevSales.length) >= 0 ? '+' : ''}${calcChange(salesCount, prevSales.length).toFixed(1)}%`,
          label,
          trend: salesCount > prevSales.length ? 'up' : salesCount < prevSales.length ? 'down' : 'neutral'
        }
      };
    }

    // 6. Generate Revenue Chart Data
    const formatDateKey = (d: Date) => d.toISOString().split('T')[0];
    let chartData: any[] = [];

    if (filterType === 'yearly') {
      const monthlyData = Array(12).fill(0);
      allSalesCache.forEach(sale => {
        const d = new Date(sale.createdAt);
        if (d >= start && d <= end && sale.saleStatus !== 'CANCELLED') {
          monthlyData[d.getMonth()] += (sale.paidAmount || 0);
        }
      });

      chartData = monthlyData.map((val, idx) => ({
        date: new Date(start.getFullYear(), idx, 1).toLocaleDateString('en-US', { month: 'short' }),
        revenue: val
      }));
    } else {
      const dayDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24));
      const chartPoints: any[] = [];

      for (let i = 0; i <= dayDiff; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const key = formatDateKey(d);
        const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        chartPoints.push({ key, label, revenue: 0 });
      }

      allSalesCache.forEach(sale => {
        const d = new Date(sale.createdAt);
        if (d >= start && d <= end && sale.saleStatus !== 'CANCELLED') {
          const key = formatDateKey(d);
          const point = chartPoints.find(p => p.key === key);
          if (point) point.revenue += (sale.paidAmount || 0);
        }
      });

      chartData = chartPoints.map(p => ({ date: p.label, revenue: p.revenue }));
    }

    return {
      aptCount,
      salesCount,
      uniqueSpecialists,
      revenue,
      pending,
      filteredSales,
      filteredPayments,
      comparisons,
      chartData,
      start,
      end
    };
  }, [filterType, customRange, allAppointments, allSalesCache, allPaymentsCache, isCompareEnabled, comparisonType, customCompareRange]);

  // Effect to sync metrics to dashboardData and chart (triggers only when metrics object changes)
  useEffect(() => {
    setDashboardData(prev => ({
      ...prev,
      todayAppointments: metrics.aptCount,
      todaySalesCount: metrics.salesCount,
      staffWorking: metrics.uniqueSpecialists,
      revenueToday: metrics.revenue,
      pendingRequests: metrics.pending,
      activeSales: metrics.filteredSales,
      filteredSales: metrics.filteredSales,
      filteredPayments: metrics.filteredPayments,
      comparisons: metrics.comparisons
    }));

    setRevenueData(metrics.chartData);
  }, [metrics]);


  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        ease: "easeOut",
        staggerChildren: 0.08
      }
    }
  };

  const getFilterLabel = () => {
    if (filterType === 'today') return "Today's";
    if (filterType === 'weekly') return "This Week's";
    if (filterType === 'monthly') return "This Month's";
    if (filterType === 'yearly') return "This Year's";
    return "Custom Period";
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      style={{ position: 'relative' }}
    >
      {/* Header with Filter */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row justify-start items-start md:items-center gap-4">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-dark)' }}> Compare</span>
            <button
              onClick={() => setIsCompareEnabled(!isCompareEnabled)}
              style={{
                width: '48px',
                height: '26px',
                borderRadius: '13px',
                background: isCompareEnabled ? 'var(--primary)' : '#E2E8F0',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                transition: 'background 0.2s'
              }}
            >
              <motion.div
                animate={{ x: isCompareEnabled ? 22 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  background: 'white',
                  position: 'absolute',
                  top: '2px',
                  left: '2px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              />
            </button>
          </div>

          {isCompareEnabled && (
            <ComparisonFilter
              currentComparison={comparisonType}
              onComparisonChange={setComparisonType}
              customCompareRange={customCompareRange}
              onCustomCompareChange={(start, end) => setCustomCompareRange({ start, end })}
            />
          )}

          <DashboardFilter
            currentFilter={filterType}
            onFilterChange={setFilterType}
            customRange={customRange}
            onCustomRangeChange={(start, end) => setCustomRange({ start, end })}
          />

          <Button
            variant="outline"
            className="flex items-center gap-2"
            onClick={handleRefresh}
            disabled={statsLoading || appointmentsLoading || salesLoading}
          >
            <RefreshCw size={16} className={(statsLoading || appointmentsLoading || salesLoading) ? 'animate-spin' : ''} />
            <span className="hidden md:inline">Refresh</span>
          </Button>
        </div>
      </motion.div>

      <motion.div
        variants={itemVariants}
        className="grid md-grid-cols-2 lg-grid-cols-4 gap-6"
      >
        <KPICard
          title={`${getFilterLabel()} Appointments`}
          value={(dashboardData?.todayAppointments ?? 0).toString()}
          icon={Calendar}
          color="text-pink-500"
          comparison={dashboardData.comparisons?.appointments}
          loading={statsLoading}
        />
        <KPICard
          title={`${getFilterLabel()} Sales`}
          value={(dashboardData?.todaySalesCount ?? 0).toString()}
          icon={Users}
          color="#8b5cf6"
          comparison={dashboardData.comparisons?.sales}
          loading={statsLoading}
        />
        <KPICard
          title={`${getFilterLabel()} Revenue`}
          value={formatPrice(dashboardData?.revenueToday ?? 0)}
          icon={DollarSign}
          color="#22c55e"
          comparison={dashboardData.comparisons?.revenue}
          loading={statsLoading}
        />
        <KPICard
          title="Pending Requests"
          value={(dashboardData?.pendingRequests ?? 0).toString()}
          icon={Clock}
          color="#f97316"
          comparison={dashboardData.comparisons?.pending}
          loading={statsLoading}
        />
      </motion.div>

      <motion.div variants={itemVariants} className="dashboard-grid-2">
        <div>
          {statsLoading && revenueData.length === 0 ? (
            <Card title="Revenue History">
              <Skeleton width="100%" height="300px" style={{ borderRadius: '1rem' }} />
            </Card>
          ) : (
            <RevenueChart data={revenueData} title="Revenue History" />
          )}
        </div>
        <div>
          {statsLoading && serviceData.length === 0 ? (
            <Card title="Top Services">
              <Skeleton width="100%" height="300px" style={{ borderRadius: '1rem' }} />
            </Card>
          ) : (
            <TopServicesChart data={serviceData} />
          )}
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="grid lg-grid-cols-4" style={{ gap: '1.5rem' }}>
        <PendingPaymentsCard pendingPayments={dashboardData.pendingPayments || []} loading={statsLoading} />
        <CashierSummaryCard sales={dashboardData.filteredPayments || []} loading={paymentsLoading} />
        <InventoryAlertsCard lowStockAlerts={dashboardData.lowStockAlerts || []} loading={inventoryLoading} />
        <NewCustomersCard customers={dashboardData.newCustomersToday || []} loading={statsLoading} />
      </motion.div>

      <motion.div variants={itemVariants} className="dashboard-grid-2" style={{ alignItems: 'start' }}>
        {/* Main Calendar View */}
        <div>
          <Card title="Detailed Schedule" className="w-full scrollbar-hide" style={{ height: '750px', overflowY: 'auto' }}>
            {appointmentsLoading && allAppointments.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {Array.from({ length: 12 }).map((_, i) => (
                  <Skeleton key={i} width="100%" height="50px" style={{ borderRadius: '0.5rem' }} />
                ))}
              </div>
            ) : (
              <WeeklyCalendar appointments={allAppointments} />
            )}
          </Card>
        </div>

        {/* Top Specialists Only */}
        <div className="space-y-6">
          <TopStylists data={specialistData} loading={statsLoading} />
          <SpecialistStatsCard />
        </div>
      </motion.div>
      {/* <div style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        background: 'rgba(0,0,0,0.8)',
        color: 'white',
        padding: '10px',
        borderRadius: '8px',
        fontSize: '10px',
        maxWidth: '400px',
        maxHeight: '300px',
        overflow: 'auto',
        zIndex: 9999,
        pointerEvents: 'none'
      }}>
        DEBUG: New Customers Data
        <pre>{JSON.stringify(dashboardData.newCustomersToday, null, 2)}</pre>
      </div> */}
    </motion.div>
  );
};

export default Dashboard;

