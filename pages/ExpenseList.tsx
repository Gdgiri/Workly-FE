import React, { useState, useEffect } from 'react';

import { motion } from 'framer-motion';
import { Plus, Search, Filter, Edit2, Trash2, DollarSign, Zap, Hash, Wallet, RefreshCw } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../redux/store';
import { fetchExpenses, deleteExpense, createExpense, updateExpense, Expense } from '../redux/slices/expenseSlice';
// Expense interface definition (assumed to be in expenseSlice, but updating local reliance if needed or just assuming it's returned)
// If Expense interface is imported, I might need to update the redux slice file too if it defines the type strictly. 
// But first let's check expenseSlice to be sure.

import { Card, Button, Input, Table, Modal, Select, KPICard } from '../components/UI';
import { Skeleton } from '../components/Skeleton';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useToast } from '../components/ToastContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import api from '../utils/api';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinary';
import { UploadCloud, X, Image as ImageIcon, Loader2 } from 'lucide-react';

const COLORS = [
    '#6366f1', // Indigo
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#f43f5e', // Rose
    '#f59e0b', // Amber
    '#10b981', // Emerald
    '#06b6d4', // Cyan
];

import { useCurrency } from '../components/CurrencyContext';

const ExpenseList: React.FC = () => {
    const dispatch = useDispatch<AppDispatch>();
    const { expenses, loading } = useSelector((state: RootState) => state.expense);
    const { showToast } = useToast();
    const { formatPrice, symbol } = useCurrency();

    // Default dates to today
    const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
    const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const RECS_PER_PAGE = 10;

    const [isMinLoading, setIsMinLoading] = useState(true);
    const [expenseCategories, setExpenseCategories] = useState<Array<{ id: string, name: string }>>([]);

    const fetchCategories = async () => {
        try {
            const categoriesResponse = await api.get('/categories', {
                params: { type: 'EXPENSE' }
            });
            if (categoriesResponse.data) {
                setExpenseCategories(categoriesResponse.data
                    .filter((cat: any) => cat.isActive !== false && cat.active !== false)
                    .map((cat: any) => ({
                    id: cat.id,
                    name: cat.name
                })));
            }
        } catch (error) {
            console.error('Failed to fetch categories:', error);
        }
    };

    const handleRefresh = async () => {
        try {
            await dispatch(fetchExpenses()).unwrap();
            await fetchCategories();
        } catch (error) {
            console.error('Refresh failed:', error);
        }
    };

    useEffect(() => {
        const init = async () => {
            try {
                await dispatch(fetchExpenses()).unwrap();
                await fetchCategories();
            } catch (error) {
                console.error('Failed to fetch initial data:', error);
            } finally {
                setIsMinLoading(false);
            }
        };
        init();
    }, [dispatch]);

    // Only show full-page loading if we have NO data to show
    const showLoading = expenses.length === 0 && (loading || isMinLoading);

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this expense?')) {
            try {
                await dispatch(deleteExpense(id)).unwrap();
                showToast('Expense deleted successfully', 'success');
            } catch (error: any) {
                const errorMessage = typeof error === 'string' ? error : (error?.message || 'Failed to delete expense');
                showToast(errorMessage, 'error');
            }
        }
    };

    const categories = ['All', ...Array.from(new Set(expenses.map(e => e.category)))];

    const filteredExpenses = expenses.filter(expense => {
        const expenseDate = new Date(expense.date).toISOString().split('T')[0];
        const isAfterFrom = !fromDate || expenseDate >= fromDate;
        const isBeforeTo = !toDate || expenseDate <= toDate;

        const matchesSearch = expense.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            expense.description?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = categoryFilter === 'All' || expense.category === categoryFilter;

        return matchesSearch && matchesCategory && isAfterFrom && isBeforeTo;
    });

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, categoryFilter, fromDate, toDate]);

    const totalExpense = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

    // Calculate Daily Burn and Transactions
    const transactionCount = filteredExpenses.length;

    // Calculate days diff
    const start = new Date(fromDate);
    const end = new Date(toDate);
    const oneDay = 24 * 60 * 60 * 1000;
    const diffDays = Math.round(Math.abs((end.getTime() - start.getTime()) / oneDay)) + 1;

    const dailyBurn = diffDays > 0 ? totalExpense / diffDays : 0;

    // Pagination Logic
    const totalPages = Math.ceil(filteredExpenses.length / RECS_PER_PAGE);
    const startIndex = (currentPage - 1) * RECS_PER_PAGE;
    const paginatedExpenses = filteredExpenses.slice(startIndex, startIndex + RECS_PER_PAGE);

    // Calculate chart data based on filtered data
    const chartData = Array.from(
        filteredExpenses.reduce((acc, curr) => {
            const amount = acc.get(curr.category) || 0;
            acc.set(curr.category, amount + curr.amount);
            return acc;
        }, new Map<string, number>())
    ).map(([name, value]) => ({ name, value }));

    const columns = [
        { header: 'Date', accessor: (e: Expense) => new Date(e.date).toLocaleDateString() },
        { header: 'Title', accessor: 'title' as const },
        { header: 'Category', accessor: 'category' as const },
        { header: 'Cashier', accessor: (e: Expense) => <span style={{ color: 'var(--text-black)' }}>{e.cashierName || 'Admin'}</span> },
        { header: 'Amount', accessor: (e: Expense) => <span style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{formatPrice(e.amount)}</span> },
        // {
        //     header: 'Actions',
        //     accessor: (e: Expense) => (
        //         <div style={{ display: 'flex', gap: '0.5rem' }}>
        //             <button
        //                 onClick={() => { setSelectedExpense(e); setIsEditModalOpen(true); }}
        //                 style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}
        //             >
        //                 <Edit2 size={16} />
        //             </button>
        //             <button
        //                 onClick={() => handleDelete(e.id)}
        //                 style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}
        //             >
        //                 <Trash2 size={16} />
        //             </button>
        //         </div>
        //     )
        // }
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
            style={{ position: 'relative' }}
        >


            {!showLoading && (
                <>
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                        <Button
                            variant="outline"
                            onClick={handleRefresh}
                            disabled={showLoading}
                            style={{
                                height: '42px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                backgroundColor: '#fff',
                                borderColor: 'var(--border)',
                                color: 'var(--text-dark)'
                            }}
                        >
                            <RefreshCw size={18} className={showLoading ? 'animate-spin' : ''} />
                            Refresh
                        </Button>
                        <Button
                            variant="primary"
                            // icon={<Plus size={18} />}
                            onClick={() => setIsAddModalOpen(true)}
                            style={{ height: '42px' }}
                        >
                            Add Expense
                        </Button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                        <KPICard
                            title="Total Spend"
                            value={formatPrice(totalExpense)}
                            icon={Wallet}
                            color="#6366f1"
                            variant="colored"
                            loading={loading}
                        />

                        <KPICard
                            title="Daily Burn"
                            value={formatPrice(dailyBurn)}
                            icon={Zap}
                            color="#f59e0b"
                            variant="colored"
                            loading={loading}
                        />

                        <KPICard
                            title="Transactions"
                            value={transactionCount}
                            icon={Hash}
                            color="#8b5cf6"
                            variant="colored"
                            loading={loading}
                        />

                        {/* Category Distribution Chart */}
                        <Card style={{ padding: '1rem' }}>
                            <div style={{ width: '100%', height: 100 }}>
                                {loading && chartData.length === 0 ? (
                                    <Skeleton width="100%" height="80px" />
                                ) : chartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={chartData}
                                                cx="40%"
                                                cy="50%"
                                                innerRadius={30}
                                                outerRadius={45}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {chartData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip
                                                contentStyle={{
                                                    borderRadius: '0.75rem',
                                                    border: 'none',
                                                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                                    background: '#fff',
                                                    padding: '0.75rem'
                                                }}
                                                itemStyle={{
                                                    fontSize: '0.8125rem',
                                                    fontWeight: 600
                                                }}
                                                formatter={(value: number) => [`${formatPrice(value)}`, 'Total']}
                                            />
                                            <Legend
                                                verticalAlign="middle"
                                                align="right"
                                                layout="vertical"
                                                iconType="circle"
                                                formatter={(value) => (
                                                    <span style={{ color: 'var(--text-black)', fontSize: '0.75rem', fontWeight: 500 }}>{value}</span>
                                                )}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-black)', fontSize: '0.875rem', background: 'var(--bg-body)', borderRadius: '0.75rem', border: '1px dashed var(--border)' }}>
                                        No data
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>

                    <div style={{
                        display: 'flex',
                        gap: '1rem',
                        flexWrap: 'wrap',
                        background: 'rgba(255, 255, 255, 0.7)',
                        backdropFilter: 'blur(10px)',
                        padding: '1.25rem',
                        borderRadius: '1.25rem',
                        border: '1px solid var(--border-light)',
                        alignItems: 'flex-end',
                        boxShadow: 'var(--shadow-sm)'
                    }}>
                        {/* Date Filters */}
                        <div style={{ width: '160px' }}>
                            <Input
                                label="From"
                                type="date"
                                value={fromDate}
                                onChange={(e) => setFromDate(e.target.value)}
                                style={{ height: '44px' }}
                            />
                        </div>
                        <div style={{ width: '160px' }}>
                            <Input
                                label="To"
                                type="date"
                                value={toDate}
                                onChange={(e) => setToDate(e.target.value)}
                                style={{ height: '44px' }}
                            />
                        </div>

                        {/* Search */}
                        <div className="input-group" style={{ flex: 1, minWidth: '250px' }}>
                            <label className="input-label">Quick Search</label>
                            <div style={{ position: 'relative' }}>
                                <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-black)', width: 16, height: 16 }} />
                                <input
                                    type="text"
                                    placeholder="Search by title or description..."
                                    className="form-control"
                                    style={{ paddingLeft: '2.5rem', width: '100%', height: '44px' }}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Category */}
                        <div style={{ width: '200px' }}>
                            <Select
                                label="Filter Category"
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                                options={categories.map(cat => ({ value: cat, label: cat }))}
                                style={{ height: '44px' }}
                            />
                        </div>

                        <div className="input-group" style={{ width: 'auto' }}>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    const today = new Date().toISOString().split('T')[0];
                                    setFromDate(today);
                                    setToDate(today);
                                    setSearchTerm('');
                                    setCategoryFilter('All');
                                }}
                                style={{ height: '44px', padding: '0 1.5rem', borderColor: 'var(--border-light)' }}
                            >
                                Reset Filters
                            </Button>
                        </div>
                    </div>

                    <Card>


                        <Table
                            columns={columns}
                            data={paginatedExpenses}
                            isLoading={loading}
                        />

                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontSize: '0.875rem', color: 'var(--text-black)' }}>
                                    Showing <span style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{startIndex + 1}</span> to <span style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{Math.min(startIndex + RECS_PER_PAGE, filteredExpenses.length)}</span> of <span style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{filteredExpenses.length}</span> results
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <Button
                                        variant="outline"
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        disabled={currentPage === 1}
                                        style={{ padding: '0.5rem 1rem', height: 'auto', fontSize: '0.8125rem' }}
                                    >
                                        Previous
                                    </Button>
                                    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                                        {[...Array(totalPages)].map((_, i) => {
                                            const pageNum = i + 1;
                                            // Show limited page numbers if there are too many
                                            if (totalPages > 7 && (pageNum > 2 && pageNum < totalPages - 1 && Math.abs(pageNum - currentPage) > 1)) {
                                                if (pageNum === 3 || pageNum === totalPages - 2) return <span key={pageNum} style={{ padding: '0 0.5rem', color: 'var(--text-black)' }}>...</span>;
                                                return null;
                                            }
                                            return (
                                                <button
                                                    key={pageNum}
                                                    onClick={() => setCurrentPage(pageNum)}
                                                    style={{
                                                        width: '32px',
                                                        height: '32px',
                                                        borderRadius: '0.5rem',
                                                        border: '1px solid',
                                                        borderColor: currentPage === pageNum ? 'var(--primary)' : 'var(--border)',
                                                        background: currentPage === pageNum ? 'var(--primary-light)' : 'transparent',
                                                        color: currentPage === pageNum ? 'var(--primary)' : 'var(--text-black)',
                                                        fontSize: '0.8125rem',
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    {pageNum}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <Button
                                        variant="outline"
                                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                        disabled={currentPage === totalPages}
                                        style={{ padding: '0.5rem 1rem', height: 'auto', fontSize: '0.8125rem' }}
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        )}
                    </Card>

                    {isAddModalOpen && (
                        <ExpenseModal
                            isOpen={isAddModalOpen}
                            onClose={() => setIsAddModalOpen(false)}
                            mode="add"
                            categories={expenseCategories}
                        />
                    )}

                    {isEditModalOpen && selectedExpense && (
                        <ExpenseModal
                            isOpen={isEditModalOpen}
                            onClose={() => { setIsEditModalOpen(false); setSelectedExpense(null); }}
                            mode="edit"
                            expense={selectedExpense}
                            categories={expenseCategories}
                        />
                    )}
                </>
            )}
        </motion.div>
    );
};

import { AttachmentsInput, Attachment } from '../components/AttachmentsInput';

interface ExpenseModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode: 'add' | 'edit';
    expense?: Expense;
    categories: Array<{ id: string, name: string }>;
}

const ExpenseModal: React.FC<ExpenseModalProps> = ({ isOpen, onClose, mode, expense, categories }) => {
    const dispatch = useDispatch<AppDispatch>();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);

    // Initialize attachments from expense.attachments (new) or expense.imgUrls (legacy)
    const getInitialAttachments = (): Attachment[] => {
        if (expense?.attachments && Array.isArray(expense.attachments)) {
            return expense.attachments;
        }
        return [];
    };

    const [formData, setFormData] = useState({
        title: expense?.title || '',
        amount: expense?.amount?.toString() || '',
        category: expense?.category || '',
        date: expense?.date ? new Date(expense.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        description: expense?.description || '',
    });

    const [attachments, setAttachments] = useState<Attachment[]>(getInitialAttachments());

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const data = {
                ...formData,
                amount: parseFloat(formData.amount),
                attachments: attachments
            };

            if (mode === 'add') {
                await dispatch(createExpense(data)).unwrap();
                showToast('Expense added successfully', 'success');
            } else if (expense) {
                await dispatch(updateExpense({ id: expense.id, data })).unwrap();
                showToast('Expense updated successfully', 'success');
            }
            onClose();
        } catch (error: any) {
            const errorMessage = typeof error === 'string' ? error : (error?.message || 'Failed to save expense');
            showToast(errorMessage, 'error');
        } finally {
            setLoading(false);
        }
    };


    return (
        <Modal isOpen={isOpen} onClose={onClose} title={mode === 'add' ? 'Add New Expense' : 'Edit Expense'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <Input
                        label="Description"
                        required
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="mb-0"
                    />
                    <Input
                        label="Amount"
                        type="number"
                        step="0.01"
                        required
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        className="mb-0"
                    />
                    <Input
                        label="Date"
                        type="date"
                        required
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        className="mb-0"
                    />
                    <Select
                        label="Category"
                        required
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        options={[
                            { value: '', label: 'Select Category' },
                            ...categories.map(cat => ({ value: cat.name, label: cat.name }))
                        ]}
                        className="mb-0"
                    />
                    <div className="input-group" style={{ gridColumn: 'span 2' }}>
                        <label className="input-label">Comments</label>
                        <textarea
                            className="form-control"
                            rows={2}
                            style={{ minHeight: '80px', paddingTop: '0.75rem' }}
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>
                </div>

                {/* Detailed Attachments Section */}
                <AttachmentsInput
                    attachments={attachments}
                    onChange={setAttachments}
                />

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" type="submit" isLoading={loading}>
                        {mode === 'add' ? 'Add Expense' : 'Save Changes'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default ExpenseList;
