import React from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Calendar, Briefcase, Users,
  UserCircle, BarChart2, Settings, LogOut, Bell, Search,
  Box, Package, ClipboardCheck, BadgeDollarSign, Ticket, Building2, Tags, Sparkles,
  Sun, Moon, CreditCard, Menu, X, Power, ChevronLeft, ChevronRight, MessageSquare, ClipboardList, Clock, Scissors
} from 'lucide-react';

import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import { useNotifications } from '../hooks/useNotifications';
import { useTheme } from '../hooks/useTheme';
import { useCurrency } from './CurrencyContext';
import { useAuth } from '../hooks/useAuth';
import { useToast } from './ToastContext';

interface SidebarProps {
  onLogout: () => void;
  isOpen?: boolean;
  onClose?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const allMenuItems = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
    color: '#6366F1', // Indigo
    gradient: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
    shortcutKey: 'd',
    shortcutLabel: 'Alt+D'
  },
  {
    id: 'business-approvals',
    label: 'Business Approvals',
    icon: Building2,
    roles: ['SUPER_ADMIN'],
    color: '#F59E0B', // Amber
    gradient: 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)',
    shortcutKey: 'b',
    shortcutLabel: 'Alt+B'
  },
  {
    id: 'sales',
    label: 'Sales',
    icon: BadgeDollarSign,
    roles: ['ADMIN', 'MANAGER', 'STAFF'],
    color: '#10B981', // Emerald
    gradient: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    shortcutKey: 's',
    shortcutLabel: 'Alt+S'
  },
  {
    id: 'expenses',
    label: 'Expenses',
    icon: BadgeDollarSign,
    roles: ['ADMIN', 'MANAGER'],
    color: '#EF4444', // Red
    gradient: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
    shortcutKey: 'e',
    shortcutLabel: 'Alt+E'
  },
  {
    id: 'payments',
    label: 'Transaction',
    icon: CreditCard,
    roles: ['ADMIN', 'MANAGER', 'STAFF'],
    color: '#3B82F6', // Blue
    gradient: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
    shortcutKey: 't',
    shortcutLabel: 'Alt+T'
  },

  {
    id: 'appointments',
    label: 'Schedule',
    icon: Calendar,
    roles: ['ADMIN', 'MANAGER', 'STAFF'],
    color: '#EC4899', // Pink
    gradient: 'linear-gradient(135deg, #EC4899 0%, #DB2777 100%)',
    shortcutKey: 'a',
    shortcutLabel: 'Alt+A'
  },
  {
    id: 'services',
    label: 'Services',
    icon: Briefcase,
    roles: ['ADMIN', 'MANAGER', 'STAFF'],
    color: '#8B5CF6', // Violet
    gradient: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
    shortcutKey: 'v',
    shortcutLabel: 'Alt+V'
  },
  {
    id: 'packages',
    label: 'Packages',
    icon: Package,
    roles: ['ADMIN', 'MANAGER', 'STAFF'],
    color: '#14B8A6', // Teal
    gradient: 'linear-gradient(135deg, #14B8A6 0%, #0D9488 100%)',
    shortcutKey: 'p',
    shortcutLabel: 'Alt+P'
  },
  { id: 'vouchers', label: 'Vouchers', icon: Ticket, roles: ['ADMIN', 'MANAGER', 'STAFF'] },
  {
    id: 'checklist',
    label: 'Checklist',
    icon: ClipboardList,
    roles: ['ADMIN', 'MANAGER', 'STAFF'],
    color: '#0EA5E9',
    gradient: 'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)',
    shortcutKey: 'h',
    shortcutLabel: 'Alt+H'
  },
  {
    id: 'tailor',
    label: 'Orders',
    icon: Scissors,
    roles: ['ADMIN', 'MANAGER', 'STAFF'],
    color: '#7C3AED',
    gradient: 'linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)',
    shortcutKey: 'n',
    shortcutLabel: 'Alt+N'
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: Box,
    roles: ['ADMIN', 'MANAGER', 'STAFF'],
    color: '#06B6D4', // Cyan
    gradient: 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)',
    shortcutKey: 'i',
    shortcutLabel: 'Alt+I'
  },
  {
    id: 'category',
    label: 'Category',
    icon: Tags,
    roles: ['ADMIN', 'MANAGER', 'STAFF'],
    color: '#F97316', // Orange
    gradient: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
    shortcutKey: 'c',
    shortcutLabel: 'Alt+C'
  },
  {
    id: 'workly-project/overview',
    label: 'Dashboard',
    icon: LayoutDashboard,
    roles: ['ADMIN', 'MANAGER', 'STAFF'],
    color: '#6366F1',
    gradient: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
    shortcutKey: 'w',
    shortcutLabel: 'Alt+W'
  },
  {
    id: 'workly-project/tasks',
    label: 'Schedules',
    icon: ClipboardList,
    roles: ['ADMIN', 'MANAGER', 'STAFF'],
    color: '#F59E0B',
    gradient: 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)',
  },
  {
    id: 'workly-project/attendance',
    label: 'Shift Logs',
    icon: Clock,
    roles: ['ADMIN', 'MANAGER', 'STAFF'],
    color: '#10B981',
    gradient: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
  },
  {
    id: 'workly-project/billing',
    label: 'Billing',
    icon: BadgeDollarSign,
    roles: ['ADMIN', 'MANAGER'],
    color: '#3B82F6',
    gradient: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
  },
  {
    id: 'workly-project/services',
    label: 'Services',
    icon: Sparkles,
    roles: ['ADMIN', 'MANAGER'],
    color: '#EC4899',
    gradient: 'linear-gradient(135deg, #EC4899 0%, #DB2777 100%)',
  },
  {
    id: 'workly-project/categories',
    label: 'Categories',
    icon: Tags,
    roles: ['ADMIN', 'MANAGER'],
    color: '#F97316',
    gradient: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
  },
  {
    id: 'stylists',
    label: 'Specialist',
    icon: UserCircle,
    roles: ['ADMIN', 'MANAGER', 'STAFF'],
    color: '#EAB308', // Yellow
    gradient: 'linear-gradient(135deg, #EAB308 0%, #CA8A04 100%)',
    shortcutKey: 'l',
    shortcutLabel: 'Alt+L'
  },
  {
    id: 'customers',
    label: 'Customers',
    icon: Users,
    roles: ['ADMIN', 'MANAGER', 'STAFF'],
    color: '#22C55E', // Green
    gradient: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
    shortcutKey: 'u',
    shortcutLabel: 'Alt+U'
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: BarChart2,
    roles: ['ADMIN'],
    color: '#0284C7', // Sky Blue
    gradient: 'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)',
    shortcutKey: 'j',
    shortcutLabel: 'Alt+J'
  },
  {
    id: 'ask-ai',
    label: 'Ask AI',
    icon: Sparkles,
    roles: ['ADMIN', 'MANAGER', 'STAFF'],
    color: '#8B5CF6', // Violet
    gradient: 'linear-gradient(135deg, #818CF8 0%, #C084FC 100%)',
    shortcutKey: 'k',
    shortcutLabel: 'Alt+K'
  },
  {
    id: 'reconciliation',
    label: 'Day End',
    icon: ClipboardCheck,
    roles: ['ADMIN', 'MANAGER', 'STAFF'],
    color: '#A855F7', // Purple
    gradient: 'linear-gradient(135deg, #A855F7 0%, #9333EA 100%)',
    shortcutKey: 'r',
    shortcutLabel: 'Alt+R'
  },
  {
    id: 'reconciliation-audits',
    label: 'Audit Logs',
    icon: BarChart2,
    roles: ['ADMIN'], // ADMIN only
    color: '#6366F1', // Indigo
    gradient: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
    shortcutKey: 'g',
    shortcutLabel: 'Alt+G'
  },
  {
    id: 'message-log',
    label: 'Message Log',
    icon: MessageSquare,
    roles: ['ADMIN', 'MANAGER'],
    color: '#10B981', // Changed to Emerald/Green to match "WhatsApp-inspired" request
    gradient: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    shortcutKey: 'm',
    shortcutLabel: 'Alt+M'
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    roles: ['ADMIN', 'MANAGER'],
    color: '#64748B', // Slate
    gradient: 'linear-gradient(135deg, #64748B 0%, #475569 100%)',
    shortcutKey: 'o',
    shortcutLabel: 'Alt+O'
  },
];

export const Sidebar: React.FC<SidebarProps> = ({ onLogout, isOpen = false, onClose, isCollapsed = false, onToggleCollapse }) => {
  const navigate = useNavigate();
  const location = useLocation();
  // @ts-ignore
  const user = useSelector((state: RootState) => state.auth.user);

  // Hover state for temporary expansion when collapsed
  const [isHovering, setIsHovering] = React.useState(false);
  // Hover state for menu items (track by item ID)
  const [hoveredItemId, setHoveredItemId] = React.useState<string | null>(null);

  // Prefer Redux state (persisted) over URL parsing
  const pathParts = location.pathname.split('/').filter(p => p);
  const appId = user?.appName || pathParts[0];
  const businessName = user?.businessName || pathParts[1];

  // Format shop name for display
  const rawName = businessName || 'Lumière';
  const shopName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

  // Menu items used from outer scope


  // Get user role from Redux state - check multiple possible property names
  const userRole = user?.role || 'USER';

  // Filter menu items based on user role
  const menuItems = allMenuItems.filter(item => {
    const normalizedUserRole = userRole.toUpperCase();

    // Also check if role matches any variation
    const roleMatches = item.roles.some(allowedRole =>
      allowedRole.toUpperCase() === normalizedUserRole
    );

    if (!roleMatches) return false;

    // We no longer strictly hide modules based on .view permission here.
    // Instead we let them render, and gate access upon clicking (with an Ask Admin toast).

    if (item.id === 'checklist' && appId !== 'workly-service') {
      return false;
    }

    if (item.id === 'tailor' && appId !== 'workly-tailor') {
      return false;
    }

    if (item.id.startsWith('workly-project/') && appId !== 'workly-project') {
      return false;
    }

    if (appId === 'workly-project') {
      const allowedProjectModules = [
        'workly-project/overview', 
        'workly-project/tasks', 
        'workly-project/attendance', 
        'workly-project/billing',
        'workly-project/services',
        'workly-project/categories',
        'customers', 
        'stylists', 
        'settings', 
        'ask-ai'
      ];
      if (!allowedProjectModules.includes(item.id)) {
        return false;
      }
    }

    if (appId === 'workly-tailor') {
      const allowedTailorModules = [
        'dashboard',
        'tailor',
        'sales',
        'services',
        'expenses',
        'payments',
        'stylists', // Tailors
        'customers',
        'inventory',
        'category',
        'reports',
        'settings'
      ];
      if (!allowedTailorModules.includes(item.id)) {
        return false;
      }
    }

    return true;
  });

  // Determine active tab from URL
  const currentPathSegments = location.pathname.split('/').filter(Boolean);
  let activeTab = currentPathSegments[currentPathSegments.length - 1] || 'dashboard';
  const projectSubPages = ['overview', 'tasks', 'attendance', 'billing', 'services', 'categories'];
  if (currentPathSegments.length >= 2 && currentPathSegments[currentPathSegments.length - 2] === 'workly-project') {
    activeTab = `workly-project/${currentPathSegments[currentPathSegments.length - 1]}`;
  }

  const { hasPermission } = useAuth();
  const { showToast } = useToast();

  const handleNavigate = (id: string) => {
    const freeModules = ['dashboard', 'ask-ai', 'settings'];
    if (!freeModules.includes(id) && !hasPermission(id, 'view')) {
      showToast(`Access Denied: Please ask your Admin for permission to view this module.`, 'error');
      return;
    }
    navigate(`/${appId}/${businessName}/${id}`);
  };

  // Keyboard Shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if Alt key is pressed and no input/textarea is focused
      if (e.altKey && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        const key = e.key.toLowerCase();

        // Find matching menu item from *visible* items
        const matchedItem = menuItems.find(item => item.shortcutKey === key);

        if (matchedItem) {
          e.preventDefault();
          handleNavigate(matchedItem.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [menuItems, appId, businessName, navigate]);

  // Determine effective width based on collapse state and hover
  const effectiveWidth = (isCollapsed && !isHovering) ? '90px' : 'var(--sidebar-width)';

  return (
    <motion.div
      initial={{ x: -100, opacity: 0 }}
      animate={{
        x: 0,
        opacity: 1,
        width: effectiveWidth
      }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      style={{
        width: effectiveWidth,
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(var(--glass-blur))',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        borderRight: '1px solid var(--glass-border)',
        zIndex: 1002,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: isHovering && isCollapsed
          ? '4px 0 32px rgba(0,0,0,0.15)'
          : '2px 0 12px rgba(0,0,0,0.04)',
        overflow: 'visible',
        transition: 'all var(--transition-base)'
      }}
      className={`sidebar ${isOpen ? 'sidebar-open' : ''} ${isCollapsed ? 'sidebar-collapsed' : ''}`}
      onMouseEnter={() => isCollapsed && setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Mobile Close Button */}
      <div className="mobile-only" style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 50 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-black)' }}>
          <X size={24} />
        </button>
      </div>
      <div style={{ padding: (isCollapsed && !isHovering) ? '2rem 0.5rem 1rem' : '2rem', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          {!(isCollapsed && !isHovering) && (
            <h1
              style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0, letterSpacing: '-0.025em', cursor: 'help' }}
              title={shopName}
            >
              {shopName.length > 10 ? `${shopName.slice(0, 10)}...` : shopName}
              <span style={{ color: 'var(--primary)' }}>.</span>
            </h1>
          )}
          {(isCollapsed && !isHovering) && (
            <div style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              textAlign: 'center',
              color: 'var(--primary)',
              flex: 1
            }}>
              {shopName.charAt(0)}
            </div>
          )}
          {/* Toggle Button */}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'transparent',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0
              }}
              title={isCollapsed ? 'Expand Sidebar - Show full menu' : 'Collapse Sidebar - Show icons only'}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? <ChevronRight size={20} color="var(--text-black)" /> : <ChevronLeft size={20} color="var(--text-black)" />}
            </button>
          )}
        </div>
      </div>

      <nav style={{ flex: 1, padding: (isCollapsed && !isHovering) ? '1rem 0.5rem' : '1rem', overflowY: 'auto', overflowX: 'visible' }}>
        {menuItems.map((item) => {
          const isActive = activeTab === item.id;
          const isHovered = hoveredItemId === item.id;
          const isSidebarExpanded = !(isCollapsed && !isHovering);

          return (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.id)}
              onMouseEnter={() => setHoveredItemId(item.id)}
              onMouseLeave={() => setHoveredItemId(null)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: (isCollapsed && !isHovering) ? 'center' : 'flex-start',
                padding: (isCollapsed && !isHovering) ? '0.75rem 0.5rem' : '0.75rem 1rem',
                fontSize: '1rem',
                fontWeight: isActive ? 600 : 500,
                borderRadius: 'var(--radius-lg)',
                border: 'none',
                background: isActive
                  ? 'linear-gradient(135deg, var(--primary-light) 0%, rgba(232, 244, 248, 0.6) 100%)'
                  : isHovered
                    ? 'var(--bg-hover)'
                    : 'transparent',
                color: isActive ? 'var(--primary)' : 'var(--text-black)',
                marginBottom: '0.375rem',
                cursor: 'pointer',
                transition: 'all var(--transition-base)',
                transform: isHovered && isSidebarExpanded ? 'translateX(4px)' : 'translateX(0)',
                position: 'relative',
                boxShadow: isActive
                  ? '0 2px 8px rgba(35, 76, 106, 0.15)'
                  : isHovered
                    ? '0 2px 4px rgba(0, 0, 0, 0.05)'
                    : 'none'
              }}
            >
              {/* Icon Container with Gradient Background */}
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: 'var(--radius-lg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: (isCollapsed && !isHovering) ? '0' : '0.75rem',
                  flexShrink: 0,
                  background: isActive || isHovered ? item.gradient : `${item.color}12`,
                  boxShadow: isActive
                    ? `0 4px 16px ${item.color}35, 0 0 24px ${item.color}20, inset 0 1px 0 rgba(255, 255, 255, 0.2)`
                    : isHovered
                      ? `0 4px 12px ${item.color}25, 0 0 16px ${item.color}15`
                      : 'none',
                  transition: 'all var(--transition-base)',
                  transform: isHovered ? 'scale(1.08) rotate(2deg)' : isActive ? 'scale(1.05)' : 'scale(1)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {(isActive || isHovered) && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.3), transparent 70%)',
                    pointerEvents: 'none'
                  }} />
                )}
                <item.icon
                  size={20}
                  strokeWidth={isActive || isHovered ? 2.5 : 2}
                  style={{
                    color: isActive || isHovered ? '#ffffff' : item.color,
                    transition: 'all var(--transition-base)',
                    filter: isActive || isHovered ? 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2))' : 'none',
                    position: 'relative',
                    zIndex: 1
                  }}
                />
              </div>
              {!(isCollapsed && !isHovering) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1 }}>
                  <span style={{
                    transition: 'all 0.3s ease',
                    fontWeight: isActive ? 600 : 500,
                    whiteSpace: 'nowrap'
                  }}>
                    {appId === 'workly-tailor' && item.id === 'stylists' ? 'Tailors' : item.label}
                  </span>
                  {/* {item.shortcutLabel && (
                    <span style={{
                      fontSize: '0.7rem',
                      color: isActive ? 'var(--primary)' : 'var(--text-light)',
                      border: `1px solid ${isActive ? 'var(--primary)' : 'var(--border)'}`,
                      borderRadius: '4px',
                      padding: '1px 4px',
                      opacity: 0.7
                    }}>
                      {item.shortcutLabel}
                    </span>
                  )} */}
                </div>
              )}
              {/* Custom Tooltip for Collapsed State - Only show when NOT hovering sidebar */}
              {isCollapsed && !isHovering && isHovered && (
                <div
                  style={{
                    position: 'fixed',
                    left: isCollapsed ? '100px' : '0',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    padding: '0.5rem 0.75rem',
                    background: 'rgba(0, 0, 0, 0.9)',
                    color: 'white',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    zIndex: 9999,
                    pointerEvents: 'none'
                  }}
                >
                  {item.label} {item.shortcutLabel ? `(${item.shortcutLabel})` : ''}
                  {/* Arrow */}
                  <div
                    style={{
                      position: 'absolute',
                      right: '100%',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 0,
                      height: 0,
                      borderTop: '6px solid transparent',
                      borderBottom: '6px solid transparent',
                      borderRight: '6px solid rgba(0, 0, 0, 0.9)'
                    }}
                  />
                </div>
              )}
            </button>
          );
        })}
      </nav>

      <div style={{ padding: '1rem', borderTop: '1px solid var(--border)' }}>
        <button
          onClick={onLogout}
          onMouseEnter={(e) => {
            const iconContainer = e.currentTarget.querySelector('.logout-icon-container') as HTMLElement;
            if (iconContainer) {
              iconContainer.style.background = 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)';
              iconContainer.style.boxShadow = '0 4px 8px rgba(239, 68, 68, 0.3)';
              iconContainer.style.transform = 'scale(1.05)';
            }
            e.currentTarget.style.transform = 'translateX(4px)';
          }}
          onMouseLeave={(e) => {
            const iconContainer = e.currentTarget.querySelector('.logout-icon-container') as HTMLElement;
            if (iconContainer) {
              iconContainer.style.background = 'rgba(239, 68, 68, 0.08)';
              iconContainer.style.boxShadow = 'none';
              iconContainer.style.transform = 'scale(1)';
            }
            e.currentTarget.style.transform = 'translateX(0)';
          }}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            padding: '0.75rem 1rem',
            fontSize: '0.875rem',
            fontWeight: 500,
            borderRadius: '0.75rem',
            color: 'var(--danger)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          className="btn-ghost"
        >
          <div
            className="logout-icon-container"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '0.75rem',
              flexShrink: 0,
              background: 'rgba(239, 68, 68, 0.08)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            <Power
              size={18}
              strokeWidth={2.5}
              style={{
                color: '#EF4444',
                transition: 'color 0.3s ease',
              }}
            />
          </div>
          {!(isCollapsed && !isHovering) && <span style={{ fontWeight: 500 }}>Logout</span>}
        </button>
      </div>
    </motion.div>
  );
};

interface TopBarProps {
  title: string;
  subtitle?: string;
  onMenuClick?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ title, subtitle, onMenuClick }) => {
  const [showNotifications, setShowNotifications] = React.useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll, isRead } = useNotifications();
  const { theme, toggleTheme } = useTheme();
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  // Handle notification click - navigate to Sales page with appointment data
  const handleNotificationClick = (notification: any) => {
    markAsRead(notification.id);
    setShowNotifications(false);

    // Extract appId and businessName from current path
    const pathParts = location.pathname.split('/').filter(p => p);
    const appId = pathParts[0] || 'salon';
    const businessName = pathParts[1] || 'admin';

    // Navigate to Sales page with appointment data
    navigate(`/${appId}/${businessName}/sales`, {
      state: {
        appointmentData: notification
      }
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      style={{
        height: '3.5rem',
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(var(--glass-blur)) saturate(180%)',
        WebkitBackdropFilter: 'blur(var(--glass-blur)) saturate(180%)',
        borderBottom: '1px solid var(--glass-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 2rem',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
        transition: 'all var(--transition-base)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          className="mobile-only"
          onClick={onMenuClick}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0.5rem',
            marginLeft: '-0.5rem',
            color: 'var(--text-dark)'
          }}
        >
          <Menu size={24} />
        </button>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            letterSpacing: '-0.025em',
            background: 'linear-gradient(135deg, var(--text-dark) 0%, var(--text-black) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textTransform: 'none',
            margin: 0
          }}>{title}</h2>
          {subtitle && (
            <p style={{
              fontSize: '0.8125rem',
              color: 'var(--text-black)',
              margin: '-2px 0 0 0',
              fontWeight: 500,
              letterSpacing: '0.01em'
            }}>
              {subtitle}
            </p>
          )}
        </div>
        <div id="header-slot" style={{ display: 'flex', alignItems: 'center', marginLeft: '1rem' }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <div style={{ position: 'relative', display: 'none' }} className="block-md">
          <Search style={{
            position: 'absolute',
            left: '0.875rem',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-light)',
            width: 18,
            height: 18,
            zIndex: 1,
            pointerEvents: 'none'
          }} />
          <input
            type="text"
            placeholder="Search..."
            style={{
              padding: '0.625rem 1rem 0.625rem 2.75rem',
              background: 'var(--bg-card)',
              border: '1.5px solid var(--border)',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.875rem',
              width: '18rem',
              outline: 'none',
              transition: 'all var(--transition-base)',
              boxShadow: 'var(--shadow-sm)'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--primary)';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(35, 76, 106, 0.1), var(--shadow-md)';
              e.currentTarget.style.width = '22rem';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
              e.currentTarget.style.width = '18rem';
            }}
          />
        </div>


        {/* Currency Indicator */}
        <div style={{
          fontSize: '0.75rem',
          fontWeight: 600,
          color: 'var(--text-black)',
          background: 'var(--bg-card)',
          padding: '0.375rem 0.875rem',
          borderRadius: 'var(--radius-full)',
          border: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          boxShadow: 'var(--shadow-sm)',
          transition: 'all var(--transition-fast)'
        }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = 'var(--shadow-md)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <span>{useCurrency().currency}</span>
          <span style={{ color: 'var(--primary)', fontWeight: 700 }}>({useCurrency().symbol})</span>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          style={{
            padding: '0.5rem',
            color: 'var(--text-light)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            transition: 'all var(--transition-base)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '0.5rem',
            boxShadow: 'var(--shadow-sm)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = theme === 'dark' ? '#fbbf24' : 'var(--primary)';
            e.currentTarget.style.background = 'var(--bg-hover)';
            e.currentTarget.style.boxShadow = 'var(--shadow-md)';
            e.currentTarget.style.transform = 'rotate(15deg) scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-light)';
            e.currentTarget.style.background = 'var(--bg-card)';
            e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
            e.currentTarget.style.transform = 'rotate(0deg) scale(1)';
          }}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        {/* Notification Bell */}
        {/* <div style={{ position: 'relative' }} ref={dropdownRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            style={{
              position: 'relative',
              padding: '0.5rem',
              color: '#9ca3af',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              transition: 'color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#234C6A'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'}
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: 6,
                right: 6,
                minWidth: 16,
                height: 16,
                background: 'var(--danger)',
                borderRadius: '999px',
                border: '2px solid white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.625rem',
                fontWeight: 'bold',
                color: 'white',
                padding: '0 4px'
              }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {showNotifications && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 0.5rem)',
              right: '-0.5rem',
              width: 'min(calc(100vw - 2rem), 380px)',
              maxHeight: '500px',
              background: 'white',
              borderRadius: '1rem',
              boxShadow: '0 15px 35px rgba(0,0,0,0.2), 0 5px 15px rgba(0,0,0,0.1)',
              border: '1px solid var(--border)',
              overflow: 'hidden',
              zIndex: 1001
            }}>
              <div style={{
                padding: '1rem 1.5rem',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--bg-body)'
              }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 'bold' }}>
                  Completed Appointments
                </h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: '0.25rem 0.5rem'
                      }}
                    >
                      Mark all read
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={clearAll}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: '0.25rem 0.5rem'
                      }}
                    >
                      Clear all
                    </button>
                  )}
                </div>
              </div>

              <div style={{
                maxHeight: '400px',
                overflowY: 'auto'
              }}>
                {notifications.length === 0 ? (
                  <div style={{
                    padding: '3rem 1.5rem',
                    textAlign: 'center',
                    color: '#9ca3af'
                  }}>
                    <Bell size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                    <p style={{ margin: 0, fontSize: '0.875rem' }}>No completed appointments</p>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      style={{
                        padding: '1rem 1.5rem',
                        borderBottom: '1px solid var(--bg-body)',
                        cursor: 'pointer',
                        background: isRead(notification.id) ? 'white' : 'rgba(35, 76, 106, 0.05)',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--primary-light)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = isRead(notification.id) ? 'white' : 'rgba(35, 76, 106, 0.05)'}
                    >
                      <div style={{ display: 'flex', alignItems: 'start', gap: '0.75rem' }}>
                        <div style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: isRead(notification.id) ? 'transparent' : 'var(--primary)',
                          marginTop: '0.5rem',
                          flexShrink: 0
                        }} />
                        <div style={{ flex: 1 }}>
                          <p style={{
                            margin: '0 0 0.25rem 0',
                            fontSize: '0.875rem',
                            fontWeight: isRead(notification.id) ? 500 : 600,
                            color: 'var(--text-dark)'
                          }}>
                            {notification.customerName}
                          </p>
                          <p style={{
                            margin: '0 0 0.5rem 0',
                            fontSize: '0.8125rem',
                            color: '#6b7280'
                          }}>
                            Completed: {notification.serviceName} <span style={{ opacity: 0.8 }}>by {notification.stylistName || 'Staff'}</span>
                          </p>
                          <p style={{
                            margin: 0,
                            fontSize: '0.75rem',
                            color: '#9ca3af'
                          }}>
                            {formatTime(notification.completedAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div> */}

        <div style={{ display: 'flex', alignItems: 'center', paddingLeft: '1.5rem', borderLeft: '1px solid var(--border)', gap: '0.75rem' }}>
          <div style={{ textAlign: 'right', display: 'none' }} className="block-md">
            <p style={{ fontSize: '0.875rem', fontWeight: 600, margin: 0 }}>Admin User</p>
            <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>Manager</p>
          </div>
          <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontWeight: 'bold', fontSize: '0.875rem' }}>
            AD
          </div>
        </div>
      </div>
    </motion.header >
  );
};
