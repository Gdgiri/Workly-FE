import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Building2, Mail, Phone, MapPin, Calendar, CheckCircle, XCircle,
    Clock, AlertCircle, Loader
} from 'lucide-react';
import { getPendingBusinesses, approveBusiness, rejectBusiness, getSubscriptionPlans } from '../../utils/api/superadmin';

interface Business {
    id: string;
    authId: string;
    businessName: string;
    businessEmail: string;
    businessPhone: string;
    businessAddress: string;
    createdAt: string;
}

interface SubscriptionPlan {
    id: string;
    name: string;
    monthlyPrice: number;
    isTrial?: boolean;
    isDefault?: boolean;
    trialDays?: number;
}

export const BusinessApprovals = () => {
    const [businesses, setBusinesses] = useState<Business[]>([]);
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState('');

    // Modal states
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
    const [selectedPlan, setSelectedPlan] = useState('');
    const [rejectionReason, setRejectionReason] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [businessesData, plansData] = await Promise.all([
                getPendingBusinesses(),
                getSubscriptionPlans()
            ]);

            setBusinesses(businessesData.businesses || []);
            setPlans(plansData.plans || []);

            // Set default plan
            const defaultPlan = plansData.plans?.find((p: SubscriptionPlan) => p.isDefault);
            if (defaultPlan) {
                setSelectedPlan(defaultPlan.id);
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleApproveClick = (business: Business) => {
        setSelectedBusiness(business);
        setShowApproveModal(true);
    };

    const handleRejectClick = (business: Business) => {
        setSelectedBusiness(business);
        setShowRejectModal(true);
    };

    const handleApprove = async () => {
        if (!selectedBusiness || !selectedPlan) return;

        try {
            setActionLoading(selectedBusiness.id);
            await approveBusiness(selectedBusiness.id, selectedPlan);

            // Remove from list
            setBusinesses(businesses.filter(b => b.id !== selectedBusiness.id));
            setShowApproveModal(false);
            setSelectedBusiness(null);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to approve business');
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async () => {
        if (!selectedBusiness || !rejectionReason.trim()) {
            alert('Please provide a rejection reason');
            return;
        }

        try {
            setActionLoading(selectedBusiness.id);
            await rejectBusiness(selectedBusiness.id, rejectionReason);

            // Remove from list
            setBusinesses(businesses.filter(b => b.id !== selectedBusiness.id));
            setShowRejectModal(false);
            setSelectedBusiness(null);
            setRejectionReason('');
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to reject business');
        } finally {
            setActionLoading(null);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '400px'
            }}>
                <Loader className="animate-spin" size={40} color="#667eea" />
            </div>
        );
    }

    return (
        <div style={{ padding: '2rem' }}>
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                    Business Approvals
                </h1>
                <p style={{ color: '#6b7280' }}>
                    Review and approve new salon business applications
                </p>
            </div>

            {error && (
                <div style={{
                    padding: '1rem',
                    background: '#fee2e2',
                    color: '#dc2626',
                    borderRadius: '0.5rem',
                    marginBottom: '1.5rem'
                }}>
                    {error}
                </div>
            )}

            {/* Stats */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
                marginBottom: '2rem'
            }}>
                <div style={{
                    background: '#fef3c7',
                    padding: '1.5rem',
                    borderRadius: '1rem',
                    border: '2px solid #fbbf24'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <Clock size={20} color="#f59e0b" />
                        <span style={{ fontSize: '0.875rem', color: '#92400e', fontWeight: 600 }}>
                            Pending Approval
                        </span>
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#78350f' }}>
                        {businesses.length}
                    </div>
                </div>
            </div>

            {/* Business Cards */}
            {businesses.length === 0 ? (
                <div style={{
                    textAlign: 'center',
                    padding: '4rem 2rem',
                    background: '#f9fafb',
                    borderRadius: '1rem'
                }}>
                    <CheckCircle size={64} style={{ color: '#10b981', margin: '0 auto 1rem' }} />
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                        All Caught Up!
                    </h3>
                    <p style={{ color: '#6b7280' }}>
                        No pending business applications at the moment.
                    </p>
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gap: '1.5rem'
                }}>
                    {businesses.map((business) => (
                        <motion.div
                            key={business.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            style={{
                                background: 'white',
                                border: '1px solid #e5e7eb',
                                borderRadius: '1rem',
                                padding: '1.5rem',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                            }}
                        >
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'start',
                                marginBottom: '1.5rem'
                            }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                        <Building2 size={24} color="#667eea" />
                                        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                                            {business.businessName}
                                        </h3>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#6b7280', fontSize: '0.875rem' }}>
                                        <Calendar size={16} />
                                        <span>Applied {formatDate(business.createdAt)}</span>
                                    </div>
                                </div>

                                <div style={{
                                    background: '#fef3c7',
                                    color: '#92400e',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '999px',
                                    fontSize: '0.875rem',
                                    fontWeight: 600
                                }}>
                                    Pending Review
                                </div>
                            </div>

                            {/* Business Details */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                                gap: '1rem',
                                marginBottom: '1.5rem',
                                padding: '1rem',
                                background: '#f9fafb',
                                borderRadius: '0.5rem'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'start', gap: '0.75rem' }}>
                                    <Mail size={18} style={{ color: '#667eea', marginTop: '0.125rem' }} />
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                                            Email
                                        </div>
                                        <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                                            {business.businessEmail}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'start', gap: '0.75rem' }}>
                                    <Phone size={18} style={{ color: '#667eea', marginTop: '0.125rem' }} />
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                                            Phone
                                        </div>
                                        <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                                            {business.businessPhone}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'start', gap: '0.75rem', gridColumn: '1 / -1' }}>
                                    <MapPin size={18} style={{ color: '#667eea', marginTop: '0.125rem' }} />
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                                            Address
                                        </div>
                                        <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                                            {business.businessAddress}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button
                                    onClick={() => handleApproveClick(business)}
                                    disabled={actionLoading === business.id}
                                    style={{
                                        flex: 1,
                                        padding: '0.75rem',
                                        background: '#10b981',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '0.5rem',
                                        fontSize: '0.875rem',
                                        fontWeight: 600,
                                        cursor: actionLoading === business.id ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem'
                                    }}
                                >
                                    <CheckCircle size={18} />
                                    Approve
                                </button>

                                <button
                                    onClick={() => handleRejectClick(business)}
                                    disabled={actionLoading === business.id}
                                    style={{
                                        flex: 1,
                                        padding: '0.75rem',
                                        background: '#ef4444',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '0.5rem',
                                        fontSize: '0.875rem',
                                        fontWeight: 600,
                                        cursor: actionLoading === business.id ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem'
                                    }}
                                >
                                    <XCircle size={18} />
                                    Reject
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Approve Modal */}
            {showApproveModal && selectedBusiness && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        style={{
                            background: 'white',
                            borderRadius: '1rem',
                            padding: '2rem',
                            maxWidth: '500px',
                            width: '90%'
                        }}
                    >
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
                            Approve Business
                        </h3>
                        <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
                            Approve <strong>{selectedBusiness.businessName}</strong> and assign a subscription plan.
                        </p>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                                Subscription Plan
                            </label>
                            <select
                                value={selectedPlan}
                                onChange={(e) => setSelectedPlan(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '0.5rem',
                                    fontSize: '1rem'
                                }}
                            >
                                {plans.map((plan) => (
                                    <option key={plan.id} value={plan.id}>
                                        {plan.name} - ₹{plan.monthlyPrice}/month
                                        {plan.isTrial && ' (Trial)'}
                                        {plan.isDefault && ' (Default)'}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button
                                onClick={() => {
                                    setShowApproveModal(false);
                                    setSelectedBusiness(null);
                                }}
                                style={{
                                    flex: 1,
                                    padding: '0.75rem',
                                    background: '#f3f4f6',
                                    color: '#374151',
                                    border: 'none',
                                    borderRadius: '0.5rem',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleApprove}
                                disabled={!!actionLoading}
                                style={{
                                    flex: 1,
                                    padding: '0.75rem',
                                    background: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '0.5rem',
                                    fontWeight: 600,
                                    cursor: actionLoading ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {actionLoading ? 'Approving...' : 'Approve'}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Reject Modal */}
            {showRejectModal && selectedBusiness && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        style={{
                            background: 'white',
                            borderRadius: '1rem',
                            padding: '2rem',
                            maxWidth: '500px',
                            width: '90%'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                            <AlertCircle size={24} color="#ef4444" />
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                                Reject Business
                            </h3>
                        </div>
                        <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
                            Reject <strong>{selectedBusiness.businessName}</strong>. Please provide a reason.
                        </p>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                                Rejection Reason
                            </label>
                            <textarea
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="Please explain why this application is being rejected..."
                                rows={4}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '0.5rem',
                                    fontSize: '1rem',
                                    resize: 'vertical'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button
                                onClick={() => {
                                    setShowRejectModal(false);
                                    setSelectedBusiness(null);
                                    setRejectionReason('');
                                }}
                                style={{
                                    flex: 1,
                                    padding: '0.75rem',
                                    background: '#f3f4f6',
                                    color: '#374151',
                                    border: 'none',
                                    borderRadius: '0.5rem',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleReject}
                                disabled={!!actionLoading}
                                style={{
                                    flex: 1,
                                    padding: '0.75rem',
                                    background: '#ef4444',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '0.5rem',
                                    fontWeight: 600,
                                    cursor: actionLoading ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {actionLoading ? 'Rejecting...' : 'Reject'}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
};
