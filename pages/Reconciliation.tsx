import React, { useState } from 'react';
import { Card, Button, Input, Table } from '../components/UI';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import { useCurrency } from '../components/CurrencyContext';
import { useToast } from '../components/ToastContext';
import { ClipboardCheck, AlertTriangle, CheckCircle, Calculator, RefreshCw } from 'lucide-react';
import { Reconciliation, PaymentMethod } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { LoadingSpinner } from '../components/LoadingSpinner';
import api from '../utils/api';

interface ReconciliationProps {
    paymentMethods: PaymentMethod[];
    fraudProtection?: boolean;
}



const ReconciliationPage: React.FC<ReconciliationProps> = ({ paymentMethods, fraudProtection = false }) => {
    const { symbol, formatPrice } = useCurrency();
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<'daily' | 'history'>('daily');

    // Get current user from Redux
    // @ts-ignore
    const user = useSelector((state: RootState) => state.auth.user);

    // State to store counted values for each payment method ID
    const [counts, setCounts] = useState<Record<string, string>>({});
    const [isCalculated, setIsCalculated] = useState(false);
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isSubmittedToday, setIsSubmittedToday] = useState(false);

    // State for expected totals from API
    const [expectedTotals, setExpectedTotals] = useState<Record<string, number>>({});
    const [totalExpected, setTotalExpected] = useState(0);
    const [totalExpenses, setTotalExpenses] = useState(0);

    // State for reconciliation history
    const [history, setHistory] = useState<Reconciliation[]>([]);

    const getExpectedAmount = (methodIdOrName: string) => {
        const id = methodIdOrName.toLowerCase();
        return expectedTotals[methodIdOrName] || expectedTotals[id] || 0;
    };

    const handleRefresh = async () => {
        try {
            await Promise.all([
                fetchExpectedTotals(),
                fetchReconciliationHistory()
            ]);
        } catch (error) {
            console.error('Refresh failed:', error);
        }
    };

    // Fetch expected totals and history on mount
    React.useEffect(() => {
        fetchExpectedTotals();
        fetchReconciliationHistory();
    }, []);


    const fetchExpectedTotals = async () => {
        try {
            setLoading(true);
            const response = await api.get('/reconciliations/expected-totals');
            const data = response.data;
            setExpectedTotals(data.breakdown || {});
            setTotalExpected(data.total || 0);
            setTotalExpenses(data.totalExpenses || 0);
        } catch (error) {
            console.error('Failed to fetch expected totals:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchReconciliationHistory = async () => {
        try {
            const response = await api.get('/reconciliations');
            const data = response.data;
            const reconciliations = data.reconciliations || [];
            setHistory(reconciliations);

            // Check if today's reconciliation is already submitted
            const today = new Date().toDateString();
            const alreadySubmitted = reconciliations.some((r: Reconciliation) =>
                new Date(r.date).toDateString() === today
            );
            setIsSubmittedToday(alreadySubmitted);
        } catch (error) {
            console.error('Failed to fetch reconciliation history:', error);
        }
    };

    // Calculate totals
    const totalCounted: number = (Object.values(counts) as string[]).reduce((acc: number, val: string) => acc + (parseFloat(val) || 0), 0);
    const difference = totalCounted - totalExpected;
    const isBalanced = Math.abs(difference) < 0.01;

    const handleInputChange = (id: string, value: string) => {
        setCounts(prev => ({ ...prev, [id]: value }));
        // Reset calculation state if user edits inputs to force re-verification
        if (isCalculated) setIsCalculated(false);
    };

    const handleCalculate = async () => {
        setIsCalculated(true);

        // Log the calculation attempt to audit logs
        try {
            const payload = {
                systemTotal: totalExpected,
                countedTotal: totalCounted,
                difference: difference,
                status: isBalanced ? 'balanced' : 'discrepancy',
                notes: notes,
                cashier: user?.name || 'Staff',
                paymentBreakdown: Object.fromEntries(
                    Object.entries(counts).map(([key, value]) => [key, parseFloat(value as string) || 0])
                ),
                totalExpenses: totalExpenses,
            };

            await api.post('/reconciliation-audits/log-calculation', payload);

            console.log('✅ Calculation attempt logged to audit');
        } catch (error) {
            console.error('Failed to log calculation attempt:', error);
            // Don't show error to user - audit logging is background operation
        }
    };

    const handleSaveReconciliation = async () => {
        // Validation: Remarks are required if there's a discrepancy
        if (!isBalanced && !notes.trim()) {
            showToast('Remarks are required when submitting with a discrepancy.', 'error');
            return;
        }

        try {
            setSaving(true);
            const payload = {
                systemTotal: totalExpected,
                countedTotal: totalCounted,
                difference: difference,
                status: isBalanced ? 'balanced' : 'discrepancy',
                notes: notes,
                cashier: user?.name || 'Staff', // Logged in user's name
                paymentBreakdown: Object.fromEntries(
                    Object.entries(counts).map(([key, value]) => [key, parseFloat(value as string) || 0])
                ),
                totalExpenses: totalExpenses, // Added totalExpenses
            };

            await api.post('/reconciliations', payload);


            // Refresh history and reset form
            await fetchReconciliationHistory();

            setCounts({});
            setNotes('');
            setIsCalculated(false);

            const message = isBalanced
                ? 'Reconciliation saved successfully!'
                : 'Day End submitted successfully. Discrepancy details have been emailed to Admin.';
            showToast(message, 'success');
        } catch (error) {
            console.error('Failed to save reconciliation:', error);
            showToast('Failed to save reconciliation. Please try again.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const columns: any[] = [
        {
            header: 'Date',
            accessor: (row: Reconciliation) => {
                try {
                    const d = new Date(row.date);
                    return d.toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                } catch (e) {
                    return row.date;
                }
            }
        },
        { header: 'System Total', accessor: (row: Reconciliation) => formatPrice(row.systemTotal) },
        { header: 'Counted', accessor: (row: Reconciliation) => formatPrice(row.countedTotal) },
        { header: 'Expenses', accessor: (row: Reconciliation) => formatPrice((row as any).totalExpenses || 0) }, // Added Expenses column
        {
            header: 'Difference', accessor: (row: Reconciliation) => (
                <span style={{ color: row.difference === 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 'bold' }}>
                    {row.difference > 0 ? '+' : ''}{row.difference.toFixed(2)}
                </span>
            )
        },
        {
            header: 'Status', accessor: (row: Reconciliation) => (
                <span className={`badge ${row.status === 'balanced' ? 'badge-success' : 'badge-danger'} `}>
                    {row.status}
                </span>
            )
        },
        { header: 'Cashier', accessor: 'cashier' as keyof Reconciliation }
    ];

    return (
        <div className="space-y-6" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
                <Button
                    variant="outline"
                    onClick={handleRefresh}
                    disabled={loading}
                >
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    <span style={{ marginLeft: '0.5rem' }}>Refresh Data</span>
                </Button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
                {/* Input Section */}
                <Card title="Today's Reconciliation">
                    <div className="space-y-6">
                        <p style={{ color: 'var(--text-gray)', fontSize: '0.875rem' }}>
                            Enter the closing amounts for all active payment terminals and cash drawers.
                        </p>


                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
                            {paymentMethods.filter(method => method.active).map((method) => (
                                <div key={method.id}>
                                    <Input
                                        label={`${method.name} (${symbol})`}
                                        type="number"
                                        value={counts[method.id] || ''}
                                        onChange={(e) => handleInputChange(method.id, e.target.value)}
                                        placeholder="0.00"
                                        disabled={isSubmittedToday}
                                    />
                                    {/* {!fraudProtection && (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-gray)', marginTop: '0.25rem', textAlign: 'right' }}>
                                                    System Expected: {formatPrice(getExpectedAmount(method.id) || getExpectedAmount(method.name))}
                                                </div>
                                            )} */}
                                </div>
                            ))}
                        </div>

                        <div className="input-group">
                            <label className="input-label">
                                Remarks / Notes {(isCalculated && !isBalanced) && <span style={{ color: 'var(--danger)' }}>*</span>}
                            </label>
                            <textarea
                                className="form-control"
                                rows={2}
                                placeholder={isCalculated && !isBalanced ? "Reason for potential discrepancy... (Required)" : "Any observations... (Optional)"}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                disabled={isSubmittedToday}
                            ></textarea>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '1.5rem', gap: '1rem' }}>
                            {isCalculated && (
                                <Button variant="ghost" onClick={() => setIsCalculated(false)} icon={<RefreshCw size={16} />}>
                                    Reset
                                </Button>
                            )}
                            <Button
                                onClick={handleCalculate}
                                disabled={Object.keys(counts).length === 0 || isSubmittedToday}
                                icon={<Calculator size={18} />}
                            >
                                Calculate & Verify
                            </Button>
                        </div>
                        {isSubmittedToday && (
                            <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#dcfce7', color: '#15803d', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                                <CheckCircle size={16} />
                                Day End already submitted for today.
                            </div>
                        )}
                    </div>
                </Card>

                {/* Status Card - Hidden until Calculated */}
                <AnimatePresence mode="wait">
                    {isCalculated ? (
                        <motion.div
                            key="results"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                        >
                            <Card title="Reconciliation Report">
                                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '0.5rem 0' }}>

                                    {/* Summary Stats */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
                                        {/* System Expected Column */}
                                        <div style={{ background: 'var(--bg-body)', padding: '1rem', borderRadius: '1rem', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                                <p style={{ fontSize: '0.7rem', color: 'var(--text-gray)', textTransform: 'uppercase', fontWeight: 800, margin: 0, letterSpacing: '0.05em' }}>System Expected</p>
                                                {fraudProtection && <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: '4px', fontWeight: 700 }}>SECURE</span>}
                                            </div>

                                            {!fraudProtection ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                    {paymentMethods.filter(m => m.active).map(m => (
                                                        <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.825rem' }}>
                                                            <span style={{ color: 'var(--text-gray)', fontWeight: 500 }}>System {m.name}</span>
                                                            <span style={{ fontWeight: 700, color: 'var(--text-dark)' }}>{formatPrice(getExpectedAmount(m.id) || getExpectedAmount(m.name))}</span>
                                                        </div>
                                                    ))}
                                                    <div style={{ marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px dashed var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span style={{ fontSize: '0.825rem', fontWeight: 800, color: 'var(--primary)' }}>TOTAL EXPECTED</span>
                                                        <span style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--primary)' }}>{formatPrice(totalExpected)}</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <p style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--primary)', margin: 0 }}>{formatPrice(totalExpected)}</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Total Counted Column */}
                                        <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '1rem', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
                                            <p style={{ fontSize: '0.7rem', color: 'var(--text-gray)', textTransform: 'uppercase', fontWeight: 800, margin: '0 0 0.75rem 0', letterSpacing: '0.05em' }}>Total Counted</p>

                                            {!fraudProtection ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                    {paymentMethods.filter(m => m.active).map(m => (
                                                        <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.825rem' }}>
                                                            <span style={{ color: 'var(--text-gray)', fontWeight: 500 }}>Total {m.name}</span>
                                                            <span style={{ fontWeight: 700, color: 'var(--text-dark)' }}>{formatPrice(parseFloat(counts[m.id]) || 0)}</span>
                                                        </div>
                                                    ))}
                                                    <div style={{ marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px dashed var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span style={{ fontSize: '0.825rem', fontWeight: 800, color: 'var(--text-dark)' }}>TOTAL COUNTED</span>
                                                        <span style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-dark)' }}>{formatPrice(totalCounted)}</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <p style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-dark)', margin: 0 }}>{formatPrice(totalCounted)}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Status Icon & Message */}
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '1.5rem', padding: '1rem', background: isBalanced ? '#f0fdf4' : '#fef2f2', borderRadius: '1rem', border: isBalanced ? '1px solid #bbf7d0' : '1px solid #fecaca' }}>
                                        {isBalanced ? (
                                            <>
                                                <div style={{ width: '2.5rem', height: '2.5rem', background: '#dcfce7', color: '#15803d', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
                                                    <CheckCircle size={20} />
                                                </div>
                                                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: '#166534' }}>FINANCIALLY BALANCED</h3>
                                                <p style={{ color: '#15803d', fontSize: '0.75rem', fontWeight: 500, margin: '0.25rem 0 0 0' }}>All registers match system records perfectly.</p>
                                            </>
                                        ) : (
                                            <>
                                                <div style={{ width: '2.5rem', height: '2.5rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
                                                    <AlertTriangle size={20} />
                                                </div>
                                                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: 'var(--danger)' }}>
                                                    {difference > 0 ? 'OVER' : 'SHORT'} BY {formatPrice(Math.abs(difference))}
                                                </h3>
                                                <p style={{ color: '#991b1b', fontSize: '0.75rem', fontWeight: 500, margin: '0.25rem 0 0 0' }}>
                                                    Discrepancy detected. Please double check all counted values.
                                                </p>
                                            </>
                                        )}
                                    </div>

                                    {/* Expenses Section */}
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <div style={{ background: '#fff1f2', padding: '1rem', borderRadius: '1rem', textAlign: 'center', border: '1px solid #fecdd3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <p style={{ fontSize: '0.75rem', color: '#be123c', textTransform: 'uppercase', fontWeight: 800, margin: 0, letterSpacing: '0.05em' }}>Total Expenses Deducted</p>
                                            <p style={{ fontSize: '1.5rem', fontWeight: 900, color: '#e11d48', margin: 0 }}>{formatPrice(totalExpenses)}</p>
                                        </div>
                                    </div>

                                    {/* Action Button */}
                                    <Button
                                        className="w-full"
                                        variant={isBalanced ? 'primary' : 'danger'}
                                        onClick={handleSaveReconciliation}
                                        isLoading={saving}
                                    >
                                        {isBalanced ? 'Confirm & Close Day' : 'Submit with Discrepancy'}
                                    </Button>

                                </div>
                            </Card>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="placeholder"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <Card>
                                <div style={{ padding: '4rem 2rem', minHeight: '480px', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center', color: 'var(--text-gray)' }}>
                                    <div style={{ background: 'var(--bg-body)', width: '4rem', height: '4rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
                                        <ClipboardCheck size={32} />
                                    </div>
                                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-dark)', marginBottom: '0.5rem' }}>Waiting for Input</h3>
                                    <p style={{ fontSize: '0.875rem' }}>
                                        Enter counts for all payment methods on the left and click "Calculate" to view the end-of-day report.
                                    </p>
                                </div>
                            </Card>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div style={{ marginTop: '2rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1rem' }}>Reconciliation History</h3>
                <Table columns={columns} data={history} isLoading={loading} skeletonCount={5} />
            </div>
        </div>
    );
};

export default ReconciliationPage;
