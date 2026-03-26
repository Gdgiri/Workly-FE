import React, { useState } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
    AlignLeft, AlignJustify, CheckSquare, CheckCircle,
    Hash, ChevronDown, Upload, Type, ArrowDown,
    Copy, Trash2, Camera, AlertTriangle, MessageSquare, LayoutTemplate, Minus,
    Calendar, CircleDot, ListChecks, PenTool, Eye, Save, X, GripVertical
} from 'lucide-react';
import { Button } from '../components/UI';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';

type QuestionType = 'short_text' | 'long_text' | 'yes_no' | 'pass_fail' | 'number' | 'dropdown' | 'file_upload' | 'section_header' | 'divider' | 'multiple_choice' | 'single_choice' | 'date' | 'signature' | 'info_text' | 'spacer';

interface ChecklistItem {
    id: string;
    type: QuestionType;
    label: string;
    helperText: string;
    mandatory: boolean;
    photoRequired: boolean;
    trackSeverity: boolean;
    requireRemarks: boolean;
    options?: string[];
}

const QUESTION_TYPES: { value: QuestionType; label: string; icon: React.ReactNode }[] = [
    { value: 'short_text', label: 'Short answer', icon: <AlignLeft size={16} /> },
    { value: 'long_text', label: 'Paragraph', icon: <AlignJustify size={16} /> },
    { value: 'multiple_choice', label: 'Multiple choice', icon: <ListChecks size={16} /> },
    { value: 'single_choice', label: 'Single choice', icon: <CircleDot size={16} /> },
    { value: 'dropdown', label: 'Dropdown', icon: <ChevronDown size={16} /> },
    { value: 'yes_no', label: 'Yes / No', icon: <CheckSquare size={16} /> },
    { value: 'pass_fail', label: 'Pass / Fail', icon: <CheckCircle size={16} /> },
    { value: 'file_upload', label: 'File upload', icon: <Upload size={16} /> },
    { value: 'date', label: 'Date', icon: <Calendar size={16} /> },
    { value: 'signature', label: 'Signature', icon: <PenTool size={16} /> },
    { value: 'section_header', label: 'Section Header', icon: <LayoutTemplate size={16} /> },
    { value: 'divider', label: 'Divider', icon: <Minus size={16} /> },
];

export const ChecklistBuilder: React.FC = () => {
    const { appId, businessName } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const editId = searchParams.get('id');

    const [loading, setLoading] = React.useState(!!editId);
    const [title, setTitle] = useState('New Service Checklist');
    const [description, setDescription] = useState('');
    const [items, setItems] = useState<ChecklistItem[]>([
        {
            id: '1',
            type: 'short_text',
            label: 'Technician Name',
            helperText: 'Enter your full name.',
            mandatory: true,
            photoRequired: false,
            trackSeverity: false,
            requireRemarks: false
        }
    ]);
    const [selectedId, setSelectedId] = useState<string | null>('1');
    const [showPreview, setShowPreview] = useState(false);
    const [services, setServices] = useState<any[]>([]);
    const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);

    React.useEffect(() => {
        const fetchServices = async () => {
            try {
                const response = await api.get('/services');
                console.log('Services fetched:', response.data);
                // The service controller returns the array directly
                const servicesData = Array.isArray(response.data) ? response.data : response.data.data;
                setServices(servicesData || []);
            } catch (error) {
                console.error('Failed to fetch services:', error);
            }
        };
        fetchServices();
    }, []);

    React.useEffect(() => {
        if (editId) {
            const fetchTemplate = async () => {
                try {
                    const response = await api.get(`/checklists/templates/${editId}`);
                    const current = response.data.data;
                    if (current) {
                        setTitle(current.name);
                        setDescription(current.description || '');
                        setItems(current.fields || []);
                        setSelectedServiceIds(current.services?.map((s: any) => s.id) || []);
                        if (current.fields?.length > 0) setSelectedId(current.fields[0].id);
                    }
                } catch (error: any) {
                    console.error('Failed to fetch template:', error);
                    alert('Error: ' + (error.response?.data?.error || error.message));
                } finally {
                    setLoading(false);
                }
            };
            fetchTemplate();
        }
    }, [editId]);

    const handleSave = async () => {
        try {
            const payload = {
                name: title,
                description,
                fields: items,
                isActive: true
            };

            let savedId = editId;
            if (editId) {
                await api.patch(`/checklists/templates/${editId}`, payload);
            } else {
                const response = await api.post('/checklists/templates', payload);
                savedId = response.data.data.id;
            }

            // Sync Service attachments
            // 1. Detach from all first (simple/naive approach for now) or just update the ones in selected list
            // For now, let's just loop and update
            await Promise.all(services.map(async (service) => {
                const isSelected = selectedServiceIds.includes(service.id);
                const currentTemplateId = service.checklistTemplateId;

                if (isSelected && currentTemplateId !== savedId) {
                    await api.post('/checklists/attach', { serviceId: service.id, templateId: savedId });
                } else if (!isSelected && currentTemplateId === savedId) {
                    await api.post('/checklists/attach', { serviceId: service.id, templateId: null });
                }
            }));

            navigate(`/${appId}/${businessName}/checklist`);
        } catch (error) {
            console.error('Failed to save checklist:', error);
            alert('Failed to save checklist');
        }
    };

    const selectedItem = items.find(i => i.id === selectedId);

    const generateId = () => Math.random().toString(36).substring(2, 9);

    const handleAddItem = (type: QuestionType) => {
        const newItem: ChecklistItem = {
            id: generateId(),
            type,
            label: 'New Question',
            helperText: '',
            mandatory: false,
            photoRequired: false,
            trackSeverity: false,
            requireRemarks: false,
            ...(type === 'dropdown' || type === 'multiple_choice' || type === 'single_choice' ? { options: ['Option 1', 'Option 2'] } : {})
        };
        setItems([...items, newItem]);
        setSelectedId(newItem.id);
    };

    const handleDeleteItem = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setItems(items.filter(i => i.id !== id));
        if (selectedId === id) setSelectedId(null);
    };

    const handleCopyItem = (item: ChecklistItem, e: React.MouseEvent) => {
        e.stopPropagation();
        const index = items.findIndex(i => i.id === item.id);
        const newItem = { ...item, id: generateId() };
        const newItems = [...items];
        newItems.splice(index + 1, 0, newItem);
        setItems(newItems);
        setSelectedId(newItem.id);
    };


    const handleUpdateItem = (id: string, updates: Partial<ChecklistItem>) => {
        setItems(items.map(i => i.id === id ? { ...i, ...updates } : i));
    };

    const getIconForType = (type: QuestionType) => {
        switch (type) {
            case 'short_text': return <AlignLeft size={16} />;
            case 'long_text': return <AlignJustify size={16} />;
            case 'yes_no': return <CheckCircle size={16} />;
            case 'pass_fail': return <CheckSquare size={16} />;
            case 'number': return <Hash size={16} />;
            case 'dropdown': return <ChevronDown size={16} />;
            case 'file_upload': return <Upload size={16} />;
            case 'multiple_choice': return <ListChecks size={16} />;
            case 'single_choice': return <CircleDot size={16} />;
            case 'date': return <Calendar size={16} />;
            case 'signature': return <PenTool size={16} />;
            case 'section_header': return <LayoutTemplate size={16} />;
            case 'divider': return <Minus size={16} />;
            default: return <AlignLeft size={16} />;
        }
    };

    return (
        <div style={{
            display: 'flex',
            height: 'calc(100vh - 8rem)',
            background: '#F8FAFC',
            margin: '-1.5rem',
            overflow: 'hidden'
        }}>
            {/* Left Sidebar - Question Types */}
            <div style={{
                width: '240px',
                background: '#FFFFFF',
                borderRight: '1px solid #E2E8F0',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '2px 0 8px rgba(0,0,0,0.02)',
                zIndex: 10
            }}>
                <div style={{ padding: '1.5rem 1.25rem 1rem' }}>
                    <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.05em' }}>QUESTION TYPES</h3>
                </div>

                <div className="custom-scrollbar" style={{ padding: '0.5rem 1rem 2rem', overflowY: 'auto', flex: 1 }}>
                    <div style={{ fontSize: '0.675rem', fontWeight: 800, color: '#94A3B8', letterSpacing: '0.1em', marginBottom: '1rem', paddingLeft: '0.5rem' }}>BASIC FIELDS</div>
                    <DraggableItem icon={<AlignLeft size={16} color="#6366F1" />} label="Short Text" onClick={() => handleAddItem('short_text')} />
                    <DraggableItem icon={<AlignJustify size={16} color="#6366F1" />} label="Long Text" onClick={() => handleAddItem('long_text')} />
                    <DraggableItem icon={<Hash size={16} color="#6366F1" />} label="Number" onClick={() => handleAddItem('number')} />

                    <div style={{ fontSize: '0.675rem', fontWeight: 800, color: '#94A3B8', letterSpacing: '0.1em', margin: '2rem 0 1rem', paddingLeft: '0.5rem' }}>CHOICE FIELDS</div>
                    <DraggableItem icon={<ChevronDown size={16} color="#EC4899" />} label="Dropdown" onClick={() => handleAddItem('dropdown')} />
                    <DraggableItem icon={<ListChecks size={16} color="#EC4899" />} label="Multiple Choice" onClick={() => handleAddItem('multiple_choice')} />
                    <DraggableItem icon={<CircleDot size={16} color="#EC4899" />} label="Single Choice" onClick={() => handleAddItem('single_choice')} />
                    <DraggableItem icon={<CheckSquare size={16} color="#10B981" />} label="Yes / No" onClick={() => handleAddItem('yes_no')} />
                    <DraggableItem icon={<CheckCircle size={16} color="#10B981" />} label="Pass / Fail" onClick={() => handleAddItem('pass_fail')} />

                    <div style={{ fontSize: '0.675rem', fontWeight: 800, color: '#94A3B8', letterSpacing: '0.1em', margin: '2rem 0 1rem', paddingLeft: '0.5rem' }}>ADVANCED FIELDS</div>
                    <DraggableItem icon={<Upload size={16} color="#F59E0B" />} label="File Upload" onClick={() => handleAddItem('file_upload')} />
                    <DraggableItem icon={<Calendar size={16} color="#F59E0B" />} label="Date / Time" onClick={() => handleAddItem('date')} />
                    <DraggableItem icon={<PenTool size={16} color="#F59E0B" />} label="Signature" onClick={() => handleAddItem('signature')} />

                    <div style={{ fontSize: '0.675rem', fontWeight: 800, color: '#94A3B8', letterSpacing: '0.1em', margin: '2rem 0 1rem', paddingLeft: '0.5rem' }}>LAYOUT ELEMENTS</div>
                    <DraggableItem icon={<LayoutTemplate size={16} color="#64748B" />} label="Section Header" onClick={() => handleAddItem('section_header')} />
                    <DraggableItem icon={<MessageSquare size={16} color="#64748B" />} label="Info Text" onClick={() => handleAddItem('info_text')} />
                    <DraggableItem icon={<Minus size={16} color="#64748B" />} label="Divider" onClick={() => handleAddItem('divider')} />
                    <DraggableItem icon={<ArrowDown size={16} color="#64748B" />} label="Vertical Spacer" onClick={() => handleAddItem('spacer')} />
                </div>
            </div>

            {/* Middle Content - Builder Canvas */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '2rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                position: 'relative'
            }}>
                {/* Header with Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: showPreview ? '1400px' : '700px', marginBottom: '1.5rem', transition: 'max-width 0.3s' }}>
                    <div style={{ flex: 1, marginRight: '1rem' }}>
                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Checklist Title"
                            style={{
                                fontSize: '1.5rem',
                                fontWeight: 700,
                                color: '#1E293B',
                                border: 'none',
                                outline: 'none',
                                background: 'transparent',
                                width: '100%'
                            }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <Button
                            variant="outline"
                            onClick={() => navigate(`/${appId}/${businessName}/checklist`)}
                            size="sm"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant={showPreview ? 'primary' : 'outline'}
                            icon={<Eye size={16} />}
                            onClick={() => setShowPreview(!showPreview)}
                            size="sm"
                        >
                            {showPreview ? 'Hide Preview' : 'Show Preview'}
                        </Button>
                        <Button
                            variant="primary"
                            icon={<Save size={16} />}
                            onClick={handleSave}
                            size="sm"
                        >
                            Save Template
                        </Button>
                    </div>
                </div>

                <div style={{
                    display: 'flex',
                    width: '100%',
                    maxWidth: showPreview ? '1400px' : '700px',
                    gap: '2rem',
                    transition: 'all 0.3s ease-in-out'
                }}>
                    {/* BUILDER COLUMN */}
                    <div style={{ flex: 1, maxWidth: showPreview ? '50%' : '100%', transition: 'all 0.3s' }}>
                        <Reorder.Group axis="y" values={items} onReorder={setItems} style={{ listStyleType: 'none', padding: 0, margin: 0, width: '100%' }}>
                            <AnimatePresence>
                                {items.map((item, index) => {
                                    const isActive = selectedId === item.id;
                                    return (
                                        <Reorder.Item
                                            key={item.id}
                                            value={item}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            onClick={() => setSelectedId(item.id)}
                                            style={{
                                                background: '#FFFFFF',
                                                border: 'none',
                                                borderLeft: isActive ? '4px solid #4285F4' : '4px solid transparent',
                                                borderRadius: '0.5rem',
                                                padding: '1.5rem',
                                                paddingLeft: isActive ? 'calc(1.5rem - 4px)' : '1.5rem',
                                                marginBottom: '1.5rem',
                                                boxShadow: isActive ? '0 2px 12px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.06)',
                                                position: 'relative',
                                                cursor: 'default',
                                                transition: 'all 0.2s ease-in-out'
                                            }}
                                        >
                                            {/* Top Centered Drag Handle - Google Forms Style */}
                                            <div style={{
                                                position: 'absolute',
                                                top: '4px',
                                                left: '50%',
                                                transform: 'translateX(-50%)',
                                                cursor: 'grab',
                                                color: '#CBD5E1',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                padding: '4px 8px',
                                                zIndex: 20,
                                                opacity: isActive ? 1 : 0.4,
                                                transition: 'all 0.2s'
                                            }}
                                                onMouseEnter={(e) => e.currentTarget.style.color = '#94A3B8'}
                                                onMouseLeave={(e) => e.currentTarget.style.color = '#CBD5E1'}
                                            >
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 3px)', gap: '2px' }}>
                                                    {[...Array(6)].map((_, i) => (
                                                        <div key={i} style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'currentColor' }} />
                                                    ))}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                                <div style={{ flex: 1, marginRight: '1rem' }}>
                                                    {item.type !== 'divider' && (
                                                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem', width: '100%' }}>
                                                            <input
                                                                value={item.label}
                                                                onChange={(e) => handleUpdateItem(item.id, { label: e.target.value })}
                                                                placeholder="Question Title"
                                                                style={{
                                                                    fontSize: item.type === 'section_header' ? '1.25rem' : '1rem',
                                                                    fontWeight: 600,
                                                                    color: '#1E293B',
                                                                    border: 'none',
                                                                    borderBottom: isActive ? '1px solid #E2E8F0' : '1px solid transparent',
                                                                    outline: 'none',
                                                                    background: 'transparent',
                                                                    flex: 1,
                                                                    width: '100%',
                                                                    padding: '0.25rem 0',
                                                                    margin: 0,
                                                                    transition: 'border-bottom 0.2s ease-in-out'
                                                                }}
                                                                onFocus={(e) => e.target.style.borderBottom = '2px solid #4285F4'}
                                                                onBlur={(e) => e.target.style.borderBottom = isActive ? '1px solid #E2E8F0' : '1px solid transparent'}
                                                            />
                                                            {item.mandatory && item.type !== 'section_header' && <span style={{ color: '#EF4444', marginLeft: '0.25rem' }}>*</span>}
                                                        </div>
                                                    )}

                                                    {isActive && item.type !== 'divider' && (
                                                        <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', width: '200px' }}>
                                                            <div style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '0.5rem',
                                                                padding: '0.5rem 0.75rem',
                                                                border: '1px solid #E2E8F0',
                                                                borderRadius: '0.375rem',
                                                                background: '#FFFFFF',
                                                                cursor: 'pointer'
                                                            }}>
                                                                <div style={{ color: '#64748B', display: 'flex', alignItems: 'center' }}>
                                                                    {getIconForType(item.type)}
                                                                </div>
                                                                <select
                                                                    value={item.type}
                                                                    onChange={(e) => handleUpdateItem(item.id, { type: e.target.value as QuestionType })}
                                                                    style={{
                                                                        border: 'none',
                                                                        outline: 'none',
                                                                        background: 'transparent',
                                                                        fontSize: '0.875rem',
                                                                        color: '#1E293B',
                                                                        width: '100%',
                                                                        cursor: 'pointer'
                                                                    }}
                                                                >
                                                                    {QUESTION_TYPES.map(type => (
                                                                        <option key={type.value} value={type.value}>{type.label}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {item.type !== 'section_header' && item.type !== 'divider' && (
                                                        isActive ? (
                                                            <input
                                                                value={item.helperText || ''}
                                                                onChange={(e) => handleUpdateItem(item.id, { helperText: e.target.value })}
                                                                placeholder="Helper text or description (optional)"
                                                                style={{
                                                                    fontSize: '0.875rem',
                                                                    color: '#64748B',
                                                                    border: 'none',
                                                                    borderBottom: '1px solid transparent',
                                                                    outline: 'none',
                                                                    background: 'transparent',
                                                                    width: '100%',
                                                                    marginBottom: '1rem',
                                                                    padding: '0.25rem 0',
                                                                    transition: 'border-bottom 0.2s ease-in-out'
                                                                }}
                                                                onFocus={(e) => e.target.style.borderBottom = '2px solid #4285F4'}
                                                                onBlur={(e) => e.target.style.borderBottom = '1px solid transparent'}
                                                            />
                                                        ) : item.helperText && (
                                                            <div style={{ fontSize: '0.875rem', color: '#64748B', marginBottom: '1rem' }}>
                                                                {item.helperText}
                                                            </div>
                                                        )
                                                    )}
                                                </div>


                                            </div>

                                            {item.type === 'short_text' && (
                                                <div style={{ borderBottom: '1px dotted #CBD5E1', padding: '0.5rem 0', color: '#94A3B8', fontSize: '0.875rem', width: '50%', marginBottom: '1.5rem', opacity: isActive ? 1 : 0.6 }}>Short answer text</div>
                                            )}
                                            {item.type === 'long_text' && (
                                                <div style={{ borderBottom: '1px dotted #CBD5E1', padding: '0.5rem 0', color: '#94A3B8', fontSize: '0.875rem', width: '100%', marginBottom: '1.5rem', opacity: isActive ? 1 : 0.6 }}>Long answer text</div>
                                            )}

                                            {item.type === 'divider' && (
                                                <div style={{ padding: '0.5rem 0', width: '100%' }}>
                                                    <hr style={{ border: 'none', borderTop: '2px dashed #CBD5E1', width: '100%', margin: 0 }} />
                                                </div>
                                            )}

                                            {item.type === 'number' && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', opacity: isActive ? 1 : 0.6 }}>
                                                    <div style={{ borderBottom: '1px dotted #CBD5E1', padding: '0.5rem 0', color: '#94A3B8', fontSize: '0.875rem', width: '120px' }}>Number</div>
                                                    <span style={{ fontSize: '0.875rem', color: '#94A3B8', fontWeight: 500 }}>Units</span>
                                                </div>
                                            )}

                                            {(item.type === 'dropdown' || item.type === 'multiple_choice' || item.type === 'single_choice') && (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1.5rem', opacity: isActive ? 1 : 0.6 }}>
                                                    <Reorder.Group
                                                        axis="y"
                                                        values={item.options || []}
                                                        onReorder={(newOpts) => handleUpdateItem(item.id, { options: newOpts })}
                                                        style={{ listStyleType: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}
                                                    >
                                                        {item.options?.map((opt, idx) => (
                                                            <Reorder.Item
                                                                key={`${item.id}-opt-${idx}`}
                                                                value={opt}
                                                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1E293B', fontSize: '0.875rem' }}
                                                            >
                                                                {isActive && (
                                                                    <div style={{ cursor: 'grab', color: '#CBD5E1', display: 'flex', alignItems: 'center', margin: '0 0.25rem' }}>
                                                                        <GripVertical size={16} />
                                                                    </div>
                                                                )}
                                                                {item.type === 'multiple_choice' ? (
                                                                    <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: '2px solid #CBD5E1', flexShrink: 0 }}></div>
                                                                ) : item.type === 'single_choice' ? (
                                                                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid #CBD5E1', flexShrink: 0 }}></div>
                                                                ) : (
                                                                    <span style={{ color: '#94A3B8', minWidth: '1.25rem' }}>{idx + 1}.</span>
                                                                )}
                                                                {isActive ? (
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                                                                        <input
                                                                            value={opt}
                                                                            onChange={(e) => {
                                                                                const newOpts = [...(item.options || [])];
                                                                                newOpts[idx] = e.target.value;
                                                                                handleUpdateItem(item.id, { options: newOpts });
                                                                            }}
                                                                            placeholder={`Option ${idx + 1}`}
                                                                            style={{
                                                                                border: 'none',
                                                                                borderBottom: '1px solid #E2E8F0',
                                                                                outline: 'none',
                                                                                background: 'transparent',
                                                                                flex: 1,
                                                                                padding: '0.4rem 0',
                                                                                margin: 0,
                                                                                color: '#1E293B',
                                                                                fontSize: '0.875rem',
                                                                                transition: 'border-bottom 0.2s'
                                                                            }}
                                                                            onFocus={(e) => e.target.style.borderBottom = '2px solid #4285F4'}
                                                                            onBlur={(e) => e.target.style.borderBottom = '1px solid #E2E8F0'}
                                                                        />
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                const newOpts = item.options?.filter((_, i) => i !== idx);
                                                                                handleUpdateItem(item.id, { options: newOpts });
                                                                            }}
                                                                            style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '0.25rem' }}
                                                                        >
                                                                            <X size={16} />
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <span style={{ padding: '0.4rem 0' }}>{opt}</span>
                                                                )}
                                                            </Reorder.Item>
                                                        ))}
                                                    </Reorder.Group>

                                                    {isActive && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                                                            <div style={{ width: '16px', margin: '0 0.25rem' }}></div>
                                                            {item.type === 'multiple_choice' ? (
                                                                <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: '2px solid #CBD5E1', flexShrink: 0 }}></div>
                                                            ) : item.type === 'single_choice' ? (
                                                                <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid #CBD5E1', flexShrink: 0 }}></div>
                                                            ) : (
                                                                <span style={{ color: '#94A3B8', minWidth: '1.25rem' }}>{(item.options?.length || 0) + 1}.</span>
                                                            )}
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const newOpts = [...(item.options || []), `Option ${(item.options?.length || 0) + 1}`];
                                                                    handleUpdateItem(item.id, { options: newOpts });
                                                                }}
                                                                style={{
                                                                    background: 'none',
                                                                    border: 'none',
                                                                    color: '#4285F4',
                                                                    fontSize: '0.875rem',
                                                                    fontWeight: 500,
                                                                    cursor: 'pointer',
                                                                    padding: '0.4rem 0',
                                                                    textAlign: 'left'
                                                                }}
                                                            >
                                                                Add option
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {(item.type === 'yes_no') && (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem', opacity: isActive ? 1 : 0.6 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#1E293B', fontSize: '0.875rem' }}><div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid #CBD5E1' }}></div> Yes</div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#1E293B', fontSize: '0.875rem' }}><div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid #CBD5E1' }}></div> No</div>
                                                </div>
                                            )}
                                            {(item.type === 'pass_fail') && (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem', opacity: isActive ? 1 : 0.6 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#1E293B', fontSize: '0.875rem' }}><div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid #CBD5E1' }}></div> Pass</div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#1E293B', fontSize: '0.875rem' }}><div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid #CBD5E1' }}></div> Fail</div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#1E293B', fontSize: '0.875rem' }}><div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid #CBD5E1' }}></div> N/A</div>
                                                </div>
                                            )}
                                            {item.type === 'file_upload' && (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', border: '2px dashed #E2E8F0', borderRadius: '0.5rem', color: '#94A3B8', gap: '0.5rem' }}>
                                                    <Upload size={24} />
                                                    <span style={{ fontSize: '0.875rem' }}>Upload file</span>
                                                </div>
                                            )}

                                            {item.type === 'date' && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', opacity: isActive ? 1 : 0.6 }}>
                                                    <Calendar size={18} color="#94A3B8" />
                                                    <div style={{ borderBottom: '1px dotted #CBD5E1', padding: '0.5rem 0', color: '#94A3B8', fontSize: '0.875rem', width: '140px' }}>Select Date / Time</div>
                                                </div>
                                            )}

                                            {item.type === 'signature' && (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', border: '2px dashed #E2E8F0', borderRadius: '0.5rem', color: '#94A3B8', gap: '0.5rem', marginBottom: '1.5rem' }}>
                                                    <PenTool size={24} />
                                                    <span style={{ fontSize: '0.875rem' }}>Draw Signature</span>
                                                </div>
                                            )}

                                            {/* Tags */}
                                            {(item.photoRequired || item.trackSeverity || item.requireRemarks) && (
                                                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                                                    {item.photoRequired && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', fontWeight: 600, color: '#D97706', background: '#FEF3C7', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>
                                                            <Camera size={12} /> PHOTO REQUIRED
                                                        </div>
                                                    )}
                                                    {item.trackSeverity && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', fontWeight: 600, color: '#4F46E5', background: '#E0E7FF', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>
                                                            <AlertTriangle size={12} /> SEVERITY TRACKING
                                                        </div>
                                                    )}
                                                    {item.requireRemarks && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', fontWeight: 600, color: '#475569', background: '#F1F5F9', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>
                                                            <MessageSquare size={12} /> REMARKS ON FAIL
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Card Footer for Active Item - Repositioned Icons */}
                                            {isActive && (
                                                <div style={{
                                                    marginTop: '1.5rem',
                                                    paddingTop: '1rem',
                                                    borderTop: '1px solid #F1F5F9',
                                                    display: 'flex',
                                                    justifyContent: 'flex-end',
                                                    alignItems: 'center',
                                                    gap: '1rem'
                                                }}>
                                                    <div style={{ display: 'flex', gap: '0.5rem', borderRight: '1px solid #E2E8F0', paddingRight: '1rem' }}>
                                                        <button
                                                            onClick={(e) => handleCopyItem(item, e)}
                                                            title="Duplicate"
                                                            style={{
                                                                background: 'none',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                padding: '0.5rem',
                                                                color: '#64748B',
                                                                borderRadius: '0.375rem',
                                                                transition: 'background 0.2s'
                                                            }}
                                                            onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                                                            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                                        >
                                                            <Copy size={20} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleDeleteItem(item.id, e)}
                                                            title="Delete"
                                                            style={{
                                                                background: 'none',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                padding: '0.5rem',
                                                                color: '#64748B',
                                                                borderRadius: '0.375rem',
                                                                transition: 'background 0.2s'
                                                            }}
                                                            onMouseEnter={(e) => e.currentTarget.style.background = '#FEF2F2'}
                                                            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                                        >
                                                            <Trash2 size={20} />
                                                        </button>
                                                    </div>

                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                        <span style={{ fontSize: '0.875rem', color: '#64748B' }}>Required</span>
                                                        <div
                                                            onClick={() => handleUpdateItem(item.id, { mandatory: !item.mandatory })}
                                                            style={{
                                                                width: '36px',
                                                                height: '20px',
                                                                borderRadius: '20px',
                                                                background: item.mandatory ? '#4285F4' : '#CBD5E1',
                                                                position: 'relative',
                                                                cursor: 'pointer',
                                                                transition: 'background 0.2s'
                                                            }}
                                                        >
                                                            <div style={{
                                                                width: '14px',
                                                                height: '14px',
                                                                borderRadius: '50%',
                                                                background: '#FFFFFF',
                                                                position: 'absolute',
                                                                top: '3px',
                                                                left: item.mandatory ? '19px' : '3px',
                                                                transition: 'left 0.2s'
                                                            }} />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </Reorder.Item>
                                    )
                                })}
                            </AnimatePresence>
                        </Reorder.Group>
                    </div>

                    {/* PREVIEW COLUMN */}
                    {showPreview && (
                        <div style={{ flex: 1, maxWidth: '50%', borderLeft: '1px solid #E2E8F0', paddingLeft: '2rem' }}>
                            <div style={{
                                background: '#FFFFFF',
                                borderRadius: '0.75rem',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                                padding: '2rem',
                                border: '1px solid #E2E8F0'
                            }}>
                                <div style={{ marginBottom: '2rem', borderBottom: '1px solid #E2E8F0', paddingBottom: '1rem' }}>
                                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1E293B', margin: '0 0 0.5rem 0' }}>Customer Preview</h2>
                                    <p style={{ fontSize: '0.875rem', color: '#64748B', margin: 0 }}>This is how the checklist will appear to customers.</p>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    {items.map((item, idx) => (
                                        <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {item.type === 'section_header' ? (
                                                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1E293B', marginTop: '1rem', borderBottom: '2px solid #E2E8F0', paddingBottom: '0.5rem', wordBreak: 'break-word' }}>{item.label}</h3>
                                            ) : item.type === 'divider' ? (
                                                <hr style={{ border: 'none', borderTop: '1px solid #E2E8F0', margin: '1rem 0' }} />
                                            ) : item.type === 'info_text' ? (
                                                <div style={{ background: '#EFF6FF', padding: '1rem', borderRadius: '0.5rem', borderLeft: '4px solid #3B82F6' }}>
                                                    <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1D4ED8', margin: '0 0 0.25rem 0', wordBreak: 'break-word' }}>{item.label}</h4>
                                                    <p style={{ fontSize: '0.875rem', color: '#1E40AF', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{item.helperText}</p>
                                                </div>
                                            ) : (
                                                <>
                                                    <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#334155', display: 'flex', alignItems: 'flex-start', wordBreak: 'break-word' }}>
                                                        <span style={{ flex: 1 }}>{item.label}</span>
                                                        {item.mandatory && <span style={{ color: '#EF4444', marginLeft: '0.25rem', marginTop: '0.125rem' }}>*</span>}
                                                    </label>
                                                    {item.helperText && <p style={{ fontSize: '0.75rem', color: '#64748B', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{item.helperText}</p>}

                                                    {/* Preview Inputs */}
                                                    {item.type === 'short_text' && <input type="text" placeholder="Your answer" disabled style={{ padding: '0.5rem', border: '1px solid #CBD5E1', borderRadius: '0.375rem', background: '#F8FAFC' }} />}
                                                    {item.type === 'long_text' && <textarea placeholder="Your answer" rows={3} disabled style={{ padding: '0.5rem', border: '1px solid #CBD5E1', borderRadius: '0.375rem', background: '#F8FAFC', resize: 'none' }} />}
                                                    {item.type === 'number' && <input type="number" placeholder="0" disabled style={{ padding: '0.5rem', border: '1px solid #CBD5E1', borderRadius: '0.375rem', background: '#F8FAFC', width: '120px' }} />}
                                                    {item.type === 'date' && <input type="date" disabled style={{ padding: '0.5rem', border: '1px solid #CBD5E1', borderRadius: '0.375rem', background: '#F8FAFC', width: '160px' }} />}
                                                    {item.type === 'dropdown' && (
                                                        <select disabled style={{ padding: '0.5rem', border: '1px solid #CBD5E1', borderRadius: '0.375rem', background: '#F8FAFC' }}>
                                                            <option>Select an option</option>
                                                            {item.options?.map((o, i) => <option key={i}>{o}</option>)}
                                                        </select>
                                                    )}
                                                    {(item.type === 'yes_no' || item.type === 'pass_fail') && (
                                                        <div style={{ display: 'flex', gap: '1rem' }}>
                                                            {(item.type === 'yes_no' ? ['Yes', 'No'] : ['Pass', 'Fail', 'N/A']).map(opt => (
                                                                <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#475569' }}>
                                                                    <input type="radio" disabled /> {opt}
                                                                </label>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {item.type === 'single_choice' && (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                            {item.options?.map((opt, i) => (
                                                                <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#475569' }}>
                                                                    <input type="radio" disabled /> {opt}
                                                                </label>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {item.type === 'multiple_choice' && (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                            {item.options?.map((opt, i) => (
                                                                <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#475569' }}>
                                                                    <input type="checkbox" disabled /> {opt}
                                                                </label>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {item.type === 'file_upload' && (
                                                        <div style={{ border: '1px dashed #CBD5E1', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center', background: '#F8FAFC', color: '#94A3B8' }}>
                                                            <Upload size={16} style={{ margin: '0 auto 0.5rem auto' }} />
                                                            <span style={{ fontSize: '0.75rem' }}>Upload File</span>
                                                        </div>
                                                    )}
                                                    {item.type === 'signature' && (
                                                        <div style={{ border: '1.5px solid #E2E8F0', borderRadius: '1rem', padding: '1.5rem', background: 'white', minHeight: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#CBD5E1' }}>
                                                            <PenTool size={20} />
                                                        </div>
                                                    )}
                                                    {item.type === 'spacer' && (
                                                        <div style={{ height: '40px' }} />
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Sidebar - Item Settings */}
            <div style={{
                width: '300px',
                background: '#FFFFFF',
                borderLeft: '1px solid #E2E8F0',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '-2px 0 8px rgba(0,0,0,0.02)',
                zIndex: 10
            }}>
                <div style={{ padding: '1.5rem 1.25rem', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                    <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.05em', margin: 0 }}>ITEM SETTINGS</h3>
                </div>

                <div style={{ overflowY: 'auto', padding: '1.5rem', flex: 1 }}>
                    {selectedItem ? (
                        <>
                            {/* Label Input */}
                            {selectedItem.type !== 'divider' && (
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: 600, color: '#94A3B8', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>LABEL</label>
                                    <input
                                        type="text"
                                        value={selectedItem.label}
                                        onChange={(e) => handleUpdateItem(selectedItem.id, { label: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '0.625rem 0.75rem',
                                            border: '1px solid #CBD5E1',
                                            borderRadius: '0.375rem',
                                            fontSize: '0.875rem',
                                            outline: 'none'
                                        }}
                                    />
                                </div>
                            )}

                            {/* Helper Text Input */}
                            {selectedItem.type !== 'section_header' && selectedItem.type !== 'divider' && (
                                <div style={{ marginBottom: '2rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: 600, color: '#94A3B8', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>HELPER TEXT</label>
                                    <textarea
                                        rows={3}
                                        value={selectedItem.helperText}
                                        onChange={(e) => handleUpdateItem(selectedItem.id, { helperText: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '0.625rem 0.75rem',
                                            border: '1px solid #CBD5E1',
                                            borderRadius: '0.375rem',
                                            fontSize: '0.875rem',
                                            resize: 'none',
                                            outline: 'none'
                                        }}
                                    />
                                </div>
                            )}



                            {/* Configuration Toggles */}
                            {selectedItem.type !== 'section_header' && selectedItem.type !== 'divider' && (
                                <div style={{ marginBottom: '2rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: 600, color: '#94A3B8', letterSpacing: '0.05em', marginBottom: '1rem' }}>CONFIGURATION</label>

                                    <ToggleRow
                                        label="Mandatory Field"
                                        active={selectedItem.mandatory}
                                        onToggle={() => handleUpdateItem(selectedItem.id, { mandatory: !selectedItem.mandatory })}
                                    />
                                    <ToggleRow
                                        label="Photo Evidence Required"
                                        active={selectedItem.photoRequired}
                                        onToggle={() => handleUpdateItem(selectedItem.id, { photoRequired: !selectedItem.photoRequired })}
                                    />
                                    <ToggleRow
                                        label="Track Severity Score"
                                        active={selectedItem.trackSeverity}
                                        onToggle={() => handleUpdateItem(selectedItem.id, { trackSeverity: !selectedItem.trackSeverity })}
                                    />
                                    <ToggleRow
                                        label="Require Remarks on Fail"
                                        active={selectedItem.requireRemarks}
                                        onToggle={() => handleUpdateItem(selectedItem.id, { requireRemarks: !selectedItem.requireRemarks })}
                                    />
                                </div>
                            )}

                            <div style={{ padding: '1rem', borderTop: '1px solid #E2E8F0', marginTop: '1rem' }}>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    fullWidth
                                    onClick={() => setSelectedId(null)}
                                >
                                    Done Editing Item
                                </Button>
                            </div>
                        </>
                    ) : (
                        <div>
                            <div style={{ marginBottom: '2rem' }}>
                                <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: 600, color: '#94A3B8', letterSpacing: '0.05em', marginBottom: '1rem' }}>CHECKLIST DETAILS</label>

                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: '#475569', marginBottom: '0.5rem' }}>Description</label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Enter checklist description..."
                                        style={{
                                            width: '100%',
                                            padding: '0.625rem 0.75rem',
                                            border: '1px solid #CBD5E1',
                                            borderRadius: '0.375rem',
                                            fontSize: '0.875rem',
                                            height: '100px',
                                            resize: 'none',
                                            outline: 'none'
                                        }}
                                    />
                                </div>
                            </div>

                            <div style={{ marginBottom: '2rem' }}>
                                <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: 600, color: '#94A3B8', letterSpacing: '0.05em', marginBottom: '1rem' }}>LINKED SERVICES</label>
                                <div style={{ fontSize: '0.8125rem', color: '#64748B', marginBottom: '0.75rem' }}>
                                    Select services where this checklist is mandatory.
                                </div>
                                <div style={{
                                    maxHeight: '300px',
                                    overflowY: 'auto',
                                    border: '1px solid #E2E8F0',
                                    borderRadius: '0.375rem',
                                    padding: '0.5rem',
                                    backgroundColor: '#F8FAFC'
                                }}>
                                    {services.length > 0 ? services.map(service => (
                                        <label key={service.id} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '0.625rem 1rem',
                                            cursor: 'pointer',
                                            fontSize: '0.875rem',
                                            color: '#1E293B',
                                            gap: '0.75rem',
                                            borderBottom: '1px solid #F1F5F9'
                                        }}>
                                            <input
                                                type="checkbox"
                                                checked={selectedServiceIds.includes(service.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedServiceIds([...selectedServiceIds, service.id]);
                                                    } else {
                                                        setSelectedServiceIds(selectedServiceIds.filter(id => id !== service.id));
                                                    }
                                                }}
                                            />
                                            <span style={{ flex: 1 }}>{service.name}</span>
                                        </label>
                                    )) : (
                                        <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#94A3B8' }}>
                                            <p style={{ fontSize: '0.75rem' }}>No services available.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

/* Helper Components */

const DraggableItem: React.FC<{ icon: React.ReactNode, label: string, onClick?: () => void }> = ({ icon, label, onClick }) => (
    <div
        onClick={onClick}
        style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0.625rem 1.25rem',
            margin: '0 0.5rem 0.25rem 0.5rem',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            background: 'transparent',
            color: '#475569',
            fontWeight: 500,
            fontSize: '0.875rem',
            transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
            e.currentTarget.style.background = '#F8FAFC';
            e.currentTarget.style.color = '#334155';
        }}
        onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#475569';
        }}>
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '1rem',
            color: '#94A3B8'
        }}>
            {icon}
        </div>
        {label}
    </div>
);

const ToggleRow: React.FC<{ label: string, active?: boolean, onToggle?: () => void }> = ({ label, active, onToggle }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <span style={{ fontSize: '0.875rem', color: '#475569', fontWeight: 500 }}>{label}</span>
        <div
            onClick={onToggle}
            style={{
                width: '36px',
                height: '20px',
                background: active ? '#6366F1' : '#CBD5E1',
                borderRadius: '10px',
                position: 'relative',
                cursor: 'pointer',
                transition: 'background 0.2s'
            }}>
            <div style={{
                position: 'absolute',
                top: '2px',
                left: active ? '18px' : '2px',
                width: '16px',
                height: '16px',
                background: '#FFFFFF',
                borderRadius: '50%',
                transition: 'left 0.2s',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
            }} />
        </div>
    </div>
);

export default ChecklistBuilder;
