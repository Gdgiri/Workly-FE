import React, { useState, useEffect } from 'react';
import { Plus, CheckCircle, ArrowRight, Trash2, Printer } from 'lucide-react';
import { Card, Button, Input, Modal, Table, Select, SearchableSelect } from './UI';
import api from '../utils/api';
import { useCurrency } from './CurrencyContext';
import { useToast } from './ToastContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';

interface QuotationItem {
  id?: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface QuotationNegotiation {
  id: string;
  quotationId: string;
  previousAmount: number;
  negotiatedAmount: number;
  description?: string;
  createdAt: string;
}

interface Quotation {
  id: string;
  quoteNumber: string;
  customerId: string;
  customerName?: string;
  totalAmount: number;
  subtotal?: number;
  status: 'DRAFT' | 'SENT' | 'APPROVED' | 'DECLINED' | 'EXPIRED' | 'INVOICED';
  createdAt: string;
  items: QuotationItem[];
  negotiations?: QuotationNegotiation[];
}

interface Service {
  id: string;
  name: string;
  price: number;
}

export const QuotationSystem: React.FC = () => {
  const { formatPrice, symbol } = useCurrency();
  const { showToast } = useToast();
  const { settings: salonSettings } = useSelector((state: RootState) => state.settings);
  
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // New Quote Form State
  const [customerId, setCustomerId] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [quoteItems, setQuoteItems] = useState<QuotationItem[]>([
    { name: '', description: '', quantity: 1, unitPrice: 0, total: 0 }
  ]);
  const [notes, setNotes] = useState('');
  
  // Negotiation Modal State
  const [isNegotiationModalOpen, setIsNegotiationModalOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quotation | null>(null);
  const [negotiationAmount, setNegotiationAmount] = useState<string>('');
  const [negotiationDesc, setNegotiationDesc] = useState('');

  const fetchQuotations = async () => {
    setLoading(true);
    try {
      const res = await api.get('/quotations');
      setQuotations(res.data);
    } catch (err) {
      console.error('Error fetching quotations:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await api.get('/customers');
      setCustomers(res.data);
    } catch (err) {
      console.error('Error fetching customers:', err);
    }
  };

  const fetchServicesData = async () => {
    try {
      const res = await api.get('/services');
      setServices(res.data);
    } catch (err) {
      console.error('Error fetching services:', err);
    }
  };

  useEffect(() => {
    fetchQuotations();
    fetchCustomers();
    fetchServicesData();
  }, []);

  const addLineItem = () => {
    setQuoteItems([...quoteItems, { name: '', description: '', quantity: 1, unitPrice: 0, total: 0 }]);
  };

  const removeLineItem = (index: number) => {
    if (quoteItems.length === 1) return;
    setQuoteItems(quoteItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof QuotationItem, value: any) => {
    const newItems = [...quoteItems];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Auto-calculate total
    if (field === 'quantity' || field === 'unitPrice') {
      newItems[index].total = newItems[index].quantity * newItems[index].unitPrice;
    }
    
    setQuoteItems(newItems);
  };

  const handleServiceSelect = (index: number, serviceName: string) => {
    const selectedService = services.find(s => s.name === serviceName);
    const newItems = [...quoteItems];
    
    if (selectedService) {
        newItems[index] = {
            ...newItems[index],
            name: selectedService.name,
            description: selectedService.description || '',
            unitPrice: selectedService.price,
            total: newItems[index].quantity * selectedService.price
        };
    } else {
        newItems[index] = {
            ...newItems[index],
            name: serviceName
        };
    }
    
    setQuoteItems(newItems);
  };

  const totalAmount = quoteItems.reduce((sum, item) => sum + item.total, 0);

  const handleCreateQuotation = async () => {
    if (!customerId) return showToast('Please select a customer', 'error');
    if (quoteItems.some(i => !i.name)) return showToast('Please provide names for all items', 'error');

    setIsProcessing(true);
    try {
      await api.post('/quotations', {
        customerId,
        items: quoteItems,
        subtotal: totalAmount,
        totalAmount,
        notes
      });
      showToast('Quotation created successfully', 'success');
      setIsModalOpen(false);
      resetForm();
      fetchQuotations();
    } catch (err) {
      showToast('Failed to create quotation', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConvertToInvoice = async (id: string) => {
    setIsProcessing(true);
    try {
      await api.patch(`/quotations/${id}/status`, { status: 'APPROVED' });
      const res = await api.post(`/quotations/${id}/convert-to-sale`);
      showToast(`Converted to Invoice: ${res.data.sale.saleNumber}`, 'success');
      fetchQuotations();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Conversion failed', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNegotiate = async () => {
    if (!selectedQuote) return;
    if (!negotiationAmount || isNaN(parseFloat(negotiationAmount))) {
      return showToast('Please enter a valid amount', 'error');
    }

    setIsProcessing(true);
    try {
      await api.post(`/quotations/${selectedQuote.id}/negotiate`, {
        negotiatedAmount: parseFloat(negotiationAmount),
        description: negotiationDesc
      });
      showToast('Negotiation recorded', 'success');
      setIsNegotiationModalOpen(false);
      fetchQuotations();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Negotiation failed', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrint = (q: Quotation) => {
    const customer = customers.find(c => c.id === q.customerId);

    const isInvoice = q.status === 'INVOICED';
    const title = isInvoice ? 'INVOICE' : 'QUOTATION';

    const itemsHtml = q.items.map(item => {
        const itemName = item.name || item.description || 'Service';
        const itemDesc = item.name ? item.description : ''; // If name exists, description is separate. Otherwise description was name.

        return `
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">
                <div style="font-weight: bold; color: #1e293b;">${itemName}</div>
                ${itemDesc ? `<div style="font-size: 11px; color: #64748b; margin-top: 4px;">${itemDesc}</div>` : ''}
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
            <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">${symbol}${item.unitPrice.toFixed(2)}</td>
            <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">${symbol}${item.total.toFixed(2)}</td>
        </tr>
    `;}).join('');

    const originalSubtotal = (q.items as any[]).reduce((sum, item) => sum + (item.total || 0), 0);
    const negotiationDiscount = originalSubtotal - q.totalAmount;
    const discountPercentage = originalSubtotal > 0 ? (negotiationDiscount / originalSubtotal) * 100 : 0;

    const totalsHtml = `
        <div class="totals">
            <div class="total-row">
                <span style="color: #64748b; font-weight: 600;">Subtotal</span>
                <span style="font-weight: 700; color: #1e293b;">${symbol}${originalSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            ${negotiationDiscount > 0 ? `
                <div class="total-row" style="color: #ef4444;">
                    <span style="font-weight: 600;">Discount ${discountPercentage > 0 ? `(${discountPercentage.toFixed(1)}%)` : ''}</span>
                    <span style="font-weight: 700;">- ${symbol}${negotiationDiscount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
            ` : ''}
            <div class="total-row grand-total">
                <span>Total Amount</span>
                <span>${symbol}${q.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
        </div>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
        <html>
            <head>
                <title>${title} - ${q.quoteNumber}</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; background: white; }
                    .header { display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; }
                    .company-info h1 { margin: 0; color: #0f172a; font-size: 24px; font-weight: 800; text-transform: uppercase; }
                    .quote-details { text-align: right; }
                    .quote-details h2 { margin: 0; color: ${isInvoice ? '#059669' : '#2563eb'}; font-size: 24px; font-weight: 800; letter-spacing: -0.02em; }
                    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
                    .info-section h3 { font-size: 11px; text-transform: uppercase; color: #64748b; margin-bottom: 8px; letter-spacing: 0.1em; font-weight: 800; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
                    th { text-align: left; padding: 12px; background: #f8fafc; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 800; border-bottom: 2px solid #e2e8f0; }
                    .totals { text-align: right; margin-left: auto; width: 280px; }
                    .total-row { display: flex; justify-content: space-between; padding: 10px 0; font-size: 14px; }
                    .grand-total { border-top: 2px solid #f1f5f9; margin-top: 10px; padding-top: 15px; color: #0f172a; font-weight: 900; font-size: 20px; }
                    .footer { margin-top: 80px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 20px; font-weight: 500; }
                    @media print { 
                        body { padding: 0; } 
                        .no-print { display: none; }
                        @page { margin: 20mm; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="company-info">
                        <h1>${salonSettings?.salonName || 'Your Business'}</h1>
                        <p style="font-size: 13px; color: #475569; margin: 6px 0; white-space: pre-line;">
                            ${salonSettings?.salonAddress || ''}
                            ${salonSettings?.salonPhone ? `\nTel: ${salonSettings.salonPhone}` : ''}
                        </p>
                    </div>
                    <div class="quote-details">
                        <h2>${title}</h2>
                        <p style="font-size: 14px; font-weight: 700; color: #1e293b; margin: 4px 0;">
                            # ${q.quoteNumber}
                        </p>
                        <p style="font-size: 13px; color: #64748b; margin: 0;">
                            Date: ${new Date(q.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                    </div>
                </div>

                <div class="info-grid">
                    <div class="info-section">
                        <h3>Billed To</h3>
                        <div style="font-weight: 800; font-size: 18px; color: #0f172a;">${customer?.name || 'Walk-in Customer'}</div>
                        ${customer?.phone ? `<div style="font-size: 13px; color: #475569; margin-top: 4px;">${customer.phone}</div>` : ''}
                        ${customer?.email ? `<div style="font-size: 13px; color: #475569;">${customer.email}</div>` : ''}
                    </div>
                    <div class="info-section" style="text-align: right;">
                        <h3>Document Status</h3>
                        <div style="display: inline-block; padding: 6px 16px; border-radius: 8px; background: ${isInvoice ? '#ecfdf5' : '#eff6ff'}; color: ${isInvoice ? '#059669' : '#2563eb'}; font-weight: 800; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">${q.status}</div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width: 50%;">Description</th>
                            <th style="text-align: center; width: 15%;">Qty</th>
                            <th style="text-align: right; width: 15%;">Unit Price</th>
                            <th style="text-align: right; width: 20%;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>

                ${totalsHtml}

                ${q.notes ? `
                    <div style="margin-top: 50px; padding: 20px; background: #f8fafc; border-radius: 12px; border-left: 4px solid ${isInvoice ? '#059669' : '#2563eb'};">
                        <h3 style="font-size: 11px; text-transform: uppercase; color: ${isInvoice ? '#059669' : '#2563eb'}; margin: 0 0 10px 0; letter-spacing: 0.1em;">Remarks / Terms</h3>
                        <p style="margin: 0; font-size: 14px; color: #334155; line-height: 1.6;">${q.notes}</p>
                    </div>
                ` : ''}

                <div class="footer">
                    <p style="margin-bottom: 8px;">THANK YOU FOR YOUR BUSINESS</p>
                    <p style="color: #cbd5e1;">Generated on ${new Date().toLocaleString()}</p>
                </div>

                <script>
                    window.onload = function() { 
                        setTimeout(() => {
                            window.print(); 
                            // window.close(); // Optional: close tab after print?
                        }, 500);
                    };
                </script>
            </body>
        </html>
    `);
    printWindow.document.close();
  };

  const resetForm = () => {
    setCustomerId('');
    setQuoteItems([{ name: '', description: '', quantity: 1, unitPrice: 0, total: 0 }]);
    setNotes('');
  };

  const [viewingQuotation, setViewingQuotation] = useState<Quotation | null>(null);

  const columns = [
    { 
        header: 'Quote #', 
        accessor: (q: Quotation) => <span style={{ fontWeight: 800, color: 'var(--primary)' }}>{q.quoteNumber}</span> 
    },
    { 
        header: 'Customer', 
        accessor: (q: Quotation) => <span>{customers.find(c => c.id === q.customerId)?.name || 'N/A'}</span> 
    },
    {
        header: 'Items',
        accessor: (q: Quotation) => {
            const count = q.items?.length || 0;
            return <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{count} {count === 1 ? 'Service' : 'Services'}</span>
        }
    },
    { 
        header: 'Amount', 
        accessor: (q: Quotation) => (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 800 }}>{formatPrice(q.totalAmount)}</span> 
                {q.negotiations && q.negotiations.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.125rem' }}>
                        {q.negotiations.slice().reverse().map((n, i) => (
                            <span key={i} style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textDecoration: 'line-through', opacity: 0.6 }}>
                                {formatPrice(n.previousAmount)}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        )
    },
    { 
        header: 'Status', 
        accessor: (q: Quotation) => {
            const getStatusStyle = (status: string) => {
                switch(status) {
                  case 'INVOICED': return { bg: '#ECFDF5', text: '#059669' };
                  case 'APPROVED': return { bg: '#EFF6FF', text: '#2563EB' };
                  case 'DRAFT': return { bg: '#F8FAFC', text: '#64748B' };
                  default: return { bg: '#FFFBEB', text: '#D97706' };
                }
            };
            const style = getStatusStyle(q.status);
            return (
                <span style={{ 
                    padding: '0.25rem 0.75rem', 
                    borderRadius: 'var(--radius-full)', 
                    fontSize: '0.625rem', 
                    fontWeight: 900, 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.05em',
                    backgroundColor: style.bg,
                    color: style.text
                }}>
                    {q.status}
                </span>
            )
        }
    },
    { 
        header: 'Date', 
        accessor: (q: Quotation) => <span>{new Date(q.createdAt).toLocaleDateString()}</span> 
    },
    {
      header: 'Actions',
      accessor: (q: Quotation) => (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {q.status !== 'INVOICED' && (
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <Button 
                  variant="outline" 
                  onClick={(e) => { 
                      e.stopPropagation(); 
                      setSelectedQuote(q);
                      setNegotiationAmount(q.totalAmount.toString());
                      setNegotiationDesc('');
                      setIsNegotiationModalOpen(true);
                  }}
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', height: '1.75rem', color: 'var(--primary)', borderColor: 'var(--primary)' }}
              >
                Negotiate
              </Button>
              <Button 
                  variant="outline" 
                  onClick={(e) => { e.stopPropagation(); handleConvertToInvoice(q.id); }}
                  isLoading={isProcessing}
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', height: '1.75rem' }}
              >
                Invoice
              </Button>
            </div>
          )}
          {q.status === 'INVOICED' && (
            <div style={{ display: 'flex', alignItems: 'center', color: 'var(--success)', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 700 }}>
               <CheckCircle size={14} /> Invoiced
            </div>
          )}
          <Button 
            variant="ghost" 
            onClick={(e) => { e.stopPropagation(); handlePrint(q); }}
            style={{ padding: '0.25rem', height: '1.75rem', color: 'var(--primary)' }}
          >
            <Printer size={16} />
          </Button>
        </div>
      )
    }
  ];

  const serviceOptions = services.map(s => ({ value: s.name, label: `${s.name} (${formatPrice(s.price)})` }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Detail View Modal */}
      <Modal 
        isOpen={!!viewingQuotation} 
        onClose={() => setViewingQuotation(null)} 
        title={`Quotation Details: ${viewingQuotation?.quoteNumber}`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', backgroundColor: 'var(--bg-hover)', padding: '1rem', borderRadius: 'var(--radius-lg)' }}>
                <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block' }}>Customer</label>
                    <span style={{ fontWeight: 600 }}>{customers.find(c => c.id === viewingQuotation?.customerId)?.name || 'N/A'}</span>
                </div>
                <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block' }}>Date</label>
                    <span style={{ fontWeight: 600 }}>{viewingQuotation && new Date(viewingQuotation.createdAt).toLocaleString()}</span>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 800 }}>Line Items</h4>
                <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '0.5rem', padding: '0.75rem', backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border-light)', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                        <div>Service</div>
                        <div style={{ textAlign: 'center' }}>Qty</div>
                        <div style={{ textAlign: 'right' }}>Price</div>
                        <div style={{ textAlign: 'right' }}>Total</div>
                    </div>
                    {viewingQuotation?.items.map((item, i) => {
                        const itemName = item.name || item.description || 'Service';
                        const itemDesc = item.name ? item.description : '';

                        return (
                            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '0.5rem', padding: '0.75rem', backgroundColor: 'white', borderBottom: i === viewingQuotation.items.length - 1 ? 'none' : '1px solid var(--border-light)', fontSize: '0.85rem' }}>
                                <div>
                                    <div style={{ fontWeight: 700, color: 'var(--text-dark)' }}>{itemName}</div>
                                    {itemDesc && <div style={{ fontSize: '0.75rem', color: 'var(--text-black)', marginTop: '0.25rem', fontStyle: 'italic' }}>{itemDesc}</div>}
                                </div>
                                <div style={{ textAlign: 'center' }}>{item.quantity}</div>
                                <div style={{ textAlign: 'right' }}>{formatPrice(item.unitPrice)}</div>
                                <div style={{ textAlign: 'right', fontWeight: 700 }}>{formatPrice(item.total)}</div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {(() => {
                const originalItemsTotal = viewingQuotation?.items.reduce((sum, item) => sum + (item.total || 0), 0) || 0;
                const negotiationDiscount = originalItemsTotal - (viewingQuotation?.totalAmount || 0);
                const discountPercentage = originalItemsTotal > 0 ? (negotiationDiscount / originalItemsTotal) * 100 : 0;

                return (
                    <div style={{ alignSelf: 'flex-end', display: 'flex', flexDirection: 'column', gap: '0.25rem', textAlign: 'right', minWidth: '200px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Subtotal</span>
                            <span style={{ fontWeight: 600 }}>{formatPrice(originalItemsTotal)}</span>
                        </div>
                        {negotiationDiscount > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444' }}>
                                <span style={{ fontSize: '0.875rem', fontWeight: 700 }}>Discount {discountPercentage > 0 ? `(${discountPercentage.toFixed(1)}%)` : ''}</span>
                                <span style={{ fontWeight: 700 }}>- {formatPrice(negotiationDiscount)}</span>
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 900, marginTop: '0.5rem', borderTop: '2px solid var(--border)', paddingTop: '0.5rem' }}>
                            <span>Total Amount</span>
                            <span style={{ color: 'var(--primary)' }}>{formatPrice(viewingQuotation?.totalAmount || 0)}</span>
                        </div>
                    </div>
                );
            })()}

            {viewingQuotation?.notes && (
                <div style={{ padding: '1rem', backgroundColor: '#F8FAFC', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--primary)' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', display: 'block', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Notes</label>
                    <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.5 }}>{viewingQuotation.notes}</p>
                </div>
            )}

            {viewingQuotation?.negotiations && viewingQuotation.negotiations.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 800, color: 'var(--primary)' }}>Negotiation History</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {viewingQuotation.negotiations.map((n, i) => (
                            <div key={i} style={{ padding: '0.75rem', backgroundColor: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', fontSize: '0.8rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                    <span style={{ fontWeight: 800 }}>{formatPrice(n.negotiatedAmount)}</span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{new Date(n.createdAt).toLocaleString()}</span>
                                </div>
                                {n.description && <p style={{ margin: 0, color: 'var(--text-black)', fontStyle: 'italic' }}>"{n.description}"</p>}
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                    Previous: {formatPrice(n.previousAmount)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <Button onClick={() => setViewingQuotation(null)}>Close View</Button>
            </div>
        </div>
      </Modal>

      {/* Header Actions */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        backgroundColor: 'var(--bg-card)', 
        padding: '1.5rem', 
        borderRadius: 'var(--radius-2xl)',
        boxShadow: 'var(--shadow-sm)',
        border: '1px solid var(--border-light)'
      }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-dark)', letterSpacing: '-0.03em', margin: 0 }}>Quotation Hub</h2>
          <p style={{ color: 'var(--text-black)', fontSize: '0.875rem', marginTop: '0.25rem' }}>Create and manage service estimates for your clients.</p>
        </div>
        <Button 
            onClick={() => setIsModalOpen(true)}
            icon={<Plus size={20} />}
            style={{ borderRadius: 'var(--radius-xl)', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}
        >
            New Quotation
        </Button>
      </div>

      {/* List View */}
      <Card style={{ borderRadius: 'var(--radius-2xl)', border: 'none', boxShadow: 'var(--shadow-lg)' }}>
        <Table 
            columns={columns} 
            data={quotations} 
            isLoading={loading}
            skeletonCount={5}
            onRowClick={(q) => setViewingQuotation(q)}
        />
      </Card>

      {/* New Quotation Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Create Service Quotation"
        size="xl"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
            <Select 
              label="Recipient Customer"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              options={[
                { value: '', label: 'Select a Customer' },
                ...customers.map(c => ({ value: c.id, label: `${c.name} (${c.phone})` }))
              ]}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontWeight: 900, color: 'var(--text-dark)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.1em', margin: 0 }}>Service Details</h4>
                <Button variant="ghost" onClick={addLineItem} icon={<Plus size={16} />} style={{ color: 'var(--primary)', padding: '0.25rem 0.5rem' }}>
                    Add Item
                </Button>
            </div>
            
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '0.75rem', 
              paddingBottom: '12rem', // Increased padding to prevent dropdown clipping
              minHeight: '200px' 
            }}>
              {quoteItems.map((item, idx) => (
                <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={idx} 
                    style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(12, 1fr)', 
                        gap: '0.75rem', 
                        alignItems: 'end', 
                        backgroundColor: 'var(--bg-hover)', 
                        padding: '1.5rem 1rem', 
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border-light)',
                        position: 'relative', // Ensure relative context
                        zIndex: quoteItems.length - idx // Stack top items higher
                    }}
                >
                  <div style={{ gridColumn: 'span 5', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <SearchableSelect 
                      label="Service"
                      placeholder="Type or select service..."
                      value={item.name}
                      allowCustom={true}
                      options={serviceOptions}
                      onChange={(e) => handleServiceSelect(idx, e.target.value)}
                    />
                    <Input 
                        placeholder="Add secondary description..."
                        value={item.description}
                        onChange={(e) => updateLineItem(idx, 'description', e.target.value)}
                        style={{ fontSize: '0.75rem', height: '1.75rem', marginTop: '-0.25rem' }}
                    />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <Input 
                      label="Qty"
                      type="number" 
                      placeholder="1" 
                      value={item.quantity}
                      onChange={(e) => updateLineItem(idx, 'quantity', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <Input 
                      label="Price"
                      type="number" 
                      placeholder="0" 
                      value={item.unitPrice}
                      onChange={(e) => updateLineItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-black)', textTransform: 'uppercase' }}>Subtotal</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-dark)' }}>{formatPrice(item.total)}</span>
                  </div>
                  <div style={{ gridColumn: 'span 1', display: 'flex', justifyContent: 'center', paddingBottom: '0.75rem' }}>
                    <button onClick={() => removeLineItem(idx)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>
                        <Trash2 size={18} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div style={{ 
            backgroundColor: 'var(--primary-light)', 
            padding: '1.5rem', 
            borderRadius: 'var(--radius-2xl)', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center' 
          }}>
             <div>
                <p style={{ color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Total Amount</p>
                <h3 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--primary-dark)', margin: 0 }}>{formatPrice(totalAmount)}</h3>
             </div>
             <div style={{ display: 'flex', gap: '0.75rem' }}>
                <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button 
                    onClick={handleCreateQuotation} 
                    isLoading={isProcessing}
                    style={{ paddingLeft: '2rem', paddingRight: '2rem' }}
                >
                    Create Quote
                </Button>
             </div>
          </div>
        </div>
      </Modal>

      {/* Negotiation Modal */}
      <Modal 
        isOpen={isNegotiationModalOpen} 
        onClose={() => setIsNegotiationModalOpen(false)} 
        title={`Negotiate Quotation: ${selectedQuote?.quoteNumber}`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ backgroundColor: 'var(--primary-light)', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', display: 'block', textTransform: 'uppercase' }}>Current Amount</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--primary-dark)' }}>{formatPrice(selectedQuote?.totalAmount || 0)}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <Input 
                    label="Negotiated Amount"
                    type="number"
                    value={negotiationAmount}
                    onChange={(e) => setNegotiationAmount(e.target.value)}
                    placeholder="Enter new amount..."
                />
                <Input 
                    label="Reason / Description"
                    value={negotiationDesc}
                    onChange={(e) => setNegotiationDesc(e.target.value)}
                    placeholder="Customer requested discount, volume pricing, etc..."
                />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <Button variant="secondary" onClick={() => setIsNegotiationModalOpen(false)}>Cancel</Button>
                <Button 
                    onClick={handleNegotiate} 
                    isLoading={isProcessing}
                    style={{ paddingLeft: '2rem', paddingRight: '2rem' }}
                >
                    Save Negotiation
                </Button>
            </div>
        </div>
      </Modal>
    </div>
  );
};
