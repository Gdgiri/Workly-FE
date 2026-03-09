import React, { useMemo } from 'react';
import { Card } from '../UI';
import { Skeleton } from '../Skeleton';
import { User, Receipt } from 'lucide-react';
import { motion } from 'framer-motion';
import { useCurrency } from '../CurrencyContext';

interface CashierSummaryCardProps {
    sales: any[];
    loading?: boolean;
}

export const CashierSummaryCard: React.FC<CashierSummaryCardProps> = ({ sales, loading }) => {
    const { formatPrice } = useCurrency();

    // Group sales by CASHIER
    const summary = useMemo(() => {
        const cashiers: Record<string, number> = {};
        let total = 0;

        sales.forEach(sale => {
            // Try to find cashier name from various possible fields
            const cashierName = sale.cashierName || sale.createdBy?.name || 'Admin';
            // Support both 'amount' (Payment) and 'paidAmount' (Sale)
            const amount = sale.amount !== undefined ? sale.amount : (sale.paidAmount || 0);

            cashiers[cashierName] = (cashiers[cashierName] || 0) + amount;
            total += amount;
        });

        // Convert to array and sort by value desc
        return Object.entries(cashiers)
            .map(([name, amount]) => ({ name, amount }))
            .sort((a, b) => b.amount - a.amount);
    }, [sales]);

    return (
        <Card title="Cashier Summary" className="h-full">
            <div className="space-y-4">
                {loading ? (
                    [1, 2, 3].map(i => (
                        <div key={i} className="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                            <Skeleton width="100px" height="1rem" />
                            <Skeleton width="60px" height="1rem" />
                        </div>
                    ))
                ) : summary.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                        <div style={{
                            width: '3rem',
                            height: '3rem',
                            background: 'var(--bg-hover)',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 0.75rem auto'
                        }}>
                            <Receipt className="text-slate-300" size={24} />
                        </div>
                        <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-gray)' }}>No transactions yet</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {summary.map((item, index) => (
                            <motion.div
                                key={item.name}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="flex justify-between items-center p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg text-indigo-600 bg-indigo-100`}>
                                        <User size={18} />
                                    </div>
                                    <span className="font-semibold text-sm text-slate-700 dark:text-slate-200 capitalize">
                                        {item.name}
                                    </span>
                                </div>
                                <span className="font-bold text-slate-900 dark:text-white">
                                    {formatPrice(item.amount)}
                                </span>
                            </motion.div>
                        ))}

                        <div className="pt-3 mt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center px-2">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Collected</span>
                            <span className="text-lg font-black text-slate-900 dark:text-white">
                                {formatPrice(sales.reduce((sum, s) => sum + (s.amount !== undefined ? s.amount : (s.paidAmount || 0)), 0))}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
};
