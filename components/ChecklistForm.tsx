import React, { useState, useEffect } from 'react';
import {
    CheckCircle,
    XCircle,
    AlertCircle,
    Camera,
    FileText,
    ChevronDown,
    Save,
    Loader2,
    ClipboardList
} from 'lucide-react';
import { Button, Input } from './UI';
import api from '../utils/api';
import { useToast } from './ToastContext';

interface ChecklistFormProps {
    templateId: string;
    appointmentId: string;
    onSuccess?: () => void;
    readOnly?: boolean;
}

const ChecklistForm: React.FC<ChecklistFormProps> = ({
    templateId,
    appointmentId,
    onSuccess,
    readOnly = false
}) => {
    const { showToast } = useToast();
    const [template, setTemplate] = useState<any>(null);
    const [responses, setResponses] = useState<any>({});
    const [remarks, setRemarks] = useState<any>({});
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [existingSubmission, setExistingSubmission] = useState<any>(null);

    useEffect(() => {
        fetchData();
    }, [templateId, appointmentId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch template
            const templateRes = await api.get(`/checklists/templates/${templateId}`);
            // Important: Backend uses 'fields' not 'items', and 'name' not 'title'
            const templateData = templateRes.data.data;
            setTemplate(templateData);

            // 2. Check for existing submission (nested try to handle 404 gracefully)
            try {
                console.log('🔍 Checking for submission - Appointment:', appointmentId);
                const submissionRes = await api.get(`/checklists/submission/appointment/${appointmentId}`);
                if (submissionRes.data && submissionRes.data.data) {
                    const submission = submissionRes.data.data;
                    console.log('✅ Submission found:', submission.id);
                    setExistingSubmission(submission);
                    setResponses(submission.data || {});
                    setRemarks(submission.remarks || {});
                } else {
                    console.log('ℹ️ No submission data in response');
                }
            } catch (subError: any) {
                // 404 is expected if they haven't filled it yet
                if (subError.response?.status === 404) {
                    console.log('ℹ️ No existing submission found (404)');
                } else {
                    console.warn('⚠️ Optional submission fetch failed:', subError);
                }
            }
        } catch (error) {
            console.error('Failed to fetch checklist template:', error);
            showToast('Failed to load checklist template', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (itemId: string, value: any) => {
        if (readOnly) return;
        setResponses((prev: any) => ({
            ...prev,
            [itemId]: value
        }));
    };

    const handleRemarkChange = (itemId: string, value: string) => {
        if (readOnly) return;
        setRemarks((prev: any) => ({
            ...prev,
            [itemId]: value
        }));
    };

    const handleSubmit = async () => {
        if (readOnly) return;

        // Basic validation
        const items = template.fields || template.items || [];
        const missingFields = items
            .filter((item: any) => item.mandatory && !responses[item.id])
            .map((item: any) => item.label);

        if (missingFields.length > 0) {
            showToast(`Please complete mandatory fields: ${missingFields[0]}`, 'error');
            return;
        }

        setSubmitting(true);
        try {
            await api.post('/checklists/submit', {
                appointmentId,
                templateId,
                data: responses,
                remarks: remarks,
                severityScore: 0 // Logic for severity can be added later
            });
            showToast('Checklist submitted successfully', 'success');
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error('Failed to submit checklist:', error);
            showToast('Failed to submit checklist', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                <Loader2 className="animate-spin" size={32} color="var(--primary)" />
            </div>
        );
    }

    const items = template?.fields || template?.items || [];

    if (readOnly && !existingSubmission) {
        return (
            <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: '#F8FAFC', borderRadius: '1rem', border: '2px dashed #E2E8F0' }}>
                <AlertCircle size={40} color="#94A3B8" style={{ margin: '0 auto 1rem' }} />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#475569' }}>Checklist Not Found</h3>
                <p style={{ color: '#64748B', marginTop: '0.5rem' }}>No checklist was submitted for this service.</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Glassmorphism Header */}
            <div style={{
                position: 'relative',
                padding: '1.5rem',
                background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                borderRadius: '1.25rem',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
                overflow: 'hidden'
            }}>
                <div style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    padding: '0.5rem 1rem',
                    background: existingSubmission ? '#dcfce7' : '#dbeafe',
                    color: existingSubmission ? '#166534' : '#1e40af',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    borderRadius: '0 0 0 1rem',
                    borderLeft: '1px solid rgba(0,0,0,0.05)',
                    borderBottom: '1px solid rgba(0,0,0,0.05)'
                }}>
                    {existingSubmission ? 'Completed' : 'Draft'}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        background: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        boxShadow: '0 8px 16px -4px rgba(var(--primary-rgb), 0.3)'
                    }}>
                        <ClipboardList size={24} />
                    </div>
                    <div>
                        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
                            {template?.name || template?.title || 'Checklist'}
                        </h2>
                        {template?.description && (
                            <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem', fontWeight: 500 }}>
                                {template.description}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Questions Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {items.map((item: any, index: number) => (
                    <div key={item.id} style={{
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem',
                        padding: '1.5rem',
                        backgroundColor: 'white',
                        borderRadius: '1.25rem',
                        border: '1px solid',
                        borderColor: responses[item.id] ? 'rgba(var(--primary-rgb), 0.15)' : '#e2e8f0',
                        boxShadow: responses[item.id] ? '0 10px 15px -3px rgba(var(--primary-rgb), 0.05)' : '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}>
                        {/* Selected Indicator Dot */}
                        {responses[item.id] && (
                            <div style={{
                                position: 'absolute',
                                top: '1.5rem',
                                left: '-4px',
                                width: '4px',
                                height: '24px',
                                background: 'var(--primary)',
                                borderRadius: '0 4px 4px 0'
                            }} />
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <span style={{
                                    fontSize: '0.875rem',
                                    fontWeight: 700,
                                    color: 'var(--primary)',
                                    background: 'rgba(var(--primary-rgb), 0.1)',
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    {index + 1}
                                </span>
                                <div>
                                    <label style={{ fontWeight: 700, color: '#1e293b', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        {item.label}
                                        {item.mandatory && <span style={{ color: '#ef4444' }}>*</span>}
                                    </label>
                                    {item.helperText && (
                                        <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem', fontWeight: 500 }}>
                                            {item.helperText}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: '0.25rem' }}>
                            {/* Short Text */}
                            {item.type === 'short_text' && (
                                <input
                                    type="text"
                                    disabled={readOnly}
                                    value={responses[item.id] || ''}
                                    onChange={(e) => handleInputChange(item.id, e.target.value)}
                                    placeholder="Type answer here..."
                                    style={{
                                        width: '100%',
                                        padding: '0.875rem 1rem',
                                        border: '1.5px solid #e2e8f0',
                                        borderRadius: '0.75rem',
                                        fontSize: '0.925rem',
                                        background: readOnly ? '#f8fafc' : 'white',
                                        transition: 'all 0.2s',
                                        outline: 'none'
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                                />
                            )}

                            {/* Long Text */}
                            {item.type === 'long_text' && (
                                <textarea
                                    disabled={readOnly}
                                    value={responses[item.id] || ''}
                                    onChange={(e) => handleInputChange(item.id, e.target.value)}
                                    placeholder="Enter detailed description..."
                                    rows={3}
                                    style={{
                                        width: '100%',
                                        padding: '0.875rem 1rem',
                                        border: '1.5px solid #e2e8f0',
                                        borderRadius: '0.75rem',
                                        fontSize: '0.925rem',
                                        background: readOnly ? '#f8fafc' : 'white',
                                        transition: 'all 0.2s',
                                        outline: 'none',
                                        resize: 'vertical'
                                    }}
                                />
                            )}

                            {/* Yes/No with Premium Toggles */}
                            {item.type === 'yes_no' && (
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    {['Yes', 'No'].map(val => (
                                        <button
                                            key={val}
                                            type="button"
                                            disabled={readOnly}
                                            onClick={() => handleInputChange(item.id, val)}
                                            style={{
                                                flex: 1,
                                                padding: '0.875rem',
                                                borderRadius: '0.75rem',
                                                border: '2px solid',
                                                borderColor: responses[item.id] === val ? 'var(--primary)' : '#f1f5f9',
                                                backgroundColor: responses[item.id] === val ? '#f1f5fe' : '#f8fafc',
                                                color: responses[item.id] === val ? 'var(--primary)' : '#64748b',
                                                fontWeight: 700,
                                                cursor: readOnly ? 'default' : 'pointer',
                                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                                transform: responses[item.id] === val ? 'scale(1.02)' : 'scale(1)'
                                            }}
                                        >
                                            {val}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Pass/Fail/NA with High Contrast Indicators */}
                            {item.type === 'pass_fail' && (
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    {[
                                        { label: 'Pass', color: '#10b981', bgColor: '#ecfdf5', icon: <CheckCircle size={18} /> },
                                        { label: 'Fail', color: '#ef4444', bgColor: '#fef2f2', icon: <XCircle size={18} /> },
                                        { label: 'N/A', color: '#64748b', bgColor: '#f8fafc', icon: <AlertCircle size={18} /> }
                                    ].map(opt => (
                                        <button
                                            key={opt.label}
                                            type="button"
                                            disabled={readOnly}
                                            onClick={() => handleInputChange(item.id, opt.label)}
                                            style={{
                                                flex: 1,
                                                padding: '0.875rem',
                                                borderRadius: '0.75rem',
                                                border: '2px solid',
                                                borderColor: responses[item.id] === opt.label ? opt.color : '#f1f5f9',
                                                backgroundColor: responses[item.id] === opt.label ? opt.bgColor : '#f8fafc',
                                                color: responses[item.id] === opt.label ? opt.color : '#64748b',
                                                fontWeight: 700,
                                                cursor: readOnly ? 'default' : 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '0.625rem',
                                                transition: 'all 0.2s ease-out',
                                                transform: responses[item.id] === opt.label ? 'translateY(-2px)' : 'translateY(0)',
                                                boxShadow: responses[item.id] === opt.label ? `0 4px 12px ${opt.color}20` : 'none'
                                            }}
                                        >
                                            {React.cloneElement(opt.icon as any, { size: 20 })}
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Dropdown with Modern Styling */}
                            {item.type === 'dropdown' && (
                                <div style={{ position: 'relative' }}>
                                    <select
                                        disabled={readOnly}
                                        value={responses[item.id] || ''}
                                        onChange={(e) => handleInputChange(item.id, e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '0.875rem 1rem',
                                            border: '1.5px solid #e2e8f0',
                                            borderRadius: '0.75rem',
                                            fontSize: '0.925rem',
                                            background: readOnly ? '#f8fafc' : 'white',
                                            appearance: 'none',
                                            outline: 'none',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <option value="">Choose an option...</option>
                                        {item.options?.map((opt: string) => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={18} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#94a3b8' }} />
                                </div>
                            )}
                        </div>

                        {/* Remarks Section - Only shows when needed or when viewing history */}
                        {((item.type === 'pass_fail' && responses[item.id] === 'Fail') || item.requireRemarks || (remarks[item.id] && readOnly)) && (
                            <div style={{
                                marginTop: '0.5rem',
                                padding: '1rem',
                                background: '#fffbeb',
                                borderRadius: '0.75rem',
                                border: '1px solid #fef3c7'
                            }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.7rem', fontWeight: 800, color: '#92400e', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                                    <FileText size={14} /> Remarks
                                </label>
                                <textarea
                                    disabled={readOnly}
                                    value={remarks[item.id] || ''}
                                    onChange={(e) => handleRemarkChange(item.id, e.target.value)}
                                    placeholder="Provide context for this selection..."
                                    rows={2}
                                    style={{
                                        width: '100%',
                                        padding: '0.625rem 0.75rem',
                                        border: '1px solid #fde68a',
                                        background: readOnly ? 'rgba(255,255,255,0.5)' : 'white',
                                        borderRadius: '0.5rem',
                                        fontSize: '0.875rem',
                                        color: '#78350f',
                                        outline: 'none'
                                    }}
                                />
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Sticky Save Bar (only when filling) */}
            {!readOnly && (
                <div style={{
                    marginTop: '2.5rem',
                    padding: '1.5rem',
                    background: '#ffffff',
                    borderRadius: '1.25rem',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 -10px 25px -5px rgba(0,0,0,0.03)'
                }}>
                    <div style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: 500 }}>
                        {Object.keys(responses).length} of {items.length} questions answered
                    </div>
                    <Button
                        onClick={handleSubmit}
                        isLoading={submitting}
                        icon={<Save size={20} />}
                        style={{
                            height: '48px',
                            minWidth: '200px',
                            borderRadius: '0.75rem',
                            fontSize: '1rem',
                            fontWeight: 700,
                            boxShadow: '0 8px 20px -4px rgba(var(--primary-rgb), 0.4)'
                        }}
                    >
                        {existingSubmission ? 'Save Progress' : 'Finalize Checklist'}
                    </Button>
                </div>
            )}
        </div>
    );
};

export default ChecklistForm;
