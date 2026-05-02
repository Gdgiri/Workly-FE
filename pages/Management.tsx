import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Edit2, Mail, Phone, Clock, FileSpreadsheet, UploadCloud, Download, Calendar, LayoutGrid, List as ListIcon, AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { MdClose, MdAdd } from 'react-icons/md';
import { Table, Button, Card, Modal, Input, Select, SearchableSelect, Skeleton } from '../components/UI';
import { Stylist, Service, Customer, Appointment } from '../types';
import { useToast } from '../components/ToastContext';
import { useCurrency } from '../components/CurrencyContext';

import { useAuth } from '../hooks/useAuth';
import api from '../utils/api';
import { ServiceAvatar } from '../components/ServiceAvatar';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinary';
import { removeImageBackground } from '../utils/backgroundRemoval';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../redux/store';
import { fetchServices, createService, updateService } from '../redux/slices/serviceSlice';

/*
  Contains three sub-views for simpler file management in this demo.
*/

// --- SERVICES VIEW ---
export const ServicesView: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { services, categories: serviceCategories, loading } = useSelector((state: RootState) => state.services);

  const { showToast } = useToast();
  const { symbol, formatPrice } = useCurrency();
  const { user, isStaff, isAdmin, isManager, hasPermission } = useAuth();
  const canAdd = hasPermission('services', 'add');
  const canEdit = hasPermission('services', 'edit');

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // services, loading are now from Redux
  const [isInitialLoading, setIsInitialLoading] = useState(false); // No longer needed as much, but kept for compatibility

  // Add Service State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newService, setNewService] = useState({ name: '', description: '', category: '', duration: 60, price: 50, active: true, imgUrl: '', checklistTemplateId: '' });

  // Edit Service State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  // Service categories state - FROM REDUX NOW
  // const [serviceCategories, setServiceCategories] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddCategoryOptions, setShowAddCategoryOptions] = useState(false);
  const [showEditCategoryOptions, setShowEditCategoryOptions] = useState(false);

  // Loading state for form submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [isUploading, setIsUploading] = useState(false);
  const [removeBgAddEnabled, setRemoveBgAddEnabled] = useState(false);
  const [removeBgEditEnabled, setRemoveBgEditEnabled] = useState(false);
  const [checklistTemplates, setChecklistTemplates] = useState<any[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // --- HANDLERS ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImportFile(e.target.files[0]);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean = false) => {
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
      const isBgRemovalChecked = isEdit ? removeBgEditEnabled : removeBgAddEnabled;
      if (isBgRemovalChecked) {
        showToast('Removing background...', 'info');
        fileToUpload = await removeImageBackground(file);
      }
      const url = await uploadToCloudinary(fileToUpload);
      if (isEdit && editingService) {
        setEditingService({ ...editingService, imgUrl: url });
      } else {
        setNewService({ ...newService, imgUrl: url });
      }
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

  const handleRemoveImage = async (isEdit: boolean = false) => {
    const url = isEdit ? editingService?.imgUrl : newService.imgUrl;
    if (!url) return;

    try {
      await deleteFromCloudinary(url);
      if (isEdit && editingService) {
        setEditingService({ ...editingService, imgUrl: '' });
      } else {
        setNewService({ ...newService, imgUrl: '' });
      }
      showToast('Image removed from server', 'success');
    } catch (error: any) {
      console.error('Cloudinary delete error:', error);
      showToast(error.message || 'Failed to remove image', 'error');
      if (isEdit && editingService) {
        setEditingService({ ...editingService, imgUrl: '' });
      } else {
        setNewService({ ...newService, imgUrl: '' });
      }
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) return;

    setIsSubmitting(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());

        if (lines.length < 2) {
          showToast('CSV file is empty or invalid', 'error');
          setIsSubmitting(false);
          return;
        }

        // Parse headers
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const columnMap: any = {};
        headers.forEach((header, index) => {
          if (header.includes('name')) columnMap.name = index;
          else if (header.includes('description')) columnMap.description = index;
          else if (header.includes('duration')) columnMap.duration = index;
          else if (header.includes('price')) columnMap.price = index;
          else if (header.includes('category')) columnMap.category = index;
          else if (header.includes('active')) columnMap.isActive = index;
        });

        // Validation
        if (columnMap.name === undefined || columnMap.price === undefined || columnMap.duration === undefined) {
          showToast('CSV must have columns for Name, Price and Duration', 'error');
          setIsSubmitting(false);
          return;
        }

        const servicesToImport = [];

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim());
          if (values.length < 3) continue;

          servicesToImport.push({
            name: values[columnMap.name],
            description: values[columnMap.description] || '',
            duration: parseInt(values[columnMap.duration]) || 30,
            price: parseFloat(values[columnMap.price]) || 0,
            category: values[columnMap.category] || 'General',
            isActive: values[columnMap.isActive]?.toLowerCase() === 'true' || values[columnMap.isActive] === '1'
          });
        }

        if (servicesToImport.length === 0) {
          showToast('No valid services found in CSV', 'error');
          setIsSubmitting(false);
          return;
        }

        // Send single bulk request
        const response = await api.post('/services/bulk', { services: servicesToImport });
        const { successCount: sCount, errorCount: eCount, errors } = response.data;

        if (eCount > 0) {
          console.warn('Some services failed to import:', errors);
          showToast(`Import completed! ${sCount} successful, ${eCount} duplicates or errors skipped.`, 'warning');
        } else {
          showToast(`Successfully imported all ${sCount} services`, 'success');
        }

        await dispatch(fetchServices());
        setIsImportModalOpen(false);
        setImportFile(null);
      } catch (error: any) {
        console.error('Error reading file:', error);
        showToast(error.response?.data?.error || error.message || 'Error processing file', 'error');
      } finally {
        setIsSubmitting(false);
      }
    };

    reader.readAsText(importFile);
  };

  const handleDownloadTemplate = (e: React.MouseEvent) => {
    e.preventDefault();

    // Define CSV headers based on Service model
    const headers = ['Name', 'Description', 'Duration', 'Price', 'Category', 'Active'];
    const csvContent = headers.join(',') + '\n' +
      'Example Service,This is a sample description,60,50.00,General,true';

    // Create Blob and download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'service_import_template.csv');
    document.body.appendChild(link);

    // Trigger download
    link.click();

    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('Template downloaded successfully', 'success');
  };

  // --- CRUD HANDLERS ---
  // --- CRUD HANDLERS ---

  React.useEffect(() => {
    dispatch(fetchServices());

    const fetchTemplates = async () => {
      try {
        const response = await api.get('/checklists/templates');
        // Handle response.data.data according to ChecklistBuilder.tsx logic
        const data = response.data.data || response.data;
        setChecklistTemplates(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to fetch checklist templates', err);
      }
    };
    fetchTemplates();
  }, [dispatch]);

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;

    // VALIDATION
    const newErrors: Record<string, string> = {};
    if (!newService.name.trim()) newErrors.name = 'Service name is required';
    if (!newService.category.trim()) newErrors.category = 'Category is required';
    if (newService.price <= 0) newErrors.price = 'Price must be greater than 0';
    if (newService.duration <= 0) newErrors.duration = 'Duration must be greater than 0';

    if (Object.keys(newErrors).length > 0) {
      setFormErrors(newErrors);
      showToast('Please fill all required fields correctly', 'error');
      return;
    }

    setFormErrors({});
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      // Map frontend active to backend isActive
      const payload = {
        ...newService,
        isActive: newService.active
      };

      await dispatch(createService(payload)).unwrap();

      showToast('Service added successfully', 'success');
      setIsAddModalOpen(false);
      setNewService({ name: '', description: '', category: '', duration: 60, price: 50, active: true, imgUrl: '', checklistTemplateId: '' });
      setRemoveBgAddEnabled(false);
      // No need to fetch again, redux updates state

    } catch (error: any) {
      console.error('Error adding service:', error);
      showToast(error.response?.data?.error || error.message || error || 'Failed to add service', 'error');
    } finally {
      setIsSubmitting(false);
      submittingRef.current = false;
    }
  };

  const handleEditService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || !editingService) return;

    // VALIDATION
    const newErrors: Record<string, string> = {};
    if (!editingService.name.trim()) newErrors.name = 'Service name is required';
    if (!editingService.category.trim()) newErrors.category = 'Category is required';
    if (editingService.price <= 0) newErrors.price = 'Price must be greater than 0';
    if (editingService.duration <= 0) newErrors.duration = 'Duration must be greater than 0';

    if (Object.keys(newErrors).length > 0) {
      setFormErrors(newErrors);
      showToast('Please fill all required fields correctly', 'error');
      return;
    }

    setFormErrors({});
    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      // Map frontend active to backend isActive
      const payload = {
        ...editingService,
        isActive: editingService.active
      };

      await dispatch(updateService({ id: editingService.id, data: payload })).unwrap();

      showToast('Service updated successfully', 'success');
      setIsEditModalOpen(false);
      setEditingService(null);
      setRemoveBgEditEnabled(false);
      // No need to fetch again
    } catch (error: any) {
      console.error('Error updating service:', error);
      showToast(error.response?.data?.error || error.message || error || 'Failed to update service', 'error');
    } finally {
      setIsSubmitting(false);
      submittingRef.current = false;
    }
  };

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

  const filteredServices = services.filter(service =>
    (service.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (service.category || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate Pagination
  const totalPages = Math.ceil(filteredServices.length / itemsPerPage);
  const paginatedServices = filteredServices.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset page when search changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // --- SKELETON COMPONENT ---
  const ServiceCardSkeleton = () => (
    <Card className="p-4" style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: '180px' }}>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <Skeleton width="60px" height="60px" borderRadius="12px" />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.625rem' }}>
            <Skeleton width="60%" height="1.25rem" />
            <Skeleton width="50px" height="1.2rem" borderRadius="var(--radius-sm)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Skeleton width="40px" height="1rem" borderRadius="var(--radius-sm)" />
            <Skeleton width="60px" height="1rem" />
          </div>
        </div>
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: '1rem',
        borderTop: '1px solid var(--border-light)',
        marginTop: 'auto'
      }}>
        <Skeleton width="80px" height="1.8rem" />
        <Skeleton width="24px" height="24px" borderRadius="var(--radius-sm)" />
      </div>
    </Card>
  );

  return (
    <div className="space-y-6" style={{ position: 'relative' }}>
      {/* Loading Overlay */}
      {/* Loading Skeleton */}


      {!isInitialLoading && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
            {/* Search Input */}
            <div className="relative" style={{ height: '40px' }}>
              <input
                type="text"
                placeholder="Search services..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  height: '100%',
                  padding: '0 1rem 0 2.5rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border)',
                  fontSize: '0.875rem',
                  width: '240px'
                }}
              />
              <div style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-black)', display: 'flex' }}>
                <ListIcon size={16} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <>
                <Button 
                    onClick={() => {
                        if (!canAdd) { showToast("Ask Admin for permission", "error"); return; }
                        setIsImportModalOpen(true);
                    }} 
                    variant="secondary" 
                    icon={<FileSpreadsheet size={18} />}
                    disabled={!canAdd}
                    title={!canAdd ? "Ask Admin for permission" : ""}
                    style={{ opacity: !canAdd ? 0.5 : 1, cursor: !canAdd ? 'not-allowed' : 'pointer' }}
                >
                    Import Excel
                </Button>
                <Button 
                    onClick={() => {
                        if (!canAdd) { showToast("Ask Admin for permission", "error"); return; }
                        setIsAddModalOpen(true);
                    }}
                    disabled={!canAdd}
                    title={!canAdd ? "Ask Admin for permission" : ""}
                    style={{ opacity: !canAdd ? 0.5 : 1, cursor: !canAdd ? 'not-allowed' : 'pointer' }}
                >
                    Add Service
                </Button>
              </>
            </div>
          </div>

          {/* Debug Info */}
          {/* <div style={{ padding: '1rem', background: '#f0f0f0', borderRadius: '0.5rem', fontSize: '0.875rem' }}>
        <strong>Debug:</strong> Services count: {filteredServices.length}
      </div> */}

          {/* Services Grid with Images */}
          {loading && services.length === 0 ? (
            <div className="grid md-grid-cols-2 lg-grid-cols-3 gap-6">
              {Array.from({ length: 9 }).map((_, i) => (
                <ServiceCardSkeleton key={`service-skeleton-${i}`} />
              ))}
            </div>
          ) : filteredServices.length > 0 ? (
            <>
              <div className="grid md-grid-cols-2 lg-grid-cols-3 gap-6">
                {paginatedServices.map((service, idx) => (
                  <motion.div
                    key={service.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <Card
                      className="hover:shadow-lg transition-shadow"
                      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
                    >
                      {/* Service Header with Avatar */}
                      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                        <ServiceAvatar name={service.name} imgUrl={service.imgUrl} size={60} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                            <h3 style={{ fontWeight: 'bold', margin: '0', color: 'var(--text-dark)', fontSize: '1.1rem', flex: 1, marginRight: '0.5rem' }}>{service.name}</h3>
                            <span className={`badge ${service.active ? 'badge-success' : 'badge-danger'}`} style={{ whiteSpace: 'nowrap' }}>
                              {service.active ? 'Active' : 'Inactive'}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>{service.category}</span>
                            <span style={{ fontSize: '0.875rem', color: 'var(--text-black)' }}>
                              <Clock size={14} style={{ display: 'inline', marginRight: '0.25rem', verticalAlign: 'middle' }} />
                              {service.duration} min
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Footer: Price & Action */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid var(--border)', marginTop: 'auto' }}>
                        <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>{formatPrice(service.price)}</span>
                        <div className="flex space-x-2">
                          <button
                              onClick={(e) => { 
                                  if (!canEdit) { showToast("Ask Admin for permission", "error"); return; }
                                  setEditingService(service); 
                                  setIsEditModalOpen(true); 
                              }}
                              style={{ 
                                  color: 'var(--primary)', 
                                  border: 'none', 
                                  background: 'none', 
                                  cursor: !canEdit ? 'not-allowed' : 'pointer', 
                                  padding: '0.25rem',
                                  opacity: !canEdit ? 0.5 : 1
                              }}
                              disabled={!canEdit}
                              title={!canEdit ? "Ask Admin for permission" : "Edit Service"}
                            >
                              <Edit2 size={16} />
                            </button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center mt-6 bg-white p-4 rounded-lg shadow-sm border border-slate-100">
                  <div className="text-sm text-black font-medium">
                    Showing <span className="text-black font-bold">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-black font-bold">{Math.min(currentPage * itemsPerPage, filteredServices.length)}</span> of <span className="text-black font-bold">{filteredServices.length}</span> results
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      style={{ opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                    >
                      Previous
                    </Button>
                    <div className="flex gap-1">
                      {Array.from({ length: totalPages }).map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentPage(i + 1)}
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '0.5rem',
                            fontWeight: 'bold',
                            background: currentPage === i + 1 ? 'var(--primary)' : 'transparent',
                            color: currentPage === i + 1 ? 'white' : 'var(--text-black)',
                            border: currentPage === i + 1 ? 'none' : '1px solid var(--border)',
                            cursor: 'pointer'
                          }}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      style={{ opacity: currentPage === totalPages ? 0.5 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-black)' }}>
              <p className="text-lg font-medium">No services found matching your search.</p>
            </div>
          )}

          {/* IMPORT MODAL */}
          <Modal
            isOpen={isImportModalOpen}
            onClose={() => setIsImportModalOpen(false)}
            title="Import Services from Excel"
          >
            <form className="space-y-6" onSubmit={handleImportSubmit}>
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed var(--border)',
                  borderRadius: '0.75rem',
                  padding: '2rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: '#f8fafc',
                  transition: 'all 0.2s'
                }}
                className="hover:bg-gray-100 hover:border-primary"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                />
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                  <div style={{ padding: '1rem', background: 'white', borderRadius: '50%', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                    <UploadCloud size={32} className="text-primary" />
                  </div>
                </div>
                {importFile ? (
                  <div>
                    <p style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{importFile.name}</p>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-black)' }}>{(importFile.size / 1024).toFixed(2)} KB</p>
                  </div>
                ) : (
                  <div>
                    <p style={{ fontWeight: 600, color: 'var(--text-dark)' }}>Click or Drag file to upload</p>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-black)' }}>Support for .xlsx, .xls or .csv</p>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <a href="#" onClick={handleDownloadTemplate} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>
                  <Download size={16} /> Download Template
                </a>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <Button type="button" variant="ghost" onClick={() => setIsImportModalOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={!importFile || isSubmitting}>Upload & Import</Button>
                </div>
              </div>
            </form>
          </Modal>

          {/* ADD SERVICE MODAL */}
          <Modal
            isOpen={isAddModalOpen}
            onClose={() => { setIsAddModalOpen(false); setRemoveBgAddEnabled(false); }}
            title="Add New Service"
          >
            <form className="space-y-3" onSubmit={handleAddService}>
              <div className="flex flex-col">
                <Input
                  label="Service Name"
                  placeholder="e.g. Luxury Facial"
                  value={newService.name}
                  onChange={e => setNewService({ ...newService, name: e.target.value })}
                />
                {formErrors.name && <span style={{ color: 'red', fontSize: '0.75rem', marginTop: '-1rem', marginBottom: '1rem', display: 'block' }}>{formErrors.name}</span>}
              </div>

              <div>
                <label className="input-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>Description</label>
                <textarea
                  placeholder="Service description..."
                  value={newService.description}
                  onChange={e => setNewService({ ...newService, description: e.target.value })}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)', minHeight: '100px', fontFamily: 'inherit', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label className="input-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>Service Image (Optional)</label>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <input
                    type="checkbox"
                    id="remove-bg-service-add"
                    checked={removeBgAddEnabled}
                    onChange={(e) => setRemoveBgAddEnabled(e.target.checked)}
                    style={{ width: '1rem', height: '1rem', cursor: 'pointer', accentColor: 'var(--primary)' }}
                  />
                  <label htmlFor="remove-bg-service-add" style={{ fontSize: '0.85rem', color: '#64748b', cursor: 'pointer' }}>
                    Remove background using AI
                  </label>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <input
                    type="file"
                    id="add-service-image"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, false)}
                    style={{ display: 'none' }}
                  />
                  <label
                    htmlFor="add-service-image"
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

                  {newService.imgUrl && (
                    <div style={{ position: 'relative', width: '80px', height: '80px' }}>
                      <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '0.75rem',
                        overflow: 'hidden',
                        border: '1px solid var(--border)',
                        background: 'var(--bg-body)'
                      }}>
                        <img
                          src={newService.imgUrl}
                          alt="Preview"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(false)}
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

              <div className="grid md-grid-cols-4 gap-4" style={{ display: 'grid', gridTemplateColumns: '0.7fr 0.7fr 1fr 1.6fr' }}>
                <div className="flex flex-col">
                  <Input
                    label="Duration (min)"
                    type="number"
                    value={newService.duration}
                    onChange={e => setNewService({ ...newService, duration: parseInt(e.target.value) })}
                  />
                  {formErrors.duration && <span style={{ color: 'red', fontSize: '0.75rem', marginTop: '-0.25rem', marginBottom: '0.5rem', display: 'block' }}>{formErrors.duration}</span>}
                </div>
                <div className="flex flex-col">
                  <Input
                    label={`Price (${symbol})`}
                    type="number"
                    value={newService.price}
                    onChange={e => setNewService({ ...newService, price: parseFloat(e.target.value) })}
                  />
                  {formErrors.price && <span style={{ color: 'red', fontSize: '0.75rem', marginTop: '-0.25rem', marginBottom: '0.5rem', display: 'block' }}>{formErrors.price}</span>}
                </div>
                <Select
                  label="Status"
                  value={newService.active ? 'active' : 'inactive'}
                  onChange={e => setNewService({ ...newService, active: e.target.value === 'active' })}
                  options={[
                    { value: 'active', label: 'Active' },
                    { value: 'inactive', label: 'Inactive' }
                  ]}
                />

                <Select
                  label="Service Checklist"
                  value={newService.checklistTemplateId}
                  onChange={e => setNewService({ ...newService, checklistTemplateId: e.target.value })}
                  options={[
                    { value: '', label: 'None' },
                    ...checklistTemplates.map(template => ({
                      value: template.id,
                      label: template.name
                    }))
                  ]}
                />

                <div className="input-group" style={{ position: 'relative' }}>
                  <label className="input-label">Category</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Select or type category..."
                    value={newService.category}
                    onChange={(e) => {
                      setNewService({ ...newService, category: e.target.value });
                      setShowAddCategoryOptions(true);
                    }}
                    onFocus={() => setShowAddCategoryOptions(true)}
                    onBlur={() => setTimeout(() => setShowAddCategoryOptions(false), 200)}
                    required
                  />
                  {showAddCategoryOptions && (
                    <div style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: 0,
                      right: 0,
                      background: 'white',
                      borderRadius: '0.5rem',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      zIndex: 50,
                      maxHeight: '200px',
                      overflowY: 'auto',
                      border: '1px solid var(--border)',
                      marginBottom: '0.25rem'
                    }}>
                      {serviceCategories
                        .filter(cat => cat.toLowerCase().includes(newService.category.toLowerCase()))
                        .map(cat => (
                          <div
                            key={cat}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setNewService({ ...newService, category: cat });
                              setShowAddCategoryOptions(false);
                            }}
                            style={{
                              padding: '0.5rem 1rem',
                              cursor: 'pointer',
                              fontSize: '0.9rem',
                              color: 'var(--text-dark)',
                              borderBottom: '1px solid #f1f5f9'
                            }}
                            className="hover:bg-gray-50"
                          >
                            {cat}
                          </div>
                        ))
                      }
                      {serviceCategories.filter(cat => cat.toLowerCase().includes(newService.category.toLowerCase())).length === 0 && (
                        <div style={{ padding: '0.5rem 1rem', color: 'var(--text-black)', fontSize: '0.85rem' }}>Type to create a new category</div>
                      )}
                    </div>
                  )}
                  {formErrors.category && <span style={{ color: 'red', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>{formErrors.category}</span>}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <Button type="button" variant="ghost" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>Add Service</Button>
              </div>
            </form>
          </Modal>

          {/* EDIT SERVICE MODAL */}
          <Modal
            isOpen={isEditModalOpen}
            onClose={() => { setIsEditModalOpen(false); setEditingService(null); }}
            title="Edit Service"
          >
            {editingService && (
              <form className="space-y-3" onSubmit={handleEditService}>
                <Input
                  label="Service Name"
                  placeholder="e.g. Luxury Facial"
                  value={editingService.name}
                  onChange={e => setEditingService({ ...editingService, name: e.target.value })}
                  required
                />

                <div>
                  <label className="input-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>Description</label>
                  <textarea
                    placeholder="Service description..."
                    value={editingService.description || ''}
                    onChange={e => setEditingService({ ...editingService, description: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)', minHeight: '100px', fontFamily: 'inherit', fontSize: '0.875rem' }}
                  />
                </div>

                {/* Image Upload */}
                <div>
                  <label className="input-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>Service Image (Optional)</label>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <input
                      type="checkbox"
                      id="remove-bg-service-edit"
                      checked={removeBgEditEnabled}
                      onChange={(e) => setRemoveBgEditEnabled(e.target.checked)}
                      style={{ width: '1rem', height: '1rem', cursor: 'pointer', accentColor: 'var(--primary)' }}
                    />
                    <label htmlFor="remove-bg-service-edit" style={{ fontSize: '0.85rem', color: '#64748b', cursor: 'pointer' }}>
                      Remove background using AI
                    </label>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <input
                      type="file"
                      id="edit-service-image"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, true)}
                      style={{ display: 'none' }}
                    />
                    <label
                      htmlFor="edit-service-image"
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

                    {editingService.imgUrl && (
                      <div style={{ position: 'relative', width: '80px', height: '80px' }}>
                        <div style={{
                          width: '80px',
                          height: '80px',
                          borderRadius: '0.75rem',
                          overflow: 'hidden',
                          border: '1px solid var(--border)',
                          background: 'var(--bg-body)'
                        }}>
                          <img
                            src={editingService.imgUrl}
                            alt="Preview"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(true)}
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

                <div className="grid md-grid-cols-4 gap-4" style={{ display: 'grid', gridTemplateColumns: '0.7fr 0.7fr 1fr 1.6fr' }}>
                  <Input
                    label="Duration (min)"
                    type="number"
                    value={editingService.duration}
                    onChange={e => setEditingService({ ...editingService, duration: parseInt(e.target.value) })}
                    required
                  />
                  <Input
                    label={`Price (${symbol})`}
                    type="number"
                    value={editingService.price}
                    onChange={e => setEditingService({ ...editingService, price: parseFloat(e.target.value) })}
                    required
                  />
                  <Select
                    label="Status"
                    value={editingService.active ? 'active' : 'inactive'}
                    onChange={e => setEditingService({ ...editingService, active: e.target.value === 'active' })}
                    options={[
                      { value: 'active', label: 'Active' },
                      { value: 'inactive', label: 'Inactive' }
                    ]}
                  />

                  <Select
                    label="Service Checklist"
                    value={editingService.checklistTemplateId || ''}
                    onChange={e => setEditingService({ ...editingService, checklistTemplateId: e.target.value })}
                    options={[
                      { value: '', label: 'None' },
                      ...checklistTemplates.map(template => ({
                        value: template.id,
                        label: template.name
                      }))
                    ]}
                  />

                  <div className="input-group" style={{ position: 'relative' }}>
                    <label className="input-label">Category</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Select or type category..."
                      value={editingService.category}
                      onChange={(e) => {
                        setEditingService({ ...editingService, category: e.target.value });
                        setShowEditCategoryOptions(true);
                      }}
                      onFocus={() => setShowEditCategoryOptions(true)}
                      onBlur={() => setTimeout(() => setShowEditCategoryOptions(false), 200)}
                      required
                    />
                    {showEditCategoryOptions && (
                      <div style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: 0,
                        right: 0,
                        background: 'white',
                        borderRadius: '0.5rem',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        zIndex: 50,
                        maxHeight: '200px',
                        overflowY: 'auto',
                        border: '1px solid var(--border)',
                        marginBottom: '0.25rem'
                      }}>
                        {serviceCategories
                          .filter(cat => cat.toLowerCase().includes((editingService.category || '').toLowerCase()))
                          .map(cat => (
                            <div
                              key={cat}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setEditingService({ ...editingService, category: cat });
                                setShowEditCategoryOptions(false);
                              }}
                              style={{
                                padding: '0.5rem 1rem',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                color: 'var(--text-dark)',
                                borderBottom: '1px solid #f1f5f9'
                              }}
                              className="hover:bg-gray-50"
                            >
                              {cat}
                            </div>
                          ))
                        }
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                  <Button type="button" variant="ghost" onClick={() => { setIsEditModalOpen(false); setEditingService(null); setRemoveBgEditEnabled(false); }}>Cancel</Button>
                  <Button type="submit" disabled={isSubmitting}>Update Service</Button>
                </div>
              </form>
            )}
          </Modal>
        </>
      )
      }
    </div >
  );
};

// --- STYLISTS VIEW ---

// --- CUSTOMERS VIEW ---
interface CustomersViewProps {
  customers: Customer[];
}

export const CustomersView: React.FC<CustomersViewProps> = ({ customers = [] }) => {
  const { formatPrice } = useCurrency();

  const columns = [
    { header: 'Name', accessor: 'name' as keyof Customer, className: 'font-medium' },
    { header: 'Contact', accessor: (row: Customer) => <div style={{ fontSize: '0.875rem', color: 'var(--text-black)' }}>{row.email}<br />{row.phone}</div> },
    { header: 'Visits', accessor: 'totalAppointments' as keyof Customer },
    { header: 'Total Spend', accessor: (row: Customer) => formatPrice(row.totalSpend) },
    { header: 'Last Visit', accessor: 'lastVisit' as keyof Customer },
    { header: 'Actions', accessor: () => <Button variant="ghost" style={{ color: 'var(--primary)' }}>View Profile</Button> }
  ];

  return (
    <div className="space-y-6">
      <Table columns={columns} data={customers} />
    </div>
  );
};
