import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

type CurrencyContextType = {
    currency: string;
    symbol: string;
    formatPrice: (amount: number) => string;
    refreshCurrency: () => Promise<void>;
    loading: boolean;
};

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const useCurrency = () => {
    const context = useContext(CurrencyContext);
    if (!context) {
        throw new Error('useCurrency must be used within a CurrencyProvider');
    }
    return context;
};

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currency, setCurrency] = useState(() => localStorage.getItem('preferredCurrency') || 'INR');
    const [loading, setLoading] = useState(true);

    const getSymbol = (curr: string) => {
        switch (curr) {
            case 'INR': return '₹';
            case 'USD': return '$';
            case 'EUR': return '€';
            case 'GBP': return '£';
            case 'SGD': return 'S$';
            case 'AED': return 'د.إ';
            case 'SAR': return 'SR';
            case 'MYR': return 'RM';
            case 'IDR': return 'Rp';
            case 'THB': return '฿';
            case 'JPY':
            case 'CNY': return '¥';
            case 'AUD': return 'A$';
            case 'CAD': return 'C$';
            case 'HKD': return 'HK$';
            case 'NZD': return 'NZD$';
            case 'TWD': return 'TWD';
            default: return curr;
        }
    };

    const formatPrice = (amount: number) => {
        if (amount === undefined || amount === null || isNaN(amount)) return `${getSymbol(currency)} 0.00`;
        const symbol = getSymbol(currency);
        return `${symbol} ${amount.toFixed(2)}`;
    };

    const refreshCurrency = async () => {
        // Only fetch if authenticated
        const token = localStorage.getItem('accessToken');
        if (!token) {
            setLoading(false);
            return;
        }

        try {
            const response = await api.get('/settings');
            console.log('Currency Context Fetch:', response.data); // DEBUG LOG
            if (response.data && response.data.currency) {
                setCurrency(response.data.currency);
                localStorage.setItem('preferredCurrency', response.data.currency);
                console.log('Currency Set To:', response.data.currency); // DEBUG LOG
            }
        } catch (error) {
            console.error('Failed to fetch currency settings:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshCurrency();
    }, []);

    return (
        <CurrencyContext.Provider value={{
            currency,
            symbol: getSymbol(currency),
            formatPrice,
            refreshCurrency,
            loading
        }}>
            {children}
        </CurrencyContext.Provider>
    );
};
