import React from 'react';
import { Card } from '../UI';
import { motion } from 'framer-motion';
import { Star, Award, TrendingUp } from 'lucide-react';

interface StylistData {
    name: string;
    value: number; // Appointment count
}

interface TopStylistsProps {
    data: StylistData[];
    title?: string;
}

// Reuse the vibrant gradient logic
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

export const TopStylists: React.FC<TopStylistsProps> = ({ data, title = "Top Performing Specialists" }) => {
    const maxValue = Math.max(...data.map(d => d.value), 1);
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

    return (
        <Card title={title} className="h-full">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {data.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-gray)', padding: '3rem 1rem' }}>
                        <div style={{
                            width: '4rem',
                            height: '4rem',
                            background: 'var(--bg-hover)',
                            borderRadius: 'var(--radius-2xl)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 0.75rem auto'
                        }}>
                            <Star style={{ color: 'var(--text-light)' }} size={32} />
                        </div>
                        <p style={{ fontWeight: 600, color: 'var(--text-light)' }}>No performance data yet</p>
                    </div>
                ) : (
                    data.map((stylist, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    {/* Rank & Avatar */}
                                    <div style={{ position: 'relative' }}>
                                        <div
                                            style={{
                                                width: '3rem',
                                                height: '3rem',
                                                borderRadius: 'var(--radius-lg)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'white',
                                                fontWeight: 900,
                                                fontSize: '1.25rem',
                                                boxShadow: 'var(--shadow-md)',
                                                background: getAvatarColor(stylist.name)
                                            }}
                                        >
                                            {stylist.name.charAt(0).toUpperCase()}
                                        </div>
                                        {index < 3 && (
                                            <div style={{
                                                position: 'absolute',
                                                top: '-6px',
                                                right: '-6px',
                                                width: '1.25rem',
                                                height: '1.25rem',
                                                background: 'white',
                                                borderRadius: '50%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                boxShadow: 'var(--shadow-sm)'
                                            }}>
                                                <Award size={12} style={{ color: index === 0 ? '#f59e0b' : index === 1 ? '#94a3b8' : '#d97706' }} />
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <span style={{ display: 'block', fontWeight: 800, fontSize: '0.875rem', color: 'var(--text-dark)', marginBottom: '0.125rem' }}>
                                            {stylist.name}
                                        </span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <div style={{ display: 'flex' }}>
                                                {[1, 2, 3, 4, 5].map(s => <Star key={s} size={10} style={{ color: '#f59e0b', fill: '#f59e0b' }} />)}
                                            </div>
                                            <span style={{ fontSize: '0.6rem', fontWeight: 900, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Top Tier</span>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: 900, fontSize: '1.125rem', color: 'var(--text-dark)', lineHeight: 1 }}>
                                        {stylist.value}
                                    </div>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>Appts</span>
                                </div>
                            </div>

                            {/* Progress Bar Redesign */}
                            <div style={{ position: 'relative', height: '4px', width: '100%', background: 'var(--border-light)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(stylist.value / maxValue) * 100}%` }}
                                    transition={{ duration: 1.2, ease: "easeOut", delay: index * 0.1 }}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        height: '100%',
                                        borderRadius: 'var(--radius-full)',
                                        background: `linear-gradient(90deg, ${colors[index % colors.length]}, ${colors[index % colors.length]}dd)`,
                                        boxShadow: `0 0 8px ${colors[index % colors.length]}33`
                                    }}
                                />
                            </div>
                        </motion.div>
                    ))
                )}

                {/* {data.length > 0 && (
                    <div style={{ marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-light)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', gap: '6px', color: 'var(--text-light)', justifyContent: 'center' }}>
                            <TrendingUp size={14} />
                            <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>UP 12% THIS WEEK</span>
                        </div>
                    </div>
                )} */}
            </div>
        </Card>
    );
};
