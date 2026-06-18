import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft, Plus, Image as ImageIcon, CheckCircle2, ChevronRight,
    X, UserPlus, UploadCloud, Trash2, Search, Scissors, User, Calendar,
    IndianRupee, Loader2
} from 'lucide-react';
import api from '../utils/api';
import { uploadToCloudinary } from '../utils/cloudinary';

import { useToast } from '../components/ToastContext';
import Select from 'react-select';

// Basic Types
interface Customer {
    id: string;
    name: string;
    phone: string;
    email?: string;
}

interface Stylist {
    id: string;
    name: string;
    role: string;
}

interface Category {
    id: string;
    name: string;
}

interface Service {
    id: string;
    name: string;
    categoryId: string;
    price: number;
}

interface GarmentDraft {
    id: string;
    name: string;
    garmentType: string;
    serviceId?: string;
    assignedTailorId?: string;
    price: number;
    quantity: number;
    fabricDetails?: {
        type: 'None' | 'Customer' | 'Shop';
        source?: 'customer' | 'shop';
        details?: string;
        description?: string;
        productId?: string;
        quantity?: number;
        tempCategory?: string;
    };
    photoUrls?: string[]; // Stored in measurementSnapshot in DB
}

interface CreateTailorOrderProps {
    customers: Customer[];
}

const CreateTailorOrder: React.FC<CreateTailorOrderProps> = ({ customers }) => {
    const navigate = useNavigate();
    const { appId, businessName } = useParams();
    const { showToast } = useToast();

    // Steps state
    const [step, setStep] = useState<number>(1);

    // Data fetched
    const [stylists, setStylists] = useState<Stylist[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [productCategories, setProductCategories] = useState<string[]>([]);

    // Loading states
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form Data
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    
    // New Customer Form
    const [showNewCustomer, setShowNewCustomer] = useState(false);
    const [newCustomerName, setNewCustomerName] = useState('');
    const [newCustomerPhone, setNewCustomerPhone] = useState('');
    const [customerSearchTerm, setCustomerSearchTerm] = useState('');

    const [garments, setGarments] = useState<GarmentDraft[]>([]);
    
    const [targetDeliveryDate, setTargetDeliveryDate] = useState('');
    const [advanceAmount, setAdvanceAmount] = useState<number>(0);
    const [paymentMethod, setPaymentMethod] = useState('CASH');

    // Fetch dependencies
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [stylistsRes, servicesRes, productsRes] = await Promise.all([
                    api.get('/stylists'),
                    api.get('/services'),
                    api.get('/inventory')
                ]);
                setStylists(stylistsRes.data || []);
                setServices(servicesRes.data || []);
                
                const activeProds = (productsRes.data || []).filter((p: any) => p.isActive !== false);
                setProducts(activeProds);
                const cats = Array.from(new Set(activeProds.map((p: any) => p.category).filter(Boolean))) as string[];
                setProductCategories(cats);
            } catch (error) {
                console.error("Failed to load tailor dependencies", error);
                showToast("Failed to load stylists, services, or products", "error");
            } finally {
                setIsLoadingData(false);
            }
        };
        fetchData();
    }, []);

    // Derived values
    const totalAmount = garments.reduce((sum, g) => sum + (g.price * g.quantity), 0);

    // Search customers
    const filteredCustomers = customers.filter(c => 
        c.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) || 
        c.phone.includes(customerSearchTerm)
    ).slice(0, 5);

    // Handlers
    const handleAddGarment = () => {
        const newGarment: GarmentDraft = {
            id: Math.random().toString(36).substr(2, 9),
            name: '',
            garmentType: '',
            price: 0,
            quantity: 1,
            fabricDetails: { type: 'None' }
        };
        setGarments([...garments, newGarment]);
    };

    const updateGarment = (id: string, field: keyof GarmentDraft, value: any) => {
        setGarments(prev => prev.map(g => g.id === id ? { ...g, [field]: value } : g));
    };

    const removeGarment = (id: string) => {
        setGarments(prev => prev.filter(g => g.id !== id));
    };

    const handleServiceSelect = (garmentId: string, serviceId: string) => {
        const service = services.find(s => s.id === serviceId);
        if (service) {
            setGarments(prev => prev.map(g => {
                if (g.id === garmentId) {
                    return {
                        ...g,
                        serviceId: service.id,
                        name: service.name,
                        garmentType: service.name, // default to service name
                        price: service.price
                    };
                }
                return g;
            }));
        }
    };

    const handleImageUpload = async (garmentId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []) as File[];
        if (files.length === 0) return;

        showToast(`Uploading ${files.length} image(s)...`, "info");
        try {
            const uploadPromises = files.map(file => uploadToCloudinary(file));
            const urls = await Promise.all(uploadPromises);
            
            setGarments(prev => prev.map(g => {
                if (g.id !== garmentId) return g;
                const existingUrls = g.photoUrls || [];
                return { ...g, photoUrls: [...existingUrls, ...urls] };
            }));
            
            showToast("Image(s) uploaded successfully!", "success");
        } catch (error) {
            console.error("Image upload failed", error);
            showToast("Failed to upload image(s)", "error");
        }
    };

    const handleCreateCustomer = async () => {
        if (!newCustomerName || !newCustomerPhone) {
            showToast("Please enter name and phone number", "error");
            return;
        }
        setIsSubmitting(true);
        try {
            const res = await api.post('/customers', {
                name: newCustomerName,
                phone: newCustomerPhone
            });
            setSelectedCustomer(res.data);
            setStep(2);
            if (garments.length === 0) handleAddGarment();
        } catch (error) {
            showToast("Failed to create customer", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmitOrder = async () => {
        if (!selectedCustomer) {
            showToast("Please select a customer", "error");
            return;
        }
        if (garments.length === 0) {
            showToast("Please add at least one garment", "error");
            return;
        }

        // Validate garments
        for (let g of garments) {
            if (!g.name || !g.garmentType) {
                showToast("All garments must have a name/type", "error");
                return;
            }
        }

        setIsSubmitting(true);
        try {
            const payload = {
                customerId: selectedCustomer.id,
                targetDeliveryDate: targetDeliveryDate || null,
                subtotal: totalAmount,
                totalAmount: totalAmount,
                advanceAmount: advanceAmount,
                paymentMethod: paymentMethod,
                garments: garments.map(g => ({
                    name: g.name,
                    garmentType: g.garmentType,
                    assignedTailorId: g.assignedTailorId,
                    price: g.price,
                    quantity: g.quantity,
                    fabricDetails: g.fabricDetails && g.fabricDetails.type !== 'None' ? g.fabricDetails : null,
                    measurementSnapshot: g.photoUrls && g.photoUrls.length > 0 ? { photoUrls: g.photoUrls } : null
                }))
            };

            await api.post('/tailor/orders', payload);
            showToast("Order created successfully!", "success");
            navigate(`/${appId}/${businessName}/tailor`);
        } catch (error) {
            console.error("Failed to create order", error);
            showToast("Failed to create order", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    // UI Renderers
    const renderStep1 = () => (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '1.5rem' }}>
                Step 1: Select Customer
            </h2>

            {!showNewCustomer ? (
                <>
                    <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <div style={{ position: 'relative', marginBottom: '1rem' }}>
                            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                            <input
                                type="text"
                                placeholder="Search by name or phone..."
                                value={customerSearchTerm}
                                onChange={(e) => setCustomerSearchTerm(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '1rem 1rem 1rem 2.5rem',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border)',
                                    fontSize: '1rem',
                                    background: 'var(--bg-body)'
                                }}
                            />
                        </div>

                        {customerSearchTerm && (
                            <div style={{ background: 'var(--bg-body)', borderRadius: '8px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                                {filteredCustomers.map(c => (
                                    <div
                                        key={c.id}
                                        onClick={() => {
                                            setSelectedCustomer(c);
                                            setStep(2);
                                            if (garments.length === 0) handleAddGarment();
                                        }}
                                        style={{
                                            padding: '1rem',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            cursor: 'pointer',
                                            borderBottom: '1px solid var(--border)',
                                            background: selectedCustomer?.id === c.id ? 'var(--bg-hover)' : 'transparent'
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 600, color: 'var(--text-dark)', fontSize: '1.1rem' }}>{c.name}</div>
                                            <div style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>{c.phone}</div>
                                        </div>
                                        <ChevronRight size={20} color="var(--text-light)" />
                                    </div>
                                ))}
                                {filteredCustomers.length === 0 && (
                                    <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-light)' }}>
                                        No customers found.
                                    </div>
                                )}
                            </div>
                        )}

                        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                            <span style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>OR</span>
                        </div>

                        <button
                            onClick={() => setShowNewCustomer(true)}
                            style={{
                                width: '100%',
                                padding: '1rem',
                                marginTop: '1rem',
                                background: 'transparent',
                                border: '2px dashed var(--primary)',
                                color: 'var(--primary)',
                                borderRadius: '8px',
                                fontWeight: 600,
                                fontSize: '1rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                cursor: 'pointer'
                            }}
                        >
                            <UserPlus size={20} /> Create New Customer
                        </button>
                    </div>
                </>
            ) : (
                <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>New Customer</h3>
                        <button onClick={() => setShowNewCustomer(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                            <X size={20} color="var(--text-light)" />
                        </button>
                    </div>
                    
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--text-dark)' }}>Full Name</label>
                        <input
                            type="text"
                            value={newCustomerName}
                            onChange={e => setNewCustomerName(e.target.value)}
                            placeholder="E.g. John Doe"
                            style={{ width: '100%', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1rem' }}
                        />
                    </div>
                    
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--text-dark)' }}>Phone Number</label>
                        <input
                            type="tel"
                            value={newCustomerPhone}
                            onChange={e => setNewCustomerPhone(e.target.value)}
                            placeholder="E.g. 9876543210"
                            style={{ width: '100%', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1rem' }}
                        />
                    </div>

                    <button
                        onClick={handleCreateCustomer}
                        disabled={isSubmitting}
                        style={{
                            width: '100%',
                            padding: '1rem',
                            background: 'var(--primary)',
                            color: 'white',
                            borderRadius: '8px',
                            fontWeight: 600,
                            fontSize: '1rem',
                            border: 'none',
                            cursor: isSubmitting ? 'not-allowed' : 'pointer',
                            opacity: isSubmitting ? 0.7 : 1
                        }}
                    >
                        {isSubmitting ? 'Creating...' : 'Save & Continue'}
                    </button>
                </div>
            )}
        </div>
    );

    const renderStep2 = () => (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-dark)', margin: 0 }}>
                    Step 2: Add Items
                </h2>
                <div style={{ background: 'var(--bg-body)', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600 }}>
                    Customer: <span style={{ color: 'var(--primary)' }}>{selectedCustomer?.name}</span>
                </div>
            </div>

            {garments.map((garment, index) => (
                <div key={garment.id} style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '1rem', position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Item {index + 1}</h3>
                        {garments.length > 1 && (
                            <button onClick={() => removeGarment(garment.id)} style={{ background: '#FEE2E2', color: '#DC2626', border: 'none', padding: '0.5rem', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                <Trash2 size={16} />
                            </button>
                        )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                        {/* Service Dropdown */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--text-dark)' }}>Service (Optional)</label>
                            <Select
                                value={garment.serviceId ? { value: garment.serviceId, label: services.find(s => s.id === garment.serviceId)?.name || 'Unknown' } : null}
                                onChange={(selected: any) => handleServiceSelect(garment.id, selected ? selected.value : '')}
                                options={services.map(s => ({ value: s.id, label: `${s.name} - ₹${s.price}` }))}
                                placeholder="-- Select Service --"
                                isClearable
                                styles={{ control: (base) => ({ ...base, padding: '0.3rem', borderRadius: '8px', borderColor: 'var(--border)', background: 'var(--bg-body)' }) }}
                            />
                        </div>
                        
                        {/* Garment Type / Name */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--text-dark)' }}>Reference/Description</label>
                            <input
                                type="text"
                                value={garment.name}
                                onChange={(e) => {
                                    updateGarment(garment.id, 'name', e.target.value);
                                    updateGarment(garment.id, 'garmentType', e.target.value);
                                }}
                                placeholder="E.g. Men's Suit, Blouse"
                                style={{ width: '100%', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1rem', background: 'var(--bg-body)' }}
                            />
                        </div>

                        {/* Specialist */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--text-dark)' }}>Assign Tailor</label>
                            <Select
                                value={garment.assignedTailorId ? { value: garment.assignedTailorId, label: stylists.find(s => s.id === garment.assignedTailorId)?.name || 'Unknown' } : null}
                                onChange={(selected: any) => updateGarment(garment.id, 'assignedTailorId', selected ? selected.value : '')}
                                options={stylists.map(s => ({ value: s.id, label: s.name }))}
                                placeholder="-- Select Tailor --"
                                isClearable
                                styles={{ control: (base) => ({ ...base, padding: '0.3rem', borderRadius: '8px', borderColor: 'var(--border)', background: 'var(--bg-body)' }) }}
                            />
                        </div>

                        {/* Price & Quantity */}
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <div style={{ flex: 2 }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--text-dark)' }}>Price</label>
                                <input
                                    type="number"
                                    value={garment.price || ''}
                                    onChange={(e) => updateGarment(garment.id, 'price', parseFloat(e.target.value) || 0)}
                                    placeholder="0.00"
                                    style={{ width: '100%', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1rem', background: 'var(--bg-body)' }}
                                />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--text-dark)' }}>Qty</label>
                                <input
                                    type="number"
                                    value={garment.quantity}
                                    onChange={(e) => updateGarment(garment.id, 'quantity', parseInt(e.target.value) || 1)}
                                    min="1"
                                    style={{ width: '100%', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1rem', background: 'var(--bg-body)' }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Fabric Details (Temporarily Hidden) */}
                    {false && (
                    <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-body)', borderRadius: '12px', border: '1px solid var(--border-light)', boxSizing: 'border-box' }}>
                        <h4 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600, color: 'var(--text-dark)' }}>🧵 Fabric Details</h4>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'end' }}>
                            {/* Fabric Source Selection */}
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--text-dark)', fontSize: '0.9rem' }}>Fabric Source</label>
                                <select
                                    value={garment.fabricDetails?.type || 'None'}
                                    onChange={(e) => {
                                        const type = e.target.value as 'None' | 'Customer' | 'Shop';
                                        if (type === 'None') {
                                            updateGarment(garment.id, 'fabricDetails', { type: 'None' });
                                        } else if (type === 'Customer') {
                                            updateGarment(garment.id, 'fabricDetails', { type: 'Customer', source: 'customer', description: '', details: '' });
                                        } else {
                                            updateGarment(garment.id, 'fabricDetails', { type: 'Shop', source: 'shop', productId: '', quantity: 1, details: '' });
                                        }
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border)',
                                        fontSize: '0.95rem',
                                        background: 'var(--bg-card)',
                                        color: 'var(--text-dark)',
                                        boxSizing: 'border-box'
                                    }}
                                >
                                    <option value="None">No Fabric / Billed Separately</option>
                                    <option value="Customer">Customer Provided Fabric</option>
                                    <option value="Shop">Shop Fabric (Inventory)</option>
                                </select>
                            </div>

                            {/* Customer Fabric Description */}
                            {garment.fabricDetails?.type === 'Customer' && (
                                <div style={{ gridColumn: 'span 2' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--text-dark)', fontSize: '0.9rem' }}>Fabric Description</label>
                                    <input
                                        type="text"
                                        value={garment.fabricDetails?.description || ''}
                                        onChange={(e) => {
                                            updateGarment(garment.id, 'fabricDetails', {
                                                type: 'Customer',
                                                source: 'customer',
                                                description: e.target.value,
                                                details: e.target.value
                                            });
                                        }}
                                        placeholder="E.g., Blue cotton fabric provided by customer"
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border)',
                                            fontSize: '0.95rem',
                                            background: 'var(--bg-card)',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                </div>
                            )}

                            {/* Shop Fabric Category Selection */}
                            {garment.fabricDetails?.type === 'Shop' && (
                                <>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--text-dark)', fontSize: '0.9rem' }}>Inventory Category</label>
                                        <Select
                                            options={productCategories.map(c => ({ value: c, label: c }))}
                                            placeholder="Filter Category"
                                            isClearable
                                            onChange={(selected: any) => {
                                                updateGarment(garment.id, 'fabricDetails', {
                                                    ...garment.fabricDetails,
                                                    tempCategory: selected ? selected.value : ''
                                                });
                                            }}
                                            styles={{ control: (base) => ({ ...base, padding: '0.1rem', borderRadius: '8px', borderColor: 'var(--border)', background: 'var(--bg-card)' }) }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--text-dark)', fontSize: '0.9rem' }}>Select Product / Fabric</label>
                                        <Select
                                            value={garment.fabricDetails?.productId ? {
                                                value: garment.fabricDetails.productId,
                                                label: products.find(p => p.id === garment.fabricDetails?.productId)?.name || 'Select Product'
                                            } : null}
                                            options={products
                                                .filter(p => !garment.fabricDetails?.tempCategory || p.category === garment.fabricDetails.tempCategory)
                                                .map(p => ({ value: p.id, label: `${p.name} (SKU: ${p.sku}, Stock: ${p.stock})` }))
                                            }
                                            placeholder="-- Select Product --"
                                            onChange={(selected: any) => {
                                                const prod = products.find(p => p.id === (selected ? selected.value : ''));
                                                updateGarment(garment.id, 'fabricDetails', {
                                                    ...garment.fabricDetails,
                                                    productId: selected ? selected.value : '',
                                                    details: prod ? `${prod.name} (${garment.fabricDetails?.quantity || 1} qty)` : ''
                                                });
                                            }}
                                            styles={{ control: (base) => ({ ...base, padding: '0.1rem', borderRadius: '8px', borderColor: 'var(--border)', background: 'var(--bg-card)' }) }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--text-dark)', fontSize: '0.9rem' }}>Fabric Quantity</label>
                                        <input
                                            type="number"
                                            value={garment.fabricDetails?.quantity || 1}
                                            min="0.1"
                                            step="0.1"
                                            onChange={(e) => {
                                                const qty = parseFloat(e.target.value) || 1;
                                                const prod = products.find(p => p.id === garment.fabricDetails?.productId);
                                                updateGarment(garment.id, 'fabricDetails', {
                                                    ...garment.fabricDetails,
                                                    quantity: qty,
                                                    details: prod ? `${prod.name} (${qty} qty)` : ''
                                                });
                                            }}
                                            style={{
                                                width: '100%',
                                                padding: '0.75rem',
                                                borderRadius: '8px',
                                                border: '1px solid var(--border)',
                                                fontSize: '0.95rem',
                                                background: 'var(--bg-card)',
                                                boxSizing: 'border-box'
                                            }}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    )}

                    {/* Measurement Photo Upload */}
                    <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-body)', borderRadius: '8px', border: '1px dashed var(--border-light)' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--text-dark)' }}>Measurement Photo (Optional)</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
                            {garment.photoUrls?.map((url, i) => (
                                <div key={i} style={{ position: 'relative' }}>
                                    <img src={url} alt={`Measurement ${i+1}`} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border)' }} />
                                    <button 
                                        onClick={() => updateGarment(garment.id, 'photoUrls', garment.photoUrls!.filter((_, index) => index !== i))} 
                                        style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#DC2626', color: '#FFF', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        title="Remove Photo"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                            <div>
                                <input
                                    type="file"
                                    id={`photo-upload-${garment.id}`}
                                    accept="image/*"
                                    multiple
                                    onChange={(e) => handleImageUpload(garment.id, e)}
                                    style={{ display: 'none' }}
                                />
                                <label htmlFor={`photo-upload-${garment.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '0.75rem 1.5rem', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-dark)', fontWeight: 500, fontSize: '0.95rem' }}>
                                    <UploadCloud size={18} /> {garment.photoUrls?.length ? 'Add More' : 'Upload Photo'}
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            ))}

            <button
                onClick={handleAddGarment}
                style={{ width: '100%', padding: '1rem', background: 'transparent', border: '2px dashed var(--primary)', color: 'var(--primary)', borderRadius: '12px', fontWeight: 600, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '2rem' }}
            >
                <Plus size={20} /> Add Another Item
            </button>

            <div style={{ display: 'flex', gap: '1rem' }}>
                <button onClick={() => setStep(1)} style={{ flex: 1, padding: '1rem', background: 'var(--bg-body)', color: 'var(--text-dark)', borderRadius: '12px', fontWeight: 600, fontSize: '1.1rem', border: '1px solid var(--border)', cursor: 'pointer' }}>
                    Back
                </button>
                <button 
                    onClick={() => {
                        if (garments.some(g => !g.name || !g.garmentType)) {
                            showToast("Please fill Item Type for all items", "error");
                            return;
                        }
                        setStep(3);
                    }} 
                    style={{ flex: 2, padding: '1rem', background: 'var(--primary)', color: 'white', borderRadius: '12px', fontWeight: 600, fontSize: '1.1rem', border: 'none', cursor: 'pointer' }}
                >
                    Continue to Confirm Order
                </button>
            </div>
        </div>
    );

    const renderStep3 = () => (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '1.5rem' }}>
                Step 3: Review & Finalize
            </h2>

            <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: 600 }}>Order Summary</h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: 'var(--text-light)' }}>
                    <span>Customer:</span>
                    <span style={{ color: 'var(--text-dark)', fontWeight: 500 }}>{selectedCustomer?.name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', color: 'var(--text-light)' }}>
                    <span>Total Items:</span>
                    <span style={{ color: 'var(--text-dark)', fontWeight: 500 }}>{garments.reduce((sum, g) => sum + g.quantity, 0)}</span>
                </div>
                
                <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>Total Amount:</span>
                    <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>₹{totalAmount.toFixed(2)}</span>
                </div>
            </div>

            <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '1.5rem' }}>
                {appId !== 'workly-tailor' && (
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-dark)', fontSize: '1.1rem' }}>Expected Delivery Date (Optional)</label>
                        <input
                            type="date"
                            value={targetDeliveryDate}
                            onChange={(e) => setTargetDeliveryDate(e.target.value)}
                            style={{ width: '100%', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1.1rem', background: 'var(--bg-body)' }}
                        />
                    </div>
                )}

                {appId === 'workly-tailor' ? (
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-dark)', fontSize: '1.1rem' }}>Preferred Delivery Date</label>
                        <input
                            type="date"
                            value={targetDeliveryDate}
                            onChange={(e) => setTargetDeliveryDate(e.target.value)}
                            style={{ width: '100%', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1.1rem', background: 'var(--bg-body)' }}
                        />
                    </div>
                ) : (
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-dark)', fontSize: '1.1rem' }}>Advance Payment (Optional)</label>
                        <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-light)' }}>₹</span>
                            <input
                                type="number"
                                value={advanceAmount || ''}
                                onChange={(e) => setAdvanceAmount(parseFloat(e.target.value) || 0)}
                                placeholder="0.00"
                                style={{ width: '100%', padding: '1rem 1rem 1rem 2.5rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1.2rem', fontWeight: 600, background: 'var(--bg-body)' }}
                            />
                        </div>
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
                <button onClick={() => setStep(2)} style={{ flex: 1, padding: '1rem', background: 'var(--bg-body)', color: 'var(--text-dark)', borderRadius: '12px', fontWeight: 600, fontSize: '1.1rem', border: '1px solid var(--border)', cursor: 'pointer' }}>
                    Back
                </button>
                <button 
                    onClick={handleSubmitOrder} 
                    disabled={isSubmitting}
                    style={{ flex: 2, padding: '1rem', background: 'var(--primary)', color: 'white', borderRadius: '12px', fontWeight: 600, fontSize: '1.1rem', border: 'none', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
                >
                    <CheckCircle2 size={20} /> {isSubmitting ? 'Creating...' : 'Create Order'}
                </button>
            </div>
        </div>
    );

    if (isLoadingData) {
        return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
    }

    return (
        <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto', fontFamily: '"Inter", sans-serif' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <button onClick={() => navigate(`/${appId}/${businessName}/tailor`)} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', width: '40px', height: '40px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <ArrowLeft size={20} color="var(--text-dark)" />
                </button>
                <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-dark)' }}>Create Tailor Order</h1>
            </div>

            {/* Stepper Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3rem', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '15px', left: '0', right: '0', height: '2px', background: 'var(--border)', zIndex: 0 }} />
                
                {[
                    { num: 1, label: 'Customer' },
                    { num: 2, label: 'Items' },
                    { num: 3, label: 'Confirm Order' }
                ].map((s) => (
                    <div key={s.num} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 1 }}>
                        <div style={{ 
                            width: '32px', height: '32px', borderRadius: '50%', 
                            background: step >= s.num ? 'var(--primary)' : 'var(--bg-body)', 
                            border: step >= s.num ? '2px solid var(--primary)' : '2px solid var(--border)',
                            color: step >= s.num ? 'white' : 'var(--text-light)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.5rem',
                            transition: 'all 0.3s'
                        }}>
                            {step > s.num ? <CheckCircle2 size={16} /> : s.num}
                        </div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: step >= s.num ? 'var(--text-dark)' : 'var(--text-light)' }}>
                            {s.label}
                        </span>
                    </div>
                ))}
            </div>

            {/* Step Content */}
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
        </div>
    );
};

export default CreateTailorOrder;
