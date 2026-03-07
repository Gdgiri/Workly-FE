import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, CheckCircle, Info } from 'lucide-react';

interface ToastProps {
    message: string;
    type?: 'error' | 'success' | 'info' | 'warning';
    onClose: () => void;
    duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ message, type = 'error', onClose, duration = 5000 }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, duration);

        return () => clearTimeout(timer);
    }, [duration, onClose]);

    const icons = {
        error: <AlertCircle size={20} />,
        success: <CheckCircle size={20} />,
        info: <Info size={20} />,
        warning: <AlertCircle size={20} />,
    };

    const colors = {
        error: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b', shadow: 'rgba(239, 68, 68, 0.15)' },
        success: { bg: '#f0fdf4', border: '#22c55e', text: '#166534', shadow: 'rgba(34, 197, 94, 0.15)' },
        info: { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af', shadow: 'rgba(59, 130, 246, 0.15)' },
        warning: { bg: '#fffbeb', border: '#f59e0b', text: '#92400e', shadow: 'rgba(245, 158, 11, 0.15)' },
    };

    const color = colors[type];

    return (
        <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, x: 20 }}
            whileHover={{ scale: 1.02 }}
            style={{
                background: color.bg,
                border: `1px solid ${color.border}`,
                borderRadius: '1rem',
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                minWidth: '320px',
                maxWidth: '450px',
                boxShadow: `0 12px 30px ${color.shadow}, 0 4px 6px rgba(0,0,0,0.02)`,
                pointerEvents: 'auto',
                marginBottom: '0.75rem',
                backdropFilter: 'blur(8px)',
                position: 'relative',
                zIndex: 10
            }}
        >
            <div style={{ color: color.border, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {icons[type]}
            </div>
            <p style={{ color: color.text, fontSize: '0.875rem', margin: 0, flex: 1, fontWeight: 600, lineHeight: 1.4 }}>
                {message}
            </p>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                }}
                style={{
                    background: 'rgba(0,0,0,0.03)',
                    border: 'none',
                    color: color.text,
                    cursor: 'pointer',
                    padding: '0.4rem',
                    borderRadius: '0.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                }}
                className="hover:bg-black/5"
            >
                <X size={16} strokeWidth={2.5} />
            </button>
        </motion.div>
    );
};

interface ToastContainerProps {
    toasts: Array<{ id: number; message: string; type?: 'error' | 'success' | 'info' | 'warning' }>;
    onRemove: (id: number) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
    return (
        <div style={{
            position: 'fixed',
            top: '1.5rem',
            right: '1.5rem',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            pointerEvents: 'none' // Allow clicks to pass through empty space in container
        }}>
            <AnimatePresence initial={false}>
                {toasts.map((toast) => (
                    <div key={toast.id} style={{ pointerEvents: 'auto' }}>
                        <Toast
                            message={toast.message}
                            type={toast.type}
                            onClose={() => onRemove(toast.id)}
                        />
                    </div>
                ))}
            </AnimatePresence>
        </div>
    );
};
