import React, { createContext, useContext, useState, useCallback } from 'react';
import { ToastContainer } from './Toast';

interface Toast {
    id: number;
    message: string;
    type?: 'error' | 'success' | 'info' | 'warning';
}

interface ToastContextType {
    showToast: (message: string, type?: 'error' | 'success' | 'info' | 'warning') => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: 'error' | 'success' | 'info' | 'warning' = 'info') => {
        const id = Number(`${Date.now()}${Math.floor(Math.random() * 1000)}`);
        setToasts((prev) => [...prev, { id, message, type }]);
    }, []);

    const removeToast = useCallback((id: number) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
    );
};

export const useToast = (): ToastContextType => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};
