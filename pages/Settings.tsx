import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../redux/store';
import { fetchSettings, invalidateSettingCache } from '../redux/slices/settingSlice';
import { Card, Button, Input } from '../components/UI';
import { Save, CreditCard, Plus, Trash2, Key, Settings as SettingsIcon, Eye, EyeOff, Ticket, Package, ShieldCheck, MessageCircle, Link, Copy } from 'lucide-react';

import { PaymentMethod } from '../types';
import { useToast } from '../components/ToastContext';
import { useCurrency } from '../components/CurrencyContext';
import api from '../utils/api';

interface SettingsProps {
  paymentMethods?: PaymentMethod[];
  setPaymentMethods?: React.Dispatch<React.SetStateAction<PaymentMethod[]>>;
  setFraudProtection?: React.Dispatch<React.SetStateAction<boolean>>;
}

interface WhatsAppConfig {
  name: string;
  type: 'whatsapp';
  provider: 'sapprow' | 'meta' | 'custom';
  enabled: boolean;
  url: string;
  apiKey: string; // Made required as per guide for Sapprow
  // Meta specific
  accessToken?: string;
  phoneNumberId?: string;
  businessAccountId?: string;
  templates?: {
    [key: string]: string | { name: string; language: string };
  };
  // Custom specific
  secretKey?: string;
  requiresTemplate?: boolean;
  headers?: any;
}

const Settings: React.FC<SettingsProps> = ({ paymentMethods = [], setPaymentMethods, setFraudProtection }) => {
  const { showToast } = useToast();
  const { refreshCurrency } = useCurrency();
  const dispatch = useDispatch<AppDispatch>();
  const { settings, loading: settingsLoading } = useSelector((state: RootState) => state.settings);
  const [newMethodName, setNewMethodName] = useState('');
  const [loading, setLoading] = useState(true); // Keeping local loading for now to manage initial form population state if needed, or can sync with settingsLoading
  // Separate saving states for each section
  const [savingRazorpay, setSavingRazorpay] = useState(false);
  const [savingSalonInfo, setSavingSalonInfo] = useState(false);
  const [savingPaymentModes, setSavingPaymentModes] = useState(false);
  const [savingPaymentConfig, setSavingPaymentConfig] = useState(false);
  const [savingFraudProtection, setSavingFraudProtection] = useState(false);
  const [savingBookingConfig, setSavingBookingConfig] = useState(false);
  const [savingDataConfig, setSavingDataConfig] = useState(false);
  const [savingVoucherOTP, setSavingVoucherOTP] = useState(false);
  const [showKeySecret, setShowKeySecret] = useState(false);

  // API/AI Config State
  const [savingAPIConfig, setSavingAPIConfig] = useState(false);
  const [showAPISecret, setShowAPISecret] = useState(false);
  const [apiIntegrations, setAPIIntegrations] = useState<any[]>([]);
  const [showAddAPIModal, setShowAddAPIModal] = useState(false);
  const [newAPIConfig, setNewAPIConfig] = useState({
    name: '',
    apiKey: '',
    apiSecret: '',
    enabled: true,
  });

  // Razorpay Configuration State
  const [razorpayConfig, setRazorpayConfig] = useState({
    razorpayKeyId: '',
    razorpayKeySecret: '',
    paymentRazorpayKeyId: '',
    paymentRazorpayKeySecret: '',
    currency: 'INR',
  });

  // WhatsApp Configuration State
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);
  const [whatsappConfig, setWhatsappConfig] = useState<WhatsAppConfig>({
    name: 'Sapprow WhatsApp',
    type: 'whatsapp',
    provider: 'sapprow', // Default to Sapprow as per Phase 1
    enabled: false,
    url: 'https://api.sapprow.com/send',
    apiKey: '',
  });
  const [showWhatsappSecret, setShowWhatsappSecret] = useState(false);

  // Salon Information State
  const [salonInfo, setSalonInfo] = useState({
    salonName: '',
    salonPhone: '',
    salonAddress: '',
  });

  // Booking Configuration State
  const [bookingConfig, setBookingConfig] = useState({
    openingTime: '09:00',
    closingTime: '20:00',
    maxAdvanceBookingDays: 60,
    cancellationPolicyHours: 24,
    whatsappNotifications: true,
  });

  // Sales & Inventory Configuration
  const [salesConfig, setSalesConfig] = useState({
    salesIdPrefix: 'SALE-',
    invoiceStartNumber: '1',
  });
  const [inventoryConfig, setInventoryConfig] = useState({
    adjustmentReasons: 'Damaged,Expired,Internal Use,Stock Correction', // Default
    enabled: true,
  });

  // Payment Permissions State
  const [paymentConfig, setPaymentConfig] = useState({
    allowPartialPayment: true,
    partialPaymentPercentage: 0,
    allowNoPayment: true,
    allowFullPayment: true,
    allowRazorpay: false,
    fraudProtection: false,
    enableVoucherOtp: true,
  });

  // Payment Modes State (local copy)
  const [localPaymentMethods, setLocalPaymentMethods] = useState(paymentMethods);
  const [urlBusinessName, setUrlBusinessName] = useState('');
  const [generatedFullUrl, setGeneratedFullUrl] = useState('');
  const [generatedShortUrl, setGeneratedShortUrl] = useState('');
  const [generatingUrl, setGeneratingUrl] = useState(false);
  const [shortenUrl, setShortenUrl] = useState(false);




  // Extract business name from URL for URL generation
  useEffect(() => {
    const pathParts = window.location.pathname.split('/').filter(part => part);
    if (pathParts.length >= 2) {
      const businessName = pathParts[1];
      setUrlBusinessName(businessName);
    }
  }, []);

  // Generate short URL (called when button is clicked)
  const generateShortURL = async () => {
    if (!urlBusinessName) return;

    setGeneratingUrl(true);
    try {
      const response = await api.post('/settings/generate-url', {
        businessName: urlBusinessName,
        shortenUrl: true
      });

      setGeneratedShortUrl(response.data.shortUrl);
      showToast('Booking URL generated successfully!', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to generate URL', 'error');
    } finally {
      setGeneratingUrl(false);
    }
  };

  const fetchAllSettings = async () => {
    dispatch(invalidateSettingCache());
    dispatch(fetchSettings());
  };

  useEffect(() => {
    dispatch(fetchSettings());
  }, [dispatch]);

  useEffect(() => {
    if (settings) {
      const data = settings;

      // API Configuration
      if (data.apiIntegrations) {
        try {
          const integrations = typeof data.apiIntegrations === 'string'
            ? JSON.parse(data.apiIntegrations)
            : data.apiIntegrations;
          setAPIIntegrations(Array.isArray(integrations) ? integrations : []);
        } catch (e) {
          console.error("Failed to parse apiIntegrations", e);
          setAPIIntegrations([]);
        }
      } else {
        setAPIIntegrations([]);
      }

      // WhatsApp Configuration
      if (data.apiIntegrations) {
        try {
          const integrations = typeof data.apiIntegrations === 'string'
            ? JSON.parse(data.apiIntegrations)
            : data.apiIntegrations;

          if (Array.isArray(integrations)) {
            const waConfig = integrations.find((i: any) => i.type === 'whatsapp');
            if (waConfig) {
              setWhatsappConfig({
                ...waConfig,
                // Ensure defaults for missing fields if switching providers
                templates: waConfig.templates || {
                  appointmentConfirmation: '',
                  appointmentReminder: '',
                  paymentReminder: '',
                  salesReceipt: '',
                  packageUsage: '',
                  voucherCode: '',
                  voucherUsage: ''
                }
              });
            }
          }
        } catch (e) {
          console.error("Failed to parse WhatsApp config", e);
        }
      }

      // Razorpay Configuration
      setRazorpayConfig({
        razorpayKeyId: data.razorpayKeyId || '',
        razorpayKeySecret: data.razorpayKeySecret || '',
        paymentRazorpayKeyId: data.paymentRazorpayKeyId || '',
        paymentRazorpayKeySecret: data.paymentRazorpayKeySecret || '',
        currency: data.currency || 'INR',
      });

      // Salon Information
      setSalonInfo({
        salonName: data.salonName || '',
        salonPhone: data.salonPhone || '',
        salonAddress: data.salonAddress || '',
      });

      // Booking Configuration
      setBookingConfig(prev => ({
        ...prev,
        openingTime: data.openingTime || '09:00',
        closingTime: data.closingTime || '20:00',
        maxAdvanceBookingDays: data.maxAdvanceBookingDays || 60,
        cancellationPolicyHours: data.cancellationPolicyHours || 24,
        whatsappNotifications: data.whatsappNotifications !== undefined ? data.whatsappNotifications : true,
      }));

      // Sales & Inventory
      if (data.salesIdPrefix) {
        setSalesConfig(prev => ({ ...prev, salesIdPrefix: data.salesIdPrefix }));
      }
      if (data.invoiceStartNumber) {
        setSalesConfig(prev => ({ ...prev, invoiceStartNumber: String(data.invoiceStartNumber) }));
      }
      if (data.inventoryAdjustmentConfig) {
        setInventoryConfig(prev => ({ ...prev, adjustmentReasons: data.inventoryAdjustmentConfig }));
      }
      if (data.enableInventoryAdjustment !== undefined) {
        setInventoryConfig(prev => ({ ...prev, enabled: data.enableInventoryAdjustment }));
      }

      // Payment Permissions
      setPaymentConfig({
        allowPartialPayment: data.allowPartialPayment !== undefined ? data.allowPartialPayment : false,
        partialPaymentPercentage: data.partialPaymentPercentage || 0,
        allowNoPayment: data.allowNoPayment !== undefined ? data.allowNoPayment : true,
        allowFullPayment: data.allowFullPayment !== undefined ? data.allowFullPayment : false,
        allowRazorpay: data.allowRazorpay !== undefined ? data.allowRazorpay : false,
        fraudProtection: data.fraudProtection !== undefined ? data.fraudProtection : false,
        enableVoucherOtp: data.enableVoucherOtp !== undefined ? data.enableVoucherOtp : true,
      });

      // Payment Modes - Load array from database and convert to frontend format
      if (data.activePaymentMethods) {
        try {
          let savedMethods = data.activePaymentMethods;

          // If it's a string, try to parse it as JSON
          if (typeof savedMethods === 'string') {
            try {
              savedMethods = JSON.parse(savedMethods);
            } catch (jsonError) {
              console.error('Failed to parse payment methods JSON', jsonError);
              savedMethods = [];
            }
          }

          // Convert backend format { name, status: 1/0, url, secretKey } to frontend format
          if (Array.isArray(savedMethods) && savedMethods.length > 0) {
            const convertedMethods = savedMethods.map((method: any) => ({
              id: method.name.toUpperCase().trim().replace(/\s+/g, '_'),
              name: method.name,
              active: method.status === 1,
              url: method.url || '',
              secretKey: method.secretKey || ''
            }));
            setLocalPaymentMethods(convertedMethods);
            if (setPaymentMethods) {
              setPaymentMethods(convertedMethods);
            }
          }
        } catch (error) {
          console.error("Error parsing payment methods", error);
        }
      }

      setLoading(false);
    }
  }, [settings, setPaymentMethods]);


  const handleRazorpayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setRazorpayConfig(prev => ({ ...prev, [name]: value }));
  };

  const saveRazorpaySettings = async () => {
    setSavingRazorpay(true);
    try {
      // Only send fields that have values
      const payload: any = {};
      if (razorpayConfig.razorpayKeyId) {
        payload.razorpayKeyId = razorpayConfig.razorpayKeyId;
      }
      if (razorpayConfig.razorpayKeySecret) {
        payload.razorpayKeySecret = razorpayConfig.razorpayKeySecret;
      }
      if (razorpayConfig.currency) {
        payload.currency = razorpayConfig.currency;
      }

      const response = await api.put('/settings', payload);
      showToast('Razorpay settings saved successfully!', 'success');
      fetchAllSettings();
      await refreshCurrency();
    } catch (err: any) {
      console.error('Error saving Razorpay settings:', err);
      showToast(err.response?.data?.message || 'Error saving Razorpay settings', 'error');
    } finally {
      setSavingRazorpay(false);
    }
  };

  // Save Salon Information
  const saveSalonInfo = async () => {
    setSavingSalonInfo(true);
    try {
      const payload = {
        ...salonInfo,
        currency: razorpayConfig.currency
      };
      const response = await api.put('/settings', payload);
      showToast('Salon information saved successfully!', 'success');
      fetchAllSettings();
      await refreshCurrency();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to save salon information', 'error');
    } finally {
      setSavingSalonInfo(false);
    }
  };

  const handleAddAPIIntegration = async () => {
    if (!newAPIConfig.name || !newAPIConfig.apiKey || !newAPIConfig.apiSecret) {
      showToast('Please fill all fields', 'error');
      return;
    }

    setSavingAPIConfig(true);
    try {
      const newIntegration = {
        id: crypto.randomUUID(),
        ...newAPIConfig
      };

      const updatedIntegrations = [...apiIntegrations, newIntegration];

      await api.put('/settings', {
        apiIntegrations: updatedIntegrations
      });

      setAPIIntegrations(updatedIntegrations);
      setNewAPIConfig({ name: '', apiKey: '', apiSecret: '', enabled: true });
      setShowAddAPIModal(false);
      showToast('API Integration added successfully', 'success');
    } catch (error) {
      console.error('Failed to save API config:', error);
      showToast('Failed to save configuration', 'error');
    } finally {
      setSavingAPIConfig(false);
    }
  };

  const handleDeleteAPIIntegration = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this integration?')) return;

    const updatedIntegrations = apiIntegrations.filter(i => i.id !== id);
    try {
      await api.put('/settings', {
        apiIntegrations: updatedIntegrations
      });
      setAPIIntegrations(updatedIntegrations);
      showToast('Integration deleted', 'success');
    } catch (error) {
      showToast('Failed to delete integration', 'error');
    }
  };

  const handleToggleAPIIntegration = async (id: string, enabled: boolean) => {
    const updatedIntegrations = apiIntegrations.map(i => i.id === id ? { ...i, enabled } : i);
    setAPIIntegrations(updatedIntegrations); // Optimistic update
    try {
      await api.put('/settings', {
        apiIntegrations: updatedIntegrations
      });
    } catch (error) {
      showToast('Failed to update status', 'error');
      fetchAllSettings(); // Revert on error
    }
  };

  // Save Payment Modes
  const savePaymentModes = async () => {
    setSavingPaymentModes(true);
    try {
      // Convert payment methods to backend format: { name, status: 1/0 }
      const paymentMethodsForBackend = localPaymentMethods.map(method => ({
        name: method.name,
        status: method.active ? 1 : 0,
        url: null,
        secretKey: null
      }));

      const response = await api.put('/settings/payment-methods', {
        paymentMethods: paymentMethodsForBackend
      });

      showToast('Payment modes saved successfully!', 'success');
      fetchAllSettings();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to save payment modes', 'error');
    } finally {
      setSavingPaymentModes(false);
    }
  };

  // Save Payment Permissions
  const handleMethodToggle = (id: string, active: boolean) => {
    setLocalPaymentMethods(prev => prev.map(m => m.id === id ? { ...m, active } : m));
    // Sync Razorpay legacy toggle if applicable
    const method = localPaymentMethods.find(m => m.id === id);
    if (method && (method.name.toLowerCase() === 'razorpay' || method.name.toLowerCase() === 'razor')) {
      setPaymentConfig(prev => ({ ...prev, allowRazorpay: active }));
    }
  };

  const handleCredentialChange = (id: string, field: 'url' | 'secretKey', value: string) => {
    setLocalPaymentMethods(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));

    // Sync legacy razorpayConfig for backward compatibility (component usage)
    if (id === 'razorpay' || id === 'razor') {
      if (field === 'url') setRazorpayConfig(prev => ({ ...prev, paymentRazorpayKeyId: value }));
      if (field === 'secretKey') setRazorpayConfig(prev => ({ ...prev, paymentRazorpayKeySecret: value }));
    }
  };

  const savePaymentConfig = async () => {
    // Validation: Ensure exactly one payment policy is enabled (Partial, No, Full)
    const policyCount = [
      paymentConfig.allowPartialPayment,
      paymentConfig.allowNoPayment,
      paymentConfig.allowFullPayment
    ].filter(Boolean).length;

    if (policyCount > 1) {
      showToast('Only one payment behavior (Full, Partial, Credit) can be enabled at a time.', 'error');
      return;
    }



    // Validation: If Razorpay is allowed, require credentials within localPaymentMethods
    const razorpayMethod = localPaymentMethods.find(m => m.id === 'razorpay' || m.name.toLowerCase() === 'razorpay');
    if (razorpayMethod && razorpayMethod.active) {
      if (!razorpayMethod.url) {
        showToast('Razorpay Key ID is required when Razorpay is enabled', 'error');
        return;
      }
    }

    setSavingPaymentConfig(true);
    try {
      // Map local state nicely to backend format
      const updatedMethods = localPaymentMethods.map((m: any) => ({
        name: m.name,
        status: m.active ? 1 : 0,
        url: m.url, // Send Generic Credentials
        secretKey: m.secretKey // Send Generic Credentials
      }));

      const payload = {
        ...paymentConfig,
        activePaymentMethods: updatedMethods,
      };

      const response = await api.put('/settings', payload);
      showToast('Payment permissions saved successfully!', 'success');

      // Update global state if available (Convert to App Format)
      if (setPaymentMethods) {
        const appMethods = localPaymentMethods.map((m: any) => {
          const name = m.name.toUpperCase().trim();

          // 1:1 Dynamic ID generation: name -> UPPERCASE_WITH_UNDERSCORES
          let id = name.replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
          if (name === 'CASH') id = 'CASH';

          // Ensure we have a valid ID fallback
          if (!id) id = `METHOD_${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
          return {
            id,
            name: m.name,
            active: m.active
          };
        }).filter((m: any) => m.active);
        setPaymentMethods(appMethods);
      }

      fetchAllSettings();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to save payment permissions', 'error');
    } finally {
      setSavingPaymentConfig(false);
    }
  };
  const saveFraudProtection = async () => {
    setSavingFraudProtection(true);
    try {
      const payload = {
        fraudProtection: paymentConfig.fraudProtection,
      };

      await api.put('/settings', payload);
      if (setFraudProtection) {
        setFraudProtection(paymentConfig.fraudProtection);
      }
      showToast('Fraud protection settings saved successfully!', 'success');
      fetchAllSettings();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to save fraud protection settings', 'error');
    } finally {
      setSavingFraudProtection(false);
    }
  };

  // Save Booking Configuration
  const saveBookingConfig = async () => {
    setSavingBookingConfig(true);
    try {
      const response = await api.put('/settings', bookingConfig);
      showToast('Booking configuration saved successfully!', 'success');
      fetchAllSettings();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to save booking configuration', 'error');
    } finally {
      setSavingBookingConfig(false);
    }
  };

  // Save Data Configuration (Sales & Inventory)
  const saveDataConfig = async () => {
    setSavingDataConfig(true);
    try {
      const payload = {
        salesIdPrefix: salesConfig.salesIdPrefix,
        invoiceStartNumber: salesConfig.invoiceStartNumber,
        inventoryAdjustmentConfig: inventoryConfig.adjustmentReasons,
        enableInventoryAdjustment: inventoryConfig.enabled
      };
      const response = await api.put('/settings', payload);
      showToast('Data configuration saved successfully!', 'success');
      fetchAllSettings();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to save data configuration', 'error');
    } finally {
      setSavingDataConfig(false);
    }
  };

  const saveVoucherOTP = async () => {
    setSavingVoucherOTP(true);
    try {
      const payload = {
        enableVoucherOtp: paymentConfig.enableVoucherOtp,
      };
      await api.put('/settings', payload);
      showToast('Voucher OTP settings saved successfully!', 'success');
      fetchAllSettings();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to save voucher OTP settings', 'error');
    } finally {
      setSavingVoucherOTP(false);
    }
  };

  const toggleMethod = (id: string) => {
    setLocalPaymentMethods(prev => prev.map(m => m.id === id ? { ...m, active: !m.active } : m));
  };

  const addMethod = () => {
    if (newMethodName.trim()) {
      const newName = newMethodName.trim();
      const newId = newName.toUpperCase().replace(/\s+/g, '_');

      // Prevent duplicates
      if (localPaymentMethods.some(m => m.id === newId)) {
        showToast('Payment method already exists', 'error');
        return;
      }

      setLocalPaymentMethods(prev => [...prev, { id: newId, name: newName, active: true }]);
      setNewMethodName('');
    }
  };

  const removeMethod = (id: string) => {
    setLocalPaymentMethods(prev => prev.filter(m => m.id !== id));
  };

  // Generate URL Handler
  const generateURL = async () => {
    if (!urlBusinessName.trim()) {
      showToast('Please enter a business name', 'error');
      return;
    }

    setGeneratingUrl(true);
    try {
      const response = await api.post('/settings/generate-url', {
        businessName: urlBusinessName,
        shortenUrl: shortenUrl
      });

      setGeneratedFullUrl(response.data.fullUrl);
      setGeneratedShortUrl(response.data.shortUrl);
      showToast('URL generated successfully!', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to generate URL', 'error');
    } finally {
      setGeneratingUrl(false);
    }
  };

  // Copy to Clipboard Handler
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} copied to clipboard!`, 'success');
    } catch (err) {
      showToast('Failed to copy to clipboard', 'error');
    }
  };

  const saveWhatsappSettings = async () => {
    // Validation
    if (!whatsappConfig.name) {
      showToast('Please enter a name for the integration', 'error');
      return;
    }
    if (!whatsappConfig.url) {
      showToast('API URL is required', 'error');
      return;
    }
    if (whatsappConfig.provider === 'sapprow' && !whatsappConfig.apiKey) {
      showToast('API Key is required for Sapprow', 'error');
      return;
    }

    // Meta Validation
    if (whatsappConfig.provider === 'meta') {
      if (!whatsappConfig.accessToken) {
        showToast('Access Token is required for Meta', 'error');
        return;
      }
      if (!whatsappConfig.phoneNumberId) {
        showToast('Phone Number ID is required', 'error');
        return;
      }
      if (!whatsappConfig.businessAccountId) {
        showToast('Business Account ID is required', 'error');
        return;
      }
    }

    // Custom Validation
    if (whatsappConfig.provider === 'custom') {
      if (whatsappConfig.headers) {
        try {
          JSON.parse(whatsappConfig.headers);
        } catch (e) {
          showToast('Custom Headers must be valid JSON', 'error');
          return;
        }
      }
    }

    setSavingWhatsapp(true);
    try {
      // Get current integrations excluding any existing WhatsApp config
      const otherIntegrations = apiIntegrations.filter(i => i.type !== 'whatsapp');

      const updatedIntegrations = [...otherIntegrations, whatsappConfig];

      await api.put('/settings', {
        apiIntegrations: updatedIntegrations
      });

      setAPIIntegrations(updatedIntegrations);
      showToast('WhatsApp settings saved successfully', 'success');
      fetchAllSettings();
    } catch (error) {
      console.error('Failed to save WhatsApp settings:', error);
      showToast('Failed to save WhatsApp settings', 'error');
    } finally {
      setSavingWhatsapp(false);
    }
  };

  return (
    <div style={{ maxWidth: '48rem', margin: '0 auto', position: 'relative' }} className="space-y-6">
      {/* Loading Overlay */}
      {/* Loading Skeleton */}


      {!loading && (
        <>
          <Card title="Business Information">
            <div className="space-y-4">
              <div className="grid md-grid-cols-2 gap-4">
                <Input
                  label="Business Name"
                  value={salonInfo.salonName}
                  onChange={(e) => setSalonInfo(prev => ({ ...prev, salonName: e.target.value }))}
                  placeholder="Enter salon name"
                  disabled={false}
                />
                <Input
                  label="Contact Phone"
                  value={salonInfo.salonPhone}
                  onChange={(e) => setSalonInfo(prev => ({ ...prev, salonPhone: e.target.value }))}
                  placeholder="Enter contact phone"
                  disabled={false}
                />
                {/* <div style={{ gridColumn: 'span 2' }}>
                  <label className="input-label">Currency</label>
                  <select
                    value={razorpayConfig.currency}
                    onChange={(e) => setRazorpayConfig(prev => ({ ...prev, currency: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border)',
                      fontSize: '0.875rem',
                      outline: 'none',
                      background: 'white'
                    }}
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="SGD">SGD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div> */}
                <div style={{ gridColumn: 'span 2' }}>
                  <Input
                    label="Address"
                    value={salonInfo.salonAddress}
                    onChange={(e) => setSalonInfo(prev => ({ ...prev, salonAddress: e.target.value }))}
                    placeholder="Enter salon address"
                    disabled={false}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <Button onClick={saveSalonInfo} disabled={savingSalonInfo || loading} isLoading={savingSalonInfo} icon={<Save size={18} />}>
                  {savingSalonInfo ? 'Saving...' : 'Save Information'}
                </Button>
              </div>
            </div>
          </Card>

          <Card title="User Booking URL" icon={<Link size={20} />}>
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Link size={18} style={{ color: 'var(--primary)' }} />
                <p style={{ fontSize: '0.875rem', color: 'var(--text-gray)' }}>
                  Share this URL with your customers to book appointments online
                </p>
              </div>

              {!generatedShortUrl ? (
                <Button
                  onClick={generateShortURL}
                  disabled={generatingUrl}
                  isLoading={generatingUrl}
                  icon={<Link size={18} />}
                  style={{ width: '100%' }}
                >
                  {generatingUrl ? 'Generating URL...' : 'Generate URL'}
                </Button>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="input-label" style={{ marginBottom: '0.5rem', display: 'block' }}>Your Booking URL</label>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={generatedShortUrl}
                        readOnly
                        style={{
                          flex: 1,
                          padding: '0.75rem',
                          borderRadius: '0.5rem',
                          border: '1px solid var(--border)',
                          fontSize: '0.875rem',
                          backgroundColor: '#f0fdf4',
                          fontFamily: 'monospace',
                          color: 'var(--success)',
                          cursor: 'pointer',
                          fontWeight: '500'
                        }}
                        onClick={() => copyToClipboard(generatedShortUrl, 'Booking URL')}
                      />
                      <Button
                        variant="outline"
                        onClick={() => copyToClipboard(generatedShortUrl, 'Booking URL')}
                        icon={<Copy size={16} />}
                        style={{ padding: '0.75rem' }}
                      />
                    </div>
                  </div>

                  <div style={{
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '0.5rem',
                    padding: '1rem',
                    marginTop: '1rem'
                  }}>
                    <p style={{ fontSize: '0.875rem', color: '#1e40af', lineHeight: '1.5', margin: 0 }}>
                      <strong>📋 Share this URL</strong> with your customers so they can book appointments online.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* <Card title="Razorpay Configuration">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Key size={18} style={{ color: 'var(--primary)' }} />
                <p style={{ fontSize: '0.875rem', color: 'var(--text-gray)' }}>
                  Configure your Razorpay payment gateway credentials
                </p>
              </div>

              <div className="grid md-grid-cols-2 gap-4">
                <div>
                  <Input
                    label="Razorpay Key ID"
                    name="razorpayKeyId"
                    value={razorpayConfig.razorpayKeyId}
                    onChange={handleRazorpayChange}
                    placeholder="rzp_test_xxxxxxxxxxxxx"
                  />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-gray)', marginTop: '0.25rem' }}>
                    Your Razorpay Key ID (starts with rzp_test_ or rzp_live_)
                  </p>
                </div>

                <div>
                  <label className="input-label">Razorpay Key Secret</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showKeySecret ? "text" : "password"}
                      name="razorpayKeySecret"
                      value={razorpayConfig.razorpayKeySecret}
                      onChange={handleRazorpayChange}
                      placeholder={loading ? "Loading..." : "Enter your Razorpay Key Secret"}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        paddingRight: '3rem',
                        borderRadius: '0.5rem',
                        border: '1px solid var(--border)',
                        fontSize: '0.875rem',
                        outline: 'none',
                        fontFamily: showKeySecret ? 'inherit' : 'monospace'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowKeySecret(!showKeySecret)}
                      style={{
                        position: 'absolute',
                        right: '0.75rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-gray)',
                        padding: '0.25rem',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      title={showKeySecret ? "Hide secret" : "Show secret"}
                    >
                      {showKeySecret ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-gray)', marginTop: '0.25rem' }}>
                    {loading ? (
                      "Loading settings..."
                    ) : (
                      <>
                        Your Razorpay Key Secret (keep this confidential)
                        {razorpayConfig.razorpayKeySecret && (
                          <span style={{ color: 'var(--success)', marginLeft: '0.5rem' }}>
                            ✓ Secret is saved
                          </span>
                        )}
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <Button onClick={saveRazorpaySettings} disabled={savingRazorpay || loading} isLoading={savingRazorpay} icon={<Save size={18} />}>
                  {savingRazorpay ? 'Saving...' : 'Save Razorpay Settings'}
                </Button>
              </div>
            </div>
          </Card> */}

          {/* API Configuration */}
          <Card
            title="API Configuration"
            icon={<SettingsIcon size={20} />}
            subtitle="Configure API keys for AI Assistant integration"
            action={
              <Button
                variant="outline"
                onClick={() => setShowAddAPIModal(!showAddAPIModal)}
                icon={<Plus size={16} />}
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
              >
                Add New
              </Button>
            }
          >
            <div className="space-y-4">
              {/* List of Integrations */}
              {apiIntegrations.length === 0 && !showAddAPIModal ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-gray)', background: '#f8fafc', borderRadius: '0.5rem', border: '1px dashed #e2e8f0' }}>
                  <p>No integrations configured.</p>
                  <p style={{ fontSize: '0.85rem' }}>Click "Add New" to connect an AI Assistant instance.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {apiIntegrations.map((integration) => (
                    <div key={integration.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '1rem', background: '#fff', borderRadius: '0.5rem',
                      border: '1px solid var(--border)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>{integration.name}</h4>
                          <span style={{
                            fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px',
                            background: integration.enabled ? 'rgba(34, 197, 94, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                            color: integration.enabled ? 'var(--success)' : 'var(--text-gray)'
                          }}>
                            {integration.enabled ? 'Active' : 'Disabled'}
                          </span>
                        </div>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-gray)', fontFamily: 'monospace' }}>
                          Key: {integration.apiKey.substring(0, 8)}...
                        </p>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <label style={{ position: 'relative', display: 'inline-block', width: '2rem', height: '1.1rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={integration.enabled}
                            onChange={(e) => handleToggleAPIIntegration(integration.id, e.target.checked)}
                            style={{ opacity: 0, width: 0, height: 0 }}
                          />
                          <span style={{
                            position: 'absolute', cursor: 'pointer', inset: 0,
                            backgroundColor: integration.enabled ? 'var(--success)' : '#e5e7eb',
                            transition: '0.3s', borderRadius: '34px'
                          }}></span>
                          <span style={{
                            position: 'absolute', content: '""', height: '0.8rem', width: '0.8rem',
                            left: '0.15rem', bottom: '0.15rem', backgroundColor: 'white',
                            transition: '0.3s', borderRadius: '50%',
                            transform: integration.enabled ? 'translateX(0.9rem)' : 'translateX(0)'
                          }}></span>
                        </label>

                        <button
                          onClick={() => handleDeleteAPIIntegration(integration.id)}
                          style={{
                            border: 'none', background: 'none', color: '#ef4444',
                            cursor: 'pointer', padding: '0.25rem', display: 'flex'
                          }}
                          title="Delete Integration"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add New Integration Form */}
              {showAddAPIModal && (
                <div style={{
                  marginTop: '1.5rem', padding: '1.5rem', background: '#f8fafc',
                  borderRadius: '0.5rem', border: '1px solid #e2e8f0',
                  animation: 'fadeIn 0.2s ease-out'
                }}>
                  <h4 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 600 }}>Add New Integration</h4>
                  <div className="space-y-4">
                    <Input
                      label="Integration Name"
                      value={newAPIConfig.name}
                      onChange={(e) => setNewAPIConfig({ ...newAPIConfig, name: e.target.value })}
                      placeholder="e.g. Workly AI Assistant"
                    />
                    <div className="grid md-grid-cols-2 gap-4">
                      <Input
                        label="API Key"
                        value={newAPIConfig.apiKey}
                        onChange={(e) => setNewAPIConfig({ ...newAPIConfig, apiKey: e.target.value })}
                        placeholder="Enter API Key"
                      />
                      <div>
                        <label className="input-label">API Secret</label>
                        <div style={{ position: 'relative' }}>
                          <input
                            type={showAPISecret ? "text" : "password"}
                            value={newAPIConfig.apiSecret}
                            onChange={(e) => setNewAPIConfig({ ...newAPIConfig, apiSecret: e.target.value })}
                            placeholder="Enter API Secret"
                            style={{
                              width: '100%', padding: '0.75rem', paddingRight: '3rem',
                              borderRadius: '0.5rem', border: '1px solid var(--border)',
                              fontSize: '0.875rem', outline: 'none',
                              fontFamily: showAPISecret ? 'inherit' : 'monospace'
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowAPISecret(!showAPISecret)}
                            style={{
                              position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-gray)'
                            }}
                          >
                            {showAPISecret ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                      <Button variant="outline" onClick={() => setShowAddAPIModal(false)}>Cancel</Button>
                      <Button onClick={handleAddAPIIntegration} isLoading={savingAPIConfig}>Save Integration</Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* WhatsApp Configuration */}
          <Card
            title="WhatsApp Integration"
            icon={<MessageCircle size={20} />}
            subtitle="Configure WhatsApp notifications for appointments and payments"
            action={
              <div className="flex items-center gap-2">
                <span style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: whatsappConfig.enabled ? '#dcfce7' : '#f1f5f9',
                  color: whatsappConfig.enabled ? '#166534' : '#64748b',
                  fontWeight: 500
                }}>
                  {whatsappConfig.enabled ? 'Connected' : 'Not Configured'}
                </span>
              </div>
            }
          >
            <div className="space-y-6">
              {/* Provider Selection */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Provider</label>
                  <select
                    value={whatsappConfig.provider}
                    onChange={(e) => {
                      const newProvider = e.target.value as any;
                      setWhatsappConfig(prev => ({
                        ...prev,
                        provider: newProvider,
                        // Set defaults based on provider
                        name: newProvider === 'sapprow' ? 'Sapprow WhatsApp' :
                          newProvider === 'meta' ? 'Meta WhatsApp' : 'Custom WhatsApp',
                        url: newProvider === 'sapprow' ? 'https://api.sapprow.com/send' :
                          newProvider === 'meta' ? 'https://graph.facebook.com/v18.0' : '',
                        requiresTemplate: newProvider === 'meta'
                      }));
                    }}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border)',
                      fontSize: '0.875rem',
                      outline: 'none',
                      background: 'white'
                    }}
                  >
                    <option value="sapprow">Sapprow WhatsApp</option>
                    <option value="meta">Meta Official WhatsApp</option>
                    <option value="custom">Custom Provider</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '0.75rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                    <div style={{ position: 'relative', width: '2.5rem', height: '1.5rem' }}>
                      <input
                        type="checkbox"
                        checked={whatsappConfig.enabled}
                        onChange={(e) => setWhatsappConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                      <span style={{
                        position: 'absolute', cursor: 'pointer', inset: 0,
                        backgroundColor: whatsappConfig.enabled ? 'var(--success)' : '#cbd5e1',
                        transition: '0.3s', borderRadius: '34px'
                      }}></span>
                      <span style={{
                        position: 'absolute', content: '""', height: '1.1rem', width: '1.1rem',
                        left: '0.2rem', bottom: '0.2rem', backgroundColor: 'white',
                        transition: '0.3s', borderRadius: '50%',
                        transform: whatsappConfig.enabled ? 'translateX(1rem)' : 'translateX(0)'
                      }}></span>
                    </div>
                    <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Enable Integration</span>
                  </label>
                </div>
              </div>

              {/* Common Fields */}
              <div className="grid md:grid-cols-2 gap-4">
                <Input
                  label="Integration Name"
                  value={whatsappConfig.name}
                  onChange={(e) => setWhatsappConfig(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Sapprow WhatsApp"
                />
                <Input
                  label="API URL"
                  value={whatsappConfig.url}
                  onChange={(e) => setWhatsappConfig(prev => ({ ...prev, url: e.target.value }))}
                  placeholder="https://api..."
                />
                {/* API Path Field with Dynamic Placeholder Support */}
                {/* <div>
                  <label className="input-label">API Path <span style={{ fontSize: '0.75rem', color: 'var(--text-gray)', fontWeight: 'normal' }}>(Optional - supports placeholders)</span></label>
                  <Input
                    value={whatsappConfig.apiPath || ''}
                    onChange={(e) => setWhatsappConfig(prev => ({ ...prev, apiPath: e.target.value }))}
                    placeholder="e.g. {vendorUid}/contact/send-template-message"
                  />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-gray)', marginTop: '0.25rem' }}>
                    Available: {'{'}apiBaseUrl{'}'}, {'{'}vendorUid{'}'}, {'{'}businessAccountId{'}'}, {'{'}phoneNumberId{'}'}, {'{'}adminId{'}'}, {'{'}businessName{'}'}
                  </p>
                </div> */}

                {/* Provider Specific Fields - Sapprow (Phase 1) */}
                {whatsappConfig.provider === 'sapprow' && (
                  <div className="space-y-4 pt-4 border-t border-dashed border-gray-200">
                    <h4 className="font-medium text-sm text-gray-700">Sapprow Configuration</h4>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="input-label">API Key</label>
                        <div style={{ position: 'relative' }}>
                          <input
                            type={showWhatsappSecret ? "text" : "password"}
                            value={whatsappConfig.apiKey}
                            onChange={(e) => setWhatsappConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                            placeholder="Enter Sapprow API Key"
                            style={{
                              width: '100%', padding: '0.75rem', paddingRight: '3rem',
                              borderRadius: '0.5rem', border: '1px solid var(--border)',
                              fontSize: '0.875rem', outline: 'none',
                              fontFamily: showWhatsappSecret ? 'inherit' : 'monospace'
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowWhatsappSecret(!showWhatsappSecret)}
                            style={{
                              position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-gray)'
                            }}
                          >
                            {showWhatsappSecret ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Meta Fields (Phase 2) */}
                {whatsappConfig.provider === 'meta' && (
                  <div className="space-y-4 pt-4 border-t border-dashed border-gray-200">
                    <h4 className="font-medium text-sm text-gray-700">Meta Configuration</h4>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="input-label">Access Token</label>
                        <div style={{ position: 'relative' }}>
                          <input
                            type={showWhatsappSecret ? "text" : "password"}
                            value={whatsappConfig.accessToken || ''}
                            onChange={(e) => setWhatsappConfig(prev => ({ ...prev, accessToken: e.target.value }))}
                            placeholder="Meta System User Access Token"
                            style={{
                              width: '100%', padding: '0.75rem', paddingRight: '3rem',
                              borderRadius: '0.5rem', border: '1px solid var(--border)',
                              fontSize: '0.875rem', outline: 'none',
                              fontFamily: showWhatsappSecret ? 'inherit' : 'monospace'
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowWhatsappSecret(!showWhatsappSecret)}
                            style={{
                              position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-gray)'
                            }}
                          >
                            {showWhatsappSecret ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <Input
                        label="Phone Number ID"
                        value={whatsappConfig.phoneNumberId || ''}
                        onChange={(e) => setWhatsappConfig(prev => ({ ...prev, phoneNumberId: e.target.value.replace(/\D/g, '') }))}
                        placeholder="e.g. 104xxxxxxxxxxxxx"
                      />
                      <Input
                        label="Business Account ID"
                        value={whatsappConfig.businessAccountId || ''}
                        onChange={(e) => setWhatsappConfig(prev => ({ ...prev, businessAccountId: e.target.value.replace(/\D/g, '') }))}
                        placeholder="e.g. 101xxxxxxxxxxxxx"
                      />
                    </div>

                    {/* Template Configuration */}
                    <div className="pt-2">
                      <h5 className="font-medium text-sm text-gray-600 mb-3">Message Templates</h5>
                      <div className="space-y-3 bg-gray-50 p-4 rounded-md border border-gray-100">
                        {Object.entries({
                          appointmentConfirmation: "Appointment Confirmation",
                          appointmentReminder: "Appointment Reminder",
                          paymentReminder: "Payment Reminder",
                          salesReceipt: "Sales Receipt",
                          packageUsage: "Package Usage",
                          voucherCode: "Voucher Code",
                          voucherUsage: "Voucher Usage"
                        }).map(([key, label]) => {
                          const templateCfg = whatsappConfig.templates?.[key];
                          const name = typeof templateCfg === 'object' ? templateCfg.name : (templateCfg || '');
                          const language = typeof templateCfg === 'object' ? templateCfg.language : 'en';

                          return (
                            <div key={key} className="flex flex-col gap-1">
                              <label className="input-label">{label}</label>
                              <div className="flex gap-2">
                                <div style={{ flex: 1 }}>
                                  <Input
                                    value={name}
                                    onChange={(e) => setWhatsappConfig(prev => ({
                                      ...prev,
                                      templates: {
                                        ...prev.templates,
                                        [key]: { name: e.target.value, language }
                                      }
                                    }))}
                                    placeholder="e.g. my_template_name"
                                  />
                                </div>
                                <select
                                  value={language}
                                  onChange={(e) => setWhatsappConfig(prev => ({
                                    ...prev,
                                    templates: {
                                      ...prev.templates,
                                      [key]: { name, language: e.target.value }
                                    }
                                  }))}
                                  style={{
                                    padding: '0 0.5rem',
                                    borderRadius: '0.5rem',
                                    border: '1px solid var(--border)',
                                    fontSize: '0.875rem',
                                    background: 'white',
                                    minWidth: '80px'
                                  }}
                                >
                                  <option value="en">en</option>
                                  <option value="en_US">en_US</option>
                                </select>
                              </div>
                            </div>
                          );
                        })}
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-gray)' }}>
                          Enter the exact template names as created in your Meta Business Manager and select the language code.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Custom Fields (Phase 3) */}
                {whatsappConfig.provider === 'custom' && (
                  <div className="space-y-4 pt-4 border-t border-dashed border-gray-200">
                    <h4 className="font-medium text-sm text-gray-700">Custom Provider Configuration</h4>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="input-label">API Key (Optional)</label>
                        <div style={{ position: 'relative' }}>
                          <input
                            type={showWhatsappSecret ? "text" : "password"}
                            value={whatsappConfig.apiKey || ''}
                            onChange={(e) => setWhatsappConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                            placeholder="Header Authorization Key"
                            style={{
                              width: '100%', padding: '0.75rem', paddingRight: '3rem',
                              borderRadius: '0.5rem', border: '1px solid var(--border)',
                              fontSize: '0.875rem', outline: 'none',
                              fontFamily: showWhatsappSecret ? 'inherit' : 'monospace'
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowWhatsappSecret(!showWhatsappSecret)}
                            style={{
                              position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-gray)'
                            }}
                          >
                            {showWhatsappSecret ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="input-label">Secret Key (Optional)</label>
                        <input
                          type="password"
                          value={whatsappConfig.secretKey || ''}
                          onChange={(e) => setWhatsappConfig(prev => ({ ...prev, secretKey: e.target.value }))}
                          placeholder="Additional Secret"
                          style={{
                            width: '100%', padding: '0.75rem', borderRadius: '0.5rem',
                            border: '1px solid var(--border)', fontSize: '0.875rem', outline: 'none',
                            fontFamily: 'monospace'
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="input-label">Custom Headers (JSON)</label>
                      <textarea
                        value={whatsappConfig.headers || ''}
                        onChange={(e) => setWhatsappConfig(prev => ({ ...prev, headers: e.target.value }))}
                        placeholder='{"X-Custom-Header": "Value"}'
                        style={{
                          width: '100%', padding: '0.75rem', borderRadius: '0.5rem',
                          border: '1px solid var(--border)', fontSize: '0.875rem',
                          minHeight: '80px', fontFamily: 'monospace'
                        }}
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={whatsappConfig.requiresTemplate || false}
                          onChange={(e) => setWhatsappConfig(prev => ({ ...prev, requiresTemplate: e.target.checked }))}
                          className="w-4 h-4 text-blue-600 rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700">This provider requires message templates</span>
                      </label>
                    </div>

                    {whatsappConfig.requiresTemplate && (
                      <div className="pt-2">
                        <h5 className="font-medium text-sm text-gray-600 mb-3">Message Templates</h5>
                        <div className="space-y-3 bg-gray-50 p-4 rounded-md border border-gray-100">
                          <div>
                            <Input
                              label="Appointment Confirmation Template"
                              value={whatsappConfig.templates?.appointmentConfirmation || ''}
                              onChange={(e) => setWhatsappConfig(prev => ({
                                ...prev,
                                templates: { ...prev.templates!, appointmentConfirmation: e.target.value }
                              }))}
                              placeholder="e.g. appointment_confirmation_v1"
                            />
                          </div>
                          <div className="grid md:grid-cols-2 gap-4">
                            <Input
                              label="Appointment Reminder Template"
                              value={whatsappConfig.templates?.appointmentReminder || ''}
                              onChange={(e) => setWhatsappConfig(prev => ({
                                ...prev,
                                templates: { ...prev.templates!, appointmentReminder: e.target.value }
                              }))}
                              placeholder="e.g. appointment_reminder"
                            />
                            <Input
                              label="Payment Reminder Template"
                              value={whatsappConfig.templates?.paymentReminder || ''}
                              onChange={(e) => setWhatsappConfig(prev => ({
                                ...prev,
                                templates: { ...prev.templates!, paymentReminder: e.target.value }
                              }))}
                              placeholder="e.g. payment_late_notice"
                            />
                          </div>
                          <div className="grid md:grid-cols-2 gap-4">
                            <Input
                              label="Sales Receipt Template"
                              value={whatsappConfig.templates?.salesReceipt || ''}
                              onChange={(e) => setWhatsappConfig(prev => ({
                                ...prev,
                                templates: { ...prev.templates!, salesReceipt: e.target.value }
                              }))}
                              placeholder="e.g. sales_receipt_v1"
                            />
                            <Input
                              label="Package Usage Template"
                              value={whatsappConfig.templates?.packageUsage || ''}
                              onChange={(e) => setWhatsappConfig(prev => ({
                                ...prev,
                                templates: { ...prev.templates!, packageUsage: e.target.value }
                              }))}
                              placeholder="e.g. package_usage_notification"
                            />
                            <Input
                              label="Voucher Code Template"
                              value={whatsappConfig.templates?.voucherCode || ''}
                              onChange={(e) => setWhatsappConfig(prev => ({
                                ...prev,
                                templates: { ...prev.templates!, voucherCode: e.target.value }
                              }))}
                              placeholder="e.g. voucher_code_v1"
                            />
                          </div>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-gray)' }}>
                            Enter the exact template names as created in your provider dashboard.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                  <Button
                    onClick={saveWhatsappSettings}
                    disabled={savingWhatsapp || loading}
                    isLoading={savingWhatsapp}
                    icon={<Save size={18} />}
                  >
                    {savingWhatsapp ? 'Saving...' : 'Save WhatsApp Settings'}
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Currency Configuration">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard size={18} style={{ color: 'var(--primary)' }} />
                <p style={{ fontSize: '0.875rem', color: 'var(--text-gray)' }}>
                  Select the currency for your business transactions
                </p>
              </div>

              <div>
                <label className="input-label">Business Currency</label>
                <select
                  name="currency"
                  value={razorpayConfig.currency}
                  onChange={(e) => setRazorpayConfig(prev => ({ ...prev, currency: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border)',
                    fontSize: '0.875rem',
                    outline: 'none',
                    background: 'white'
                  }}
                >
                  <option value="INR">🇮🇳 INR - Indian Rupee (₹)</option>
                  <option value="AED">🇦🇪 AED - UAE Dirham (د.إ)</option>
                  <option value="SGD">🇸🇬 SGD - Singapore Dollar (S$)</option>
                  <option value="SAR">🇸🇦 SAR - Saudi Riyal (SR)</option>
                  <option value="USD">🇺🇸 USD - US Dollar ($)</option>
                  <option value="EUR">🇪🇺 EUR - Euro (€)</option>
                  <option value="GBP">🇬🇧 GBP - British Pound (£)</option>
                  <option value="MYR">🇲🇾 MYR - Malaysian Ringgit (RM)</option>
                </select>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-gray)', marginTop: '0.25rem' }}>
                  This currency will be used throughout the admin and user apps.
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <Button onClick={saveRazorpaySettings} disabled={savingRazorpay || loading} isLoading={savingRazorpay} icon={<Save size={18} />}>
                  {savingRazorpay ? 'Saving...' : 'Save Currency Settings'}
                </Button>
              </div>
            </div>
          </Card>



          <Card title="Voucher OTP Setting">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Ticket size={18} style={{ color: 'var(--primary)' }} />
                <p style={{ fontSize: '0.875rem', color: 'var(--text-gray)' }}>
                  Control whether customers need to verify an OTP when redeeming vouchers.
                </p>
              </div>

              <div className="flex flex-col gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 500, color: '#374151' }}>Voucher Redemption OTP</span>
                  <label style={{ position: 'relative', display: 'inline-block', width: '2.75rem', height: '1.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={paymentConfig.enableVoucherOtp}
                      onChange={(e) => setPaymentConfig(prev => ({ ...prev, enableVoucherOtp: e.target.checked }))}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                      position: 'absolute', cursor: 'pointer', inset: 0,
                      backgroundColor: paymentConfig.enableVoucherOtp ? 'var(--success)' : '#e5e7eb',
                      transition: '0.3s', borderRadius: '34px'
                    }}></span>
                    <span style={{
                      position: 'absolute', content: '""', height: '1.1rem', width: '1.1rem',
                      left: '0.2rem', bottom: '0.2rem', backgroundColor: 'white',
                      transition: '0.3s', borderRadius: '50%',
                      transform: paymentConfig.enableVoucherOtp ? 'translateX(1.25rem)' : 'translateX(0)'
                    }}></span>
                  </label>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-gray)', margin: 0 }}>
                  When ON, customers receive an OTP for voucher redemption. When OFF, OTP is skipped.
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <Button onClick={saveVoucherOTP} disabled={savingVoucherOTP || loading} isLoading={savingVoucherOTP} icon={<Save size={18} />}>
                  {savingVoucherOTP ? 'Saving...' : 'Save OTP Settings'}
                </Button>
              </div>
            </div>
          </Card>

          <Card title="Payment Configuration">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck size={18} style={{ color: 'var(--primary)' }} />
                <p style={{ fontSize: '0.875rem', color: 'var(--text-gray)' }}>
                  Control which payment options are available during checkout.
                </p>
              </div>

              <div className="grid md-grid-cols-1 gap-4">

                {/* Allow Partial Payment */}
                <div className="flex flex-col gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 500, color: '#374151' }}>Allow Partial Payment</span>
                    <label style={{ position: 'relative', display: 'inline-block', width: '2.75rem', height: '1.5rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={paymentConfig.allowPartialPayment}
                        onChange={(e) => setPaymentConfig(prev => ({ ...prev, allowPartialPayment: e.target.checked }))}
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                      <span style={{
                        position: 'absolute', cursor: 'pointer', inset: 0,
                        backgroundColor: paymentConfig.allowPartialPayment ? 'var(--success)' : '#e5e7eb',
                        transition: '0.3s', borderRadius: '34px'
                      }}></span>
                      <span style={{
                        position: 'absolute', content: '""', height: '1.1rem', width: '1.1rem',
                        left: '0.2rem', bottom: '0.2rem', backgroundColor: 'white',
                        transition: '0.3s', borderRadius: '50%',
                        transform: paymentConfig.allowPartialPayment ? 'translateX(1.25rem)' : 'translateX(0)'
                      }}></span>
                    </label>
                  </div>

                  {paymentConfig.allowPartialPayment && (
                    <div style={{ marginTop: '0.5rem', paddingLeft: '0.5rem', borderLeft: '2px solid var(--primary)' }}>
                      <label className="input-label" style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>Minimum Percentage (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={paymentConfig.partialPaymentPercentage}
                        onChange={(e) => setPaymentConfig(prev => ({ ...prev, partialPaymentPercentage: parseFloat(e.target.value) || 0 }))}
                        style={{
                          width: '100px',
                          padding: '0.5rem',
                          borderRadius: '0.375rem',
                          border: '1px solid var(--border)',
                          fontSize: '0.875rem'
                        }}
                      />
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-gray)', marginTop: '0.25rem' }}>
                        Require at least this % of total amount upfront.
                      </p>
                    </div>
                  )}
                </div>

                {/* Allow No Payment */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                  <span style={{ fontWeight: 500, color: '#374151' }}>Allow No Payment (Credit)</span>
                  <label style={{ position: 'relative', display: 'inline-block', width: '2.75rem', height: '1.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={paymentConfig.allowNoPayment}
                      onChange={(e) => setPaymentConfig(prev => ({ ...prev, allowNoPayment: e.target.checked }))}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                      position: 'absolute', cursor: 'pointer', inset: 0,
                      backgroundColor: paymentConfig.allowNoPayment ? 'var(--success)' : '#e5e7eb',
                      transition: '0.3s', borderRadius: '34px'
                    }}></span>
                    <span style={{
                      position: 'absolute', content: '""', height: '1.1rem', width: '1.1rem',
                      left: '0.2rem', bottom: '0.2rem', backgroundColor: 'white',
                      transition: '0.3s', borderRadius: '50%',
                      transform: paymentConfig.allowNoPayment ? 'translateX(1.25rem)' : 'translateX(0)'
                    }}></span>
                  </label>
                </div>

                {/* Allow Full Payment */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                  <span style={{ fontWeight: 500, color: '#374151' }}>Allow Full Payment</span>
                  <label style={{ position: 'relative', display: 'inline-block', width: '2.75rem', height: '1.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={paymentConfig.allowFullPayment}
                      onChange={(e) => setPaymentConfig(prev => ({ ...prev, allowFullPayment: e.target.checked }))}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                      position: 'absolute', cursor: 'pointer', inset: 0,
                      backgroundColor: paymentConfig.allowFullPayment ? 'var(--success)' : '#e5e7eb',
                      transition: '0.3s', borderRadius: '34px'
                    }}></span>
                    <span style={{
                      position: 'absolute', content: '""', height: '1.1rem', width: '1.1rem',
                      left: '0.2rem', bottom: '0.2rem', backgroundColor: 'white',
                      transition: '0.3s', borderRadius: '50%',
                      transform: paymentConfig.allowFullPayment ? 'translateX(1.25rem)' : 'translateX(0)'
                    }}></span>
                  </label>
                </div>

                {localPaymentMethods.map(method => (
                  <div key={method.id} style={{ padding: '0.75rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: method.active ? '1rem' : '0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 500, color: '#374151' }}>Allow {method.name} Payment</span>
                        {/* Delete Button for Custom Methods */}
                        {!['cash', 'visa', 'master', 'razorpay', 'onlinepay'].includes(method.id) && (
                          <button onClick={() => removeMethod(method.id)} title="Remove Method" style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', marginLeft: '0.5rem', display: 'flex' }}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>

                      <label style={{ position: 'relative', display: 'inline-block', width: '2.75rem', height: '1.5rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={method.active}
                          onChange={(e) => handleMethodToggle(method.id, e.target.checked)}
                          style={{ opacity: 0, width: 0, height: 0 }}
                        />
                        <span style={{
                          position: 'absolute', cursor: 'pointer', inset: 0,
                          backgroundColor: method.active ? 'var(--success)' : '#e5e7eb',
                          transition: '0.3s', borderRadius: '34px'
                        }}></span>
                        <span style={{
                          position: 'absolute', content: '""', height: '1.1rem', width: '1.1rem',
                          left: '0.2rem', bottom: '0.2rem', backgroundColor: 'white',
                          transition: '0.3s', borderRadius: '50%',
                          transform: method.active ? 'translateX(1.25rem)' : 'translateX(0)'
                        }}></span>
                      </label>
                    </div>

                    {/* Generic Credentials Configuration (Shown for ALL active methods EXCEPT CASH) */}
                    {method.active && method.id !== 'cash' && (
                      <div className="space-y-4 pt-4 border-t border-gray-200">
                        <div className="bg-blue-50 border border-blue-100 rounded-md p-3 mb-2">
                          <p className="text-xs text-blue-700">
                            Configure credentials for {method.name} integration.
                          </p>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <label className="input-label">Key ID / URL {method.name.toLowerCase().includes('razor') && <span className="text-red-500">*</span>}</label>
                            <div className="relative">
                              {/* <Key size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" /> */}
                              <Input
                                value={(method as any).url || ''}
                                onChange={(e) => handleCredentialChange(method.id, 'url', e.target.value)}
                                placeholder="API Key or ID"
                                style={{ paddingLeft: '2.5rem' }}
                              />
                            </div>
                          </div>

                          <div>
                            <style>{`
                          input[type="password"]::-ms-reveal,
                          input[type="password"]::-ms-clear {
                            display: none;
                          }
                        `}</style>
                            <label className="input-label">Key Secret {method.name.toLowerCase().includes('razor') && <span className="text-red-500">*</span>}</label>
                            <div className="relative">
                              {/* <Key size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 z-10" /> */}
                              <Input
                                type="password"
                                value={(method as any).secretKey || ''}
                                onChange={(e) => handleCredentialChange(method.id, 'secretKey', e.target.value)}
                                placeholder="Secret Key"
                                style={{ paddingLeft: '2.5rem' }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Add New Method UI */}
              <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200">
                <div style={{ flex: 1 }}>
                  <Input
                    placeholder="Add new method (e.g. Amex)"
                    value={newMethodName}
                    onChange={(e) => setNewMethodName(e.target.value)}
                    style={{ margin: 0, height: '3.2rem', fontSize: '1rem' }}
                  />
                </div>
                <Button
                  onClick={addMethod}
                  variant="secondary"
                  icon={<Plus size={18} />}
                  style={{ minWidth: '180px', height: '3.2rem', fontSize: '1rem' }}
                >
                  Add Method
                </Button>
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-200">
                <Button onClick={savePaymentConfig} disabled={savingPaymentConfig || loading} isLoading={savingPaymentConfig} icon={<Save size={18} />}>
                  {savingPaymentConfig ? 'Saving...' : 'Save Payment Permissions'}
                </Button>
              </div>
            </div>
          </Card>

          <Card title="Fraud Protection">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck size={18} style={{ color: 'var(--primary)' }} />
                <p style={{ fontSize: '0.875rem', color: 'var(--text-gray)' }}>
                  Enable fraud protection to secure your payment transactions
                </p>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ShieldCheck size={18} style={{ color: paymentConfig.fraudProtection ? 'var(--success)' : 'var(--text-gray)' }} />
                  <span style={{ fontWeight: 500, color: '#374151' }}>Enable Fraud Protection</span>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: '2.75rem', height: '1.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={paymentConfig.fraudProtection}
                    onChange={(e) => setPaymentConfig(prev => ({ ...prev, fraudProtection: e.target.checked }))}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute', cursor: 'pointer', inset: 0,
                    backgroundColor: paymentConfig.fraudProtection ? 'var(--success)' : '#e5e7eb',
                    transition: '0.3s', borderRadius: '34px'
                  }}></span>
                  <span style={{
                    position: 'absolute', content: '""', height: '1.1rem', width: '1.1rem',
                    left: '0.2rem', bottom: '0.2rem', backgroundColor: 'white',
                    transition: '0.3s', borderRadius: '50%',
                    transform: paymentConfig.fraudProtection ? 'translateX(1.25rem)' : 'translateX(0)'
                  }}></span>
                </label>
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-200">                <Button onClick={saveFraudProtection} disabled={savingFraudProtection || loading} isLoading={savingFraudProtection} icon={<Save size={18} />}>
                {savingFraudProtection ? 'Saving...' : 'Save Fraud Protection Settings'}
              </Button>
              </div>
            </div>
          </Card>

          <Card title="Booking Configuration">
            <div className="space-y-6">
              <div className="grid md-grid-cols-2 gap-4">
                <div className="input-group">
                  <label className="input-label">Opening Time</label>
                  <input
                    type="time"
                    className="form-control"
                    value={bookingConfig.openingTime}
                    onChange={(e) => setBookingConfig(prev => ({ ...prev, openingTime: e.target.value }))}
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Closing Time</label>
                  <input
                    type="time"
                    className="form-control"
                    value={bookingConfig.closingTime}
                    onChange={(e) => setBookingConfig(prev => ({ ...prev, closingTime: e.target.value }))}
                  />
                </div>
                <Input
                  label="Max Advance Booking (Days)"
                  type="number"
                  value={bookingConfig.maxAdvanceBookingDays.toString()}
                  onChange={(e) => setBookingConfig(prev => ({ ...prev, maxAdvanceBookingDays: parseInt(e.target.value) || 60 }))}
                />
                <Input
                  label="Cancellation Policy (Hours)"
                  type="number"
                  value={bookingConfig.cancellationPolicyHours.toString()}
                  onChange={(e) => setBookingConfig(prev => ({ ...prev, cancellationPolicyHours: parseInt(e.target.value) || 24 }))}
                />
              </div>

              <div className="flex items-center space-x-2" style={{ paddingTop: '1rem' }}>
                <input
                  type="checkbox"
                  id="whatsapp"
                  checked={bookingConfig.whatsappNotifications}
                  onChange={(e) => setBookingConfig(prev => ({ ...prev, whatsappNotifications: e.target.checked }))}
                  style={{ width: '1.25rem', height: '1.25rem', color: 'var(--primary)', borderRadius: '0.25rem', border: '1px solid var(--border)' }}
                />
                <label htmlFor="whatsapp" style={{ fontSize: '0.875rem', color: 'var(--text-dark)' }}>Enable WhatsApp Notifications</label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <Button onClick={saveBookingConfig} disabled={savingBookingConfig || loading} isLoading={savingBookingConfig} icon={<Save size={18} />}>
                  {savingBookingConfig ? 'Saving...' : 'Save Booking Configuration'}
                </Button>
              </div>
            </div>
          </Card>

          <Card title="Data Configuration">
            <div className="space-y-6">
              <div className="grid md-grid-cols-2 gap-6">
                {/* Sales Configuration */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Ticket size={18} style={{ color: 'var(--primary)' }} />
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-dark)' }}>Sales Configuration</h3>
                  </div>
                  <Input
                    label="Sales ID Prefix"
                    value={salesConfig.salesIdPrefix}
                    onChange={(e) => setSalesConfig({ salesIdPrefix: e.target.value })}
                    placeholder="e.g. SALE-"
                  />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-gray)', marginTop: '0.25rem' }}>
                    Prefix for generated Sale numbers (e.g. SALE-1001)
                  </p>
                  <div style={{ marginTop: '1rem' }}>
                    <Input
                      label="Invoice Start Number"
                      type="text"
                      value={salesConfig.invoiceStartNumber}
                      onChange={(e) => setSalesConfig(prev => ({ ...prev, invoiceStartNumber: e.target.value }))}
                      placeholder="e.g. 1001"
                    />
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-gray)', marginTop: '0.25rem' }}>
                      Starting sequence number for invoices (e.g. 1001)
                    </p>
                  </div>
                </div>

                {/* Inventory Configuration */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Package size={18} style={{ color: 'var(--primary)' }} />
                      <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-dark)' }}>Inventory Adjustment</h3>
                    </div>
                    {/* Toggle Switch */}
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: '0.8rem', color: inventoryConfig.enabled ? 'var(--success)' : 'var(--text-gray)' }}>
                        {inventoryConfig.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={inventoryConfig.enabled}
                          onChange={(e) => setInventoryConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>

                  <div style={{ opacity: inventoryConfig.enabled ? 1 : 0.5, pointerEvents: inventoryConfig.enabled ? 'auto' : 'none', transition: 'opacity 0.2s', display: 'none' }}>
                    <label className="input-label">Adjustment Reasons</label>
                    <textarea
                      value={inventoryConfig.adjustmentReasons}
                      onChange={(e) => setInventoryConfig(prev => ({ ...prev, adjustmentReasons: e.target.value }))}
                      placeholder="Damaged, Expired, Internal Use, etc."
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        borderRadius: '0.5rem',
                        border: '1px solid var(--border)',
                        fontSize: '0.875rem',
                        minHeight: '80px',
                        resize: 'vertical'
                      }}
                    />
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-gray)', marginTop: '0.25rem' }}>
                      Comma-separated list of reasons for inventory adjustments
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <Button onClick={saveDataConfig} disabled={savingDataConfig || loading} isLoading={savingDataConfig} icon={<Save size={18} />}>
                  {savingDataConfig ? 'Saving...' : 'Save Data Configuration'}
                </Button>
              </div>
            </div>
          </Card>
        </>
      )}
    </div >
  );
};

export default Settings;
