import React from 'react';
import { Card } from '../UI';
import { Package, AlertCircle, ArrowRight, Zap, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

interface InventoryAlertsCardProps {
    lowStockAlerts: any[];
    loading?: boolean;
}

export const InventoryAlertsCard: React.FC<InventoryAlertsCardProps> = ({ lowStockAlerts, loading }) => {
    const navigate = useNavigate();
    const { user } = useAuth();

    const displayProducts = lowStockAlerts.slice(0, 5);

    const handleManageInventory = () => {
        const appId = user?.app_id || 'salon';
        const businessName = user?.businessName || 'admin';
        navigate(`/${appId}/${businessName}/inventory`);
    };

    return (
        <Card
            title="Inventory Intelligence"
            className="h-full"
            action={
                <button
                    onClick={handleManageInventory}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-lg)',
                        background: 'var(--bg-hover)',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        color: 'var(--text-gray)',
                        border: '1px solid var(--border-light)',
                        cursor: 'pointer',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        transition: 'all 0.2s ease'
                    }}
                >
                    Manage <ArrowRight size={12} />
                </button>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {[1, 2, 3].map(i => (
                            <div key={i} style={{ height: '4rem', background: 'var(--bg-hover)', borderRadius: 'var(--radius-xl)', animation: 'pulse 2s infinite' }} />
                        ))}
                    </div>
                ) : displayProducts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
                        <div style={{
                            width: '5rem',
                            height: '5rem',
                            background: 'rgba(16, 185, 129, 0.1)',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 1rem auto',
                            border: '4px solid rgba(16, 185, 129, 0.05)'
                        }}>
                            <Zap style={{ color: 'var(--success)' }} size={32} />
                        </div>
                        <h4 style={{ fontWeight: 800, color: 'var(--text-dark)', fontSize: '1.125rem', marginBottom: '0.25rem' }}>Stock Optimized</h4>
                        <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-light)' }}>All levels are healthy.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <AnimatePresence>
                            {displayProducts.map((product, index) => {
                                const isCritical = product.stock <= 2;
                                return (
                                    <motion.div
                                        key={product.id || index}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: index * 0.05 }}
                                        style={{
                                            position: 'relative',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '0.875rem',
                                            borderRadius: 'var(--radius-xl)',
                                            border: `1px solid ${isCritical ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)'}`,
                                            background: isCritical ? 'rgba(239, 68, 68, 0.03)' : 'rgba(245, 158, 11, 0.03)',
                                            overflow: 'hidden'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', zIndex: 1 }}>
                                            <div style={{ position: 'relative' }}>
                                                <div style={{
                                                    width: '2.75rem',
                                                    height: '2.75rem',
                                                    borderRadius: 'var(--radius-lg)',
                                                    background: isCritical ? 'var(--danger)' : 'var(--warning)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                                    color: 'white'
                                                }}>
                                                    {isCritical ? <ShieldAlert size={20} /> : <AlertCircle size={20} />}
                                                </div>
                                                {isCritical && (
                                                    <div style={{
                                                        position: 'absolute',
                                                        inset: 0,
                                                        borderRadius: 'var(--radius-lg)',
                                                        background: 'var(--danger)',
                                                        animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
                                                        opacity: 0.3
                                                    }} />
                                                )}
                                            </div>

                                            <div>
                                                <div style={{ fontWeight: 800, fontSize: '0.875rem', color: 'var(--text-dark)', textTransform: 'capitalize', marginBottom: '0.125rem' }}>
                                                    {product.name}
                                                </div>
                                                <span style={{
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    fontSize: '0.6rem',
                                                    fontWeight: 900,
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.05em',
                                                    background: isCritical ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                                    color: isCritical ? 'var(--danger)' : 'var(--warning)'
                                                }}>
                                                    {isCritical ? 'CRITICAL' : 'LOW STOCK'}
                                                </span>
                                            </div>
                                        </div>

                                        <div style={{ textAlign: 'right', zIndex: 1 }}>
                                            <div style={{ fontWeight: 900, fontSize: '1rem', color: isCritical ? 'var(--danger)' : 'var(--warning)' }}>
                                                {product.stock}
                                            </div>
                                            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>
                                                Units
                                            </div>
                                        </div>

                                        <Package
                                            size={48}
                                            style={{
                                                position: 'absolute',
                                                bottom: '-8px',
                                                right: '-8px',
                                                opacity: 0.03,
                                                transform: 'rotate(12deg)',
                                                color: 'var(--text-dark)'
                                            }}
                                        />
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>

                        {/* <div style={{
                            marginTop: '1rem',
                            padding: '1rem',
                            borderRadius: 'var(--radius-xl)',
                            background: 'var(--bg-hover)',
                            border: '1px solid var(--border-light)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-light)', textTransform: 'uppercase' }}>Efficiency Status</span>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Zap size={10} /> 94% Operational
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-gray)' }}>+ {lowStockAlerts.length} more</span>
                                </div>
                            </div>
                        </div> */}
                    </div>
                )}
            </div>
        </Card>
    );
};
