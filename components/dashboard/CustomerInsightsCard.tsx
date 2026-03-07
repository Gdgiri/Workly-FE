import React from 'react';
import { Card } from '../UI';
import { Users, TrendingUp, UserPlus, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { useCurrency } from '../CurrencyContext';

interface CustomerInsightsCardProps {
    topCustomersBySpend: any[];
    uniqueCustomers: number;
}

export const CustomerInsightsCard: React.FC<CustomerInsightsCardProps> = ({ topCustomersBySpend, uniqueCustomers }) => {
    const { formatPrice } = useCurrency();

    const topSpender = topCustomersBySpend[0];

    // 3. Estimate new customers (simple heuristic: first time seen in these datasets)
    // In a real app, this would come from a 'createdAt' field on the customer record
    // Here we'll just show the unique count as a proxy for "Active Customers"

    return (
        <Card title="Customer Insights" className="h-full">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                {/* Active Customers */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '1rem',
                    borderRadius: 'var(--radius-2xl)',
                    background: 'rgba(56, 189, 248, 0.05)',
                    border: '1px solid rgba(56, 189, 248, 0.1)'
                }}>
                    <div style={{
                        width: '3rem',
                        height: '3rem',
                        borderRadius: 'var(--radius-xl)',
                        background: 'var(--info)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        boxShadow: 'var(--shadow-md)'
                    }}>
                        <Users size={24} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.625rem', fontWeight: 800, color: 'rgba(56, 189, 248, 0.6)', uppercase: true, letterSpacing: '0.1em', margin: 0 }}>ACTIVE CUSTOMERS</p>
                        <h4 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--info)', margin: 0 }}>{uniqueCustomers}</h4>
                    </div>
                </div>

                {/* Top Spender */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '1rem',
                    borderRadius: 'var(--radius-2xl)',
                    background: 'rgba(16, 185, 129, 0.05)',
                    border: '1px solid rgba(16, 185, 129, 0.1)'
                }}>
                    <div style={{
                        width: '3rem',
                        height: '3rem',
                        borderRadius: 'var(--radius-xl)',
                        background: 'var(--success)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        boxShadow: 'var(--shadow-md)'
                    }}>
                        <Star size={24} />
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                        <p style={{ fontSize: '0.625rem', fontWeight: 800, color: 'rgba(16, 185, 129, 0.6)', uppercase: true, letterSpacing: '0.1em', margin: 0 }}>TOP SPENDER</p>
                        <h4 style={{ fontSize: '1.125rem', fontWeight: 900, color: 'var(--success)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {topSpender ? topSpender.name : 'N/A'}
                        </h4>
                        {topSpender && (
                            <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--success)', margin: 0 }}>
                                {formatPrice(topSpender.value)} spent
                            </p>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0 0.5rem', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
                    <TrendingUp size={14} style={{ color: 'var(--success)' }} />
                    <span style={{ fontSize: '0.625rem', fontWeight: 900, color: 'var(--text-light)' }}>Customer engagement up 8% this period</span>
                </div>
            </div>
        </Card>
    );
};
