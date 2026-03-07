import React from 'react';
import { MdLoop } from 'react-icons/md';

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    fullScreen?: boolean;
    message?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
    size = 'md',
    fullScreen = false,
    message
}) => {
    const sizeMap = {
        sm: 24,
        md: 40,
        lg: 56
    };

    const iconSize = sizeMap[size];

    if (fullScreen) {
        return (
            <div style={{
                position: 'fixed',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255, 255, 255, 0.95)',
                zIndex: 9999
            }}>
                <span style={{ display: 'flex', animation: 'spin 1s linear infinite', color: '#234C6A' }}>
                    <MdLoop size={iconSize} />
                </span>
                {message && (
                    <p style={{
                        marginTop: '1rem',
                        fontSize: '0.875rem',
                        color: '#64748b',
                        fontWeight: 500
                    }}>
                        {message}
                    </p>
                )}
                <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
            </div>
        );
    }

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '3rem',
            minHeight: '400px'
        }}>
            <span style={{ display: 'flex', animation: 'spin 1s linear infinite', color: '#234C6A' }}>
                <MdLoop size={iconSize} />
            </span>
            {message && (
                <p style={{
                    marginTop: '1rem',
                    fontSize: '0.875rem',
                    color: '#64748b',
                    fontWeight: 500
                }}>
                    {message}
                </p>
            )}
            <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
        </div>
    );
};
