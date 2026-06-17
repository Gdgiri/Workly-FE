import React, { useState, useEffect } from 'react';
import { Customer } from '../types';
import { Button, Input } from './UI';
import { Plus, Trash2, Edit2, Check, X, User, UserPlus } from 'lucide-react';
import api from '../utils/api';
import { useToast } from './ToastContext';
import { motion, AnimatePresence } from 'framer-motion';
import { parseMeasurementsToProfiles, MeasurementProfilesMap, MeasurementsData } from './MeasurementProfileSelector';

interface CustomerMeasurementsProps {
    customer: Customer;
    onUpdate: (updatedCustomer: Customer) => void;
}

export const CustomerMeasurements: React.FC<CustomerMeasurementsProps> = ({ customer, onUpdate }) => {
    const { showToast } = useToast();

    // ── Parse raw measurements into profile map ────────────────
    const [profiles, setProfiles] = useState<MeasurementProfilesMap>(() =>
        parseMeasurementsToProfiles((customer as any).measurements)
    );

    const [activeProfile, setActiveProfile] = useState<string>(() => {
        const names = Object.keys(parseMeasurementsToProfiles((customer as any).measurements));
        return names[0] || 'Self';
    });

    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // New field row state (inside active profile)
    const [newKey, setNewKey] = useState('');
    const [newValue, setNewValue] = useState('');

    // New profile creation state
    const [showAddProfile, setShowAddProfile] = useState(false);
    const [newProfileName, setNewProfileName] = useState('');

    // Sync profiles if customer prop changes (e.g. after save)
    useEffect(() => {
        const parsed = parseMeasurementsToProfiles((customer as any).measurements);
        setProfiles(parsed);
        if (!parsed[activeProfile] && Object.keys(parsed).length > 0) {
            setActiveProfile(Object.keys(parsed)[0]);
        }
    }, [customer]);

    const profileNames = Object.keys(profiles);

    // ── Active profile's measurements ──────────────────────────
    const activeMeasurements: MeasurementsData = profiles[activeProfile] || {};

    // ── Add a new measurement row to active profile ────────────
    const handleAddField = () => {
        if (!newKey.trim() || !newValue.trim()) {
            showToast('Both label and value are required', 'error');
            return;
        }
        setProfiles(prev => ({
            ...prev,
            [activeProfile]: {
                ...prev[activeProfile],
                [newKey.trim()]: newValue.trim()
            }
        }));
        setNewKey('');
        setNewValue('');
    };

    // ── Remove a measurement row from active profile ───────────
    const handleRemoveField = (key: string) => {
        setProfiles(prev => {
            const updated = { ...prev[activeProfile] };
            delete updated[key];
            return { ...prev, [activeProfile]: updated };
        });
    };

    // ── Add a new profile tab ──────────────────────────────────
    const handleAddProfile = () => {
        const name = newProfileName.trim();
        if (!name) return;
        if (profiles[name]) {
            showToast(`Profile "${name}" already exists`, 'error');
            return;
        }
        setProfiles(prev => ({ ...prev, [name]: {} }));
        setActiveProfile(name);
        setNewProfileName('');
        setShowAddProfile(false);
    };

    // ── Delete a profile tab ───────────────────────────────────
    const handleDeleteProfile = (name: string) => {
        if (profileNames.length <= 1) {
            showToast('You must keep at least one profile', 'error');
            return;
        }
        if (!confirm(`Delete profile "${name}"? This cannot be undone.`)) return;
        setProfiles(prev => {
            const updated = { ...prev };
            delete updated[name];
            return updated;
        });
        const remaining = profileNames.filter(n => n !== name);
        setActiveProfile(remaining[0]);
    };

    // ── Save all profiles back to customer ─────────────────────
    const handleSave = async () => {
        setIsSaving(true);
        try {
            // If there's only a "Self" profile and it was originally flat,
            // we still save as multi-profile — the backend/frontend both handle it
            const response = await api.put(`/customers/${customer.id}`, {
                ...customer,
                measurements: profiles
            });
            onUpdate(response.data);
            setIsEditing(false);
            showToast('Measurements saved', 'success');
        } catch (error: any) {
            showToast(error.response?.data?.error || 'Failed to save measurements', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        const parsed = parseMeasurementsToProfiles((customer as any).measurements);
        setProfiles(parsed);
        setIsEditing(false);
        setShowAddProfile(false);
        setNewKey('');
        setNewValue('');
    };

    const hasAnyMeasurements = profileNames.length > 0 && profileNames.some(n => Object.keys(profiles[n] || {}).length > 0);

    return (
        <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.5rem',
            marginTop: '1.5rem'
        }}>
            {/* ── Header ───────────────────────────────────────── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-dark)', margin: 0 }}>
                        Body Measurements
                    </h3>
                    <p style={{ margin: '0.125rem 0 0', fontSize: '0.75rem', color: 'var(--text-light)' }}>
                        Saved per person — used as snapshots when creating tailor orders
                    </p>
                </div>
                {!isEditing ? (
                    <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                        <Edit2 size={15} style={{ marginRight: '0.375rem' }} /> Edit
                    </Button>
                ) : (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Button variant="ghost" size="sm" onClick={handleCancel}><X size={15} /></Button>
                        <Button size="sm" onClick={handleSave} disabled={isSaving}>
                            <Check size={15} style={{ marginRight: '0.375rem' }} />
                            {isSaving ? 'Saving...' : 'Save All'}
                        </Button>
                    </div>
                )}
            </div>

            {/* ── Profile Tabs ──────────────────────────────────── */}
            <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '1.25rem', alignItems: 'center' }}>
                {profileNames.map(name => (
                    <div key={name} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <button
                            onClick={() => setActiveProfile(name)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.375rem',
                                padding: '0.375rem 0.75rem',
                                borderRadius: 'var(--radius-md)',
                                border: `2px solid ${activeProfile === name ? 'var(--primary)' : 'var(--border)'}`,
                                background: activeProfile === name ? 'var(--primary-light)' : 'var(--bg-body)',
                                color: activeProfile === name ? 'var(--primary)' : 'var(--text-dark)',
                                cursor: 'pointer',
                                fontWeight: activeProfile === name ? 700 : 500,
                                fontSize: '0.8rem',
                                transition: 'all 0.2s',
                                paddingRight: isEditing && profileNames.length > 1 ? '1.75rem' : '0.75rem'
                            }}
                        >
                            <User size={13} />
                            {name}
                            <span style={{
                                marginLeft: '0.125rem',
                                fontSize: '0.65rem',
                                background: activeProfile === name ? 'var(--primary)' : 'var(--border)',
                                color: activeProfile === name ? '#fff' : 'var(--text-light)',
                                borderRadius: '999px',
                                padding: '0.05rem 0.375rem',
                                fontWeight: 700
                            }}>
                                {Object.keys(profiles[name] || {}).length}
                            </span>
                        </button>
                        {isEditing && profileNames.length > 1 && (
                            <button
                                onClick={() => handleDeleteProfile(name)}
                                style={{
                                    position: 'absolute',
                                    right: '0.25rem',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'var(--error)',
                                    padding: '0.125rem',
                                    opacity: 0.6,
                                    lineHeight: 1
                                }}
                                title={`Delete ${name} profile`}
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>
                ))}

                {/* Add Profile Button */}
                {isEditing && !showAddProfile && (
                    <button
                        onClick={() => setShowAddProfile(true)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.375rem',
                            padding: '0.375rem 0.625rem',
                            borderRadius: 'var(--radius-md)',
                            border: '2px dashed var(--border)',
                            background: 'transparent',
                            color: 'var(--primary)',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '0.8rem'
                        }}
                    >
                        <UserPlus size={13} /> Add Person
                    </button>
                )}

                {isEditing && showAddProfile && (
                    <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                        <Input
                            placeholder="e.g. Son, Wife, Friend"
                            value={newProfileName}
                            onChange={e => setNewProfileName(e.target.value)}
                            onKeyPress={e => e.key === 'Enter' && handleAddProfile()}
                            style={{ padding: '0.375rem 0.625rem', fontSize: '0.8rem', width: '160px' }}
                        />
                        <Button size="sm" onClick={handleAddProfile} disabled={!newProfileName.trim()}>
                            <Check size={14} />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setShowAddProfile(false); setNewProfileName(''); }}>
                            <X size={14} />
                        </Button>
                    </div>
                )}
            </div>

            {/* ── No profiles at all ───────────────────────────── */}
            {profileNames.length === 0 && !isEditing && (
                <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-light)' }}>
                    <p style={{ fontSize: '0.875rem' }}>No measurements recorded. Click Edit to add measurements.</p>
                </div>
            )}

            {/* ── If editing and no active profile yet, create "Self" ── */}
            {isEditing && profileNames.length === 0 && (
                <div style={{ marginBottom: '1rem' }}>
                    <Button size="sm" onClick={() => {
                        setProfiles({ Self: {} });
                        setActiveProfile('Self');
                    }}>
                        <Plus size={14} /> Start with "Self"
                    </Button>
                </div>
            )}

            {/* ── Add Measurement Row (editing mode) ───────────── */}
            {isEditing && profileNames.length > 0 && (
                <div style={{
                    display: 'flex', gap: '0.75rem', marginBottom: '1.25rem',
                    background: 'var(--bg-body)', padding: '0.875rem', borderRadius: 'var(--radius-md)',
                    alignItems: 'flex-end'
                }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', display: 'block', marginBottom: '0.25rem', textTransform: 'uppercase' }}>
                            Label
                        </label>
                        <Input
                            placeholder="e.g. Chest, Waist, Shoulder"
                            value={newKey}
                            onChange={e => setNewKey(e.target.value)}
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', display: 'block', marginBottom: '0.25rem', textTransform: 'uppercase' }}>
                            Value
                        </label>
                        <Input
                            placeholder="e.g. 42in, 36cm"
                            value={newValue}
                            onChange={e => setNewValue(e.target.value)}
                            onKeyPress={e => e.key === 'Enter' && handleAddField()}
                        />
                    </div>
                    <Button onClick={handleAddField}><Plus size={16} /> Add</Button>
                </div>
            )}

            {/* ── Measurements Grid for Active Profile ─────────── */}
            {profileNames.length > 0 && (
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeProfile}
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{ duration: 0.15 }}
                    >
                        {Object.keys(activeMeasurements).length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--text-light)' }}>
                                <p style={{ fontSize: '0.875rem' }}>
                                    No measurements for <strong>{activeProfile}</strong> yet.
                                    {isEditing ? ' Use the form above to add.' : ' Click Edit to add.'}
                                </p>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
                                <AnimatePresence>
                                    {Object.entries(activeMeasurements).map(([key, value]) => (
                                        <motion.div
                                            key={key}
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.9 }}
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                padding: '0.75rem 1rem',
                                                background: 'var(--bg-body)',
                                                border: '1px solid var(--border-light)',
                                                borderRadius: 'var(--radius-md)'
                                            }}
                                        >
                                            <div>
                                                <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-light)', fontWeight: 700, textTransform: 'uppercase' }}>
                                                    {key}
                                                </span>
                                                <span style={{ fontSize: '1rem', color: 'var(--text-dark)', fontWeight: 600 }}>
                                                    {value}
                                                </span>
                                            </div>
                                            {isEditing && (
                                                <button
                                                    onClick={() => handleRemoveField(key)}
                                                    style={{
                                                        background: 'none', border: 'none', color: 'var(--error)',
                                                        cursor: 'pointer', padding: '0.25rem', opacity: 0.6,
                                                        transition: 'opacity 0.2s'
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                                    onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            )}
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            )}
        </div>
    );
};
