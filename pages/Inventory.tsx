import React, { useState, useRef, useEffect } from 'react';
import { MdClose, MdAdd, MdEdit, MdMoveToInbox, MdNoteAlt, MdErrorOutline, MdHistory, MdInventory, MdLayers, MdTableChart, MdCloudUpload, MdCloudDownload, MdAddBox, MdIndeterminateCheckBox } from 'react-icons/md';
import { Table, Button, Modal, Input, Select, SearchableSelect, Skeleton } from '../components/UI';
import { Product, InventoryMovement } from '../types';
import { useToast } from '../components/ToastContext';
import { useCurrency } from '../components/CurrencyContext';

import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import { ServiceAvatar } from '../components/ServiceAvatar';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinary';
import { removeImageBackground } from '../utils/backgroundRemoval';
const PaginationControls = ({
  currentPage,
  totalPages,
  onPageChange
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) => {
  if (totalPages <= 1) return null;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '1.5rem',
      background: 'white',
      borderTop: '1px solid #f1f5f9',
      borderRadius: '0 0 1rem 1rem'
    }}>
      <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
        Showing <span style={{ fontWeight: 600, color: '#1e293b' }}>
          {(currentPage - 1) * 10 + 1}
        </span> to <span style={{ fontWeight: 600, color: '#1e293b' }}>
          {Math.min(currentPage * 10, totalPages * 10)}
        </span> (Page {currentPage} of {totalPages})
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            border: '1px solid #e2e8f0',
            background: currentPage === 1 ? '#f1f5f9' : 'white',
            color: currentPage === 1 ? '#94a3b8' : '#475569',
            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
            fontWeight: 500
          }}
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            border: '1px solid #e2e8f0',
            background: currentPage === totalPages ? '#f1f5f9' : 'white',
            color: currentPage === totalPages ? '#94a3b8' : '#475569',
            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
            fontWeight: 500
          }}
        >
          Next
        </button>
      </div>
    </div>
  );
};

import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../redux/store';
import { fetchInventory, fetchInventoryHistory, invalidateInventoryCache } from '../redux/slices/inventorySlice';
import { fetchPackages } from '../redux/slices/packageSlice';

// ... (PaginationControls stays same)

const Inventory: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { products, categories: productCategories, history: movements, loading: inventoryLoading } = useSelector((state: RootState) => state.inventory);
  const { packages } = useSelector((state: RootState) => state.packages);

  const { showToast } = useToast();
  const { symbol, formatPrice } = useCurrency();
  const { user, isStaff, isAdmin, isManager } = useAuth();

  const canAdd = isAdmin || isManager || (isStaff && user?.permissions?.includes('inventory.add'));
  const canEdit = isAdmin || isManager || (isStaff && user?.permissions?.includes('inventory.edit'));
  // View State
  const [activeTab, setActiveTab] = useState<'stock' | 'history'>('stock');

  // Modal State
  const [activeModal, setActiveModal] = useState<'create' | 'receive' | 'bulk-receive' | 'adjust' | 'import' | null>(null);
  const [bulkType, setBulkType] = useState<'receive' | 'issue'>('receive');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Data State
  // Removed local state: products, loading, movements, productCategories
  // const [products, setProducts] = useState<Product[]>([]);
  // const [loading, setLoading] = useState(true);
  // const [movements, setMovements] = useState<InventoryMovement[]>([]);
  // const [productCategories, setProductCategories] = useState<string[]>(['General']);

  // Fetch products and packages from backend
  useEffect(() => {
    dispatch(fetchInventory());
    dispatch(fetchPackages());
  }, [dispatch]);

  // Fetch movement history from API
  useEffect(() => {
    if (activeTab === 'history') {
      dispatch(fetchInventoryHistory());
    }
  }, [activeTab, dispatch]);

  // Form State
  const [actionQty, setActionQty] = useState<string>('');
  const [adjustType, setAdjustType] = useState<'add' | 'remove'>('add');
  const [remarks, setRemarks] = useState('');
  const [comments, setComments] = useState('');
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [stockSearchTerm, setStockSearchTerm] = useState('');

  // Date Filter State for Movement History
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Pagination State
  const [stockPage, setStockPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Reset page when search changes
  useEffect(() => {
    setHistoryPage(1);
  }, [historySearchTerm]);

  useEffect(() => {
    setStockPage(1);
  }, [stockSearchTerm]);

  // New Product Form State
  const [newProduct, setNewProduct] = useState({
    name: '',
    category: '', // Default to empty to show placeholder
    sku: '',
    price: '',
    stock: '',
    imgUrl: '',
    isActive: true
  });

  // Edit Product State
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [removeBgAddEnabled, setRemoveBgAddEnabled] = useState(false);
  const [removeBgEditEnabled, setRemoveBgEditEnabled] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Bulk State
  interface BulkItem {
    id: number;
    productId: string;
    quantity: string;
    remarks: string;
    searchText?: string; // For tracking search input
  }
  const [bulkItems, setBulkItems] = useState<BulkItem[]>([]);

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
      if (isEdit && editProduct) {
        setEditProduct({ ...editProduct, imgUrl: url });
      } else {
        setNewProduct({ ...newProduct, imgUrl: url });
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
    const url = isEdit ? editProduct?.imgUrl : newProduct.imgUrl;
    if (!url) return;

    try {
      await deleteFromCloudinary(url);
      if (isEdit && editProduct) {
        setEditProduct({ ...editProduct, imgUrl: '' });
      } else {
        setNewProduct({ ...newProduct, imgUrl: '' });
      }
      showToast('Image removed from server', 'success');
    } catch (error: any) {
      console.error('Cloudinary delete error:', error);
      showToast(error.message || 'Failed to remove image', 'error');
      if (isEdit && editProduct) {
        setEditProduct({ ...editProduct, imgUrl: '' });
      } else {
        setNewProduct({ ...newProduct, imgUrl: '' });
      }
    }
  };

  const openModal = (type: 'create' | 'receive' | 'bulk-receive' | 'adjust' | 'import', product?: Product) => {
    setActiveModal(type);
    setSelectedProduct(product || null);
    setActionQty('');
    setRemarks('');
    setComments('');
    setAdjustType('add');
    setImportFile(null);
    setNewProduct({ name: '', category: '', sku: '', price: '', stock: '', imgUrl: '', isActive: true });
    setRemoveBgAddEnabled(false);
    if (type === 'bulk-receive') {
      setBulkItems([{ id: Date.now(), productId: '', quantity: '', remarks: '', searchText: '' }]);
      setBulkType('receive'); // Reset to receive by default
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    setSelectedProduct(null);
    setImportFile(null);
    setNewProduct({ name: '', category: '', sku: '', price: '', stock: '', imgUrl: '' });
    setRemoveBgAddEnabled(false);
  };

  // --- ACTIONS ---

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // VALIDATION
      const newErrors: Record<string, string> = {};
      if (!newProduct.name.trim()) newErrors.name = 'Product name is required';
      if (!newProduct.category) newErrors.category = 'Category is required';
      if (!newProduct.sku.trim()) newErrors.sku = 'SKU is required';
      if (!newProduct.price || parseFloat(newProduct.price) <= 0) newErrors.price = 'Price must be greater than 0';
      if (newProduct.stock === '' || parseInt(newProduct.stock) < 0) newErrors.stock = 'Stock cannot be negative';

      if (Object.keys(newErrors).length > 0) {
        setFormErrors(newErrors);
        showToast('Please fill all required fields', 'error');
        return;
      }

      setFormErrors({});
      setSavingProduct(true);
      const response = await api.post('/inventory', {
        name: newProduct.name,
        category: newProduct.category,
        sku: newProduct.sku,
        price: parseFloat(newProduct.price),
        stock: parseInt(newProduct.stock),
        imgUrl: newProduct.imgUrl,
        isActive: newProduct.isActive
      });

      const createdProduct = response.data;
      // setProducts(prev => [...prev, createdProduct]); // Removed local state
      dispatch(invalidateInventoryCache());
      dispatch(fetchInventory()); // Refresh list

      showToast('Product added successfully!', 'success');
      closeModal();
    } catch (error: any) {
      console.error('Error adding product:', error);
      showToast(error.response?.data?.error || 'Error adding product', 'error');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProduct) return;

    // VALIDATION
    const newErrors: Record<string, string> = {};
    if (!editProduct.name.trim()) newErrors.name = 'Product name is required';
    if (!editProduct.category) newErrors.category = 'Category is required';
    if (!editProduct.sku.trim()) newErrors.sku = 'SKU is required';
    if (editProduct.price <= 0) newErrors.price = 'Price must be greater than 0';
    if (editProduct.stock < 0) newErrors.stock = 'Stock cannot be negative';

    if (Object.keys(newErrors).length > 0) {
      setFormErrors(newErrors);
      showToast('Please fill all required fields', 'error');
      return;
    }

    setFormErrors({});

    // Block deactivation if product is used in any package
    if (!editProduct.isActive) {
      const usedInPackages = packages.filter(pkg =>
        (pkg.items || []).some((item: any) =>
          item.type === 'product' && item.name === editProduct.name
        )
      );
      if (usedInPackages.length > 0) {
        const pkgNames = usedInPackages.map((p: any) => `"${p.name}"`).join(', ');
        showToast(
          `Cannot set "${editProduct.name}" to inactive — it is used in package(s): ${pkgNames}. Remove it from the package(s) first.`,
          'error'
        );
        return;
      }
    }

    setSavingProduct(true);

    try {
      const response = await api.put(`/inventory/${editProduct.id}`, {
        name: editProduct.name,
        category: editProduct.category,
        sku: editProduct.sku,
        price: editProduct.price,
        stock: editProduct.stock,
        imgUrl: editProduct.imgUrl,
        isActive: editProduct.isActive
      });

      if (response.data) {
        const updatedProduct = response.data;
        // setProducts(prev => prev.map(p =>
        //   p.id === editProduct.id ? updatedProduct : p
        // ));
        dispatch(invalidateInventoryCache());
        dispatch(fetchInventory());
        showToast('Product updated successfully!', 'success');
        setIsEditModalOpen(false);
        setEditProduct(null);
        setRemoveBgEditEnabled(false);
      } else {
        const error = response.data;
        showToast(error.error || 'Failed to update product', 'error');
      }
    } catch (error: any) {
      console.error('Error updating product:', error);
      showToast(error.response?.data?.error || error.message || 'Error updating product', 'error');
    } finally {
      setSavingProduct(false);
    }
  };

  // --- ACTIONS ---



  const handleReceiveStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !actionQty) return;

    const qty = parseInt(actionQty);
    if (isNaN(qty) || qty <= 0) return;

    setSavingProduct(true);

    try {
      const response = await api.patch(`/inventory/${selectedProduct.id}/stock`, {
        quantity: qty,
        type: 'add',
        remarks: `${remarks || 'Stock received'} ${comments ? `| Comments: ${comments}` : ''}`
      });

      if (response.data) {
        const updatedProduct = response.data;
        // setProducts(prev => prev.map(p =>
        //   p.id === selectedProduct.id ? updatedProduct : p
        // ));

        dispatch(fetchInventory());
        if (activeTab === 'history') dispatch(fetchInventoryHistory());

        showToast('Stock received successfully!', 'success');
        closeModal();
      } else {
        showToast('Failed to update stock', 'error');
      }
    } catch (error: any) {
      console.error('Error receiving stock:', error);
      showToast(error.response?.data?.error || error.message || 'Error updating stock', 'error');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !actionQty || !remarks) return;

    const qty = parseInt(actionQty);
    if (isNaN(qty) || qty <= 0) return;

    setSavingProduct(true);

    try {
      const response = await api.patch(`/inventory/${selectedProduct.id}/stock`, {
        quantity: qty,
        type: 'remove', // key change: only allow stock issue
        remarks: `${remarks} ${comments ? `| Comments: ${comments}` : ''}`
      });

      if (response.data) {
        const updatedProduct = response.data;
        // setProducts(prev => prev.map(p =>
        //   p.id === selectedProduct.id ? updatedProduct : p
        // ));

        dispatch(fetchInventory());
        if (activeTab === 'history') dispatch(fetchInventoryHistory());

        showToast('Stock adjusted successfully!', 'success');
        closeModal();
      } else {
        showToast('Failed to issue stock', 'error');
      }
    } catch (error: any) {
      console.error('Error adjusting stock:', error);
      showToast(error.response?.data?.error || error.message || 'Error adjusting stock', 'error');
    } finally {
      setSavingProduct(false);
    }
  };

  // --- IMPORT/EXPORT ---

  const handleDownloadTemplate = () => {
    const csvContent = 'Name,Category,SKU,Price,Stock\nExample Product,hair,SAMPLE-001,25.00,100\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'product_import_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImportFile(e.target.files[0]);
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) {
      showToast('Please select a file to import', 'error');
      return;
    }

    setIsImporting(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());

        if (lines.length < 2) {
          showToast('CSV file is empty or invalid', 'error');
          return;
        }

        // Parse header row to detect column positions
        const headerLine = lines[0];
        const headerValues: string[] = [];
        let currentValue = '';
        let insideQuotes = false;

        for (let j = 0; j < headerLine.length; j++) {
          const char = headerLine[j];
          if (char === '"') {
            insideQuotes = !insideQuotes;
          } else if (char === ',' && !insideQuotes) {
            headerValues.push(currentValue.trim().toLowerCase().replace(/^["']|["']$/g, ''));
            currentValue = '';
          } else {
            currentValue += char;
          }
        }
        headerValues.push(currentValue.trim().toLowerCase().replace(/^["']|["']$/g, ''));

        // Map header names to indices
        const columnMap: any = {};
        headerValues.forEach((header, index) => {
          if (header.includes('name') || header.includes('product')) {
            columnMap.name = index;
          } else if (header.includes('category') || header.includes('type')) {
            columnMap.category = index;
          } else if (header.includes('sku') || header.includes('code') || header.includes('barcode')) {
            columnMap.sku = index;
          } else if (header.includes('price') || header.includes('cost')) {
            columnMap.price = index;
          } else if (header.includes('stock') || header.includes('quantity') || header.includes('qty')) {
            columnMap.stock = index;
          }
        });

        // Validate that all required columns are present
        if (columnMap.name === undefined || columnMap.category === undefined ||
          columnMap.sku === undefined || columnMap.price === undefined ||
          columnMap.stock === undefined) {
          showToast('CSV must have columns for: Name, Category, SKU, Price, and Stock', 'error');
          console.error('Missing columns. Found:', headerValues);
          return;
        }

        let successCount = 0;
        let errorCount = 0;
        const errors: string[] = [];

        const allProductsToImport = [];

        for (let i = 1; i < lines.length; i++) {
          // Better CSV parsing - handle quoted values
          const line = lines[i];
          const values: string[] = [];
          let currentValue = '';
          let insideQuotes = false;

          for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
              insideQuotes = !insideQuotes;
            } else if (char === ',' && !insideQuotes) {
              values.push(currentValue.trim());
              currentValue = '';
            } else {
              currentValue += char;
            }
          }
          values.push(currentValue.trim()); // Push last value

          if (values.length < Math.max(columnMap.name, columnMap.category, columnMap.sku, columnMap.price, columnMap.stock) + 1) {
            errorCount++;
            continue;
          }

          // Extract values using column map
          const name = (values[columnMap.name] || '').replace(/^["']|["']$/g, '').trim();
          const category = (values[columnMap.category] || '').replace(/^["']|["']$/g, '').trim();
          const sku = (values[columnMap.sku] || '').replace(/^["']|["']$/g, '').trim();

          // Clean price
          const priceStr = (values[columnMap.price] || '').replace(/^["']|["']$/g, '').trim()
            .replace(/[$₹€£¥,\s]/g, '');
          const price = parseFloat(priceStr);

          // Clean stock
          const stockStr = (values[columnMap.stock] || '').replace(/^["']|["']$/g, '').trim()
            .replace(/[^\d.-]/g, '');
          const stock = parseInt(stockStr);

          const productData = {
            name,
            category: category || 'General',
            sku,
            price: isNaN(price) ? 0 : price,
            stock: isNaN(stock) ? 0 : stock
          };

          // Basic validation before adding to bulk list
          if (productData.name && productData.sku) {
            allProductsToImport.push(productData);
          } else {
            errorCount++;
          }
        }

        if (allProductsToImport.length === 0) {
          showToast('No valid products found in CSV. Please check required fields (Name, SKU).', 'error');
          setIsImporting(false);
          return;
        }

        try {
          // Call the NEW bulk API endpoint
          const response = await api.post('/inventory/bulk', { products: allProductsToImport });
          const { successCount: apiSuccess, errorCount: apiError, errors: apiErrors } = response.data;

          const totalSuccess = apiSuccess;
          const totalError = errorCount + apiError;

          if (totalError > 0) {
            const errorSummary = apiErrors && apiErrors.length > 0
              ? apiErrors.slice(0, 2).map((e: any) => `${e.name || e.sku}: ${e.error}`).join('; ')
              : 'Some rows had invalid data';
            const moreErrors = apiErrors && apiErrors.length > 2 ? ` (and ${apiErrors.length - 2} more)` : '';
            showToast(`Import complete! Success: ${totalSuccess}, Failed: ${totalError}. Details: ${errorSummary}${moreErrors}`, totalSuccess > 0 ? 'success' : 'error');
          } else {
            showToast(`Import complete! Successfully imported ${totalSuccess} products`, 'success');
          }

          closeModal();

          // Refresh products AND categories list
          dispatch(invalidateInventoryCache());
          dispatch(fetchInventory());

          if (activeTab === 'history') dispatch(fetchInventoryHistory());

        } catch (error: any) {
          const errorMsg = error.response?.data?.error || error.message || 'Unknown error';
          showToast(`Bulk upload failed: ${errorMsg}`, 'error');
          console.error(`Failed to bulk upload:`, error.response?.data || error);
        }
      } catch (error) {
        console.error('Error parsing CSV:', error);
        showToast('Error parsing CSV file', 'error');
      } finally {
        setIsImporting(false);
      }
    };

    reader.readAsText(importFile);
  };

  // --- BULK ACTIONS ---

  const addBulkRow = () => {
    setBulkItems(prev => [...prev, { id: Date.now(), productId: '', quantity: '', remarks: '', searchText: '' }]);
  };

  const removeBulkRow = (id: number) => {
    setBulkItems(prev => prev.filter(item => item.id !== id));
  };

  const updateBulkRow = (id: number, field: keyof BulkItem, value: string) => {
    setBulkItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleBulkReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validate
    const invalidItems = bulkItems.filter(item => !item.productId || !item.quantity);
    if (invalidItems.length > 0) {
      showToast('Please fill in all product and quantity fields', 'error');
      return;
    }

    // Process each item with backend API calls
    let successCount = 0;
    let errorCount = 0;

    setIsBulkSubmitting(true);

    for (const item of bulkItems) {
      const product = products.find(p => p.id === item.productId);
      if (product) {
        const qty = parseInt(item.quantity);

        try {
          const response = await api.patch(`/inventory/${product.id}/stock`, {
            quantity: qty,
            type: bulkType === 'receive' ? 'add' : 'remove',
            remarks: item.remarks || (bulkType === 'receive' ? 'Bulk Receive' : 'Bulk Issue')
          });

          if (response.data) {
            const updatedProduct = response.data;
            // setProducts(prev => prev.map(p =>
            //   p.id === product.id ? updatedProduct : p
            // ));
            successCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          console.error('Error updating stock for product:', product.name, error);
          errorCount++;
        }
      }
    }

    // We refresh the whole inventory after bulk action
    dispatch(fetchInventory());

    if (activeTab === 'history') dispatch(fetchInventoryHistory());

    if (errorCount > 0) {
      showToast(`Bulk Movement completed with errors. Success: ${successCount}, Failed: ${errorCount}`, 'error');
    } else {
      showToast(`Successfully received stock for ${successCount} products`, 'success');
    }
    setIsBulkSubmitting(false);
    closeModal();
  };

  // --- COLUMNS ---

  const stockColumns = [
    {
      header: 'Product Name',
      accessor: (row: Product) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ServiceAvatar name={row.name} imgUrl={row.imgUrl} size={40} />
          <span style={{ fontWeight: 600 }}>{row.name}</span>
        </div>
      ),
      skeleton: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Skeleton width="40px" height="40px" borderRadius="12px" />
          <Skeleton width="120px" height="1.2rem" />
        </div>
      )
    },
    {
      header: 'Category',
      accessor: 'category' as keyof Product,
      skeleton: <Skeleton width="80px" height="1rem" />
    },
    {
      header: 'Status',
      accessor: (row: Product) => (
        <span className={`badge ${row.isActive ? 'badge-success' : 'badge-danger'}`}>
          {row.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
      skeleton: <Skeleton width="60px" height="1.4rem" borderRadius="var(--radius-sm)" />
    },
    {
      header: 'SKU',
      accessor: 'sku' as keyof Product,
      skeleton: <Skeleton width="100px" height="1rem" />
    },
    {
      header: 'Price',
      accessor: (row: Product) => formatPrice(row.price),
      skeleton: <Skeleton width="60px" height="1.2rem" />
    },
    {
      header: 'Stock Level',
      accessor: (row: Product) => (
        <span className={`badge ${row.stock < 10 ? 'badge-danger' : 'badge-success'}`}>
          {row.stock} Units
        </span>
      ),
      skeleton: <Skeleton width="70px" height="1.4rem" borderRadius="var(--radius-sm)" />
    },
    {
      header: 'Actions',
      accessor: (row: Product) => (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {canEdit && (
            <>
              <button
                title="Edit Product"
                onClick={() => { setEditProduct(row); setIsEditModalOpen(true); setRemoveBgEditEnabled(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  color: 'white', background: 'var(--primary)',
                  border: 'none', borderRadius: '0.375rem',
                  cursor: 'pointer', padding: '0.5rem 0.85rem',
                  fontSize: '0.95rem', fontWeight: 500,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                <MdEdit size={18} /> Edit
              </button>
              <button
                title="Receive Goods"
                onClick={() => openModal('receive', row)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  color: 'white', background: 'var(--success)',
                  border: 'none', borderRadius: '0.375rem',
                  cursor: 'pointer', padding: '0.5rem 0.85rem',
                  fontSize: '0.95rem', fontWeight: 500,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                <MdAddBox size={18} /> Receive
              </button>
              <button
                title="Goods Issue "
                onClick={() => openModal('adjust', row)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  color: 'white', background: 'var(--warning)',
                  border: 'none', borderRadius: '0.375rem',
                  cursor: 'pointer', padding: '0.5rem 0.85rem',
                  fontSize: '0.95rem', fontWeight: 500,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                <MdIndeterminateCheckBox size={18} /> Issue
              </button>
            </>
          )}
        </div>
      ),
      skeleton: (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Skeleton width="80px" height="2.2rem" borderRadius="0.375rem" />
          <Skeleton width="100px" height="2.2rem" borderRadius="0.375rem" />
          <Skeleton width="80px" height="2.2rem" borderRadius="0.375rem" />
        </div>
      )
    }
  ];

  const historyColumns = [
    {
      header: 'Date',
      accessor: (row: InventoryMovement) => {
        if (!row.timestamp) {
          // For old entries without timestamp, show current date
          return new Date().toLocaleDateString('en-GB');
        }

        // Handle both string and number timestamps
        const date = new Date(row.timestamp);

        // Check if date is valid
        if (isNaN(date.getTime())) {
          // For invalid dates, show current date
          return new Date().toLocaleDateString('en-GB');
        }

        return date.toLocaleDateString('en-GB'); // Format: DD/MM/YYYY
      },
      skeleton: <Skeleton width="140px" height="1rem" />
    },
    {
      header: 'Product',
      accessor: 'productName' as keyof InventoryMovement,
      className: 'font-medium',
      skeleton: <Skeleton width="160px" height="1rem" />
    },
    {
      header: 'Type',
      accessor: (row: InventoryMovement) => {
        let color = 'badge-info';
        let label: string = row.type;
        if (row.type === 'received') { color = 'badge-success'; label = 'Received'; }
        else if (row.type === 'adjustment_add') { color = 'badge-warning'; label = 'Adj (+)'; }
        else if (row.type === 'adjustment_remove') { color = 'badge-danger'; label = 'Adj (-)'; }
        else if (row.type === 'sold') { color = 'badge-info'; label = 'Sold'; }
        return <span className={`badge ${color}`}>{label}</span>;
      },
      skeleton: <Skeleton width="80px" height="1.4rem" borderRadius="var(--radius-sm)" />
    },
    {
      header: 'Qty',
      accessor: (row: InventoryMovement) => <span style={{ fontWeight: 600 }}>{(row.type === 'adjustment_remove' || row.type === 'sold') ? '-' : '+'}{row.quantity}</span>,
      skeleton: <Skeleton width="40px" height="1rem" />
    },
    {
      header: 'Balance',
      accessor: (row: InventoryMovement) => `${row.balanceAfter}`,
      skeleton: <Skeleton width="60px" height="1rem" />
    },
    {
      header: 'Remarks',
      accessor: (row: InventoryMovement) => <span style={{ color: 'var(--text-gray)', fontStyle: 'italic', fontSize: '0.85rem' }}>{row.remarks || '-'}</span>,
      skeleton: <Skeleton width="200px" height="1rem" />
    },
    {
      header: 'User',
      accessor: 'performedBy' as keyof InventoryMovement,
      skeleton: <Skeleton width="100px" height="1rem" />
    }
  ];

  // Filter movements based on search term and date range
  const filteredMovements = movements.filter(movement => {
    // Search term filter
    if (historySearchTerm) {
      const searchLower = historySearchTerm.toLowerCase();
      const matchesSearch = (
        (movement.productName || '').toLowerCase().includes(searchLower) ||
        (movement.type || '').toLowerCase().includes(searchLower) ||
        (movement.remarks && movement.remarks.toLowerCase().includes(searchLower))
      );
      if (!matchesSearch) return false;
    }

    // Date range filter
    if (fromDate || toDate) {
      const movementDate = new Date(movement.timestamp);

      if (fromDate) {
        const from = new Date(fromDate);
        from.setHours(0, 0, 0, 0);
        if (movementDate < from) return false;
      }

      if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        if (movementDate > to) return false;
      }
    }

    return true;
  });

  // Filter products based on search term
  const filteredProducts = Array.isArray(products) ? products.filter(product => {
    if (!stockSearchTerm) return true;
    const searchLower = stockSearchTerm.toLowerCase();
    return (
      (product.name || '').toLowerCase().includes(searchLower) ||
      (product.category || '').toLowerCase().includes(searchLower) ||
      (product.sku || '').toLowerCase().includes(searchLower)
    );
  }) : [];

  return (
    <div className="space-y-6" style={{ position: 'relative' }}>
      {/* Loading Overlay */}
      {/* Loading Skeleton */}

      {/* Premium Header Control Bar */}
      <div style={{
        background: 'white',
        padding: '1.5rem',
        borderRadius: '1.25rem',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
        border: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem'
      }}>
        {/* Row 1: Tabs */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{
            display: 'flex',
            background: 'linear-gradient(to bottom, #f8fafc, #f1f5f9)',
            padding: '0.375rem',
            borderRadius: '0.875rem',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
            gap: '0.375rem'
          }}>
            <button
              onClick={() => setActiveTab('stock')}
              style={{
                padding: '0.625rem 1.25rem',
                borderRadius: '0.625rem',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                background: activeTab === 'stock' ? 'white' : 'transparent',
                color: activeTab === 'stock' ? 'var(--primary)' : '#64748b',
                boxShadow: activeTab === 'stock' ? '0 2px 8px rgba(79, 70, 229, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transform: activeTab === 'stock' ? 'translateY(-1px)' : 'none'
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'stock') {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.5)';
                  e.currentTarget.style.color = '#475569';
                  e.currentTarget.style.transform = 'translateY(-0.5px)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'stock') {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#64748b';
                  e.currentTarget.style.transform = 'none';
                }
              }}
            >
              <span style={{
                display: 'flex',
                transition: 'transform 0.3s ease',
                transform: activeTab === 'stock' ? 'scale(1.1)' : 'scale(1)'
              }}>
                <MdInventory size={20} />
              </span>
              Current Stock
            </button>
            <button
              onClick={() => setActiveTab('history')}
              style={{
                padding: '0.625rem 1.25rem',
                borderRadius: '0.625rem',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                background: activeTab === 'history' ? 'white' : 'transparent',
                color: activeTab === 'history' ? 'var(--primary)' : '#64748b',
                boxShadow: activeTab === 'history' ? '0 2px 8px rgba(79, 70, 229, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transform: activeTab === 'history' ? 'translateY(-1px)' : 'none'
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'history') {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.5)';
                  e.currentTarget.style.color = '#475569';
                  e.currentTarget.style.transform = 'translateY(-0.5px)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'history') {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#64748b';
                  e.currentTarget.style.transform = 'none';
                }
              }}
            >
              <span style={{
                display: 'flex',
                transition: 'transform 0.3s ease',
                transform: activeTab === 'history' ? 'scale(1.1)' : 'scale(1)'
              }}>
                <MdHistory size={20} />
              </span>
              Movement History
            </button>
          </div>
        </div>

        {/* Row 2: Search & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          {activeTab === 'stock' && (
            <>
              {/* Search on Left */}
              <div className="relative" style={{ height: '40px' }}>
                <input
                  type="text"
                  placeholder="Search products..."
                  value={stockSearchTerm}
                  onChange={(e) => setStockSearchTerm(e.target.value)}
                  style={{
                    height: '100%',
                    padding: '0 1rem 0 2.5rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    outline: 'none',
                    background: '#f8fafc',
                    transition: 'all 0.2s',
                    width: '240px'
                  }}
                  onFocus={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#4f46e5'; }}
                  onBlur={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                />
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }}
                >
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </div>

              {/* Action Buttons on Right */}
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                {canAdd && (
                  <>
                    <Button onClick={() => openModal('import')} variant="secondary" icon={<MdTableChart size={20} />}>
                      Import
                    </Button>
                    <Button onClick={() => openModal('bulk-receive')} variant="secondary" icon={<MdLayers size={20} />}>
                      Bulk Movement
                    </Button>
                    <Button onClick={() => openModal('create')}
                      // icon={<MdAdd size={20} />} 
                      style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)', boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)' }}>
                      Add New Product
                    </Button>
                  </>
                )}
              </div>
            </>
          )}

          {activeTab === 'history' && (
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
              {/* Left side: Date Filters */}
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                {/* From Date */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>From Date</label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    style={{
                      padding: '0.65rem 0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      outline: 'none',
                      background: '#f8fafc',
                      transition: 'all 0.2s',
                      width: '150px'
                    }}
                    onFocus={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#8b5cf6'; }}
                    onBlur={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                  />
                </div>

                {/* To Date */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>To Date</label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    style={{
                      padding: '0.65rem 0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      outline: 'none',
                      background: '#f8fafc',
                      transition: 'all 0.2s',
                      width: '150px'
                    }}
                    onFocus={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#8b5cf6'; }}
                    onBlur={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                  />
                </div>

                {/* Clear Filters Button */}
                {(fromDate || toDate) && (
                  <button
                    onClick={() => { setFromDate(''); setToDate(''); }}
                    style={{
                      padding: '0.65rem 1rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      background: 'white',
                      color: '#64748b',
                      cursor: 'pointer',
                      fontWeight: 500,
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.borderColor = '#fca5a5'; e.currentTarget.style.color = '#dc2626'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
                  >
                    Clear Dates
                  </button>
                )}
              </div>

              {/* Right side: Search Input */}
              <div style={{ position: 'relative', width: '300px' }}>
                <input
                  type="text"
                  placeholder="Search history..."
                  value={historySearchTerm}
                  onChange={(e) => setHistorySearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 1rem 0.65rem 2.75rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.75rem',
                    fontSize: '0.9rem',
                    outline: 'none',
                    background: '#f8fafc',
                    transition: 'all 0.2s'
                  }}
                  onFocus={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#8b5cf6'; }}
                  onBlur={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                />
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)' }}
                >
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Styled Main Content Area */}
      <div style={{
        background: 'white',
        borderRadius: '1.25rem',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
        position: 'relative'
      }}>

        {activeTab === 'stock' ? (
          <>
            <Table
              columns={stockColumns}
              isLoading={inventoryLoading}
              data={filteredProducts.slice((stockPage - 1) * ITEMS_PER_PAGE, stockPage * ITEMS_PER_PAGE)}
            />
            <PaginationControls
              currentPage={stockPage}
              totalPages={Math.ceil(filteredProducts.length / ITEMS_PER_PAGE)}
              onPageChange={setStockPage}
            />
          </>
        ) : (
          <>
            <Table
              columns={historyColumns}
              isLoading={inventoryLoading}
              data={filteredMovements.slice(
                (historyPage - 1) * ITEMS_PER_PAGE,
                historyPage * ITEMS_PER_PAGE
              )}
            />
            <PaginationControls
              currentPage={historyPage}
              totalPages={Math.ceil(filteredMovements.length / ITEMS_PER_PAGE)}
              onPageChange={setHistoryPage}
            />
          </>
        )}

      </div>

      {/* CREATE PRODUCT MODAL */}
      <Modal
        isOpen={activeModal === 'create'}
        onClose={closeModal}
        title="Add New Product"
      >
        <form className="space-y-6" onSubmit={handleCreateProduct}>
          <div className="grid md-grid-cols-2 gap-4">
            <div className="flex flex-col">
              <Input
                label="Product Name"
                placeholder="e.g. Daily Shine Shampoo"
                value={newProduct.name}
                onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
              />
              {formErrors.name && <span style={{ color: 'red', fontSize: '0.75rem', marginTop: '-0.25rem', marginBottom: '0.5rem', display: 'block' }}>{formErrors.name}</span>}
            </div>

            <div className="flex flex-col">
              <SearchableSelect
                label="Category"
                name="category"
                placeholder="Select category"
                value={newProduct.category}
                onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                options={productCategories
                  .filter(cat => cat && cat.trim().toLowerCase() !== 'select category' && cat.trim().toLowerCase() !== 'dadad')
                  .map(cat => ({ value: cat, label: cat }))}
                allowCustom={false}
              />
              {formErrors.category && <span style={{ color: 'red', fontSize: '0.75rem', marginTop: '-0.25rem', marginBottom: '0.5rem', display: 'block' }}>{formErrors.category}</span>}
            </div>

            {/* Image Upload */}
            <div style={{ gridColumn: 'span 2' }}>
              <label className="input-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>Product Image (Optional)</label>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <input
                  type="checkbox"
                  id="remove-bg-product-add"
                  checked={removeBgAddEnabled}
                  onChange={(e) => setRemoveBgAddEnabled(e.target.checked)}
                  style={{ width: '1rem', height: '1rem', cursor: 'pointer', accentColor: 'var(--primary)' }}
                />
                <label htmlFor="remove-bg-product-add" style={{ fontSize: '0.85rem', color: '#64748b', cursor: 'pointer' }}>
                  Remove background using AI
                </label>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <input
                  type="file"
                  id="add-product-image"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, false)}
                  style={{ display: 'none' }}
                />
                <label
                  htmlFor="add-product-image"
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

                {newProduct.imgUrl && (
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
                        src={newProduct.imgUrl}
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

            <div className="grid md-grid-cols-3 gap-4" style={{ gridColumn: 'span 2' }}>
              <div className="flex flex-col">
                <Input
                  label="SKU / Barcode"
                  placeholder="e.g. SHAM-001"
                  value={newProduct.sku}
                  onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                />
                {formErrors.sku && <span style={{ color: 'red', fontSize: '0.75rem', marginTop: '-0.25rem', marginBottom: '0.5rem', display: 'block' }}>{formErrors.sku}</span>}
              </div>
              <div className="flex flex-col">
                <Input
                  label={`Price (${symbol})`}
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={newProduct.price}
                  onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                />
                {formErrors.price && <span style={{ color: 'red', fontSize: '0.75rem', marginTop: '-0.25rem', marginBottom: '0.5rem', display: 'block' }}>{formErrors.price}</span>}
              </div>
              <div className="flex flex-col">
                <Input
                  label="Initial Stock"
                  type="number"
                  placeholder="0"
                  value={newProduct.stock}
                  onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
                />
                {formErrors.stock && <span style={{ color: 'red', fontSize: '0.75rem', marginTop: '-0.25rem', marginBottom: '0.5rem', display: 'block' }}>{formErrors.stock}</span>}
              </div>
              <Select
                label="Status"
                value={newProduct.isActive ? 'active' : 'inactive'}
                onChange={(e) => setNewProduct({ ...newProduct, isActive: e.target.value === 'active' })}
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' }
                ]}
              />
            </div>
          </div>

          <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <Button type="button" variant="ghost" onClick={closeModal} disabled={savingProduct}>Cancel</Button>
            <Button type="submit" disabled={savingProduct} isLoading={savingProduct}>
              Save Product
            </Button>
          </div>
        </form>
      </Modal>

      {/* IMPORT MODAL */}
      <Modal
        isOpen={activeModal === 'import'}
        onClose={closeModal}
        title="Import Products from Excel"
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
                <MdCloudUpload size={20} color="var(--primary)" />
              </div>
            </div>
            {importFile ? (
              <div>
                <p style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{importFile.name}</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-gray)' }}>{(importFile.size / 1024).toFixed(2)} KB</p>
              </div>
            ) : (
              <div>
                <p style={{ fontWeight: 600, color: 'var(--text-dark)' }}>Click or Drag file to upload</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-gray)' }}>Support for .xlsx, .xls or .csv</p>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <a href="#" onClick={(e) => { e.preventDefault(); handleDownloadTemplate(); }} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>
              <MdCloudDownload size={20} /> Download Template
            </a>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <Button type="button" variant="ghost" onClick={closeModal} disabled={isImporting}>Cancel</Button>
              <Button type="submit" disabled={!importFile || isImporting} isLoading={isImporting}>Upload & Import</Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* RECEIVE GOODS MODAL (SINGLE) */}
      <Modal
        isOpen={activeModal === 'receive'}
        onClose={closeModal}
        title="Receive Goods"
      >
        <form className="space-y-6" onSubmit={handleReceiveStock}>
          <div style={{ background: '#f0fdf4', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <MdClose size={20} color="#16a34a" />
            <div>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#166534', margin: 0 }}>Receiving Stock</p>
              <p style={{ fontSize: '0.75rem', color: '#166534', margin: 0 }}>Adding inventory for: <strong>{selectedProduct?.name}</strong></p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="input-group">
              <label className="input-label">Current Stock</label>
              <div style={{ padding: '0.6rem 1rem', background: '#f1f5f9', borderRadius: '0.75rem', color: 'var(--text-gray)' }}>
                {selectedProduct?.stock} Units
              </div>
            </div>
            <Input
              label="Quantity Received"
              type="number"
              min="1"
              placeholder="0"
              value={actionQty}
              onChange={(e) => setActionQty(e.target.value)}
              autoFocus
            />
          </div>

          <div className="input-group">
            <label className="input-label">Remarks / Invoice No.</label>
            <textarea
              className="form-control"
              rows={2}
              placeholder="e.g. PO #12345, Received from Supplier X"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              style={{ resize: 'none' }}
            ></textarea>
          </div>

          <div className="input-group">
            <label className="input-label">Additional Comments</label>
            <textarea
              className="form-control"
              rows={2}
              placeholder="Any other details..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              style={{ resize: 'none' }}
            ></textarea>
          </div>

          <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <Button type="button" variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button type="submit" disabled={!actionQty || savingProduct} isLoading={savingProduct}>Confirm Receipt</Button>
          </div>
        </form>
      </Modal>

      {/* BULK RECEIVE MODAL */}
      <Modal
        isOpen={activeModal === 'bulk-receive'}
        onClose={closeModal}
        title="Bulk Movement Goods"
      >
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '1rem' }}>
          <button
            type="button"
            onClick={() => setBulkType('receive')}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: 'none',
              border: 'none',
              borderBottom: bulkType === 'receive' ? '2px solid var(--primary)' : '2px solid transparent',
              color: bulkType === 'receive' ? 'var(--primary)' : 'var(--text-gray)',
              fontWeight: bulkType === 'receive' ? 600 : 500,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Bulk Goods Receive
          </button>
          <button
            type="button"
            onClick={() => setBulkType('issue')}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: 'none',
              border: 'none',
              borderBottom: bulkType === 'issue' ? '2px solid var(--primary)' : '2px solid transparent',
              color: bulkType === 'issue' ? 'var(--primary)' : 'var(--text-gray)',
              fontWeight: bulkType === 'issue' ? 600 : 500,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Bulk Goods Issues
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleBulkReceive}>
          {/* <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-gray)', margin: 0 }}>
              Add multiple products to receive stock in a single transaction.
            </p>
          </div> */}

          <div style={{ maxHeight: '40vh', overflowY: 'auto', overflowX: 'visible', paddingRight: '0.5rem' }}>
            {bulkItems.map((item, index) => (
              <div key={item.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'start', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px dashed var(--border)' }}>
                <div style={{ flex: 2 }}>
                  <label className="input-label" style={{ fontSize: '0.75rem' }}>Product</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      className="form-control"
                      value={item.searchText || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        updateBulkRow(item.id, 'searchText', value);
                        // Find and set product ID if exact match
                        const matchedProduct = products.find(p => p.name === value);
                        if (matchedProduct) {
                          updateBulkRow(item.id, 'productId', matchedProduct.id.toString());
                        } else {
                          updateBulkRow(item.id, 'productId', '');
                        }
                      }}
                      onFocus={(e) => {
                        // Only show dropdown if there's text
                        if (item.searchText) {
                          const dropdown = document.getElementById(`dropdown-${item.id}`);
                          if (dropdown) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            dropdown.style.top = `${rect.bottom}px`; // No gap
                            dropdown.style.left = `${rect.left}px`;
                            dropdown.style.width = `${rect.width}px`;
                            dropdown.style.display = 'block';
                          }
                        }
                      }}
                      onBlur={() => {
                        // Hide dropdown after delay
                        setTimeout(() => {
                          const dropdown = document.getElementById(`dropdown-${item.id}`);
                          if (dropdown) dropdown.style.display = 'none';
                        }, 200);
                      }}
                      onKeyUp={(e) => {
                        // Show dropdown when typing
                        const dropdown = document.getElementById(`dropdown-${item.id}`);
                        if (dropdown && item.searchText) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          dropdown.style.top = `${rect.bottom}px`; // No gap
                          dropdown.style.left = `${rect.left}px`;
                          dropdown.style.width = `${rect.width}px`;
                          dropdown.style.display = 'block';
                        } else if (dropdown && !item.searchText) {
                          dropdown.style.display = 'none';
                        }
                      }}
                      placeholder="Type to search product..."
                      style={{ fontSize: '0.85rem', padding: '0.4rem' }}
                      required
                    />
                    {/* Custom Dropdown */}
                    <div
                      id={`dropdown-${item.id}`}
                      ref={(el) => {
                        // Calculate position when element mounts or updates
                        if (el && item.searchText) {
                          const input = el.previousElementSibling as HTMLElement;
                          if (input) {
                            const rect = input.getBoundingClientRect();
                            el.style.top = `${rect.bottom}px`; // No gap
                            el.style.left = `${rect.left}px`;
                            el.style.width = `${rect.width}px`;
                          }
                        }
                      }}
                      style={{
                        position: 'fixed', // Use fixed to escape modal overflow
                        maxHeight: '200px',
                        overflowY: 'auto',
                        overflowX: 'hidden',
                        background: 'white',
                        border: '1px solid #cbd5e1', // Slightly darker border for better definition
                        borderTop: 'none', // Remove top border to blend with input
                        borderBottomLeftRadius: '0.5rem',
                        borderBottomRightRadius: '0.5rem',
                        borderTopLeftRadius: '0',
                        borderTopRightRadius: '0',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                        zIndex: 99999, // Max z-index
                        display: 'none',
                      }}
                    >
                      {products
                        .filter(p => {
                          const searchValue = (item.searchText || '').toLowerCase();
                          if (!searchValue) return false; // Don't show if no search text
                          return p.name.toLowerCase().includes(searchValue);
                        })
                        .slice(0, 50) // Limit to 50 results max
                        .map(p => (
                          <div
                            key={p.id}
                            onMouseDown={(e) => {
                              e.preventDefault(); // Prevent blur before click
                              updateBulkRow(item.id, 'productId', p.id.toString());
                              updateBulkRow(item.id, 'searchText', p.name);
                              const dropdown = document.getElementById(`dropdown-${item.id}`);
                              if (dropdown) dropdown.style.display = 'none';
                            }}
                            style={{
                              padding: '0.6rem 0.8rem', // Slightly more compact padding
                              cursor: 'pointer',
                              borderBottom: '1px solid #f1f5f9',
                              fontSize: '0.85rem',
                              transition: 'background 0.15s',
                              minHeight: '36px', // Slightly reduced min-height
                              display: 'flex',
                              alignItems: 'center',
                              color: '#1e293b'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                          >
                            {p.name}
                          </div>
                        ))}
                      {products.filter(p => {
                        const searchValue = (item.searchText || '').toLowerCase();
                        return searchValue && p.name.toLowerCase().includes(searchValue);
                      }).length === 0 && item.searchText && (
                          <div style={{ padding: '0.75rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                            No products found
                          </div>
                        )}
                    </div>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="input-label" style={{ fontSize: '0.75rem' }}>Qty</label>
                  <input
                    type="number"
                    min="1"
                    className="form-control"
                    value={item.quantity}
                    onChange={(e) => updateBulkRow(item.id, 'quantity', e.target.value)}
                    placeholder="0"
                    style={{ fontSize: '0.85rem', padding: '0.4rem' }}
                    required
                  />
                </div>
                <div style={{ flex: 2 }}>
                  <label className="input-label" style={{ fontSize: '0.75rem' }}>Remarks</label>
                  <input
                    type="text"
                    className="form-control"
                    value={item.remarks}
                    onChange={(e) => updateBulkRow(item.id, 'remarks', e.target.value)}
                    placeholder="Optional note"
                    style={{ fontSize: '0.85rem', padding: '0.4rem' }}
                  />
                </div>
                <div style={{ paddingTop: '1.4rem' }}>
                  <button
                    type="button"
                    onClick={() => removeBulkRow(item.id)}
                    style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}
                    disabled={bulkItems.length === 1}
                  >
                    <MdClose size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <Button type="button" variant="outline" onClick={addBulkRow} icon={<MdAdd size={14} />} className="w-full">
            Add Another Line
          </Button>

          <div style={{ paddingTop: '1rem', marginTop: '1rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <Button type="button" variant="ghost" onClick={closeModal} disabled={isBulkSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isBulkSubmitting} isLoading={isBulkSubmitting}>
              {bulkType === 'receive' ? 'Confirm Receive' : 'Confirm Issue'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Issue INVENTORY MODAL */}
      <Modal
        isOpen={activeModal === 'adjust'}
        onClose={closeModal}
        title="Goods Issue"
      >
        <form className="space-y-6" onSubmit={handleAdjustStock}>
          {/* <div style={{ background: '#fff7ed', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #fed7aa', display: 'flex', alignItems: 'start', gap: '0.75rem' }}>
            <MdErrorOutline className="text-orange-500" size={20} style={{ marginTop: 2 }} />
            <div>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#9a3412', margin: 0 }}>Stock Adjustment</p>
              <p style={{ fontSize: '0.75rem', color: '#9a3412', margin: '0.25rem 0 0 0' }}>
                Manually correcting count for: <strong>{selectedProduct?.name}</strong>.
                <br />Remarks are mandatory for audit purposes.
              </p>
            </div>
          </div> */}

          <div className="space-y-4">
            <div>
              <Input
                label="Quantity"
                type="number"
                min="1"
                placeholder="0"
                value={actionQty}
                onChange={(e) => setActionQty(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label className="input-label">Remarks / Reason <span style={{ color: 'var(--danger)' }}>*</span></label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="e.g. Damaged during shipping, Annual Audit Correction..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                style={{ resize: 'none' }}
              ></textarea>
            </div>

            <div className="input-group">
              <label className="input-label">Additional Comments</label>
              <textarea
                className="form-control"
                rows={2}
                placeholder="Any other details..."
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                style={{ resize: 'none' }}
              ></textarea>
            </div>
          </div>

          <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <Button type="button" variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button type="submit" disabled={!actionQty || !remarks || savingProduct} isLoading={savingProduct} variant={adjustType === 'remove' ? 'danger' : 'primary'}>
              Save Issue
            </Button>
          </div>
        </form>
      </Modal>

      {/* EDIT PRODUCT MODAL */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => { setIsEditModalOpen(false); setEditProduct(null); setRemoveBgEditEnabled(false); }}
        title="Edit Product"
      >
        {editProduct && (
          <form className="space-y-6" onSubmit={handleEditProduct}>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Input
                  label="Product Name"
                  placeholder="e.g. Daily Shine Shampoo"
                  value={editProduct.name}
                  onChange={(e) => setEditProduct({ ...editProduct, name: e.target.value })}
                  required
                />
              </div>

              <SearchableSelect
                label="Category"
                name="category"
                placeholder="Select category"
                value={editProduct.category}
                onChange={(e) => setEditProduct({ ...editProduct, category: e.target.value })}
                options={productCategories
                  .filter(cat => cat && cat.trim().toLowerCase() !== 'select category' && cat.trim().toLowerCase() !== 'dadad')
                  .map(cat => ({ value: cat, label: cat }))}
                allowCustom={false}
              />

              {/* Image Upload */}
              <div style={{ gridColumn: 'span 2' }}>
                <label className="input-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>Product Image (Optional)</label>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <input
                    type="checkbox"
                    id="remove-bg-product-edit"
                    checked={removeBgEditEnabled}
                    onChange={(e) => setRemoveBgEditEnabled(e.target.checked)}
                    style={{ width: '1rem', height: '1rem', cursor: 'pointer', accentColor: 'var(--primary)' }}
                  />
                  <label htmlFor="remove-bg-product-edit" style={{ fontSize: '0.85rem', color: '#64748b', cursor: 'pointer' }}>
                    Remove background using AI
                  </label>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <input
                    type="file"
                    id="edit-product-image"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, true)}
                    style={{ display: 'none' }}
                  />
                  <label
                    htmlFor="edit-product-image"
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

                  {editProduct.imgUrl && (
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
                          src={editProduct.imgUrl}
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

              <div className="grid md-grid-cols-3 gap-4" style={{ gridColumn: 'span 2' }}>
                <Input
                  label="SKU / Barcode"
                  placeholder="SCAN-0000"
                  value={editProduct.sku}
                  readOnly
                  style={{ background: '#f8fafc', cursor: 'not-allowed' }}
                />

                <Input
                  label={`Price (${symbol})`}
                  type="number"
                  value={editProduct.price.toString()}
                  onChange={(e) => setEditProduct({ ...editProduct, price: parseFloat(e.target.value) || 0 })}
                  min="0"
                  step="0.01"
                />

                <Input
                  label="Stock"
                  type="text"
                  value={editProduct.stock.toString()}
                  readOnly
                  style={{ background: '#f8fafc', cursor: 'not-allowed' }}
                />

                <Select
                  label="Status"
                  value={editProduct.isActive ? 'active' : 'inactive'}
                  onChange={(e) => setEditProduct({ ...editProduct, isActive: e.target.value === 'active' })}
                  options={[
                    { value: 'active', label: 'Active' },
                    { value: 'inactive', label: 'Inactive' }
                  ]}
                />
              </div>
            </div>

            <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <Button type="button" variant="ghost" onClick={() => { setIsEditModalOpen(false); setEditProduct(null); setRemoveBgEditEnabled(false); }}>Cancel</Button>
              <Button type="submit" isLoading={savingProduct}>Update Product</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>

  );
};

export default Inventory;
