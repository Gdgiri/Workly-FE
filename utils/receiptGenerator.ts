
import { CartItem } from '../types';

interface ReceiptData {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  invoiceNumber: string;
  date: string;
  customerName: string;
  items: any[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  cashierName: string;
  currencySymbol: string;
}

export const generateReceiptHtml = (data: ReceiptData) => {
  const formatCurrency = (amount: number) => `${data.currencySymbol}${amount.toFixed(2)}`;

  // Generate Item Rows
  const itemRows = data.items.map(item => `
        <div class="item-container" style="margin-bottom: 8px;">
            <div class="row">
                <div class="label" style="font-weight: bold;">${item.name}</div>
                <div class="val" style="font-weight: bold;">${formatCurrency(item.price * item.quantity)}</div>
            </div>
            <div style="font-size: 0.9em; margin-top: 2px; font-weight: bold;">
                ${item.quantity} x ${formatCurrency(item.price)}
            </div>
        </div>
    `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <title>Receipt - ${data.invoiceNumber}</title>
  <style>
    @page { margin: 0; size: 80mm auto; }
    body {
      width: 72mm;
      margin: 0 auto;
      padding: 4mm;
      font-family: 'Courier New', Courier, monospace;
      font-size: 13px;
      line-height: 1.4;
      color: black;
      background: white;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .bold { font-weight: bold; }
    .divider { border-top: 1px dashed #000; margin: 10px 0; }
    
    .row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    
    .label {
        text-align: left;
        flex: 1;
    }
    .val {
        text-align: right;
        white-space: nowrap;
    }
    
    .header-info {
        font-size: 11px;
        margin-top: 2px;
    }
  </style>
</head>
<body onload="window.print(); setTimeout(window.close, 1000);">
  <div class="text-center bold" style="font-size: 18px; text-transform: lowercase;">${data.storeName}</div>
  <div class="text-center header-info bold">${data.storeAddress || ''}</div>
  <div class="text-center header-info bold">Tel: ${data.storePhone || ''}</div>
  
  <div class="divider"></div>
  
  <div class="row bold">
    <div class="label">Date:</div>
    <div class="val">${data.date}</div>
  </div>
  <div class="row bold">
    <div class="label">Invoice:</div>
    <div class="val">${data.invoiceNumber}</div>
  </div>
  <div class="row bold">
    <div class="label">Billed To:</div>
    <div class="val">${data.customerName}</div>
  </div>
  <div class="row bold">
    <div class="label">Pay Mode:</div>
    <div class="val">${data.paymentMethod}</div>
  </div>
  <div class="row bold">
    <div class="label">Cashier:</div>
    <div class="val">${data.cashierName}</div>
  </div>

  <div class="divider"></div>

  <div class="row bold">
    <div class="label">Item</div>
    <div class="val">Total</div>
  </div>
  <div class="divider"></div>

  ${itemRows}

  <div class="divider"></div>

  <div class="row bold">
    <div class="label">Subtotal:</div>
    <div class="val">${formatCurrency(data.subtotal)}</div>
  </div>
  ${data.discount > 0 ? `
  <div class="row">
    <div class="label">Discount:</div>
    <div class="val">-${formatCurrency(data.discount)}</div>
  </div>` : ''}
  
  <div class="row bold" style="font-size: 15px; margin-top: 4px;">
    <div class="label">Total Amount:</div>
    <div class="val">${formatCurrency(data.total)}</div>
  </div>

  <div class="divider"></div>
  <div class="text-center bold" style="margin-top: 15px;">Thank you for visiting!</div>
  <div class="text-center bold">See you soon</div>
</body>
</html>
  `;
};
