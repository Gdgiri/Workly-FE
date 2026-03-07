import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../redux/store';
import { fetchCategories, addCategory, updateCategory, deleteCategory } from '../redux/slices/categorySlice';

import { MdAdd, MdEdit, MdDelete, MdLabel, MdContentCut, MdShoppingBag, MdSearch, MdAttachMoney, MdClose } from 'react-icons/md';
import { Card, Button, Input, Modal } from '../components/UI';
import { useToast } from '../components/ToastContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import api from '../utils/api';
import { motion, AnimatePresence } from 'framer-motion';
import { ServiceAvatar } from '../components/ServiceAvatar';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinary';
import { removeImageBackground } from '../utils/backgroundRemoval';

interface Category {
    id: string;
    name: string;
    description?: string;
    type: 'service' | 'product' | 'expense';
    itemCount?: number;
    createdAt?: string;
    active: boolean; // Added active status
    imgUrl?: string; // Standardized field name
}



// Helper to map tab id to Redux type
const getCategoryType = (tab: 'service' | 'product' | 'expense') => tab;

const Category: React.FC = () => {
    const dispatch = useDispatch<AppDispatch>();
    const { serviceCategories, productCategories, expenseCategories, loading: categoriesLoading } = useSelector((state: RootState) => state.categories);

    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<'service' | 'product' | 'expense'>('service');
    const [searchTerm, setSearchTerm] = useState('');

    // Categories state - Removed local state
    // const [serviceCategories, setServiceCategories] = useState<Category[]>([]);
    // ...

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [categoryName, setCategoryName] = useState('');
    const [categoryDescription, setCategoryDescription] = useState('');
    const [categoryActive, setCategoryActive] = useState(true); // Status state
    const [categoryImgUrl, setCategoryImgUrl] = useState(''); // Standardized state name

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    // const [loading, setLoading] = useState(true); // Removed local loading
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [removeBgAddEnabled, setRemoveBgAddEnabled] = useState(false);
    const [removeBgEditEnabled, setRemoveBgEditEnabled] = useState(false);

    // Image upload handler
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Client-side size validation (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
            showToast('Image size must be less than 10MB', 'error');
            return;
        }

        setIsUploading(true);
        try {
            let fileToUpload = file;
            const isBgRemovalChecked = editingCategory ? removeBgEditEnabled : removeBgAddEnabled;
            if (isBgRemovalChecked) {
                showToast('Removing background...', 'info');
                fileToUpload = await removeImageBackground(file);
            }
            const url = await uploadToCloudinary(fileToUpload);
            setCategoryImgUrl(url);
            showToast('Image uploaded successfully', 'success');
        } catch (error: any) {
            console.error('Cloudinary upload error:', error);
            showToast(error.message || 'Failed to upload image', 'error');
        } finally {
            setIsUploading(false);
            // Reset input value to allow re-uploading the same file
            e.target.value = '';
        }
    };

    const handleRemoveImage = async () => {
        if (!categoryImgUrl) return;
        try {
            await deleteFromCloudinary(categoryImgUrl);
            setCategoryImgUrl('');
            showToast('Image removed from server', 'success');
        } catch (error: any) {
            console.error('Cloudinary delete error:', error);
            showToast(error.message || 'Failed to remove image', 'error');
            setCategoryImgUrl('');
        }
    };

    // Fetch categories from backend - Replaced with Redux dispatch
    // Fetch categories from backend - Replaced with Redux dispatch
    useEffect(() => {
        const currentCategories = activeTab === 'service' ? serviceCategories : activeTab === 'product' ? productCategories : expenseCategories;
        if (currentCategories.length === 0) {
            dispatch(fetchCategories(activeTab));
        }
    }, [dispatch, activeTab, serviceCategories.length, productCategories.length, expenseCategories.length]);

    const currentCategories = activeTab === 'service' ? serviceCategories : activeTab === 'product' ? productCategories : expenseCategories;
    const filteredCategories = currentCategories.filter(cat =>
        cat.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Pagination logic
    const totalPages = Math.ceil(filteredCategories.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedCategories = filteredCategories.slice(startIndex, endIndex);

    // Reset to page 1 when search term or tab changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, activeTab]);

    const handleAddCategory = () => {
        setEditingCategory(null);
        setCategoryName('');
        setCategoryDescription('');
        setCategoryActive(true);
        setCategoryImgUrl(''); // Reset image
        setRemoveBgAddEnabled(false);
        setIsModalOpen(true);
    };

    const handleEditCategory = (category: Category) => {
        setEditingCategory(category);
        setCategoryName(category.name);
        setCategoryDescription(category.description || '');
        setCategoryActive(category.active);
        setCategoryImgUrl(category.imgUrl || ''); // Set existing image
        setRemoveBgEditEnabled(false);
        setIsModalOpen(true);
    };

    const handleSaveCategory = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!categoryName.trim()) {
            showToast('Category name is required', 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            if (editingCategory) {
                // Update existing category
                await dispatch(updateCategory({
                    id: editingCategory.id,
                    data: {
                        name: categoryName,
                        description: categoryDescription,
                        isActive: categoryActive,
                        imgUrl: categoryImgUrl
                    }
                })).unwrap();
                showToast('Category updated successfully', 'success');
            } else {
                // Create new category
                await dispatch(addCategory({
                    name: categoryName,
                    description: categoryDescription,
                    type: activeTab,
                    isActive: categoryActive, // Ensure this matches backend expectation
                    imgUrl: categoryImgUrl
                })).unwrap();
                showToast('Category created successfully', 'success');
            }

            setIsModalOpen(false);
            setCategoryName('');
            setCategoryDescription('');
            setCategoryActive(true);
            setCategoryImgUrl(''); // Reset image
            setRemoveBgAddEnabled(false);
            setRemoveBgEditEnabled(false);
            setEditingCategory(null);
            // No need to manual fetch, slice updates state
        } catch (error: any) {
            console.error('Error saving category:', error);
            showToast(error.response?.data?.error || error.message || (typeof error === 'string' ? error : 'Failed to save category'), 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteCategory = async (category: Category) => {
        if (category.name === 'General') {
            showToast('Cannot delete the General category', 'error');
            return;
        }

        if (!confirm(`Are you sure you want to delete "${category.name}"?`)) {
            return;
        }

        try {
            await dispatch(deleteCategory({ id: category.id, type: activeTab })).unwrap();
            showToast('Category deleted successfully', 'success');
        } catch (error: any) {
            console.error('Error deleting category:', error);
            showToast(error.response?.data?.error || error.message || (typeof error === 'string' ? error : 'Failed to delete category'), 'error');
        }
    };

    return (
        <div style={{ padding: 'var(--spacing-xl)', maxWidth: '1400px', margin: '0 auto', position: 'relative' }}>
            {/* Loading Overlay */}


            {!categoriesLoading && (
                <>
                    {/* Header */}


                    {/* Tabs and Search */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-xl)', gap: '1rem', flexWrap: 'wrap' }}>
                        {/* Tabs */}
                        <div className="glass" style={{
                            display: 'flex',
                            padding: '0.375rem',
                            borderRadius: 'var(--radius-xl)',
                            gap: '0.375rem'
                        }}>
                            {[
                                { id: 'service', label: 'Services', icon: <MdLabel size={18} /> },
                                { id: 'product', label: 'Products', icon: <MdShoppingBag size={18} /> },
                                { id: 'expense', label: 'Expenses', icon: <MdAttachMoney size={18} /> }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    style={{
                                        padding: '0.75rem 1.5rem',
                                        borderRadius: 'var(--radius-lg)',
                                        border: 'none',
                                        fontWeight: 700,
                                        fontSize: '0.875rem',
                                        cursor: 'pointer',
                                        background: activeTab === tab.id ? 'var(--grad-primary)' : 'transparent',
                                        color: activeTab === tab.id ? 'white' : 'var(--text-gray)',
                                        boxShadow: activeTab === tab.id ? 'var(--shadow-md)' : 'none',
                                        transition: 'all var(--transition-base)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.625rem',
                                    }}
                                >
                                    <span style={{
                                        display: 'flex',
                                        transform: activeTab === tab.id ? 'scale(1.1)' : 'scale(1)',
                                        transition: 'transform 0.3s ease'
                                    }}>
                                        {tab.icon}
                                    </span>
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Search and Add */}
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <div className="relative" style={{ height: '44px' }}>
                                <input
                                    type="text"
                                    placeholder="Search categories..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="form-control"
                                    style={{
                                        height: '100%',
                                        paddingLeft: '2.75rem',
                                        width: '280px',
                                        background: 'var(--glass-bg)',
                                        backdropFilter: 'blur(var(--glass-blur))'
                                    }}
                                />
                                <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)', display: 'flex' }}>
                                    <MdSearch size={20} />
                                </span>
                            </div>
                            <Button onClick={handleAddCategory}
                                icon={<MdAdd size={20} />}
                                style={{ height: '44px', padding: '0 1.5rem' }}
                            >
                                New Category
                            </Button>
                        </div>
                    </div>

                    {/* Categories Table */}
                    <div className="glass-card" style={{
                        borderRadius: '1.25rem',
                        overflow: 'hidden',
                        border: '1px solid var(--glass-border)'
                    }}>
                        {filteredCategories.length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '4rem 2rem',
                                color: 'var(--text-gray)'
                            }}>
                                <div style={{ margin: '0 auto 1rem', opacity: 0.3, color: 'var(--text-light)', display: 'flex', justifyContent: 'center' }}>
                                    <MdLabel size={64} />
                                </div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 0.5rem 0', color: 'var(--text-dark)' }}>
                                    No categories found
                                </h3>
                                <p style={{ fontSize: '0.875rem', margin: 0, color: 'var(--text-gray)' }}>
                                    {searchTerm ? 'Try a different search term' : 'Get started by adding your first category'}
                                </p>
                            </div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: 'var(--bg-hover)', borderBottom: '2px solid var(--border)' }}>
                                        {/* <th style={{
                                    padding: '1rem 1.5rem',
                                    textAlign: 'left',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    color: '#64748b',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    width: '50px'
                                }}>
                                    Icon
                                </th> */}
                                        <th style={{
                                            padding: '1rem 1.5rem',
                                            textAlign: 'left',
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            color: 'var(--text-gray)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em'
                                        }}>
                                            Category Name
                                        </th>
                                        <th style={{
                                            padding: '1rem 1.5rem',
                                            textAlign: 'left',
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            color: 'var(--text-gray)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em'
                                        }}>
                                            Description
                                        </th>
                                        <th style={{
                                            padding: '1rem 1.5rem',
                                            textAlign: 'left',
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            color: 'var(--text-gray)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em'
                                        }}>
                                            Status
                                        </th>
                                        <th style={{
                                            padding: '1rem 1.5rem',
                                            textAlign: 'center',
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            color: 'var(--text-gray)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            width: '150px'
                                        }}>
                                            Item Count
                                        </th>
                                        <th style={{
                                            padding: '1rem 1.5rem',
                                            textAlign: 'right',
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            color: 'var(--text-gray)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            width: '150px'
                                        }}>
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <AnimatePresence>
                                        {paginatedCategories.map((category, index) => (
                                            <motion.tr
                                                key={category.id}
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -20 }}
                                                transition={{ duration: 0.2, delay: index * 0.05 }}
                                                style={{
                                                    borderBottom: '1px solid #f1f5f9',
                                                    transition: 'background 0.2s'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                            >
                                                {/* Category Name */}
                                                <td style={{ padding: '1.25rem 1.5rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                        <ServiceAvatar name={category.name} imgUrl={category.imgUrl} size={40} />
                                                        <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-dark)' }}>
                                                            {category.name}
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Description */}
                                                <td style={{ padding: '1.25rem 1.5rem' }}>
                                                    <div style={{
                                                        fontSize: '0.875rem',
                                                        color: 'var(--text-gray)',
                                                        maxWidth: '400px',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        {category.description || '—'}
                                                    </div>
                                                </td>

                                                {/* Status */}
                                                <td style={{ padding: '1.25rem 1.5rem' }}>
                                                    <span style={{
                                                        display: 'inline-block',
                                                        padding: '0.25rem 0.625rem',
                                                        borderRadius: '1rem',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 700,
                                                        background: category.active
                                                            ? 'rgba(16, 185, 129, 0.2)'
                                                            : 'rgba(239, 68, 68, 0.2)',
                                                        color: category.active
                                                            ? 'var(--success)'
                                                            : 'var(--danger)',
                                                        border: `1px solid ${category.active ? 'var(--success)' : 'var(--danger)'}40`
                                                    }}>
                                                        {category.active ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>

                                                {/* Item Count */}
                                                <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>
                                                    <div style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '0.5rem',
                                                        padding: '0.5rem 0.875rem',
                                                        background: activeTab === 'service'
                                                            ? 'rgba(124, 58, 237, 0.15)'
                                                            : 'rgba(236, 72, 153, 0.15)',
                                                        borderRadius: '0.5rem',
                                                        border: `1px solid ${activeTab === 'service' ? 'rgba(124, 58, 237, 0.3)' : 'rgba(236, 72, 153, 0.3)'}`
                                                    }}>
                                                        <MdLabel
                                                            size={14}
                                                            color={activeTab === 'service' ? '#a78bfa' : '#f472b6'}
                                                        />
                                                        <span style={{
                                                            fontSize: '0.8125rem',
                                                            color: activeTab === 'service' ? '#a78bfa' : '#f472b6',
                                                            fontWeight: 700
                                                        }}>
                                                            {category.itemCount || 0}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Actions */}
                                                <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                                        <button
                                                            onClick={() => handleEditCategory(category)}
                                                            style={{
                                                                padding: '0.5rem 1rem',
                                                                borderRadius: '0.5rem',
                                                                border: '1px solid var(--border)',
                                                                background: 'var(--bg-card)',
                                                                color: 'var(--text-gray)',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s',
                                                                fontSize: '0.8125rem',
                                                                fontWeight: 600
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                e.currentTarget.style.background = 'var(--bg-hover)';
                                                                e.currentTarget.style.borderColor = 'var(--primary)';
                                                                e.currentTarget.style.color = 'var(--primary)';
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.currentTarget.style.background = 'var(--bg-card)';
                                                                e.currentTarget.style.borderColor = 'var(--border)';
                                                                e.currentTarget.style.color = 'var(--text-gray)';
                                                            }}
                                                        >
                                                            Edit
                                                        </button>
                                                        {/* <button
                                                            onClick={() => handleDeleteCategory(category)}
                                                            style={{
                                                                padding: '0.5rem 1rem',
                                                                borderRadius: '0.5rem',
                                                                border: '1px solid #fee2e2',
                                                                background: '#fff5f5',
                                                                color: '#ef4444',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s',
                                                                fontSize: '0.8125rem',
                                                                fontWeight: 600
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                e.currentTarget.style.background = '#fee2e2';
                                                                e.currentTarget.style.borderColor = '#f87171';
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.currentTarget.style.background = '#fff5f5';
                                                                e.currentTarget.style.borderColor = '#fee2e2';
                                                            }}
                                                        >
                                                            <MdDelete size={16} />
                                                        </button> */}

                                                    </div>
                                                </td>
                                            </motion.tr>
                                        ))}
                                    </AnimatePresence>
                                </tbody>
                            </table>
                        )}

                        {/* Pagination Controls */}
                        {filteredCategories.length > 0 && totalPages > 1 && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '1.5rem',
                                borderTop: '1px solid #f1f5f9'
                            }}>
                                {/* Results info */}
                                <div style={{ fontSize: '0.875rem', color: 'var(--text-gray)' }}>
                                    Showing <span style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{startIndex + 1}</span> to{' '}
                                    <span style={{ fontWeight: 600, color: 'var(--text-dark)' }}>
                                        {Math.min(endIndex, filteredCategories.length)}
                                    </span>{' '}
                                    of <span style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{filteredCategories.length}</span> categories
                                </div>

                                {/* Pagination buttons */}
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    {/* Previous button */}
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        disabled={currentPage === 1}
                                        style={{
                                            padding: '0.5rem 0.875rem',
                                            borderRadius: '0.5rem',
                                            border: '1px solid var(--border)',
                                            background: currentPage === 1 ? 'var(--bg-hover)' : 'var(--bg-card)',
                                            color: currentPage === 1 ? 'var(--text-light)' : 'var(--text-gray)',
                                            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                            transition: 'all 0.2s',
                                            fontSize: '0.875rem',
                                            fontWeight: 600
                                        }}
                                        onMouseEnter={(e) => {
                                            if (currentPage !== 1) {
                                                e.currentTarget.style.background = 'var(--bg-hover)';
                                                e.currentTarget.style.borderColor = 'var(--primary)';
                                                e.currentTarget.style.color = 'var(--primary)';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (currentPage !== 1) {
                                                e.currentTarget.style.background = 'var(--bg-card)';
                                                e.currentTarget.style.borderColor = 'var(--border)';
                                                e.currentTarget.style.color = 'var(--text-gray)';
                                            }
                                        }}
                                    >
                                        Previous
                                    </button>

                                    {/* Page numbers */}
                                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                                            // Show first page, last page, current page, and pages around current
                                            const showPage = page === 1 ||
                                                page === totalPages ||
                                                (page >= currentPage - 1 && page <= currentPage + 1);

                                            const showEllipsis = (page === currentPage - 2 && currentPage > 3) ||
                                                (page === currentPage + 2 && currentPage < totalPages - 2);

                                            if (showEllipsis) {
                                                return (
                                                    <span key={page} style={{
                                                        padding: '0.5rem 0.75rem',
                                                        color: 'var(--text-light)',
                                                        fontSize: '0.875rem'
                                                    }}>
                                                        ...
                                                    </span>
                                                );
                                            }

                                            if (!showPage) return null;

                                            return (
                                                <button
                                                    key={page}
                                                    onClick={() => setCurrentPage(page)}
                                                    style={{
                                                        padding: '0.5rem 0.75rem',
                                                        borderRadius: '0.5rem',
                                                        border: '1px solid var(--border)',
                                                        background: currentPage === page ? 'var(--primary)' : 'var(--bg-card)',
                                                        color: currentPage === page ? 'white' : 'var(--text-gray)',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s',
                                                        fontSize: '0.875rem',
                                                        fontWeight: 600,
                                                        minWidth: '2.5rem'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        if (currentPage !== page) {
                                                            e.currentTarget.style.background = 'var(--bg-hover)';
                                                            e.currentTarget.style.borderColor = 'var(--primary)';
                                                            e.currentTarget.style.color = 'var(--primary)';
                                                        }
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        if (currentPage !== page) {
                                                            e.currentTarget.style.background = 'var(--bg-card)';
                                                            e.currentTarget.style.borderColor = 'var(--border)';
                                                            e.currentTarget.style.color = 'var(--text-gray)';
                                                        }
                                                    }}
                                                >
                                                    {page}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Next button */}
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                        disabled={currentPage === totalPages}
                                        style={{
                                            padding: '0.5rem 0.875rem',
                                            borderRadius: '0.5rem',
                                            border: '1px solid var(--border)',
                                            background: currentPage === totalPages ? 'var(--bg-hover)' : 'var(--bg-card)',
                                            color: currentPage === totalPages ? 'var(--text-light)' : 'var(--text-gray)',
                                            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                                            transition: 'all 0.2s',
                                            fontSize: '0.875rem',
                                            fontWeight: 600
                                        }}
                                        onMouseEnter={(e) => {
                                            if (currentPage !== totalPages) {
                                                e.currentTarget.style.background = 'var(--bg-hover)';
                                                e.currentTarget.style.borderColor = 'var(--primary)';
                                                e.currentTarget.style.color = 'var(--primary)';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (currentPage !== totalPages) {
                                                e.currentTarget.style.background = 'var(--bg-card)';
                                                e.currentTarget.style.borderColor = 'var(--border)';
                                                e.currentTarget.style.color = 'var(--text-gray)';
                                            }
                                        }}
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Add/Edit Category Modal */}
                    <Modal
                        isOpen={isModalOpen}
                        onClose={() => setIsModalOpen(false)}
                        title={editingCategory ? 'Edit Category' : 'Add New Category'}
                    >
                        <form onSubmit={handleSaveCategory} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div className="grid md-grid-cols-3 gap-4">
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-dark)', marginBottom: '0.5rem' }}>
                                        Category Type
                                    </label>
                                    <div style={{
                                        padding: '0.875rem 1rem',
                                        background: 'var(--bg-hover)',
                                        borderRadius: '0.75rem',
                                        border: '1px solid var(--border)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        height: '45px'
                                    }}>
                                        {activeTab === 'service'
                                            ? <MdContentCut size={18} color="var(--primary)" />
                                            : activeTab === 'product'
                                                ? <MdShoppingBag size={18} color="var(--primary)" />
                                                : <MdAttachMoney size={18} color="var(--primary)" />}
                                        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-gray)' }}>
                                            {activeTab === 'service' ? 'Service' : activeTab === 'product' ? 'Product' : 'Expense'}
                                        </span>
                                    </div>
                                </div>

                                <Input
                                    label="Category Name"
                                    placeholder=""
                                    value={categoryName}
                                    onChange={(e) => setCategoryName(e.target.value)}
                                    required
                                />

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-dark)', marginBottom: '0.5rem' }}>
                                        Status
                                    </label>
                                    <select
                                        value={categoryActive ? 'true' : 'false'}
                                        onChange={(e) => setCategoryActive(e.target.value === 'true')}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem 1rem',
                                            borderRadius: '0.75rem',
                                            border: '1.5px solid var(--border)',
                                            outline: 'none',
                                            background: 'var(--bg-input)',
                                            color: 'var(--text-dark)',
                                            fontSize: '0.875rem',
                                            fontWeight: 500,
                                            appearance: 'none',
                                            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                                            backgroundRepeat: 'no-repeat',
                                            backgroundPosition: 'right 1rem center',
                                            backgroundSize: '1em',
                                            height: '45px'
                                        }}
                                    >
                                        <option value="true">Active</option>
                                        <option value="false">Inactive</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-dark)', marginBottom: '0.5rem' }}>
                                    Description
                                </label>
                                <textarea
                                    placeholder="Brief description of this category..."
                                    value={categoryDescription}
                                    onChange={(e) => setCategoryDescription(e.target.value)}
                                    rows={3}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        borderRadius: '0.75rem',
                                        border: '1.5px solid var(--border)',
                                        outline: 'none',
                                        fontSize: '0.875rem',
                                        fontFamily: 'inherit',
                                        resize: 'vertical',
                                        transition: 'all 0.2s',
                                        background: 'var(--bg-input)',
                                        color: 'var(--text-dark)'
                                    }}
                                    onFocus={(e) => {
                                        e.currentTarget.style.borderColor = 'var(--primary)';
                                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(35, 76, 106, 0.1)';
                                    }}
                                    onBlur={(e) => {
                                        e.currentTarget.style.borderColor = 'var(--border)';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                />
                            </div>

                            {/* Image Upload */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-dark)', marginBottom: '0.5rem' }}>
                                    Category Image
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', width: '100%' }}>
                                        <input
                                            type="checkbox"
                                            id="remove-bg-category"
                                            checked={editingCategory ? removeBgEditEnabled : removeBgAddEnabled}
                                            onChange={(e) => editingCategory ? setRemoveBgEditEnabled(e.target.checked) : setRemoveBgAddEnabled(e.target.checked)}
                                            style={{ width: '1rem', height: '1rem', cursor: 'pointer', accentColor: 'var(--primary)' }}
                                        />
                                        <label htmlFor="remove-bg-category" style={{ fontSize: '0.85rem', color: 'var(--text-gray)', cursor: 'pointer' }}>
                                            Remove background using AI (Best for products)
                                        </label>
                                    </div>

                                    <input
                                        type="file"
                                        id="category-image"
                                        accept="image/*"
                                        onChange={handleImageUpload}
                                        style={{ display: 'none' }}
                                    />
                                    <label
                                        htmlFor="category-image"
                                        style={{
                                            padding: '0.75rem 1.5rem',
                                            background: isUploading ? '#94a3b8' : 'var(--primary)',
                                            color: 'white',
                                            borderRadius: '0.5rem',
                                            cursor: isUploading ? 'not-allowed' : 'pointer',
                                            fontWeight: 600,
                                            fontSize: '0.9rem',
                                            border: 'none',
                                            display: 'inline-block',
                                            transition: 'all 0.2s',
                                            opacity: isUploading ? 0.7 : 1
                                        }}
                                        className={isUploading ? "" : "hover:opacity-90"}
                                    >
                                        {isUploading ? 'Uploading...' : 'Choose File'}
                                    </label>

                                    {categoryImgUrl && (
                                        <div style={{ position: 'relative', width: '80px', height: '80px' }}>
                                            <div style={{
                                                width: '80px',
                                                height: '80px',
                                                borderRadius: '0.75rem',
                                                overflow: 'hidden',
                                                border: '1px solid var(--border)',
                                                background: 'var(--bg-hover)'
                                            }}>
                                                <img
                                                    src={categoryImgUrl}
                                                    alt="Preview"
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleRemoveImage}
                                                style={{
                                                    position: 'absolute',
                                                    top: '-8px',
                                                    right: '-8px',
                                                    width: '24px',
                                                    height: '24px',
                                                    borderRadius: '50%',
                                                    background: '#ef4444',
                                                    color: 'white',
                                                    border: '2px solid white',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    cursor: 'pointer',
                                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                                }}
                                            >
                                                <span style={{ display: 'flex' }}><MdClose size={14} /></span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-dark)', marginBottom: '0.5rem' }}>
                                    Status
                                </label>
                                <select
                                    value={categoryActive ? 'true' : 'false'}
                                    onChange={(e) => setCategoryActive(e.target.value === 'true')}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem 1rem',
                                        borderRadius: '0.75rem',
                                        border: '1.5px solid var(--border)',
                                        outline: 'none',
                                        background: 'var(--bg-input)',
                                        color: 'var(--text-dark)',
                                        fontSize: '0.875rem',
                                        fontWeight: 500,
                                        appearance: 'none',
                                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                                        backgroundRepeat: 'no-repeat',
                                        backgroundPosition: 'right 1rem center',
                                        backgroundSize: '1em'
                                    }}
                                >
                                    <option value="true">Active</option>
                                    <option value="false">Inactive</option>
                                </select>
                            </div> */}

                            <div style={{ display: 'flex', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-light)' }}>
                                <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} style={{ flex: 1 }}>
                                    Cancel
                                </Button>
                                <Button type="submit" style={{ flex: 1 }} disabled={isSubmitting} isLoading={isSubmitting}>
                                    {editingCategory ? 'Update Category' : 'Add Category'}
                                </Button>
                            </div>
                        </form>
                    </Modal>
                </>
            )}
        </div >
    );
};

export default Category;
