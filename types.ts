export interface User {
  id: number | string;
  authId?: string;
  adminId?: string; // Business Owner's ID
  name: string;
  email: string;
  role: 'admin' | 'stylist';
  imgUrl?: string;
}

export interface Attachment {
  title?: string;
  remarks: string;
  url: string;
  imgUrl?: string; // For backend compatibility
}

export interface Service {
  id: string | number; // Support both UUID and number IDs
  name: string;
  description?: string; // Optional description
  duration: number; // in minutes
  price: number;
  active: boolean;
  category: string;
  imgUrl?: string; // Standardized image field
  checklistTemplateId?: string; // Link to service checklist
}

export interface WorkingHour {
  active?: boolean;
  start?: string;
  end?: string;
  morning?: { start: string; end: string };
  afternoon?: { start: string; end: string };
}

export interface Category {
  id: string | number;
  name: string;
  type: string;
  description?: string;
  active: boolean;
  imgUrl?: string; // Standardized image field
}

export interface Stylist {
  id: number | string;
  name: string;
  gender?: 'male' | 'female' | 'other';
  email: string;
  phone: string;
  specialization?: string; // Comma-separated specializations or single value
  services: number[]; // Service IDs
  authId?: string;
  isAvailable?: boolean;
  permissions?: string[];
  imgUrl?: string;
  status: 'working' | 'off' | 'break';
  workingHours?: Record<string, WorkingHour>;
  dateSpecificHours?: Record<string, WorkingHour>;
  leaves?: string[]; // Array of dates 'YYYY-MM-DD' where stylist is on leave
}

export interface Customer {
  id: string | number;
  name: string;
  phone: string;
  email: string;
  totalAppointments: number;
  visitCount?: number;
  totalSpend: number;
  lastVisit: string;
  createdAt?: string;
  notes?: string;
  city?: string;
  role?: string;
  dateOfBirth?: string;
  ageGroup?: string;
  attachments?: Attachment[];
}

export interface Appointment {
  id: string | number;
  customerId: string | number;
  customerName: string; // Denormalized for UI
  serviceId: string | number;
  serviceName: string; // Denormalized
  stylistId: string | number;
  stylistName: string; // Denormalized
  date?: string;
  time?: string;
  startTime: string; // ISO DateTime string
  endTime: string; // ISO DateTime string
  status: 'CONFIRMED' | 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'confirmed' | 'pending' | 'completed' | 'cancelled';
  price: number;
  duration: number;
  depositAmount?: number;
  paidAmount?: number;
  totalAmount?: number;
  // Relations populated by backend
  customer?: Customer;
  service?: Service;
  services?: Service[]; // New field for multiple services under one appointment
  stylist?: Stylist;
  payments?: any[];

  // Optional fields
  userId?: string | number;
  notes?: string;
  paymentStatus?: string;
  attachments?: Attachment[];
}

export interface KPIData {
  label: string;
  value: string | number;
  icon: any; // Lucide icon component
  trend?: string; // e.g. "+12%"
  trendUp?: boolean;
  color?: string;
}

export interface Product {
  id: string | number;
  name: string;
  category: string;
  sku: string;
  price: number;
  stock: number;
  imgUrl?: string;
  isActive: boolean;
}

export interface InventoryMovement {
  id: string | number;
  date: string;
  timestamp?: string; // ISO timestamp for better date handling
  productId: string | number;
  productName: string;
  type: 'received' | 'adjustment_add' | 'adjustment_remove' | 'sold';
  quantity: number;
  balanceAfter: number;
  remarks?: string;
  performedBy: string;
}

export interface ComboItem {
  name: string;
  quantity: number;
  type: 'service' | 'product';
}

export interface ComboPackage {
  id: string | number;
  authId?: string;
  adminId?: string; // Business Owner's ID
  name: string;
  price: number;
  description: string;
  active: boolean;
  items: ComboItem[]; // List of included items with quantities
  validityDays: number; // 0 means no expiry
  imgUrl?: string; // Standardized image field
}

export interface Reconciliation {
  id: string | number;
  date: string;
  systemTotal: number;
  countedTotal: number;
  difference: number;
  status: 'balanced' | 'discrepancy';
  notes?: string;
  cashier: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  active: boolean;
  icon?: string;
}

export interface CartItem {
  id: string; // unique cart id
  itemId: string | number;
  name: string;
  price: number;
  type: 'service' | 'product' | 'combo' | 'voucher';
  quantity: number;
  redeemedFromPackageId?: string; // Package ID if redeemed
  redeemedItemId?: string; // Item ID in package
  redeemedQuantity?: number; // How many items are free from package
  specialistId?: number | string; // Assigned specialist
  specialistName?: string;
}

// Defines the Marketing Campaign / Rules
export interface Voucher {
  id: string;
  code: string;
  name?: string;
  description: string;
  value: number;
  sellingPrice: number;
  type: 'fixed' | 'percentage';
  status: 'active' | 'inactive' | 'expired' | boolean | number;
  expiryDate?: string;
  validityDays: number;
  createdAt: string;
}

// Defines a specific instance held by a customer
export interface VoucherClaim {
  id: string;
  voucherId: string;
  voucherCode: string;
  customerId: string | number;
  customerName: string;
  status: 'claimed' | 'partially_redeemed' | 'redeemed';
  balance: number;
  expiryDate?: string;
  usageHistory?: Array<{
    saleId: string;
    amount: number;
    date: string;
  }>;
  voucher?: Voucher;
  createdAt?: string;
}

export interface Payment {
  id: string;
  amount: number;
  paymentMethod: string;
  paymentStatus: string;
  paymentType: string;
  transactionId: string;
  createdAt: string;
  cashierName?: string;
  specialistName?: string;
  invoiceNumber?: string;
  saleId?: string;
  sale?: {
    id: string;
    saleNumber: string;
    items: any[];
    paidAmount?: number;
    subtotal?: number;
    discount?: number;
    paymentStatus?: string;
    saleStatus?: string;
    attachments?: any[];
    specialist?: {
      id: string;
      name: string;
    };
    customer?: {
      id: string;
      name: string;
      mobile: string;
    };
    invoiceNumber?: string;
    payments?: Payment[];
  };
  appointmentId?: string;
  appointment?: {
    id?: string;
    status?: string;
    startTime?: string;
    customer: {
      id: string;
      name: string;
      mobile: string;
    };
    service: {
      name: string;
    };
    stylist?: {
      id: string;
      name: string;
    };
  };
  notes?: string;
  isPendingSale?: boolean;
}