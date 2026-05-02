import React, { useState, useEffect } from 'react';
import { Skeleton } from '../components/Skeleton';
import { Plus, Edit2, Trash2, ShoppingBag, Scissors, Package as PackageIcon, Check, CalendarClock, Search, Filter, Download, Upload } from 'lucide-react';
import { MdClose } from 'react-icons/md';
import { Table, Button, Modal, Input, Select } from '../components/UI';
import { ComboPackage, ComboItem } from '../types';
import { useToast } from '../components/ToastContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useCurrency } from '../components/CurrencyContext';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import { ServiceAvatar } from '../components/ServiceAvatar';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinary';
import { removeImageBackground } from '../utils/backgroundRemoval';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../redux/store';
import { fetchPackages, createPackage, updatePackage, deletePackage } from '../redux/slices/packageSlice';
import { fetchServices } from '../redux/slices/serviceSlice';
import { fetchInventory } from '../redux/slices/inventorySlice';

/* 
  API NOTES:
  GET /combos
  POST /combos (Create new combo)
  PUT /combos/{id} (Update existing combo)
  DELETE /combos/{id} (Remove combo)
 */

const ItemSelector = ({
  title,
  icon: Icon,
  type,
  items,
  selectedItems,
  onToggleItem,
  onQuantityChange
}: {
  title: string,
  icon: any,
  type: 'service' | 'product',
  items: string[],
  selectedItems: ComboItem[],
  onToggleItem: (item: string, type: 'service' | 'product') => void,
  onQuantityChange: (item: string, qty: string) => void
}) => (
  <div style={{
    background: 'white',
    borderRadius: '0.75rem',
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
  }}>
    <div style={{
      padding: '0.75rem 1rem',
      borderBottom: '1px solid #e2e8f0',
      background: '#f8fafc',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Icon size={16} className="text-black" />
        <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569', letterSpacing: '0.05em' }}>{title}</span>
      </div>
      <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>{items.length} available</span>
    </div>

    <div style={{ maxHeight: '300px', overflowY: 'auto', padding: '0.5rem', flex: 1 }}>
      {items.length > 0 ? (
        items.map(item => {
          const isSelected = selectedItems.find(i => i.name === item);
          return (
            <div
              key={item}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.5rem',
                transition: 'all 0.15s ease',
                marginBottom: '0.35rem',
                background: isSelected ? '#f0f9ff' : 'transparent',
                border: isSelected ? '1px solid #bae6fd' : '1px solid transparent'
              }}
              className="hover:bg-slate-50"
            >
              <div
                style={{ flex: 1, display: 'flex', alignItems: 'flex-start', cursor: 'pointer' }}
                onClick={() => onToggleItem(item, type)}
              >
                <div style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '1.75rem',
                  height: '1.35rem',
                  marginRight: '0.75rem',
                  marginTop: '0.15rem',
                  flexShrink: 0
                }}>
                  <input
                    type="checkbox"
                    checked={!!isSelected}
                    readOnly
                    style={{
                      appearance: 'none',
                      width: '100%',
                      height: '100%',
                      border: isSelected ? 'none' : '2px solid #cbd5e1',
                      borderRadius: '0.25rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      backgroundColor: isSelected ? 'var(--primary)' : 'white'
                    }}
                  />
                  {isSelected && (
                    <Check
                      size={12}
                      color="white"
                      strokeWidth={3}
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        pointerEvents: 'none'
                      }}
                    />
                  )}
                </div>
                <span style={{ fontSize: '0.9rem', color: isSelected ? '#0f172a' : '#334155', fontWeight: isSelected ? 500 : 400, lineHeight: 1.4 }}>{item}</span>
              </div>

              {isSelected && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '0.5rem', paddingLeft: '0.75rem', borderLeft: '1px solid #e0f2fe', alignSelf: 'flex-start' }}>
                  <span style={{ fontSize: '0.5rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Qty</span>
                  <input
                    type="number"
                    min="1"
                    value={isSelected.quantity || ''}
                    onChange={(e) => onQuantityChange(item, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      width: '4.5rem',
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.9rem',
                      borderRadius: '0.375rem',
                      border: '1px solid #cbd5e1',
                      textAlign: 'center',
                      color: '#0f172a',
                      fontWeight: 600,
                      background: 'white',
                      height: '2rem'
                    }}
                  />
                </div>
              )}
            </div>
          );
        })
      ) : (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
          No {title.toLowerCase()} found
        </div>
      )}
    </div>
  </div>
);

const Packages: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { packages, loading: packagesLoading } = useSelector((state: RootState) => state.packages);
  const { services } = useSelector((state: RootState) => state.services);
  const { products } = useSelector((state: RootState) => state.inventory);

  const { showToast } = useToast();
  const { symbol, formatPrice } = useCurrency();
  const { user, isStaff, isAdmin, isManager, hasPermission } = useAuth();
  const canAdd = hasPermission('packages', 'add');
  const canEdit = hasPermission('packages', 'edit');
  const [isModalOpen, setIsModalOpen] = useState(false);
  // packages is from Redux
  const [searchTerm, setSearchTerm] = useState('');
  const [isInitialLoading, setIsInitialLoading] = useState(false);


  // Form State
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [active, setActive] = useState('active'); // 'active' | 'inactive'
  const [validity, setValidity] = useState(''); // number string
  const [selectedItems, setSelectedItems] = useState<ComboItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [removeBgAddEnabled, setRemoveBgAddEnabled] = useState(false);
  const [removeBgEditEnabled, setRemoveBgEditEnabled] = useState(false);
  const [activeItemTab, setActiveItemTab] = useState<'services' | 'products'>('services');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const availableServices = services.map(s => s.name);
  const availableProducts = products.map(p => p.name);
  const [imgUrl, setImgUrl] = useState(''); // Standardized image state

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
      const isBgRemovalChecked = editingId ? removeBgEditEnabled : removeBgAddEnabled;
      if (isBgRemovalChecked) {
        showToast('Removing background...', 'info');
        fileToUpload = await removeImageBackground(file);
      }
      const url = await uploadToCloudinary(fileToUpload);
      setImgUrl(url);
      showToast('Image uploaded successfully', 'success');
    } catch (error: any) {
      console.error('Cloudinary upload error:', error);
      showToast(error.message || 'Failed to upload image', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!imgUrl) return;

    try {
      await deleteFromCloudinary(imgUrl);
      setImgUrl('');
      showToast('Image removed from server', 'success');
    } catch (error: any) {
      console.error('Cloudinary delete error:', error);
      showToast(error.message || 'Failed to remove image', 'error');
      setImgUrl('');
    }
  };

  // Fetch data from backend on mount
  useEffect(() => {
    dispatch(fetchPackages());
    dispatch(fetchServices());
    dispatch(fetchInventory());
  }, [dispatch]);

  const openCreateModal = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setPrice('');
    setActive('active');
    setValidity('0');
    setSelectedItems([]);
    setImgUrl(''); // Reset image
    setRemoveBgAddEnabled(false);
    setIsModalOpen(true);
  };

  const openEditModal = (pkg: ComboPackage) => {
    setEditingId(pkg.id);
    setName(pkg.name);
    setDescription(pkg.description);
    setPrice(pkg.price.toString());
    setActive(pkg.active ? 'active' : 'inactive');
    setValidity(pkg.validityDays.toString());

    // Auto-filter out missing items when opening the modal
    const validItems = pkg.items.filter(item => {
      if (item.type === 'service') return availableServices.includes(item.name);
      if (item.type === 'product') return availableProducts.includes(item.name);
      return false;
    });

    setSelectedItems(validItems.map(item => ({ ...item })));
    setImgUrl(pkg.imgUrl || '');
    setRemoveBgEditEnabled(false);
    setIsModalOpen(true);
  };

  const handleToggleItem = (itemName: string, type: 'service' | 'product') => {
    setSelectedItems(prev => {
      const exists = prev.find(i => i.name === itemName);
      if (exists) {
        return prev.filter(i => i.name !== itemName);
      }
      return [...prev, { name: itemName, quantity: 1, type }];
    });
  };

  const handleQuantityChange = (itemName: string, qty: string) => {
    // Allow clearing the input (empty string)
    if (qty === '') {
      setSelectedItems(prev => prev.map(item =>
        item.name === itemName ? { ...item, quantity: 0 } : item
      ));
      return;
    }

    const quantity = parseInt(qty);
    if (isNaN(quantity) || quantity < 0) return;

    setSelectedItems(prev => prev.map(item =>
      item.name === itemName ? { ...item, quantity } : item
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // VALIDATION
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Package name is required';
    if (!price || parseFloat(price) <= 0) newErrors.price = 'Price must be greater than 0';
    if (selectedItems.length === 0) newErrors.items = 'At least one service or product must be included';

    if (Object.keys(newErrors).length > 0) {
      setFormErrors(newErrors);
      showToast('Please fill all required fields', 'error');
      return;
    }

    setFormErrors({});
    setIsSubmitting(true);

    const newPackage: any = {
      name,
      description,
      price: parseFloat(price) || 0,
      active: active === 'active',
      items: selectedItems,
      validityDays: parseInt(validity) || 0,
      imgUrl
    };

    try {
      if (editingId) {
        // Update existing package
        await dispatch(updatePackage({ id: editingId, data: newPackage })).unwrap();
        showToast('Package updated successfully!', 'success');
      } else {
        // Create new package
        // newPackage.id = Date.now(); // handled by backend
        await dispatch(createPackage(newPackage)).unwrap();
        showToast('Package created successfully!', 'success');
      }
      setIsModalOpen(false);
    } catch (error: any) {
      console.error('Error saving package:', error);
      showToast(error || 'Error saving package', 'error');
    } finally {
      setIsSubmitting(false);
      if (!editingId) setRemoveBgAddEnabled(false);
      else setRemoveBgEditEnabled(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this package?')) return;

    try {
      await dispatch(deletePackage(id)).unwrap();
      showToast('Package deleted successfully!', 'success');
    } catch (error: any) {
      console.error('Error deleting package:', error);
      showToast(error || 'Error deleting package', 'error');
    }
  };

  const columns = [
    {
      header: <span style={{ whiteSpace: 'nowrap' }}>Package Name</span>,
      accessor: (row: ComboPackage) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ServiceAvatar name={row.name} imgUrl={row.imgUrl} size={40} />
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-dark)', whiteSpace: 'nowrap' }}>{row.name}</div>
          </div>
        </div>
      ),
      skeleton: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Skeleton width="40px" height="40px" borderRadius="12px" />
          <Skeleton width="100px" height="1.2rem" />
        </div>
      ),
      className: 'w-[8%]'
    },
    {
      header: 'Description',
      accessor: (row: ComboPackage) => <span style={{ color: 'var(--text-black)', fontSize: '0.875rem' }}>{row.description}</span>,
      skeleton: <Skeleton width="120px" height="1rem" />,
      className: 'w-[3%]'
    },
    {
      header: 'Included Items',
      accessor: (row: ComboPackage) => {
        const safeItems = Array.isArray(row.items) ? row.items : [];
        const services = safeItems.filter(item => item.type === 'service');
        const products = safeItems.filter(item => item.type === 'product');

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {(() => {
              const visibleServices = services.filter(item => availableServices.includes(item.name));
              if (visibleServices.length === 0) return null;
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', width: '60px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Services</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {visibleServices.map((item, idx) => (
                      <span key={idx} style={{
                        fontSize: '0.75rem',
                        padding: '0.15rem 0.6rem',
                        background: '#eff6ff',
                        color: '#2563eb',
                        borderRadius: '99px',
                        border: '1px solid #dbeafe',
                        fontWeight: 500,
                        display: 'inline-flex',
                        alignItems: 'center'
                      }}>
                        {item.quantity > 1 && <span style={{ fontWeight: 700, marginRight: '0.25rem', opacity: 0.8 }}>{item.quantity}x</span>}
                        {item.name}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}
            {(() => {
              const visibleProducts = products.filter(item => availableProducts.includes(item.name));
              if (visibleProducts.length === 0) return null;
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', width: '60px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Products</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {visibleProducts.map((item, idx) => (
                      <span key={idx} style={{
                        fontSize: '0.75rem',
                        padding: '0.15rem 0.6rem',
                        background: '#fffbeb',
                        color: '#d97706',
                        borderRadius: '99px',
                        border: '1px solid #fef3c7',
                        fontWeight: 500,
                        display: 'inline-flex',
                        alignItems: 'center'
                      }}>
                        {item.quantity > 1 && <span style={{ fontWeight: 700, marginRight: '0.25rem', opacity: 0.8 }}>{item.quantity}x</span>}
                        {item.name}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        );
      },
      skeleton: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Skeleton width="40px" height="0.8rem" />
            <Skeleton width="60px" height="1.4rem" borderRadius="99px" />
            <Skeleton width="80px" height="1.4rem" borderRadius="99px" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Skeleton width="40px" height="0.8rem" />
            <Skeleton width="70px" height="1.4rem" borderRadius="99px" />
          </div>
        </div>
      ),
      className: 'w-[40%]'
    },
    {
      header: 'Price',
      accessor: (row: ComboPackage) => <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{formatPrice(row.price)}</span>,
      skeleton: <Skeleton width="60px" height="1.2rem" />,
      className: 'w-[25%]'
    },
    {
      header: 'Validity',
      accessor: (row: ComboPackage) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem', color: 'var(--text-black)', whiteSpace: 'nowrap' }}>
          <CalendarClock size={14} />
          {row.validityDays > 0 ? `${row.validityDays} Days` : 'No Expiry'}
        </div>
      ),
      skeleton: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Skeleton width="16px" height="16px" borderRadius="4px" />
          <Skeleton width="60px" height="1rem" />
        </div>
      ),
      className: 'w-[15%]'
    },
    {
      header: 'Status',
      accessor: (row: ComboPackage) => (
        <span className={`badge ${row.active ? 'badge-success' : 'badge-danger'} `}>
          {row.active ? 'Active' : 'Inactive'}
        </span>
      ),
      skeleton: <Skeleton width="50px" height="1.4rem" borderRadius="var(--radius-sm)" />,
      className: 'w-[5%]'
    },
    {
      header: 'Actions',
      accessor: (row: ComboPackage) => (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
              onClick={() => {
                  if (!canEdit) { showToast("Ask Admin for permission", "error"); return; }
                  openEditModal(row);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: 'var(--primary)',
                color: 'white',
                cursor: !canEdit ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500,
                transition: 'all 0.2s',
                opacity: !canEdit ? 0.5 : 1
              }}
              disabled={!canEdit}
              title={!canEdit ? "Ask Admin for permission" : "Edit Package"}
              className="hover:opacity-90"
            >
              {/* <Edit2 size={16} /> */}
              Edit
            </button>
        </div>
      ),
      skeleton: <Skeleton width="60px" height="2.2rem" borderRadius="0.5rem" />,
      className: 'w-[5%]'
    }
  ];



  return (
    <div className="space-y-6" style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'nowrap', width: '100%' }}>
        <div>
          {/* <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-dark)', margin: 0 }}>Package Combos</h3> */}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'nowrap' }}>
          {/* Search */}
          <div className="relative" style={{ height: '40px', display: 'flex', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                height: '100%',
                padding: '0 1rem 0 2.5rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border)',
                fontSize: '0.875rem',
                width: '200px',
                outline: 'none',
                transition: 'all 0.2s',
              }}
            />
            <div style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-black)', display: 'flex' }}>
              <Search size={16} />
            </div>
          </div>



          {/* Create */}
          <Button
              onClick={() => {
                  if (!canAdd) { showToast("Ask Admin for permission", "error"); return; }
                  openCreateModal();
              }}
              disabled={!canAdd}
              title={!canAdd ? "Ask Admin for permission" : ""}
              // icon={<Plus size={18} />}
              style={{ height: '40px', whiteSpace: 'nowrap', opacity: !canAdd ? 0.5 : 1, cursor: !canAdd ? 'not-allowed' : 'pointer' }}
            >
              Add Package
            </Button>
        </div>
      </div>

      <Table
        columns={columns}
        isLoading={packagesLoading}
        data={Array.isArray(packages) ? packages.filter(pkg => {
          const matchesSearch = pkg.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            pkg.description.toLowerCase().includes(searchTerm.toLowerCase());

          // Strict frontend filtering by adminId (as requested)
          // For Admins/Stylists, only show packages belonging to their business
          // Super Admins (no adminId) see all
          if (!user?.adminId) return matchesSearch;

          const matchesAdmin = pkg.adminId === user.adminId;
          // Fallback: If adminId is missing, allow match by authId (legacy) or orphan items
          const matchesLegacy = !pkg.adminId && (pkg.authId === user.authId || pkg.authId === String(user.id));
          const matchesOrphan = !pkg.adminId && !pkg.authId;

          return matchesSearch && (matchesAdmin || matchesLegacy || matchesOrphan);
        }) : []}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => !isSubmitting && setIsModalOpen(false)}
        title={editingId ? "Edit Package" : "Create New Package"}
      >
        <div style={{ position: 'relative' }}>


          {/* Form Content */}
          <form className="space-y-3" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="flex flex-col">
                <Input
                  label="Package Name"
                  placeholder=""
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting}
                />
                {formErrors.name && <span style={{ color: 'red', fontSize: '0.75rem', marginTop: '-1rem', marginBottom: '1rem', display: 'block' }}>{formErrors.name}</span>}
              </div>

              <div className="input-group">
                <label className="input-label">Description</label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="Describe the package benefits..."
                  style={{ resize: 'none' }}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isSubmitting}
                ></textarea>
              </div>

              <div className="grid md-grid-cols-3 gap-4">
                 <div className="flex flex-col">
                  <Input
                    label={`Total Price(${symbol})`}
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    disabled={isSubmitting}
                  />
                  {formErrors.price && <span style={{ color: 'red', fontSize: '0.75rem', marginTop: '-1rem', marginBottom: '1rem', display: 'block' }}>{formErrors.price}</span>}
                </div>
                <Select
                  label="Status"
                  options={[
                    { value: 'active', label: 'Active' },
                    { value: 'inactive', label: 'Inactive' }
                  ]}
                  value={active}
                  onChange={(e) => setActive(e.target.value)}
                  disabled={isSubmitting}
                />
                <div>
                  <Input
                    label="Validity Duration (Days)"
                    type="number"
                    placeholder="0 for No Expiry"
                    value={validity}
                    onChange={(e) => setValidity(e.target.value)}
                    min="0"
                    disabled={isSubmitting}
                  />
                  <div style={{ fontSize: '0.8rem', marginTop: '0.5rem', minHeight: '1.25rem' }}>
                    {validity === '0' || validity === '' ? (
                      <span style={{ color: 'var(--success)', fontWeight: 500 }}>Currently set to No Expiration</span>
                    ) : (
                      <span style={{ color: 'var(--text-black)' }}>Expires {validity} days after purchase</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Image Upload */}
              <div>
                <label className="input-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>Package Image (Optional)</label>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <input
                    type="checkbox"
                    id="remove-bg-package"
                    checked={editingId ? removeBgEditEnabled : removeBgAddEnabled}
                    onChange={(e) => editingId ? setRemoveBgEditEnabled(e.target.checked) : setRemoveBgAddEnabled(e.target.checked)}
                    style={{ width: '1rem', height: '1rem', cursor: 'pointer', accentColor: 'var(--primary)' }}
                  />
                  <label htmlFor="remove-bg-package" style={{ fontSize: '0.85rem', color: '#64748b', cursor: 'pointer' }}>
                    Remove background using AI
                  </label>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <input
                    type="file"
                    id="combo-image"
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                    disabled={isSubmitting}
                  />
                  <label
                    htmlFor="combo-image"
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

                  {imgUrl && (
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
                          src={imgUrl}
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

              <div className="space-y-2">
                <label className="input-label">Included Items & Quantities</label>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-black)', marginTop: '-0.25rem', marginBottom: '0.5rem' }}>Select items and specify quantity (e.g. 10 for a package)</p>
                {formErrors.items && <span style={{ color: 'red', fontSize: '0.75rem', marginTop: '-0.25rem', marginBottom: '0.5rem', display: 'block' }}>{formErrors.items}</span>}


                {/* Tabs Header */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => setActiveItemTab('services')}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: activeItemTab === 'services' ? 'var(--primary)' : '#64748b',
                      borderBottom: activeItemTab === 'services' ? '2px solid var(--primary)' : '2px solid transparent',
                      background: 'none',
                      borderTop: 'none',
                      borderLeft: 'none',
                      borderRight: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Services ({availableServices.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveItemTab('products')}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: activeItemTab === 'products' ? 'var(--primary)' : '#64748b',
                      borderBottom: activeItemTab === 'products' ? '2px solid var(--primary)' : '2px solid transparent',
                      background: 'none',
                      borderTop: 'none',
                      borderLeft: 'none',
                      borderRight: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Products ({availableProducts.length})
                  </button>
                </div>

                {/* Tab Content */}
                <div style={{
                  opacity: isSubmitting ? 0.7 : 1,
                  pointerEvents: isSubmitting ? 'none' : 'auto',
                  marginBottom: '1rem',
                  height: '350px' // Fixed height for consistency
                }}>
                  {activeItemTab === 'services' ? (
                    <ItemSelector
                      title="Services"
                      icon={Scissors}
                      type="service"
                      items={availableServices}
                      selectedItems={selectedItems}
                      onToggleItem={handleToggleItem}
                      onQuantityChange={handleQuantityChange}
                    />
                  ) : (
                    <ItemSelector
                      title="Products"
                      icon={ShoppingBag}
                      type="product"
                      items={availableProducts}
                      selectedItems={selectedItems}
                      onToggleItem={handleToggleItem}
                      onQuantityChange={handleQuantityChange}
                    />
                  )}
                </div>
              </div>
            </div>

            <div style={{ paddingTop: '1.5rem', marginTop: '1rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting} isLoading={isSubmitting}>
                {editingId ? 'Save Changes' : 'Create Package'}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
};

export default Packages;
