
import React from 'react';

interface SkeletonProps {
    className?: string;
    width?: string | number;
    height?: string | number;
    style?: React.CSSProperties;
    variant?: 'text' | 'circular' | 'rectangular';
}

export const Skeleton: React.FC<SkeletonProps> = ({
    className = '',
    width,
    height,
    style,
    variant = 'rectangular'
}) => {
    const baseStyles: React.CSSProperties = {
        backgroundColor: '#e5e7eb', // Base gray
        backgroundImage: 'linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%)', // Shimmer gradient
        backgroundSize: '200% 100%',
        borderRadius: variant === 'circular' ? '50%' : '0.375rem',
        width: width,
        height: height,
        animation: 'shimmer 1.5s infinite linear', // Smooth continuous movement
        ...style
    };

    return (
        <div
            className={`skeleton-loader ${className}`}
            style={baseStyles}
        >
            <style>
                {`
          @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}
            </style>
        </div>
    );
};
