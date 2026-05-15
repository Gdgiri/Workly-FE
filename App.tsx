import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from './redux/store';
import { logoutUser } from './redux/slices/authSlice';
import { fetchSettings } from './redux/slices/settingSlice';
import { motion, AnimatePresence } from 'framer-motion';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar, TopBar } from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { PaymentMethod, Voucher, VoucherClaim, Customer } from './types';

// Pages
import Dashboard from './pages/Dashboard';
import Appointments from './pages/Appointments';
import Customers from './pages/Customers';
import api from './utils/api';
import { ServicesView } from './pages/Management';
import Stylists from './pages/Stylists';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Inventory from './pages/Inventory';
import Packages from './pages/Packages';
import Vouchers from './pages/Vouchers';
import DayEndReconciliation from './pages/Reconciliation';
import ReconciliationAudits from './pages/ReconciliationAudits';
import Sales from './pages/Sales';
import ExpenseList from './pages/ExpenseList';
import Category from './pages/Category';
import Payments from './pages/Payments';
import { AskAI } from './pages/AskAI';
import MessageLog from './pages/MessageLog';
import ChecklistList from './pages/ChecklistList';
import ChecklistBuilder from './pages/ChecklistBuilder';

// Auth Pages
import Login from './pages/Auth/Login';
// import Register from './pages/Auth/Register';
import ForgotPassword from './pages/Auth/ForgotPassword';
import ResetPassword from './pages/Auth/ResetPassword';
import AuthCallback from './pages/Auth/AuthCallback';
import { BusinessRegister } from './pages/Auth/BusinessRegister';
import { PendingApproval } from './pages/Auth/PendingApproval';

// SuperAdmin Pages
import { BusinessApprovals } from './pages/SuperAdmin/BusinessApprovals';

// Public Pages
import TermsAndConditions from './pages/Public/TermsAndConditions';
import PrivacyPolicy from './pages/Public/PrivacyPolicy';

import { ToastProvider, useToast } from './components/ToastContext';
import { CurrencyProvider } from './components/CurrencyContext';

const AppContent: React.FC = () => {
  // Use Redux state for authentication
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  // @ts-ignore
  const user = useSelector((state: RootState) => state.auth.user);

  const { showToast } = useToast();

  const [appValidation, setAppValidation] = useState<{ loading: boolean, valid: boolean, error?: string }>({ loading: true, valid: false });
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();

  // Check if current path is a public policy route
  const isPublicRoute = location.pathname.includes('/terms-and-conditions') ||
    location.pathname.includes('/privacy-policy');

  const isAuthRoute = location.pathname.endsWith('/login') ||
    location.pathname.endsWith('/register') ||
    location.pathname.endsWith('/business-register') ||
    location.pathname.endsWith('/pending-approval') ||
    location.pathname.endsWith('/forgotpassword') ||
    location.pathname.endsWith('/resetpassword') ||
    location.pathname.includes('/auth/callback');

  // Extract appId from URL
  const pathParts = location.pathname.split('/').filter(p => p);
  const appId = pathParts.length >= 2 ? pathParts[0] : null;

  // Validate appId against database
  useEffect(() => {
    const validateApp = async () => {
      // TEMPORARY: Skip validation for development
      setAppValidation({ loading: false, valid: true });
      return;

      /* Original validation code - commented out for development
      if (!isAuthRoute) {
        setAppValidation({ loading: false, valid: true });
        return;
      }

      // Check if URL follows business-specific pattern
      if (!appId || pathParts.length < 2) {
        setAppValidation({ loading: false, valid: false, error: 'Invalid URL format. Please use: /appId/businessName/login' });
        return;
      }

      try {
        const response = await fetch('https://authservice-salon-backend-1.onrender.com/apps');
        const apps = await response.json();
        const validApp = apps.find((app: any) => app.name === appId);

        if (validApp) {
          setAppValidation({ loading: false, valid: true });
        } else {
          setAppValidation({ loading: false, valid: false, error: `Invalid app ID: ${appId}` });
        }
      } catch (error) {
        setAppValidation({ loading: false, valid: false, error: 'Failed to validate app' });
      }
      */
    };
    validateApp();
  }, [appId, isAuthRoute]);



  // Redirect to login if not authenticated and not on auth/public route
  useEffect(() => {
    if (!isAuthenticated && !isAuthRoute && !isPublicRoute) {
      const currentPath = location.pathname;
      if (currentPath.includes('/')) {
        const pathParts = currentPath.split('/').filter(p => p);
        if (pathParts.length >= 2) {
          navigate(`/${pathParts[0]}/${pathParts[1]}/login`);
        } else {
          navigate('/login');
        }
      } else {
        navigate('/login');
      }
    }
  }, [isAuthenticated, isAuthRoute, navigate, location.pathname]);

  // Navigate to dashboard after successful authentication
  useEffect(() => {
    if (isAuthenticated && isAuthRoute) {
      // Add a small delay to allow success toast to be visible
      const timer = setTimeout(() => {
        // Use stored user info for robust redirection
        // @ts-ignore
        const { appName, businessName } = user || {};

        if (appName && businessName) {
          const isStaff = user?.role?.toUpperCase() === 'STAFF';
          const targetPage = isStaff ? 'sales' : 'dashboard';
          navigate(`/${appName}/${businessName}/${targetPage}`);
        } else {
          // Fallback to URL parsing
          const currentPath = location.pathname;
          const pathParts = currentPath.split('/').filter(p => p);
          if (pathParts.length >= 2) {
            // Check if user is staff even in fallback
            const isStaff = user?.role?.toUpperCase() === 'STAFF';
            const targetPage = isStaff ? 'sales' : 'dashboard';
            navigate(`/${pathParts[0]}/${pathParts[1]}/${targetPage}`);
          } else {
            navigate('/dashboard');
          }
        }
      }, 500); // 0.5 second delay to show success toast

      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, isAuthRoute, navigate, location.pathname, user]);

  // --- GLOBAL STATE ---
  // Lifted state to share between Settings and Sales
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([
    { id: 'cash', name: 'Cash', active: true },
    // { id: 'visa', name: 'Visa', active: true },
    // { id: 'master', name: 'Mastercard', active: true },
    { id: 'onlinepay', name: 'onlinepay', active: true },
    // { id: 'grabpay', name: 'GrabPay', active: true },
    // { id: 'voucher', name: 'External Voucher', active: true }, // For external vouchers
  ]);

  // Global Customers State
  const [customers, setCustomers] = useState<Customer[]>(() => {
    const cached = localStorage.getItem('cached_customers');
    return cached ? JSON.parse(cached) : [];
  });

  // Vouchers (Campaigns)
  const [vouchers, setVouchers] = useState<Voucher[]>(() => {
    const cached = localStorage.getItem('cached_vouchers');
    return cached ? JSON.parse(cached) : [];
  });
  // Voucher Claims (Customer Wallets)
  const [voucherClaims, setVoucherClaims] = useState<VoucherClaim[]>(() => {
    const cached = localStorage.getItem('cached_voucherClaims');
    return cached ? JSON.parse(cached) : [];
  });

  // --- FRAUD PROTECTION STATE ---
  const [fraudProtection, setFraudProtection] = useState(false);

  // --- MOBILE MENU STATE ---
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // --- SIDEBAR COLLAPSE STATE ---
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

  // Fetch Data on Load
  const { settings: reduxSettings } = useSelector((state: any) => state.settings);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [vouchersRes, claimsRes, customersRes] = await Promise.all([
          api.get('/vouchers'),
          api.get('/vouchers/claims'),
          api.get('/customers')
        ]);

        setVouchers(vouchersRes.data);
        setVoucherClaims(claimsRes.data);
        setCustomers(customersRes.data);

        localStorage.setItem('cached_vouchers', JSON.stringify(vouchersRes.data));
        localStorage.setItem('cached_voucherClaims', JSON.stringify(claimsRes.data));
        localStorage.setItem('cached_customers', JSON.stringify(customersRes.data));
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    if (isAuthenticated) {
      fetchData();
      dispatch(fetchSettings());
    }
  }, [isAuthenticated, dispatch]);

  useEffect(() => {
    if (reduxSettings) {
      const settingsData = reduxSettings;
      let methods: PaymentMethod[] = [];
      if (settingsData.activePaymentMethods) {
        const parsed = typeof settingsData.activePaymentMethods === 'string'
          ? JSON.parse(settingsData.activePaymentMethods)
          : settingsData.activePaymentMethods;

        if (Array.isArray(parsed)) {
          methods = parsed.map((m: any) => {
            const name = m.name.toUpperCase().trim();

            // 1:1 Dynamic ID generation: name -> UPPERCASE_WITH_UNDERSCORES
            // We only keep 'CASH' as a protected system ID.
            let id = name.replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
            if (name === 'CASH') id = 'CASH';

            // Ensure we have a valid ID fallback
            if (!id) id = `METHOD_${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

            return {
              id,
              name: m.name,
              active: m.status === 1,
              url: m.url || '',
              secretKey: m.secretKey || ''
            };
          });
        }
      }
      if (settingsData.fraudProtection !== undefined) {
        setFraudProtection(settingsData.fraudProtection);
      }
      if (methods.length === 0) methods = [{ id: 'CASH', name: 'Cash', active: true }];
      setPaymentMethods(methods);
    }
  }, [reduxSettings]);

  // --- RENDER CURRENT PAGE ---
  // Moved to Routes definition below

  // --- AUTH NAVIGATION STATE ---
  // const [authView, setAuthView] = useState<'login' | 'register' | 'forgot-password' | 'reset-password'>('login'); // Not inferred anymore

  // Handle navigation for auth pages
  const handleAuthNavigate = (view: 'login' | 'register' | 'forgot-password' | 'reset-password') => {
    const currentPath = location.pathname;
    // Basic heuristics to find base path if we are deep in routes
    // But usually auth is at /:appId/:businessName/...
    // Let's rely on params or reconstruction
    if (appId && pathParts.length >= 2) {
      const businessName = pathParts[1];
      const pathMap = {
        'login': `/${appId}/${businessName}/login`,
        'register': `/${appId}/${businessName}/register`,
        'forgot-password': `/${appId}/${businessName}/forgotpassword`,
        'reset-password': `/${appId}/${businessName}/resetpassword`
      };
      navigate(pathMap[view]);
    } else {
      // Fallback
      navigate('/login');
    }
  };

  // --- LOGIN SCREEN & AUTH FLOW & PUBLIC PAGES ---
  if (isPublicRoute || (!isAuthenticated && isAuthRoute)) {
    if (appValidation.loading) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <div>Validating app...</div>
        </div>
      );
    }
    if (!appValidation.valid) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', padding: '2rem' }}>
          <h2 style={{ color: '#ef4444', marginBottom: '1rem' }}>Invalid App</h2>
          <p style={{ color: '#6b7280', textAlign: 'center' }}>{appValidation.error}</p>
        </div>
      );
    }

    return (
      <Routes>
        <Route path="/:appId/:businessName/login" element={<Login onNavigate={handleAuthNavigate} />} />
        {/* <Route path="/:appId/:businessName/register" element={<Register onNavigate={handleAuthNavigate} />} /> */}
        <Route path="/:appId/:businessName/business-register" element={<BusinessRegister />} />
        <Route path="/:appId/:businessName/pending-approval" element={<PendingApproval />} />
        <Route path="/:appId/:businessName/forgotpassword" element={<ForgotPassword onNavigate={handleAuthNavigate} />} />
        <Route path="/:appId/:businessName/resetpassword" element={<ResetPassword onNavigate={handleAuthNavigate} />} />
        <Route path="/:appId/:businessName/auth/callback" element={<AuthCallback />} />
        <Route path="/:appId/:businessName/terms-and-conditions" element={<TermsAndConditions />} />
        <Route path="/:appId/:businessName/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/business-register" element={<BusinessRegister />} />
        <Route path="/pending-approval" element={<PendingApproval />} />
        <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      </Routes>
    );
  }

  if (!isAuthenticated && !isAuthRoute) {
    return null; // Will trigger redirect in useEffect
  }



  // --- MAIN ADMIN LAYOUT & ROUTES ---
  return (
    <div className="app-container">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="mobile-only"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 15
          }}
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <Sidebar
        onLogout={() => dispatch(logoutUser())}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      <div className="main-content" style={{
        marginLeft: isSidebarCollapsed ? '90px' : undefined,
        transition: 'margin-left 0.3s ease-in-out'
      }}>
        {/* TopBar Title needs to be dynamic based on Route now. We can deduce it from location or let pages handle it? 
            For simplicity, let's just infer from URL last part */}
        <TopBar
          title={(() => {
            const pathLeaf = location.pathname.split('/').pop();
            if (pathLeaf === 'stylists') return 'Specialist';
            if (pathLeaf === 'appointments') return 'Schedule';
            if (pathLeaf === 'payments') return 'Transaction';
            return pathLeaf ? pathLeaf.charAt(0).toUpperCase() + pathLeaf.slice(1).toLowerCase() : 'Dashboard';
          })()}
          subtitle={(() => {
            const pathLeaf = location.pathname.split('/').pop();
            switch (pathLeaf) {
              case 'dashboard':
              case undefined:
              case '':
                return "Welcome back, here is today's overview.";
              case 'payments':
                return "Track your business transactions and history";
              case 'sales':
                return "Process sales and manage billing";
              case 'appointments':
                return "Manage your salon's daily schedule";
              case 'services':
                return "Configure service menu and pricing";
              case 'inventory':
                return "Monitor and manage product inventory";
              case 'packages':
                return "Create and manage service packages";
              case 'vouchers':
                return "Manage customer vouchers and credits";
              case 'reconciliation':
                return "Process daily end-of-day reports";
              case 'reconciliation-audits':
                return "Review and audit past reconciliations";
              case 'stylists':
                return "Manage your team and their schedules";
              case 'customers':
                return "View and manage your customer base";
              case 'reports':
                return "Detailed business metrics and insights";
              case 'ask-ai':
                return "Your intelligent business companion";
              case 'settings':
                return "Manage account and business settings";
              case 'category':
                return "Organize services and expenses";
              case 'expenses':
                return "Manage your expenses and overheads";
              case 'business-approvals':
                return "Approve new business registrations";
              case 'message-log':
                return "Track and manage customer communications";
              case 'checklist':
                return "Manage your standard operating procedures and tasks";
              case 'checklist-builder':
                return "Create and edit checklist templates";
              default:
                return undefined;
            }
          })()}
          onMenuClick={() => setIsMobileMenuOpen(true)}
        />

        <main className="page-content">
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/:appId/:businessName/dashboard" element={
                <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'SUPER_ADMIN']}>
                  <Dashboard />
                </ProtectedRoute>
              } />
              <Route path="/:appId/:businessName/payments" element={<Payments paymentMethods={paymentMethods.filter(m => m.active)} fraudProtection={fraudProtection} />} />
              <Route path="/:appId/:businessName/sales" element={
                <Sales
                  paymentMethods={paymentMethods.filter(m => m.active)}
                  vouchers={vouchers}
                  setVouchers={setVouchers}
                  voucherClaims={voucherClaims}
                  setVoucherClaims={setVoucherClaims}
                  customers={customers}
                  setCustomers={setCustomers}
                  fraudProtection={fraudProtection}
                />
              } />
              <Route path="/:appId/:businessName/appointments" element={<Appointments fraudProtection={fraudProtection} />} />
              <Route path="/:appId/:businessName/services" element={<ServicesView />} />
              <Route path="/:appId/:businessName/inventory" element={<Inventory />} />
              <Route path="/:appId/:businessName/packages" element={<Packages />} />
              <Route path="/:appId/:businessName/vouchers" element={
                <Vouchers
                  vouchers={vouchers}
                  setVouchers={setVouchers}
                  voucherClaims={voucherClaims}
                  setVoucherClaims={setVoucherClaims}
                  customers={customers}
                />
              } />
              <Route path="/:appId/:businessName/reconciliation" element={<DayEndReconciliation paymentMethods={paymentMethods.filter(m => m.active)} fraudProtection={fraudProtection} />} />
              <Route path="/:appId/:businessName/reconciliation-audits" element={<ReconciliationAudits />} />
              <Route path="/:appId/:businessName/stylists" element={<Stylists />} />
              <Route path="/:appId/:businessName/customers" element={<Customers fraudProtection={fraudProtection} />} />
              <Route path="/:appId/:businessName/reports" element={<Reports />} />
              <Route path="/:appId/:businessName/ask-ai" element={<AskAI />} />
              <Route path="/:appId/:businessName/settings" element={<Settings paymentMethods={paymentMethods} setPaymentMethods={setPaymentMethods} setFraudProtection={setFraudProtection} />} />
              <Route path="/:appId/:businessName/category" element={<Category />} />
              <Route path="/:appId/:businessName/expenses" element={<ExpenseList />} />
              <Route path="/:appId/:businessName/business-approvals" element={<BusinessApprovals />} />
              <Route path="/:appId/:businessName/message-log" element={<MessageLog />} />
              <Route path="/:appId/:businessName/checklist" element={<ChecklistList />} />
              <Route path="/:appId/:businessName/checklist-builder" element={<ChecklistBuilder />} />


              {/* Default redirect if no subpath match, but still under /app/biz/ ??? */}
              {/* We can use index route or catch all */}
              {/* <Route path="*" element={<Dashboard />} /> */}
            </Routes>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ToastProvider>
      <CurrencyProvider>
        <Router>
          <AppContent />
        </Router>
      </CurrencyProvider>
    </ToastProvider>
  );
};

export default App;