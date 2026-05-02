import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Plus, ClipboardList } from 'lucide-react';
import { Button, Table } from '../components/UI';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../utils/api';
import { LoadingSpinner } from '../components/LoadingSpinner';

export const ChecklistList: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [checklists, setChecklists] = useState<any[]>(() => {
        const cached = localStorage.getItem('cached_checklists');
        return cached ? JSON.parse(cached) : [];
    });
    const [loading, setLoading] = useState(() => {
        const cached = localStorage.getItem('cached_checklists');
        return !cached; // Only show loading if no cache
    });
    const navigate = useNavigate();
    const { appId, businessName } = useParams();

    React.useEffect(() => {
        const fetchChecklists = async () => {
            try {
                const response = await api.get('/checklists/templates');
                console.log('Checklists API Response:', response.data);

                let data = [];
                if (response.data.status === 'success') {
                    data = response.data.data || response.data.checklists || [];
                } else if (Array.isArray(response.data)) {
                    data = response.data;
                } else if (response.data.checklists) {
                    data = response.data.checklists;
                } else if (response.data.data) {
                    data = response.data.data;
                }

                if (data.length > 0) {
                    setChecklists(data);
                    localStorage.setItem('cached_checklists', JSON.stringify(data));
                }
            } catch (error) {
                console.error('Failed to fetch checklists:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchChecklists();
    }, []);

    const handleAddChecklist = () => {
        navigate(`/${appId}/${businessName}/checklist-builder`);
    };

    const handleEdit = (id: string) => {
        navigate(`/${appId}/${businessName}/checklist-builder?id=${id}`);
    };

    const columns = [
        { header: 'Checklist Name', accessor: 'name' as keyof any },
        {
            header: 'Status',
            accessor: (row: any) => (
                <span style={{
                    color: row.isActive ? '#10B981' : '#6B7280',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    background: row.isActive ? '#ECFDF5' : '#F3F4F6',
                    padding: '0.25rem 0.625rem',
                    borderRadius: 'var(--radius-full)'
                }}>
                    {row.isActive ? 'Active' : 'Inactive'}
                </span>
            )
        },
        { header: 'Last Updated', accessor: (row: any) => new Date(row.updatedAt).toLocaleDateString() },
        {
            header: 'Actions',
            accessor: (row: any) => (
                <Button variant="secondary" size="sm" onClick={() => handleEdit(row.id)}>Edit</Button>
            )
        }
    ];

    const filteredChecklists = (checklists || [])
        .filter(c => (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());

    return (
        <div className="space-y-6" style={{ position: 'relative' }}>
            {/* Header Section */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1.5rem',
                marginBottom: '1.5rem',
                padding: '1.5rem',
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius-xl)',
                boxShadow: 'var(--shadow-md)',
                border: '1px solid var(--border-light)'
            }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flex: 1 }}>
                    {/* Search Input */}
                    <div className="relative" style={{ position: 'relative' }}>
                        <input
                            type="text"
                            placeholder="Search checklists..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                height: '44px',
                                padding: '0 1rem 0 3rem',
                                border: '1.5px solid var(--border)',
                                borderRadius: 'var(--radius-lg)',
                                fontSize: '0.875rem',
                                outline: 'none',
                                width: '280px',
                                background: 'var(--bg-card)',
                                color: 'var(--text-dark)',
                                transition: 'all var(--transition-base)'
                            }}
                            onFocus={(e) => {
                                e.currentTarget.style.borderColor = 'var(--primary)';
                                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(35, 76, 106, 0.1), var(--shadow-md)';
                            }}
                            onBlur={(e) => {
                                e.currentTarget.style.borderColor = 'var(--border)';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                        />
                        <div style={{
                            position: 'absolute',
                            left: '1rem',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'var(--text-light)',
                            display: 'flex',
                            pointerEvents: 'none',
                            zIndex: 1
                        }}>
                            <Search size={18} />
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <Button
                        onClick={handleAddChecklist}
                        icon={<Plus size={18} />}
                        style={{ height: '44px', fontWeight: 600 }}
                    >
                        Add Checklist
                    </Button>
                </div>
            </div>

            {/* Content Area */}
            <div style={{
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--border-light)',
                boxShadow: 'var(--shadow-sm)',
                overflow: 'hidden'
            }}>
                {loading ? (
                    <div style={{ padding: '4rem', textAlign: 'center' }}>
                        <LoadingSpinner />
                        <p style={{ marginTop: '1rem', color: 'var(--text-black)' }}>Loading checklists...</p>
                    </div>
                ) : filteredChecklists.length > 0 ? (
                    <Table
                        columns={columns}
                        data={filteredChecklists}
                    />
                ) : (
                    <div style={{
                        padding: '4rem 2rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        color: 'var(--text-black)'
                    }}>
                        <div style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '50%',
                            background: 'var(--bg-hover)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '1.5rem'
                        }}>
                            <ClipboardList size={32} style={{ color: 'var(--text-light)' }} />
                        </div>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-dark)', marginBottom: '0.5rem' }}>
                            No checklists yet
                        </h3>
                        <p style={{ maxWidth: '400px', marginBottom: '1.5rem' }}>
                            Create your first checklist to start tracking tasks and standard operating procedures.
                        </p>
                        <Button
                            onClick={handleAddChecklist}
                            icon={<Plus size={18} />}
                        >
                            Create Checklist
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChecklistList;
