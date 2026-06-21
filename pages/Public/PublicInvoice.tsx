import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../utils/api';
import { generateInvoicePDF } from '../../utils/pdfGenerator';
import { Loader2, Download } from 'lucide-react';
import { Button } from '../../components/UI';
import { useCurrency } from '../../components/CurrencyContext';

const PublicInvoice: React.FC = () => {
    const { businessName, saleId } = useParams();
    const [loading, setLoading] = useState(true);
    const [invoiceData, setInvoiceData] = useState<any>(null);
    const [storeInfo, setStoreInfo] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const { symbol } = useCurrency();

    useEffect(() => {
        const fetchInvoice = async () => {
            try {
                // Ensure we use the exact public endpoint route structure we added
                const res = await api.get(`/public/${businessName}/invoice/${saleId}`);
                setInvoiceData(res.data.invoice);
                setStoreInfo(res.data.storeInfo);
            } catch (err: any) {
                setError(err.response?.data?.error || 'Failed to load invoice');
            } finally {
                setLoading(false);
            }
        };
        if (businessName && saleId) {
            fetchInvoice();
        } else {
            setError('Invalid link format');
            setLoading(false);
        }
    }, [businessName, saleId]);

    const handleDownload = () => {
        if (!invoiceData || !storeInfo) return;

        // Build data object formatted specifically for pdfGenerator.ts
        const data = {
            salonName: storeInfo.businessName || 'Business',
            address: storeInfo.businessAddress || '',
            phone: storeInfo.businessPhone || '',
            invoiceNumber: invoiceData.saleNumber || invoiceData.id.slice(0, 8),
            date: new Date(invoiceData.createdAt).toLocaleDateString(),
            customerName: invoiceData.customer?.name || 'Customer',
            customerPhone: invoiceData.customer?.phone || invoiceData.customer?.mobile || '',
            items: invoiceData.items.map((item: any) => ({
                name: item.service?.name || item.name || 'Item',
                quantity: item.quantity || 1,
                price: item.price
            })),
            subtotal: invoiceData.subtotal,
            discount: invoiceData.discount || 0,
            total: invoiceData.totalAmount,
            payments: invoiceData.payments.map((p: any) => ({
                paymentMethod: p.paymentMethod || p.method || 'Paid',
                amount: p.amount
            }))
        };

        generateInvoicePDF(data);
    };

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '1rem', background: '#f9fafb' }}>
            <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#4f46e5' }} />
            <p style={{ color: '#6b7280', fontWeight: 500 }}>Loading your invoice...</p>
        </div>;
    }

    if (error || !invoiceData) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '1rem', color: '#ef4444', background: '#f9fafb' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Oops!</h2>
            <p>{error || 'Invoice not found'}</p>
        </div>;
    }

    return (
        <div style={{ minHeight: '100vh', background: '#f3f4f6', padding: '2rem 1rem', fontFamily: 'sans-serif' }}>
            <div style={{ maxWidth: '600px', margin: '0 auto', background: '#fff', borderRadius: '16px', padding: '2.5rem', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <h1 style={{ margin: 0, fontSize: '1.75rem', color: '#111827', fontWeight: 800 }}>{storeInfo?.businessName || 'Invoice'}</h1>
                    <p style={{ margin: '0.25rem 0', color: '#6b7280', fontSize: '0.875rem' }}>{storeInfo?.businessAddress}</p>
                    <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem', fontWeight: 500 }}>{storeInfo?.businessPhone}</p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', borderBottom: '2px solid #f3f4f6', paddingBottom: '1.5rem' }}>
                    <div>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Billed To</p>
                        <p style={{ margin: '0.25rem 0 0', fontWeight: 700, color: '#1f2937' }}>{invoiceData.customer?.name || 'Customer'}</p>
                        <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>{invoiceData.customer?.phone || invoiceData.customer?.mobile || ''}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Invoice Details</p>
                        <p style={{ margin: '0.25rem 0 0', fontWeight: 700, color: '#1f2937' }}>#{invoiceData.saleNumber || invoiceData.id.slice(0, 8)}</p>
                        <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>{new Date(invoiceData.createdAt).toLocaleDateString()}</p>
                    </div>
                </div>

                <div style={{ marginBottom: '2rem' }}>
                    {invoiceData.items.map((item: any, idx: number) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid #f9fafb' }}>
                            <div>
                                <p style={{ margin: 0, fontWeight: 600, color: '#374151' }}>{item.service?.name || item.name || 'Item'}</p>
                                <p style={{ margin: '0.125rem 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>Qty: {item.quantity || 1} × {symbol}{item.price}</p>
                            </div>
                            <p style={{ margin: 0, fontWeight: 700, color: '#1f2937' }}>{symbol}{((item.quantity || 1) * item.price).toFixed(2)}</p>
                        </div>
                    ))}
                </div>

                <div style={{ borderTop: '2px solid #f3f4f6', paddingTop: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#6b7280', fontWeight: 500 }}>
                        <span>Subtotal</span>
                        <span>{symbol}{(invoiceData.subtotal || 0).toFixed(2)}</span>
                    </div>
                    {invoiceData.discount > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#ef4444', fontWeight: 500 }}>
                            <span>Discount</span>
                            <span>-{symbol}{(invoiceData.discount || 0).toFixed(2)}</span>
                        </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#111827', fontWeight: 700 }}>
                        <span>Total Order Value</span>
                        <span>{symbol}{(invoiceData.totalAmount || 0).toFixed(2)}</span>
                    </div>
                    {invoiceData.balanceAmount > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#ef4444', fontWeight: 600 }}>
                            <span>Balance Due</span>
                            <span>{symbol}{(invoiceData.balanceAmount || 0).toFixed(2)}</span>
                        </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', paddingTop: '1rem', borderTop: '2px dashed #e5e7eb', fontSize: '1.25rem', fontWeight: 800, color: '#10b981' }}>
                        <span>Total Amount Paid</span>
                        <span>{symbol}{(invoiceData.paidAmount || 0).toFixed(2)}</span>
                    </div>
                </div>

                <div style={{ marginTop: '3rem', display: 'flex', justifyContent: 'center' }}>
                    <Button 
                        onClick={handleDownload}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#4f46e5', color: '#fff', border: 'none', padding: '0.875rem 2.5rem', borderRadius: '999px', fontWeight: 700, fontSize: '1rem', boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.4)', transition: 'transform 0.2s' }}
                        onMouseOver={(e: any) => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseOut={(e: any) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        <Download size={20} /> Download PDF Invoice
                    </Button>
                </div>
            </div>
            
            <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.75rem', marginTop: '2rem' }}>Powered by Workly</p>
        </div>
    );
};

export default PublicInvoice;
