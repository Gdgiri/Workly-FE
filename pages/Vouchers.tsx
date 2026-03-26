import React, { useState, useEffect } from 'react';
import { Plus, Ticket, Copy, Filter, Trash2, CheckCircle, RefreshCcw, Send, Users, Calendar, AlertCircle, TrendingUp, DollarSign, ArrowRight, History, User, Activity } from 'lucide-react';
import { Button, Modal, Input, Card, Select, Skeleton } from '../components/UI';
import { Voucher, VoucherClaim, Customer } from '../types';
import { useToast } from '../components/ToastContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useCurrency } from '../components/CurrencyContext';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/api';

interface VouchersProps {
  vouchers: Voucher[];
  setVouchers: React.Dispatch<React.SetStateAction<Voucher[]>>;
  voucherClaims: VoucherClaim[];
  setVoucherClaims: React.Dispatch<React.SetStateAction<VoucherClaim[]>>;
  customers?: Customer[];
}

const Vouchers: React.FC<VouchersProps> = ({ vouchers, setVouchers, voucherClaims, setVoucherClaims, customers = [] }) => {
  const { showToast } = useToast();
  const { symbol, formatPrice } = useCurrency();
  const [activeTab, setActiveTab] = useState<'campaigns' | 'claims'>('campaigns');
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Pagination State
  const RECORDS_PER_PAGE = 15;
  const [currentPage, setCurrentPage] = useState(1);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<VoucherClaim | null>(null);

  // Create Campaign Form
  const [campaignName, setCampaignName] = useState('');
  const [campaignValue, setCampaignValue] = useState('');
  const [campaignSellingPrice, setCampaignSellingPrice] = useState('');
  const [campaignDesc, setCampaignDesc] = useState('');
  const [campaignExpiryDays, setCampaignExpiryDays] = useState('30');
  const [autoCode, setAutoCode] = useState(true);
  const [customCode, setCustomCode] = useState('');

  // Issue Voucher Form
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  const fetchVouchers = async () => {
    try {
      const res = await api.get('/vouchers');
      setVouchers(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Error fetching vouchers:', error);
    }
  };

  const fetchClaims = async () => {
    try {
      const res = await api.get('/vouchers/claims');
      console.log('DEBUG: fetchClaims response:', res.data);
      if (Array.isArray(res.data)) {
        console.log('DEBUG: Claims count:', res.data.length);
        // Check for potential duplicates or issues
        const activeClaims = res.data.filter((c: any) => c.status === 'claimed' || c.status === 'active');
        console.log('DEBUG: Active/Claimed count:', activeClaims.length);
      }
      setVoucherClaims(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Error fetching claims:', error);
    }
  };

  // Fetch initial data IF NOT PROVIDED by App.tsx (Fallback for standalone)
  useEffect(() => {
    const fetchAll = async () => {
      setIsInitialLoading(true);
      try {
        await Promise.all([fetchVouchers(), fetchClaims()]);
      } finally {
        setIsInitialLoading(false);
      }
    };

    if (vouchers.length === 0 && voucherClaims.length === 0) {
      fetchAll();
    }
  }, []);

  const generateCode = () => 'VR-' + Math.random().toString(36).substring(2, 8).toUpperCase();

  // --- ACTIONS ---

  const [campaignStatus, setCampaignStatus] = useState<'active' | 'inactive'>('active');

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCode = autoCode ? generateCode() : customCode.toUpperCase();

    if (autoCode ? false : !customCode.trim()) {
      showToast('Please provide a custom code or use auto-generate', 'error');
      return;
    }

    // VALIDATION
    const newErrors: Record<string, string> = {};
    if (!campaignName.trim()) newErrors.name = 'Voucher name is required';
    if (!campaignValue || parseFloat(campaignValue) <= 0) newErrors.value = 'Value must be greater than 0';
    if (!campaignSellingPrice || parseFloat(campaignSellingPrice) < 0) newErrors.sellingPrice = 'Selling price cannot be negative';
    if (!campaignExpiryDays || parseInt(campaignExpiryDays) < 0) newErrors.expiry = 'Expiry days cannot be negative';

    if (Object.keys(newErrors).length > 0) {
      setFormErrors(newErrors);
      showToast('Please fill all required fields', 'error');
      return;
    }

    setFormErrors({});
    setIsSubmitting(true);

    try {
      const response = await api.post('/vouchers', {
        code: finalCode,
        name: campaignName || 'New Voucher',
        description: campaignDesc || 'Promotional Voucher',
        value: parseFloat(campaignValue),
        sellingPrice: parseFloat(campaignSellingPrice) || 0,
        validityDays: parseInt(campaignExpiryDays) || 0,
        type: 'fixed',
        status: campaignStatus
      });

      setVouchers(prev => [response.data, ...prev]);
      setIsCreateModalOpen(false);
      showToast('Voucher campaign created successfully!', 'success');

      // Reset form
      setCampaignName('');
      setCampaignValue('');
      setCampaignSellingPrice('');
      setCampaignDesc('');
      setCustomCode('');
      setCampaignExpiryDays('30');
      setCampaignStatus('active');
    } catch (error: any) {
      console.error('Create campaign error:', error);
      showToast(error.response?.data?.error || 'Failed to create voucher campaign', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: any) => {
    const isCurrentlyActive = currentStatus === 'active' || currentStatus === true || currentStatus === 1;
    const newStatusBool = !isCurrentlyActive;
    const newStatusString = newStatusBool ? 'active' : 'inactive';

    try {
      await api.patch(`/vouchers/${id}/status`, { status: newStatusString });
      setVouchers(prev => prev.map(v => v.id === id ? { ...v, status: newStatusString as any } : v));
      showToast(`Voucher campaign is now ${newStatusString}`, 'success');
    } catch (error: any) {
      console.error('Toggle status error:', error);
      showToast(error.response?.data?.error || 'Failed to update status', 'error');
    }
  };

  const handleIssueVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCampaignId || !selectedCustomerId) return;

    const campaign = vouchers.find(v => v.id === selectedCampaignId);
    if (!campaign) return;

    if (campaign.status === 'inactive' || campaign.status === false || campaign.status === 0) {
      showToast('Cannot issue an inactive voucher.', 'error');
      return;
    }

    const customer = customers.find(c => c.id.toString() === selectedCustomerId);

    if (!customer) return;

    setIsSubmitting(true);

    try {
      const response = await api.post('/vouchers/issue', {
        voucherId: campaign.id,
        customerId: customer.id.toString(),
        customerName: customer.name
      });

      const newClaim = response.data;
      setVoucherClaims(prev => [newClaim, ...prev]);

      showToast(`Voucher ${campaign.code} issued to ${customer.name}.`, 'success');
      setIsIssueModalOpen(false);
      setSelectedCampaignId('');
      setSelectedCustomerId('');
    } catch (error: any) {
      console.error('Issue voucher error:', error);
      showToast(error.response?.data?.error || 'Failed to issue voucher', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteCampaign = async (id: string) => {
    if (window.confirm('Delete this campaign? Claims will remain.')) {
      try {
        await api.delete(`/vouchers/${id}`);
        setVouchers(prev => prev.filter(v => v.id !== id));
        showToast('Campaign deleted', 'success');
      } catch (error: any) {
        console.error('Delete campaign error:', error);
        showToast(error.response?.data?.error || 'Failed to delete campaign', 'error');
      }
    }
  }

  // Reset pagination on search
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeTab]);

  // Filter logic
  const filteredVouchers = vouchers.filter(v =>
    v.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredClaims = voucherClaims.filter(c =>
    c.voucherCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (customers.find(cust => cust.id.toString() === c.customerId?.toString())?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Paginated Data
  const paginatedVouchers = filteredVouchers.slice(
    (currentPage - 1) * RECORDS_PER_PAGE,
    currentPage * RECORDS_PER_PAGE
  );

  const paginatedClaims = filteredClaims.slice(
    (currentPage - 1) * RECORDS_PER_PAGE,
    currentPage * RECORDS_PER_PAGE
  );

  const totalPages = Math.ceil(
    (activeTab === 'campaigns' ? filteredVouchers.length : filteredClaims.length) / RECORDS_PER_PAGE
  );

  const PaginationControls = () => {
    if (totalPages <= 1) return null;

    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '2rem', padding: '1rem 0' }}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
        >
          Previous
        </Button>
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#64748b' }}>
          Page {currentPage} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
        >
          Next
        </Button>
      </div>
    );
  };


  return (
    <div className="space-y-6" style={{ position: 'relative' }}>

      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', position: 'relative', width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: '0.75rem', background: '#f1f5f9', padding: '0.375rem', borderRadius: '1rem' }}>
          <button
            onClick={() => setActiveTab('campaigns')}
            style={{
              padding: '0.5rem 1.25rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              borderRadius: '0.75rem',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'campaigns' ? 'white' : 'transparent',
              color: activeTab === 'campaigns' ? '#6366f1' : '#64748b',
              boxShadow: activeTab === 'campaigns' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            Vouchers
          </button>
          <button
            onClick={() => setActiveTab('claims')}
            style={{
              padding: '0.5rem 1.25rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              borderRadius: '0.75rem',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'claims' ? 'white' : 'transparent',
              color: activeTab === 'claims' ? '#6366f1' : '#64748b',
              boxShadow: activeTab === 'claims' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            Issue History
          </button>
        </div>

        <div className="flex gap-16" style={{ position: 'absolute', right: 0 }}>
          <button
            onClick={() => { fetchVouchers(); fetchClaims(); }}
            style={{
              padding: '0.5rem',
              borderRadius: '0.75rem',
              border: '1px solid #e2e8f0',
              background: 'white',
              color: '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              marginRight: '1rem' // Added extra gap
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
            onMouseLeave={e => e.currentTarget.style.background = 'white'}
          >
            <RefreshCcw size={18} />
          </button>
          <Button onClick={() => setIsCreateModalOpen(true)}
          // icon={<Plus size={18} />}
          >
            New Voucher</Button>
        </div>
      </div>

      {/* Stats Cards */}
      {/* <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
        <div style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', padding: '1.5rem', borderRadius: '1.25rem', color: 'white', boxShadow: '0 10px 20px -5px rgba(99, 102, 241, 0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <p style={{ margin: 0, opacity: 0.8, fontWeight: 500, fontSize: '0.875rem' }}>Active Campaigns</p>
            <Activity size={20} style={{ opacity: 0.8 }} />
          </div>
          <h2 style={{ margin: '0.5rem 0 0', fontSize: '2rem', fontWeight: 800 }}>{vouchers.filter(v => v.status === 'active').length}</h2>
        </div>
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '1.25rem', border: '1px solid #f1f5f9', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <p style={{ margin: 0, color: '#64748b', fontWeight: 500, fontSize: '0.875rem' }}>Total Issued</p>
            <Users size={20} style={{ color: '#6366f1' }} />
          </div>
          <h2 style={{ margin: '0.5rem 0 0', fontSize: '2rem', fontWeight: 800, color: '#0f172a' }}>{voucherClaims.length}</h2>
        </div>
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '1.25rem', border: '1px solid #f1f5f9', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <p style={{ margin: 0, color: '#64748b', fontWeight: 500, fontSize: '0.875rem' }}>Redeemed Value</p>
            <TrendingUp size={20} style={{ color: '#10b981' }} />
          </div>
          <h2 style={{ margin: '0.5rem 0 0', fontSize: '2rem', fontWeight: 800, color: '#10b981' }}>
            {formatPrice(voucherClaims.reduce((sum, c) => {
              const campaign = vouchers.find(v => v.id === c.voucherId);
              return sum + (campaign ? (campaign.value - c.balance) : 0);
            }, 0))}
          </h2>
        </div>
      </div> */}

      {/* Search Bar */}
      <div style={{ maxWidth: '1200px', margin: '0.5rem auto 0 auto', width: '100%' }}>
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
            <Filter size={18} />
          </div>
          <input
            type="text"
            placeholder={activeTab === 'campaigns' ? "Search voucher name or code..." : "Search customer name or voucher code..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem 1rem 0.75rem 3rem',
              borderRadius: '1rem',
              border: '1px solid #e2e8f0',
              fontSize: '0.875rem',
              background: 'white',
              outline: 'none',
              transition: 'all 0.2s',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.02)'; }}
          />
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ minHeight: '400px', maxWidth: '1200px', margin: '1rem auto 0 auto', width: '100%' }}>
        {/* Column Headers */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '2rem',
          padding: '0 1.5rem 0.75rem 1.5rem',
          borderBottom: '1px solid #f1f5f9',
          marginBottom: '1rem'
        }}>
          {activeTab === 'campaigns' ? (
            <>
              <span style={{ flex: 1, fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Voucher Name</span>
              <span style={{ flex: 1, fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Description</span>
              <span style={{ flex: 1, fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Voucher Value</span>
              <span style={{ flex: 1, fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Price</span>
              <span style={{ flex: 1, fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Status</span>
              <span style={{ flex: 1, fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Expires</span>
            </>
          ) : (
            <>
              <span style={{ flex: '0 0 250px', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Customer</span>
              <div style={{ flex: 1, display: 'flex', gap: '3rem' }}>
                <span style={{ minWidth: '120px', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Voucher</span>
                <span style={{ minWidth: '100px', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Status</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexShrink: 0, minWidth: '140px' }}>
                <span style={{ flex: 1, textAlign: 'right', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Balance</span>
                <span style={{ width: '2.25rem' }}></span>
              </div>
            </>
          )}
        </div>
        <AnimatePresence mode="wait">
          {activeTab === 'campaigns' ? (
            <motion.div
              key="campaigns"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
            >
              {isInitialLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <CampaignCardSkeleton key={`campaign-skeleton-${i}`} />
                ))
              ) : paginatedVouchers.length > 0 ? (
                <>
                  {paginatedVouchers.map(v => <CampaignCard key={v.id} voucher={v} onToggle={() => handleToggleStatus(v.id as string, v.status)} />)}
                  <PaginationControls />
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
                  <Ticket size={48} style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
                  <p>{searchTerm ? 'No vouchers match your search.' : 'No voucher campaigns found. Create your first one!'}</p>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="claims"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
            >
              {isInitialLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <ClaimCardSkeleton key={`claim-skeleton-${i}`} />
                ))
              ) : paginatedClaims.length > 0 ? (
                <>
                  {paginatedClaims.map(c => <ClaimCard key={c.id} claim={c} customers={customers} setSelectedClaim={setSelectedClaim} />)}
                  <PaginationControls />
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
                  <Users size={48} style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
                  <p>{searchTerm ? 'No history matching your search.' : 'No vouchers issued yet.'}</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* CREATE CAMPAIGN MODAL */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="New Voucher">
        <form style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }} onSubmit={handleCreateCampaign}>
          <div className="grid md-grid-cols-3" style={{ gap: '1rem' }}>
            <div className="flex flex-col">
              <Input label="Voucher Name" placeholder="e.g. VIP Rewards" value={campaignName} onChange={e => setCampaignName(e.target.value)} />
              {formErrors.name && <span style={{ color: 'red', fontSize: '0.75rem', marginTop: '-0.25rem', display: 'block' }}>{formErrors.name}</span>}
            </div>
            <div className="flex flex-col">
              <Input label="Expiry Days" type="number" value={campaignExpiryDays} onChange={e => setCampaignExpiryDays(e.target.value)} placeholder="0 for no expiry" />
              {formErrors.expiry && <span style={{ color: 'red', fontSize: '0.75rem', marginTop: '-0.25rem', display: 'block' }}>{formErrors.expiry}</span>}
            </div>
            <div className="flex flex-col">
              <Input label={`Voucher Value (${symbol})`} type="number" step="0.01" value={campaignValue} onChange={e => setCampaignValue(e.target.value)} />
              {formErrors.value && <span style={{ color: 'red', fontSize: '0.75rem', marginTop: '-0.25rem', display: 'block' }}>{formErrors.value}</span>}
            </div>
          </div>

          <div className="grid md-grid-cols-2" style={{ gap: '1rem' }}>
            <div className="flex flex-col">
              <Input label={`Selling Price (${symbol})`} type="number" step="0.01" value={campaignSellingPrice} onChange={e => setCampaignSellingPrice(e.target.value)} />
              {formErrors.sellingPrice && <span style={{ color: 'red', fontSize: '0.75rem', marginTop: '-0.25rem', display: 'block' }}>{formErrors.sellingPrice}</span>}
            </div>
            <div>
              <label className="input-label mb-2">Status</label>
              <select
                className="form-control"
                style={{ width: '100%', height: '42px', borderRadius: '0.75rem' }}
                value={campaignStatus}
                onChange={e => setCampaignStatus(e.target.value as any)}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <Input label="Description" placeholder="What is this voucher for?" value={campaignDesc} onChange={e => setCampaignDesc(e.target.value)} />

          <div className="grid md-grid-cols-1" style={{ gap: '1rem' }}>
            <div>
              <label className="input-label mb-2">Code Strategy</label>
              <div className="flex gap-2">
                <div style={{ flex: 1, position: 'relative' }}>
                  <input
                    className="form-control"
                    disabled={autoCode}
                    value={autoCode ? 'AUTO-GENERATE' : customCode}
                    onChange={e => setCustomCode(e.target.value.toUpperCase())}
                    style={{ fontStyle: autoCode ? 'italic' : 'normal', color: autoCode ? '#94a3b8' : 'inherit' }}
                  />
                </div>
                <button type="button" onClick={() => setAutoCode(!autoCode)} style={{ padding: '0.75rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', background: 'white', color: '#6366f1', cursor: 'pointer' }}>
                  <RefreshCcw size={18} />
                </button>
              </div>
            </div>
          </div>

          <div className="pt-6 flex justify-end gap-3 border-t">
            <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting} isLoading={isSubmitting}>Create</Button>
          </div>
        </form>
      </Modal>

      {/* ISSUE MODAL */}
      <Modal isOpen={isIssueModalOpen} onClose={() => setIsIssueModalOpen(false)} title="Issue Voucher 2.0">
        <form className="space-y-6" onSubmit={handleIssueVoucher}>
          <div style={{ padding: '1rem', background: '#eff6ff', borderRadius: '0.75rem', border: '1px solid #dbeafe', color: '#1e40af', fontSize: '0.875rem' }}>
            Voucher 2.0 tracks individual customer balances. Any existing pool quantity will be reserved.
          </div>
          <Select
            label="Select Campaign"
            value={selectedCampaignId}
            onChange={e => setSelectedCampaignId(e.target.value)}
            options={[{ value: '', label: 'Choose a campaign...' }, ...vouchers.filter(v => v.status === 'active' || v.status === true || v.status === 1).map(v => ({ value: v.id, label: `${v.name || v.code} - ${formatPrice(v.value)}` }))]}
            required
          />
          <Select
            label="Target Customer"
            value={selectedCustomerId}
            onChange={e => setSelectedCustomerId(e.target.value)}
            options={[{ value: '', label: 'Find a customer...' }, ...customers.map(c => ({ value: c.id.toString(), label: `${c.name} (${c.phone})` }))]}
            required
          />
          <div className="pt-4 flex justify-end gap-3 border-t">
            <Button variant="ghost" onClick={() => setIsIssueModalOpen(false)}>Cancel</Button>
            <Button type="submit" icon={<Send size={16} />} disabled={isSubmitting} isLoading={isSubmitting}>Issue Now</Button>
          </div>
        </form>
      </Modal>

      {/* USAGE HISTORY MODAL */}
      <Modal isOpen={!!selectedClaim} onClose={() => setSelectedClaim(null)} title="Voucher Usage History">
        {selectedClaim && (
          <div className="space-y-6">
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1.25rem', background: '#f8fafc', borderRadius: '1rem' }}>
              <div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700 }}>AVAILABLE BALANCE</p>
                <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: '#10b981' }}>{formatPrice(selectedClaim.balance)}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700 }}>VOUCHER CODE</p>
                <p style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#6366f1' }}>{selectedClaim.voucherCode}</p>
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#475569', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <History size={16} /> Transaction Activity
              </h4>
              <div className="space-y-3">
                <div className="space-y-3">
                  {(() => {
                    let history: any[] = [];
                    try {
                      if (Array.isArray(selectedClaim.usageHistory)) {
                        history = selectedClaim.usageHistory;
                      } else if (typeof selectedClaim.usageHistory === 'string') {
                        history = JSON.parse(selectedClaim.usageHistory);
                      }
                    } catch (e) {
                      console.error('Error parsing usage history:', e);
                    }

                    return history.length > 0 ? (
                      history.map((u: any, i) => {
                        console.log('Rendering item:', i, u);
                        return (
                          <div key={i} style={{ padding: '1.25rem', borderBottom: '1px solid #f1f5f9', background: 'white' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                              <div>
                                <p style={{ margin: 0, fontWeight: 700, color: '#1e293b', fontSize: '0.9rem' }}>
                                  {u.saleNumber ? u.saleNumber : (u.saleId ? `Sale #${u.saleId.substring(0, 8)}` : 'N/A')}
                                </p>
                                <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.2rem' }}>{u.date ? new Date(u.date).toLocaleString() : 'Date N/A'}</p>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <p style={{ margin: 0, fontWeight: 800, color: '#ef4444', fontSize: '1.1rem' }}>-{formatPrice(u.amount || 0)}</p>
                              </div>
                            </div>

                            {/* <div style={{ display: 'flex', gap: '2rem', background: '#f8fafc', padding: '0.875rem', borderRadius: '0.75rem', border: '1px solid #f1f5f9' }}>
                              <div style={{ flex: 1 }}>
                                <p style={{ margin: 0, fontSize: '0.65rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.025em', marginBottom: '0.25rem' }}>Balance Before</p>
                                <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: '#475569' }}>{formatPrice(u.balanceBefore || 0)}</p>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', color: '#cbd5e1' }}>
                                <ArrowRight size={16} />
                              </div>
                              <div style={{ flex: 1 }}>
                                <p style={{ margin: 0, fontSize: '0.65rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.025em', marginBottom: '0.25rem' }}>Balance After</p>
                                <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#10b981' }}>{formatPrice(u.balanceAfter || 0)}</p>
                              </div>
                            </div> */}
                          </div>
                        );
                      })
                    ) : (
                      <div style={{ textAlign: 'center', padding: '3rem 2rem', background: '#f8fafc', borderRadius: '1rem', color: '#94a3b8', border: '2px dashed #e2e8f0' }}>
                        <AlertCircle size={40} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                        <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 500 }}>No redemption activity found.</p>
                        {/* Debugging info if needed, or remove for prod */}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            <div className="pt-6 flex justify-end">
              <Button onClick={() => setSelectedClaim(null)} variant="secondary">Close History</Button>
            </div>
          </div>
        )
        }
      </Modal >
    </div >
  );
};

// --- SKELETON COMPONENTS ---

const CampaignCardSkeleton = () => (
  <div style={{
    background: 'white',
    borderRadius: '1rem',
    padding: '1rem 1.5rem',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)',
    border: '1px solid #f1f5f9',
    display: 'flex',
    alignItems: 'center',
    gap: '2rem'
  }}>
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <Skeleton width="2.75rem" height="2.75rem" borderRadius="0.75rem" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <Skeleton width="120px" height="1.1rem" />
        <Skeleton width="80px" height="0.9rem" />
      </div>
    </div>
    <div style={{ flex: 1 }}>
      <Skeleton width="80%" height="0.9rem" />
    </div>
    <div style={{ flex: 1 }}>
      <Skeleton width="60px" height="1.2rem" />
    </div>
    <div style={{ flex: 1 }}>
      <Skeleton width="60px" height="1.2rem" />
    </div>
    <div style={{ flex: 1 }}>
      <Skeleton width="50px" height="1.4rem" borderRadius="0.375rem" />
    </div>
    <div style={{ flex: 1, display: 'flex', gap: '0.4rem' }}>
      <Skeleton width="14px" height="14px" />
      <Skeleton width="60px" height="0.9rem" />
    </div>
  </div>
);

const ClaimCardSkeleton = () => (
  <div style={{
    background: 'white',
    borderRadius: '1rem',
    padding: '1rem 1.5rem',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)',
    border: '1px solid #f1f5f9',
    display: 'flex',
    alignItems: 'center',
    gap: '2rem'
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: '0 0 250px' }}>
      <Skeleton width="2.5rem" height="2.5rem" borderRadius="0.75rem" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <Skeleton width="140px" height="1rem" />
        <Skeleton width="100px" height="0.8rem" />
      </div>
    </div>
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '3rem' }}>
      <div style={{ minWidth: '150px' }}>
        <Skeleton width="100px" height="1.4rem" />
      </div>
      <div style={{ minWidth: '100px' }}>
        <Skeleton width="60px" height="1rem" />
      </div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexShrink: 0 }}>
      <Skeleton width="100px" height="1.5rem" />
      <Skeleton width="2.25rem" height="2.25rem" borderRadius="0.6rem" />
    </div>
  </div>
);

export default Vouchers;

// --- UI COMPONENTS ---

const CampaignCard: React.FC<{ voucher: Voucher, onToggle: () => void }> = ({ voucher, onToggle }) => {
  const { showToast } = useToast();
  const { formatPrice } = useCurrency();
  // Campaigns themselves don't really "expire" in the same way now, 
  // but we can show the validity period.
  const isExpired = voucher.status === 'expired';

  return (
    <motion.div
      layout
      style={{
        background: 'white',
        borderRadius: '1rem',
        padding: '1rem 1.5rem',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)',
        border: '1px solid #f1f5f9',
        display: 'flex',
        alignItems: 'center',
        gap: '2rem'
      }}
    >
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 0 }}>
        <div style={{
          width: '2.75rem',
          height: '2.75rem',
          background: 'linear-gradient(135deg, #6366f1, #a855f7)',
          borderRadius: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          flexShrink: 0
        }}>
          <Ticket size={20} strokeWidth={2.5} />
        </div>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{voucher.name || voucher.code}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.1rem' }}>
            <code style={{ fontSize: '0.75rem', color: '#6366f1', fontWeight: 600, background: '#eef2ff', padding: '0.1rem 0.4rem', borderRadius: '0.3rem' }}>{voucher.code}</code>
            <button onClick={() => { navigator.clipboard.writeText(voucher.code); showToast('Code copied!', 'info'); }} style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: 0, display: 'flex' }}>
              <Copy size={12} />
            </button>
          </div>
        </div>
      </div>

      <div style={{
        flex: 1,
        fontSize: '0.875rem',
        color: '#64748b',
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        lineHeight: '1.4'
      }} title={voucher.description}>
        {voucher.description || '-'}
      </div>

      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>{formatPrice(voucher.value)}</p>
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#6366f1' }}>{formatPrice(voucher.sellingPrice || 0)}</p>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <label style={{ position: 'relative', display: 'inline-block', width: '2.5rem', height: '1.25rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={voucher.status === 'active' || voucher.status === true || voucher.status === 1}
              onChange={onToggle}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span style={{
              position: 'absolute', cursor: 'pointer', inset: 0,
              backgroundColor: (voucher.status === 'active' || voucher.status === true || voucher.status === 1) ? '#22c55e' : '#e2e8f0',
              transition: '0.3s', borderRadius: '1rem'
            }}></span>
            <span style={{
              position: 'absolute', content: '""', height: '0.9rem', width: '0.9rem',
              left: '0.2rem', bottom: '0.17rem', backgroundColor: 'white',
              transition: '0.3s', borderRadius: '50%',
              transform: (voucher.status === 'active' || voucher.status === true || voucher.status === 1) ? 'translateX(1.2rem)' : 'translateX(0)'
            }}></span>
          </label>
          <span style={{
            fontSize: '0.8rem',
            fontWeight: 700,
            color: (voucher.status === 'active' || voucher.status === true || voucher.status === 1) ? '#166534' : '#64748b',
          }}>
            {(voucher.status === 'active' || voucher.status === true || voucher.status === 1) ? 'Active' : (voucher.status === 'expired' ? 'Expired' : 'Inactive')}
          </span>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: '#94a3b8' }}>
        <Calendar size={14} />
        <span>{voucher.validityDays > 0 ? `${voucher.validityDays} Days` : 'No Expiry'}</span>
      </div>
    </motion.div>
  );
};

const ClaimCard: React.FC<{ claim: VoucherClaim, customers: Customer[], setSelectedClaim: (claim: VoucherClaim) => void }> = ({ claim, customers, setSelectedClaim }) => {
  const { formatPrice } = useCurrency();
  // Helper to get actual customer name if the record says "Customer"
  const getCustomerDisplayName = () => {
    if (claim.customerName && claim.customerName !== 'Customer' && claim.customerName !== 'Walk-in Customer') {
      return claim.customerName;
    }
    if (claim.customerId) {
      const found = customers.find(c => c.id.toString() === claim.customerId?.toString());
      if (found) return found.name;
    }
    return claim.customerName || 'Customer';
  };

  return (
    <motion.div
      layout
      style={{
        background: 'white',
        borderRadius: '1rem',
        padding: '1rem 1.5rem',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)',
        border: '1px solid #f1f5f9',
        display: 'flex',
        alignItems: 'center',
        gap: '2rem'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: '0 0 250px' }}>
        <div style={{
          width: '2.5rem',
          height: '2.5rem',
          borderRadius: '0.75rem',
          background: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#94a3b8',
          flexShrink: 0
        }}>
          <User size={18} />
        </div>
        <div style={{ minWidth: 0 }}>
          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {getCustomerDisplayName()}
          </h4>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>Issued on {new Date(claim.createdAt || '').toLocaleDateString()}</p>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '3rem' }}>
        <div style={{ minWidth: '150px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#6366f1', background: '#eef2ff', padding: '0.15rem 0.5rem', borderRadius: '0.3rem', width: 'fit-content' }}>{claim.voucherCode}</span>
            {claim.voucher && (
              <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 500 }}>
                Value: {formatPrice(claim.voucher.value)}
              </span>
            )}
          </div>
        </div>
        <div style={{ minWidth: '100px' }}>
          <span style={{
            fontSize: '0.85rem',
            fontWeight: 700,
            color: claim.status === 'redeemed' ? '#ef4444' : (claim.status === 'partially_redeemed' ? '#f59e0b' : '#22c55e')
          }}>
            {claim.status === 'partially_redeemed' ? 'Partial' : (claim.status === 'redeemed' ? 'Used' : 'Active')}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexShrink: 0 }}>
        <div style={{ textAlign: 'right', minWidth: '120px' }}>
          <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: claim.balance > 0 ? '#10b981' : '#f43f5e' }}>
            {formatPrice(claim.balance)}
          </p>
          {claim.voucher && claim.voucher.value > claim.balance && (
            <p style={{ margin: 0, fontSize: '0.7rem', color: '#ef4444', fontWeight: 600 }}>
              {formatPrice(claim.voucher.value - claim.balance)} used
            </p>
          )}
        </div>

        <button
          onClick={() => setSelectedClaim(claim)}
          style={{
            width: '2.25rem',
            height: '2.25rem',
            borderRadius: '0.6rem',
            border: 'none',
            background: '#f1f5f9',
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#1e293b'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}
        >
          <History size={16} />
        </button>
      </div>
    </motion.div>
  );
};
