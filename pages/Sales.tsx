import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, Link, useParams, useSearchParams } from 'react-router-dom';
import { Search, Plus, Minus, User, UserPlus, CreditCard, ShoppingBag, UserCog, Package, Ticket, X, AlertTriangle, CheckCircle, Smartphone, DollarSign, Wallet, Paperclip, Printer, ChevronDown } from 'lucide-react';
import { Card, Button, Input, Modal, Select, Checkbox } from '../components/UI';
import { PaymentMethod, CartItem, ComboPackage, Voucher, VoucherClaim, Customer, Stylist } from '../types';
import { useCurrency } from '../components/CurrencyContext';
import { motion, AnimatePresence } from 'framer-motion';
import { AttachmentsInput, Attachment } from '../components/AttachmentsInput';
import { useToast } from '../components/ToastContext';
import api from '../utils/api';

import { useAuth } from '../hooks/useAuth';
import { ServiceAvatar } from '../components/ServiceAvatar';
import { FaWalking } from "react-icons/fa";
import { generateReceiptHtml } from '../utils/receiptGenerator';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../redux/store';
import { fetchServices } from '../redux/slices/serviceSlice';
import { fetchInventory, fetchInventoryHistory, invalidateInventoryCache } from '../redux/slices/inventorySlice';
import { fetchPackages } from '../redux/slices/packageSlice';
import { fetchPayments, invalidatePaymentCache } from '../redux/slices/paymentSlice';
import { fetchCustomers, createCustomer, invalidateCustomerCache } from '../redux/slices/customerSlice';
import { fetchSettings } from '../redux/slices/settingSlice';
import { Skeleton } from '../components/Skeleton';
import { Switch } from '../components/Switch';
import { QuotationSystem } from '../components/QuotationSystem';

interface SalesProps {
  paymentMethods: PaymentMethod[];
  vouchers: Voucher[];
  setVouchers: React.Dispatch<React.SetStateAction<Voucher[]>>;
  voucherClaims: VoucherClaim[];
  setVoucherClaims: React.Dispatch<React.SetStateAction<VoucherClaim[]>>;
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  fraudProtection?: boolean;
}

const Sales: React.FC<SalesProps> = ({
  paymentMethods,
  vouchers,
  setVouchers,
  voucherClaims,
  setVoucherClaims,
  customers: _customersProp, // Ignored, using Redux
  setCustomers,
  fraudProtection = false
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { services, categories: serviceCategories, loading: servicesLoading } = useSelector((state: RootState) => state.services);
  const { products, categories: productCategories, loading: productsLoading } = useSelector((state: RootState) => state.inventory);
  const { packages: rawCombos, loading: packagesLoading } = useSelector((state: RootState) => state.packages);
  const { customers, loading: customersLoading } = useSelector((state: RootState) => state.customers);
  const { settings: salonSettings } = useSelector((state: RootState) => state.settings);

  // Sync Redux customers to App state (Legacy support)
  useEffect(() => {
    if (customers.length > 0) {
      setCustomers(customers);
    }
  }, [customers, setCustomers]);

  // Only show active products in the sales screen
  const activeProducts = useMemo(() => products.filter(p => p.isActive !== false), [products]);

  // Filter combos to ensure valid items (only from active services/products)
  const combos = useMemo(() => {
    const availableServiceNames = services.map(s => s.name);
    const availableProductNames = activeProducts.map(p => p.name); // only active products

    return rawCombos.map(combo => ({
      ...combo,
      items: (combo.items || []).filter(item => {
        if (item.type === 'service') return availableServiceNames.includes(item.name);
        if (item.type === 'product') return availableProductNames.includes(item.name);
        return false;
      })
    }));
  }, [rawCombos, services, activeProducts]);

  const loading = servicesLoading || productsLoading || packagesLoading || customersLoading;

  const { formatPrice, currency, symbol } = useCurrency();
  const { showToast } = useToast();
  const { user, isStaff, isAdmin, hasPermission } = useAuth(); // Get user, isStaff and isAdmin from auth hook
  const canAddSale = hasPermission('sales', 'add');
  const canAddCustomer = hasPermission('customer', 'add');
  const { appId: appIdParam, businessName: businessNameParam } = useParams<{ appId: string; businessName: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  // Robust extraction of business info
  const businessName = businessNameParam || (user as any)?.businessName || localStorage.getItem('businessName') || '';
  const appId = appIdParam || (user as any)?.appName || localStorage.getItem('appId') || '';

  // Save to localStorage for survival
  useEffect(() => {
    if (businessName) localStorage.setItem('businessName', businessName);
    if (appId) localStorage.setItem('appId', appId);
  }, [businessName, appId]);

  const isIndianBeautyArt = user?.businessName?.toLowerCase() === 'indianbeautyart';
  const shouldHideFeatures = isIndianBeautyArt && (isAdmin || isStaff);
  const [isQuotationMode, setIsQuotationMode] = useState(false);
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'services' | 'products' | 'combos' | 'vouchers'>('services');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  // ─── MULTI-TAB SALES ────────────────────────────────────────────────────────
  interface SalesTab {
    id: string;
    label: string;        // 'Order 1', 'Order 2', …
    cart: CartItem[];
    customerId: string;
    customerName: string;
    specialistId: string | number;
    specialistName: string;
    depositAmount: number;
    appointmentId: string | null;
    pendingSaleId: string | null;
    manualDiscount: string;
    showManualDiscount: boolean;
    customerSearchTerm: string;
  }

  const makeNewTab = (n: number): SalesTab => ({
    id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
    label: `Order ${n}`,
    cart: [],
    customerId: '',
    customerName: '',
    specialistId: '',
    specialistName: '',
    depositAmount: 0,
    appointmentId: null,
    pendingSaleId: null,
    manualDiscount: '',
    showManualDiscount: false,
    customerSearchTerm: ''
  });

  const loadTabsFromSession = (): SalesTab[] => {
    try {
      const saved = JSON.parse(sessionStorage.getItem('salesTabs') || 'null');
      if (Array.isArray(saved) && saved.length > 0) return saved;
    } catch { }
    return [makeNewTab(1)];
  };

  const [salesTabs, setSalesTabs] = useState<SalesTab[]>(loadTabsFromSession);
  const [activeSalesTabId, setActiveSalesTabId] = useState<string>(() => {
    try { return sessionStorage.getItem('salesActiveTabId') || ''; } catch { return ''; }
  });

  // Resolve the active tab (fallback to first if id no longer exists)
  const activeOrderTab: SalesTab = salesTabs.find(t => t.id === activeSalesTabId) ?? salesTabs[0];

  // Helper: update a field on the active tab
  const updateActiveTab = (patch: Partial<SalesTab>) => {
    setSalesTabs(prev => prev.map(t => t.id === activeOrderTab.id ? { ...t, ...patch } : t));
  };

  // Per-tab state getters / setters (API-compatible with the rest of the file)
  const cart: CartItem[] = activeOrderTab.cart;
  const setCart = (v: CartItem[] | ((prev: CartItem[]) => CartItem[])) => {
    setSalesTabs(prev => prev.map(t => t.id === activeOrderTab.id
      ? { ...t, cart: typeof v === 'function' ? v(t.cart) : v }
      : t
    ));
  };

  const selectedCustomerId: string = activeOrderTab.customerId;
  const setSelectedCustomerId = (v: string) => {
    let name = '';
    if (v === 'WALK_IN') {
      name = 'Walk-in Customer';
    } else if (v) {
      name = customers.find(c => c.id.toString() === v)?.name || '';
    }
    updateActiveTab({ customerId: v, customerName: name });
  };

  const selectedSpecialistId: string | number = activeOrderTab.specialistId;
  const setSelectedSpecialistId = (v: string | number) => updateActiveTab({ specialistId: v });

  const selectedSpecialistName: string = activeOrderTab.specialistName;
  const setSelectedSpecialistName = (v: string) => updateActiveTab({ specialistName: v });

  const depositAmount: number = activeOrderTab.depositAmount;
  const setDepositAmount = (v: number) => updateActiveTab({ depositAmount: v });

  const appointmentId: string | null = activeOrderTab.appointmentId;
  const setAppointmentId = (v: string | null) => updateActiveTab({ appointmentId: v });

  const pendingSaleId: string | null = activeOrderTab.pendingSaleId;
  const setPendingSaleId = (v: string | null) => updateActiveTab({ pendingSaleId: v });

  const manualDiscount: string = activeOrderTab.manualDiscount;
  const setManualDiscount = (v: string) => updateActiveTab({ manualDiscount: v });

  const customerSearchTerm: string = activeOrderTab.customerSearchTerm;
  const setCustomerSearchTerm = (v: string) => updateActiveTab({ customerSearchTerm: v });

  const setShowManualDiscount = (v: boolean) => updateActiveTab({ showManualDiscount: v });

  const processedStateRef = useRef<string | null>(null);

  // Persist tabs to sessionStorage
  useEffect(() => {
    try { sessionStorage.setItem('salesTabs', JSON.stringify(salesTabs)); } catch { }
  }, [salesTabs]);

  useEffect(() => {
    try { sessionStorage.setItem('salesActiveTabId', activeOrderTab.id); } catch { }
  }, [activeOrderTab.id]);

  // ─── Tab Management ─────────────────────────────────────────────────────────
  const addSalesTab = () => {
    const newTab = makeNewTab(salesTabs.length + 1);
    setSalesTabs(prev => [...prev, newTab]);
    setActiveSalesTabId(newTab.id);
  };

  const closeSalesTab = (tabId: string) => {
    if (salesTabs.length === 1) return; // always keep at least one
    setSalesTabs(prev => {
      const remaining = prev.filter(t => t.id !== tabId);
      // Switch to first remaining tab if we closed the active one
      if (tabId === activeOrderTab.id) {
        setActiveSalesTabId(remaining[0].id);
      }
      return remaining;
    });
  };

  // Helper to clear the active tab's persisted state after a completed sale
  const clearSalesSession = () => {
    updateActiveTab({
      cart: [],
      customerId: '',
      customerName: '',
      specialistId: '',
      specialistName: '',
      depositAmount: 0,
      appointmentId: null,
      pendingSaleId: null,
      manualDiscount: '',
      customerSearchTerm: ''
    });
  };
  // ─────────────────────────────────────────────────────────────────────────────

  // Reset transient UI state when switching order tabs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setIsCheckoutOpen(false);
    setAppliedVouchers([]);
    setVoucherCode('');
    setVoucherError('');
    setIsCustomerDropdownOpen(false);
    setIsSpecialistDropdownOpen(false);
  }, [activeOrderTab.id]);

  const maskPhone = (phone: string | undefined | null) => {
    if (!phone || phone === 'N/A') return 'N/A';
    if (phone.length <= 4) return phone;
    return phone.slice(0, phone.length - 4) + '****';
  };

  const [showInactive, setShowInactive] = useState(false);

  // Specialist State
  const [stylists, setStylists] = useState<Stylist[]>([]);
  const [isSpecialistDropdownOpen, setIsSpecialistDropdownOpen] = useState(false);
  const [isSpecialistModalOpen, setIsSpecialistModalOpen] = useState(false);
  const [specialistSearch, setSpecialistSearch] = useState('');

  useEffect(() => {
    const fetchStylists = async () => {
      try {
        const response = await api.get('/stylists');
        const data = Array.isArray(response.data) ? response.data : (response.data?.stylists || []);
        setStylists(data);
      } catch (error) {
        console.error("Error fetching stylists:", error);
      }
    };
    fetchStylists();
  }, []);

  const handleSpecialistChange = (specialistIdStr: string) => {
    if (!specialistIdStr) {
      updateActiveTab({ specialistId: '', specialistName: '' });
      setIsSpecialistModalOpen(false);
      setSpecialistSearch('');
      return;
    }
    const specialist = stylists.find(s => s.id.toString() === specialistIdStr.toString());
    updateActiveTab({
      specialistId: specialist ? specialist.id : '',
      specialistName: specialist ? specialist.name : ''
    });
    setIsSpecialistModalOpen(false);
    setSpecialistSearch('');
  };

  // Customer State
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const isAddCustomerModalOpen = searchParams.get('modal') === 'add-customer';
  const setIsAddCustomerModalOpen = (open: boolean) => {
    if (open) {
      searchParams.set('modal', 'add-customer');
    } else {
      searchParams.delete('modal');
    }
    setSearchParams(searchParams);
  };

  // New Customer State
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerCity, setNewCustomerCity] = useState('');
  const [newCustomerDOB, setNewCustomerDOB] = useState('');
  const [newCustomerAgeGroup, setNewCustomerAgeGroup] = useState('');
  const [newCustomerRole, setNewCustomerRole] = useState('CUSTOMER');
  const [newCustomerAttachments, setNewCustomerAttachments] = useState<Attachment[]>([]);
  const [acceptedTerms, setAcceptedTerms] = useState(true);
  const [termsError, setTermsError] = useState('');

  // Derived state to find the actual customer object
  const selectedCustomer = customers.find(c => c.id.toString() === selectedCustomerId);

  // Package Redemption State
  const [customerPackages, setCustomerPackages] = useState<any[]>([]);

  // Voucher & Discount State
  const [appliedVouchers, setAppliedVouchers] = useState<Voucher[]>([]);
  const [voucherError, setVoucherError] = useState('');
  const [cartVoucherCode, setCartVoucherCode] = useState('');
  const [voucherCode, setVoucherCode] = useState('');
  const [showVoucherCartInput, setShowVoucherCartInput] = useState(false);

  // Attachments State
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isAttachmentsModalOpen, setIsAttachmentsModalOpen] = useState(false);

  // OTP State
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [isVerifyingOTP, setIsVerifyingOTP] = useState(false);
  const [tempSaleData, setTempSaleData] = useState<any>(null);

  // QR & Payment State
  const [isQrLoading, setIsQrLoading] = useState(false);
  const [razorpayLinkData, setRazorpayLinkData] = useState<any>(null);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [printQueued, setPrintQueued] = useState(false);
  const printRequestedRef = React.useRef(false);

  // Checkout & Payment State
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<string>('');
  const [isResendingOTP, setIsResendingOTP] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [otpError, setOtpError] = useState('');
  const [isOTPModalOpen, setIsOTPModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'checkout' | 'completeOrder' } | null>(null);
  const [lastCompletedSale, setLastCompletedSale] = useState<any>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [pendingAutoCheckout, setPendingAutoCheckout] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);

  const fetchCustomerPackages = async (customerId: string) => {
    try {
      const response = await api.get(`/customers/${customerId}/packages/active`);
      const regularPackages = response.data || [];
      
      // Also fetch sales to include combo purchases for redemption
      const salesRes = await api.get(`/sales?customerId=${customerId}`);
      const sales: any[] = salesRes.data?.sales || salesRes.data || [];
      
      // Sort sales by date ASC for FIFO
      const sortedSales = [...sales].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      // Step A: Extract all combo purchases ("Supply")
      let comboPool: any[] = [];
      sortedSales
        .filter((s: any) => s.saleStatus !== 'CANCELLED')
        .forEach((s: any) => {
          (s.items || []).filter((item: any) => item.type === 'combo').forEach((item: any) => {
            // De-duplicate: If already in regularPackages, skip
            const isDup = regularPackages.some((rp: any) => 
              (rp.package?.name === item.name || rp.packageName === item.name) &&
              rp.purchaseDate?.split('T')[0] === s.createdAt?.split('T')[0]
            );
            if (isDup) return;

            const comboDef = rawCombos.find(c => c.name === item.name);
            comboPool.push({
              id: `combo-${s.id}-${item.itemId || item.name}`,
              isCombo: true,
              package: { 
                name: item.name,
                description: comboDef?.description
              },
              purchaseDate: s.createdAt,
              expiryDate: (() => {
                if (!comboDef || !comboDef.validityDays || comboDef.validityDays === 0) return null;
                const d = new Date(s.createdAt);
                d.setDate(d.getDate() + comboDef.validityDays);
                return d.toISOString();
              })(),
              usageDetails: comboDef?.items?.map(ci => ({
                name: ci.name,
                itemId: ci.name, // Use name as ID for matching
                totalQuantity: ci.quantity * item.quantity,
                remainingQuantity: ci.quantity * item.quantity // Initial
              })) || [],
              totalQuantity: item.quantity,
              remainingQuantity: item.quantity
            });
          });
        });

      // Step B: Extract all redemptions ("Demand")
      const redemptions = sortedSales
        .filter((s: any) => s.saleStatus !== 'CANCELLED')
        .flatMap((s: any) => (s.items || []).map((item: any) => ({ ...item, saleDate: s.createdAt })))
        .filter((item: any) => (item.price === 0 || item.redeemedQuantity > 0) && item.type !== 'combo');

      // Step C: Apply FIFO (Subtract demand from supply)
      redemptions.forEach(red => {
        const targetCombo = comboPool.find(c => 
          new Date(c.purchaseDate) <= new Date(red.saleDate) &&
          c.usageDetails.some((i: any) => i.name === red.name && i.remainingQuantity > 0)
        );

        if (targetCombo) {
          const comboItem = targetCombo.usageDetails.find((i: any) => i.name === red.name);
          if (comboItem) {
            const qtyToDeduct = red.quantity || 1;
            comboItem.remainingQuantity = Math.max(0, comboItem.remainingQuantity - qtyToDeduct);
          }
        }
      });

      // Step D: Filter out exhausted combos (for POS)
      const activeCombos = comboPool.filter(c => c.usageDetails.some((i: any) => i.remainingQuantity > 0));

      setCustomerPackages([...regularPackages, ...activeCombos]);
    } catch (err) {
      console.error("❌ Error fetching customer packages", err);
    }
  };

  useEffect(() => {
    // Reset voucher and discount states when customer changes
    setAppliedVouchers([]);
    setVoucherError('');
    setCartVoucherCode('');
    setVoucherCode('');
    setManualDiscount('');
    setShowVoucherCartInput(false);

    if (selectedCustomerId && selectedCustomerId !== 'WALK_IN') {
      fetchCustomerPackages(selectedCustomerId);
    } else {
      setCustomerPackages([]);
    }
  }, [selectedCustomerId]);

  // NEW: Recalculate cart items when customer packages change
  useEffect(() => {
    if (customerPackages.length > 0 && cart.length > 0) {
      setCart(prevCart => prevCart.map(cartItem => {
        // Skip if already redeemed
        if (cartItem.redeemedFromPackageId) {
          return cartItem;
        }

        // Find matching package item
        const matchingUsageItems = customerPackages.flatMap(pkg => {
          const items = pkg.usageDetails?.filter((u: any) =>
            (u.itemId === cartItem.itemId || u.name === cartItem.name) && u.remainingQuantity > 0
          ) || [];
          return items.map((u: any) => ({ ...u, packageId: pkg.id }));
        });

        if (matchingUsageItems.length > 0) {
          const usageItem = matchingUsageItems[0];

          return {
            ...cartItem,
            price: 0,
            redeemedFromPackageId: usageItem.packageId,
            redeemedItemId: usageItem.itemId || usageItem.name
          };
        }

        return cartItem;
      }));
    }
  }, [customerPackages]);

  // NEW: Clear applied vouchers if cart contains a voucher
  useEffect(() => {
    if (cart.some(item => item.type === 'voucher')) {
      setAppliedVouchers([]);
      setVoucherError('');
      setCartVoucherCode('');
      setShowVoucherCartInput(false);
    }
  }, [cart]);

  // Handle Appointment or Partial Sale Data Pre-filling from Navigation State
  useEffect(() => {
    if (location.state?.appointmentData) {
      const {
        appointmentId: id,
        customerId,
        customerName,
        items,
        depositAmount: deposit,
        stylistId,
        stylistName,
        autoCheckout
      } = location.state.appointmentData;

      // Prevent duplicate processing
      if (processedStateRef.current === `appt-${id}`) return;
      processedStateRef.current = `appt-${id}`;

      console.log("POS: Received appointmentData", location.state.appointmentData);

      const parsedItems = typeof items === 'string' ? JSON.parse(items) : items;
      const itemsArray = Array.isArray(parsedItems) ? parsedItems : [];

      const apptCart: CartItem[] = itemsArray.map((item: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        itemId: item.id || item.itemId,
        name: item.name,
        price: item.price || 0,
        type: item.type || 'service',
        quantity: item.quantity || 1
      }));

      const apptPatch: Partial<SalesTab> = {
        cart: apptCart,
        customerId: customerId ? customerId.toString() : '',
        customerName: customerName || '',
        specialistId: stylistId || '',
        specialistName: stylistName || '',
        depositAmount: deposit || 0,
        appointmentId: id || null,
        pendingSaleId: null,
        manualDiscount: '',
        customerSearchTerm: customerName || ''
      };

      if (activeOrderTab.cart.length === 0) {
        setSalesTabs(prev => prev.map(t => t.id === activeOrderTab.id ? { ...t, ...apptPatch } : t));
        setActiveSalesTabId(activeOrderTab.id);
      } else {
        const newTab = makeNewTab(salesTabs.length + 1);
        const filledTab = { ...newTab, ...apptPatch };
        setSalesTabs(prev => [...prev, filledTab]);
        setActiveSalesTabId(filledTab.id);
      }

      if (autoCheckout) {
        setPendingAutoCheckout(true);
      }
    }
    else if (location.state?.partialPaymentData) {
      const {
        customerId,
        customerName,
        items,
        paidAmount,
        saleId,
        saleNumber,
        autoCheckout
      } = location.state.partialPaymentData;

      // Prevent duplicate processing
      if (processedStateRef.current === `sale-${saleId}`) return;
      processedStateRef.current = `sale-${saleId}`;

      console.log("POS: Received partialPaymentData", location.state.partialPaymentData);

      const parsedItems = typeof items === 'string' ? JSON.parse(items) : items;
      const itemsArray = Array.isArray(parsedItems) ? parsedItems : [];

      const partialCart: CartItem[] = itemsArray.map((item: any) => {
        console.log("POS: Mapping item", item);
        return {
          id: Math.random().toString(36).substr(2, 9),
          itemId: item.itemId || item.id,
          name: item.name,
          price: item.price || 0,
          type: item.type || 'service',
          quantity: item.quantity || 1
        };
      });

      console.log("POS: Final partialCart count:", partialCart.length);

      const partialPatch: Partial<SalesTab> = {
        cart: partialCart,
        customerId: customerId ? customerId.toString() : '',
        customerName: customerName || '',
        depositAmount: paidAmount || 0,
        pendingSaleId: saleId || null,
        appointmentId: null,
        manualDiscount: location.state.partialPaymentData.discount?.toString() || '0',
        showManualDiscount: (parseFloat(location.state.partialPaymentData.discount?.toString() || '0')) > 0,
        customerSearchTerm: customerName || ''
      };

      if (activeOrderTab.cart.length === 0) {
        setSalesTabs(prev => prev.map(t => t.id === activeOrderTab.id ? { ...t, ...partialPatch } : t));
        setActiveSalesTabId(activeOrderTab.id);
      } else {
        const newTab = makeNewTab(salesTabs.length + 1);
        const filledTab = { ...newTab, ...partialPatch };
        setSalesTabs(prev => [...prev, filledTab]);
        setActiveSalesTabId(filledTab.id);
      }

      if (autoCheckout) {
        setPendingAutoCheckout(true);
      }

      showToast(`Resumed Sale ${saleNumber || ''} (Paid: ${formatPrice(paidAmount || 0)})`, 'info');
    }
  }, [location.state]);


  // Fetch data from Redux on mount
  useEffect(() => {
    dispatch(fetchServices());
    dispatch(fetchInventory());
    dispatch(fetchPackages());
    dispatch(fetchCustomers());
    dispatch(fetchSettings());
  }, [dispatch]);

  // Cart Calculations
  const subtotal = cart.reduce((acc, item) => {
    // If item has redeemedQuantity, only charge for the excess (non-redeemed) items
    const chargeableQty = item.redeemedQuantity ? (item.quantity - item.redeemedQuantity) : item.quantity;
    return acc + (item.price * chargeableQty);
  }, 0);
  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0); // Calculate total items
  const tax = 0;
  const cartTotal = subtotal;

  const handleTabChange = (tab: 'services' | 'products' | 'combos' | 'vouchers') => {
    setActiveTab(tab);
    setSelectedCategory('All');
    setSearchTerm(''); // Optional: Clear search term too for fresh start? User didn't ask but "All is active" implies reset.
    // User specifically asked for "All is active button", suggesting category reset. Keeping search term might be desired or not.
    // Safest is to just reset category as requested.
  };

  const manualDiscountValue = parseFloat(manualDiscount) || 0;

  // Use balance from the active claim for Voucher 2.0
  // Calculate total voucher deduction
  const voucherDeduction = appliedVouchers.reduce((sum, v) => {
    const claim = voucherClaims.find(c =>
      c.voucherCode === v.code &&
      c.customerId?.toString() === selectedCustomerId
    );
    return sum + (claim ? claim.balance : v.value);
  }, 0);

  // We need a smarter way to cap the deduction at cartTotal.
  // Actually, checking standard logic:
  const totalVoucherValue = appliedVouchers.reduce((sum, v) => {
    const claim = voucherClaims.find(c => c.voucherCode === v.code);
    return sum + (claim ? claim.balance : v.value);
  }, 0);

  const actualVoucherDeduction = Math.min(cartTotal - manualDiscountValue, totalVoucherValue);

  const totalDiscount = voucherDeduction + manualDiscountValue;
  // Calculate total before deposit deduction
  const grossTotal = Math.max(0, cartTotal - totalDiscount);
  // Final amount to pay (Balance)
  const finalTotal = Math.max(0, grossTotal - depositAmount);

  const addToCart = (item: any, type: 'service' | 'product' | 'combo' | 'voucher', redemptionInfo?: { packageId: string; itemId: string }) => {
    setCart(prev => {
      // If adding a redemption, allow multiple same items but separate entries? 
      // Or just standard logic. For simplicty, treat redemption as separate line item if price is 0
      const existing = prev.find(i => i.itemId === item.id && i.type === type && i.price === (redemptionInfo ? 0 : item.price));

      if (existing) {
        return prev.map(i => i.id === existing.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        id: Math.random().toString(36).substr(2, 9),
        itemId: item.id,
        name: item.name,
        price: redemptionInfo ? 0 : (type === 'voucher' ? item.sellingPrice : item.price), // Use sellingPrice for vouchers
        type,
        quantity: 1,
        // Store redemption metadata in the cart item (needs to be passed to backend)
        redeemedFromPackageId: redemptionInfo?.packageId,
        redeemedItemId: redemptionInfo?.itemId
      }];
    });
  };
  
  const updateItemSpecialist = (id: string, specialistId: string | number, specialistName: string) => {
    setCart(prev => prev.map(item =>
      item.id === id ? { ...item, specialistId, specialistName } : item
    ));
  };

  const updateQuantity = (id: string, delta: number) => {
    // 1. Find the item to determine if logic needs to be run
    const itemToUpdate = cart.find(i => i.id === id);
    if (!itemToUpdate) return;

    const newQty = Math.max(0, itemToUpdate.quantity + delta);

    // Handle removal
    if (newQty === 0) {
      setCart(prev => prev.filter(item => item.id !== id));
      return;
    }

    // 2. Determine if a toast is needed and what the new price should be
    let newPrice = itemToUpdate.price;
    let newRedeemedQty = itemToUpdate.redeemedQuantity;

    if (itemToUpdate.redeemedFromPackageId) {
      const pkg = customerPackages.find(p => p.id === itemToUpdate.redeemedFromPackageId);
      const usageItem = pkg?.usageDetails?.find((u: any) =>
        u.itemId === itemToUpdate.itemId || u.name === itemToUpdate.name
      );

      if (usageItem) {
        const maxAllowed = usageItem.remainingQuantity;
        const previousQty = itemToUpdate.quantity;

        if (newQty > maxAllowed) {
          const excessQty = newQty - maxAllowed;
          let unitPrice = 0;
          if (itemToUpdate.type === 'service') {
            unitPrice = services.find(s => s.id === itemToUpdate.itemId)?.price || 0;
          } else if (itemToUpdate.type === 'product') {
            unitPrice = products.find(p => p.id === itemToUpdate.itemId)?.price || 0;
          }

          newPrice = unitPrice;
          newRedeemedQty = maxAllowed;

          // Only show toast when CROSSING the threshold (previous was <= max, new is > max)
          if (delta > 0 && previousQty <= maxAllowed) {
            showToast(`✅ ${maxAllowed} redeemed(free), ${excessQty} at ${formatPrice(unitPrice)} each`, 'success');
          }
        } else {
          newPrice = 0;
          newRedeemedQty = undefined;
        }
      }
    }

    // 3. Update the state
    setCart(prev => prev.map(item =>
      item.id === id
        ? { ...item, quantity: newQty, price: newPrice, redeemedQuantity: newRedeemedQty }
        : item
    ));
  };

  const categories = useMemo(() => {
    if (activeTab === 'services') {
      return ['All', ...serviceCategories];
    }
    if (activeTab === 'products') {
      return ['All', ...productCategories];
    }
    return ['All'];
  }, [serviceCategories, productCategories, activeTab]);

  const filteredItems = activeTab === 'services'
    ? (services || []).filter(s => {
      if (!s || !s.name) return false;
      const matchesSearch = s.name.toLowerCase().includes((searchTerm || '').toLowerCase());
      const matchesActive = showInactive ? true : s.active;
      const matchesCategory = selectedCategory === 'All' || s.category === selectedCategory;
      return matchesSearch && matchesActive && matchesCategory;
    })
    : activeTab === 'products'
      ? (activeProducts || []).filter(p => {
        if (!p || !p.name) return false;
        const matchesSearch = p.name.toLowerCase().includes((searchTerm || '').toLowerCase());
        const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
        return matchesSearch && matchesCategory;
      })
      : activeTab === 'vouchers'
        ? (vouchers || []).filter(v => {
          if (!v) return false;
          // Filter out inactive vouchers
          if (v.status !== 'active' && v.status !== true && v.status !== 1) return false;
          const search = (searchTerm || '').toLowerCase();
          return (v.name && v.name.toLowerCase().includes(search)) || (v.code && v.code.toLowerCase().includes(search));
        })
        : (combos || []).filter(c => {
          if (!c || !c.name) return false;
          const matchesSearch = c.name.toLowerCase().includes((searchTerm || '').toLowerCase());
          const matchesActive = showInactive ? true : c.active;
          return matchesSearch && matchesActive;
        });

  // Customer Filter
  const filteredCustomers = Array.isArray(customers)
    ? customers.filter(c => {
      if (!c) return false;
      const search = (customerSearchTerm || '').toLowerCase();
      const nameMatch = c.name && c.name.toLowerCase().includes(search);
      const phoneMatch = c.phone && c.phone.includes(customerSearchTerm || '');
      return nameMatch || phoneMatch;
    })
    : [];

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomerId(customer.id.toString());
    setCustomerSearchTerm('');
    setIsCustomerDropdownOpen(false);

    // Only clear voucher if there are no redeemed package items in cart
    const hasRedeemedItems = cart.some(item => item.redeemedFromPackageId);
    if (!hasRedeemedItems) {
      setAppliedVouchers([]); // Clear vouchers logic
    }
  };

  const handleClearCustomer = () => {
    updateActiveTab({
      customerId: '',
      customerName: '',
      customerSearchTerm: '',
      depositAmount: 0,
      pendingSaleId: null,
      appointmentId: null
    });
    setAppliedVouchers([]);
    setVoucherError('');
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptedTerms) {
      setTermsError('You must agree to the Terms and Conditions');
      showToast('Please agree to the Terms and Conditions', 'error');
      return;
    }
    setTermsError('');

    if (!newCustomerName || !newCustomerPhone) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    try {
      setIsAddingCustomer(true);

      // Call backend API to create customer via Redux thunk
      const newCustomer = await dispatch(createCustomer({
        name: newCustomerName,
        phone: newCustomerPhone,
        email: newCustomerEmail,
        city: newCustomerCity,
        dateOfBirth: newCustomerDOB,
        ageGroup: newCustomerAgeGroup,
        role: newCustomerRole,
        attachments: newCustomerAttachments.map(a => ({
          ...a,
          imgUrl: a.url // Map url to imgUrl for backend compatibility
        }))
      })).unwrap();

      // Invalidate cache to ensure other screens (like Customers) fetch fresh data
      dispatch(invalidateCustomerCache());

      // Update local state with the new customer from backend
      setCustomers(prev => [...prev, {
        id: newCustomer.id,
        name: newCustomer.name,
        phone: newCustomer.phone || '',
        email: newCustomer.email || '',
        loyaltyPoints: 0,
        totalAppointments: 0,
        totalSpend: 0,
        lastVisit: new Date().toISOString().split('T')[0]
      }]);

      // Select the newly created customer
      setSelectedCustomerId(newCustomer.id.toString());

      // Close modal and reset form
      setIsAddCustomerModalOpen(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
      setNewCustomerEmail('');
      setNewCustomerCity('');
      setNewCustomerDOB('');
      setNewCustomerAgeGroup('');
      setNewCustomerRole('CUSTOMER');
      setNewCustomerAttachments([]);
      setAcceptedTerms(true);
      setTermsError('');

      showToast('Customer added successfully!', 'success');
    } catch (error: any) {
      console.error('Error creating customer:', error);
      // Try to extract the most descriptive error message possible
      const errorMessage = typeof error === 'string'
        ? error
        : (error.error || error.message || (error.response?.data?.error) || 'Failed to add customer');
      showToast(errorMessage, 'error');
    } finally {
      setIsAddingCustomer(false);
    }
  };

  // ---------------------------------------------------------
  // VOUCHER VALIDATION LOGIC
  // ---------------------------------------------------------
  const handleApplyVoucher = async (codeOverride?: string, skipClear = false) => {
    setVoucherError('');
    const code = codeOverride || voucherCode;
    if (!code) return false;

    // 1. Resolve Claim and Campaign
    // Prioritize claim for THIS customer
    let claim = voucherClaims.find(c =>
      c.voucherCode.toUpperCase() === code.toUpperCase() &&
      c.customerId?.toString() === selectedCustomerId
    );

    // If not found for this customer, look for ANY claim with this code (legacy or shared campaigns)
    if (!claim) {
      claim = voucherClaims.find(c => c.voucherCode.toUpperCase() === code.toUpperCase());
    }

    let campaign = vouchers.find(v =>
      v.code.toUpperCase() === code.toUpperCase() ||
      (claim && v.id === claim.voucherId)
    );

    if (!campaign) {
      setVoucherError('Invalid voucher code');
      return false;
    }

    // 1b. Check if voucher is active
    if (campaign.status !== 'active' && campaign.status !== true && campaign.status !== 1) {
      setVoucherError('This voucher is currently inactive');
      return false;
    }

    // 2. Check Expiry
    const effectiveExpiry = claim?.expiryDate || campaign.expiryDate;
    if (effectiveExpiry && new Date(effectiveExpiry) < new Date()) {
      setVoucherError(`Voucher expired on ${effectiveExpiry} `);
      return false;
    }

    // 3. Check Claim (Crucial: Is it claimed by THIS customer?)
    if (selectedCustomerId === '') {
      // Walk-in Customer Logic
      setVoucherError('Please select a customer to redeem vouchers (Walk-ins cannot redeem claimed codes).');
      return false;
    }

    // If we didn't find the claim by code, check if this customer already has a claim for this campaign
    if (!claim) {
      claim = voucherClaims.find(c =>
        c.voucherId === campaign!.id &&
        c.customerId.toString() === selectedCustomerId
      );
    }

    // AUTO-CLAIM LOGIC
    if (!claim) {
      try {
        const res = await api.post('/vouchers/issue', {
          voucherId: campaign.id,
          customerId: selectedCustomerId,
          customerName: selectedCustomer?.name || 'Unknown'
        });

        // Create a temporary claim object from response to use immediately
        claim = res.data;

        // Update local state so it shows up
        setVoucherClaims(prev => [...prev, claim!]);
        showToast('Voucher auto-claimed for customer!', 'success');

      } catch (error: any) {
        console.error("Voucher Claim Error:", error);
        setVoucherError(error.response?.data?.error || error.response?.data?.message || 'Failed to claim voucher');
        return false;
      }
    }

    if (claim.status === 'redeemed') {
      const usageHistory = Array.isArray(claim.usageHistory) ? claim.usageHistory : [];
      const lastUsage = usageHistory.length > 0 ? usageHistory[usageHistory.length - 1] : null;
      const redeemedDate = lastUsage?.date ? new Date(lastUsage.date).toLocaleDateString() : '';

      setVoucherError(`This voucher was already used${redeemedDate ? ' on ' + redeemedDate : ''}`);
      return false;
    }

    if (claim.balance <= 0) {
      setVoucherError(`This voucher has no remaining balance.`);
      return false;
    }

    // Valid!
    // Check if already applied (Compare by code which might be the unique claim code)
    const effectiveCode = claim ? claim.voucherCode : campaign.code;
    if (appliedVouchers.some(v => v.code === effectiveCode)) {
      // Toggle OFF: Remove if already applied
      removeVoucher(effectiveCode);
      return true; // Considered handled
    }

    // Apply the voucher - Use the effective code for display
    setAppliedVouchers(prev => [...prev, { ...campaign!, code: effectiveCode }]);

    if (!skipClear) {
      if (codeOverride) {
        setCartVoucherCode('');
      } else {
        setVoucherCode('');
      }
    }

    showToast(`Voucher applied! Balance: ${formatPrice(claim.balance)}`, 'success');
    return true;
  };

  const handleVoucherClick = (code: string) => {
    const currentCodes = cartVoucherCode ? cartVoucherCode.split(',').map(c => c.trim()).filter(Boolean) : [];
    if (currentCodes.includes(code)) {
      const newCodes = currentCodes.filter(c => c !== code);
      setCartVoucherCode(newCodes.join(', '));
    } else {
      const newCodes = [...currentCodes, code];
      setCartVoucherCode(newCodes.join(', '));
    }
    setVoucherError('');
  };

  const handleBulkApply = async () => {
    if (!cartVoucherCode) return;
    const codes = cartVoucherCode.split(',').map(c => c.trim()).filter(Boolean);

    if (codes.length === 0) return;

    // Process sequentially to avoid race conditions or UI jumping
    for (const code of codes) {
      await handleApplyVoucher(code, true);
    }
    setCartVoucherCode('');
  };

  const removeVoucher = (code: string) => {
    setAppliedVouchers(prev => prev.filter(v => v.code !== code));
    setVoucherError('');
  };

  // Payment & Voucher State
  const [paymentModal, setPaymentModal] = useState({ open: false, method: 'CASH', amount: 0, tendered: 0, processing: false });
  const [showPartialConfirmation, setShowPartialConfirmation] = useState(false);


  // Split Payment State
  const [isSplitPaymentMode, setIsSplitPaymentMode] = useState(false);
  const [splitPayments, setSplitPayments] = useState<{ id: string, method: string, amount: number }[]>([]);
  const [currentSplitMethod, setCurrentSplitMethod] = useState('CASH');
  const [currentSplitAmount, setCurrentSplitAmount] = useState<string>(''); // String to handle decimals better during typing

  // Sync payment modal amount with final total (which includes manual discounts, vouchers, and deposits)
  useEffect(() => {
    if (paymentModal.open) {
      setPaymentModal(prev => {
        const currentRefreshedTotal = finalTotal;
        return {
          ...prev,
          amount: currentRefreshedTotal,
          // If it's not cash, sync tendered too. If cash, only sync if tendered was already equal to amount (initial state)
          tendered: prev.method === 'CASH'
            ? (prev.tendered === prev.amount ? currentRefreshedTotal : prev.tendered)
            : currentRefreshedTotal
        };
      });
    }
  }, [finalTotal, paymentModal.open]);

  // Synchronize Amount Received (tendered) with split payments total
  useEffect(() => {
    if (isSplitPaymentMode) {
      const total = splitPayments.reduce((sum, p) => sum + p.amount, 0);
      setPaymentModal(prev => ({
        ...prev,
        tendered: total
      }));
    }
  }, [isSplitPaymentMode, splitPayments]);

  // Voucher handler for Payment Modal
  const handleVoucherApplyInModal = async () => {
    setVoucherError('');
    if (!voucherCode) return;

    // 1. Resolve Claim and Campaign
    let claim = voucherClaims.find(c => c.voucherCode.toUpperCase() === voucherCode.toUpperCase());
    let campaign = vouchers.find(v =>
      v.code.toUpperCase() === voucherCode.toUpperCase() ||
      (claim && v.id === claim.voucherId)
    );

    if (!campaign) {
      setVoucherError('Invalid voucher code');
      return;
    }

    // 1b. Check if voucher is active
    if (campaign.status !== 'active' && campaign.status !== true && campaign.status !== 1) {
      setVoucherError('This voucher is currently inactive');
      return;
    }

    // 2. Check Expiry
    const effectiveExpiry = claim?.expiryDate || campaign.expiryDate;
    if (effectiveExpiry && new Date(effectiveExpiry) < new Date()) {
      setVoucherError(`Voucher expired on ${effectiveExpiry} `);
      return;
    }

    // 3. Check Customer (Required for claiming)
    if (!selectedCustomerId || selectedCustomerId === '') {
      setVoucherError('Please select a customer to redeem vouchers.');
      return;
    }

    // If we didn't find the claim by code, check if this customer already has a claim for this campaign
    if (!claim) {
      claim = voucherClaims.find(c =>
        c.voucherId === campaign!.id &&
        c.customerId.toString() === selectedCustomerId
      );
    }

    // AUTO-CLAIM LOGIC
    if (!claim) {
      try {
        const res = await api.post('/vouchers/issue', {
          voucherId: campaign.id,
          customerId: selectedCustomerId,
          customerName: selectedCustomer?.name || 'Unknown'
        });

        // Create a temporary claim object from response to use immediately
        claim = res.data;

        // Update local state so it shows up
        setVoucherClaims(prev => [...prev, claim!]);
        showToast('Voucher auto-claimed for customer!', 'success');

      } catch (error: any) {
        console.error("Voucher Claim Error:", error);
        setVoucherError(error.response?.data?.error || error.response?.data?.message || 'Failed to claim voucher');
        return;
      }
    }

    if (claim.status === 'redeemed') {
      setVoucherError(`Already used on ${claim.redeemedAt} `);
      return;
    }

    if (claim.balance <= 0) {
      setVoucherError(`This voucher has no remaining balance.`);
      return;
    }

    // Check if already applied
    const effectiveCode = claim.voucherCode;
    if (appliedVouchers.some(v => v.code === effectiveCode)) {
      setVoucherError('Voucher already applied');
      return;
    }

    // Valid! Apply and update modal amount
    setAppliedVouchers(prev => [...prev, { ...campaign!, code: effectiveCode }]);
    setVoucherCode('');

    // Recalculate amount for modal
    const deduction = Math.min(claim.balance, cartTotal); // Simple deduction for toast, actual total uses gross logic
    const newTotal = Math.max(0, cartTotal - (totalDiscount + deduction)); // This is subtle because totalDiscount depends on appliedVouchers
    // Actually, setPaymentModal should use finalTotal which is already calculated reactively
    // But we need to force update if it's not reactive enough or if it's used for tendered

    showToast(`Voucher applied! - ${formatPrice(deduction)} `, 'success');
  };


  const handleRequestOTP = async () => {
    if (!selectedCustomerId || selectedCustomerId === 'WALK_IN') {
      console.log('Skipping OTP: No customer or WALK_IN');
      return;
    }

    try {
      console.log('Starting OTP Request for customer:', selectedCustomerId);
      setOtpError('');
      setIsVerifyingOTP(true);
      setIsResendingOTP(true);

      const response = await api.post(`/customers/${selectedCustomerId}/request-otp`, {
        type: appliedVouchers.length > 0 ? 'voucher_redemption' : 'otp_verification'
      });
      console.log('OTP Request Success:', response.data);

      setIsOTPModalOpen(true);
      showToast("Verification code sent to customer's WhatsApp!", 'success');
    } catch (error: any) {
      console.error('OTP Request Error:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Failed to send OTP';
      showToast(errorMsg, 'error');
    } finally {
      setIsVerifyingOTP(false);
      setIsResendingOTP(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otpValue || (otpValue.length !== 6 && otpValue.length !== 4)) {
      setOtpError('Please enter valid 4 or 6-digit code');
      return;
    }

    try {
      console.log('Verifying OTP:', otpValue, 'for customer:', selectedCustomerId);
      setOtpError('');
      setIsVerifyingOTP(true);
      await api.post(`/customers/${selectedCustomerId}/verify-otp`, { otp: otpValue });
      console.log('OTP Verification Success');

      setIsOTPModalOpen(false);
      setOtpValue('');
      showToast('OTP verified!', 'success');

      // Proceed with the pending action
      if (pendingAction) {
        if (pendingAction.type === 'completeOrder') {
          await executeCompleteOrder();
        } else if (pendingAction.type === 'checkout') {
          await executeCheckout();
        }
        setPendingAction(null);
      }
    } catch (error: any) {
      console.error('OTP Verification Error:', error);
      setOtpError(error.response?.data?.error || 'Invalid OTP code');
    } finally {
      setIsVerifyingOTP(false);
    }
  };

  const executeCheckout = async (forcedAmount?: number) => {
    // Open payment modal
    setSplitPayments([]);
    setIsSplitPaymentMode(false);
    
    const checkoutAmount = forcedAmount !== undefined ? forcedAmount : finalTotal;
    
    setCurrentSplitAmount(checkoutAmount.toString());
    setCurrentSplitMethod('CASH');

    setPaymentModal({
      open: true,
      method: 'CASH',
      amount: checkoutAmount,
      tendered: checkoutAmount, // Default tendered to exact amount
      processing: false
    });
  };

  const handleCheckout = async () => {
    // Intercept with OTP if total is 0 (fully redeemed) OR multiple vouchers used
    const shouldVerifyOTP = (salonSettings?.enableVoucherOtp !== false) &&
      (finalTotal === 0 || appliedVouchers.length > 1) &&
      selectedCustomerId &&
      selectedCustomerId !== 'WALK_IN';

    if (shouldVerifyOTP) {
      setIsSummaryModalOpen(false);
      setPendingAction({ type: 'checkout' });
      await handleRequestOTP();
      return;
    }

    setIsSummaryModalOpen(false);

    let forcedTotal: number | undefined = undefined;

    // Final source-of-truth check for negotiated discounts
    // If we have a pending auto-checkout from a negotiated sale, ensure we use the negotiated discount
    if (location.state?.partialPaymentData?.discount !== undefined && pendingAutoCheckout) {
      const negotiatedDiscount = parseFloat(location.state.partialPaymentData.discount.toString()) || 0;
      if (negotiatedDiscount > 0) {
        console.log(`POS: Locking in negotiated discount: ${negotiatedDiscount}`);
        setManualDiscount(negotiatedDiscount.toString());
        setShowManualDiscount(true);
        
        // Calculate forced total immediately to avoid waiting for next render
        forcedTotal = Math.max(0, subtotal - negotiatedDiscount - depositAmount);
      }
    }

    await executeCheckout(forcedTotal);
  };

  const executeCompleteOrder = async () => {
    try {
      setIsProcessingOrder(true);
      // Ensure payment values are reset to 0 for free orders
      setPaymentModal(prev => ({
        ...prev,
        amount: 0,
        tendered: 0,
        method: 'CASH',
        processing: true
      }));

      // Process directly without payment modal
      const sale = await processDirectPayment();

      setIsSummaryModalOpen(false);

      // Show success modal
      const invoiceNumber = sale?.invoices?.[0]?.invoiceNumber || sale?.saleNumber || sale?.id;
      setSuccessMessage(`Order completed successfully! All items redeemed from package.\nInvoice #${invoiceNumber}`);
      setLastCompletedSale(sale);
      setShowSuccessModal(true);
    } catch (error: any) {
      console.error('Complete order error:', error);
      showToast(error.response?.data?.error || 'Failed to complete order', 'error');
      setPaymentModal(prev => ({ ...prev, processing: false }));
    } finally {
      setIsProcessingOrder(false);
    }
  };

  // Handle complete order for free (fully redeemed) orders
  const handleCompleteOrder = async () => {
    // Intercept with OTP if total is 0 (fully redeemed) OR multiple vouchers used
    const shouldVerifyOTP = (salonSettings?.enableVoucherOtp !== false) &&
      (finalTotal === 0 || appliedVouchers.length > 1) &&
      selectedCustomerId !== 'WALK_IN';

    if (shouldVerifyOTP) {
      setIsSummaryModalOpen(false);
      setPendingAction({ type: 'completeOrder' });
      await handleRequestOTP();
      return;
    }

    await executeCompleteOrder();
  };

  const handleCheckoutClick = () => {
    if (cart.length === 0) {
      showToast('Cart is empty!', 'error');
      return;
    }

    if (!selectedCustomerId) {
      showToast('Please select a customer first!', 'error');
      return;
    }

    setIsSummaryModalOpen(true);
  };

  // Trigger checkout/complete order once cart and customer are ready
  useEffect(() => {
    // Only trigger if we have everything and the subtotal has been calculated (not 0)
    if (pendingAutoCheckout && cart.length > 0 && selectedCustomerId && subtotal > 0) {
      // Small delay to ensure all reactive calculations (discounts, packages, finalTotal) are settled
      const timer = setTimeout(() => {
        // Double check values right before firing
        if (pendingAutoCheckout) {
          console.log(`POS: Auto-checkout triggering with Total: ${finalTotal}, Discount: ${totalDiscount}`);
          setPendingAutoCheckout(false);
          if (finalTotal === 0) {
            handleCompleteOrder();
          } else {
            handleCheckout();
          }
        }
      }, 800); // Increased delay slightly for stability
      return () => clearTimeout(timer);
    }
  }, [cart.length, pendingAutoCheckout, selectedCustomerId, finalTotal, subtotal]);


  // Helper for Split Payments
  const handleAddSplitPayment = () => {
    const amount = parseFloat(currentSplitAmount);
    if (isNaN(amount) || amount <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }

    const currentTotal = splitPayments.reduce((sum, p) => sum + p.amount, 0);
    const floatBuffer = 0.05; // Flexible buffer
    const remaining = finalTotal - currentTotal;

    if (amount > remaining + floatBuffer) {
      showToast(`Amount exceeds remaining balance of ${formatPrice(remaining)}`, 'error');
      return;
    }

    // Check if method already exists
    const existingPaymentIndex = splitPayments.findIndex(p => p.method === currentSplitMethod);

    if (existingPaymentIndex >= 0) {
      // Update existing payment
      const updatedPayments = [...splitPayments];
      updatedPayments[existingPaymentIndex] = {
        ...updatedPayments[existingPaymentIndex],
        amount: updatedPayments[existingPaymentIndex].amount + amount
      };
      setSplitPayments(updatedPayments);
    } else {
      // Add new payment
      const newPayment = { id: Date.now().toString(), method: currentSplitMethod, amount };
      setSplitPayments([...splitPayments, newPayment]);
    }

    // Auto-set next amount to remaining
    const newRemaining = Math.max(0, finalTotal - (currentTotal + amount));
    setCurrentSplitAmount(newRemaining > 0 ? newRemaining.toString() : '');
  };

  const handleRemoveSplitPayment = (id: string) => {
    const paymentToRemove = splitPayments.find(p => p.id === id);
    if (!paymentToRemove) return;

    const newSplitPayments = splitPayments.filter(p => p.id !== id);
    setSplitPayments(newSplitPayments);

    // Recalculate remaining to update input
    const currentTotal = newSplitPayments.reduce((sum, p) => sum + p.amount, 0);
    const newRemaining = Math.max(0, finalTotal - currentTotal);
    setCurrentSplitAmount(newRemaining.toString());
  };

  const handlePaymentClick = (shouldPrint = false) => {
    if (paymentModal.method === 'CASH' && paymentModal.tendered < paymentModal.amount) {
      setShowPartialConfirmation(true);
    } else {
      processPayment();
    }
  };

  const processPayment = async () => {
    setPaymentModal(prev => ({ ...prev, processing: true }));

    try {
      let sale;
      // If amount is 0 (full redemption), process directly regardless of method
      if (paymentModal.amount <= 0 || paymentModal.method === 'RAZORPAY' && paymentModal.amount === 0) {
        sale = await processDirectPayment();
      }
      else if (paymentModal.method === 'RAZORPAY') {
        sale = await processRazorpayPayment(); // Razorpay print handling might be separate, or add shouldPrint logic there too
      } else {
        sale = await processDirectPayment();
      }

      if (sale) {
        const invoiceNumber = sale.invoices?.[0]?.invoiceNumber;
        const displayId = invoiceNumber || sale.invoiceNumber || sale.saleNumber || sale.id; // Prefer invoice number
        setSuccessMessage(`Order completed successfully!\nInvoice #${displayId}`);
        setLastCompletedSale(sale);
        clearSalesSession(); // Clear persisted cart after successful sale
        setShowSuccessModal(true);
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      showToast(error.message || 'Payment failed', 'error');
      setPaymentModal(prev => ({ ...prev, processing: false }));
    }
  };

  const processDirectPayment = async () => {
    try {
      // Calculate actual total and paid amounts to determine status
      // Calculate actual total and paid amounts to determine status
      const actualTotal = Math.max(0, subtotal - (totalDiscount || 0));

      let currentPaid = 0;
      let finalPayments = [];

      if (isSplitPaymentMode && splitPayments.length > 0) {
        currentPaid = splitPayments.reduce((sum, p) => sum + p.amount, 0);
        finalPayments = splitPayments.map(p => ({
          amount: p.amount,
          paymentMethod: p.method,
          paymentStatus: 'COMPLETED',
          transactionId: `POS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }));
      } else {
        // Single Payment Mode
        // For CASH, amount is Total Due, tendered is what they pay. 
        // If Partial: tendered < amount. Payment = tendered.
        // If Change: tendered > amount. Payment = amount.
        // For NON-CASH: amount and tendered are synced.
        const paymentValue = Math.min(paymentModal.tendered, paymentModal.amount);
        currentPaid = paymentValue;

        // If full redemption (amount 0), we might have no payment, or a dummy one?
        // If amount > 0, we have a payment.
        // FIX: Ensure we create a payment record for VOUCHER transactions so they appear correctly
        // with the cashier name and method.
        if (paymentValue > 0 || finalTotal === 0) {
          finalPayments.push({
            amount: paymentValue,
            paymentMethod: (finalTotal === 0 && appliedVouchers.length > 0) ? 'VOUCHER' : paymentModal.method,
            paymentStatus: 'COMPLETED', // Will be updated below if partial
            transactionId: `POS-${Date.now()}`
          });
        }
      }

      const totalPaid = depositAmount + currentPaid;
      const isPaid = totalPaid >= actualTotal - 0.5; // Small buffer for float issues
      const status = isPaid ? 'COMPLETED' : 'PARTIAL';

      // Update status for all payments if partial? 
      // Actually, individual payments are "COMPLETED" (money received), but the SALE status is PARTIAL.
      // So keeping paymentStatus as COMPLETED for the money received is correct.

      // CHECK: Are we adding payment to an EXISTING sale?
      if (pendingSaleId) {
        let lastResponse;
        if (finalPayments.length > 0) {
          for (const payment of finalPayments) {
            lastResponse = await api.post(`/sales/${pendingSaleId}/payments`, {
              amount: payment.amount,
              paymentMethod: payment.paymentMethod,
              transactionId: payment.transactionId,
              notes: paymentModal.notes,
            });
          }
        }

        showToast(`Payments added to Sale #${pendingSaleId}`, 'success');
        if (selectedCustomerId) {
          await fetchCustomerPackages(selectedCustomerId);
        }
        clearCart();
        setPaymentModal({ ...paymentModal, open: false, processing: false });
        setShowPartialConfirmation(false);
        // Return the updated sale object from response
        return lastResponse?.data?.sale;
      }

      // 1. Prepare sale data
      const saleData = {
        items: cart.map(item => ({
          itemId: item.itemId,
          type: item.type,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          // SUCCESSFUL FIX: Strip 'combo-' prefix as per Senior Dev Integration Guide
          redeemedFromPackageId: item.redeemedFromPackageId?.startsWith('combo-') 
            ? item.redeemedFromPackageId.split('-')[1] 
            : item.redeemedFromPackageId,
          redeemedItemId: item.redeemedItemId,
          redeemedQuantity: item.redeemedQuantity,
          specialistId: item.specialistId || selectedSpecialistId || undefined,
          specialistName: item.specialistName || selectedSpecialistName || undefined
        })),
        customerId: selectedCustomerId === 'WALK_IN' ? null : (selectedCustomerId || null),
        specialistId: (selectedSpecialistId && selectedSpecialistId !== 'none' ? String(selectedSpecialistId) : null),
        customerName: selectedCustomerId === 'WALK_IN' ? 'Walk-in Customer' : (selectedCustomer?.name || customerSearchTerm || 'Customer'), // Pass accurate customer name from DB
        subtotal: subtotal,
        tax: 0, // No tax
        discount: totalDiscount,
        totalAmount: actualTotal, // Correct total amount (not just what is being paid now)
        paymentMethod: finalPayments.length > 0
          ? (isSplitPaymentMode ? 'SPLIT' : finalPayments[0].paymentMethod)
          : (appliedVouchers.length > 0 ? 'VOUCHER' : 'CASH'),
        paymentStatus: status,
        voucherCode: null, // Legacy
        voucherDiscount: actualVoucherDeduction,
        vouchers: (() => {
          let remainingForVouchers = subtotal - (totalDiscount || 0) + (voucherDeduction || 0);
          return appliedVouchers.map(v => {
            const claim = voucherClaims.find(c => c.voucherCode === v.code);
            const balance = claim ? claim.balance : v.value;
            const amountToRedeem = Math.min(balance, remainingForVouchers);
            remainingForVouchers = Math.max(0, remainingForVouchers - amountToRedeem);
            return { code: v.code, amount: amountToRedeem };
          }).filter(v => v.amount > 0);
        })(),
        appointmentId: appointmentId,
        notes: `Sale created from POS.${paymentModal.notes || ''} `,
        createdBy: user?.name || 'Admin',
        // Fallback to user.id because backend UserController returns authId in the `id` field for the user profile
        authId: user?.authId || user?.id,
        attachments: attachments, // Add attachments to saleData

        payments: finalPayments
      };


      // 2. Create sale via backend API
      const response = await api.post('/sales', saleData);
      const sale = response.data.sale;

      // 3. Update vouchers from response
      if (response.data.vouchers && response.data.vouchers.length > 0) {
        setVoucherClaims(prev => {
          const newClaims = [...prev];
          response.data.vouchers.forEach((v: any) => {
            const index = newClaims.findIndex(c => c.id === v.claim.id);
            if (index >= 0) {
              newClaims[index] = {
                ...newClaims[index],
                balance: v.claim.balance,
                status: v.claim.status
              };
            } else {
              newClaims.push(v.claim);
            }
          });
          return newClaims;
        });

        setVouchers(prev => prev.map(v =>
          appliedVouchers.some(av => av.id === v.id)
            ? { ...v, redeemedQty: (v.redeemedQty || 0) + 1 }
            : v
        ));
      }

      // 4. If any vouchers were SOLD, fetch the new claims for the customer
      const hasSoldVoucher = cart.some(item => item.type === 'voucher');
      if (hasSoldVoucher) {
        try {
          const claimsRes = await api.get('/vouchers/claims');
          if (claimsRes.data) {
            setVoucherClaims(claimsRes.data);
          }
        } catch (err) {
          console.error('Failed to refresh voucher claims:', err);
        }
      }

      // PRINT RECEIPT LOGIC
      if (printRequestedRef.current && sale) {
        // Reset ref and state
        printRequestedRef.current = false;
        setPrintQueued(false);

        const rawInvoice = sale.invoices?.[0]?.invoiceNumber || sale.invoiceNumber || sale.saleNumber || 'N/A';
        const invoiceNum = rawInvoice.replace(/^SALE-/, '');
        const invoiceDisplayId = invoiceNum; // Use invoiceNum for display

        const receiptData = {
          storeName: salonSettings?.salonName || user?.businessName || 'Salon POS',
          storeAddress: salonSettings?.salonAddress || user?.businessAddress || 'City Center',
          storePhone: salonSettings?.salonPhone || user?.businessPhone || '9876543210',
          invoiceNumber: invoiceDisplayId,
          date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString(),
          customerName: selectedCustomer?.name || 'Walk-in Customer',
          items: cart.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price
          })),
          subtotal: subtotal,
          discount: totalDiscount,
          total: actualTotal,
          paymentMethod: paymentModal.method,
          cashierName: user?.name || 'Admin',
          currencySymbol: symbol
        };

        const html = generateReceiptHtml(receiptData);
        const printWindow = window.open('', '_blank', 'width=400,height=600');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          // Auto print handled by body onload in generator
        }
      }

      showToast(`Sale completed! Invoice #${sale.invoices?.[0]?.invoiceNumber || sale.saleNumber}`, 'success');


      // Explicitly re-fetch packages before clearing customer ID to ensure state sync
      if (selectedCustomerId) {
        await fetchCustomerPackages(selectedCustomerId);
      }

      // Clear cart and state
      clearCart();
      setPaymentModal({ ...paymentModal, open: false, processing: false });
      setShowPartialConfirmation(false);

      // Refresh inventory stock levels and payment cache
      dispatch(invalidateInventoryCache());
      dispatch(fetchInventory());
      dispatch(fetchInventoryHistory());
      dispatch(invalidatePaymentCache());
      dispatch(invalidateCustomerCache());
      dispatch(fetchCustomers());
      // setVoucherCode(''); // Already cleared
      // setAppliedVouchers([]); // Already cleared

      return sale;
    } catch (error: any) {
      console.error('Process Direct Payment Error:', error);
      throw error;
    }
  };

  const processRazorpayPayment = async () => {
    try {
      // 1. Create sale first with PENDING status
      // Recalculate values to ensure consistency with backend validation
      const calculatedItems = cart.map(item => ({
        itemId: item.itemId,
        type: item.type,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        // SUCCESSFUL FIX: Strip 'combo-' prefix as per Senior Dev Integration Guide
        redeemedFromPackageId: item.redeemedFromPackageId?.startsWith('combo-') 
          ? item.redeemedFromPackageId.split('-')[1] 
          : item.redeemedFromPackageId,
        redeemedItemId: item.redeemedItemId,
        redeemedQuantity: item.redeemedQuantity,
        specialistId: item.specialistId || selectedSpecialistId || undefined,
        specialistName: item.specialistName || selectedSpecialistName || undefined
      }));

      const calculatedSubtotal = calculatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const calculatedTax = 0;
      const calculatedTotal = Math.max(0, calculatedSubtotal - (voucherDeduction + manualDiscountValue || 0));
      const finalPayableAmount = Math.max(0, calculatedTotal - depositAmount);

      // 1. Create sale first with PENDING status
      const saleData = {
        customerId: selectedCustomerId || null,
        specialistId: (selectedSpecialistId && selectedSpecialistId !== 'none' ? String(selectedSpecialistId) : null),
        appointmentId: appointmentId, // Link to appointment
        items: calculatedItems,
        subtotal: calculatedSubtotal,
        tax: 0, // No tax
        discount: voucherDeduction + manualDiscountValue,
        totalAmount: calculatedTotal,
        paymentMethod: 'RAZORPAY', // Correct backend enum
        paymentStatus: 'PENDING',
        voucherCode: null,
        voucherDiscount: actualVoucherDeduction,
        vouchers: (() => {
          let remainingForVouchers = subtotal - (totalDiscount || 0) + (voucherDeduction || 0);
          return appliedVouchers.map(v => {
            const claim = voucherClaims.find(c => c.voucherCode === v.code);
            const balance = claim ? claim.balance : v.value;
            const amountToRedeem = Math.min(balance, remainingForVouchers);
            remainingForVouchers = Math.max(0, remainingForVouchers - amountToRedeem);
            return { code: v.code, amount: amountToRedeem };
          }).filter(v => v.amount > 0);
        })(),
        createdBy: user?.id || user?.email || 'system',
        customerName: customerSearchTerm || null, // Pass customer name for validation
        attachments: attachments, // Add attachments to saleData
        // Include payments logic for Deposit if applicable (though Razorpay flow adds payment later)
        // However, the initial sale creation should arguably include the deposit info if strict validation exists.
        // But backend calculates 'paidAmount' from 'payments'. 
        // Deposit handled by backend auto-linking
        payments: []
      };

      const saleResponse = await api.post('/sales', saleData);
      const sale = saleResponse.data.sale; // Correctly extract the sale object

      // 2. Create Razorpay order
      const orderResponse = await api.post('/payments/razorpay/create-order', {
        amount: finalPayableAmount, // Use the validated total minus deposit
        currency: currency,
        receipt: `sale_${sale.id} `,
        notes: {
          saleId: sale.id,
          customerId: selectedCustomerId || 'walk-in'
        }
      });

      const order = orderResponse.data.order; // Axios response data structure

      // 3. Open Razorpay checkout
      const options = {
        key: order.keyId || (import.meta as any).env.VITE_RAZORPAY_KEY_ID, // Use key from backend response
        amount: order.amount,
        currency: order.currency,
        order_id: order.id,
        name: "Salon Payment",
        description: `Sale #${sale.id} `,
        handler: async (response: any) => {
          // 4. Verify payment
          try {
            const verifyResponse = await api.post('/payments/razorpay/verify', {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              amount: Number(paymentModal.amount), // Ensure number
              saleId: sale.id,
              appointmentId: appointmentId, // Pass appointmentId
              // Pass deposit info again? Usually verify endpoint just records the razorpay transaction.
              // The sale should already have the deposit recorded from creation step.
            });
            // handlePaymentSuccess(verifyResponse.data); // Removed to fix ReferenceError

            // 5. Update vouchers from response if any were returned in verify or sale
            // The Senior Developer stated that the createSale POST /sales returns the updated vouchers.
            // We apply it here after verification to ensure we only update local state upon success.
            if (saleResponse.data?.vouchers && saleResponse.data.vouchers.length > 0) {
              setVoucherClaims(prev => {
                const newClaims = [...prev];
                saleResponse.data.vouchers.forEach((v: any) => {
                  const index = newClaims.findIndex(c => c.id === v.claim.id);
                  if (index >= 0) {
                    newClaims[index] = {
                      ...newClaims[index],
                      balance: v.claim.balance,
                      status: v.claim.status
                    };
                  } else {
                    newClaims.push(v.claim);
                  }
                });
                return newClaims;
              });

              setVouchers(prev => prev.map(v =>
                appliedVouchers.some(av => av.id === v.id)
                  ? { ...v, redeemedQty: (v.redeemedQty || 0) + 1 }
                  : v
              ));
            }

            // 6. Success
            showToast(`Payment successful for ${customerSearchTerm || 'Customer'}!`, 'success');


            // Explicitly re-fetch packages
            if (selectedCustomerId) {
              await fetchCustomerPackages(selectedCustomerId);
            }

            clearCart();
            setPaymentModal({ ...paymentModal, open: false, processing: false });

            // Refresh inventory stock levels and payment cache
            dispatch(invalidateInventoryCache());
            dispatch(fetchInventory());
            dispatch(fetchInventoryHistory());
            dispatch(invalidatePaymentCache());
            dispatch(invalidateCustomerCache());
            dispatch(fetchCustomers());

          } catch (error: any) {
            console.error('Verification failed:', error);
            showToast('Payment verification failed', 'error');
            setPaymentModal(prev => ({ ...prev, processing: false }));
          }
        },
        modal: {
          ondismiss: () => {
            setPaymentModal(prev => ({ ...prev, processing: false }));
            showToast('Payment cancelled', 'info');
          }
        }
      };

      const razorpay = new (window as any).Razorpay(options);
      razorpay.open();

    } catch (error: any) {
      console.error('Razorpay Error', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      throw error;
    }
  };

  const generateRazorpayQR = async () => {
    try {
      setIsQrLoading(true);

      const calculatedItems = cart.map(item => ({
        itemId: item.itemId,
        type: item.type,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        // SUCCESSFUL FIX: Strip 'combo-' prefix as per Senior Dev Integration Guide
        redeemedFromPackageId: item.redeemedFromPackageId?.startsWith('combo-') 
          ? item.redeemedFromPackageId.split('-')[1] 
          : item.redeemedFromPackageId,
        redeemedItemId: item.redeemedItemId,
        redeemedQuantity: item.redeemedQuantity
      }));

      const calculatedSubtotal = calculatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const calculatedTotal = Math.max(0, calculatedSubtotal - (voucherDeduction + manualDiscountValue || 0));
      const finalPayableAmount = Math.max(0, calculatedTotal - depositAmount);

      // 1. Create sale first with PENDING status (same as standard Razorpay flow)
      const saleData = {
        customerId: selectedCustomerId || null,
        specialistId: (selectedSpecialistId && selectedSpecialistId !== 'none' ? String(selectedSpecialistId) : null),
        appointmentId: appointmentId,
        items: calculatedItems,
        subtotal: calculatedSubtotal,
        tax: 0,
        discount: voucherDeduction + manualDiscountValue,
        totalAmount: calculatedTotal,
        paymentMethod: 'RAZORPAY',
        paymentStatus: 'PENDING',
        voucherCode: appliedVouchers[0]?.code || null,
        createdBy: user?.id || user?.email || 'system',
        customerName: customerSearchTerm || null,
        attachments: attachments,
        payments: []
      };

      const saleResponse = await api.post('/sales', saleData);
      const sale = saleResponse.data.sale;
      setPendingSaleId(sale.id);

      // 2. Create Payment Link
      const response = await api.post('/payments/razorpay/payment-link', {
        amount: finalPayableAmount,
        notes: {
          saleId: sale.id, // Important for tracking
          customerId: selectedCustomerId || 'walk-in',
          customerName: selectedCustomer?.name || 'Walk-in Customer',
          description: `Sale #${sale.saleNumber || sale.id} Payment`,
          appointmentId: appointmentId
        }
      });

      if (response.data.success) {
        setRazorpayLinkData(response.data.paymentLink);
        setIsQRModalOpen(true);
        showToast('QR Code generated successfully!', 'success');
      } else {
        showToast(response.data.error || 'Failed to generate QR', 'error');
      }
    } catch (error: any) {
      console.error('QR Generation Error:', error);
      showToast(error.message || 'Error generating QR', 'error');
    } finally {
      setIsQrLoading(false);
    }
  };

  const clearCart = () => {
    setCart([]);
    setIsCheckoutOpen(false);
    setSelectedPayment('');
    setAppliedVouchers([]);
    setVoucherCode('');
    setAppointmentId(null); // Clear appointment ID
    setDepositAmount(0); // Clear deposit amount
    setSelectedCustomerId(''); // Clear selected customer
    setCustomerSearchTerm(''); // Clear customer search
    setManualDiscount(''); // Clear manual discount
    setAttachments([]); // Clear attachments
    setSelectedSpecialistId(''); // Reset specialist selection
    setSelectedSpecialistName(''); // Reset specialist name
  };


  const openCheckout = () => {
    setVoucherCode('');
    setVoucherError('');
    setAppliedVouchers([]);

    setIsCheckoutOpen(true);
  }


  return (
    <div style={{
      height: 'calc(100vh - 5rem)',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      position: 'relative'
    }}>

      {/* ─── ORDER TABS (HEADER AREA) via Portal ────────────────────────── */}
      {document.getElementById('header-slot') && createPortal(
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.35rem',
          overflowX: 'auto', paddingBottom: '0.1rem', flexShrink: 0
        }}>
          {salesTabs.map((tab) => {
            const isActive = tab.id === activeOrderTab.id;
            const tabLabel = tab.customerName ? tab.customerName.split(' ')[0] : tab.label;
            return (
              <div
                key={tab.id}
                onClick={() => setActiveSalesTabId(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '0.625rem',
                  cursor: 'pointer',
                  background: isActive ? 'var(--primary)' : 'var(--bg-card)',
                  color: isActive ? '#fff' : 'var(--text-black)',
                  border: isActive ? '1.5px solid var(--primary)' : '1.5px solid var(--border)',
                  fontWeight: 600, fontSize: '0.82rem',
                  whiteSpace: 'nowrap', flexShrink: 0,
                  boxShadow: isActive ? '0 4px 12px rgba(35,76,106,0.25)' : 'none',
                  transition: 'all 0.2s ease',
                  userSelect: 'none'
                }}
              >
                <span style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tabLabel}</span>
                {tab.cart.length > 0 && (
                  <span style={{
                    background: isActive ? 'rgba(255,255,255,0.3)' : 'var(--primary)',
                    color: '#fff',
                    borderRadius: '999px', fontSize: '0.7rem',
                    padding: '0.05rem 0.4rem', fontWeight: 700, lineHeight: 1.5
                  }}>{tab.cart.reduce((s, i) => s + i.quantity, 0)}</span>
                )}
                {salesTabs.length > 1 && (
                  <span
                    onClick={(e) => { e.stopPropagation(); closeSalesTab(tab.id); }}
                    style={{
                      cursor: 'pointer', lineHeight: 1, fontSize: '0.75rem',
                      opacity: 0.7, marginLeft: '0.1rem',
                      padding: '0.05rem 0.2rem', borderRadius: '3px'
                    }}
                    title="Close tab"
                  >✕</span>
                )}
              </div>
            );
          })}
          {/* Add new tab */}
          <button
            onClick={addSalesTab}
            title="New order"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '2.1rem', height: '2.1rem', flexShrink: 0,
              borderRadius: '0.5rem', border: '1.5px dashed var(--border)',
              background: 'transparent', color: 'var(--text-black)',
              cursor: 'pointer', fontSize: '1.1rem', fontWeight: 700,
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-black)'; }}
          >+</button>

          {/* SERVICE SEGMENT TOGGLE */}
          {appId.startsWith('workly-service') && (
            <div style={{ marginLeft: '1rem', borderLeft: '1px solid var(--border)', paddingLeft: '1rem', display: 'flex', alignItems: 'center' }}>
              <Switch 
                isOn={isQuotationMode}
                onToggle={() => setIsQuotationMode(!isQuotationMode)}
                activeLabel="Quotes & Invoices"
                inactiveLabel="Normal Sales"
              />
            </div>
          )}
        </div>,
        document.getElementById('header-slot')!
      )}

      {/* CONTENT GRID */}
      {!isQuotationMode ? (
        <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 30rem',
        gap: '1.5rem',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden'
      }}>
        {/* LEFT COLUMN: ITEM SELECTION */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'hidden' }}>

          {/* Search & Tabs */}
          <div style={{ background: 'var(--bg-card)', padding: '0.55rem', borderRadius: '1rem', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', width: '100%' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)', width: 18 }} />
                <input
                  type="text"
                  placeholder="Search items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 1rem 0.65rem 2.75rem',
                    borderRadius: '0.75rem',
                    border: '1.5px solid var(--border)',
                    outline: 'none',
                    background: 'var(--bg-input)',
                    color: 'var(--text-dark)',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    transition: 'all 0.2s ease'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.background = 'var(--bg-card)';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(35, 76, 106, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.background = 'var(--bg-input)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>
              <div style={{
                display: 'flex',
                background: 'var(--bg-hover)',
                padding: '0.25rem',
                borderRadius: '0.875rem',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-sm)',
                gap: '0.25rem'
              }}>
                <button
                  onClick={() => handleTabChange('services')}
                  style={{
                    padding: '0.45rem 1rem',
                    borderRadius: '0.625rem',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    background: activeTab === 'services' ? 'var(--bg-card)' : 'transparent',
                    color: activeTab === 'services' ? 'var(--primary)' : 'var(--text-black)',
                    boxShadow: activeTab === 'services' ? 'var(--shadow-md)' : 'none',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    transform: activeTab === 'services' ? 'translateY(-1px)' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (activeTab !== 'services') {
                      e.currentTarget.style.background = 'var(--bg-active)';
                      e.currentTarget.style.color = 'var(--text-dark)';
                      e.currentTarget.style.transform = 'translateY(-0.5px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeTab !== 'services') {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--text-black)';
                      e.currentTarget.style.transform = 'none';
                    }
                  }}
                >
                  Services
                </button>
                <button
                  onClick={() => handleTabChange('products')}
                  style={{
                    padding: '0.45rem 1rem',
                    borderRadius: '0.625rem',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    background: activeTab === 'products' ? 'var(--bg-card)' : 'transparent',
                    color: activeTab === 'products' ? 'var(--primary)' : 'var(--text-black)',
                    boxShadow: activeTab === 'products' ? 'var(--shadow-md)' : 'none',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    transform: activeTab === 'products' ? 'translateY(-1px)' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (activeTab !== 'products') {
                      e.currentTarget.style.background = 'var(--bg-active)';
                      e.currentTarget.style.color = 'var(--text-dark)';
                      e.currentTarget.style.transform = 'translateY(-0.5px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeTab !== 'products') {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--text-black)';
                      e.currentTarget.style.transform = 'none';
                    }
                  }}
                >
                  Products
                </button>
                <button
                  onClick={() => handleTabChange('combos')}
                  style={{
                    padding: '0.45rem 1rem',
                    borderRadius: '0.625rem',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    background: activeTab === 'combos' ? 'var(--bg-card)' : 'transparent',
                    color: activeTab === 'combos' ? 'var(--primary)' : 'var(--text-black)',
                    boxShadow: activeTab === 'combos' ? 'var(--shadow-md)' : 'none',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    transform: activeTab === 'combos' ? 'translateY(-1px)' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (activeTab !== 'combos') {
                      e.currentTarget.style.background = 'var(--bg-active)';
                      e.currentTarget.style.color = 'var(--text-dark)';
                      e.currentTarget.style.transform = 'translateY(-0.5px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeTab !== 'combos') {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--text-black)';
                      e.currentTarget.style.transform = 'none';
                    }
                  }}
                >
                  Packages
                </button>
                <button
                  onClick={() => handleTabChange('vouchers')}
                  style={{
                    padding: '0.45rem 1rem',
                    borderRadius: '0.625rem',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    background: activeTab === 'vouchers' ? 'var(--bg-card)' : 'transparent',
                    color: activeTab === 'vouchers' ? 'var(--primary)' : 'var(--text-black)',
                    boxShadow: activeTab === 'vouchers' ? 'var(--shadow-md)' : 'none',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    transform: activeTab === 'vouchers' ? 'translateY(-1px)' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (activeTab !== 'vouchers') {
                      e.currentTarget.style.background = 'var(--bg-active)';
                      e.currentTarget.style.color = 'var(--text-dark)';
                      e.currentTarget.style.transform = 'translateY(-0.5px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeTab !== 'vouchers') {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--text-black)';
                      e.currentTarget.style.transform = 'none';
                    }
                  }}
                >
                  Vouchers
                </button>
              </div>

              {/* Show Inactive Toggle commented out as requested */}
              {/* {(activeTab === 'services' || activeTab === 'combos') && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginLeft: 'auto', paddingRight: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={showInactive}
                    onChange={(e) => setShowInactive(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-black)', fontWeight: 600, userSelect: 'none' }}>Show Inactive</span>
                </label>
              )} */}

            </div>

            {/* Category Filters */}
            {(activeTab === 'services' || activeTab === 'products') && (
              <div style={{
                display: 'flex',
                gap: '0.4rem',
                paddingBottom: '0.2rem',
                width: '100%',
                flexWrap: 'wrap', // Wrap to next line
              }}>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} width="80px" height="1.8rem" style={{ borderRadius: '2rem' }} />
                  ))
                ) : categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    style={{
                      padding: '0.3rem 0.75rem',
                      borderRadius: '2rem',
                      border: selectedCategory === cat ? '1px solid var(--primary)' : '1px solid var(--border)',
                      background: selectedCategory === cat ? 'var(--primary)' : 'var(--bg-body)',
                      color: selectedCategory === cat ? '#fff' : 'var(--text-dark)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.2s',
                      boxShadow: selectedCategory === cat ? '0 4px 12px rgba(35, 76, 106, 0.2)' : 'none',
                      flexShrink: 0
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

          </div>



          {/* Item Grid */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gridAutoRows: 'max-content', gap: '0.55rem', paddingBottom: '0.8rem' }}>
            {loading ? (
              // Loading Skeletons
              Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={`skeleton-${i}`}
                  style={{
                    background: 'var(--bg-card)',
                    borderRadius: '1rem',
                    padding: '0.6rem',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    height: '110px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Skeleton width="70%" height="1.2rem" />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flex: 1 }}>
                    <Skeleton width="32px" height="32px" variant="rectangular" style={{ borderRadius: '0.5rem' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                      <Skeleton width="40px" height="0.8rem" />
                      <Skeleton width="60px" height="1.1rem" />
                    </div>
                  </div>
                </div>
              ))
            ) : filteredItems.length > 0 ? (
              filteredItems.map(item => {
                // NEW: Aggregate logic to show total available redemptions across all packages
                const allMatchingUsageItems = customerPackages.flatMap(pkg => {
                  // NEW: Skip expired packages/combos for redemption visibility
                  if (pkg.expiryDate && new Date(pkg.expiryDate) < new Date()) {
                    return [];
                  }

                  const items = pkg.usageDetails?.filter((u: any) =>
                    (u.itemId === item.id || u.name === item.name) && u.remainingQuantity > 0
                  ) || [];
                  return items.map((u: any) => ({ ...u, packageId: pkg.id }));
                });

                const totalRemaining = allMatchingUsageItems.reduce((sum, u) => sum + u.remainingQuantity, 0);

                // For card display, we still need ONE package to target when clicking "Redeem"
                // We'll pick the first one with balance
                const usageItem = allMatchingUsageItems.length > 0 ? allMatchingUsageItems[0] : null;
                const matchingPkg = usageItem ? customerPackages.find(p => p.id === usageItem.packageId) : null;

                return (
                  <motion.div
                    key={item.id}
                    className="dark:bg-slate-900 dark:border-slate-700"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ y: -4, boxShadow: '0 12px 24px rgba(0,0,0,0.06)' }}
                    transition={{ duration: 0.2 }}
                    onClick={() => {
                      if (matchingPkg && usageItem) {
                        // REDEMPTION LOGIC - Works for all tabs (Services, Products, Combos)
                        const itemToAdd = {
                          id: usageItem.itemId || item.id || 'temp-' + Math.random(),
                          name: usageItem.name || item.name,
                          price: 0,
                        };
                        addToCart(itemToAdd, activeTab === 'services' ? 'service' : activeTab === 'products' ? 'product' : 'service', {
                          packageId: matchingPkg.id,
                          itemId: usageItem.itemId || usageItem.name
                        });
                        // Toast removed - notification is handled in updateQuantity when exceeding free limit
                      } else {
                        // NORMAL PURCHASE LOGIC - No package match
                        addToCart(item, activeTab === 'services' ? 'service' : activeTab === 'products' ? 'product' : activeTab === 'vouchers' ? 'voucher' : 'combo');
                      }
                    }}
                    style={{
                      background: 'var(--bg-card)',
                      borderRadius: '1rem',
                      padding: '0.6rem',
                      border: '1px solid var(--border)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      height: '100%',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      position: 'relative',
                      overflow: 'visible' // Ensure badge can still be seen if slightly offset
                    }}
                  >

                    {/* Badge UI - Show when item can be redeemed from package */}
                    {matchingPkg && usageItem && (
                      <div style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', zIndex: 10 }}>
                        <div
                          style={{
                            background: 'rgba(16, 185, 129, 0.2)',
                            color: 'var(--success)',
                            borderRadius: '2rem',
                            padding: '0.25rem 0.6rem',
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            boxShadow: '0 2px 4px rgba(16, 185, 129, 0.1)',
                          }}
                        >
                          Redeem ({totalRemaining})
                        </div>
                      </div>
                    )}



                    {/* Card Content - Horizontal Layout: Top: Name | Duration, Bottom: Image | Amount */}
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '0.5rem' }}>
                      {/* Top Row: Name only */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <h4 className="text-black dark:text-black" style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, lineHeight: 1.3, flex: 1, textAlign: 'left' }}>
                          {item.name}
                        </h4>
                      </div>

                      {/* Bottom Row: Image (left) | Duration & Amount (right) */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flex: 1 }}>
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
                          <ServiceAvatar
                            name={item.name}
                            imgUrl={(item as any).imgUrl}
                            size={32}
                            shape="rectangle"
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                          <p className="text-black dark:text-black" style={{ margin: 0, fontSize: '0.75rem', fontWeight: 500, whiteSpace: 'nowrap' }}>
                            {activeTab === 'services'
                              ? `${(item as any).duration} mins`
                              : activeTab === 'products'
                                ? `${(item as any).stock} in stock`
                                : activeTab === 'vouchers'
                                  ? (
                                    <>
                                      {/* Expiry: {new Date((item as any).expiryDate).toLocaleDateString()}
                                    <br /> */}
                                      Value: {formatPrice((item as any).value)}
                                    </>
                                  )
                                  : `${(item as any).items.length} items`
                            }
                          </p>
                          <div className="text-black dark:text-white" style={{ fontWeight: 800, fontSize: '1.1rem', whiteSpace: 'nowrap' }}>
                            {formatPrice(activeTab === 'vouchers' ? (item as any).sellingPrice : item.price)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <div style={{
                gridColumn: '1 / -1',
                padding: '3rem',
                textAlign: 'center',
                background: 'var(--bg-card)',
                borderRadius: '1rem',
                border: '1px solid var(--border)',
                color: 'var(--text-black)'
              }}>
                <ShoppingBag size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                <p style={{ fontWeight: 600 }}>No items found</p>
                <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>Try changing your category or search term</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: CART */}
        <Card
          className="h-full"
          contentClassName="flex flex-col h-full"
          contentStyle={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
          style={{
            padding: 0,
            overflow: 'hidden',
            border: '1px solid var(--border)',
            // borderRadius: 0,
            boxShadow: 'var(--shadow-xl)',
            background: 'var(--bg-card)',
            height: '100%',
            color: 'var(--text-dark)'
          }}>
          {/* Customer Header */}
          <div style={{
            padding: '0.75rem',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.1rem'
          }}>

            {customersLoading ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-hover)',
                padding: '0.65rem 0.875rem',
                borderRadius: '1rem',
                border: '1px solid var(--border)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                  <Skeleton width="32px" height="32px" style={{ borderRadius: '10px' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <Skeleton width="120px" height="1rem" />
                    <Skeleton width="80px" height="0.75rem" />
                  </div>
                </div>
              </div>
            ) : selectedCustomer ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-hover)',
                padding: '0.65rem 0.875rem',
                borderRadius: '1rem',
                border: '1px solid var(--border)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                  <div style={{
                    background: 'var(--bg-input)',
                    width: '32px',
                    height: '32px',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid var(--border)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                  }}>
                    <User size={20} style={{ color: selectedCustomerId === 'WALK_IN' ? 'var(--text-black)' : 'var(--primary)' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                    <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-dark)', lineHeight: 1.2 }}>{selectedCustomer?.name}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-black)', fontWeight: 500 }}>
                        {(isStaff && fraudProtection) ? maskPhone(selectedCustomer?.phone) : selectedCustomer?.phone}
                      </p>
                      {selectedSpecialistName && (
                        <>
                          <span style={{ color: 'var(--border)', fontSize: '0.75rem', opacity: 0.5 }}>|</span>
                          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                            {selectedSpecialistName}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    onClick={() => setIsSpecialistModalOpen(true)}
                    title={selectedSpecialistName ? "Change Specialist" : "Select Specialist"}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      color: selectedSpecialistName ? 'var(--primary)' : 'var(--text-black)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: selectedSpecialistName ? '0 2px 4px rgba(79, 70, 229, 0.1)' : 'none'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--primary)';
                      e.currentTarget.style.borderColor = 'var(--primary)';
                      e.currentTarget.style.background = 'var(--bg-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = selectedSpecialistName ? 'var(--primary)' : 'var(--text-black)';
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.background = 'var(--bg-card)';
                    }}
                  >
                    <UserCog size={16} />
                  </button>
                  <button
                    onClick={handleClearCustomer}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-black)',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--danger)';
                      e.currentTarget.style.borderColor = 'var(--danger)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--text-black)';
                      e.currentTarget.style.borderColor = 'var(--border)';
                    }}
                  >
                    <X size={14} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  {/* Search Input */}
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-black)', opacity: 0.5, pointerEvents: 'none' }} />
                    <input
                      type="text"
                      placeholder="Search Customer..."
                      value={customerSearchTerm}
                      onChange={(e) => {
                        setCustomerSearchTerm(e.target.value);
                        setIsCustomerDropdownOpen(true);
                      }}
                      onFocus={() => setIsCustomerDropdownOpen(true)}
                      style={{
                        width: '100%',
                        height: '2.5rem',
                        padding: '0 2.5rem 0 2.75rem',
                        fontSize: '0.875rem',
                        border: '1px solid var(--border)',
                        borderRadius: '1rem',
                        outline: 'none',
                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                        background: 'var(--bg-input)',
                        color: 'var(--text-dark)',
                        fontWeight: 500
                      }}
                      onFocusCapture={(e) => {
                        e.currentTarget.style.borderColor = 'var(--primary)';
                        e.currentTarget.style.background = 'white';
                        e.currentTarget.style.boxShadow = '0 0 0 4px rgba(79, 70, 229, 0.08)';
                      }}
                      onBlurCapture={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.background = 'var(--bg-body)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsCustomerDropdownOpen(!isCustomerDropdownOpen);
                      }}
                      style={{
                        position: 'absolute',
                        right: '0.75rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-black)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0.25rem',
                        borderRadius: '0.5rem',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                    >
                      <ChevronDown size={18} style={{
                        transform: isCustomerDropdownOpen ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                      }} />
                    </button>
                  </div>

                  {/* Action Group */}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => setIsAddCustomerModalOpen(true)}
                      style={{
                        height: '2.5rem',
                        width: '2.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'linear-gradient(135deg, var(--primary) 0%, #4338ca 100%)',
                        border: 'none',
                        borderRadius: '1rem',
                        color: 'white',
                        cursor: 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(79, 70, 229, 0.3)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(79, 70, 229, 0.2)';
                      }}
                    >
                      <UserPlus size={20} strokeWidth={2.5} />
                    </button>

                    {!shouldHideFeatures && (
                      <button
                        onClick={() => {
                          setSelectedCustomerId('WALK_IN');
                          setCustomerSearchTerm('Walk-in Customer');
                          setIsCustomerDropdownOpen(false);
                        }}
                        title="Walk-in Customer"
                        style={{
                          height: '2.5rem',
                          width: '2.5rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', // Emerald gradient
                          border: 'none',
                          borderRadius: '1rem',
                          color: 'white',
                          cursor: 'pointer',
                          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.3)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.2)';
                        }}
                      >
                        <div style={{ transform: 'scaleX(-1)' }}>
                          <FaWalking size={20} />
                        </div>
                      </button>
                    )}

                    <button
                      onClick={() => setIsSpecialistModalOpen(true)}
                      title="Select Specialist"
                      style={{
                        height: '2.5rem',
                        width: '2.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', // Amber gradient
                        border: 'none',
                        borderRadius: '1rem',
                        color: 'white',
                        cursor: 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: '0 4px 12px rgba(245, 158, 11, 0.2)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(245, 158, 11, 0.3)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.2)';
                      }}
                    >
                      <UserCog size={20} />
                    </button>
                  </div>
                </div>



                {/* Customer Dropdown */}
                {isCustomerDropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: '0.5rem',
                      background: 'white',
                      borderRadius: '1rem',
                      boxShadow: '0 20px 40px -10px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
                      border: '1px solid var(--border-light)',
                      zIndex: 100,
                      maxHeight: '400px',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Persistent Search Box Inside Dropdown */}
                    <div style={{
                      padding: '0.75rem',
                      borderBottom: '1px solid var(--border-light)',
                      background: 'var(--bg-body)',
                      position: 'sticky',
                      top: 0,
                      zIndex: 10
                    }}>
                      <div style={{ position: 'relative' }}>
                        <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-black)' }} />
                        <input
                          type="text"
                          placeholder="Type to filter..."
                          autoFocus
                          value={customerSearchTerm}
                          onChange={(e) => setCustomerSearchTerm(e.target.value)}
                          style={{
                            width: '100%',
                            height: '2.25rem',
                            padding: '0 0.75rem 0 2.25rem',
                            fontSize: '0.85rem',
                            border: '1px solid var(--border-light)',
                            borderRadius: '0.75rem',
                            outline: 'none',
                            background: 'white',
                            color: 'var(--text-dark)'
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ overflowY: 'auto', padding: '0.5rem', flex: 1 }}>
                      {/* Customer List */}
                      {filteredCustomers.length > 0 && (
                        <>
                          <div style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            color: 'var(--text-light)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            padding: '0.5rem 1rem 0.25rem'
                          }}>
                            Customers
                          </div>
                          {filteredCustomers.map(c => (
                            <div
                              key={c.id}
                              onClick={() => handleSelectCustomer(c)}
                              style={{
                                padding: '0.75rem 1rem',
                                borderRadius: '0.75rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                transition: 'all 0.15s ease',
                                marginBottom: '0.25rem'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'var(--bg-hover)';
                                const icon = e.currentTarget.querySelector('.check-icon') as HTMLElement;
                                if (icon) icon.style.opacity = '1';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                const icon = e.currentTarget.querySelector('.check-icon') as HTMLElement;
                                if (icon) icon.style.opacity = '0';
                              }}
                            >
                              <div>
                                <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-dark)' }}>{c.name}</p>
                                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-black)' }}>
                                  {(isStaff && fraudProtection) ? maskPhone(c.phone) : c.phone}
                                </p>
                              </div>
                              <CheckCircle className="check-icon" size={16} style={{ color: 'var(--primary)', opacity: 0, transition: 'opacity 0.2s' }} />
                            </div>
                          ))}
                        </>
                      )}

                      {/* No Customers Found Message */}
                      {filteredCustomers.length === 0 && (
                        <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8' }}>
                          <p style={{ margin: 0, fontSize: '0.85rem', marginBottom: '0.5rem' }}>No matching customers.</p>
                          <button
                            onClick={() => {
                                if (!canAddCustomer) { showToast("Ask Admin for permission", "error"); return; }
                                setIsAddCustomerModalOpen(true);
                            }}
                            disabled={!canAddCustomer}
                            title={!canAddCustomer ? "Ask Admin for permission" : ""}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--primary)',
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              cursor: !canAddCustomer ? 'not-allowed' : 'pointer',
                              textDecoration: 'underline',
                              opacity: !canAddCustomer ? 0.5 : 1
                            }}
                          >
                            Add new customer?
                          </button>
                        </div>
                      )}

                      {/* Quick Walk-in Option - Always at Bottom */}
                      {!shouldHideFeatures && (
                        <div
                          onClick={() => {
                            setSelectedCustomerId('WALK_IN');
                            setCustomerSearchTerm('Walk-in Customer');
                            setIsCustomerDropdownOpen(false);
                          }}
                          style={{
                            padding: '0.75rem 1rem',
                            borderRadius: '0.75rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            transition: 'all 0.15s ease',
                            marginTop: filteredCustomers.length > 0 ? '0.5rem' : '0',
                            background: 'var(--bg-hover)',
                            border: '1px dashed var(--border)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--primary-light)';
                            e.currentTarget.style.borderColor = 'var(--primary)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'var(--bg-hover)';
                            e.currentTarget.style.borderColor = 'var(--border)';
                          }}
                        >
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg, var(--primary) 0%, #4338ca 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white'
                          }}>
                            <User size={16} strokeWidth={2.5} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-dark)' }}>Quick Walk-in</p>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-black)' }}>No customer details needed</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {/* Overlay to close dropdown */}
                {isCustomerDropdownOpen && (
                  <div className="fixed inset-0 z-10" onClick={() => setIsCustomerDropdownOpen(false)}></div>
                )}
              </div>
            )}
          </div>

          {/* Cart Items */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.65rem', minHeight: '400px' }}>
            {cart.length === 0 ? (
              <div style={{ height: '350px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{
                  background: 'var(--bg-subtle)',
                  padding: '2.5rem',
                  borderRadius: '2.5rem',
                  marginBottom: '1.75rem',
                  border: '1px solid var(--border)',
                  boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    background: 'radial-gradient(circle at center, var(--primary-light) 0%, transparent 70%)',
                    opacity: 0.3
                  }} />
                  <ShoppingBag size={56} strokeWidth={1} style={{ color: 'var(--primary)', position: 'relative', zIndex: 1 }} />
                </div>
                <p style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '0.75rem', letterSpacing: '-0.025em' }}>Your cart is empty</p>
                <p style={{ fontSize: '0.9375rem', color: 'var(--text-black)', textAlign: 'center', maxWidth: '260px', lineHeight: 1.6, fontWeight: 500 }}>
                  Select services or products from the catalogue to get started.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <AnimatePresence>
                  {cart.map(item => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      style={{
                        background: '#EBF5F9',
                        border: '1px solid #C5DDE9',
                        borderLeft: item.type === 'combo'
                          ? '3px solid #f59e0b'
                          : item.type === 'voucher'
                            ? '3px solid #10b981'
                            : '3px solid #234C6A',
                        borderRadius: '0.75rem',
                        padding: '0.45rem 0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = '0 4px 16px rgba(35,76,106,0.12)';
                        e.currentTarget.style.background = '#D7EEF7';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = 'none';
                        e.currentTarget.style.background = '#EBF5F9';
                      }}
                    >
                      {/* Item Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {item.type === 'combo' && (
                          <span style={{
                            display: 'inline-block',
                            fontSize: '0.6rem',
                            fontWeight: 800,
                            padding: '0.1rem 0.4rem',
                            background: '#FFF7ED',
                            color: '#EA580C',
                            borderRadius: '2rem',
                            border: '1px solid #FFEDD5',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            marginBottom: '0.2rem'
                          }}>
                            Package
                          </span>
                        )}
                        <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#1A3A52', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.name}
                        </p>
                        <p style={{ margin: '0.1rem 0 0', fontSize: '0.72rem', color: '#234C6A', fontWeight: 600, opacity: 0.8 }}>
                          {item.redeemedQuantity === item.quantity ? 'Package Redemption' : formatPrice(item.price)}
                        </p>
                      </div>

                      {/* Specialist Selection */}
                      <div style={{ marginRight: '0.25rem' }}>
                        <select
                          value={item.specialistId || ''}
                          onChange={(e) => {
                            const sId = e.target.value;
                            const sName = stylists.find(s => s.id.toString() === sId.toString())?.name || '';
                            updateItemSpecialist(item.id, sId, sName);
                          }}
                          style={{
                            fontSize: '0.65rem',
                            padding: '0.15rem 0.6rem',
                            borderRadius: '2rem',
                            border: item.specialistId ? '1.5px solid var(--primary)' : '1.5px dashed var(--text-light)',
                            background: item.specialistId ? 'var(--primary-light)' : 'white',
                            color: item.specialistId ? 'var(--primary)' : 'var(--text-light)',
                            fontWeight: 800,
                            cursor: 'pointer',
                            maxWidth: '85px',
                            outline: 'none',
                            textTransform: 'uppercase',
                            letterSpacing: '0.02em',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'var(--primary)';
                            e.currentTarget.style.color = 'var(--primary)';
                          }}
                          onMouseLeave={(e) => {
                            if (!item.specialistId) {
                                e.currentTarget.style.borderColor = 'var(--text-light)';
                                e.currentTarget.style.color = 'var(--text-light)';
                            }
                          }}
                        >
                          <option value="">+ Staff</option>
                          {stylists.map(s => (
                            <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>
                          ))}
                        </select>
                      </div>

                      {/* Quantity Controls */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0',
                        background: 'white',
                        borderRadius: '2rem',
                        border: '1.5px solid #234C6A',
                        overflow: 'hidden'
                      }}>
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          style={{
                            width: 28, height: 28,
                            border: 'none',
                            background: 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer',
                            color: '#234C6A',
                            transition: 'all 0.15s'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#fef2f2'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = '#234C6A'; e.currentTarget.style.background = 'transparent'; }}
                        >
                          <Minus size={12} strokeWidth={3} />
                        </button>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, minWidth: '1.5rem', textAlign: 'center', color: '#1A3A52' }}>
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          style={{
                            width: 28, height: 28,
                            border: 'none',
                            background: 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer',
                            color: '#234C6A',
                            transition: 'all 0.15s'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = 'white'; e.currentTarget.style.background = '#234C6A'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = '#234C6A'; e.currentTarget.style.background = 'transparent'; }}
                        >
                          <Plus size={12} strokeWidth={3} />
                        </button>
                      </div>

                      {/* Item Total */}
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: '#1A3A52', minWidth: '5rem', textAlign: 'right', letterSpacing: '-0.02em' }}>
                        {formatPrice(item.price * (item.redeemedQuantity ? (item.quantity - item.redeemedQuantity) : item.quantity))}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Totals Section */}
          <div style={{
            padding: '0.75rem',
            background: 'var(--bg-subtle)',
            borderTop: '1px solid var(--border)',
            backdropFilter: 'blur(12px)',
            position: 'relative',
            zIndex: 10,
            flexShrink: 0,
            marginTop: 'auto'
          }}>
            <div className="space-y-2 mb-2">
              {/* <div style={{ marginBottom: '0.2rem', position: 'relative' }}>
                <button
                  onClick={() => setIsSpecialistDropdownOpen(!isSpecialistDropdownOpen)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    background: 'var(--bg-input)',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '0.75rem',
                    border: '1px solid var(--border)',
                    gap: '0.5rem',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary-light)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(79, 70, 229, 0.08)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSpecialistDropdownOpen) {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.02)';
                    }
                  }}
                >
                  <div style={{
                    background: 'var(--bg-active)',
                    padding: '0.35rem',
                    borderRadius: '0.6rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <User size={18} style={{ color: 'var(--primary)' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-black)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.125rem' }}>Specialist</p>
                    <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-dark)' }}>
                      {selectedSpecialistName || 'Any Specialist'}
                    </p>
                  </div>
                  <motion.div
                    animate={{ rotate: isSpecialistDropdownOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown size={18} style={{ color: '#94A3B8' }} />
                  </motion.div>
                </button>

                <AnimatePresence>
                  {isSpecialistDropdownOpen && (
                    <>
                      <div
                        style={{ position: 'fixed', inset: 0, zIndex: 90 }}
                        onClick={() => setIsSpecialistDropdownOpen(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        style={{
                          position: 'absolute',
                          bottom: '100%',
                          left: 0,
                          right: 0,
                          marginBottom: '0.5rem',
                          background: 'var(--bg-card)',
                          borderRadius: '1.25rem',
                          boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
                          border: '1px solid var(--border)',
                          zIndex: 100,
                          maxHeight: '300px',
                          overflowY: 'auto',
                          padding: '0.5rem'
                        }}
                      >
                        <div
                          onClick={() => {
                            handleSpecialistChange('');
                            setIsSpecialistDropdownOpen(false);
                          }}
                          style={{
                            padding: '0.75rem 1rem',
                            borderRadius: '0.75rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            transition: 'all 0.15s',
                            background: selectedSpecialistId === '' ? 'var(--primary-light)' : 'transparent',
                            color: selectedSpecialistId === '' ? 'var(--primary)' : 'var(--text-dark)',
                            fontWeight: selectedSpecialistId === '' ? 700 : 500,
                            fontSize: '0.875rem'
                          }}
                          onMouseEnter={(e) => {
                            if (selectedSpecialistId !== '') e.currentTarget.style.background = 'var(--bg-hover)';
                          }}
                          onMouseLeave={(e) => {
                            if (selectedSpecialistId !== '') e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <User size={16} opacity={selectedSpecialistId === '' ? 1 : 0.4} />
                          Any Specialist
                        </div>
                        <div style={{ height: '1px', background: 'var(--border-light)', margin: '0.375rem 0.5rem' }} />
                        {stylists.map(s => (
                          <div
                            key={s.id}
                            onClick={() => {
                              handleSpecialistChange(s.id as string);
                              setIsSpecialistDropdownOpen(false);
                            }}
                            style={{
                              padding: '0.75rem 1rem',
                              borderRadius: '0.75rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.75rem',
                              transition: 'all 0.15s',
                              background: selectedSpecialistId === s.id ? 'var(--primary-light)' : 'transparent',
                              color: selectedSpecialistId === s.id ? 'var(--primary)' : 'var(--text-dark)',
                              fontWeight: selectedSpecialistId === s.id ? 700 : 500,
                              fontSize: '0.875rem',
                              marginBottom: '0.125rem',
                              opacity: s.isAvailable === false ? 0.6 : 1
                            }}
                            onMouseEnter={(e) => {
                              if (selectedSpecialistId !== s.id) e.currentTarget.style.background = 'var(--bg-hover)';
                            }}
                            onMouseLeave={(e) => {
                              if (selectedSpecialistId !== s.id) e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <div style={{ width: 16, height: 16, borderRadius: '50%', background: s.isAvailable !== false ? '#10B981' : '#EF4444' }} />
                            <div style={{ flex: 1 }}>
                              {s.name}
                              {s.isAvailable === false && <span style={{ fontSize: '0.65rem', marginLeft: '0.5rem', opacity: 0.6 }}>(Off)</span>}
                            </div>
                            {selectedSpecialistId === s.id && <CheckCircle size={14} />}
                          </div>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div> */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9375rem', color: 'var(--text-black)' }}>
                <span style={{ fontWeight: 500 }}>Subtotal</span>
                <span style={{ fontWeight: 700, color: 'var(--text-dark)' }}>{formatPrice(subtotal)}</span>
              </div>

              {depositAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9375rem', color: 'var(--primary)', fontWeight: 600 }}>
                  <span>Paid Amount</span>
                  <span>-{formatPrice(depositAmount)}</span>
                </div>
              )}

              {/* Attachments & Voucher Row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                {/* Attachments Button */}
                <button
                  onClick={() => setIsAttachmentsModalOpen(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    fontSize: '0.78rem', fontWeight: 700,
                    color: 'var(--primary)',
                    background: 'var(--primary-light)',
                    padding: '0.4rem 0.7rem',
                    borderRadius: '0.6rem',
                    border: '1px solid rgba(var(--primary-rgb, 79,70,229),0.18)',
                    cursor: 'pointer',
                    transition: 'all 0.18s',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(0.93)'; }}
                  onMouseLeave={e => { e.currentTarget.style.filter = 'none'; }}
                >
                  <Paperclip size={14} />
                  {attachments.filter(att => att.url).length > 0 ? `${attachments.filter(att => att.url).length} File(s)` : 'Add Attachments'}
                </button>

                {/* Voucher Toggle Button */}
                {selectedCustomerId && selectedCustomerId !== 'WALK_IN' && !cart.some(item => item.type === 'voucher') && (
                  <button
                    onClick={() => setShowVoucherCartInput(v => !v)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.4rem',
                      fontSize: '0.78rem', fontWeight: 700,
                      color: showVoucherCartInput ? '#fff' : '#10B981',
                      background: showVoucherCartInput
                        ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
                        : 'rgba(16,185,129,0.1)',
                      padding: '0.4rem 0.7rem',
                      borderRadius: '0.6rem',
                      border: showVoucherCartInput ? 'none' : '1px solid rgba(16,185,129,0.25)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: showVoucherCartInput ? '0 3px 12px rgba(16,185,129,0.3)' : 'none',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    <Ticket size={14} />
                    Voucher
                    {/* Checkmark indicator */}
                    {showVoucherCartInput && (
                      <span style={{
                        width: 14, height: 14, borderRadius: '50%', background: 'rgba(255,255,255,0.25)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 2
                      }}>
                        <X size={8} strokeWidth={3} />
                      </span>
                    )}
                  </button>
                )}
              </div>

              {/* Voucher Panel */}
              {showVoucherCartInput && !cart.some(item => item.type === 'voucher') && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  style={{
                    background: 'rgba(16,185,129,0.04)',
                    border: '1px solid rgba(16,185,129,0.18)',
                    borderRadius: '0.875rem',
                    padding: '0.65rem 0.75rem',
                    marginBottom: '0.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                  }}
                >
                  {(() => {
                    const availableClaims = voucherClaims?.filter(c =>
                      c.customerId && selectedCustomerId &&
                      c.customerId.toString() === selectedCustomerId.toString() &&
                      (c.status === 'claimed' || c.status === 'partially_redeemed') &&
                      c.balance > 0
                    ) || [];

                    if (availableClaims.length > 0) {
                      return (
                        <div style={{
                          display: 'flex', flexDirection: 'column', gap: '0.4rem',
                          background: 'rgba(16,185,129,0.08)',
                          padding: '0.75rem',
                          borderRadius: '0.6rem',
                          border: '1px solid rgba(16,185,129,0.3)',
                          boxShadow: '0 2px 8px rgba(16,185,129,0.1)',
                        }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#065F46', textTransform: 'uppercase', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} />
                            Select Available Voucher
                          </span>
                          <div style={{
                            display: 'flex', gap: '0.4rem', flexWrap: 'wrap',
                          }}>
                            {availableClaims.map(v => {
                              const isExpired = (v.expiryDate && new Date(v.expiryDate) < new Date()) || 
                                               (v.voucher?.expiryDate && new Date(v.voucher.expiryDate) < new Date()) ||
                                               (v.voucher?.status === 'expired');
                              
                              const isSelected = cartVoucherCode.split(',').map(c => c.trim()).includes(v.voucherCode);

                              return (
                                <button
                                  key={v.id}
                                  onClick={() => !isExpired && handleVoucherClick(v.voucherCode)}
                                  title={isExpired ? "Voucher expired" : "Click to select"}
                                  style={{
                                    fontSize: '0.72rem', fontWeight: 700,
                                    padding: '0.25rem 0.65rem',
                                    background: isExpired 
                                      ? 'rgba(239, 68, 68, 0.08)' 
                                      : isSelected
                                        ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
                                        : 'linear-gradient(135deg, rgba(16,185,129,0.14) 0%, rgba(5,150,105,0.08) 100%)',
                                    color: isExpired ? '#ef4444' : (isSelected ? '#fff' : '#059669'),
                                    border: isExpired 
                                      ? '1px solid rgba(239, 68, 68, 0.3)' 
                                      : '1px solid rgba(16,185,129,0.28)',
                                    borderRadius: '0.6rem',
                                    cursor: isExpired ? 'not-allowed' : 'pointer',
                                    opacity: 0.9,
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    whiteSpace: 'nowrap',
                                    boxShadow: isSelected ? '0 2px 6px rgba(16,185,129,0.3)' : 'none',
                                  }}
                                >
                                  <Ticket size={11} />
                                  {v.voucherCode}
                                  <span style={{ opacity: 0.75 }}>({formatPrice(v.balance)})</span>
                                  {isExpired && <span style={{ fontSize: '0.6rem', fontWeight: 800, opacity: 0.9 }}>(Expired)</span>}
                                  {isSelected && (
                                    <div
                                      style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        background: 'rgba(255,255,255,0.2)',
                                        borderRadius: '50%',
                                        padding: '2px'
                                      }}
                                    >
                                      <X size={10} strokeWidth={3} />
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Code Input + Apply */}
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <Ticket size={14} style={{
                        position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)',
                        color: '#10B981', pointerEvents: 'none'
                      }} />
                      <input
                        type="text"
                        placeholder={(() => {
                          const hasClaims = voucherClaims?.some(c =>
                            c.customerId && selectedCustomerId &&
                            c.customerId.toString() === selectedCustomerId.toString() &&
                            (c.status === 'claimed' || c.status === 'partially_redeemed') &&
                            c.balance > 0
                          );
                          return hasClaims ? "Select voucher from above" : "Voucher Code";
                        })()}
                        value={cartVoucherCode}
                        onChange={(e) => { setCartVoucherCode(e.target.value); setVoucherError(''); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleApplyVoucher(cartVoucherCode); }}
                        disabled={(() => {
                          const hasClaims = voucherClaims?.some(c =>
                            c.customerId && selectedCustomerId &&
                            c.customerId.toString() === selectedCustomerId.toString() &&
                            (c.status === 'claimed' || c.status === 'partially_redeemed') &&
                            c.balance > 0
                          );
                          return !!hasClaims;
                        })()}
                        style={{
                          width: '100%',
                          paddingLeft: '2rem', paddingRight: '2rem',
                          paddingTop: '0.42rem', paddingBottom: '0.42rem',
                          borderRadius: '0.6rem',
                          border: voucherError ? '1.5px solid var(--danger)' : '1.5px solid rgba(16,185,129,0.35)',
                          fontSize: '0.82rem', fontWeight: 700,
                          outline: 'none',
                          background: (() => {
                            const hasClaims = voucherClaims?.some(c =>
                              c.customerId && selectedCustomerId &&
                              c.customerId.toString() === selectedCustomerId.toString() &&
                              (c.status === 'claimed' || c.status === 'partially_redeemed') &&
                              c.balance > 0
                            );
                            return hasClaims ? 'rgba(0,0,0,0.03)' : 'rgba(16,185,129,0.06)';
                          })(),
                          color: '#065F46',
                          transition: 'border-color 0.15s, box-shadow 0.15s',
                          boxSizing: 'border-box',
                          cursor: (() => {
                            const hasClaims = voucherClaims?.some(c =>
                              c.customerId && selectedCustomerId &&
                              c.customerId.toString() === selectedCustomerId.toString() &&
                              (c.status === 'claimed' || c.status === 'partially_redeemed') &&
                              c.balance > 0
                            );
                            return hasClaims ? 'not-allowed' : 'text';
                          })(),
                        }}
                        onFocus={e => { e.currentTarget.style.borderColor = '#10B981'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.12)'; }}
                        onBlur={e => { e.currentTarget.style.borderColor = voucherError ? 'var(--danger)' : 'rgba(16,185,129,0.3)'; e.currentTarget.style.boxShadow = 'none'; }}
                      />
                      {cartVoucherCode && (
                        <button
                          onClick={() => { setCartVoucherCode(''); setVoucherError(''); }}
                          style={{
                            position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)',
                            background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: '50%',
                            width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', color: '#666', zIndex: 5
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.1)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'}
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                    <button
                      onClick={handleBulkApply}
                      disabled={!cartVoucherCode}
                      style={{
                        padding: '0.42rem 0.9rem',
                        borderRadius: '0.6rem',
                        border: 'none',
                        background: cartVoucherCode
                          ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
                          : 'linear-gradient(135deg, rgba(16,185,129,0.45) 0%, rgba(5,150,105,0.45) 100%)',
                        color: 'white',
                        fontSize: '0.82rem', fontWeight: 700,
                        cursor: cartVoucherCode ? 'pointer' : 'not-allowed',
                        transition: 'all 0.18s',
                        boxShadow: cartVoucherCode ? '0 3px 10px rgba(16,185,129,0.28)' : 'none',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        opacity: cartVoucherCode ? 1 : 0.75,
                      }}
                    >
                      Apply
                    </button>
                  </div>

                  {/* Error Message */}
                  {voucherError && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{ fontSize: '0.73rem', color: 'var(--danger)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                    >
                      <AlertTriangle size={11} /> {voucherError}
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* Applied Voucher Badges */}
              {appliedVouchers.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
                  {appliedVouchers.map(v => {
                    const claim = voucherClaims?.find(c =>
                      c.voucherCode === v.code &&
                      c.customerId?.toString() === selectedCustomerId
                    );
                    const displayAmount = claim ? claim.balance : v.value;
                    return (
                      <motion.div
                        key={v.code}
                        initial={{ opacity: 0, scale: 0.88 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.88 }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          background: 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(5,150,105,0.07) 100%)',
                          padding: '0.25rem 0.4rem 0.25rem 0.5rem',
                          borderRadius: '2rem',
                          border: '1px solid rgba(16,185,129,0.25)',
                          fontSize: '0.72rem',
                          color: '#059669',
                          cursor: 'pointer',
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(239,68,68,0.08)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(239,68,68,0.25)'; (e.currentTarget as HTMLDivElement).style.color = '#dc2626'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(5,150,105,0.07) 100%)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(16,185,129,0.25)'; (e.currentTarget as HTMLDivElement).style.color = '#059669'; }}
                        onClick={() => removeVoucher(v.code)}
                      >
                        <Ticket size={11} />
                        <span>{v.code}</span>
                        <span style={{ opacity: 0.7 }}>({formatPrice(displayAmount)})</span>
                        <span style={{
                          width: 14, height: 14, borderRadius: '50%',
                          background: 'rgba(239,68,68,0.12)',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginLeft: 2
                        }}>
                          <X size={8} strokeWidth={3} style={{ color: '#ef4444' }} />
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '0.75rem',
                marginTop: '0.25rem',
                borderTop: '1px solid var(--border)'
              }}>
                <div>
                  <p style={{ margin: '0 0 0.125rem 0', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-black)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {depositAmount > 0 ? 'Balance Due' : 'Total Amount'}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                    <p style={{ margin: 0, fontSize: '1.65rem', fontWeight: 900, color: 'var(--text-dark)', letterSpacing: '-0.03em', lineHeight: 1 }}>
                      {formatPrice(finalTotal)}
                    </p>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-black)' }}>
                      ({totalItems} items)
                    </span>
                  </div>
                </div>
                <Button
                  style={{
                    height: '3rem',
                    padding: '0 1.5rem',
                    fontSize: '0.9375rem',
                    fontWeight: 700,
                    borderRadius: '1rem',
                    background: finalTotal === 0
                      ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
                      : 'linear-gradient(135deg, var(--primary) 0%, #4338ca 100%)',
                    boxShadow: finalTotal === 0
                      ? '0 6px 20px rgba(16, 185, 129, 0.25)'
                      : '0 6px 20px rgba(79, 70, 229, 0.25)',
                    border: 'none',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem'
                  }}
                  disabled={cart.length === 0 || !selectedCustomerId || isVerifyingOTP || !canAddSale}
                  title={!canAddSale ? "Ask Admin for permission" : ""}
                  onClick={() => {
                      if (!canAddSale) { showToast("Ask Admin for permission", "error"); return; }
                      handleCheckoutClick();
                  }}
                  icon={finalTotal === 0 ? <CheckCircle size={20} strokeWidth={2.5} /> : <CreditCard size={20} strokeWidth={2.5} />}
                  whileHover={(!selectedCustomerId || cart.length === 0 || isVerifyingOTP || !canAddSale) ? {} : {
                    scale: 1.02,
                    boxShadow: finalTotal === 0
                      ? '0 10px 25px rgba(16, 185, 129, 0.35)'
                      : '0 10px 25px rgba(79, 70, 229, 0.35)'
                  }}
                  whileTap={(!selectedCustomerId || cart.length === 0 || isVerifyingOTP || !canAddSale) ? {} : { scale: 0.98 }}
                >
                  {isVerifyingOTP ? 'Sending OTP...' : (!selectedCustomerId && cart.length > 0 ? 'Select Customer' : (finalTotal === 0 ? 'Complete Order' : (!canAddSale ? 'Locked' : 'Checkout')))}
                </Button>
              </div>
            </div>
          </div>
        </Card >
        </div>
      ) : (
        <QuotationSystem />
      )}

      {/* Items Summary Modal */}
      <Modal
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        title="Items Summary"
      >
        <div style={{ padding: '0 1rem 1rem 1rem' }}>
          <div style={{
            maxHeight: '400px',
            overflowY: 'auto',
            marginBottom: '1.5rem',
            paddingRight: '0.2rem',
            paddingTop: '0.3rem' // Added subtle padding at the top of the list instead
          }}>
            {cart.map((item, idx) => (
              <div key={item.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '1rem',
                borderBottom: idx === cart.length - 1 ? 'none' : '1px solid #f1f5f9',
                background: idx % 2 === 0 ? '#f8fafc' : 'white',
                borderRadius: '0.5rem',
                marginBottom: '0.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h4 style={{ margin: 0, fontWeight: 700, fontSize: '0.925rem', color: '#1e293b' }}>{item.name}</h4>
                  <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, opacity: 0.8 }}>
                    ({item.quantity} x {formatPrice(item.price)})
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontWeight: 800, color: '#0f172a', fontSize: '0.925rem' }}>
                    {formatPrice(item.price * item.quantity)}
                  </p>
                  {item.redeemedFromPackageId && (
                    <span style={{
                      fontSize: '0.65rem',
                      background: '#dcfce7',
                      color: '#16a34a',
                      padding: '0.1rem 0.4rem',
                      borderRadius: '1rem',
                      fontWeight: 700
                    }}>Redeemed</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Summary Totals */}
          <div style={{
            background: '#f8fafc',
            padding: '1rem',
            borderRadius: '1rem',
            marginBottom: '1.5rem',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>Subtotal</span>
              <span style={{ fontWeight: 700 }}>{formatPrice(subtotal)}</span>
            </div>
            {totalDiscount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#ef4444' }}>
                <span style={{ fontWeight: 600 }}>Discounts</span>
                <span style={{ fontWeight: 700 }}>-{formatPrice(totalDiscount)}</span>
              </div>
            )}
            {depositAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#0ea5e9' }}>
                <span style={{ fontWeight: 600 }}>Paid Earlier</span>
                <span style={{ fontWeight: 700 }}>-{formatPrice(depositAmount)}</span>
              </div>
            )}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              paddingTop: '0.75rem',
              marginTop: '0.75rem',
              borderTop: '2px solid #e2e8f0'
            }}>
              <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#0f172a' }}>Total Balance</span>
              <span style={{ fontWeight: 900, fontSize: '1.25rem', color: '#4f46e5' }}>{formatPrice(finalTotal)}</span>
            </div>
          </div>


          <div style={{ display: 'flex', gap: '1rem' }}>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setIsSummaryModalOpen(false)}
              style={{ borderRadius: '0.75rem', fontWeight: 700 }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              fullWidth
              disabled={isProcessingOrder}
              onClick={() => {
                if (finalTotal === 0) {
                  handleCompleteOrder();
                } else {
                  handleCheckout();
                }
              }}
              style={{
                borderRadius: '0.75rem',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
              }}
            >
              {isProcessingOrder ? 'Processing...' : `Confirm & ${finalTotal === 0 ? 'Complete' : 'Pay'}`}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Checkout Modal */}
      < Modal isOpen={isCheckoutOpen} onClose={() => setIsCheckoutOpen(false)} title="Summary & Payment" >
        <div className="space-y-8">
          <div style={{
            textAlign: 'center',
            padding: '2rem 1rem',
            background: 'var(--bg-body)',
            borderRadius: '1.5rem',
            border: '1px solid var(--border)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '4px',
              background: 'linear-gradient(90deg, transparent, var(--primary), transparent)'
            }} />
            <p style={{ color: 'var(--text-black)', fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Amount Due</p>
            <h2 style={{ fontSize: '3rem', fontWeight: 900, margin: 0, color: 'var(--text-dark)', letterSpacing: '-0.04em', lineHeight: 1 }}>{formatPrice(finalTotal)}</h2>
            {appliedVouchers.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                {appliedVouchers.map(v => {
                  const claim = voucherClaims.find(c =>
                    c.voucherCode === v.code &&
                    c.customerId?.toString() === selectedCustomerId
                  );
                  const deduction = claim ? Math.min(claim.balance, cartTotal) : v.value;
                  return (
                    <span key={v.code} style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--success)', padding: '0.25rem 0.75rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '2rem', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                      {v.code} (-{formatPrice(deduction)})
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* VOUCHER REDEMPTION SECTION */}
          <div style={{ background: 'var(--bg-body)', padding: '1.25rem', borderRadius: '1.25rem', border: '1px solid var(--border)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
            <label className="input-label" style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.65rem', color: 'var(--text-dark)', fontWeight: 700, fontSize: '0.875rem' }}>
              <Ticket size={18} className="text-primary" /> Redeem Voucher
            </label>
            {appliedVouchers.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {appliedVouchers.map(v => {
                  const claim = voucherClaims.find(c =>
                    c.voucherCode === v.code &&
                    c.customerId?.toString() === selectedCustomerId
                  );
                  const deduction = claim ? claim.balance : v.value; // Simplified for display
                  return (
                    <motion.div
                      key={v.code}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--success-light)', padding: '0.875rem', borderRadius: '1rem', border: '1px solid var(--success-border)' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ padding: '0.5rem', background: 'white', borderRadius: '0.75rem', boxShadow: '0 2px 4px rgba(16, 185, 129, 0.1)' }}>
                          <Ticket size={18} style={{ color: 'var(--success)' }} />
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 800, color: 'var(--success-dark)' }}>{v.code}</p>
                          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>Balance: {formatPrice(deduction)}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeVoucher(v.code)}
                        style={{
                          border: 'none',
                          background: 'white',
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          color: 'var(--danger)',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                        }}
                      >
                        <X size={18} />
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {selectedCustomerId === 'WALK_IN' || !selectedCustomerId ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#FFF7ED', padding: '0.875rem', borderRadius: '1rem', border: '1px solid #FFEDD5', color: '#9A3412', fontSize: '0.875rem', fontWeight: 600 }}>
                    <AlertTriangle size={18} />
                    <span>Select a registered customer to redeem vouchers.</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <Input
                        placeholder="Enter Voucher Code"
                        value={voucherCode}
                        onChange={(e) => { setVoucherCode(e.target.value); setVoucherError(''); }}
                        style={{ margin: 0, height: '3rem', borderRadius: '0.875rem' }}
                      />
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => handleApplyVoucher(voucherCode)}
                      disabled={!voucherCode}
                      style={{ height: '3rem', padding: '0 1.25rem', borderRadius: '0.875rem', fontWeight: 700 }}
                    >
                      Apply
                    </Button>
                  </div>
                )}
              </div>
            )}
            {voucherError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ fontSize: '0.8125rem', color: 'var(--danger)', marginTop: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.375rem', paddingLeft: '0.25rem' }}
              >
                <AlertTriangle size={14} /> {voucherError}
              </motion.div>
            )}
          </div>

          {finalTotal > 0 && (
            <div>
              <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '1rem' }}>Select Payment Method</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                {paymentMethods.map(method => (
                  <button
                    key={method.id}
                    onClick={() => setSelectedPayment(method.id)}
                    style={{
                      padding: '1rem 0.75rem',
                      borderRadius: '1.25rem',
                      border: selectedPayment === method.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                      background: selectedPayment === method.id ? 'var(--bg-card)' : 'var(--bg-card)',
                      boxShadow: selectedPayment === method.id ? 'var(--shadow-lg)' : 'var(--shadow-sm)',
                      color: selectedPayment === method.id ? 'var(--primary)' : 'var(--text-dark)',
                      fontWeight: 700,
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.65rem',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    {selectedPayment === method.id && (
                      <div style={{ position: 'absolute', top: '0.75rem', right: '0.75rem' }}>
                        <CheckCircle size={16} strokeWidth={3} />
                      </div>
                    )}
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: selectedPayment === method.id ? 'var(--primary-light)' : 'var(--bg-body)',
                      color: selectedPayment === method.id ? 'var(--primary)' : 'var(--text-black)',
                      transition: 'all 0.25s'
                    }}>
                      {method.id === 'CASH' ? <DollarSign size={18} /> : method.id === 'RAZORPAY' ? <CreditCard size={18} /> : <Wallet size={18} />}
                    </div>
                    {method.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <Button variant="ghost" onClick={() => setIsCheckoutOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCheckout}
              disabled={finalTotal > 0 && !selectedPayment}
              style={{ minWidth: '8rem' }}
            >
              {finalTotal === 0 ? 'Confirm Redemption' : 'Confirm Payment'}
            </Button>
          </div>
        </div>
      </Modal >

      {/* SPECIALIST SELECTION MODAL */}
      <Modal isOpen={isSpecialistModalOpen} onClose={() => { setIsSpecialistModalOpen(false); setSpecialistSearch(''); }} title="Select Specialist">
        {/* Search */}
        <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
          <Search size={14} style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-black)', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Search specialist..."
            value={specialistSearch}
            onChange={e => setSpecialistSearch(e.target.value)}
            autoFocus
            style={{
              width: '100%', boxSizing: 'border-box',
              height: '2.25rem', padding: '0 0.75rem 0 2.2rem',
              fontSize: '0.85rem', border: '1px solid var(--border)',
              borderRadius: '0.75rem', outline: 'none',
              background: 'var(--bg-input)', color: 'var(--text-dark)',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--primary)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
          />
        </div>

        {/* Specialist grid – 4 per row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', maxHeight: '320px', overflowY: 'auto' }}>

          {/* Any Specialist card */}
          {('any specialist').includes(specialistSearch.toLowerCase()) && (
            <motion.div
              whileHover={{ scale: 1.03, translateY: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => { handleSpecialistChange(''); setSpecialistSearch(''); setIsSpecialistModalOpen(false); }}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: '0.25rem', padding: '0.4rem',
                borderRadius: '0.85rem', textAlign: 'center',
                background: selectedSpecialistId === '' ? 'var(--primary-light)' : 'var(--bg-body)',
                border: selectedSpecialistId === '' ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {/* <div style={{
                width: '34px', height: '34px', borderRadius: '10px',
                background: selectedSpecialistId === '' ? 'var(--primary)' : 'var(--bg-subtle)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <User size={18} style={{ color: selectedSpecialistId === '' ? 'white' : 'var(--text-black)' }} />
              </div> */}
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-dark)', lineHeight: 1.2 }}>Any</p>
                <p style={{ margin: 0, fontSize: '0.62rem', color: 'var(--text-black)', lineHeight: 1.2 }}>Auto-assign</p>
              </div>
            </motion.div>
          )}

          {/* Stylists */}
          {stylists
            .filter(s => s.name.toLowerCase().includes(specialistSearch.toLowerCase()))
            .map(s => (
              <motion.div
                key={s.id}
                whileHover={{ scale: 1.03, translateY: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => { handleSpecialistChange(s.id.toString()); setSpecialistSearch(''); setIsSpecialistModalOpen(false); }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: '0.25rem', padding: '0.4rem',
                  borderRadius: '0.85rem', textAlign: 'center',
                  background: selectedSpecialistId === s.id ? 'var(--primary-light)' : 'var(--bg-body)',
                  border: selectedSpecialistId === s.id ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                  cursor: 'pointer', transition: 'all 0.15s',
                  opacity: s.isAvailable === false ? 0.65 : 1,
                }}
              >
                <div style={{ position: 'relative' }}>
                  {/* <div style={{
                    width: '34px', height: '34px', borderRadius: '10px',
                    background: selectedSpecialistId === s.id ? 'var(--primary)' : 'var(--bg-subtle)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <UserCog size={18} style={{ color: selectedSpecialistId === s.id ? 'white' : 'var(--primary)' }} />
                  </div> */}
                  {/* <div style={{
                    position: 'absolute', bottom: '-1px', right: '-1px',
                    width: '10px', height: '10px', borderRadius: '50%',
                    border: '2px solid var(--bg-card)',
                    background: s.isAvailable !== false ? '#10B981' : '#EF4444',
                  }} /> */}
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-dark)', lineHeight: 1.2 }}>{s.name}</p>
                  <p style={{ margin: 0, fontSize: '0.62rem', color: s.isAvailable === false ? '#EF4444' : '#10B981', fontWeight: 600, lineHeight: 1.2 }}>
                    {s.isAvailable === false ? 'Off' : 'Available'}
                  </p>
                </div>
              </motion.div>
            ))
          }

          {/* Empty state */}
          {specialistSearch && !stylists.some(s => s.name.toLowerCase().includes(specialistSearch.toLowerCase())) && !('any specialist').includes(specialistSearch.toLowerCase()) && (
            <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-black)', fontSize: '0.82rem', padding: '1rem 0', margin: 0 }}>No specialist found</p>
          )}
        </div>

        <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={() => { setIsSpecialistModalOpen(false); setSpecialistSearch(''); }}>Close</Button>
        </div>
      </Modal>

      {/* ADD CUSTOMER MODAL */}
      < Modal isOpen={isAddCustomerModalOpen} onClose={() => setIsAddCustomerModalOpen(false)} title="Add New Customer" >
        <form onSubmit={handleAddCustomer} className="space-y-4">
          {/* <div className="bg-blue-50 p-3 rounded-lg flex gap-3 text-sm text-blue-800">
            <Smartphone size={18} className="shrink-0 mt-0.5" />
            <p className="m-0">Mobile number is used as the unique identifier for customer loyalty and history.</p>
          </div> */}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
            <Input
              label="Customer Name"
              placeholder="e.g. Jane Doe"
              value={newCustomerName}
              onChange={e => setNewCustomerName(e.target.value)}
              required
            />
            <Input
              label="Email Address"
              placeholder="jane@example.com"
              type="email"
              value={newCustomerEmail}
              onChange={e => setNewCustomerEmail(e.target.value)}
            />
            <Input
              label="Date of Birth (DD/MM)"
              placeholder="DD/MM"
              value={newCustomerDOB || ''}
              onChange={(e) => {
                let val = e.target.value.replace(/\D/g, '');
                if (val.length > 4) val = val.slice(0, 4);
                if (val.length > 2) val = val.slice(0, 2) + '/' + val.slice(2);
                setNewCustomerDOB(val);
              }}
              maxLength={5}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
            <Input
              label="Mobile Number"
              placeholder="e.g. 91234567"
              value={newCustomerPhone}
              onChange={e => setNewCustomerPhone(e.target.value)}
              required
            />
            <Input
              label="Location"
              placeholder="Springfield"
              value={newCustomerCity}
              onChange={e => setNewCustomerCity(e.target.value)}
            />
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>Status</label>
              <select
                value={newCustomerRole}
                onChange={e => setNewCustomerRole(e.target.value)}
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
                value={newCustomerAgeGroup}
                onChange={e => setNewCustomerAgeGroup(e.target.value)}
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

          <div className="mt-4">
            <AttachmentsInput
              attachments={newCustomerAttachments}
              onChange={setNewCustomerAttachments}
            />
          </div>

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

          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
            <Button type="button" variant="ghost" onClick={() => setIsAddCustomerModalOpen(false)} disabled={isAddingCustomer}>Cancel</Button>
            <Button type="submit" disabled={isAddingCustomer} isLoading={isAddingCustomer}>
              Add Customer
            </Button>
          </div>
        </form>
      </Modal >

      {/* PAYMENT MODAL */}
      < Modal isOpen={paymentModal.open} onClose={() => !paymentModal.processing && setPaymentModal({ ...paymentModal, open: false })} title="Complete Payment" >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          style={{ padding: '0rem' }}
        >
          {/* Header */}
          {/* Header Removed (Moved to Title) */}

          {/* Amount Display */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            style={{
              position: 'relative',
              overflow: 'hidden',
              background: 'var(--primary-light)',
              padding: '0.4rem 0.5rem',
              borderRadius: '1.25rem',
              textAlign: 'center',
              marginBottom: '0.5rem',
              border: '1px solid var(--primary)40',
              boxShadow: 'var(--shadow-md)'
            }}
          >
            <div style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 0.5rem' }}>
              <p style={{ color: 'var(--primary)', fontSize: '1rem', fontWeight: 800, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Amount Due</p>
              <motion.h1
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-dark)', margin: '0' }}
              >
                {formatPrice(paymentModal.amount)}
              </motion.h1>
            </div>
          </motion.div>

          {/* Discount Section inside Modal */}


          {/* Voucher section removed - moved to early checkout stage or persistent cart view */}

          {/* Payment Method Selection */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            style={{ marginBottom: '2rem' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 700, color: '#334155', marginLeft: '0.25rem' }}>
                {isSplitPaymentMode ? 'Payment Breakdown' : 'Choose Payment Method'}
              </label>
              <motion.button
                type="button"
                onClick={() => setIsSplitPaymentMode(!isSplitPaymentMode)}
                whileHover={{ scale: 1.02, backgroundColor: '#f8fafc' }}
                whileTap={{ scale: 0.98 }}
                style={{
                  background: isSplitPaymentMode ? '#fefce8' : '#f8fafc',
                  border: isSplitPaymentMode ? '1px solid #fef08a' : '1px solid #e2e8f0',
                  borderRadius: '9999px',
                  padding: '0.4rem 1.1rem',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  color: '#854d0e',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  transition: 'all 0.2s ease'
                }}
              >
                {isSplitPaymentMode ? 'Single Payment' : 'Split Payment'}
              </motion.button>
            </div>

            {isSplitPaymentMode ? (
              /* Split Payment UI */
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '9999px',
                    background: (Math.max(0, finalTotal - splitPayments.reduce((sum, p) => sum + p.amount, 0))) > 0.5 ? '#FEF2F2' : '#ECFDF5',
                    color: (Math.max(0, finalTotal - splitPayments.reduce((sum, p) => sum + p.amount, 0))) > 0.5 ? '#EF4444' : '#059669',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    border: (Math.max(0, finalTotal - splitPayments.reduce((sum, p) => sum + p.amount, 0))) > 0.5 ? '1px solid #FECACA' : '1px solid #A7F3D0'
                  }}>
                    <span>Remaining Due:</span>
                    <span style={{ fontSize: '1rem', fontWeight: 800 }}>
                      {formatPrice(Math.max(0, finalTotal - splitPayments.reduce((sum, p) => sum + p.amount, 0)))}
                    </span>
                  </div>
                </div>

                {/* Added Payments List */}
                {splitPayments.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    {splitPayments.map(payment => (
                      <motion.div
                        key={payment.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white"
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '1rem', borderRadius: '0.75rem',
                          border: '1px solid #e2e8f0',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div style={{
                            padding: '0.5rem', borderRadius: '0.5rem',
                            background: payment.method === 'CASH' ? '#ECFDF5' : '#EEF2FF',
                            color: payment.method === 'CASH' ? '#059669' : '#4F46E5',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                            {payment.method === 'CASH' ? <DollarSign size={18} /> : <CreditCard size={18} />}
                          </div>
                          <div>
                            <span style={{ display: 'block', fontWeight: 700, color: '#334155', fontSize: '0.95rem' }}>{payment.method}</span>
                            <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>Processed</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '1.1rem' }}>{formatPrice(payment.amount)}</span>
                          <button
                            onClick={() => handleRemoveSplitPayment(payment.id)}
                            style={{
                              border: 'none', background: '#fee2e2', borderRadius: '50%', width: '28px', height: '28px',
                              cursor: 'pointer', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'all 0.2s'
                            }}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', background: '#f8fafc', borderRadius: '0.75rem', border: '1px dashed #cbd5e1', marginBottom: '1.5rem' }}>
                    Start adding payments to split the total amount.
                  </div>
                )}

                {/* Add Payment Controls */}
                {Math.max(0, finalTotal - splitPayments.reduce((sum, p) => sum + p.amount, 0)) > 0.5 && (
                  <div style={{
                    display: 'flex', gap: '1rem', alignItems: 'flex-end',
                    background: '#f8fafc', padding: '1.25rem', borderRadius: '1rem',
                    border: '1px solid #e2e8f0'
                  }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Method</label>
                      <div style={{ position: 'relative' }}>
                        <select
                          value={currentSplitMethod}
                          onChange={(e) => setCurrentSplitMethod(e.target.value)}
                          style={{
                            width: '100%', padding: '0.6rem 0.75rem', borderRadius: '0.5rem',
                            border: '1px solid #cbd5e1',
                            background: 'white', color: '#334155', fontSize: '0.95rem', fontWeight: 600, outline: 'none',
                            appearance: 'none', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                          }}
                        >
                          {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                        <div style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }}>
                          <ChevronDown size={14} />
                        </div>
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Amount</label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: '#94a3b8' }}>$</span>
                        <input
                          type="number"
                          placeholder="0.00"
                          value={currentSplitAmount}
                          onChange={(e) => setCurrentSplitAmount(e.target.value)}
                          style={{
                            width: '100%', padding: '0.6rem 0.75rem 0.6rem 1.75rem', borderRadius: '0.5rem',
                            border: '1px solid #cbd5e1',
                            background: 'white', color: '#334155', fontSize: '0.95rem', fontWeight: 600, outline: 'none',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                          }}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleAddSplitPayment(); }}
                        />
                      </div>
                    </div>
                    <Button
                      onClick={handleAddSplitPayment}
                      disabled={!currentSplitAmount || parseFloat(currentSplitAmount) <= 0}
                      style={{ height: '42px', width: '42px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '0.5rem' }}
                    >
                      <Plus size={20} />
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                {paymentMethods.map((method) => {
                  const isSelected = paymentModal.method === method.id;

                  // Determine styling based on method type
                  let style = {
                    activeBg: '#f8fafc', activeBorder: '#64748b', activeText: '#334155', iconBg: '#f1f5f9', iconColor: '#475569',
                    icon: <CreditCard size={20} />
                  };

                  if (method.id === 'CASH') {
                    style = {
                      activeBg: '#ecfdf5', activeBorder: '#10b981', activeText: '#047857', iconBg: '#d1fae5', iconColor: '#059669',
                      icon: <CreditCard size={20} />
                    };
                  } else if (method.id === 'RAZORPAY') {
                    style = {
                      activeBg: '#eef2ff', activeBorder: '#6366f1', activeText: '#4338ca', iconBg: '#e0e7ff', iconColor: '#4f46e5',
                      icon: <Smartphone size={20} />
                    };
                  } else {
                    // Generic Styling (Blueish/Gray)
                    style = {
                      activeBg: '#f0f9ff', activeBorder: '#0ea5e9', activeText: '#0369a1', iconBg: '#e0f2fe', iconColor: '#0284c7',
                      icon: <CreditCard size={20} />
                    };
                  }

                  return (
                    <motion.button
                      key={method.id}
                      type="button"
                      onClick={() => setPaymentModal({ ...paymentModal, method: method.id })}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      style={{
                        position: 'relative',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '0.75rem',
                        border: isSelected ? `2px solid ${style.activeBorder} ` : '2px solid #e2e8f0',
                        background: isSelected ? style.activeBg : 'white',
                        color: isSelected ? style.activeText : '#475569',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: '0.65rem',
                        transition: 'all 0.2s ease',
                        width: '100%',
                        boxShadow: isSelected ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none'
                      }}
                    >
                      <div style={{
                        padding: '0.5rem',
                        borderRadius: '0.5rem',
                        background: isSelected ? 'white' : '#f1f5f9',
                        color: isSelected ? style.iconColor : '#64748b',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        {style.icon}
                      </div>

                      <div style={{ flex: 1, textAlign: 'left' }}>
                        <span style={{ display: 'block', fontWeight: 700, fontSize: '0.875rem' }}>
                          {method.name}
                        </span>
                        {isSelected && <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, opacity: 0.8, marginTop: '0.125rem' }}>Selected</span>}
                      </div>

                      {isSelected && (
                        <div style={{ background: 'white', borderRadius: '50%', padding: '0.125rem', display: 'flex', alignItems: 'center' }}>
                          <CheckCircle size={18} style={{ color: style.activeBorder }} />
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* Checkout Options - Discount Toggle */}
          <div style={{ marginBottom: '1.5rem', padding: '0 0.25rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.9375rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={activeOrderTab.showManualDiscount}
                  onChange={(e) => setShowManualDiscount(e.target.checked)}
                  style={{
                    width: '1.25rem',
                    height: '1.25rem',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    accentColor: '#6366f1'
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Ticket size={18} style={{ color: '#6366f1' }} />
                <span>Discount</span>
              </div>
            </label>
          </div>

          {/* Inputs Row: Discount & Payment Amount */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
            {/* Discount Section */}
            {activeOrderTab.showManualDiscount ? (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: 'hidden' }}
              >
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 700, color: '#334155', marginBottom: '0.75rem', marginLeft: '0.25rem' }}>
                  <Ticket size={16} /> Discount Amount
                </label>

                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)',
                    color: '#94a3b8', fontSize: '1.25rem', fontWeight: 700, zIndex: 10
                  }}>
                    {useCurrency().symbol}
                  </span>
                  <input
                    type="number"
                    value={activeOrderTab.manualDiscount}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      const maxAllowed = Math.max(0, subtotal - voucherDeduction);
                      if (val > maxAllowed) {
                        setManualDiscount(maxAllowed.toString());
                        showToast(`Discount cannot exceed ${formatPrice(maxAllowed)} `, 'warning');
                      } else {
                        setManualDiscount(e.target.value);
                      }
                    }}
                    placeholder="0"
                    style={{
                      width: '100%', padding: '1rem 1rem 1rem 3rem', fontSize: '1.25rem', fontWeight: 700,
                      borderRadius: '0.75rem', border: '2px solid #e2e8f0', outline: 'none',
                      background: 'white',
                      transition: 'border-color 0.2s',
                      boxSizing: 'border-box',
                      color: 'var(--text-dark)',
                      textAlign: 'right'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#6366f1'}
                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                  />
                </div>
              </motion.div>
            ) : (
              <div></div> // Empty column to maintain grid layout
            )}

            {/* Amount Input */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: '#334155', marginLeft: '0.25rem' }}>
                  {paymentModal.method === 'CASH' ? 'Amount Received' : 'Payment Amount'}
                </label>
                {/* {paymentModal.method === 'CASH' && paymentModal.tendered >= paymentModal.amount && (
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', marginRight: '0.5rem' }}>Change Due</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#16a34a' }}>{formatPrice(paymentModal.tendered - paymentModal.amount)}</span>
                  </div>
                )} */}
              </div>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)',
                  color: '#94a3b8', fontSize: '1.25rem', fontWeight: 700, zIndex: 10
                }}>
                  {useCurrency().symbol}
                </span>
                <input
                  type="number"
                  value={paymentModal.tendered}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setPaymentModal(prev => ({
                      ...prev,
                      tendered: val,
                      amount: prev.method === 'CASH' ? prev.amount : val // Update amount if not cash
                    }));
                  }}
                  disabled={paymentModal.processing}
                  style={{
                    width: '100%', padding: '1rem 1rem 1rem 3rem', fontSize: '1.25rem', fontWeight: 700,
                    borderRadius: '0.75rem', border: (paymentModal.method === 'CASH' && paymentModal.tendered < paymentModal.amount) ? '2px solid #fee2e2' : '2px solid #e2e8f0', outline: 'none',
                    background: 'white',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box',
                    textAlign: 'right',
                  }}
                  onFocus={(e) => {
                    if (paymentModal.method === 'CASH') {
                      e.target.style.borderColor = (paymentModal.tendered < paymentModal.amount) ? '#ef4444' : '#6366f1';
                    } else {
                      e.target.style.borderColor = '#6366f1';
                    }
                  }}
                  onBlur={(e) => {
                    if (paymentModal.method === 'CASH') {
                      e.target.style.borderColor = (paymentModal.tendered < paymentModal.amount) ? '#ef4444' : '#e2e8f0';
                    } else {
                      e.target.style.borderColor = '#e2e8f0';
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                      e.preventDefault();
                    }
                  }}
                  step="0.01"
                  min="0"
                />
              </div>
              {paymentModal.method === 'CASH' && paymentModal.tendered < paymentModal.amount && (
                <p style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 700, marginTop: '0.5rem', marginLeft: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <AlertTriangle size={12} /> Insufficient Amount. Need {formatPrice(paymentModal.amount - paymentModal.tendered)} more.
                </p>
              )}

              {/* Change Due Display Field */}
              {paymentModal.method === 'CASH' && paymentModal.tendered > paymentModal.amount && (
                <div style={{ marginTop: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: '#16a34a', marginBottom: '0.75rem', marginLeft: '0.25rem' }}>
                    Change Due
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{
                      position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)',
                      color: '#16a34a', fontSize: '1.25rem', fontWeight: 700, zIndex: 10
                    }}>
                      {useCurrency().symbol}
                    </span>
                    <input
                      type="text"
                      readOnly
                      value={((paymentModal.tendered - paymentModal.amount).toFixed(2))}
                      style={{
                        width: '100%', padding: '1rem 1rem 1rem 3rem', fontSize: '1.25rem', fontWeight: 700,
                        borderRadius: '0.75rem', border: '2px solid #bbf7d0', outline: 'none',
                        background: '#f0fdf4',
                        color: '#16a34a',
                        textAlign: 'right',
                      }}
                    />
                  </div>
                </div>
              )}
            </motion.div>
          </div>


          {/* Action Buttons */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            style={{ display: 'flex', gap: '1rem', paddingTop: '1rem' }}
          >
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setPaymentModal({ ...paymentModal, open: false })}
              disabled={paymentModal.processing}
              style={{
                flex: 1, padding: '1rem', background: '#f1f5f9', color: '#334155',
                border: 'none', borderRadius: '0.75rem', fontSize: '1rem', fontWeight: 700,
                cursor: 'pointer', opacity: paymentModal.processing ? 0.5 : 1
              }}
            >
              Cancel
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                // Always queue print on this button click
                printRequestedRef.current = true;
                setPrintQueued(true);

                if (!paymentModal.processing) {
                  handlePaymentClick();
                } else {
                  showToast('Receipt will be printed after processing completes', 'info');
                }
              }}
              // Disabled logic: only disable if amount <= 0 (invalid)
              // Don't disable on processing, so user can queue print
              disabled={paymentModal.amount <= 0 || printQueued}
              style={{
                flex: 1.5, padding: '1rem',
                background: printQueued ? '#64748b' : 'linear-gradient(to right, #4f46e5, #2563eb)', // Gray if queued, else Indigo
                color: 'white', border: 'none', borderRadius: '0.75rem',
                fontSize: '1rem', fontWeight: 700, cursor: printQueued ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                opacity: (paymentModal.amount <= 0) ? 0.5 : 1
              }}
            >
              <Printer size={20} />
              {printQueued ? 'Print Queued' : 'Print and Pay'}
            </motion.button>
            {paymentModal.method === 'RAZORPAY' && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={generateRazorpayQR}
                disabled={isQrLoading || paymentModal.amount <= 0}
                style={{
                  flex: 1.5, padding: '1rem',
                  background: 'linear-gradient(to right, #6366f1, #4f46e5)',
                  color: 'white', border: 'none', borderRadius: '0.75rem',
                  fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  opacity: (paymentModal.amount <= 0 || isQrLoading) ? 0.5 : 1
                }}
              >
                {isQrLoading ? (
                  <span className="loader" style={{ width: 20, height: 20, border: '2px solid white', borderBottomColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }}></span>
                ) : (
                  <>
                    <Smartphone size={20} />
                    Show QR / Share
                  </>
                )}
              </motion.button>
            )}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                // Cancel print queue if Pay button is clicked
                printRequestedRef.current = false;
                setPrintQueued(false);

                if (!paymentModal.processing) {
                  handlePaymentClick();
                }
              }}
              // Don't disable on processing to allow cancelling print queue (or re-triggering pay if needed)
              disabled={paymentModal.amount <= 0}
              style={{
                flex: 2, padding: '1rem',
                background: 'linear-gradient(to right, #10b981, #059669)',
                color: 'white', border: 'none', borderRadius: '0.75rem',
                fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                opacity: (paymentModal.amount <= 0) ? 0.5 : 1
              }}
            >
              {paymentModal.processing ? (
                <>
                  <span className="loader" style={{ width: 20, height: 20, border: '2px solid white', borderBottomColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }}></span>
                  Processing...
                </>
              ) : (paymentModal.method === 'CASH' && paymentModal.tendered < paymentModal.amount) ? (
                <>
                  <AlertTriangle size={20} />
                  Partial Amount
                </>
              ) : (
                <>
                  <CreditCard size={20} />
                  Pay {formatPrice(paymentModal.amount)}
                </>
              )}
            </motion.button>
          </motion.div>
        </motion.div>
      </Modal >

      {/* Partial Payment Confirmation Modal */}
      < Modal isOpen={showPartialConfirmation} onClose={() => setShowPartialConfirmation(false)} title="Confirm Partial Payment" >
        <div style={{ padding: '1.5rem' }}>
          <div style={{ background: '#fefce8', borderLeft: '4px solid #facc15', padding: '1rem', marginBottom: '1.5rem', borderRadius: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <AlertTriangle size={24} style={{ color: '#ca8a04', flexShrink: 0 }} />
              <div>
                <h3 style={{ color: '#854d0e', fontWeight: 700, margin: '0 0 0.25rem 0', fontSize: '1rem' }}>Insufficient Amount</h3>
                <p style={{ fontSize: '0.875rem', color: '#a16207', margin: 0, lineHeight: 1.5 }}>
                  You are receiving <span style={{ fontWeight: 700 }}>{formatPrice(paymentModal.tendered)}</span>, which is less than the total due <span style={{ fontWeight: 700 }}>{formatPrice(paymentModal.amount)}</span>.
                </p>
                <p style={{ fontSize: '0.875rem', color: '#a16207', marginTop: '0.5rem', fontWeight: 700 }}>
                  Outstanding Balance: {formatPrice(paymentModal.amount - paymentModal.tendered)}
                </p>
              </div>
            </div>
          </div>

          <p style={{ color: '#475569', marginBottom: '1.5rem', fontWeight: 500, fontSize: '1rem', textAlign: 'center' }}>
            Do you want to record this transaction as a <span style={{ color: '#0f172a', fontWeight: 800 }}>Partial Payment</span>?
          </p>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowPartialConfirmation(false)}
              style={{
                flex: 1, padding: '1rem', background: '#f1f5f9', color: '#334155',
                border: 'none', borderRadius: '0.75rem', fontSize: '1rem', fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Cancel
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={processPayment}
              disabled={paymentModal.processing}
              style={{
                flex: 1, padding: '1rem',
                background: 'linear-gradient(to right, #eab308, #ca8a04)', // Yellow gradient
                color: 'white', border: 'none', borderRadius: '0.75rem',
                fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 6px -1px rgba(234, 179, 8, 0.25)',
                opacity: paymentModal.processing ? 0.7 : 1
              }}
            >
              {paymentModal.processing ? 'Processing...' : 'Accept Partial Payment'}
            </motion.button>
          </div>
        </div>
      </Modal >

      {/* Success Modal */}
      < Modal isOpen={showSuccessModal} onClose={() => setShowSuccessModal(false)}>
        <div style={{
          background: 'white',
          borderRadius: '1.5rem',
          padding: '2rem',
          maxWidth: '500px',
          margin: '0 auto',
          textAlign: 'center'
        }}>
          {/* Success Icon */}
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem'
          }}>
            <CheckCircle size={48} color="white" />
          </div>

          {/* Success Message */}
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#0f172a',
            marginBottom: '0.5rem'
          }}>
            Order Completed!
          </h2>

          <p style={{
            fontSize: '1rem',
            color: '#64748b',
            marginBottom: '2rem',
            lineHeight: 1.6
          }}>
            {successMessage}
          </p>

          {/* Close Button */}
          <Button
            onClick={() => {
              setShowSuccessModal(false);
              setSuccessMessage('');
            }}
            style={{
              padding: '0.875rem 2rem',
              fontSize: '1rem',
              borderRadius: '1rem',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
              width: '100%'
            }}
          >
            Done
          </Button>

          {/* Print Button */}
          {lastCompletedSale && (
            <Button
              onClick={() => {
                const sale = lastCompletedSale;
                const rawInvoice = sale.invoices?.[0]?.invoiceNumber || sale.invoiceNumber || sale.saleNumber || 'N/A';
                const invoiceNum = rawInvoice.replace(/^SALE-/, '');
                const invoiceDisplayId = invoiceNum;

                const receiptData = {
                  storeName: salonSettings?.salonName || user?.businessName || 'Salon POS',
                  storeAddress: salonSettings?.salonAddress || user?.businessAddress || 'City Center',
                  storePhone: salonSettings?.salonPhone || user?.businessPhone || '9876543210',
                  invoiceNumber: invoiceDisplayId,
                  date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString(),
                  customerName: selectedCustomer?.name || 'Walk-in Customer',
                  items: sale.items?.map((item: any) => ({
                    name: item.name,
                    quantity: item.quantity,
                    price: item.price
                  })) || cart.map(item => ({
                    name: item.name,
                    quantity: item.quantity,
                    price: item.price
                  })),
                  subtotal: sale.subtotal || subtotal,
                  discount: sale.discount || totalDiscount,
                  total: sale.totalAmount || finalTotal,
                  paymentMethod: sale.paymentMethod || paymentModal.method,
                  cashierName: user?.name || 'Admin',
                  currencySymbol: symbol
                };

                const html = generateReceiptHtml(receiptData);
                const printWindow = window.open('', '_blank', 'width=400,height=600');
                if (printWindow) {
                  printWindow.document.write(html);
                  printWindow.document.close();
                }
              }}
              style={{
                marginTop: '1rem',
                padding: '0.875rem 2rem',
                fontSize: '1rem',
                borderRadius: '1rem',
                background: 'var(--bg-card)',
                color: 'var(--primary)',
                border: '1px solid var(--primary)',
                boxShadow: 'none',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              <Printer size={20} /> Print Receipt
            </Button>
          )}

        </div>
      </Modal>

      {/* Attachments Modal */}
      <Modal isOpen={isAttachmentsModalOpen} onClose={() => setIsAttachmentsModalOpen(false)} title="Add Attachments">
        <AttachmentsInput
          attachments={attachments}
          onChange={setAttachments}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
          <Button onClick={() => setIsAttachmentsModalOpen(false)}>Done</Button>
        </div>
      </Modal>

      <Modal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        title="Scan to Pay"
      >
        <div className="flex flex-col items-center p-4 space-y-6">
          <div className="text-center">
            <p className="text-xl font-bold text-black">{formatPrice(razorpayLinkData?.amount / 100 || 0)}</p>
            <p className="text-sm text-black">Scan this QR code with any UPI app</p>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-inner border">
            {razorpayLinkData?.short_url && (
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(razorpayLinkData.short_url)}`}
                alt="Payment QR"
                className="w-64 h-64"
              />
            )}
          </div>

          <div className="w-full space-y-3">
            <Button
              variant="primary"
              className="w-full flex items-center justify-center gap-2"
              onClick={() => {
                const message = `Payment link for your service at Salon ✨\n\nLink: ${razorpayLinkData?.short_url}`;
                const whatsappUrl = `https://web.whatsapp.com/send?phone=${selectedCustomer?.phone?.replace(/\D/g, '')}&text=${encodeURIComponent(message)}`;
                window.open(whatsappUrl, '_blank');
              }}
            >
              <Smartphone size={18} />
              Share via WhatsApp
            </Button>

            <div className="flex items-center justify-center gap-2 text-blue-600 animate-pulse">
              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
              <span className="text-sm font-medium">Waiting for payment confirmation...</span>
            </div>
          </div>

          <p className="text-xs text-black text-center">
            This window will close automatically once the payment is completed.
          </p>
        </div>
      </Modal>

      {/* OTP Verification Modal */}
      <Modal
        isOpen={isOTPModalOpen}
        onClose={() => {
          setIsOTPModalOpen(false);
          setPendingAction(null);
        }}
        title="Customer Verification Required"
        closeOnOverlayClick={false}
      >
        <div style={{ padding: '1.5rem', textAlign: 'center' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: '#f0fdf4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem'
          }}>
            <Smartphone size={32} style={{ color: '#22c55e' }} />
          </div>

          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>
            Verify Package/Voucher Redemption
          </h3>
          <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1.5rem', lineHeight: 1.5 }}>
            A verification code has been sent to <strong>{selectedCustomer?.name}</strong>'s WhatsApp ({selectedCustomer?.phone}). Please enter it below to authorize this free transaction.
          </p>

          <div style={{ marginBottom: '1.5rem' }}>
            <input
              type="text"
              placeholder="Enter 4-digit code"
              value={otpValue}
              onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
              disabled={isVerifyingOTP}
              style={{
                width: '100%',
                padding: '1rem',
                fontSize: '1.5rem',
                fontWeight: 700,
                textAlign: 'center',
                letterSpacing: '0.5rem',
                borderRadius: '0.75rem',
                border: otpError ? '2px solid #ef4444' : '2px solid #e2e8f0',
                outline: 'none',
                background: '#f8fafc'
              }}
            />
            {otpError && (
              <p style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 600, marginTop: '0.5rem' }}>
                {otpError}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleVerifyOTP}
              disabled={isVerifyingOTP || (otpValue.length !== 6 && otpValue.length !== 4)}
              style={{
                width: '100%',
                padding: '1rem',
                background: 'linear-gradient(to right, #4f46e5, #2563eb)',
                color: 'white',
                border: 'none',
                borderRadius: '0.75rem',
                fontSize: '1rem',
                fontWeight: 700,
                cursor: 'pointer',
                opacity: (isVerifyingOTP || (otpValue.length !== 6 && otpValue.length !== 4)) ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              {isVerifyingOTP ? (
                <>
                  <span className="loader" style={{ width: 18, height: 18, border: '2px solid white', borderBottomColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }}></span>
                  Verifying...
                </>
              ) : (
                'Verify & Complete'
              )}
            </motion.button>
            <button
              onClick={handleRequestOTP}
              disabled={isVerifyingOTP || isResendingOTP}
              style={{
                background: 'none',
                border: 'none',
                color: '#6366f1',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              {isResendingOTP ? 'Sending...' : 'Resend Code via WhatsApp'}
            </button>
          </div>
        </div>
      </Modal>
    </div>

  );
};

export default Sales;
