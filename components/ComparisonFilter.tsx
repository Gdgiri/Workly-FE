import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, ChevronDown, Check } from 'lucide-react';

export type ComparisonType = 'previousDay' | 'previousWeek' | 'previousMonth' | 'previousYear' | 'custom';

interface ComparisonFilterProps {
    currentComparison: ComparisonType;
    onComparisonChange: (comparison: ComparisonType) => void;
    customCompareRange?: { start: string; end: string };
    onCustomCompareChange: (start: string, end: string) => void;
}

export const ComparisonFilter: React.FC<ComparisonFilterProps> = ({
    currentComparison,
    onComparisonChange,
    customCompareRange,
    onCustomCompareChange
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const options: { value: ComparisonType; label: string }[] = [
        { value: 'previousDay', label: 'Previous Day' },
        { value: 'previousWeek', label: 'Previous Week' },
        { value: 'previousMonth', label: 'Previous Month' },
        { value: 'previousYear', label: 'Previous Year' },
        { value: 'custom', label: 'Custom Dates' },
    ];

    const handleSelect = (value: ComparisonType) => {
        onComparisonChange(value);
        if (value !== 'custom') {
            setIsOpen(false);
        }
    };

    const getLabel = () => options.find(o => o.value === currentComparison)?.label || 'Compare With';

    return (
        <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    background: 'white',
                    border: '1px solid var(--border)',
                    borderRadius: '1rem',
                    padding: '0.75rem 1.25rem',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    color: 'var(--text-dark)',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                    transition: 'all 0.2s'
                }}
                className="hover:bg-slate-50"
            >
                <TrendingUp size={18} className="text-slate-400" />
                <span>{getLabel()}</span>
                <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 'auto',
                            marginTop: '0.5rem',
                            width: '280px',
                            background: 'white',
                            borderRadius: '1.5rem',
                            boxShadow: '0 10px 40px -10px rgba(0,0,0,0.15)',
                            border: '1px solid #E2E8F0',
                            overflow: 'hidden',
                            padding: '0.5rem',
                            zIndex: 9999
                        }}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            {options.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => handleSelect(option.value)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '0.75rem 1rem',
                                        borderRadius: '1rem',
                                        background: currentComparison === option.value ? 'var(--primary-light)' : 'transparent',
                                        color: currentComparison === option.value ? 'var(--primary)' : 'var(--text-dark)',
                                        border: 'none',
                                        fontSize: '0.9rem',
                                        fontWeight: currentComparison === option.value ? 700 : 500,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        textAlign: 'left'
                                    }}
                                    className={currentComparison !== option.value ? 'hover:bg-slate-50' : ''}
                                >
                                    {option.label}
                                    {currentComparison === option.value && <Check size={16} />}
                                </button>
                            ))}
                        </div>

                        {currentComparison === 'custom' && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                style={{
                                    borderTop: '1px solid var(--border)',
                                    marginTop: '0.5rem',
                                    paddingTop: '1rem',
                                    paddingLeft: '0.5rem',
                                    paddingRight: '0.5rem',
                                    paddingBottom: '0.5rem'
                                }}
                            >
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    <div>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-gray)', marginBottom: '0.25rem', display: 'block' }}>Compare From</label>
                                        <input
                                            type="date"
                                            value={customCompareRange?.start || ''}
                                            onChange={(e) => onCustomCompareChange(e.target.value, customCompareRange?.end || '')}
                                            style={{
                                                width: '100%',
                                                padding: '0.5rem',
                                                borderRadius: '0.75rem',
                                                border: '1px solid var(--border)',
                                                fontSize: '0.9rem',
                                                color: 'var(--text-dark)'
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-gray)', marginBottom: '0.25rem', display: 'block' }}>Compare To</label>
                                        <input
                                            type="date"
                                            value={customCompareRange?.end || ''}
                                            onChange={(e) => onCustomCompareChange(customCompareRange?.start || '', e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '0.5rem',
                                                borderRadius: '0.75rem',
                                                border: '1px solid var(--border)',
                                                fontSize: '0.9rem',
                                                color: 'var(--text-dark)'
                                            }}
                                        />
                                    </div>
                                    <button
                                        onClick={() => setIsOpen(false)}
                                        style={{
                                            width: '100%',
                                            background: 'var(--primary)',
                                            color: 'white',
                                            border: 'none',
                                            padding: '0.75rem',
                                            borderRadius: '0.75rem',
                                            fontWeight: 600,
                                            marginTop: '0.5rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Apply Comparison
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
