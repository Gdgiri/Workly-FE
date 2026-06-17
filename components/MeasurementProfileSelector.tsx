import React, { useState } from 'react';
import { ChevronDown, Plus, User, X, Check } from 'lucide-react';
import { Button, Input } from './UI';
import { motion, AnimatePresence } from 'framer-motion';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export type MeasurementsData = Record<string, string>;

// Handles both old flat format { chest: "42in" }
// and new multi-profile format { Self: { chest: "42in" }, Son: { ... } }
export type MeasurementProfilesMap = Record<string, MeasurementsData>;

/** Parse whatever is stored in customer.measurements into a profile map */
export function parseMeasurementsToProfiles(raw: any): MeasurementProfilesMap {
    if (typeof raw === 'string') {
        try {
            raw = JSON.parse(raw);
        } catch (e) {
            return {};
        }
    }
    if (!raw || typeof raw !== 'object') return {};

    // Detect flat format: all values are strings
    const values = Object.values(raw);
    const isFlat = values.length > 0 && values.every(v => typeof v === 'string');

    if (isFlat) {
        return { Self: raw as MeasurementsData };
    }

    // Already in multi-profile format — filter out any non-object entries
    const profiles: MeasurementProfilesMap = {};
    for (const [key, val] of Object.entries(raw)) {
        if (val && typeof val === 'object' && !Array.isArray(val)) {
            profiles[key] = val as MeasurementsData;
        }
    }
    return profiles;
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────
interface MeasurementProfileSelectorProps {
    /** Raw customer.measurements value (flat or multi-profile) */
    customerMeasurements: any;
    /** Called when user selects / creates a profile — returns { profileName, measurements } */
    onSelect: (profileName: string, measurements: MeasurementsData) => void;
    /** Currently selected profile name (for controlled highlighting) */
    selectedProfileName?: string;
    /** Placeholder text shown on the button when nothing selected */
    placeholder?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export const MeasurementProfileSelector: React.FC<MeasurementProfileSelectorProps> = ({
    customerMeasurements,
    onSelect,
    selectedProfileName,
    placeholder = 'Select who this garment is for...'
}) => {
    const profiles = parseMeasurementsToProfiles(customerMeasurements);
    const profileNames = Object.keys(profiles);

    const [open, setOpen] = useState(false);
    const [showNewForm, setShowNewForm] = useState(false);
    const [newProfileName, setNewProfileName] = useState('');
    const [newMeasurements, setNewMeasurements] = useState<{ key: string; value: string }[]>([
        { key: '', value: '' }
    ]);

    const handleSelectExisting = (name: string) => {
        onSelect(name, profiles[name]);
        setOpen(false);
    };

    const handleAddNew = () => {
        if (!newProfileName.trim()) return;
        const measurementMap: MeasurementsData = {};
        newMeasurements.forEach(({ key, value }) => {
            if (key.trim() && value.trim()) {
                measurementMap[key.trim()] = value.trim();
            }
        });
        onSelect(newProfileName.trim(), measurementMap);
        setOpen(false);
        setShowNewForm(false);
        setNewProfileName('');
        setNewMeasurements([{ key: '', value: '' }]);
    };

    const selectedMeasurements = selectedProfileName ? profiles[selectedProfileName] : null;

    return (
        <div style={{ position: 'relative' }}>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.625rem 0.75rem',
                    border: `2px solid ${selectedProfileName ? 'var(--primary)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-md)',
                    background: selectedProfileName ? 'var(--primary-light)' : 'var(--bg-body)',
                    color: selectedProfileName ? 'var(--primary)' : 'var(--text-light)',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: selectedProfileName ? 600 : 400,
                    transition: 'all 0.2s'
                }}
            >
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <User size={15} />
                    {selectedProfileName
                        ? `${selectedProfileName} (${selectedMeasurements ? Object.keys(selectedMeasurements).length : 0} fields)`
                        : placeholder}
                </span>
                <ChevronDown size={15} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>

            {/* Dropdown Panel */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        style={{
                            position: 'absolute',
                            top: 'calc(100% + 4px)',
                            left: 0,
                            right: 0,
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-lg)',
                            boxShadow: 'var(--shadow-lg)',
                            zIndex: 200,
                            overflow: 'hidden'
                        }}
                    >
                        {/* Existing Profiles */}
                        {profileNames.length > 0 && (
                            <div style={{ padding: '0.5rem' }}>
                                <p style={{ margin: '0 0 0.375rem 0.5rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>
                                    Saved Profiles
                                </p>
                                {profileNames.map(name => {
                                    const m = profiles[name];
                                    const summary = Object.entries(m).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(' · ');
                                    return (
                                        <button
                                            key={name}
                                            type="button"
                                            onClick={() => handleSelectExisting(name)}
                                            style={{
                                                width: '100%',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'flex-start',
                                                padding: '0.625rem 0.75rem',
                                                borderRadius: 'var(--radius-md)',
                                                border: 'none',
                                                background: selectedProfileName === name ? 'var(--primary-light)' : 'transparent',
                                                cursor: 'pointer',
                                                transition: 'background 0.15s',
                                                textAlign: 'left'
                                            }}
                                            onMouseEnter={e => { if (selectedProfileName !== name) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                            onMouseLeave={e => { if (selectedProfileName !== name) e.currentTarget.style.background = 'transparent'; }}
                                        >
                                            <span style={{ fontWeight: 600, fontSize: '0.875rem', color: selectedProfileName === name ? 'var(--primary)' : 'var(--text-dark)' }}>
                                                {selectedProfileName === name && <Check size={12} style={{ marginRight: '0.25rem', display: 'inline' }} />}
                                                {name}
                                            </span>
                                            {summary && (
                                                <span style={{ fontSize: '0.7rem', color: 'var(--text-light)', marginTop: '0.125rem' }}>
                                                    {summary}{Object.keys(m).length > 3 ? ` +${Object.keys(m).length - 3} more` : ''}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Divider */}
                        {profileNames.length > 0 && (
                            <div style={{ height: '1px', background: 'var(--border)', margin: '0 0.5rem' }} />
                        )}

                        {/* Add New Profile */}
                        {!showNewForm ? (
                            <button
                                type="button"
                                onClick={() => setShowNewForm(true)}
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.75rem',
                                    border: 'none',
                                    background: 'transparent',
                                    color: 'var(--primary)',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: '0.875rem'
                                }}
                            >
                                <Plus size={15} /> Enter new measurements...
                            </button>
                        ) : (
                            <div style={{ padding: '0.75rem' }}>
                                <p style={{ margin: '0 0 0.5rem', fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-dark)' }}>New Profile</p>
                                <Input
                                    placeholder="Person name (e.g. Son - Raju, Wife)"
                                    value={newProfileName}
                                    onChange={e => setNewProfileName(e.target.value)}
                                    style={{ marginBottom: '0.5rem' }}
                                />
                                <p style={{ margin: '0.5rem 0 0.375rem', fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: 600 }}>Measurements</p>
                                {newMeasurements.map((m, idx) => (
                                    <div key={idx} style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.375rem', alignItems: 'center' }}>
                                        <Input
                                            placeholder="Label (e.g. Chest)"
                                            value={m.key}
                                            onChange={e => {
                                                const updated = [...newMeasurements];
                                                updated[idx].key = e.target.value;
                                                setNewMeasurements(updated);
                                            }}
                                            style={{ flex: 1 }}
                                        />
                                        <Input
                                            placeholder="Value (e.g. 38in)"
                                            value={m.value}
                                            onChange={e => {
                                                const updated = [...newMeasurements];
                                                updated[idx].value = e.target.value;
                                                setNewMeasurements(updated);
                                            }}
                                            onKeyPress={e => {
                                                if (e.key === 'Enter') {
                                                    setNewMeasurements(prev => [...prev, { key: '', value: '' }]);
                                                }
                                            }}
                                            style={{ flex: 1 }}
                                        />
                                        {newMeasurements.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => setNewMeasurements(prev => prev.filter((_, i) => i !== idx))}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', padding: '0.25rem', flexShrink: 0 }}
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => setNewMeasurements(prev => [...prev, { key: '', value: '' }])}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 600, padding: '0.25rem 0', marginBottom: '0.5rem' }}
                                >
                                    + Add field (or press Enter)
                                </button>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <Button type="button" size="sm" onClick={handleAddNew} disabled={!newProfileName.trim()}>
                                        <Check size={14} /> Use These
                                    </Button>
                                    <Button type="button" size="sm" variant="ghost" onClick={() => setShowNewForm(false)}>
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
