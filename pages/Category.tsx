import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../redux/store';
import { fetchCategories, addCategory, updateCategory, deleteCategory } from '../redux/slices/categorySlice';

import { MdAdd, MdEdit, MdDelete, MdLabel, MdContentCut, MdShoppingBag, MdSearch, MdAttachMoney, MdClose } from 'react-icons/md';
import { Button, Input, Modal, Table } from '../components/UI';
import { useToast } from '../components/ToastContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import api from '../utils/api';
import { motion, AnimatePresence } from 'framer-motion';
import { ServiceAvatar } from '../components/ServiceAvatar';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinary';
import { removeImageBackground } from '../utils/backgroundRemoval';
import { useAuth } from '../hooks/useAuth';

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

const Category: React.FC = () => {
    const dispatch = useDispatch<AppDispatch>();
    const {
        serviceCategories,
        productCategories,
        expenseCategories,
        loading: categoriesLoading
    } = useSelector((state: RootState) => state.categories);

    const { showToast } = useToast();
    const { hasPermission } = useAuth();
    const canAdd = hasPermission('category', 'add');
    const canEdit = hasPermission('category', 'edit');
    const [activeTab, setActiveTab] = useState<'service' | 'product' | 'expense'>('service');
    const [searchTerm, setSearchTerm] = useState('');

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [categoryName, setCategoryName] = useState('');
    const [categoryDescription, setCategoryDescription] = useState('');
    const [categoryActive, setCategoryActive] = useState(true);
    const [categoryImgUrl, setCategoryImgUrl] = useState('');

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [removeBgAddEnabled, setRemoveBgAddEnabled] = useState(false);
    const [removeBgEditEnabled, setRemoveBgEditEnabled] = useState(false);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    // Image upload handler
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

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

    // Columns for the Table component
    const columns = useMemo(() => [
        {
            header: 'Category Name',
            accessor: (cat: Category) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <ServiceAvatar name={cat.name} imgUrl={cat.imgUrl} size={40} />
                    <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-dark)' }}>
                        {cat.name}
                    </div>
                </div>
            )
        },
        {
            header: 'Description',
            accessor: (cat: Category) => (
                <div style={{
                    fontSize: '0.875rem',
                    color: 'var(--text-black)',
                    maxWidth: '400px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                }}>
                    {cat.description || '—'}
                </div>
            )
        },
        {
            header: 'Status',
            accessor: (cat: Category) => (
                <span style={{
                    display: 'inline-block',
                    padding: '0.25rem 0.625rem',
                    borderRadius: '1rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    background: cat.active
                        ? 'rgba(16, 185, 129, 0.2)'
                        : 'rgba(239, 68, 68, 0.2)',
                    color: cat.active
                        ? 'var(--success)'
                        : 'var(--danger)',
                    border: `1px solid ${cat.active ? 'var(--success)' : 'var(--danger)'}40`
                }}>
                    {cat.active ? 'Active' : 'Inactive'}
                </span>
            )
        },
        {
            header: 'Item Count',
            accessor: (cat: Category) => (
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
                        {cat.itemCount || 0}
                    </span>
                </div>
            ),
            align: 'center' as const
        },
        {
            header: 'Actions',
            accessor: (cat: Category) => (
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button
                        onClick={() => {
                            if (!canEdit) { showToast("Ask Admin for permission", "error"); return; }
                            handleEditCategory(cat);
                        }}
                        title={!canEdit ? "Ask Admin for permission" : ""}
                        disabled={!canEdit}
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '0.5rem',
                            border: '1px solid var(--border)',
                            background: 'var(--bg-card)',
                            color: 'var(--text-black)',
                            cursor: !canEdit ? 'not-allowed' : 'pointer',
                            opacity: !canEdit ? 0.5 : 1,
                            transition: 'all 0.2s',
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.375rem'
                        }}
                    >
                        <MdEdit size={16} /> Edit
                    </button>
                    <button
                        onClick={() => {
                            if (!canEdit) { showToast("Ask Admin for permission", "error"); return; }
                            handleDeleteCategory(cat);
                        }}
                        title={!canEdit ? "Ask Admin for permission" : ""}
                        disabled={!canEdit}
                        style={{
                            padding: '0.5rem',
                            borderRadius: '0.5rem',
                            border: '1px solid var(--danger)40',
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: 'var(--danger)',
                            cursor: !canEdit ? 'not-allowed' : 'pointer',
                            opacity: !canEdit ? 0.5 : 1,
                            transition: 'all 0.2s'
                        }}
                    >
                        <MdDelete size={18} />
                    </button>
                </div>
            ),
            align: 'right' as const
        }
    ], [activeTab]);

    useEffect(() => {
        const currentCategories = activeTab === 'service' ? serviceCategories : activeTab === 'product' ? productCategories : expenseCategories;
        if (currentCategories.length === 0) {
            dispatch(fetchCategories(activeTab));
        }
    }, [dispatch, activeTab]);

    const currentCategories = activeTab === 'service' ? serviceCategories : activeTab === 'product' ? productCategories : expenseCategories;

    const filteredCategories = useMemo(() => {
        return currentCategories.filter(cat =>
            cat.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [currentCategories, searchTerm]);

    // Pagination logic
    const totalPages = Math.ceil(filteredCategories.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedCategories = filteredCategories.slice(startIndex, startIndex + itemsPerPage);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, activeTab]);

    const handleAddCategory = () => {
        setEditingCategory(null);
        setCategoryName('');
        setCategoryDescription('');
        setCategoryActive(true);
        setCategoryImgUrl('');
        setRemoveBgAddEnabled(false);
        setFormErrors({});
        setIsModalOpen(true);
    };

    const handleEditCategory = (category: Category) => {
        setEditingCategory(category);
        setCategoryName(category.name);
        setCategoryDescription(category.description || '');
        setCategoryActive(category.active);
        setCategoryImgUrl(category.imgUrl || '');
        setRemoveBgEditEnabled(false);
        setFormErrors({});
        setIsModalOpen(true);
    };

    const handleSaveCategory = async (e: React.FormEvent) => {
        e.preventDefault();

        // VALIDATION
        const newErrors: Record<string, string> = {};
        if (!categoryName.trim()) newErrors.name = 'Category name is required';

        if (Object.keys(newErrors).length > 0) {
            setFormErrors(newErrors);
            showToast('Please fill all required fields', 'error');
            return;
        }

        setFormErrors({});

        setIsSubmitting(true);
        try {
            if (editingCategory) {
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
                await dispatch(addCategory({
                    name: categoryName,
                    description: categoryDescription,
                    type: activeTab,
                    isActive: categoryActive,
                    imgUrl: categoryImgUrl
                })).unwrap();
                showToast('Category created successfully', 'success');
            }

            setIsModalOpen(false);
            setCategoryName('');
            setCategoryDescription('');
            setCategoryActive(true);
            setCategoryImgUrl('');
            setRemoveBgAddEnabled(false);
            setRemoveBgEditEnabled(false);
            setEditingCategory(null);
        } catch (error: any) {
            console.error('Error saving category:', error);
            showToast(error.response?.data?.error || error.message || 'Failed to save category', 'error');
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
            showToast(error.response?.data?.error || error.message || 'Failed to delete category', 'error');
        }
    };

    return (
        <div style={{ padding: 'var(--spacing-xl)', maxWidth: '1400px', margin: '0 auto', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-xl)', gap: '1rem', flexWrap: 'wrap' }}>
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
                                color: activeTab === tab.id ? 'white' : 'var(--text-black)',
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
                    <Button onClick={() => {
                            if (!canAdd) { showToast("Ask Admin for permission", "error"); return; }
                            handleAddCategory();
                        }}
                        icon={<MdAdd size={20} />}
                        disabled={!canAdd}
                        title={!canAdd ? "Ask Admin for permission" : ""}
                        style={{ height: '44px', padding: '0 1.5rem', opacity: !canAdd ? 0.5 : 1, cursor: !canAdd ? 'not-allowed' : 'pointer' }}
                    >
                        New Category
                    </Button>
                </div>
            </div>

            <div className="glass-card" style={{
                borderRadius: '1.25rem',
                overflow: 'hidden',
                border: '1px solid var(--glass-border)'
            }}>
                <Table
                    columns={columns}
                    data={paginatedCategories}
                    isLoading={categoriesLoading}
                    skeletonCount={10}
                />

                {filteredCategories.length > itemsPerPage && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '1.5rem',
                        borderTop: '1px solid var(--border-light)'
                    }}>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-black)' }}>
                            Showing <span style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{startIndex + 1}</span> to{' '}
                            <span style={{ fontWeight: 600, color: 'var(--text-dark)' }}>
                                {Math.min(startIndex + itemsPerPage, filteredCategories.length)}
                            </span>{' '}
                            of <span style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{filteredCategories.length}</span> categories
                        </div>

                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                <button
                                    key={page}
                                    onClick={() => setCurrentPage(page)}
                                    style={{
                                        padding: '0.5rem 0.75rem',
                                        borderRadius: '0.5rem',
                                        border: '1px solid var(--border)',
                                        background: currentPage === page ? 'var(--primary)' : 'var(--bg-card)',
                                        color: currentPage === page ? 'white' : 'var(--text-black)',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        fontSize: '0.875rem',
                                        fontWeight: 600,
                                        minWidth: '2.5rem'
                                    }}
                                >
                                    {page}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

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
                                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-black)' }}>
                                    {activeTab === 'service' ? 'Service' : activeTab === 'product' ? 'Product' : 'Expense'}
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-col">
                            <Input
                                label="Category Name"
                                placeholder="Enter category name"
                                value={categoryName}
                                onChange={(e) => setCategoryName(e.target.value)}
                            />
                            {formErrors.name && <span style={{ color: 'red', fontSize: '0.75rem', marginTop: '-0.25rem', marginBottom: '0.5rem', display: 'block' }}>{formErrors.name}</span>}
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-dark)', marginBottom: '0.5rem' }}>
                                Status
                            </label>
                            <select
                                value={categoryActive ? 'true' : 'false'}
                                onChange={(e) => setCategoryActive(e.target.value === 'true')}
                                className="form-control"
                                style={{ height: '45px' }}
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
                            className="form-control"
                            style={{ height: 'auto', resize: 'vertical' }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-dark)', marginBottom: '0.5rem' }}>
                            Category Image
                        </label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <input
                                    type="checkbox"
                                    id="remove-bg-category"
                                    checked={editingCategory ? removeBgEditEnabled : removeBgAddEnabled}
                                    onChange={(e) => editingCategory ? setRemoveBgEditEnabled(e.target.checked) : setRemoveBgAddEnabled(e.target.checked)}
                                    style={{ width: '1rem', height: '1rem', cursor: 'pointer', accentColor: 'var(--primary)' }}
                                />
                                <label htmlFor="remove-bg-category" style={{ fontSize: '0.85rem', color: 'var(--text-black)', cursor: 'pointer' }}>
                                    Remove background using AI
                                </label>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
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
                                        background: isUploading ? 'var(--text-light)' : 'var(--primary)',
                                        color: 'white',
                                        borderRadius: '0.5rem',
                                        cursor: isUploading ? 'not-allowed' : 'pointer',
                                        fontWeight: 600,
                                        fontSize: '0.9rem',
                                        display: 'inline-block'
                                    }}
                                >
                                    {isUploading ? 'Uploading...' : 'Choose File'}
                                </label>

                                {categoryImgUrl && (
                                    <div style={{ position: 'relative', width: '60px', height: '60px' }}>
                                        <img
                                            src={categoryImgUrl}
                                            alt="Preview"
                                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '0.5rem', border: '1px solid var(--border)' }}
                                        />
                                        <button
                                            type="button"
                                            onClick={handleRemoveImage}
                                            style={{
                                                position: 'absolute',
                                                top: '-8px',
                                                right: '-8px',
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '50%',
                                                background: 'var(--danger)',
                                                color: 'white',
                                                border: '2px solid white',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <MdClose size={12} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

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
        </div>
    );
};

export default Category;
