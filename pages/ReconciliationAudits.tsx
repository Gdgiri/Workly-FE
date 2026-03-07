import React, { useState, useEffect } from 'react';
import { Card, Button } from '../components/UI';
import { useToast } from '../components/ToastContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useCurrency } from '../components/CurrencyContext';
import { History, Users, CheckCircle, XCircle, Filter, RefreshCw, ChevronDown, ChevronUp, Search } from 'lucide-react';
import reconciliationAuditService, { ReconciliationAudit, AuditFilters } from '../utils/reconciliationAuditService';

const ReconciliationAudits: React.FC = () => {
    const { showToast } = useToast();
    const { formatPrice } = useCurrency();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [audits, setAudits] = useState<ReconciliationAudit[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
    });

    // Filters
    const [filters, setFilters] = useState<AuditFilters>({
        page: 1,
        limit: 20,
    });
    // const [showFilters, setShowFilters] = useState(false); // Removed to keep filters always visible
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [attemptType, setAttemptType] = useState<string>('');
    const [attemptStatus, setAttemptStatus] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Expandable rows
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            await Promise.all([fetchAudits(), fetchStats()]);
            setLoading(false);
        };
        loadData();
    }, [filters]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await Promise.all([fetchAudits(), fetchStats()]);
        setRefreshing(false);
    };

    const fetchAudits = async () => {
        try {
            const response = await reconciliationAuditService.getAuditLogs(filters);
            setAudits(response.logs);
            setPagination(response.pagination);
        } catch (error) {
            console.error('Failed to fetch audit logs:', error);
            showToast('Failed to load audit logs', 'error');
        }
    };

    const fetchStats = async () => {
        try {
            const dateRange = dateFrom && dateTo ? { from: dateFrom, to: dateTo } : undefined;
            const response = await reconciliationAuditService.getAuditStats(dateRange);
            setStats(response.stats);
        } catch (error) {
            console.error('Failed to fetch audit stats:', error);
        }
    };

    const applyFilters = () => {
        setFilters({
            ...filters,
            from: dateFrom || undefined,
            to: dateTo || undefined,
            attemptType: attemptType as any || undefined,
            attemptStatus: attemptStatus as any || undefined,
            page: 1,
        });
    };

    const clearFilters = () => {
        setDateFrom('');
        setDateTo('');
        setAttemptType('');
        setAttemptStatus('');
        setFilters({ page: 1, limit: 20 });
    };

    const toggleRow = (id: string) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedRows(newExpanded);
    };

    const getStatusBadge = (status: string) => {
        const styles: Record<string, { bg: string; color: string; icon: any }> = {
            SUCCESS: { bg: '#10B981', color: '#ffffff', icon: CheckCircle },
            FAILED: { bg: '#EF4444', color: '#ffffff', icon: XCircle },
            PARTIAL: { bg: '#F59E0B', color: '#ffffff', icon: XCircle },
        };
        const style = styles[status] || styles.SUCCESS;
        const Icon = style.icon;

        return (
            <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 600,
                background: style.bg,
                color: style.color,
            }}>
                <Icon size={14} />
                {status}
            </span>
        );
    };

    const getTypeBadge = (type: string) => {
        const colors: Record<string, string> = {
            SAVE: '#3B82F6',
            CALCULATE: '#8B5CF6',
            UPDATE: '#F59E0B',
            DELETE: '#EF4444',
        };
        const color = colors[type] || colors.CALCULATE;

        return (
            <span style={{
                padding: '4px 12px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 600,
                background: color,
                color: 'white',
            }}>
                {type}
            </span>
        );
    };


    return (
        <div className="space-y-6">
            {/* Header */}
            {/* Header - Title already in sidebar or breadcrumbs? Actually, usually there's a title here. Let's keep it simple for now as per user request. */}
            <div style={{ display: 'none' }}>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <Button
                        variant="ghost"
                        onClick={handleRefresh}
                        disabled={loading || refreshing}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <RefreshCw size={16} className={(loading || refreshing) ? 'animate-spin' : ''} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Search Bar and Refresh Button row */}
            {/* Moved into Filter Card */}

            {/* Statistics Cards */}
            {stats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
                    {/* 1. Total Attempts - Prismatic Blue */}
                    <div style={{
                        background: 'linear-gradient(135deg, #e0f2fe 0%, #ffffff 100%)',
                        borderRadius: '1.25rem',
                        padding: '1rem',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: '85px',
                        color: '#0369a1',
                        border: '1px solid #bae6fd',
                        boxShadow: '0 10px 15px -3px rgba(186, 230, 253, 0.3), 0 4px 6px -2px rgba(186, 230, 253, 0.2)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                            <div style={{
                                width: '2rem', height: '2rem', borderRadius: '0.5rem',
                                background: '#bae6fd', color: '#0369a1',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <History size={16} />
                            </div>
                            <h4 style={{ margin: 0, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#075985', letterSpacing: '0.05em' }}>Total Attempts</h4>
                        </div>

                        <div style={{
                            background: 'rgba(255, 255, 255, 0.6)',
                            backdropFilter: 'blur(8px)',
                            borderRadius: '0.75rem',
                            padding: '0.5rem 0.75rem',
                            display: 'flex',
                            alignItems: 'baseline',
                            gap: '0.5rem',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.4)'
                        }}>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: '#0c4a6e', letterSpacing: '-0.02em' }}>
                                {stats.totalAttempts}
                            </h3>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0369a1', opacity: 0.8 }}>Logs</span>
                        </div>
                    </div>

                    {/* 2. Successful - Prismatic Green */}
                    <div style={{
                        background: 'linear-gradient(135deg, #dcfce7 0%, #ffffff 100%)',
                        borderRadius: '1.25rem',
                        padding: '1rem',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: '85px',
                        color: '#15803d',
                        border: '1px solid #bbf7d0',
                        boxShadow: '0 10px 15px -3px rgba(187, 247, 208, 0.3), 0 4px 6px -2px rgba(187, 247, 208, 0.2)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                            <div style={{
                                width: '2rem', height: '2rem', borderRadius: '0.5rem',
                                background: '#bbf7d0', color: '#15803d',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <CheckCircle size={16} />
                            </div>
                            <h4 style={{ margin: 0, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#14532d', letterSpacing: '0.05em' }}>Successful</h4>
                        </div>

                        <div style={{
                            background: 'rgba(255, 255, 255, 0.6)',
                            backdropFilter: 'blur(8px)',
                            borderRadius: '0.75rem',
                            padding: '0.5rem 0.75rem',
                            display: 'flex',
                            alignItems: 'baseline',
                            gap: '0.5rem',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.4)'
                        }}>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: '#14532d', letterSpacing: '-0.02em' }}>
                                {stats.successfulAttempts}
                            </h3>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#15803d', opacity: 0.8 }}>Balanced</span>
                        </div>
                    </div>

                    {/* 3. Failed - Prismatic Red */}
                    <div style={{
                        background: 'linear-gradient(135deg, #fee2e2 0%, #ffffff 100%)',
                        borderRadius: '1.25rem',
                        padding: '1rem',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: '85px',
                        color: '#b91c1c',
                        border: '1px solid #fecaca',
                        boxShadow: '0 10px 15px -3px rgba(254, 202, 202, 0.3), 0 4px 6px -2px rgba(254, 202, 202, 0.2)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                            <div style={{
                                width: '2rem', height: '2rem', borderRadius: '0.5rem',
                                background: '#fecaca', color: '#b91c1c',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <XCircle size={16} />
                            </div>
                            <h4 style={{ margin: 0, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#7f1d1d', letterSpacing: '0.05em' }}>Failed / Issues</h4>
                        </div>

                        <div style={{
                            background: 'rgba(255, 255, 255, 0.6)',
                            backdropFilter: 'blur(8px)',
                            borderRadius: '0.75rem',
                            padding: '0.5rem 0.75rem',
                            display: 'flex',
                            alignItems: 'baseline',
                            gap: '0.5rem',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.4)'
                        }}>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: '#7f1d1d', letterSpacing: '-0.02em' }}>
                                {stats.failedAttempts}
                            </h3>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#b91c1c', opacity: 0.8 }}>Issues</span>
                        </div>
                    </div>

                    {/* 4. Unique Users - Prismatic Purple */}
                    <div style={{
                        background: 'linear-gradient(135deg, #f3e8ff 0%, #ffffff 100%)',
                        borderRadius: '1.25rem',
                        padding: '1rem',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: '85px',
                        color: '#6b21a8',
                        border: '1px solid #e9d5ff',
                        boxShadow: '0 10px 15px -3px rgba(233, 213, 255, 0.3), 0 4px 6px -2px rgba(233, 213, 255, 0.2)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                            <div style={{
                                width: '2rem', height: '2rem', borderRadius: '0.5rem',
                                background: '#e9d5ff', color: '#6b21a8',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <Users size={16} />
                            </div>
                            <h4 style={{ margin: 0, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#6b21a8', letterSpacing: '0.05em' }}>Unique Users</h4>
                        </div>

                        <div style={{
                            background: 'rgba(255, 255, 255, 0.6)',
                            backdropFilter: 'blur(8px)',
                            borderRadius: '0.75rem',
                            padding: '0.5rem 0.75rem',
                            display: 'flex',
                            alignItems: 'baseline',
                            gap: '0.5rem',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.4)'
                        }}>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: '#581c87', letterSpacing: '-0.02em' }}>
                                {stats.uniqueUsers}
                            </h3>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b21a8', opacity: 0.8 }}>Members</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Filters and Search Combined - Single Row */}
            <Card style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'nowrap', alignItems: 'flex-end', overflowX: 'auto', paddingBottom: '2px' }}>
                    {/* Integrated Search Bar - Increased Width */}
                    <div className="input-group" style={{ flex: '2 1 600px', maxWidth: '350px' }}>
                        <label className="input-label" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.75rem' }}>Search</label>
                        <div style={{ position: 'relative' }}>
                            <Search style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-gray)', opacity: 0.5 }} size={14} />
                            <input
                                type="text"
                                placeholder="Search by name or notes..."
                                value={filters.search}
                                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                                className="form-control"
                                style={{
                                    width: '100%',
                                    paddingLeft: '2.15rem',
                                    border: '1.5px solid var(--border)',
                                    borderRadius: '6px',
                                    fontSize: '0.8125rem',
                                    height: '40px'
                                }}
                            />
                        </div>
                    </div>

                    <div className="input-group" style={{ flex: '0 0 150px' }}>
                        <label className="input-label" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.75rem' }}>From</label>
                        <input
                            type="date"
                            className="form-control"
                            value={filters.from}
                            onChange={(e) => setFilters(prev => ({ ...prev, from: e.target.value }))}
                            style={{ height: '40px', borderRadius: '6px', fontSize: '0.8125rem', padding: '0.5rem' }}
                        />
                    </div>

                    <div className="input-group" style={{ flex: '0 0 150px' }}>
                        <label className="input-label" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.75rem' }}>To</label>
                        <input
                            type="date"
                            className="form-control"
                            value={filters.to}
                            onChange={(e) => setFilters(prev => ({ ...prev, to: e.target.value }))}
                            style={{ height: '40px', borderRadius: '6px', fontSize: '0.8125rem', padding: '0.5rem' }}
                        />
                    </div>

                    <div className="input-group" style={{ flex: '0 0 170px' }}>
                        <label className="input-label" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.75rem' }}>Type</label>
                        <select
                            className="form-control"
                            value={filters.attemptType}
                            onChange={(e) => setFilters(prev => ({ ...prev, attemptType: e.target.value }))}
                            style={{ height: '40px', borderRadius: '6px', fontSize: '0.8125rem' }}
                        >
                            <option value="">All Types</option>
                            <option value="SAVE">Save</option>
                            <option value="CALCULATE">Calculate</option>
                            <option value="UPDATE">Update</option>
                            <option value="DELETE">Delete</option>
                        </select>
                    </div>

                    <div className="input-group" style={{ flex: '0 0 170px' }}>
                        <label className="input-label" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.75rem' }}>Status</label>
                        <select
                            className="form-control"
                            value={filters.attemptStatus}
                            onChange={(e) => setFilters(prev => ({ ...prev, attemptStatus: e.target.value }))}
                            style={{ height: '40px', borderRadius: '6px', fontSize: '0.8125rem' }}
                        >
                            <option value="">All Statuses</option>
                            <option value="SUCCESS">Success</option>
                            <option value="FAILED">Failed</option>
                            <option value="PARTIAL">Partial</option>
                        </select>
                    </div>

                    <div className="input-group" style={{ display: 'flex', flexDirection: 'column' }}>
                        <label className="input-label" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.75rem' }}>&nbsp;</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <Button
                                onClick={clearFilters}
                                style={{
                                    height: '40px',
                                    padding: '0 0.85rem',
                                    background: '#f8fafc',
                                    border: '1px solid #e2e8f0',
                                    color: '#64748b',
                                    borderRadius: '6px',
                                    fontSize: '0.8125rem',
                                    fontWeight: 500,
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                Clear
                            </Button>
                            <Button
                                onClick={applyFilters}
                                style={{
                                    height: '40px',
                                    background: 'var(--primary-dark, #234c6a)',
                                    color: 'white',
                                    padding: '0 1rem',
                                    borderRadius: '6px',
                                    fontSize: '0.8125rem',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                Apply
                            </Button>
                            <Button
                                onClick={handleRefresh}
                                disabled={loading || refreshing}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    height: '40px',
                                    background: 'var(--primary)',
                                    color: 'white',
                                    padding: '0 1rem',
                                    borderRadius: '6px',
                                    fontSize: '0.8125rem',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                <RefreshCw size={14} className={(loading || refreshing) ? 'animate-spin' : ''} />
                                Refresh
                            </Button>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Audit Logs Table */}
            <Card>
                {audits.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-gray)' }}>
                        <History size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                        <p>No audit logs found</p>
                    </div>
                ) : (
                    <>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                                        <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-gray)', textTransform: 'uppercase' }}>Timestamp</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-gray)', textTransform: 'uppercase' }}>User</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-gray)', textTransform: 'uppercase' }}>Type</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-gray)', textTransform: 'uppercase' }}>Status</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-gray)', textTransform: 'uppercase' }}>Discrepancy</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-gray)', textTransform: 'uppercase' }}>Duration</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-gray)', textTransform: 'uppercase' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {audits
                                        .filter(audit => {
                                            if (!searchQuery.trim()) return true;
                                            const query = searchQuery.toLowerCase();
                                            const userName = (audit.userName || '').toLowerCase();
                                            const notes = (audit.inputData?.notes || '').toLowerCase();
                                            return userName.includes(query) || notes.includes(query);
                                        })
                                        .map((audit) => {
                                            const isExpanded = expandedRows.has(audit.id);

                                            return (
                                                <React.Fragment key={audit.id}>
                                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                                        <td style={{ padding: '1rem 0.75rem' }}>
                                                            <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                                                                {new Date(audit.attemptTimestamp).toLocaleDateString()}
                                                            </div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-gray)' }}>
                                                                {new Date(audit.attemptTimestamp).toLocaleTimeString()}
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '1rem 0.75rem' }}>
                                                            <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                                                                {audit.userName || 'Unknown'}
                                                            </div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-gray)' }}>
                                                                {audit.userRole || 'N/A'}
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '1rem 0.75rem' }}>
                                                            {getTypeBadge(audit.attemptType)}
                                                        </td>
                                                        <td style={{ padding: '1rem 0.75rem' }}>
                                                            {getStatusBadge(audit.attemptStatus)}
                                                        </td>
                                                        <td style={{ padding: '1rem 0.75rem' }}>
                                                            {audit.discrepancyAmount !== null && audit.discrepancyAmount !== undefined ? (
                                                                <div>
                                                                    <div style={{ fontWeight: 600, color: audit.discrepancyType === 'BALANCED' ? '#10B981' : '#EF4444' }}>
                                                                        {formatPrice(audit.discrepancyAmount)}
                                                                    </div>
                                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-gray)' }}>
                                                                        {audit.discrepancyType}
                                                                    </div>
                                                                </div>
                                                            ) : '—'}
                                                        </td>
                                                        <td style={{ padding: '1rem 0.75rem', fontSize: '0.875rem', color: 'var(--text-gray)' }}>
                                                            {audit.duration ? `${audit.duration}ms` : '—'}
                                                        </td>
                                                        <td style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => toggleRow(audit.id)}
                                                                icon={isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                            >
                                                                {isExpanded ? 'Hide' : 'Details'}
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                    {isExpanded && (
                                                        <tr>
                                                            <td colSpan={7} style={{ padding: '0.75rem', background: 'var(--bg-card)' }}>
                                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                                                                    {/* Payment Breakdown */}
                                                                    <div>
                                                                        <h4 style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.5rem' }}>Payment Breakdown</h4>
                                                                        <div style={{ background: 'white', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
                                                                            {audit.inputData?.paymentBreakdown && Object.entries(audit.inputData.paymentBreakdown).map(([key, value]) => (
                                                                                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px solid var(--border-light)', fontSize: '0.8125rem' }}>
                                                                                    <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>{key}:</span>
                                                                                    <span style={{ fontWeight: 600 }}>{formatPrice(value as number)}</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>

                                                                    {/* Summary */}
                                                                    <div>
                                                                        <h4 style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.5rem' }}>Summary</h4>
                                                                        <div style={{ background: 'white', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
                                                                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px solid var(--border-light)', fontSize: '0.8125rem' }}>
                                                                                <span style={{ fontWeight: 500 }}>System Total:</span>
                                                                                <span style={{ fontWeight: 600 }}>{formatPrice(audit.calculatedResults?.systemTotal || 0)}</span>
                                                                            </div>
                                                                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px solid var(--border-light)', fontSize: '0.8125rem' }}>
                                                                                <span style={{ fontWeight: 500 }}>Counted Total:</span>
                                                                                <span style={{ fontWeight: 600 }}>{formatPrice(audit.calculatedResults?.countedTotal || 0)}</span>
                                                                            </div>
                                                                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px solid var(--border-light)', fontSize: '0.8125rem' }}>
                                                                                <span style={{ fontWeight: 500 }}>Difference:</span>
                                                                                <span style={{ fontWeight: 600, color: audit.calculatedResults?.difference === 0 ? '#10B981' : '#EF4444' }}>
                                                                                    {formatPrice(audit.calculatedResults?.difference || 0)}
                                                                                </span>
                                                                            </div>
                                                                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', fontSize: '0.8125rem' }}>
                                                                                <span style={{ fontWeight: 500 }}>Total Expenses:</span>
                                                                                <span style={{ fontWeight: 600 }}>{formatPrice(audit.calculatedResults?.totalExpenses || 0)}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Notes */}
                                                                    {audit.inputData?.notes && (
                                                                        <div style={{ gridColumn: 'span 2' }}>
                                                                            <h4 style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.35rem' }}>Notes</h4>
                                                                            <div style={{ background: 'white', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.8125rem', color: 'var(--text-gray)' }}>
                                                                                {audit.inputData.notes}
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {/* Metadata */}
                                                                    {/* <div style={{ gridColumn: 'span 2' }}>
                                                                        <h4 style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.5rem' }}>Metadata</h4>
                                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                                                                            <div style={{ background: 'white', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
                                                                                <div style={{ fontSize: '0.625rem', color: 'var(--text-gray)', marginBottom: '0.15rem', textTransform: 'uppercase' }}>IP Address</div>
                                                                                <div style={{ fontSize: '0.8125rem', fontWeight: 500 }}>{audit.ipAddress || 'N/A'}</div>
                                                                            </div>
                                                                            <div style={{ background: 'white', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
                                                                                <div style={{ fontSize: '0.625rem', color: 'var(--text-gray)', marginBottom: '0.15rem', textTransform: 'uppercase' }}>Request ID</div>
                                                                                <div style={{ fontSize: '0.8125rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                                    {audit.requestId ? audit.requestId.substring(0, 12) + '...' : 'N/A'}
                                                                                </div>
                                                                            </div>
                                                                            <div style={{ background: 'white', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
                                                                                <div style={{ fontSize: '0.625rem', color: 'var(--text-gray)', marginBottom: '0.15rem', textTransform: 'uppercase' }}>Reconciliation ID</div>
                                                                                <div style={{ fontSize: '0.8125rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                                    {audit.reconciliationId ? audit.reconciliationId.substring(0, 12) + '...' : 'N/A'}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div> */}

                                                                    {/* Error Message */}
                                                                    {audit.errorMessage && (
                                                                        <div style={{ gridColumn: 'span 2' }}>
                                                                            <div style={{ background: '#FEE2E2', padding: '0.5rem', borderRadius: '6px', border: '1px solid #FCA5A5' }}>
                                                                                <div style={{ fontSize: '0.6875rem', color: '#991B1B', fontWeight: 600, marginBottom: '0.25rem', textTransform: 'uppercase' }}>Error Message</div>
                                                                                <div style={{ fontSize: '0.8125rem', color: '#7F1D1D' }}>{audit.errorMessage}</div>
                                                                                {audit.errorCode && (
                                                                                    <div style={{ fontSize: '0.6875rem', color: '#991B1B', marginTop: '0.25rem' }}>Code: {audit.errorCode}</div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-gray)' }}>
                                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={pagination.page === 1}
                                    onClick={() => setFilters({ ...filters, page: pagination.page - 1 })}
                                >
                                    Previous
                                </Button>
                                <div style={{ padding: '0.5rem 1rem', background: 'var(--primary)', color: 'white', borderRadius: '6px', fontSize: '0.875rem', fontWeight: 600 }}>
                                    {pagination.page}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={pagination.page === pagination.totalPages}
                                    onClick={() => setFilters({ ...filters, page: pagination.page + 1 })}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </Card>
        </div>
    );
};

export default ReconciliationAudits;
