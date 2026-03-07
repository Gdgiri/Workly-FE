import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Clock, Calendar as CalendarIcon, MoreVertical, MapPin, User, Scissors } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Appointment {
    id: string | number;
    date?: string; // YYYY-MM-DD
    startTime?: string; // ISO string
    time?: string; // "09:00 AM" if pre-formatted
    customerName?: string;
    customer?: { name: string };
    client?: string; // fallback
    serviceName?: string;
    service?: { name: string } | string;
    stylistName?: string;
    stylist?: { name: string } | string;
    status: string;
}

interface WeeklyCalendarProps {
    appointments: Appointment[];
}

export const WeeklyCalendar: React.FC<WeeklyCalendarProps> = ({ appointments }) => {
    const [currentDate, setCurrentDate] = useState(new Date()); // Controls the visible week
    const [selectedDate, setSelectedDate] = useState(new Date()); // Controls the selected day details
    const [weekDates, setWeekDates] = useState<{ day: string; date: string; fullDate: string }[]>([]);
    const [isMobile, setIsMobile] = useState(false);

    // Helper to get YYYY-MM-DD in LOCAL time
    const getLocalDateString = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Mobile detection
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };

        // Initial check
        handleResize();

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Generate week dates based on currentDate
    useEffect(() => {
        const dates = [];
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        // Start week on Monday
        const curr = new Date(currentDate);
        const day = curr.getDay(); // 0 is Sunday

        // Calculate Monday
        const diff = curr.getDate() - day + (day === 0 ? -6 : 1);

        const monday = new Date(curr.setDate(diff));

        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            dates.push({
                day: dayNames[d.getDay()],
                date: d.getDate().toString(),
                fullDate: getLocalDateString(d)
            });
        }
        setWeekDates(dates);
    }, [currentDate]);

    const nextWeek = () => {
        if (isMobile) {
            // Move by 1 day on mobile
            const next = new Date(selectedDate);
            next.setDate(selectedDate.getDate() + 1);
            setSelectedDate(next);

            // If next day is in next week relative to current view, update week too
            const nextDayTime = next.getTime();
            const weekEnd = new Date(weekDates[6]?.fullDate).getTime();
            if (weekEnd && nextDayTime > weekEnd) {
                const newWeek = new Date(currentDate);
                newWeek.setDate(currentDate.getDate() + 7);
                setCurrentDate(newWeek);
            } else if (weekDates.length === 0) {
                // Fallback if weekDates not ready
                setCurrentDate(next);
            }
        } else {
            const next = new Date(currentDate);
            next.setDate(currentDate.getDate() + 7);
            setCurrentDate(next);

            // Sync selectedDate to the same relative day in the next week
            const nextSelected = new Date(selectedDate);
            nextSelected.setDate(selectedDate.getDate() + 7);
            setSelectedDate(nextSelected);
        }
    };

    const prevWeek = () => {
        if (isMobile) {
            // Move by 1 day back on mobile
            const prev = new Date(selectedDate);
            prev.setDate(selectedDate.getDate() - 1);
            setSelectedDate(prev);

            // If prev day is before current week, update week
            const prevDayTime = prev.getTime();
            const weekStart = new Date(weekDates[0]?.fullDate).getTime();

            if (weekStart && prevDayTime < weekStart) {
                const newWeek = new Date(currentDate);
                newWeek.setDate(currentDate.getDate() - 7);
                setCurrentDate(newWeek);
            } else if (weekDates.length === 0) {
                setCurrentDate(prev);
            }
        } else {
            const prev = new Date(currentDate);
            prev.setDate(currentDate.getDate() - 7);
            setCurrentDate(prev);

            // Sync selectedDate to the same relative day in the previous week
            const prevSelected = new Date(selectedDate);
            prevSelected.setDate(selectedDate.getDate() - 7);
            setSelectedDate(prevSelected);
        }
    };

    const handleDateClick = (dateStr: string) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        setSelectedDate(new Date(y, m - 1, d));
    };

    const goToToday = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        setCurrentDate(today);
        setSelectedDate(today);
    };

    const getAppointmentsForDate = (dateStr: string) => {
        // Ensure appointments is an array
        if (!Array.isArray(appointments)) {
            console.error('Appointments is not an array:', appointments);
            return [];
        }

        return appointments.filter(apt => {
            let aptDate = '';
            if (apt.date) aptDate = getLocalDateString(new Date(apt.date));
            else if (apt.startTime) aptDate = getLocalDateString(new Date(apt.startTime));

            return aptDate === dateStr && apt.status !== 'CANCELLED';
        }).sort((a, b) => {
            const timeA = a.startTime || a.time || '';
            const timeB = b.startTime || b.time || '';
            return timeA.localeCompare(timeB);
        });
    };

    const selectedDateStr = getLocalDateString(selectedDate);
    const activeAppointments = getAppointmentsForDate(selectedDateStr);

    const getMonthYear = () => {
        if (weekDates.length === 0) return '';

        if (isMobile) {
            // On mobile, show currently selected date's Month Year
            return selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        }

        const start = new Date(weekDates[0].fullDate);
        const end = new Date(weekDates[6].fullDate);

        if (start.getMonth() === end.getMonth()) {
            return `${start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
        } else {
            return `${start.toLocaleDateString('en-US', { month: 'short' })} - ${end.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status?.toUpperCase()) {
            case 'CONFIRMED': return '#22c55e'; // Green
            case 'COMPLETED': return '#3b82f6'; // Blue
            case 'PENDING': return '#f59e0b';   // Orange
            case 'IN_PROGRESS': return '#8b5cf6'; // Purple
            default: return '#9ca3af'; // Gray
        }
    };

    return (
        <div className="card" style={{ padding: 0, overflow: 'hidden', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.08)', borderRadius: '1.5rem' }}>
            {/* Premium Header */}
            <div style={{
                background: 'linear-gradient(135deg, var(--primary) 0%, #1a2e3b 100%)',
                padding: '1.5rem 2rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                color: 'white',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {/* Background decorative circle */}
                <div style={{
                    position: 'absolute',
                    right: '-2rem',
                    top: '-2rem',
                    width: '8rem',
                    height: '8rem',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '50%',
                    pointerEvents: 'none'
                }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', position: 'relative', zIndex: 1 }}>
                    <div style={{
                        background: 'rgba(255,255,255,0.15)',
                        backdropFilter: 'blur(8px)',
                        borderRadius: '1rem',
                        padding: '0.75rem',
                        display: 'flex',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    }}>
                        <CalendarIcon size={24} color="white" />
                    </div>
                    <div>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', lineHeight: 1 }}>{getMonthYear()}</h3>
                        <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.8, fontWeight: 500 }}>Schedule Manager</p>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', position: 'relative', zIndex: 1 }}>
                    <button onClick={prevWeek} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '0.75rem', padding: '0.5rem', color: 'white', cursor: 'pointer', transition: 'all 0.2s' }}>
                        <ChevronLeft size={20} />
                    </button>
                    {!isMobile && (
                        <button
                            onClick={goToToday}
                            style={{
                                background: 'white',
                                color: 'var(--primary)',
                                border: 'none',
                                borderRadius: '0.75rem',
                                padding: '0.5rem 1.25rem',
                                fontSize: '0.875rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                            }}
                        >
                            Today
                        </button>
                    )}
                    <button onClick={nextWeek} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '0.75rem', padding: '0.5rem', color: 'white', cursor: 'pointer', transition: 'all 0.2s' }}>
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            {/* Date Picker Row */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(7, 1fr)',
                background: '#F8FAFC',
                borderBottom: '1px solid #E2E8F0',
                padding: '0.5rem 0'
            }}>
                {weekDates.map((item, index) => {
                    const isSelected = item.fullDate === selectedDateStr;
                    const isToday = item.fullDate === getLocalDateString(new Date());

                    // Mobile: Show 3 dates centered on selection
                    if (isMobile) {
                        const selectedIndex = weekDates.findIndex(d => d.fullDate === selectedDateStr);
                        let start = Math.max(0, Math.min(selectedIndex - 1, 4)); // Clamp start between 0 and 4
                        // If selectedDate isn't found in current week (edge case), default to 0
                        if (selectedIndex === -1) start = 0;

                        const visibleIndices = [start, start + 1, start + 2];
                        if (!visibleIndices.includes(index)) return null;
                    }

                    return (
                        <div
                            key={index}
                            onClick={() => handleDateClick(item.fullDate)}
                            style={{
                                padding: '1rem 0.5rem',
                                textAlign: 'center',
                                cursor: 'pointer',
                                position: 'relative',
                                transition: 'all 0.2s'
                            }}
                        >
                            <div style={{
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                color: isSelected ? 'var(--primary)' : '#64748B',
                                marginBottom: '0.5rem',
                                letterSpacing: '0.05em'
                            }}>
                                {item.day}
                            </div>
                            <div style={{
                                fontSize: '1.25rem',
                                fontWeight: isSelected ? 800 : 500,
                                color: isSelected ? 'white' : '#1E293B',
                                width: '2.75rem',
                                height: '2.75rem',
                                lineHeight: '2.75rem',
                                margin: '0 auto',
                                borderRadius: '50%',
                                background: isSelected ? 'var(--primary)' : (isToday ? '#E0F2FE' : 'transparent'),
                                boxShadow: isSelected ? '0 4px 12px rgba(35, 76, 106, 0.3)' : 'none',
                                transition: 'all 0.2s transform'
                            }}
                                className={isSelected ? 'scale-110' : ''}
                            >
                                {item.date}
                            </div>
                            {isToday && !isSelected && (
                                <div style={{ position: 'absolute', bottom: '0.25rem', left: '50%', transform: 'translateX(-50%)', width: '4px', height: '4px', borderRadius: '50%', background: 'var(--primary)' }} />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Selected Day Appointments */}
            <div style={{ background: 'white', minHeight: '400px', padding: '1.5rem' }}>
                <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1E293B', margin: 0 }}>
                        {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </h4>
                    <span style={{
                        background: '#F1F5F9',
                        color: '#64748B',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '0.2rem 0.6rem',
                        borderRadius: '99px'
                    }}>
                        {activeAppointments.length} Appointments
                    </span>
                </div>

                <AnimatePresence mode='wait'>
                    <motion.div
                        key={selectedDateStr}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                        style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
                    >
                        {activeAppointments.length > 0 ? (
                            activeAppointments.map((apt, idx) => {
                                const time = apt.startTime ? new Date(apt.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (apt.time || 'TBD');
                                const clientName = apt.customerName || apt.customer?.name || apt.client || (typeof apt.client === 'string' ? apt.client : 'Unknown');
                                const serviceName = apt.serviceName || (typeof apt.service === 'string' ? apt.service : apt.service?.name) || 'Service';
                                const stylistName = apt.stylistName || (typeof apt.stylist === 'string' ? apt.stylist : apt.stylist?.name) || 'Unassigned';
                                const statusColor = getStatusColor(apt.status);

                                return (
                                    <motion.div
                                        key={`${apt.id}-${idx}`}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        whileHover={{ scale: 1.01, boxShadow: '0 8px 16px rgba(0,0,0,0.06)' }}
                                        style={{
                                            background: 'white',
                                            border: '1px solid #E2E8F0',
                                            borderRadius: '1rem',
                                            padding: isMobile ? '1rem' : '1.25rem',
                                            display: 'flex',
                                            flexDirection: isMobile ? 'column' : 'row',
                                            alignItems: isMobile ? 'flex-start' : 'center',
                                            gap: isMobile ? '1rem' : '1.5rem',
                                            position: 'relative',
                                            overflow: 'hidden'
                                        }}
                                    >
                                        {/* Mobile Header: Time & Status */}
                                        {isMobile && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.75rem', marginBottom: '0.25rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <Clock size={16} color="#64748B" />
                                                    <span style={{ fontSize: '1rem', fontWeight: 800, color: '#1E293B' }}>{time}</span>
                                                </div>
                                                <span style={{
                                                    background: `${statusColor}15`,
                                                    color: statusColor,
                                                    padding: '0.2rem 0.6rem',
                                                    borderRadius: '0.4rem',
                                                    fontSize: '0.7rem',
                                                    fontWeight: 700
                                                }}>
                                                    {apt.status}
                                                </span>
                                            </div>
                                        )}

                                        {/* Desktop Time Column */}
                                        {!isMobile && (
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '4rem', paddingRight: '1rem', borderRight: '2px solid #F1F5F9' }}>
                                                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#1E293B' }}>{time.split(' ')[0]}</span>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase' }}>{time.split(' ')[1]}</span>
                                            </div>
                                        )}

                                        {/* Content */}
                                        <div style={{
                                            flex: 1,
                                            display: isMobile ? 'flex' : 'grid',
                                            flexDirection: isMobile ? 'column' : 'unset',
                                            gridTemplateColumns: isMobile ? 'unset' : '2fr 1.5fr 1fr',
                                            gap: isMobile ? '0.75rem' : '1rem',
                                            alignItems: isMobile ? 'flex-start' : 'center',
                                            width: isMobile ? '100%' : 'auto'
                                        }}>
                                            {/* Client */}
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                                    <User size={14} color="#94A3B8" />
                                                    <span style={{ fontSize: '1rem', fontWeight: 600, color: '#1E293B' }}>{clientName}</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <Scissors size={14} color="#94A3B8" />
                                                    <span style={{ fontSize: '0.85rem', color: '#64748B' }}>{serviceName}</span>
                                                </div>
                                            </div>

                                            {/* Stylist */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#64748B' }}>
                                                    {stylistName.charAt(0)}
                                                </div>
                                                <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#475569' }}>{stylistName}</span>
                                            </div>

                                            {/* Desktop Status (Mobile status is at top) */}
                                            {!isMobile && (
                                                <div style={{ textAlign: 'right' }}>
                                                    <span style={{
                                                        background: `${statusColor}15`,
                                                        color: statusColor,
                                                        padding: '0.4rem 0.8rem',
                                                        borderRadius: '0.5rem',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 700
                                                    }}>
                                                        {apt.status}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            })
                        ) : (
                            // Simple text empty state if prefered, but updated to "no appointment" design style
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 0', opacity: 0.5 }}>
                                <div style={{ background: '#F8FAFC', padding: '1.5rem', borderRadius: '50%', marginBottom: '1rem' }}>
                                    <CalendarIcon size={40} color="#94A3B8" />
                                </div>
                                <h4 style={{ margin: '0 0 0.5rem 0', color: '#1E293B', fontSize: '1.1rem' }}>No Appointments</h4>
                                <p style={{ margin: 0, color: '#64748B' }}>No appointments scheduled for this day.</p>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};
