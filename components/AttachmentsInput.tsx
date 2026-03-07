import React, { useState } from 'react';
import { Plus, Trash2, UploadCloud, Loader2 } from 'lucide-react';
import { uploadToCloudinary } from '../utils/cloudinary';
import { useToast } from './ToastContext';

export interface Attachment {
    title: string;
    remarks: string;
    url: string;
}

interface AttachmentsInputProps {
    attachments: Attachment[];
    onChange: (attachments: Attachment[]) => void;
    readOnly?: boolean;
}

export const AttachmentsInput: React.FC<AttachmentsInputProps> = ({ attachments, onChange, readOnly = false }) => {
    const { showToast } = useToast();
    const [isUploading, setIsUploading] = useState<number | null>(null); // Index of row currently uploading

    const addAttachmentRow = () => {
        onChange([...attachments, { title: '', remarks: '', url: '' }]);
    };

    const removeAttachmentRow = (index: number) => {
        const newAttachments = [...attachments];
        newAttachments.splice(index, 1);
        onChange(newAttachments);
    };

    const updateAttachmentRow = (index: number, field: keyof Attachment, value: string) => {
        const newAttachments = [...attachments];
        newAttachments[index] = { ...newAttachments[index], [field]: value };
        onChange(newAttachments);
    };

    const handleRowUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Client-side size validation (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
            showToast('File size must be less than 10MB', 'error');
            return;
        }

        setIsUploading(index);
        try {
            const url = await uploadToCloudinary(file);
            const newAttachments = [...attachments];
            newAttachments[index] = { ...newAttachments[index], url };
            onChange(newAttachments);
            showToast('File uploaded successfully', 'success');
        } catch (error: any) {
            console.error('Upload error:', error);
            showToast(error.message || 'Failed to upload file', 'error');
        } finally {
            setIsUploading(null);
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <label className="input-label" style={{ marginBottom: 0 }}>Attachments / Receipts</label>
                {!readOnly && (
                    <button
                        type="button"
                        className="btn btn-outline"
                        onClick={addAttachmentRow}
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', height: 'auto', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                    >
                        <Plus size={14} /> Add Attach
                    </button>
                )}
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: '0.5rem', overflow: 'hidden' }}>
                <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'var(--bg-hover)', color: 'var(--text-gray)' }}>
                        <tr>
                            <th style={{ padding: '0.75rem', textAlign: 'left', width: '30%', fontWeight: 600 }}>Title</th>
                            <th style={{ padding: '0.75rem', textAlign: 'left', width: '35%', fontWeight: 600 }}>Remarks</th>
                            <th style={{ padding: '0.75rem', textAlign: 'left', width: '35%', fontWeight: 600 }}>File</th>
                            {!readOnly && <th style={{ padding: '0.75rem', width: '40px' }}></th>}
                        </tr>
                    </thead>
                    <tbody>
                        {attachments.length === 0 ? (
                            <tr>
                                <td colSpan={readOnly ? 3 : 4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-gray)' }}>
                                    {readOnly ? 'No attachments available.' : 'No attachments added. Click "Add Attach" to start.'}
                                </td>
                            </tr>
                        ) : (
                            attachments.map((item, index) => (
                                <tr key={index} style={{ borderTop: '1px solid var(--border)' }}>
                                    <td style={{ padding: '0.75rem' }}>
                                        {readOnly ? (
                                            <span style={{ fontWeight: 500 }}>{item.title || '-'}</span>
                                        ) : (
                                            <input
                                                type="text"
                                                placeholder="Title"
                                                className="form-control"
                                                value={item.title}
                                                onChange={(e) => updateAttachmentRow(index, 'title', e.target.value)}
                                                style={{ fontSize: '0.875rem' }}
                                            />
                                        )}
                                    </td>
                                    <td style={{ padding: '0.75rem' }}>
                                        {readOnly ? (
                                            <span style={{ color: 'var(--text-gray)' }}>{item.remarks || '-'}</span>
                                        ) : (
                                            <input
                                                type="text"
                                                placeholder="Remarks"
                                                className="form-control"
                                                value={item.remarks}
                                                onChange={(e) => updateAttachmentRow(index, 'remarks', e.target.value)}
                                                style={{ fontSize: '0.875rem' }}
                                            />
                                        )}
                                    </td>
                                    <td style={{ padding: '0.75rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            {item.url ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                                                    <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ width: '32px', height: '32px', flexShrink: 0, borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                                                        <img src={item.url} alt="Attachment" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/100x100?text=File'; }} />
                                                    </a>

                                                    {!readOnly && (
                                                        <label className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', height: 'auto', whiteSpace: 'nowrap' }}>
                                                            Change
                                                            <input
                                                                type="file"
                                                                onChange={(e) => handleRowUpload(index, e)}
                                                                style={{ display: 'none' }}
                                                                disabled={isUploading === index}
                                                            />
                                                        </label>
                                                    )}
                                                </div>
                                            ) : (
                                                !readOnly && (
                                                    <label style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '0.4rem',
                                                        cursor: 'pointer',
                                                        padding: '0.35rem 0.6rem',
                                                        background: '#e2e8f0',
                                                        borderRadius: '4px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 500,
                                                        color: '#475569'
                                                    }}>
                                                        {isUploading === index ? <Loader2 size={12} className="animate-spin" /> : <UploadCloud size={12} />}
                                                        Choose File
                                                        <input
                                                            type="file"
                                                            onChange={(e) => handleRowUpload(index, e)}
                                                            style={{ display: 'none' }}
                                                            disabled={isUploading === index}
                                                        />
                                                    </label>
                                                )
                                            )}
                                        </div>
                                    </td>
                                    {!readOnly && (
                                        <td style={{ padding: '0.75rem' }}>
                                            <button
                                                type="button"
                                                onClick={() => removeAttachmentRow(index)}
                                                style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem' }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
