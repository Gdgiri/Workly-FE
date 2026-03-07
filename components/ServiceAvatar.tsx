import React from 'react';

interface ServiceAvatarProps {
    name: string;
    imgUrl?: string;
    size?: number;
    shape?: 'circle' | 'rectangle';
}

export const ServiceAvatar: React.FC<ServiceAvatarProps> = ({ name, imgUrl, size = 60, shape = 'circle' }) => {
    // Generate a consistent color based on the service name
    const getColorFromName = (str: string): string => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }

        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
            '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
            '#F8B739', '#52B788', '#E07A5F', '#81B29A'
        ];

        return colors[Math.abs(hash) % colors.length];
    };

    const [imageError, setImageError] = React.useState(false);
    const firstLetter = name.charAt(0).toUpperCase();
    const backgroundColor = getColorFromName(name);
    const borderRadius = shape === 'rectangle' ? '12px' : '50%';

    if (imgUrl && !imageError) {
        return (
            <div
                style={{
                    width: `${size}px`,
                    height: `${size}px`,
                    borderRadius: borderRadius,
                    overflow: 'hidden',
                    flexShrink: 0,
                    border: '2px solid #E2E8F0',
                    background: '#F8FAFC'
                }}
            >
                <img
                    src={imgUrl}
                    alt={name}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                    }}
                    onError={() => setImageError(true)}
                />
            </div>
        );
    }

    // Fallback: First letter avatar
    return (
        <div
            style={{
                width: `${size}px`,
                height: `${size}px`,
                borderRadius: borderRadius,
                background: backgroundColor,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: `${size * 0.4}px`,
                fontWeight: 'bold',
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
        >
            {firstLetter}
        </div>
    );
};
