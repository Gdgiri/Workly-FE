import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PDFData {
    salonName: string;
    salonAddress: string;
    salonPhone: string;
    invoiceNumber: string;
    date: string;
    customerName: string;
    customerPhone: string;
    items: any[];
    subtotal: number;
    discount: number;
    total: number;
    paymentMethod: string;
    cashierName: string;
    currencySymbol: string;
    payments?: { paymentMethod: string; amount: number }[];
}

const createInvoicePDFDoc = (data: PDFData) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // Header (Black and White)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(0, 0, 0);
    doc.text(data.salonName || 'Salon', 14, 25);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Place: ${data.salonAddress || ''}`, 14, 32);
    doc.text(`Phone: ${data.salonPhone || 'N/A'}`, 14, 37);

    // Invoice Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(0, 0, 0);
    doc.text('INVOICE', pageWidth - 14, 25, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Invoice Number: ${data.invoiceNumber || 'N/A'}`, pageWidth - 14, 32, { align: 'right' });
    doc.text(`Date: ${data.date}`, pageWidth - 14, 37, { align: 'right' });

    doc.setDrawColor(0, 0, 0);
    doc.line(14, 45, pageWidth - 14, 45);

    // Bill To Section
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text('BILL TO:', 14, 55);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(data.customerName || 'Walk-in Customer', 14, 62);
    doc.setFontSize(10);
    doc.text(data.customerPhone || '', 14, 67);

    // Payment Info Section
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text('PAYMENT DETAILS', pageWidth - 14, 55, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const methodDisplay = data.payments && data.payments.length > 1 ? 'Split Payment' : (data.paymentMethod || 'N/A');
    doc.text(`Method: ${methodDisplay}`, pageWidth - 14, 62, { align: 'right' });
    doc.text(`Cashier: ${data.cashierName || 'Admin'}`, pageWidth - 14, 67, { align: 'right' });

    // Table
    const tableData = data.items.map(item => [
        item.name,
        item.quantity,
        `${data.currencySymbol} ${item.price.toFixed(2)}`,
        `${data.currencySymbol} ${(item.price * item.quantity).toFixed(2)}`
    ]);

    autoTable(doc, {
        startY: 75,
        head: [['Service / Product', 'Qty', 'Unit Price', 'Total']],
        body: tableData,
        theme: 'grid',
        headStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            fontSize: 10,
            fontStyle: 'bold',
            lineWidth: 0.1,
            lineColor: [0, 0, 0]
        },
        styles: {
            fontSize: 9,
            cellPadding: 4,
            textColor: [0, 0, 0],
            lineWidth: 0.1,
            lineColor: [0, 0, 0]
        },
        columnStyles: {
            0: { cellWidth: 'auto', halign: 'left' },
            1: { cellWidth: 20, halign: 'center' },
            2: { cellWidth: 35, halign: 'right' },
            3: { cellWidth: 30, halign: 'right' }
        },
        didParseCell: function (data) {
            if (data.section === 'head' && (data.column.index === 2 || data.column.index === 3)) {
                data.cell.styles.halign = 'right';
            }
        }
    });

    // Summary Section
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    const summaryX = pageWidth - 14;
    const labelX = summaryX - 40; // Align labels closer to values

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text('Subtotal:', labelX, finalY, { align: 'right' });
    doc.text(`${data.currencySymbol} ${data.subtotal.toFixed(2)}`, summaryX, finalY, { align: 'right' });

    let currentY = finalY;

    if (data.discount > 0) {
        currentY += 7;
        doc.text('Discount:', labelX, currentY, { align: 'right' });
        doc.text(`-${data.currencySymbol} ${data.discount.toFixed(2)}`, summaryX, currentY, { align: 'right' });
    }

    currentY += 12;
    doc.setDrawColor(0, 0, 0);
    doc.line(labelX - 10, currentY - 7, summaryX, currentY - 7);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Total Amount:', labelX, currentY, { align: 'right' });
    doc.text(`${data.currencySymbol} ${data.total.toFixed(2)}`, summaryX, currentY, { align: 'right' });

    if (data.payments && data.payments.length > 1) {
        currentY += 10;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('Payment Breakdown:', labelX, currentY, { align: 'right' });
        
        doc.setFont('helvetica', 'normal');
        data.payments.forEach(p => {
            currentY += 6;
            doc.text(`${p.paymentMethod}:`, labelX, currentY, { align: 'right' });
            doc.text(`${data.currencySymbol} ${p.amount.toFixed(2)}`, summaryX, currentY, { align: 'right' });
        });
    }

    // Footer
    const footerY = doc.internal.pageSize.height - 20;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text('Thank you for your business!', pageWidth / 2, footerY, { align: 'center' });
    doc.text('This is a computer-generated invoice.', pageWidth / 2, footerY + 5, { align: 'center' });

    return doc;
};

export const generateInvoicePDF = (data: PDFData) => {
    const doc = createInvoicePDFDoc(data);
    doc.save(`Invoice_${data.invoiceNumber || 'Download'}.pdf`);
};

export const getInvoicePDFFile = (data: PDFData): File => {
    const doc = createInvoicePDFDoc(data);
    const blob = doc.output('blob');
    return new File([blob], `Invoice_${data.invoiceNumber || 'Download'}.pdf`, { type: 'application/pdf' });
};
