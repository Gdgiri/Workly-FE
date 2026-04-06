import React, { useState, useEffect } from 'react';
import { Card } from '../UI';
import { Users, DollarSign, TrendingUp, User, Calendar, Target, Award, ChevronRight, Activity } from 'lucide-react';
import api from '../../utils/api';
import { useCurrency } from '../CurrencyContext';
import { motion, AnimatePresence } from 'framer-motion';

interface SpecialistStatsCardProps {
    loading?: boolean;
}

export const SpecialistStatsCard: React.FC<SpecialistStatsCardProps> = () => {
    const { formatPrice } = useCurrency();
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [specialists, setSpecialists] = useState<any[]>([]);
    const [selectedSpecialistId, setSelectedSpecialistId] = useState<string>('');
    const [dateRange, setDateRange] = useState({
        from: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        to: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        const fetchStylists = async () => {
            try {
                const res = await api.get('/stylists');
                setSpecialists(Array.isArray(res.data) ? res.data : (res.data?.stylists || []));
            } catch (err) {
                console.error("Error fetching stylists:", err);
            }
        };
        fetchStylists();
    }, []);

    const fetchStats = async () => {
        try {
            setLoading(true);
            // Ensure dates cover the full day boundaries
            const fromDate = `${dateRange.from}T00:00:00.000Z`;
            const toDate = `${dateRange.to}T23:59:59.999Z`;
            
            let url = `/sales/specialist-stats?from=${fromDate}&to=${toDate}`;
            if (selectedSpecialistId) {
                url += `&specialistId=${selectedSpecialistId}`;
            }
            const res = await api.get(url);
            setStats(res.data);
        } catch (err) {
            console.error("Error fetching specialist stats:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, [dateRange, selectedSpecialistId]);

    const getAvatarColor = (name: string) => {
        const colors = [
            'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
            'linear-gradient(135deg, #3b82f6 0%, #2dd4bf 100%)',
            'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
            'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
            'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
        ];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    };

    return (
        <Card title="Specialist Analytics" className="h-full" contentStyle={{ padding: '0.5rem' }}>
            <div className="space-y-6">
                {/* Modern Filter Bar */}
                <div style={{
                    background: 'var(--bg-body)',
                    padding: '1rem',
                    borderRadius: 'var(--radius-xl)',
                    border: '1px solid var(--border-light)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem'
                }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <div style={{
                            width: '2.5rem',
                            height: '2.5rem',
                            background: 'white',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: 'var(--shadow-sm)',
                            color: 'var(--primary)'
                        }}>
                            <Target size={20} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Performance Target</p>
                            <select
                                value={selectedSpecialistId}
                                onChange={(e) => setSelectedSpecialistId(e.target.value)}
                                style={{
                                    width: '100%',
                                    background: 'transparent',
                                    border: 'none',
                                    fontSize: '1rem',
                                    fontWeight: 800,
                                    color: 'var(--text-dark)',
                                    outline: 'none',
                                    padding: '0.125rem 0',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="">Entire Team</option>
                                {specialists.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '1rem',
                        paddingTop: '0.75rem',
                        borderTop: '1px dashed var(--border)'
                    }}>
                        <div>
                            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-light)', textTransform: 'uppercase' }}>Period Start</p>
                            <div style={{ position: 'relative' }}>
                                <Calendar size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                                <input
                                    type="date"
                                    value={dateRange.from}
                                    onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '0.5rem 0.5rem 0.5rem 2.25rem',
                                        fontSize: '0.85rem',
                                        fontWeight: 700,
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--border)',
                                        background: 'white',
                                        color: 'var(--text-dark)',
                                        outline: 'none'
                                    }}
                                />
                            </div>
                        </div>
                        <div>
                            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-light)', textTransform: 'uppercase' }}>Period End</p>
                            <div style={{ position: 'relative' }}>
                                <Calendar size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                                <input
                                    type="date"
                                    value={dateRange.to}
                                    onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '0.5rem 0.5rem 0.5rem 2.25rem',
                                        fontSize: '0.85rem',
                                        fontWeight: 700,
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--border)',
                                        background: 'white',
                                        color: 'var(--text-dark)',
                                        outline: 'none'
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div style={{ padding: '4rem 0', textAlign: 'center' }}>
                        <div className="animate-spin" style={{ display: 'inline-block', color: 'var(--primary)', marginBottom: '1rem' }}>
                            <Award size={32} />
                        </div>
                        <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-light)' }}>Analyzing Performance Metrics...</p>
                    </div>
                ) : stats ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {/* Summary Metrics */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            {(() => {
                                const displayStats = selectedSpecialistId 
                                    ? (stats.specialists?.find((s: any) => String(s.specialistId) === String(selectedSpecialistId)) || { totalRevenue: 0, totalServicesAttended: 0 })
                                    : {
                                        totalRevenue: stats.specialists?.reduce((sum: number, s: any) => sum + (s.totalRevenue || 0), 0) || 0,
                                        totalServicesAttended: stats.specialists?.reduce((sum: number, s: any) => sum + (s.totalServicesAttended || 0), 0) || 0
                                      };

                                return (
                                    <>
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            style={{
                                                background: 'linear-gradient(135deg, #234C6A 0%, #3B82F6 100%)',
                                                borderRadius: 'var(--radius-2xl)',
                                                padding: '1.25rem',
                                                color: 'white',
                                                position: 'relative',
                                                overflow: 'hidden',
                                                boxShadow: '0 8px 20px -8px rgba(35, 76, 106, 0.4)'
                                            }}
                                        >
                                            <DollarSign size={48} style={{ position: 'absolute', right: '-12px', top: '-12px', opacity: 0.1, transform: 'rotate(15deg)' }} />
                                            <p style={{ margin: 0, fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.8 }}>Total Sales</p>
                                            <h3 style={{ margin: '0.25rem 0', fontSize: '1.5rem', fontWeight: 900 }}>
                                                {formatPrice(displayStats.totalRevenue)}
                                            </h3>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '0.5rem' }}>
                                                <div style={{ width: '6px', height: '6px', background: '#4ADE80', borderRadius: '50%' }}></div>
                                                <span style={{ fontSize: '0.6rem', fontWeight: 800, opacity: 0.9 }}>LIVE UPDATES</span>
                                            </div>
                                        </motion.div>

                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: 0.1 }}
                                            style={{
                                                background: 'white',
                                                borderRadius: 'var(--radius-2xl)',
                                                padding: '1.25rem',
                                                border: '1.5px solid var(--border-light)',
                                                position: 'relative',
                                                overflow: 'hidden',
                                                boxShadow: 'var(--shadow-sm)'
                                            }}
                                        >
                                            <Users size={48} style={{ position: 'absolute', right: '-12px', top: '-12px', opacity: 0.05, transform: 'rotate(-15deg)', color: 'var(--primary)' }} />
                                            <p style={{ margin: 0, fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-light)' }}>Services Conducted</p>
                                            <h3 style={{ margin: '0.25rem 0', fontSize: '1.5rem', fontWeight: 900, color: 'var(--primary)' }}>
                                                {displayStats.totalServicesAttended}
                                            </h3>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '0.5rem' }}>
                                                <TrendingUp size={12} style={{ color: 'var(--success)' }} />
                                                <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-light)' }}>STABLE GROWTH</span>
                                            </div>
                                        </motion.div>
                                    </>
                                );
                            })()}
                        </div>

                        {/* Analysis List */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', padding: '0 0.25rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Activity size={16} style={{ color: 'var(--primary)' }} />
                                    <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-dark)', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Performance Breakdown</h4>
                                </div>
                                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-light)' }}>BY VOLUME</span>
                            </div>

                            <div className="custom-scrollbar" style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {selectedSpecialistId ? (
                                        (() => {
                                            const currentStats = stats.specialists?.find((s: any) => String(s.specialistId) === String(selectedSpecialistId));
                                            return currentStats?.breakdown?.map((item: any, idx: number) => {
                                                const totalRevenue = currentStats.totalRevenue || 1;
                                                const percentage = (item.revenue / totalRevenue) * 100;
                                                return (
                                                    <motion.div
                                                        key={idx}
                                                        initial={{ opacity: 0, x: 20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: idx * 0.05 }}
                                                        style={{
                                                            background: 'white',
                                                            border: '1px solid var(--border-light)',
                                                            borderRadius: 'var(--radius-xl)',
                                                            padding: '1rem',
                                                            position: 'relative',
                                                            overflow: 'hidden'
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', position: 'relative', zIndex: 1 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                                <div style={{
                                                                    width: '2.5rem',
                                                                    height: '2.5rem',
                                                                    borderRadius: 'var(--radius-lg)',
                                                                    background: 'var(--bg-body)',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    color: 'var(--primary)',
                                                                    fontWeight: 900,
                                                                    fontSize: '0.75rem',
                                                                    border: '1px solid var(--border)'
                                                                }}>
                                                                    {item.count}x
                                                                </div>
                                                                <div>
                                                                    <span style={{ display: 'block', fontWeight: 800, fontSize: '0.875rem', color: 'var(--text-dark)' }}>{item.serviceName}</span>
                                                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>{Math.round(percentage)}% Contribution</span>
                                                                </div>
                                                            </div>
                                                            <div style={{ textAlign: 'right' }}>
                                                                <div style={{ fontWeight: 900, fontSize: '1rem', color: 'var(--primary)' }}>{formatPrice(item.revenue)}</div>
                                                            </div>
                                                        </div>
                                                        <div style={{ height: '4px', width: '100%', background: 'var(--bg-body)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                                                            <div style={{ height: '100%', width: `${percentage}%`, background: 'var(--grad-primary)', borderRadius: 'var(--radius-full)' }}></div>
                                                        </div>
                                                    </motion.div>
                                                );
                                            });
                                        })()
                                    ) : (
                                        stats.specialists?.map((s: any, idx: number) => (
                                            <motion.div
                                                key={s.specialistId}
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: idx * 0.05 }}
                                                style={{
                                                    background: 'white',
                                                    border: '1.5px solid var(--border-light)',
                                                    borderRadius: 'var(--radius-xl)',
                                                    padding: '1rem'
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                        <div style={{
                                                            width: '3.5rem',
                                                            height: '3.5rem',
                                                            borderRadius: '50%',
                                                            background: getAvatarColor(s.specialistName),
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            color: 'white',
                                                            fontWeight: 900,
                                                            fontSize: '1.5rem',
                                                            boxShadow: 'var(--shadow-md)',
                                                            border: '3px solid white'
                                                        }}>
                                                            {s.specialistName.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <span style={{ display: 'block', fontWeight: 800, fontSize: '1rem', color: 'var(--text-dark)' }}>{s.specialistName}</span>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'white', background: 'var(--primary)', padding: '0.125rem 0.5rem', borderRadius: '2rem' }}>
                                                                    {s.totalServicesAttended} SERVICES
                                                                </span>
                                                                <ChevronRight size={14} style={{ color: 'var(--text-light)' }} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <p style={{ margin: 0, fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Contribution</p>
                                                        <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: 'var(--primary)' }}>{formatPrice(s.totalRevenue)}</p>
                                                    </div>
                                                </div>

                                                <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }} className="scrollbar-hide">
                                                    {(s.breakdown || []).slice(0, 3).map((item: any, i: number) => (
                                                        <div key={i} style={{
                                                            flex: '0 0 auto',
                                                            background: 'var(--bg-body)',
                                                            padding: '0.5rem 0.75rem',
                                                            borderRadius: 'var(--radius-lg)',
                                                            border: '1px solid var(--border)',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: '0.125rem'
                                                        }}>
                                                            <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>{item.serviceName}</span>
                                                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)' }}>{item.count}x</span>
                                                        </div>
                                                    ))}
                                                    {s.breakdown?.length > 3 && (
                                                        <div style={{ flex: '0 0 auto', background: 'var(--primary-light)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--primary)' }}>+{s.breakdown.length - 3}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div style={{ padding: '4rem 0', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 'var(--radius-xl)' }}>
                        <div style={{ color: 'var(--text-light)', marginBottom: '0.75rem' }}>
                            <Target size={40} style={{ margin: '0 auto', opacity: 0.3 }} />
                        </div>
                        <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-light)' }}>No performance data found for this selection.</p>
                        <button
                            onClick={() => {
                                setDateRange({
                                    from: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
                                    to: new Date().toISOString().split('T')[0]
                                });
                                setSelectedSpecialistId('');
                            }}
                            style={{
                                marginTop: '1rem',
                                padding: '0.5rem 1rem',
                                borderRadius: '2rem',
                                border: '1.5px solid var(--primary)',
                                color: 'var(--primary)',
                                background: 'transparent',
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                cursor: 'pointer'
                            }}
                        >
                            Reset Filters
                        </button>
                    </div>
                )}
            </div>
        </Card>
    );
};
