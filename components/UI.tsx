import React, { useState } from 'react';
import { motion, AnimatePresence, HTMLMotionProps } from 'framer-motion';
import {
  MdClose,
  MdLoop,
  MdVisibility,
  MdVisibilityOff,
  MdExpandMore
} from 'react-icons/md';
import { Skeleton } from './Skeleton';
export { Skeleton };

// --- BUTTON ---
interface ButtonProps extends HTMLMotionProps<"button"> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  isLoading?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children, variant = 'primary', className = '', isLoading, icon, type = "button", ...props
}) => {
  const variantClass = `btn-${variant}`;

  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.98 }}
      className={`btn ${variantClass} ${className}`}
      type={type}
      style={{
        ...props.style,
      }}
      {...props}
      disabled={isLoading || props.disabled}
    >
      {isLoading && <span className="animate-spin" style={{ display: 'flex', marginRight: 8 }}><MdLoop size={16} /></span>}
      {!isLoading && icon && <span style={{ display: 'flex', marginRight: 8 }}>{icon}</span>}
      {children}
    </motion.button>
  );
};

// --- INPUT ---
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, className = '', type, ...props }) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';

  return (
    <div className="input-group">
      {label && <label className="input-label">{label}</label>}
      <div style={{ position: 'relative' }}>
        <input
          className={`form-control ${className}`}
          style={{
            ...(error ? { borderColor: 'var(--danger)' } : {}),
            ...(isPassword ? { paddingRight: '2.5rem' } : {})
          }}
          type={isPassword ? (showPassword ? 'text' : 'password') : type}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute',
              right: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-gray)',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            {showPassword ? <MdVisibilityOff size={16} /> : <MdVisibility size={16} />}
          </button>
        )}
      </div>
      {error && <p style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{error}</p>}
    </div>
  );
};

// --- CHECKBOX ---
interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: React.ReactNode;
  error?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({ label, error, className = '', ...props }) => {
  return (
    <div className={`checkbox-group ${className}`} style={{ marginBottom: '1rem' }}>
      <label style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        cursor: 'pointer',
        userSelect: 'none',
        fontSize: '0.9rem',
        color: 'var(--text-dark)',
        fontWeight: 500
      }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginTop: '0.125rem' }}>
          <input
            type="checkbox"
            style={{
              position: 'absolute',
              opacity: 0,
              cursor: 'pointer',
              height: 0,
              width: 0,
            }}
            {...props}
          />
          <motion.div
            initial={false}
            animate={{
              background: props.checked ? 'var(--primary)' : '#ffffff',
              borderColor: props.checked ? 'var(--primary)' : 'var(--border)',
            }}
            style={{
              width: '1.25rem',
              height: '1.25rem',
              borderRadius: '0.375rem',
              border: '2px solid',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: props.checked ? '0 0 0 4px var(--primary-light)' : 'none'
            }}
          >
            <AnimatePresence>
              {props.checked && (
                <motion.svg
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ width: '0.75rem', height: '0.75rem' }}
                >
                  <polyline points="20 6 9 17 4 12" />
                </motion.svg>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
        <span style={{ lineHeight: 1.4, flex: 1 }}>{label}</span>
      </label>
      {error && <p style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.25rem', marginLeft: '2rem' }}>{error}</p>}
    </div>
  );
};

// --- SELECT ---
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string | number; label: string }[];
  error?: string;
}

export const Select: React.FC<SelectProps> = ({ label, options, error, className = '', ...props }) => (
  <div className="input-group">
    {label && <label className="input-label">{label}</label>}
    <select
      className={`form-control ${className}`}
      style={error ? { borderColor: 'var(--danger)' } : {}}
      {...props}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

// --- CARD ---
interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  action?: React.ReactNode;
  style?: React.CSSProperties;
  contentStyle?: React.CSSProperties;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className = '', title, action, style, contentStyle, hoverable }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={hoverable ? { y: -4, boxShadow: 'var(--shadow-xl)' } : {}}
    className={`glass-card ${className}`}
    style={{
      padding: 'var(--spacing-md)',
      borderRadius: 'var(--radius-xl)',
      position: 'relative',
      overflow: 'hidden',
      background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.8) 100%)',
      border: '1px solid rgba(255, 255, 255, 0.4)',
      boxShadow: 'var(--shadow-md), inset 0 0 0 1px rgba(255, 255, 255, 0.5)',
      ...style
    }}
  >
    {(title || action) && (
      <div className="card-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem',
        borderBottom: '1px solid var(--border-light)',
        paddingBottom: '0.75rem'
      }}>
        {title && <h3 className="card-title" style={{
          fontSize: '1.25rem',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          margin: 0
        }}>{title}</h3>}
        {action && <div>{action}</div>}
      </div>
    )}
    <div style={{ position: 'relative', zIndex: 1, ...contentStyle }}>{children}</div>
  </motion.div>
);

// --- KPI CARD ---
interface KPICardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: string;
  color?: string; // CSS color string or class
  comparison?: { value: string; label: string; trend: 'up' | 'down' | 'neutral' };
  variant?: 'glass' | 'colored';
  loading?: boolean;
}

export const KPICard: React.FC<KPICardProps> = ({ title, value, icon: Icon, trend, color = 'var(--primary)', comparison, variant = 'glass', loading }) => {
  // Extract color for background opacity
  const activeColor = color.startsWith('text-') ? (color === 'text-pink-500' ? '#EC4899' : '#3B82F6') : color;

  const isColored = variant === 'colored';

  return (
    <motion.div
      whileHover={{
        y: -4,
        boxShadow: isColored ? `0 12px 24px -8px ${activeColor}66` : 'var(--shadow-xl), var(--shadow-colored)',
        scale: 1.02
      }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      style={{
        background: isColored
          ? `linear-gradient(135deg, ${activeColor} 0%, ${activeColor}dd 100%)`
          : 'var(--glass-bg)',
        backdropFilter: 'blur(var(--glass-blur))',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
        borderRadius: 'var(--radius-xl)',
        padding: '0.625rem 1rem',
        boxShadow: isColored ? `0 8px 16px -4px ${activeColor}44` : 'var(--shadow-md)',
        border: isColored ? `1px solid ${activeColor}` : '1px solid var(--glass-border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all var(--transition-base)',
        minHeight: '85px'
      }}
    >
      {/* Decorative gradient blobs - "Mesh" effect */}
      <div style={{
        position: 'absolute',
        top: '-15%',
        right: '-10%',
        width: '6rem',
        height: '6rem',
        borderRadius: '50%',
        background: isColored ? 'rgba(255,255,255,0.2)' : `radial-gradient(circle, ${activeColor}33 0%, transparent 70%)`,
        zIndex: 0,
        transform: 'rotate(15deg)'
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-20%',
        left: '10%',
        width: '4rem',
        height: '4rem',
        borderRadius: '50%',
        background: isColored ? 'rgba(255,255,255,0.1)' : `radial-gradient(circle, ${activeColor}1a 0%, transparent 70%)`,
        zIndex: 0,
        transform: 'rotate(-20deg)'
      }} />

      {/* Subtle shine overlay */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '1px',
        background: isColored
          ? 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)'
          : 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
        zIndex: 1
      }} />

      {/* Comparison Badge - Top Right */}
      {comparison && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: comparison.trend === 'up' ? '#10B981' : comparison.trend === 'down' ? '#EF4444' : '#94A3B8',
            color: 'white',
            padding: '0.25rem 0.5rem',
            borderRadius: '0.5rem',
            fontSize: '0.7rem',
            fontWeight: 700,
            zIndex: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
          }}
        >
          <span>{comparison.value}</span>
          <span style={{ fontSize: '0.6rem', opacity: 0.9, marginTop: '1px' }}>{comparison.label}</span>
        </motion.div>
      )}

      <div style={{ position: 'relative', zIndex: 1 }}>
        <p style={{
          fontSize: '0.8125rem',
          fontWeight: 700,
          color: isColored ? 'rgba(255,255,255,0.9)' : 'var(--text-gray)',
          marginBottom: '0.125rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>{title}</p>
        {loading ? (
          <Skeleton width="100px" height="1.8rem" style={{ margin: '4px 0' }} />
        ) : (
          <h3 style={{
            fontSize: '1.5rem',
            fontWeight: 800,
            margin: 0,
            color: isColored ? 'white' : 'var(--text-dark)',
            letterSpacing: '-0.04em'
          }}>{value}</h3>
        )}
        {loading ? (
          <Skeleton width="60px" height="0.8rem" />
        ) : (
          trend && <p style={{ fontSize: '0.75rem', fontWeight: 600, color: isColored ? 'rgba(255,255,255,0.9)' : 'var(--success)', marginTop: '0.125rem' }}>{trend}</p>
        )}
      </div>

      <div style={{
        position: 'relative',
        zIndex: 1,
        width: '2.5rem',
        height: '2.5rem',
        borderRadius: '0.75rem',
        background: isColored ? 'rgba(255,255,255,0.2)' : (activeColor === 'var(--primary)'
          ? 'linear-gradient(135deg, var(--primary-light) 0%, rgba(232, 244, 248, 0.6) 100%)'
          : `linear-gradient(135deg, ${activeColor}20 0%, ${activeColor}10 100%)`),
        color: isColored ? 'white' : activeColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: isColored ? 'none' : `0 8px 20px -4px ${activeColor}35, inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
        transition: 'all var(--transition-base)'
      }}>
        {loading ? (
          <Skeleton width="20px" height="20px" variant="circular" />
        ) : (
          <Icon size={20} strokeWidth={2.5} style={{ filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))' }} />
        )}
      </div>
    </motion.div>
  );
};

// --- MODAL ---
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  closeOnOverlayClick?: boolean;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md', closeOnOverlayClick = false }) => {
  const getWidth = () => {
    switch (size) {
      case 'sm': return '32rem';
      case 'md': return '50rem'; // Increased from 42rem
      case 'lg': return '64rem';
      case 'xl': return '80rem';
      case '2xl': return '95rem';
      default: return '50rem';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
            onClick={closeOnOverlayClick ? onClose : undefined}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 30 }}
              className="modal-content glass"
              style={{
                overflow: 'hidden',
                borderRadius: 'var(--radius-2xl)',
                width: '100%',
                maxWidth: getWidth(),
                maxHeight: '94vh',
                border: '1px solid var(--glass-border)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 'var(--spacing-lg) var(--spacing-xl)',
                borderBottom: '1px solid var(--border-light)',
                background: '#ffffff'
              }}>
                <h3 style={{
                  fontSize: '1.5rem',
                  fontWeight: 800,
                  letterSpacing: '-0.04em',
                  margin: 0
                }}>{title}</h3>
                <button
                  onClick={onClose}
                  style={{
                    background: 'var(--bg-hover)',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-gray)',
                    display: 'flex',
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-md)',
                    transition: 'all var(--transition-fast)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-active)';
                    e.currentTarget.style.color = 'var(--text-dark)';
                    e.currentTarget.style.transform = 'rotate(90deg)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--bg-hover)';
                    e.currentTarget.style.color = 'var(--text-gray)';
                    e.currentTarget.style.transform = 'rotate(0deg)';
                  }}
                >
                  <MdClose size={20} />
                </button>
              </div>
              <div style={{
                padding: 'var(--spacing-xl)',
                maxHeight: 'calc(90vh - 80px)',
                overflowY: 'auto',
                overflowX: 'visible'
              }}>
                {children}
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// --- TABLE ---
interface TableColumn<T> {
  header: string | React.ReactNode;
  accessor: keyof T | ((item: T) => React.ReactNode);
  className?: string;
  style?: React.CSSProperties;
  skeleton?: React.ReactNode;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  isLoading?: boolean;
  silentLoading?: boolean;
  skeletonCount?: number;
}

export const Table = <T extends { id: number | string }>({ columns, data, onRowClick, isLoading, silentLoading, skeletonCount = 5 }: TableProps<T>) => {

  return (
    <div className="table-container" style={{ position: 'relative' }}>
      {/* Overlay Loading State */}
      <AnimatePresence>
        {isLoading && data.length > 0 && !silentLoading && (

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 10,
              background: 'rgba(255, 255, 255, 0.6)',
              backdropFilter: 'blur(2px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '1rem',
            }}
          >
            <div className="flex flex-col items-center gap-3">
              <span className="animate-spin" style={{ display: 'flex', color: 'var(--primary)' }}>
                <MdLoop size={40} />
              </span>
              <span className="text-sm font-bold text-slate-600 uppercase tracking-widest">Refreshing...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Removed old spinner-only initial loading block */}


      <table className="table">
        <thead>
          <tr>
            {columns.map((col, idx) => (
              <th key={idx} className={col.className} style={{ paddingTop: '1rem', paddingBottom: '1rem', ...col.style }}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <AnimatePresence>
            {isLoading && data.length === 0 ? (
              Array.from({ length: skeletonCount }).map((_, rIdx) => (
                <tr key={`skeleton-row-${rIdx}`}>
                  {columns.map((col, cIdx) => (
                    <td key={`skeleton-cell-${cIdx}`} className={col.className} style={{ paddingTop: '1.25rem', paddingBottom: '1.25rem', ...col.style }}>
                      {col.skeleton ? col.skeleton : <Skeleton width="80%" height="1.2rem" />}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              data.map((row, idx) => (
                <motion.tr
                  key={row.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => onRowClick && onRowClick(row)}
                  style={{ cursor: onRowClick ? 'pointer' : 'default' }}
                >
                  {columns.map((col, cIdx) => (
                    <td key={cIdx} className={col.className} style={{ paddingTop: '1rem', paddingBottom: '1rem', ...col.style }}>
                      {typeof col.accessor === 'function'
                        ? col.accessor(row)
                        : (row[col.accessor] as React.ReactNode)}
                    </td>
                  ))}
                </motion.tr>
              ))
            )}
          </AnimatePresence>
          {!isLoading && data.length === 0 && (
            <tr>
              <td colSpan={columns.length} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-gray)' }}>
                No data available.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

// --- SEARCHABLE SELECT ---
interface SearchableSelectProps {
  label?: string;
  name?: string;
  value?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  onChange?: (e: any) => void;
  error?: string;
  className?: string;
  multiple?: boolean;
  allowCustom?: boolean;
  dropdownDirection?: 'up' | 'down';
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  label, name, value, options, placeholder, onChange, error,
  className = '', multiple, allowCustom = false, dropdownDirection = 'down'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [internalValue, setInternalValue] = useState(value || '');

  const isControlled = value !== undefined;
  const currentVal = isControlled ? (value || '') : internalValue;

  // Initialize internal state when prop changes
  React.useEffect(() => {
    if (isControlled) setInternalValue(value || '');
  }, [value, isControlled]);

  // Update searchTerm when value changes (for Single Select label display)
  React.useEffect(() => {
    if (!multiple && currentVal) {
      const selectedOption = options.find(opt => opt.value === currentVal);
      setSearchTerm(selectedOption ? selectedOption.label : currentVal);
    } else if (!multiple && !currentVal) {
      setSearchTerm('');
    }
  }, [currentVal, options, multiple]);

  // Helper to parse multiple values
  const getSelectedItems = () => {
    if (!currentVal) return [];
    return currentVal.split(',').map(s => s.trim()).filter(Boolean);
  };

  const selectedItems = multiple ? getSelectedItems() : [];

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (!multiple || !selectedItems.includes(opt.value))
  );

  const handleSelect = (option: { value: string, label: string }) => {
    if (multiple) {
      if (selectedItems.includes(option.value)) return;

      const newItems = [...selectedItems, option.value];
      const newValue = newItems.join(', ');

      if (!isControlled) setInternalValue(newValue);
      if (onChange) onChange({ target: { name: name, value: newValue } });

      setSearchTerm('');
      const input = document.getElementById(`search-select-${name}`);
      if (input) input.focus();
    } else {
      setSearchTerm(option.label);
      setIsOpen(false);
      const newValue = option.value;

      if (!isControlled) setInternalValue(newValue);
      if (onChange) onChange({ target: { name: name, value: newValue } });
    }
  };

  const handleRemoveItem = (itemToRemove: string) => {
    const newItems = selectedItems.filter(item => item !== itemToRemove);
    const newValue = newItems.join(', ');

    if (!isControlled) setInternalValue(newValue);
    if (onChange) onChange({ target: { name: name, value: newValue } });
  };

  return (
    <div className="input-group" style={{ position: 'relative' }}>
      {label && <label className="input-label">{label}</label>}

      {/* Chips for Multi-select - Moved ABOVE input to avoid being covered by dropdown */}
      {multiple && selectedItems.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
          {selectedItems.map((item, idx) => (
            <motion.span
              key={`${item}-${idx}`}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              style={{
                background: 'var(--bg-body)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem',
                fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem',
                border: '1px solid var(--border)', color: 'var(--text-dark)'
              }}>
              {item}
              <button
                type="button"
                onClick={() => handleRemoveItem(item)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--text-gray)' }}
              >
                <MdClose size={14} />
              </button>
            </motion.span>
          ))}
        </div>
      )}

      <div style={{ position: 'relative' }}>
        <input
          id={`search-select-${name}`}
          type="text"
          autoComplete="off"
          spellCheck={false}
          className={`form-control ${className}`}
          placeholder={multiple && selectedItems.length > 0 ? "Add more..." : placeholder}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
            if (!multiple && allowCustom && onChange) {
              onChange({ target: { name, value: e.target.value } });
            }
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            setTimeout(() => {
              setIsOpen(false);
              if (!multiple && !allowCustom) {
                const selectedOption = options.find(opt => opt.value === currentVal);
                setSearchTerm(selectedOption ? selectedOption.label : '');
              }
            }, 200);
          }}
          style={error ? { borderColor: 'var(--danger)' } : {}}
        />
        {/* Hidden input for form submission - holds the actual value (comma separated if multiple) */}
        <input type="hidden" name={name} value={currentVal} />

        <div style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-gray)', pointerEvents: 'none', display: 'flex' }}>
          <MdExpandMore size={16} />
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (filteredOptions.length > 0 || (searchTerm && allowCustom)) && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            style={{
              position: 'absolute',
              top: dropdownDirection === 'down' ? '100%' : 'auto',
              bottom: dropdownDirection === 'up' ? '100%' : 'auto',
              left: 0, right: 0,
              background: 'var(--bg-card)', borderRadius: '0.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              zIndex: 50, maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border)',
              marginTop: dropdownDirection === 'down' ? '0.25rem' : '0',
              marginBottom: dropdownDirection === 'up' ? '0.25rem' : '0'
            }}
          >
            {filteredOptions.length > 0 ? (
              filteredOptions.map(opt => (
                <div
                  key={opt.value}
                  onClick={() => handleSelect(opt)}
                  style={{ padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-dark)' }}
                  className="hover:bg-gray-50"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {opt.label}
                </div>
              ))
            ) : (
              searchTerm && allowCustom && (
                <div style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', color: 'var(--text-gray)' }}>
                  Use "{searchTerm}"
                </div>
              )
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {error && <p style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{error}</p>}
    </div>
  );
};