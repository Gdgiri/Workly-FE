import React from 'react';
import { motion } from 'framer-motion';

interface SwitchProps {
  isOn: boolean;
  onToggle: () => void;
  label?: string;
  activeLabel?: string;
  inactiveLabel?: string;
}

export const Switch: React.FC<SwitchProps> = ({ 
  isOn, 
  onToggle, 
  label,
  activeLabel = 'ON',
  inactiveLabel = 'OFF'
}) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      {label && (
        <span style={{ 
          fontSize: '0.875rem', 
          fontWeight: 700, 
          color: 'var(--text-dark)', 
          textTransform: 'uppercase',
          letterSpacing: '-0.02em'
        }}>
          {label}
        </span>
      )}
      <div 
        onClick={onToggle}
        style={{
          position: 'relative',
          width: '12rem',
          height: '2.5rem',
          borderRadius: 'var(--radius-full)',
          cursor: 'pointer',
          padding: '0.25rem',
          transition: 'background-color 0.3s ease',
          backgroundColor: isOn ? 'var(--primary)' : 'var(--border-light)',
          boxShadow: isOn ? 'var(--shadow-md)' : 'inset 0 2px 4px rgba(0,0,0,0.05)',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        {/* Animated Background Label */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 1rem',
          pointerEvents: 'none',
          zIndex: 1
        }}>
          <span style={{ 
            fontSize: '0.625rem', 
            fontWeight: 900, 
            textTransform: 'uppercase', 
            letterSpacing: '0.1em',
            transition: 'opacity 0.2s ease',
            opacity: isOn ? 1 : 0,
            color: 'white'
          }}>
            {activeLabel}
          </span>
          <span style={{ 
            fontSize: '0.625rem', 
            fontWeight: 900, 
            textTransform: 'uppercase', 
            letterSpacing: '0.1em',
            transition: 'opacity 0.2s ease',
            opacity: isOn ? 0 : 1,
            color: 'var(--text-black)'
          }}>
            {inactiveLabel}
          </span>
        </div>

        {/* The Toggle Thumb */}
        <motion.div
          animate={{ x: isOn ? '7.25rem' : '0rem' }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          style={{
            position: 'relative',
            zIndex: 10,
            width: '4.5rem',
            height: '2rem',
            backgroundColor: 'white',
            borderRadius: 'var(--radius-full)',
            boxShadow: 'var(--shadow-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div style={{ 
            width: '0.375rem', 
            height: '0.375rem', 
            borderRadius: '50%', 
            backgroundColor: isOn ? 'var(--primary)' : 'var(--border)' 
          }} />
        </motion.div>
      </div>
    </div>
  );
};
