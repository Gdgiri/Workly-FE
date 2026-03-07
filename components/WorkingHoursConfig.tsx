import React, { useState } from 'react';
import { MdAccessTime, MdContentCopy, MdOutlineCalendarToday, MdOutlineEventAvailable } from 'react-icons/md';
import { Button } from './UI';

interface Shift {
    start: string;
    end: string;
}

interface WorkingHours {
    morning?: Shift;
    afternoon?: Shift;
    // Backward compatibility
    start?: string;
    end?: string;
}

interface Schedule {
    [day: string]: WorkingHours | null; // null or undefined means OFF
}

interface WorkingHoursConfigProps {
    value: Schedule;
    onChange: (schedule: Schedule) => void;
}

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const WorkingHoursConfig: React.FC<WorkingHoursConfigProps> = ({ value, onChange }) => {
    const [selectedDay, setSelectedDay] = useState('Mon');

    const normalizeDay = (dayData: WorkingHours | null): WorkingHours | null => {
        if (!dayData) return null;
        if (dayData.morning && dayData.afternoon) return dayData;

        // Convert legacy to new structure
        return {
            morning: dayData.start ? { start: dayData.start, end: '13:00' } : { start: '09:00', end: '13:00' },
            afternoon: dayData.end ? { start: '14:00', end: dayData.end } : { start: '14:00', end: '18:00' }
        };
    };

    const toggleDay = (day: string) => {
        const isActive = !!value[day];
        const newSchedule = { ...value };
        if (isActive) {
            delete newSchedule[day];
        } else {
            // Smart default: copy from another active day if possible, else default
            const activeDay = WEEK_DAYS.find(d => !!value[d]);
            if (activeDay && value[activeDay]) {
                newSchedule[day] = normalizeDay(JSON.parse(JSON.stringify(value[activeDay])));
            } else {
                newSchedule[day] = {
                    morning: { start: '09:00', end: '13:00' },
                    afternoon: { start: '14:00', end: '18:00' }
                };
            }
        }
        onChange(newSchedule);
    };

    const handleTimeChange = (shift: 'morning' | 'afternoon', type: 'start' | 'end', time: string) => {
        if (!value[selectedDay]) return;
        const currentDay = value[selectedDay] || {};

        // Ensure morning/afternoon objects exist (handle migration from old structure)
        const morning = currentDay.morning || (currentDay.start ? { start: currentDay.start, end: '13:00' } : { start: '09:00', end: '13:00' });
        const afternoon = currentDay.afternoon || (currentDay.end ? { start: '14:00', end: currentDay.end } : { start: '14:00', end: '18:00' });

        const updatedMorning = shift === 'morning' ? { ...morning, [type]: time } : morning;
        const updatedAfternoon = shift === 'afternoon' ? { ...afternoon, [type]: time } : afternoon;

        onChange({
            ...value,
            [selectedDay]: {
                morning: updatedMorning,
                afternoon: updatedAfternoon
            }
        });
    };

    const copyToWeekdays = () => {
        const sourceHours = value[selectedDay];
        if (!sourceHours) return;

        const normalizedSource = normalizeDay(sourceHours);
        const newSchedule = { ...value };

        ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].forEach(day => {
            // Deep copy
            newSchedule[day] = JSON.parse(JSON.stringify(normalizedSource));
        });
        onChange(newSchedule);
    };

    const copyToAll = () => {
        const sourceHours = value[selectedDay];
        if (!sourceHours) return;

        const normalizedSource = normalizeDay(sourceHours);
        const newSchedule = { ...value };

        WEEK_DAYS.forEach(day => {
            // Deep copy
            newSchedule[day] = JSON.parse(JSON.stringify(normalizedSource));
        });
        onChange(newSchedule);
    };

    const hours = value[selectedDay];
    const isActive = !!hours;

    return (
        <div style={{
            background: 'var(--bg-body)',
            borderRadius: '1rem',
            border: '1px solid var(--border)',
            display: 'flex',
            minHeight: '340px',
            overflow: 'hidden',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
        }}>

            {/* LEFT SIDEBAR: Day List */}
            <div style={{
                width: '130px',
                borderRight: '1px solid var(--border)',
                background: 'var(--bg-card)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
                padding: '0.75rem'
            }}>
                <div style={{ paddingLeft: '0.5rem', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-gray)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Week Days
                </div>
                {WEEK_DAYS.map(day => {
                    const dayActive = !!value[day];
                    const isSelected = selectedDay === day;
                    return (
                        <div
                            key={day}
                            onClick={() => setSelectedDay(day)}
                            style={{
                                padding: '0.6rem 0.75rem',
                                borderRadius: '0.6rem',
                                cursor: 'pointer',
                                background: isSelected ? 'var(--primary-light)' : 'transparent',
                                border: isSelected ? '1px solid rgba(var(--primary-rgb), 0.1)' : '1px solid transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}
                        >
                            <span style={{
                                fontWeight: isSelected ? 700 : 500,
                                color: isSelected ? 'var(--primary)' : 'var(--text-dark)',
                                fontSize: '0.9rem'
                            }}>
                                {day}
                            </span>

                            {dayActive ? (
                                <div style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    background: '#10b981', // Success Green
                                    boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.2)'
                                }} />
                            ) : (
                                <div style={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    background: 'var(--border)'
                                }} />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* RIGHT PANEL: Details */}
            <div style={{ flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column', background: 'var(--bg-body)' }}>

                {/* Header Section */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-dark)', lineHeight: 1 }}>{selectedDay}</h3>
                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-gray)' }}>
                            {isActive ? 'Configure working hours' : 'Set as non-working day'}
                        </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: isActive ? 'var(--success)' : 'var(--text-gray)' }}>
                            {isActive ? 'Active' : 'Rest Day'}
                        </span>
                        <Switch checked={isActive} onChange={() => toggleDay(selectedDay)} />
                    </div>
                </div>

                {/* Main Content Area */}
                {isActive ? (
                    <div style={{ animation: 'fadeIn 0.3s ease', display: 'flex', flexDirection: 'column', height: '100%', gap: '1.5rem' }}>

                        {/* Morning Shift */}
                        <div style={{ border: '1px solid var(--border)', borderRadius: '1rem', padding: '1.25rem', background: 'var(--bg-body)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <MdAccessTime size={18} />
                                </div>
                                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-dark)' }}>Morning Shift</h4>
                            </div>
                            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                                <div style={{ flex: 1, background: 'var(--bg-card)', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: '1px solid var(--border)' }}>
                                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-gray)', marginBottom: '0.25rem', display: 'block' }}>START</label>
                                    <input
                                        type="time"
                                        value={hours?.morning?.start || hours?.start || '09:00'}
                                        onChange={(e) => handleTimeChange('morning', 'start', e.target.value)}
                                        style={{ width: '100%', fontSize: '1.25rem', fontWeight: 600, border: 'none', background: 'transparent', color: 'var(--text-dark)' }}
                                    />
                                </div>
                                <div style={{ color: 'var(--text-gray)' }}>—</div>
                                <div style={{ flex: 1, background: 'var(--bg-card)', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: '1px solid var(--border)' }}>
                                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-gray)', marginBottom: '0.25rem', display: 'block' }}>END</label>
                                    <input
                                        type="time"
                                        value={hours?.morning?.end || '13:00'}
                                        onChange={(e) => handleTimeChange('morning', 'end', e.target.value)}
                                        style={{ width: '100%', fontSize: '1.25rem', fontWeight: 600, border: 'none', background: 'transparent', color: 'var(--text-dark)' }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Afternoon Shift */}
                        <div style={{ border: '1px solid var(--border)', borderRadius: '1rem', padding: '1.25rem', background: 'var(--bg-body)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#DBEAFE', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <MdAccessTime size={18} />
                                </div>
                                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-dark)' }}>Afternoon Shift</h4>
                            </div>
                            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                                <div style={{ flex: 1, background: 'var(--bg-card)', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: '1px solid var(--border)' }}>
                                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-gray)', marginBottom: '0.25rem', display: 'block' }}>START</label>
                                    <input
                                        type="time"
                                        value={hours?.afternoon?.start || '14:00'}
                                        onChange={(e) => handleTimeChange('afternoon', 'start', e.target.value)}
                                        style={{ width: '100%', fontSize: '1.25rem', fontWeight: 600, border: 'none', background: 'transparent', color: 'var(--text-dark)' }}
                                    />
                                </div>
                                <div style={{ color: 'var(--text-gray)' }}>—</div>
                                <div style={{ flex: 1, background: 'var(--bg-card)', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: '1px solid var(--border)' }}>
                                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-gray)', marginBottom: '0.25rem', display: 'block' }}>END</label>
                                    <input
                                        type="time"
                                        value={hours?.afternoon?.end || hours?.end || '18:00'}
                                        onChange={(e) => handleTimeChange('afternoon', 'end', e.target.value)}
                                        style={{ width: '100%', fontSize: '1.25rem', fontWeight: 600, border: 'none', background: 'transparent', color: 'var(--text-dark)' }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <Button
                                variant="secondary"
                                onClick={copyToWeekdays}
                                icon={<MdOutlineEventAvailable size={16} />}
                                style={{ justifyContent: 'center', fontSize: '0.8rem', padding: '0.6rem' }}
                            >
                                Copy to Mon-Fri
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={copyToAll}
                                icon={<MdContentCopy size={16} />}
                                style={{ justifyContent: 'center', fontSize: '0.8rem', padding: '0.6rem' }}
                            >
                                Copy to All Days
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-gray)',
                        padding: '1rem',
                        background: 'var(--bg-card)',
                        borderRadius: '1rem',
                        border: '1px dashed var(--border)',
                        height: '100%'
                    }}>
                        <div style={{ padding: '1rem', background: 'var(--bg-body)', borderRadius: '50%', marginBottom: '1rem', opacity: 0.5 }}>
                            <MdOutlineCalendarToday size={32} />
                        </div>
                        <p style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem' }}>No Schedule Set</p>
                        <p style={{ fontSize: '0.85rem', textAlign: 'center', maxWidth: '200px' }}>
                            This day is currently marked as a Rest Day.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

// Refined Switch with nicer shadow and transition
const Switch: React.FC<{ checked: boolean; onChange: () => void }> = ({ checked, onChange }) => (
    <div
        onClick={onChange}
        style={{
            width: '52px',
            height: '28px',
            background: checked ? 'var(--primary)' : '#e2e8f0',
            borderRadius: '28px',
            position: 'relative',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)'
        }}
    >
        <div style={{
            width: '22px',
            height: '22px',
            background: 'white',
            borderRadius: '50%',
            position: 'absolute',
            top: '3px',
            left: checked ? '26px' : '3px',
            transition: 'left 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)', // Bouncy effect
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }} />
    </div>
);
