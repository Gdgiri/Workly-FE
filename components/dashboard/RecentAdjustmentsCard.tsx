import React, { useState } from 'react';
import { Card } from '../UI';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCurrency } from '../CurrencyContext';

interface Adjustment {
    id: string;
    type: string;
    customerName: string;
    itemName: string;
    oldVal: number;
    newVal: number;
    delta: number;
    adjustedBy: string;
    reason: string;
    date: string;
}

interface RecentAdjustmentsCardProps {
    adjustments: Adjustment[];
    loading?: boolean;
}

export const RecentAdjustmentsCard: React.FC<RecentAdjustmentsCardProps> = ({ adjustments, loading }) => {
    const { symbol } = useCurrency();
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

    const totalPages = Math.ceil(adjustments.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedAdjustments = adjustments.slice(startIndex, startIndex + itemsPerPage);

    const handlePrev = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
        }
    };

    const handleNext = () => {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
        }
    };

    return (
        <Card title={`Recent Manual Adjustments ${adjustments.length > 0 ? `(${adjustments.length})` : ''}`} className="h-full">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {loading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {[1, 2, 3].map(i => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: 'var(--radius-xl)', background: 'var(--bg-hover)', animation: 'pulse 2s infinite' }}>
                                    <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', background: 'var(--border-light)' }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ height: '1rem', width: '8rem', background: 'var(--border-light)', borderRadius: '4px', marginBottom: '0.5rem' }} />
                                        <div style={{ height: '0.75rem', width: '5rem', background: 'var(--border-light)', borderRadius: '4px' }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : adjustments.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                            <div style={{
                                width: '4rem',
                                height: '4rem',
                                background: 'var(--bg-hover)',
                                borderRadius: 'var(--radius-2xl)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 1rem auto'
                            }}>
                                <ShieldCheck style={{ color: 'var(--text-light)' }} size={32} />
                            </div>
                            <p style={{ fontWeight: 600, color: 'var(--text-black)' }}>No recent manual adjustments</p>
                        </div>
                    ) : (
                        <div className="custom-scrollbar" style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem',
                            maxHeight: '405px',
                            overflowY: 'auto',
                            paddingRight: '12px'
                        }}>
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={currentPage}
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    transition={{ duration: 0.15 }}
                                    style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
                                >
                                    {paginatedAdjustments.map((adj, index) => {
                                        const isVoucher = adj.type === 'Voucher Balance';
                                        return (
                                            <div
                                                key={adj.id}
                                                style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '0.35rem',
                                                    padding: '0.75rem',
                                                    borderRadius: 'var(--radius-xl)',
                                                    border: '1px solid #fef08a',
                                                    background: '#fef9c3', // highlight yellow background matching adjustments
                                                    borderLeft: '4px solid #ca8a04',
                                                    transition: 'all 0.2s ease',
                                                    cursor: 'default'
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <div>
                                                        <div style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-dark)' }}>
                                                            {adj.customerName}
                                                        </div>
                                                        <div style={{ fontSize: '0.65rem', color: '#854d0e', fontWeight: 600, marginTop: '2px' }}>
                                                            {adj.type}: {adj.itemName}
                                                        </div>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ca8a04' }}>
                                                            {isVoucher ? symbol : ''}{adj.oldVal} → {isVoucher ? symbol : ''}{adj.newVal}
                                                        </div>
                                                        <div style={{ fontSize: '0.6rem', color: 'var(--text-light)', marginTop: '2px' }}>
                                                            {new Date(adj.date).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', borderTop: '1px dashed rgba(202, 138, 4, 0.2)', paddingTop: '0.25rem', marginTop: '0.15rem' }}>
                                                    <span style={{ fontSize: '0.65rem', fontStyle: 'italic', color: '#475569', wordBreak: 'break-word', flex: 1 }}>
                                                        "{adj.reason}"
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '0.6rem', fontWeight: 700, color: '#ca8a04' }}>
                                                    By {adj.adjustedBy}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    )}
                </div>

                {!loading && adjustments.length > itemsPerPage && (
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingTop: '0.75rem',
                        borderTop: '1px solid var(--border-light)',
                        marginTop: '0.5rem'
                    }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-light)', fontWeight: 600 }}>
                            Showing {startIndex + 1}–{Math.min(startIndex + itemsPerPage, adjustments.length)} of {adjustments.length}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <button
                                onClick={handlePrev}
                                disabled={currentPage === 1}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '4px',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--border-light)',
                                    background: currentPage === 1 ? 'var(--bg-hover)' : 'var(--bg-card)',
                                    color: currentPage === 1 ? 'var(--text-light)' : 'var(--text-dark)',
                                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-dark)', minWidth: '3.5rem', textAlign: 'center' }}>
                                Page {currentPage} of {totalPages}
                            </span>
                            <button
                                onClick={handleNext}
                                disabled={currentPage === totalPages}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '4px',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--border-light)',
                                    background: currentPage === totalPages ? 'var(--bg-hover)' : 'var(--bg-card)',
                                    color: currentPage === totalPages ? 'var(--text-light)' : 'var(--text-dark)',
                                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
};
