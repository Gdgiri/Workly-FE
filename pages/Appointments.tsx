import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../redux/store';
import { fetchAppointments, createAppointment, updateAppointment, cancelAppointment, updateAppointmentStatus } from '../redux/slices/appointmentSlice';
import { Plus, Filter, Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, Printer, MessageSquare, CreditCard, Paperclip, Image as ImageIcon, RefreshCw, FileText, AlertCircle, ChevronDown, Search, CheckCircle, X } from 'lucide-react';
import { Table, Button, Modal, Input, Select } from '../components/UI';
import { Appointment } from '../types';
import { useToast } from '../components/ToastContext';
import { useCurrency } from '../components/CurrencyContext';
import { useAuth } from '../hooks/useAuth';
import { AttachmentsInput, Attachment } from '../components/AttachmentsInput';
import { LoadingSpinner } from '../components/LoadingSpinner';
import ChecklistForm from '../components/ChecklistForm';
import api from '../utils/api';


interface AppointmentsProps {
  fraudProtection?: boolean;
}

// Global fade-in animation for dropdowns
const dropdownStyles = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;



/* 
  API NOTES:
  GET /appointments?date=YYYY-MM-DD
  POST /appointments (body: { customer, serviceId, stylistId, date, time })
  PUT /appointments/:id (edit)
  DELETE /appointments/:id (cancel)
*/


const Appointments: React.FC<AppointmentsProps> = ({ fraudProtection = false }) => {
  const navigate = useNavigate();
  const { appId, businessName } = useParams();
  const { showToast } = useToast();

  const { symbol, formatPrice } = useCurrency();
  const { user, isStaff, isAdmin, isManager } = useAuth();

  const maskPhone = (phone: string | undefined) => {
    if (!phone) return 'N/A';
    if (phone.length <= 4) return phone;
    return phone.slice(0, phone.length - 4) + '****';
  };
  const canAdd = isAdmin || isManager || (isStaff && user?.permissions?.includes('appointments.add'));
  const canEdit = isAdmin || isManager || (isStaff && user?.permissions?.includes('appointments.edit'));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState('today');

  const dispatch = useDispatch<AppDispatch>();
  const { appointments, loading: appointmentsLoading, error: appointmentsError } = useSelector((state: RootState) => state.appointments);

  const [services, setServices] = useState<any[]>([]);
  const [specialists, setSpecialists] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [localLoading, setLocalLoading] = useState(false); // For non-appointment fetches
  const loading = localLoading || appointmentsLoading;
  // const [appointments, setAppointments] = useState<Appointment[]>([]); // Removed in favor of Redux
  // const [loading, setLoading] = useState(false); // Replaced by composite loading
  const [initialLoading, setInitialLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit State
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Cancel Reason State
  const [cancelReason, setCancelReason] = useState('');
  const [cancelingAppointmentId, setCancelingAppointmentId] = useState<string | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  // View Modal State
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewAppointment, setViewAppointment] = useState<Appointment | null>(null);
  const [viewAttachments, setViewAttachments] = useState<Attachment[]>([]);
  const [savingAttachments, setSavingAttachments] = useState(false);

  // Checklist State
  const [isChecklistModalOpen, setIsChecklistModalOpen] = useState(false);
  const [activeChecklistId, setActiveChecklistId] = useState<string | null>(null);
  const [showChecklistInline, setShowChecklistInline] = useState(false);
  const [isChecklistFilled, setIsChecklistFilled] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    customerId: '',
    serviceId: '',
    serviceIds: [] as string[], // NEW: For multiple services
    stylistId: '',
    date: '',
    time: '',
    notes: '',
    status: 'pending' as any,
    depositAmount: 0, // Default to 0 for Admin Panel bookings
    requiresDeposit: false,
    attachments: [] as Attachment[]
  });

  // Customer Search State
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerOptions, setShowCustomerOptions] = useState(false);
  const [serviceSearch, setServiceSearch] = useState(''); // Added for Service Dropdown
  const [showServiceOptions, setShowServiceOptions] = useState(false);
  const [specialistSearch, setSpecialistSearch] = useState(''); // Added for Specialist Dropdown
  const [showSpecialistOptions, setShowSpecialistOptions] = useState(false);

  // New Checklist Toggle States
  const [showChecklistToggle, setShowChecklistToggle] = useState(false);
  const [checklistResponses, setChecklistResponses] = useState<Record<string, { responses: any, remarks: any }>>({});
  const [showChecklistInCreate, setShowChecklistInCreate] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Date Filter State
  const [dateFilter, setDateFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Active Tab for Time Selection
  const [activeTab, setActiveTab] = useState<'morning' | 'afternoon' | 'evening'>('morning');

  // Original Specialist ID (for showing in disabled "Current Specialist" field)
  const [originalSpecialistId, setOriginalSpecialistId] = useState('');

  // Booking Configuration State
  const [openingTime, setOpeningTime] = useState('09:00');
  const [closingTime, setClosingTime] = useState('20:00');

  const handleChecklistDataChange = React.useCallback((serviceId: string, responses: any, remarks: any) => {
    setChecklistResponses(prev => {
      const current = prev[serviceId];
      // Prevent infinite loops by checking for equality
      if (current &&
        JSON.stringify(current.responses) === JSON.stringify(responses) &&
        JSON.stringify(current.remarks) === JSON.stringify(remarks)) {
        return prev;
      }
      return {
        ...prev,
        [serviceId]: { responses, remarks }
      };
    });
  }, []);

  const fetchServices = async () => {
    try {
      const response = await api.get('/services');
      const data = response.data;
      // Handle both array response and object with services property
      const servicesData = Array.isArray(data) ? data : (data?.services || []);

      if (!Array.isArray(servicesData)) {
        console.error('Services API returned non-array data:', data);
        setServices([]);
        return;
      }
      // Ensure data consistency with Management.tsx
      const processedServices = servicesData.map((s: any) => ({
        ...s,
        active: s.isActive !== undefined ? s.isActive : (s.active !== undefined ? s.active : true)
      }));
      // Only show active services in dropdown
      setServices(processedServices.filter((s: any) => s.active));
    } catch (err) {
      console.error('Failed to fetch services', err);
      setServices([]);
    }
  };

  const fetchSpecialists = async () => {
    try {
      const response = await api.get('/stylists');
      const data = response.data;
      // Validate that data is an array
      if (!Array.isArray(data)) {
        console.error('Specialists API returned non-array data:', data);
        setSpecialists([]);
        return;
      }
      // Parse leaves if it's a JSON string
      const parsedData = data.map((s: any) => ({
        ...s,
        leaves: Array.isArray(s.leaves) ? s.leaves : (s.leaves ? JSON.parse(s.leaves) : []),
        workingHours: typeof s.workingHours === 'string' ? JSON.parse(s.workingHours) : (s.workingHours || {}),
        dateSpecificHours: typeof s.dateSpecificHours === 'string' ? JSON.parse(s.dateSpecificHours) : (s.dateSpecificHours || {})
      }));
      setSpecialists(parsedData);
    } catch (err) {
      console.error('❌ Failed to fetch specialists', err);
      setSpecialists([]);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await api.get('/customers');
      const data = response.data;
      // Handle both array response and object with customers property
      const customersData = Array.isArray(data) ? data : (data?.customers || []);

      if (!Array.isArray(customersData)) {
        console.error('Customers API returned non-array data:', data);
        setCustomers([]);
        return;
      }
      setCustomers(customersData);
    } catch (err) {
      console.error('Failed to fetch customers', err);
      setCustomers([]);
    }
  };

  // Fetch appointments (Optional for now, but good practice)
  // fetchAppointments is now handled by Redux dispatch

  const fetchSettings = async () => {
    try {
      const response = await api.get('/settings');
      const data = response.data;
      if (data.openingTime) setOpeningTime(data.openingTime);
      if (data.closingTime) setClosingTime(data.closingTime);
    } catch (err) {
      console.error('Failed to fetch settings', err);
    }
  };

  const handleRefresh = async () => {
    setLocalLoading(true);
    try {
      // Dispatch appointments fetch (handled by Redux)
      dispatch(fetchAppointments());

      await Promise.all([
        fetchServices(),
        fetchSpecialists(),
        fetchCustomers(),
        fetchSettings()
      ]);
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setLocalLoading(false);
    }
  };

  React.useEffect(() => {
    const fetchInitialData = async () => {
      setLocalLoading(true);
      try {
        // Build array of promises
        const promises = [
          fetchServices(),
          fetchSpecialists(),
          // fetchCustomers(), // DEFERRED: Fetch only when opening modal
          fetchSettings()
        ];

        // Only fetch appointments if empty (initially) or explicitly refreshed by user later
        // But for "stale-while-revalidate", we should fetch always, but NOT block UI if data exists
        // Since we are in useEffect [] (mount), we fetch.
        // If data exists in Redux, it shows immediately.
        // We dispatch background fetch.
        dispatch(fetchAppointments());

        await Promise.all(promises);
      } catch (error) {
        console.error('Error fetching initial data:', error);
      } finally {
        setLocalLoading(false);
        setInitialLoading(false);
      }
    };

    fetchInitialData();
  }, [dispatch]);

  // Reset pagination when filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, appointments, dateFilter]);

  // Unavailable slots state
  const [unavailableSlots, setUnavailableSlots] = useState<{ startTime: string, endTime: string }[]>([]);

  // Fetch availability when date or stylist changes
  React.useEffect(() => {
    const fetchAvailability = async () => {
      if (formData.stylistId && formData.date) {
        try {
          // Use standardized api instance
          const response = await api.get(`/appointments/availability?stylistId=${formData.stylistId}&date=${formData.date}`);
          setUnavailableSlots(response.data);
        } catch (err) {
          console.error('Failed to fetch availability', err);
        }
      } else {
        setUnavailableSlots([]);
      }
    };

    const timer = setTimeout(() => {
      fetchAvailability();
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [formData.stylistId, formData.date]);

  const handleCreateOpen = () => {
    setFormData({
      customerId: '',
      serviceId: '',
      serviceIds: [], // Reset multi-service list
      stylistId: '',
      date: '',
      time: '',
      notes: '',
      status: 'pending' as any,
      depositAmount: 0,
      requiresDeposit: false,
      attachments: []
    });
    setCustomerSearch('');
    setServiceSearch('');
    setSpecialistSearch('');
    setEditingAppointment(null);
    setChecklistResponses({});
    setShowChecklistInCreate(false);
    setIsModalOpen(true);

    // Fetch customers only when needed
    fetchCustomers();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCancel = (id: string | number) => {
    setCancelingAppointmentId(id.toString());
    setIsCancelModalOpen(true);
  };

  const confirmCancel = async () => {
    if (!cancelingAppointmentId) return;

    try {
      const result = await dispatch(cancelAppointment({ id: cancelingAppointmentId, reason: cancelReason })).unwrap();

      // result might be the specific appointment or success message
      showToast('Appointment cancelled successfully', 'success');

      // fetchAppointments(); // Handled by Redux
      setIsCancelModalOpen(false);
      setCancelingAppointmentId(null);
      setCancelReason('');
    } catch (err) {
      console.error('Error canceling appointment:', err);
      showToast('Error canceling appointment', 'error');
    }
  };

  const handleEdit = (appointment: Appointment) => {
    setEditingAppointment(appointment);

    // Set customer search with customer name
    const customer = customers.find(c => c.id === appointment.userId);
    if (customer) {
      setCustomerSearch(customer.name);
    }

    // Initialize Service Search
    const service = services.find(s => s.id?.toString() === appointment.serviceId?.toString());
    if (service) {
      setServiceSearch(service.name);
    } else {
      setServiceSearch(appointment.serviceName || appointment.service?.name || '');
    }

    // Initialize Specialist Search
    const specialist = specialists.find(s => s.id?.toString() === appointment.stylistId?.toString());
    if (specialist) {
      setSpecialistSearch(specialist.name);
    } else if (!appointment.stylistId) {
      setSpecialistSearch('Any specialist');
    } else {
      setSpecialistSearch(appointment.stylistName || appointment.stylist?.name || '');
    }

    // Parse startTime into date and time
    let dateValue = '';
    let timeValue = '';
    if (appointment.startTime) {
      const startDate = new Date(appointment.startTime);
      // Format date as YYYY-MM-DD
      dateValue = startDate.toISOString().split('T')[0];
      // Format time as HH:MM
      timeValue = startDate.toTimeString().slice(0, 5);
    }

    // Store the original specialist ID
    const originalSpecialist = appointment.stylistId?.toString() || '';
    setOriginalSpecialistId(originalSpecialist);

    setFormData({
      customerId: appointment.customerId?.toString() || appointment.userId || '',
      serviceId: appointment.serviceId?.toString() || '',
      serviceIds: appointment.services && appointment.services.length > 0
        ? appointment.services.map(s => s.id.toString())
        : [appointment.serviceId?.toString()].filter(Boolean) as string[],
      stylistId: originalSpecialist,
      date: dateValue,
      time: timeValue,
      notes: appointment.notes || '',
      status: (appointment.status?.toLowerCase() || 'pending') as any,
      attachments: (appointment.attachments || []).map(a => ({ ...a, url: a.imgUrl || a.url || '' })) as Attachment[]
    });
    setIsEditModalOpen(true);

    // Fetch customers if not already loaded or stale
    if (customers.length === 0) {
      fetchCustomers();
    }
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalLoading(true);
    setError(null);

    // VALIDATION: Check if specialist is on leave for the selected date
    const selectedSpecialist = specialists.find(s => s.id.toString() === formData.stylistId);

    if (selectedSpecialist && selectedSpecialist.leaves && selectedSpecialist.leaves.includes(formData.date)) {
      const errorMsg = `${selectedSpecialist.name} is on leave on ${formData.date}. Please select a different specialist or date.`;
      console.error('❌ Validation failed:', errorMsg);
      setError(errorMsg);
      showToast(errorMsg, 'error');
      setLocalLoading(false);
      return;
    }

    try {
      // Check if status is being changed to COMPLETED
      const isCompletingAppointment = editingAppointment &&
        formData.status === 'COMPLETED' &&
        editingAppointment.status !== 'COMPLETED';

      const appointmentData = {
        ...formData,
        // Send both serviceId (first) for compatibility and serviceIds (full list)
        serviceId: formData.serviceIds[0] || formData.serviceId,
        serviceIds: formData.serviceIds,
        // Convert empty stylistId to null for backend validation
        stylistId: formData.stylistId || null,
        attachments: formData.attachments.map(a => ({
          title: a.title,
          remarks: a.remarks,
          imgUrl: a.url,
          url: a.url
        }))
      };

      if (editingAppointment) {
        await dispatch(updateAppointment({ id: editingAppointment.id, data: appointmentData })).unwrap();
      } else {
        const result = await dispatch(createAppointment(appointmentData)).unwrap();
        // Handle the single appointment returned by the backend
        const createdAppointment = Array.isArray(result) ? result[0] : result;

        console.log(`✅ Appointment created. Submitting checklists for ${formData.serviceIds.length} services...`);

        // Submit checklists for each selected service linked to this SINGLE appointment
        await Promise.all(formData.serviceIds.map(async (serviceId) => {
          const selectedService = services.find(s => s.id?.toString() === serviceId?.toString());
          const responses = checklistResponses[serviceId];

          if (responses && createdAppointment?.id && selectedService?.checklistTemplateId) {
            try {
              await api.post(`/checklists/submit`, {
                appointmentId: createdAppointment.id,
                templateId: selectedService.checklistTemplateId,
                data: responses.responses,
                remarks: responses.remarks,
                severityScore: 0
              });
            } catch (checklistErr) {
              console.error(`Failed to submit checklist for service ${serviceId}:`, checklistErr);
              showToast(`Appointment created but checklist for ${selectedService?.name} failed to save`, 'warning');
            }
          }
        }));
      }

      // Show appropriate success message
      let successMessage = editingAppointment
        ? 'Appointment updated successfully!'
        : 'Booking confirmed successfully!';

      // Special message for completed appointments
      if (isCompletingAppointment) {
        const customerName = customers.find(c => c.id === formData.customerId)?.name || 'Customer';
        const serviceName = services.find(s => s.id === formData.serviceId)?.name || 'Service';
        successMessage = `✅ Appointment completed! ${customerName} - ${serviceName}`;
      }

      showToast(successMessage, 'success');
      setIsModalOpen(false);
      setIsEditModalOpen(false);
      setEditingAppointment(null);
      setShowChecklistInCreate(false);
      setChecklistResponses({});
      // fetchAppointments(); // Handled by Redux update
      setFormData({
        customerId: '',
        serviceId: '',
        serviceIds: [],
        stylistId: '',
        date: '',
        time: '',
        notes: '',
        status: 'PENDING',
        depositAmount: 0,
        requiresDeposit: false,
        attachments: []
      });

    } catch (err: any) {
      setError(err.message);
      showToast(err.message || 'Failed to save appointment', 'error');
    } finally {
      setLocalLoading(false);
    }
  };

  const handleWhatsApp = async (appointment: Appointment) => {
    if (isStaff && fraudProtection) {
      showToast('WhatsApp contact is disabled due to Fraud Protection settings.', 'info');
      return;
    }
    const customerName = appointment.customer?.name || 'Customer';
    const mobile = appointment.customer?.phone || (appointment.customer as any)?.mobile;

    if (!mobile) {
      showToast('No mobile number found for this customer', 'error');
      return;
    }

    // 1. Construct Message
    const startTime = appointment.startTime ? new Date(appointment.startTime) : null;
    const dateStr = startTime ? startTime.toLocaleDateString() : (appointment.date || '');
    const timeStr = startTime ? startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (appointment.time || '');

    const message = `Hi ${customerName}, this is a confirmation for your appointment on ${dateStr} at ${timeStr}. We look forward to seeing you!`;
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://web.whatsapp.com/send?phone=${mobile}&text=${encodedMessage}`;

    // 2. Open WhatsApp
    window.open(whatsappUrl, '_blank');

    // 3. Update Status to CONFIRMED if it's currently PENDING
    if (appointment.status?.toUpperCase() === 'PENDING') {
      try {
        await dispatch(updateAppointmentStatus({ id: appointment.id, status: 'CONFIRMED' })).unwrap();
        showToast('Appointment confirmed and WhatsApp opened!', 'success');
        // fetchAppointments(); // Handled by Redux
      } catch (error) {
        console.error('Failed to update status:', error);
      }
    }
  };

  const handleSaveAttachments = async () => {
    if (!viewAppointment) return;

    setSavingAttachments(true);
    try {
      const attachmentsData = viewAttachments.map(a => ({
        title: a.title,
        remarks: a.remarks,
        imgUrl: a.url,
        url: a.url
      }));

      await dispatch(updateAppointment({ id: viewAppointment.id, data: { attachments: attachmentsData } })).unwrap();

      showToast('Attachments updated successfully!', 'success');
      // fetchAppointments(); // Refresh the list - Handled by Redux

      // Update local viewAppointment state to reflect changes
      // We can also re-fetch the specific appointment from Redux if needed, but local update is fine for modal
      const updatedAppt = {
        ...viewAppointment,
        attachments: viewAttachments.map(a => ({
          ...a,
          imgUrl: a.url
        }))
      };
      setViewAppointment(updatedAppt as any);

    } catch (err: any) {
      showToast(err.message || 'Failed to update attachments', 'error');
    } finally {
      setSavingAttachments(false);
    }
  };

  const handleView = async (row: Appointment) => {
    setViewAppointment(row);
    setViewAttachments(row.attachments || []);
    setIsViewModalOpen(true);
    setShowChecklistInline(false); // Reset while checking
    setIsChecklistFilled(false);

    // Check for existing checklist submission
    try {
      const linkedService = services.find(s => s.id?.toString() === row.serviceId?.toString());
      const templateId = row.service?.checklistTemplateId || linkedService?.checklistTemplateId;

      if (templateId) {
        const submissionRes = await api.get(`/checklists/submission/appointment/${row.id}`);
        if (submissionRes.data && submissionRes.data.data) {
          setIsChecklistFilled(true);
          setShowChecklistInline(true);
          setActiveChecklistId(templateId);
        }
      }
    } catch (error) {
      console.log('No checklist submission found or error fetching:', error);
    }
  };

  const handleStartAppointment = async (row: Appointment) => {
    // Immediate feedback: Open the modal so they can see/fill the checklist
    // We pass the expected next status (CONFIRMED) to the view
    handleView({ ...row, status: 'CONFIRMED' });

    // 1. Update status to CONFIRMED if PENDING
    if (row.status?.toUpperCase() === 'PENDING') {
      try {
        console.log('🚀 Starting appointment:', row.id);
        await dispatch(updateAppointmentStatus({ id: row.id, status: 'CONFIRMED' })).unwrap();
        showToast('Appointment confirmed!', 'success');
      } catch (error) {
        console.error('Failed to update status:', error);
        showToast('Failed to sync status to server, but you can still view details', 'error');
      }
    }
  };

  const handleContinue = (row: Appointment) => {
    const depPay = row.payments?.find((p: any) => p.paymentStatus === 'COMPLETED');
    const depMeth = depPay ? depPay.paymentMethod : 'CASH';

    navigate(`/${appId}/${businessName}/sales`, {
      state: {
        appointmentData: {
          appointmentId: row.id,
          customerId: (row.userId || row.customerId || row.customer?.id),
          customerName: row.customerName || row.customer?.name,
          serviceId: row.serviceId,
          items: row.services && row.services.length > 0
            ? row.services.map(s => ({ ...s, quantity: 1, type: 'service' }))
            : row.service
              ? [{ ...row.service, quantity: 1, type: 'service' }]
              : [],
          depositAmount: row.paidAmount || row.depositAmount,
          depositPaymentMethod: depMeth,
          stylistId: row.stylistId,
          stylistName: row.stylist?.name || row.stylistName,
          totalAmount: row.totalAmount
        }
      }
    });
  };

  const columns = [
    // ID column removed for cleaner UI
    // Simplified columns for brevity, keeping existing structure mostly
    {
      header: 'Customer',
      accessor: (row: Appointment) => {
        // Fallback to searching in local customers array if relation is missing
        const customer = customers.find(c => c.id?.toString() === (row.userId || row.customerId)?.toString());
        return (
          <div style={{ fontWeight: 500, color: 'var(--text-dark)' }}>
            {row.customer?.name || row.customerName || customer?.name || 'N/A'}
          </div>
        );
      }
    },
    {
      header: 'Service',
      accessor: (row: Appointment) => {
        if (row.services && row.services.length > 0) {
          return row.services.map(s => s.name).join(', ');
        }
        return row.service?.name || row.serviceName || 'N/A';
      }
    },
    {
      header: 'Specialist',
      accessor: (row: Appointment) => row.stylist?.name || row.stylistName || 'N/A'
    },
    {
      header: 'Date & Time',
      accessor: (row: Appointment) => {
        const startTime = row.startTime ? new Date(row.startTime) : null;
        const date = startTime ? startTime.toLocaleDateString() : (row.date || 'N/A');
        const time = startTime ? startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (row.time || 'N/A');

        return (
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.75rem' }}>
            <span style={{ fontWeight: 500 }}>{date}</span>
            <span style={{ color: 'var(--text-gray)' }}>{time}</span>
          </div>
        );
      }
    },
    {
      header: 'Status',
      accessor: (row: Appointment) => {
        const status = row.status?.toUpperCase() || 'PENDING';

        // Color mapping
        let backgroundColor = '#fef3c7'; // Yellow for pending
        let textColor = '#92400e';

        if (status === 'COMPLETED') {
          backgroundColor = '#d1fae5'; // Green
          textColor = '#065f46';
        } else if (status === 'CANCELLED') {
          backgroundColor = '#fee2e2'; // Red
          textColor = '#991b1b';
        } else if (status === 'CONFIRMED') {
          backgroundColor = '#dbeafe'; // Blue
          textColor = '#1e40af';
        }

        return (
          <span style={{
            padding: '0.25rem 0.75rem',
            borderRadius: '12px',
            fontSize: '0.75rem',
            fontWeight: 500,
            backgroundColor,
            color: textColor
          }}>
            {status}
          </span>
        );
      }
    },
    {
      header: 'Payment Status',
      accessor: (row: Appointment) => {
        let paymentStatus = row.paymentStatus?.toUpperCase() || 'PENDING';

        // Ensure confirmed appointments that aren't paid show PENDING
        if (row.status?.toUpperCase() === 'CONFIRMED' && paymentStatus !== 'COMPLETED' && paymentStatus !== 'PAID' && paymentStatus !== 'PARTIAL') {
          paymentStatus = 'PENDING';
        }

        let backgroundColor = '#f3f4f6'; // Gray
        let textColor = '#374151';

        if (paymentStatus === 'COMPLETED' || paymentStatus === 'PAID') {
          backgroundColor = '#d1fae5'; // Green
          textColor = '#065f46';
        } else if (paymentStatus === 'PARTIAL') {
          backgroundColor = '#ffedd5'; // Orange
          textColor = '#9a3412';
        } else if (paymentStatus === 'PENDING') {
          backgroundColor = '#fee2e2'; // Reddish/Pink for unpaid
          textColor = '#991b1b';
        }

        return (
          <span style={{
            padding: '0.25rem 0.75rem',
            borderRadius: '12px',
            fontSize: '0.75rem',
            fontWeight: 500,
            backgroundColor,
            color: textColor
          }}>
            {paymentStatus}
          </span>
        );
      }
    },
    // {
    //   header: 'Attachments',
    //   accessor: (row: Appointment) => {
    //     const hasAttachments = row.attachments && row.attachments.length > 0;
    //     if (!hasAttachments) return <span style={{ color: '#cbd5e1' }}>—</span>;

    //     const firstImage = row.attachments?.find((a: any) => a.imgUrl || a.url);

    //     return (
    //       <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
    //         {firstImage ? (
    //           <div style={{ width: '24px', height: '24px', borderRadius: '4px', overflow: 'hidden', border: '1px solid #e2e8f0', flexShrink: 0 }}>
    //             <img
    //               src={firstImage.imgUrl || firstImage.url}
    //               alt="Attachment"
    //               style={{ width: '100%', height: '100%', objectFit: 'cover' }}
    //               onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/24x24?text=F'; }}
    //             />
    //           </div>
    //         ) : (
    //           <Paperclip size={14} style={{ color: 'var(--primary)' }} />
    //         )}
    //         <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-gray)' }}>
    //           {row.attachments?.length}
    //         </span>
    //       </div>
    //     );
    //   }
    // },
    {
      header: 'Actions',
      accessor: (row: Appointment) => {
        const status = row.status?.toUpperCase();
        const paymentStatus = row.paymentStatus?.toUpperCase();

        // Show "Read-Only" View mode ONLY if:
        // 1. Cancelled
        // 2. Completed AND Fully Paid
        const isReadOnly = status === 'CANCELLED' || (status === 'COMPLETED' && (paymentStatus === 'COMPLETED' || paymentStatus === 'PAID'));

        return (
          <div className="flex gap-2">
            {/* View Details - Always shown */}
            <button
              onClick={() => handleView(row)}
              style={{
                color: 'white',
                background: 'var(--primary)',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.875rem',
                padding: '0.375rem 0.75rem',
                borderRadius: '0.375rem',
                fontWeight: 500,
                marginRight: '0.5rem',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              <FileText size={14} />
              View
            </button>

            {/* Start - Only for Pending */}
            {(status === 'PENDING') && (
              <button
                onClick={() => handleStartAppointment(row)}
                style={{
                  color: 'white',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  padding: '0.375rem 0.75rem',
                  borderRadius: '0.375rem',
                  fontWeight: 500,
                  marginRight: '0.5rem',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                Start
              </button>
            )}

            {/* Continue/Checkout - For Confirmed or Unpaid Completed */}
            {(status === 'CONFIRMED' || (status === 'COMPLETED' && (paymentStatus === 'PARTIAL' || paymentStatus === 'PENDING'))) && (
              <button
                onClick={() => handleContinue(row)}
                style={{
                  color: 'white',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  padding: '0.375rem 0.75rem',
                  borderRadius: '0.375rem',
                  fontWeight: 500,
                  marginRight: '0.5rem',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                <CreditCard size={14} />
                Continue
              </button>
            )}

            {/* Edit/Cancel - For active appointments */}
            {(status !== 'COMPLETED' && status !== 'CANCELLED') && (
              <>
                <button
                  onClick={() => handleEdit(row)}
                  style={{
                    color: '#475569',
                    background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    padding: '0.375rem 0.75rem',
                    borderRadius: '0.375rem',
                    fontWeight: 500,
                    marginRight: '0.5rem',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#e2e8f0'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#f1f5f9'}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleCancel(row.id)}
                  style={{
                    color: 'white',
                    background: 'var(--danger)',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    padding: '0.375rem 0.75rem',
                    borderRadius: '0.375rem',
                    fontWeight: 500,
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        );
      }
    }
  ];



  return (
    <div className="space-y-6" style={{ position: 'relative' }}>
      <style>{dropdownStyles}</style>
      <div className="flex flex-col md:flex-row justify-between items-center" style={{ gap: '1rem' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-card)', padding: '0.25rem', borderRadius: '0.75rem', border: '1px solid var(--border)' }}>
          {['all', 'today', 'upcoming', 'confirmed', 'pending', 'completed', 'cancelled'].map(filter => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                borderRadius: '0.5rem',
                border: 'none',
                background: activeFilter === filter ? 'var(--primary)' : 'transparent',
                color: activeFilter === filter ? 'white' : 'var(--text-gray)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex space-x-2 items-center" style={{ flex: 1 }}>
          {/* Search Input */}
          <div className="relative" style={{ height: '44px' }}>
            <input
              type="text"
              placeholder="Search Schedule..."
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
            <div style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-gray)', display: 'flex' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </div>
          </div>

          <div style={{ height: '44px' }}>
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              style={{ width: 'auto', height: '100%' }}
            />
          </div>

          <div style={{ flex: 1 }} />

          <div className="flex items-center" style={{ gap: '1.5rem' }}>
            {canAdd && (
              <Button
                onClick={handleCreateOpen}
                // icon={<Plus size={18} />}
                style={{ minWidth: '180px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                New Schedule
              </Button>
            )}

            <Button
              onClick={handleRefresh}
              disabled={loading}
              style={{
                height: '44px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'var(--primary)',
                color: 'white',
                padding: '0 1rem',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                border: 'none',
                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
              }}
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              Refresh
            </Button>
          </div>
        </div>
      </div>


      {/* Pagination Logic */}
      {
        (() => {
          const filteredAppointments = Array.isArray(appointments) ? appointments.filter(d => {
            let appointmentDateStr = d.date || '';
            if (d.startTime) {
              const dt = new Date(d.startTime);
              appointmentDateStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
            }

            const today = new Date();
            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

            let statusMatch = false;
            if (activeFilter === 'all') {
              statusMatch = true;
            } else if (activeFilter === 'today') {
              statusMatch = appointmentDateStr === todayStr;
            } else if (activeFilter === 'upcoming') {
              statusMatch = appointmentDateStr > todayStr;
            } else {
              statusMatch = (d.status || '').toLowerCase() === activeFilter;
            }

            const dateMatch = !dateFilter || appointmentDateStr === dateFilter;

            const searchLower = searchTerm.toLowerCase();
            const fallbackCustomer = customers.find(c => c.id?.toString() === (d.userId || d.customerId)?.toString());

            const customerName = d.customerName || d.customer?.name || fallbackCustomer?.name || '';
            const serviceName = d.serviceName || d.service?.name || '';
            const stylistName = d.stylistName || d.stylist?.name || '';

            const searchMatch = !searchTerm ||
              (customerName || '').toLowerCase().includes(searchLower) ||
              (serviceName || '').toLowerCase().includes(searchLower) ||
              (stylistName || '').toLowerCase().includes(searchLower);

            return statusMatch && dateMatch && searchMatch;
          }) : [];
          const totalPages = Math.ceil(filteredAppointments.length / itemsPerPage);
          const paginatedAppointments = filteredAppointments.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

          return (
            <>
              <div style={{ background: 'var(--bg-card)', borderRadius: '1rem', border: '1px solid var(--border)', overflow: 'hidden' }}>
                <Table
                  columns={columns}
                  data={paginatedAppointments}
                  isLoading={appointmentsLoading}
                  skeletonCount={10}
                />
              </div>

              {/* Pagination Controls */}
              {filteredAppointments.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', padding: '0.5rem 0' }}>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-gray)' }}>
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredAppointments.length)} of {filteredAppointments.length} results
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: '2rem', height: '2rem',
                        borderRadius: '0.5rem',
                        border: '1px solid var(--border)',
                        background: currentPage === 1 ? 'var(--bg-hover)' : 'var(--bg-card)',
                        color: currentPage === 1 ? '#9ca3af' : 'var(--text-dark)',
                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <ChevronLeft size={16} />
                    </button>

                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        // Logic to show generic window of pages usually, but keeping simple for now
                        // Let's show current page centered if possible, logic can contain 1, ... , last
                        // For simple implementation: Just show current page
                        let pageNum = i + 1;
                        if (totalPages > 5) {
                          // Simple window logic: always show start if current is small
                          if (currentPage > 3) pageNum = currentPage - 2 + i;
                          if (pageNum > totalPages) pageNum = i + (totalPages - 4); // Clamp to end
                        }

                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            style={{
                              width: '2rem', height: '2rem',
                              borderRadius: '0.5rem',
                              border: currentPage === pageNum ? 'none' : '1px solid var(--border)',
                              background: currentPage === pageNum ? 'var(--primary)' : 'var(--bg-card)',
                              color: currentPage === pageNum ? 'white' : 'var(--text-dark)',
                              cursor: 'pointer',
                              fontWeight: 500,
                              fontSize: '0.875rem'
                            }}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: '2rem', height: '2rem',
                        borderRadius: '0.5rem',
                        border: '1px solid var(--border)',
                        background: currentPage === totalPages ? 'var(--bg-hover)' : 'var(--bg-card)',
                        color: currentPage === totalPages ? '#9ca3af' : 'var(--text-dark)',
                        cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          );
        })()
      }


      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create New Schedule"
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {error && <div style={{ color: 'red', fontSize: '0.875rem' }}>{error}</div>}
          <div className="grid grid-cols-2 gap-x-6" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: '1.5rem', rowGap: '0.75rem' }}>
            <div className="input-group" style={{ position: 'relative', marginBottom: '0.75rem' }}>
              <label className="input-label">Customer</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Type customer name..."
                  value={customerSearch}
                  readOnly // Make this read-only to force using the dropdown/internal search for better UX
                  onClick={() => setShowCustomerOptions(!showCustomerOptions)}
                  onFocus={() => setShowCustomerOptions(true)}
                  style={{
                    paddingRight: '2.5rem',
                    cursor: 'pointer',
                    backgroundColor: 'white'
                  }}
                  required
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCustomerOptions(!showCustomerOptions);
                  }}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-light)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px'
                  }}
                >
                  <ChevronDown size={18} style={{ transform: showCustomerOptions ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>
              </div>

              {/* Custom Dropdown */}
              {showCustomerOptions && (
                <div
                  className="animate-in fade-in zoom-in duration-200"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'white',
                    borderRadius: '0.75rem',
                    boxShadow: '0 20px 40px -10px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
                    zIndex: 100,
                    maxHeight: '350px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    border: '1px solid var(--border)',
                    marginTop: '0.5rem'
                  }}
                  onMouseDown={(e) => e.stopPropagation()} // Prevent close on internal clicks
                >
                  {/* Internal Search Bar */}
                  <div style={{
                    padding: '0.75rem',
                    borderBottom: '1px solid #f1f5f9',
                    background: '#f8fafc',
                    position: 'sticky',
                    top: 0,
                    zIndex: 1
                  }}>
                    <div style={{ position: 'relative' }}>
                      <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                      <input
                        type="text"
                        autoFocus
                        placeholder="Search customers..."
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.5rem 0.75rem 0.5rem 2.25rem',
                          fontSize: '0.85rem',
                          border: '1px solid #e2e8f0',
                          borderRadius: '0.5rem',
                          outline: 'none',
                          background: 'white'
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ overflowY: 'auto' }}>
                    {customers
                      .filter(c =>
                        (c.name || '').toLowerCase().includes((customerSearch || '').toLowerCase()) ||
                        (c.email || '').toLowerCase().includes((customerSearch || '').toLowerCase()) ||
                        (c.mobile || '').includes(customerSearch)
                      )
                      .map(c => (
                        <div
                          key={c.id}
                          onClick={() => {
                            setCustomerSearch(c.name);
                            setFormData(prev => ({ ...prev, customerId: c.id }));
                            setShowCustomerOptions(false);
                          }}
                          style={{
                            padding: '0.75rem 1rem',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            color: 'var(--text-dark)',
                            borderBottom: '1px solid #f1f5f9',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                            transition: 'background 0.2s'
                          }}
                          className="hover:bg-blue-50"
                        >
                          <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>{c.name}</span>
                            {formData.customerId === c.id && <span style={{ color: 'var(--primary)', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }}>Selected</span>}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-gray)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <span>{c.mobile || 'No mobile'}</span>
                            {c.email && <span style={{ opacity: 0.5 }}>•</span>}
                            <span>{c.email}</span>
                          </div>
                        </div>
                      ))
                    }
                    {customers.filter(c => (c.name || '').toLowerCase().includes((customerSearch || '').toLowerCase())).length === 0 && (
                      <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#94a3b8' }}>
                        <div style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>🔍</div>
                        <div style={{ fontSize: '0.85rem' }}>No customers match your search</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>


            {/* 1. Multi-Select Service Dropdown */}
            <div style={{ gridColumn: 'span 2', position: 'relative' }}>
              <label className="input-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Services</label>
              <div
                onClick={() => setShowServiceOptions(!showServiceOptions)}
                style={{
                  padding: '0.625rem 1rem',
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  minHeight: '42px',
                  transition: 'all 0.2s',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = showServiceOptions ? 'var(--primary)' : '#e2e8f0'}
              >
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  {formData.serviceIds.length > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ background: 'var(--primary)', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>
                        {formData.serviceIds.length}
                      </div>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}>
                        Service{formData.serviceIds.length > 1 ? 's' : ''} Selected
                      </span>
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Select services...</span>
                  )}
                </div>
                <ChevronDown size={18} style={{ color: '#64748b', transform: showServiceOptions ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </div>

              {showServiceOptions && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: 'white',
                  borderRadius: '0.75rem',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                  zIndex: 100,
                  border: '1px solid #e2e8f0',
                  marginTop: '0.5rem',
                  overflow: 'hidden',
                  animation: 'fadeIn 0.2s ease'
                }}>
                  {/* Search inside dropdown */}
                  <div style={{ padding: '0.75rem', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                    <div style={{ position: 'relative' }}>
                      <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search services..."
                        value={serviceSearch}
                        onChange={(e) => setServiceSearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ paddingLeft: '2.25rem', fontSize: '0.875rem', background: 'white', marginBottom: 0 }}
                      />
                    </div>
                  </div>

                  {/* List with checkboxes */}
                  <div style={{ maxHeight: '250px', overflowY: 'auto', padding: '0.25rem' }}>
                    {services
                      .filter(s => (s.name || '').toLowerCase().includes((serviceSearch || '').toLowerCase()))
                      .map(s => {
                        const isSelected = formData.serviceIds.includes(s.id);
                        return (
                          <label
                            key={s.id}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.75rem',
                              padding: '0.625rem 0.75rem',
                              cursor: 'pointer',
                              borderRadius: '0.375rem',
                              transition: 'all 0.15s',
                              background: isSelected ? 'rgba(var(--primary-rgb), 0.05)' : 'transparent',
                              marginBottom: '1px'
                            }}
                            className="hover:bg-gray-50"
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData(prev => ({ ...prev, serviceIds: [...prev.serviceIds, String(s.id)] }));
                                  if (s.checklistTemplateId) setShowChecklistInCreate(true);
                                } else {
                                  setFormData(prev => ({ ...prev, serviceIds: prev.serviceIds.filter(id => String(id) !== String(s.id)) }));
                                }
                              }}
                              style={{ width: '16px', height: '16px', borderRadius: '4px', cursor: 'pointer', border: '2px solid #cbd5e1' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '0.875rem', fontWeight: isSelected ? 600 : 500, color: isSelected ? 'var(--primary)' : '#1e293b' }}>{s.name}</span>
                                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{s.duration} mins</span>
                              </div>
                              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e293b' }}>{symbol}{s.price}</span>
                            </div>
                          </label>
                        );
                      })}
                    {services.filter(s => (s.name || '').toLowerCase().includes((serviceSearch || '').toLowerCase())).length === 0 && (
                      <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#94a3b8' }}>
                        <p style={{ fontSize: '0.875rem' }}>No services found</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="input-group" style={{ gridColumn: 'span 2', marginTop: '0.75rem' }}>
              <label className="input-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Selected Services Summary</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                {formData.serviceIds.map((id, index) => {
                  const s = services.find(srv => srv.id?.toString() === id.toString());
                  if (!s) return null;
                  return (
                    <div key={`${id}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{s.name}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-gray)' }}>{s.duration} mins • {symbol}{s.price}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, serviceIds: prev.serviceIds.filter((_, i) => i !== index) }))}
                        style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
                {formData.serviceIds.length === 0 && (
                  <div style={{ padding: '0.75rem', textAlign: 'center', border: '1px dashed #cbd5e1', borderRadius: '0.5rem', color: '#94a3b8', fontSize: '0.875rem' }}>
                    No services selected
                  </div>
                )}
              </div>

              {/* Totals Summary */}
              {formData.serviceIds.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1.5rem', padding: '0.5rem 0.75rem', background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: '0.5rem', marginBottom: '0.75rem', fontSize: '0.8125rem', fontWeight: 600 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Clock size={14} />
                    <span>Total Duration: {formData.serviceIds.reduce((acc, id) => acc + (services.find(s => s.id?.toString() === id.toString())?.duration || 0), 0)} mins</span>
                  </div>
                  <span>Total Price: {symbol}{formData.serviceIds.reduce((acc, id) => acc + (services.find(s => s.id?.toString() === id.toString())?.price || 0), 0)}</span>
                </div>
              )}

              {/* Multi-Service Checklist Forms */}
              {(() => {
                const servicesWithChecklists = formData.serviceIds
                  .map(id => services.find(s => s.id?.toString() === id.toString()))
                  .filter(s => s?.checklistTemplateId || (s as any)?.checklistId);

                if (formData.serviceIds.length > 0) {
                  return (
                    <div style={{ marginTop: '0.5rem', marginBottom: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>
                        <div style={{ background: 'rgba(var(--primary-rgb), 0.1)', color: 'var(--primary)', padding: '0.4rem', borderRadius: '0.4rem' }}>
                          <FileText size={18} />
                        </div>
                        <div>
                          <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1e293b' }}>
                            Required Service Checklists {servicesWithChecklists.length > 0 && `(${servicesWithChecklists.length})`}
                          </p>
                        </div>
                      </div>

                      {servicesWithChecklists.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '0.5rem' }}>
                          {servicesWithChecklists.map((s: any) => (
                            <div key={s.id} style={{ background: 'white', borderRadius: '0.75rem', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                              <div style={{ padding: '0.625rem 0.75rem', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase' }}>{s.name}</span>
                                <span style={{ fontSize: '0.65rem', color: '#1e40af', background: '#dbeafe', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>Action Required</span>
                              </div>
                              <div style={{ padding: '0.75rem' }}>
                                <ChecklistForm
                                  templateId={s.checklistTemplateId || s.checklistId}
                                  onDataChange={(res, rem) => handleChecklistDataChange(s.id.toString(), res, rem)}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '1rem', background: 'white', borderRadius: '0.5rem', border: '1px dashed #e2e8f0' }}>
                          <p style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            No additional checklists needed for selected services.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            <div className="input-group" style={{ position: 'relative', marginBottom: '0.75rem' }}>
              <label className="input-label">Specialist</label>
              <input
                type="text"
                className="form-control"
                placeholder="Type specialist name..."
                value={specialistSearch}
                onChange={(e) => {
                  setSpecialistSearch(e.target.value);
                  setShowSpecialistOptions(true);
                  if (!e.target.value) setFormData(prev => ({ ...prev, stylistId: '' }));
                }}
                onFocus={() => {
                  setShowSpecialistOptions(true);
                  if (formData.stylistId && !specialistSearch) {
                    const s = specialists.find(styl => styl.id?.toString() === formData.stylistId?.toString());
                    if (s) setSpecialistSearch(s.name);
                  }
                }}
                onBlur={() => setTimeout(() => setShowSpecialistOptions(false), 200)}
                required
              />
              {showSpecialistOptions && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', borderRadius: '0.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 50, maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border)', marginTop: '0.25rem' }}>
                  <div
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSpecialistSearch('Any specialist');
                      setFormData(prev => ({ ...prev, stylistId: '' }));
                      setShowSpecialistOptions(false);
                    }}
                    style={{ padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 600, borderBottom: '1px solid #f1f5f9' }}
                    className="hover:bg-gray-50"
                  >
                    Any specialist
                  </div>
                  {specialists
                    .filter(s => (s.name || '').toLowerCase().includes((specialistSearch || '').toLowerCase()))
                    .map(s => (
                      <div
                        key={s.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setSpecialistSearch(s.name);
                          setFormData(prev => ({ ...prev, stylistId: s.id.toString() }));
                          setShowSpecialistOptions(false);
                        }}
                        style={{ padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-dark)', borderBottom: '1px solid #f1f5f9' }}
                        className="hover:bg-gray-50"
                      >
                        <div style={{ fontWeight: 500 }}>{s.name}</div>
                        {s.specialization && <div style={{ fontSize: '0.75rem', color: 'var(--text-gray)' }}>{s.specialization}</div>}
                      </div>
                    ))
                  }
                </div>
              )}
            </div>

            <Select
              label="Status"
              name="status"
              value={formData.status || 'PENDING'}
              onChange={handleInputChange}
              options={[
                { value: 'PENDING', label: 'Pending' },
                { value: 'CONFIRMED', label: 'Confirmed' },
                { value: 'COMPLETED', label: 'Completed' },
                { value: 'CANCELLED', label: 'Cancelled' }
              ]}
              className="mb-0"
            />

            <div className="mb-0">
              <Input
                type="date"
                label="Date"
                name="date"
                value={formData.date}
                onChange={handleInputChange}
                disabled={!specialistSearch}
                className="mb-0"
              />
              {(() => {
                const selectedSpecialist = specialists.find(s => s.id.toString() === formData.stylistId);
                if (selectedSpecialist && selectedSpecialist.leaves && formData.date && selectedSpecialist.leaves.includes(formData.date)) {
                  return (
                    <div style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      ⚠️ {selectedSpecialist.name} is on leave on this date
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            {/* Tabbed Time Slot Picker */}
            <div style={{ gridColumn: 'span 2' }}>
              <label className="input-label" style={{ display: 'block', marginBottom: '1rem', fontSize: '0.875rem', fontWeight: 600 }}>Select Time Slot</label>
              {(() => {
                const selectedSpecialist = specialists.find(s => s.id.toString() === formData.stylistId);
                const isSpecialistOnLeave = selectedSpecialist && selectedSpecialist.leaves && formData.date && selectedSpecialist.leaves.includes(formData.date);

                if (isSpecialistOnLeave) {
                  return (
                    <div style={{ padding: '1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '0.5rem', fontSize: '0.875rem', border: '1px solid #fca5a5' }}>
                      Specialist is on leave - select different date or specialist
                    </div>
                  );
                }

                if (formData.date) {
                  const morningSlots: React.ReactNode[] = [];
                  const afternoonSlots: React.ReactNode[] = [];
                  const eveningSlots: React.ReactNode[] = [];

                  // Helper function to render a single slot button
                  const renderSlot = (timeString: string, displayTime: string, isBooked: boolean, isSelected: boolean) => (
                    <button
                      key={timeString}
                      type="button"
                      disabled={isBooked}
                      onClick={() => setFormData(prev => ({ ...prev, time: timeString }))}
                      style={{
                        padding: '0.75rem 0.5rem',
                        fontSize: '0.8125rem',
                        fontWeight: isSelected ? 600 : 500,
                        borderRadius: '0.5rem',
                        border: '1px solid',
                        borderColor: isSelected ? 'var(--primary)' : (isBooked ? '#f1f5f9' : 'var(--border)'),
                        background: isSelected ? 'var(--primary)' : (isBooked ? '#f8fafc' : 'white'),
                        color: isSelected ? 'white' : (isBooked ? '#94a3b8' : 'var(--text-dark)'),
                        cursor: isBooked ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px',
                        opacity: isBooked ? 0.7 : 1
                      }}
                    >
                      <span>{displayTime}</span>
                      {isBooked && <span style={{ fontSize: '0.625rem', color: '#ef4444' }}>(Booked)</span>}
                    </button>
                  );

                  // Helper to generate slots for a specific range
                  const generateSlots = (startStr: string, endStr: string, targetList: React.ReactNode[]) => {
                    const [sH, sM] = startStr.split(':').map(Number);
                    const [eH, eM] = endStr.split(':').map(Number);
                    let curH = sH, curM = sM;
                    const endMin = eH * 60 + eM;

                    // Skip past time slots when the selected date is today
                    const todayStr = new Date().toISOString().split('T')[0];
                    const isToday = formData.date === todayStr;
                    const now = new Date();
                    const nowMinutes = now.getHours() * 60 + now.getMinutes();

                    while (curH * 60 + curM < endMin) {
                      if (isToday && (curH * 60 + curM) <= nowMinutes) {
                        curM += 30;
                        if (curM >= 60) { curH++; curM -= 60; }
                        continue;
                      }

                      const timeString = `${curH.toString().padStart(2, '0')}:${curM.toString().padStart(2, '0')}`;
                      const displayTime = new Date(2000, 0, 1, curH, curM).toLocaleTimeString('en-US', {
                        hour: 'numeric', minute: '2-digit', hour12: true
                      });

                      const selectedDateTime = new Date(`${formData.date}T${timeString}`);
                      const isBooked = unavailableSlots.some(slot => {
                        const start = new Date(slot.startTime);
                        const end = new Date(slot.endTime);
                        return selectedDateTime >= start && selectedDateTime < end;
                      });
                      const isSelected = formData.time === timeString;

                      targetList.push(renderSlot(timeString, displayTime, isBooked, isSelected));

                      curM += 30;
                      if (curM >= 60) { curH++; curM -= 60; }
                    }
                  };

                  let mStart, mEnd, aStart, aEnd;
                  // Explicitly check for Morning/Afternoon configuration first
                  if (selectedSpecialist && formData.date) {
                    let wh: any = {};
                    if (selectedSpecialist.dateSpecificHours && selectedSpecialist.dateSpecificHours[formData.date]) {
                      wh = selectedSpecialist.dateSpecificHours[formData.date];
                    } else if (selectedSpecialist.workingHours) {
                      // Fix: ensure we parse YYYY-MM-DD correctly in local time context
                      const [y, m, d] = formData.date.split('-').map(Number);
                      const localDate = new Date(y, m - 1, d); // Month is 0-indexed
                      const dayName = localDate.toLocaleDateString('en-US', { weekday: 'short' });
                      if (selectedSpecialist.workingHours[dayName]) {
                        wh = selectedSpecialist.workingHours[dayName];
                      }
                    }

                    if (wh.morning) {
                      mStart = wh.morning.start;
                      mEnd = wh.morning.end;
                    }
                    if (wh.afternoon) {
                      aStart = wh.afternoon.start;
                      aEnd = wh.afternoon.end;
                    }

                    // Legacy Fallback: If no explicit morning/afternoon, use start/end and split at 12:00
                    if (!wh.morning && !wh.afternoon && wh.start) {
                      mStart = wh.start;
                      mEnd = '12:00';
                      aStart = '12:00';
                      aEnd = wh.end;
                    }
                  }

                  // Use defaults if absolutely nothing found
                  if (!mStart && !aStart) {
                    mStart = openingTime || '09:00';
                    mEnd = '12:00';
                    aStart = '12:00';
                    aEnd = closingTime || '18:00';
                  }

                  if (mStart && mEnd) generateSlots(mStart, mEnd, morningSlots);
                  if (aStart && aEnd) generateSlots(aStart, aEnd, afternoonSlots);



                  const activeSlots = activeTab === 'morning' ? morningSlots : (activeTab === 'afternoon' ? afternoonSlots : eveningSlots);

                  return (
                    <div>
                      {/* Tab Bar */}
                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', background: '#f1f5f9', padding: '4px', borderRadius: '0.75rem' }}>
                        {[
                          { id: 'morning', label: 'Morning', icon: '☀️', count: morningSlots.length },
                          { id: 'afternoon', label: 'Afternoon', icon: '🌤️', count: afternoonSlots.length },
                          // { id: 'evening', label: 'Evening', icon: '🌙', count: eveningSlots.length }
                        ].map(tab => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id as any)}
                            disabled={tab.count === 0}
                            style={{
                              flex: 1,
                              padding: '0.625rem 0.5rem',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              borderRadius: '0.5rem',
                              border: 'none',
                              background: activeTab === tab.id ? 'white' : 'transparent',
                              color: activeTab === tab.id ? 'var(--primary)' : (tab.count === 0 ? '#94a3b8' : 'var(--text-gray)'),
                              boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                              cursor: tab.count === 0 ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.375rem',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <span>{tab.icon}</span>
                            <span>{tab.label}</span>
                          </button>
                        ))}
                      </div>

                      {/* Slots Grid */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
                        gap: '0.75rem',
                        minHeight: '100px',
                        maxHeight: '250px',
                        overflowY: 'auto',
                        padding: '2px'
                      }}>
                        {activeSlots.length > 0 ? activeSlots : (
                          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', color: 'var(--text-gray)', fontSize: '0.875rem' }}>
                            No slots available for this period
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                return (
                  <div style={{ padding: '2rem', textAlign: 'center', background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid var(--border)', color: 'var(--text-gray)', fontSize: '0.875rem' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📅</div>
                    Select Date & Stylist to view slots
                  </div>
                );
              })()}
            </div>

            <div style={{ gridColumn: 'span 2', marginTop: '1rem' }}>
              <label className="input-label" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>Comments</label>
              <textarea
                className="form-control"
                name="notes"
                placeholder="Add any special requests or notes here..."
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border)',
                  minHeight: '100px',
                  fontSize: '0.875rem',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <AttachmentsInput
                attachments={formData.attachments}
                onChange={(newAttachments) => setFormData(prev => ({ ...prev, attachments: newAttachments }))}
              />
            </div>
          </div>

          <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading} isLoading={loading}>
              {loading ? 'Booking...' : (editingAppointment ? 'Updating...' : 'Confirm Booking')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* EDIT APPOINTMENT MODAL */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => { setIsEditModalOpen(false); setEditingAppointment(null); }}
        title="Edit Schedule"
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {/* Main Grid: Rows 1-6 */}
          <div className="grid grid-cols-2 gap-x-6" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: '1.5rem', rowGap: '0.75rem' }}>
            {/* Row 1: Customer & Service */}
            <div className="input-group" style={{ position: 'relative', marginBottom: '0.25rem' }}>
              <label className="input-label">Customer</label>
              <input
                type="text"
                className="form-control"
                placeholder="Type customer name..."
                value={customerSearch}
                onChange={(e) => {
                  const searchValue = e.target.value;
                  setCustomerSearch(searchValue);
                  const matchedCustomer = customers.find(c =>
                    (c.name || '').toLowerCase() === (searchValue || '').toLowerCase() ||
                    (c.name || '').toLowerCase().startsWith((searchValue || '').toLowerCase())
                  );
                  if (matchedCustomer) {
                    setFormData(prev => ({ ...prev, customerId: matchedCustomer.id }));
                  } else {
                    setFormData(prev => ({ ...prev, customerId: '' }));
                  }
                }}
                onFocus={() => {
                  if (formData.customerId && !customerSearch) {
                    const selected = customers.find(c => c.id === formData.customerId);
                    if (selected) setCustomerSearch(selected.name);
                  }
                }}
                list="customers-list-edit"
                required
              />
              <datalist id="customers-list-edit">
                {customers
                  .filter(c =>
                    (c.name || '').toLowerCase().includes((customerSearch || '').toLowerCase()) ||
                    (c.email || '').toLowerCase().includes((customerSearch || '').toLowerCase())
                  )
                  .map(c => (
                    <option key={c.id} value={c.name}>
                      {c.name} ({c.email})
                    </option>
                  ))
                }
              </datalist>
            </div>

            <div className="input-group" style={{ position: 'relative', marginBottom: '0.25rem' }}>
              <label className="input-label">Service</label>
              <input
                type="text"
                className="form-control"
                placeholder="Type service name..."
                value={serviceSearch}
                onChange={(e) => {
                  setServiceSearch(e.target.value);
                  setShowServiceOptions(true);
                  if (!e.target.value) setFormData(prev => ({ ...prev, serviceId: '' }));
                }}
                onFocus={() => {
                  setShowServiceOptions(true);
                  if (formData.serviceId && !serviceSearch) {
                    const s = services.find(srv => srv.id?.toString() === formData.serviceId?.toString());
                    if (s) setServiceSearch(s.name);
                  }
                }}
                onBlur={() => setTimeout(() => setShowServiceOptions(false), 200)}
                required
              />
              {showServiceOptions && (serviceSearch || document.activeElement === document.querySelector('input[placeholder="Type service name..."]')) && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', borderRadius: '0.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 50, maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border)', marginTop: '0.25rem' }}>
                  {services
                    .filter(s => (s.name || '').toLowerCase().includes((serviceSearch || '').toLowerCase()))
                    .map(s => (
                      <div
                        key={s.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setServiceSearch(s.name);
                          setFormData(prev => ({ ...prev, serviceId: s.id }));
                          setShowServiceOptions(false);
                        }}
                        style={{ padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-dark)', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9' }}
                        className="hover:bg-gray-50"
                      >
                        <span>{s.name}</span>
                        <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{symbol}{s.price}</span>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>

            {/* Row 2: Specialists */}
            <Select
              label="Current Specialist"
              name="originalStylistId"
              value={editingAppointment?.originalSpecialistId || originalSpecialistId}
              onChange={() => { }}
              disabled
              options={[
                { value: '', label: 'Select Specialist' },
                ...specialists.map(st => ({ value: st.id, label: st.name }))
              ]}
              className="mb-0"
              style={{ marginBottom: '0.75rem' }}
            />

            <div className="input-group" style={{ position: 'relative', marginBottom: '0.75rem' }}>
              <label className="input-label">Reassign to Specialist</label>
              <input
                type="text"
                className="form-control"
                placeholder="Type specialist name..."
                value={specialistSearch}
                onChange={(e) => {
                  setSpecialistSearch(e.target.value);
                  setShowSpecialistOptions(true);
                  if (!e.target.value) setFormData(prev => ({ ...prev, stylistId: '' }));
                }}
                onFocus={() => {
                  setShowSpecialistOptions(true);
                  if (formData.stylistId && !specialistSearch) {
                    const s = specialists.find(styl => styl.id?.toString() === formData.stylistId?.toString());
                    if (s) setSpecialistSearch(s.name);
                  }
                }}
                onBlur={() => setTimeout(() => setShowSpecialistOptions(false), 200)}
                required
              />
              {showSpecialistOptions && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', borderRadius: '0.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 50, maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border)', marginTop: '0.25rem' }}>
                  <div
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSpecialistSearch('Any specialist');
                      setFormData(prev => ({ ...prev, stylistId: '' }));
                      setShowSpecialistOptions(false);
                    }}
                    style={{ padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 600, borderBottom: '1px solid #f1f5f9' }}
                    className="hover:bg-gray-50"
                  >
                    Any specialist
                  </div>
                  {specialists
                    .filter(s => (s.name || '').toLowerCase().includes((specialistSearch || '').toLowerCase()))
                    .map(s => (
                      <div
                        key={s.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setSpecialistSearch(s.name);
                          setFormData(prev => ({ ...prev, stylistId: s.id.toString() }));
                          setShowSpecialistOptions(false);
                        }}
                        style={{ padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-dark)', borderBottom: '1px solid #f1f5f9' }}
                        className="hover:bg-gray-50"
                      >
                        <div style={{ fontWeight: 500 }}>{s.name}</div>
                        {s.specialization && <div style={{ fontSize: '0.75rem', color: 'var(--text-gray)' }}>{s.specialization}</div>}
                      </div>
                    ))
                  }
                </div>
              )}
            </div>

            {/* Row 3: Status & Date */}
            <Select
              label="Status"
              name="status"
              value={formData.status || 'PENDING'}
              onChange={handleInputChange}
              options={[
                { value: 'PENDING', label: 'Pending' },
                { value: 'CONFIRMED', label: 'Confirmed' },
                { value: 'COMPLETED', label: 'Completed' },
                { value: 'CANCELLED', label: 'Cancelled' }
              ]}
              className="mb-0"
              style={{ marginBottom: '0.75rem' }}
            />

            <div className="mb-0" style={{ marginBottom: '0.75rem' }}>
              <Input
                type="date"
                label="Date"
                name="date"
                value={formData.date}
                onChange={handleInputChange}
                required
                className="mb-0"
              />
            </div>

            {/* Row 4: Time Slot Picker */}
            <div style={{ gridColumn: 'span 2', marginTop: '1rem' }}>
              <label className="input-label" style={{ display: 'block', marginBottom: '1rem', fontSize: '0.875rem', fontWeight: 600 }}>Select Time Slot</label>
              {(() => {
                const selectedSpecialist = specialists.find(s => s.id.toString() === formData.stylistId);
                const isSpecialistOnLeave = selectedSpecialist && selectedSpecialist.leaves && formData.date && selectedSpecialist.leaves.includes(formData.date);
                if (isSpecialistOnLeave) {
                  return (
                    <div style={{ padding: '1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '0.5rem', fontSize: '0.875rem', border: '1px solid #fca5a5' }}>
                      Specialist is on leave - select different date or specialist
                    </div>
                  );
                }
                if (formData.date && formData.stylistId) {
                  const morningSlots: React.ReactNode[] = [];
                  const afternoonSlots: React.ReactNode[] = [];
                  const eveningSlots: React.ReactNode[] = [];

                  // Helper function to render a single slot button
                  const renderSlot = (timeString: string, displayTime: string, isBooked: boolean, isSelected: boolean) => (
                    <button
                      key={timeString}
                      type="button"
                      disabled={isBooked}
                      onClick={() => setFormData(prev => ({ ...prev, time: timeString }))}
                      style={{
                        padding: '0.75rem 0.5rem',
                        fontSize: '0.8125rem',
                        fontWeight: isSelected ? 600 : 500,
                        borderRadius: '0.5rem',
                        border: '1px solid',
                        borderColor: isSelected ? 'var(--primary)' : (isBooked ? '#f1f5f9' : 'var(--border)'),
                        background: isSelected ? 'var(--primary)' : (isBooked ? '#f8fafc' : 'white'),
                        color: isSelected ? 'white' : (isBooked ? '#94a3b8' : 'var(--text-dark)'),
                        cursor: isBooked ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px',
                        opacity: isBooked ? 0.7 : 1
                      }}
                    >
                      <span>{displayTime}</span>
                      {isBooked && <span style={{ fontSize: '0.625rem', color: '#ef4444' }}>(Booked)</span>}
                    </button>
                  );

                  // Helper to generate slots for a specific range
                  const generateSlots = (startStr: string, endStr: string, targetList: React.ReactNode[]) => {
                    const [sH, sM] = startStr.split(':').map(Number);
                    const [eH, eM] = endStr.split(':').map(Number);
                    let curH = sH, curM = sM;
                    const endMin = eH * 60 + eM;

                    // Determine if selected date is today to filter past slots
                    const todayStr2 = new Date().toISOString().split('T')[0];
                    const isToday2 = formData.date === todayStr2;
                    const now2 = new Date();
                    const nowMinutes2 = now2.getHours() * 60 + now2.getMinutes();

                    while (curH * 60 + curM < endMin) {
                      // Skip past time slots when date is today
                      if (isToday2 && (curH * 60 + curM) <= nowMinutes2) {
                        curM += 30;
                        if (curM >= 60) { curH++; curM -= 60; }
                        continue;
                      }

                      const timeString = `${curH.toString().padStart(2, '0')}:${curM.toString().padStart(2, '0')}`;
                      const displayTime = new Date(2000, 0, 1, curH, curM).toLocaleTimeString('en-US', {
                        hour: 'numeric', minute: '2-digit', hour12: true
                      });

                      const selectedDateTime = new Date(`${formData.date}T${timeString}`);
                      const isBooked = unavailableSlots.some(slot => {
                        const start = new Date(slot.startTime);
                        const end = new Date(slot.endTime);
                        return selectedDateTime >= start && selectedDateTime < end;
                      });
                      const isSelected = formData.time === timeString;

                      targetList.push(renderSlot(timeString, displayTime, isBooked, isSelected));

                      curM += 30;
                      if (curM >= 60) { curH++; curM -= 60; }
                    }
                  };

                  let mStart, mEnd, aStart, aEnd;
                  // Explicitly check for Morning/Afternoon configuration first
                  if (selectedSpecialist && formData.date) {
                    let wh: any = {};
                    if (selectedSpecialist.dateSpecificHours && selectedSpecialist.dateSpecificHours[formData.date]) {
                      wh = selectedSpecialist.dateSpecificHours[formData.date];
                    } else if (selectedSpecialist.workingHours) {
                      const dayName = new Date(formData.date).toLocaleDateString('en-US', { weekday: 'short' });
                      if (selectedSpecialist.workingHours[dayName]) {
                        wh = selectedSpecialist.workingHours[dayName];
                      }
                    }

                    if (wh.morning) {
                      mStart = wh.morning.start;
                      mEnd = wh.morning.end;
                    }
                    if (wh.afternoon) {
                      aStart = wh.afternoon.start;
                      aEnd = wh.afternoon.end;
                    }

                    // Legacy Fallback
                    if (!wh.morning && !wh.afternoon && wh.start) {
                      mStart = wh.start;
                      mEnd = '12:00';
                      aStart = '12:00';
                      aEnd = wh.end;
                    }
                  }

                  // Use defaults if absolutely nothing found
                  if (!mStart && !aStart) {
                    mStart = openingTime || '09:00';
                    mEnd = '12:00';
                    aStart = '12:00';
                    aEnd = closingTime || '18:00';
                  }

                  if (mStart && mEnd) generateSlots(mStart, mEnd, morningSlots);
                  if (aStart && aEnd) generateSlots(aStart, aEnd, afternoonSlots);
                  const activeSlots = activeTab === 'morning' ? morningSlots : (activeTab === 'afternoon' ? afternoonSlots : eveningSlots);
                  return (
                    <div>
                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', background: '#f1f5f9', padding: '4px', borderRadius: '0.75rem' }}>
                        {[
                          { id: 'morning', label: 'Morning', icon: '☀️', count: morningSlots.length },
                          { id: 'afternoon', label: 'Afternoon', icon: '🌤️', count: afternoonSlots.length },
                          { id: 'evening', label: 'Evening', icon: '🌙', count: eveningSlots.length }
                        ].map(tab => (
                          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id as any)} disabled={tab.count === 0} style={{ flex: 1, padding: '0.625rem 0.5rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: '0.5rem', border: 'none', background: activeTab === tab.id ? 'white' : 'transparent', color: activeTab === tab.id ? 'var(--primary)' : (tab.count === 0 ? '#94a3b8' : 'var(--text-gray)'), boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', cursor: tab.count === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', transition: 'all 0.2s ease' }}>
                            <span>{tab.icon}</span>
                            <span>{tab.label}</span>
                          </button>
                        ))}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '0.75rem', minHeight: '100px', maxHeight: '250px', overflowY: 'auto', padding: '2px' }}>
                        {activeSlots.length > 0 ? activeSlots : (<div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', color: 'var(--text-gray)', fontSize: '0.875rem' }}>No slots available for this period</div>)}
                      </div>
                    </div>
                  );
                }
                return (
                  <div style={{ padding: '2rem', textAlign: 'center', background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid var(--border)', color: 'var(--text-gray)', fontSize: '0.875rem' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📅</div>
                    Select Date & Stylist to view slots
                  </div>
                );
              })()}
            </div>

            {/* Row 5: Comments */}
            <div style={{ gridColumn: 'span 2', marginTop: '1rem' }}>
              <label className="input-label" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>Comments</label>
              <textarea
                className="form-control"
                name="notes"
                placeholder="Add any special requests or notes here..."
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)', minHeight: '100px', fontSize: '0.875rem', outline: 'none', transition: 'border-color 0.2s', resize: 'vertical' }}
              />
            </div>

            {/* Row 6: Attachments */}
            <div style={{ gridColumn: 'span 2' }}>
              <AttachmentsInput
                attachments={formData.attachments}
                onChange={(newAttachments) => setFormData(prev => ({ ...prev, attachments: newAttachments }))}
              />
            </div>
          </div>

          {/* Button Bar: OUTSIDE the main grid */}
          <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {editingAppointment && (editingAppointment.status?.toUpperCase() || 'PENDING') !== 'PENDING' && !(isStaff && fraudProtection) && (
                <button
                  type="button"
                  onClick={() => handleWhatsApp(editingAppointment)}
                  style={{ color: 'white', background: '#25D366', border: 'none', cursor: 'pointer', fontSize: '0.875rem', padding: '0.5rem 1rem', borderRadius: '0.5rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <MessageSquare size={16} />
                  WhatsApp
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="button" onClick={() => { setIsEditModalOpen(false); setEditingAppointment(null); }} style={{ padding: '0.5rem 1rem', background: '#f1f5f9', border: 'none', color: '#334155', borderRadius: '0.5rem', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
              <Button type="submit" disabled={loading} isLoading={loading}>{loading ? 'Updating...' : 'Update Schedule'}</Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* CANCEL APPOINTMENT MODAL */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => { setIsCancelModalOpen(false); setCancelingAppointmentId(null); setCancelReason(''); }}
        title="Cancel Appointment"
      >
        <div className="space-y-4">
          <p style={{ fontSize: '0.875rem', color: 'var(--text-gray)' }}>
            Please provide a reason for canceling this appointment:
          </p>

          <Input
            label="Cancellation Reason"
            placeholder="e.g., Customer requested, Stylist unavailable, etc."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            required
          />

          <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <Button type="button" variant="ghost" onClick={() => { setIsCancelModalOpen(false); setCancelingAppointmentId(null); setCancelReason(''); }}>
              Back
            </Button>
            <Button
              onClick={confirmCancel}
              disabled={!cancelReason.trim()}
              style={{ background: 'var(--danger)', color: 'white' }}
            >
              Confirm Cancellation
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add state for View Modal */}
      {/* NOTE: The following state and function should be placed within the Appointments functional component,
               before the return statement, alongside other useState declarations. */}
      {/*
      const [isViewModalOpen, setIsViewModalOpen] = useState(false);
      const [viewAppointment, setViewAppointment] = useState<Appointment | null>(null);

      const handleView = (appointment: Appointment) => {
          setViewAppointment(appointment);
          setIsViewModalOpen(true);
      };
      */}
      {/* NOTE: In your columns definition, change onClick={() => handleEdit(row)} to onClick={() => handleView(row)} for the View button */}

      {/* Add this Modal JSX at the end */}
      {
        isViewModalOpen && viewAppointment && (
          <Modal
            isOpen={isViewModalOpen}
            onClose={() => setIsViewModalOpen(false)}
            title="Schedule Details"
          >
            <div className="space-y-6">
              {/* Appointment Info */}
              <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', rowGap: '1.25rem', columnGap: '2rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.375rem', display: 'block', letterSpacing: '0.025em' }}>Customer</label>
                    <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '1rem' }}>{viewAppointment.customer?.name}</div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.125rem' }}>
                      {(isStaff && fraudProtection) ? maskPhone(viewAppointment.customer?.phone || (viewAppointment.customer as any)?.mobile) : (viewAppointment.customer?.phone || (viewAppointment.customer as any)?.mobile)}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.375rem', display: 'block', letterSpacing: '0.025em' }}>Service{viewAppointment.services && viewAppointment.services.length > 1 ? 's' : ''}</label>
                    {viewAppointment.services && viewAppointment.services.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {viewAppointment.services.map((s, idx) => (
                          <div key={idx}>
                            <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '1rem' }}>{s.name}</div>
                            <div style={{ fontSize: '0.875rem', fontWeight: 500, color: '#059669', marginTop: '0.125rem' }}>
                              {formatPrice(s.price || 0)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <>
                        <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '1rem' }}>{viewAppointment.service?.name}</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 500, color: '#059669', marginTop: '0.125rem' }}>
                          {formatPrice(viewAppointment.service?.price || 0)}
                        </div>
                      </>
                    )}
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.375rem', display: 'block', letterSpacing: '0.025em' }}>Specialist</label>
                    <div style={{ fontWeight: 500, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: '1.75rem', height: '1.75rem', borderRadius: '9999px', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>
                        {viewAppointment.stylist?.name?.charAt(0) || 'S'}
                      </div>
                      {viewAppointment.stylist?.name || 'Any Specialist'}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.375rem', display: 'block', letterSpacing: '0.025em' }}>Date & Time</label>
                    <div style={{ fontWeight: 500, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <CalendarIcon size={16} color="#94a3b8" />
                      {(() => {
                        const dateSource = viewAppointment.startTime || viewAppointment.date;
                        if (!dateSource) return 'Date not set';
                        const dateObj = new Date(dateSource);
                        return isNaN(dateObj.getTime()) ? 'Invalid Date' : dateObj.toLocaleDateString('en-US', {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        });
                      })()}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                      <Clock size={16} color="#94a3b8" />
                      {(() => {
                        if (viewAppointment.startTime) {
                          const dateObj = new Date(viewAppointment.startTime);
                          return isNaN(dateObj.getTime()) ? 'Time not set' : dateObj.toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          });
                        }
                        return viewAppointment.time || 'Time not set';
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Comments Section */}
              {viewAppointment.notes && (
                <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
                  <label className="text-xs text-amber-600 uppercase font-bold mb-2 block">Comments</label>
                  <p className="text-sm text-amber-900 whitespace-pre-wrap leading-relaxed">
                    {viewAppointment.notes}
                  </p>
                </div>
              )}

              {/* Attachments Section */}
              <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem', padding: '1.25rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px dashed #cbd5e1' }}>
                <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                  Attachments
                  <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                    {viewAttachments.length} Files
                  </span>
                </h3>

                {/* Editable Attachments Input */}
                <AttachmentsInput
                  attachments={viewAttachments}
                  onChange={setViewAttachments}
                />

                {/* Save Button for Attachments */}
                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSaveAttachments}
                    isLoading={savingAttachments}
                    disabled={savingAttachments}
                  >
                    Save Attachments
                  </Button>
                </div>
              </div>

              {/* Payment History */}
              <div>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Transaction History
                  <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b', background: '#f1f5f9', padding: '0.125rem 0.5rem', borderRadius: '9999px', border: '1px solid #e2e8f0' }}>
                    {viewAppointment.payments?.length || 0} Transactions
                  </span>
                </h3>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', overflow: 'hidden', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}>
                  <table className="w-full text-sm">
                    <thead style={{ background: '#f8fafc', color: '#475569', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>
                      <tr>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'left', width: '25%' }}>Date</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'left', width: '25%' }}>Method</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'center', width: '25%' }}>Status</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'right', width: '25%' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody style={{ background: 'white' }}>
                      {viewAppointment.payments && viewAppointment.payments.length > 0 ? (
                        viewAppointment.payments.map((payment: any) => (
                          <tr key={payment.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                            <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>
                              <div style={{ fontWeight: 500, color: '#0f172a' }}>{new Date(payment.createdAt).toLocaleDateString()}</div>
                              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.125rem' }}>
                                {new Date(payment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 500, color: '#334155' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', background: '#f1f5f9', color: '#475569', fontSize: '0.75rem' }}>
                                {payment.paymentMethod}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', padding: '0.125rem 0.625rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600,
                                background: payment.paymentStatus === 'COMPLETED' ? '#d1fae5' : payment.paymentStatus === 'PARTIAL' ? '#dbeafe' : '#fef3c7',
                                color: payment.paymentStatus === 'COMPLETED' ? '#065f46' : payment.paymentStatus === 'PARTIAL' ? '#1e40af' : '#92400e'
                              }}>
                                {payment.paymentStatus}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: '#1e293b' }}>{formatPrice(payment.amount)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: '#64748B', fontSize: '0.875rem', background: '#f8fafc', fontStyle: 'italic' }}>
                            No transaction history available.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot style={{ background: '#f8fafc', fontWeight: 600, borderTop: '1px solid #e2e8f0' }}>
                      <tr>
                        <td colSpan={3} style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#475569' }}>Total Paid</td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#059669', fontSize: '1rem', fontWeight: 700 }}>
                          {formatPrice(viewAppointment.payments?.reduce((sum: number, p: any) =>
                            p.paymentStatus === 'COMPLETED' ? sum + p.amount : sum, 0) || 0)}
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={3} style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#475569' }}>Total Due</td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#1e293b', fontSize: '1rem', fontWeight: 700, borderTop: '1px dashed #e2e8f0' }}>
                          {formatPrice(viewAppointment.totalAmount)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* INLINE CHECKLIST SECTION */}
                <AnimatePresence>
                  {showChecklistInline && viewAppointment && activeChecklistId && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{ overflow: 'hidden', borderTop: '2px solid #F1F5F9', marginTop: '1.5rem', paddingTop: '1.5rem' }}
                    >
                      <div style={{ background: '#FFFFFF', padding: '1rem', borderRadius: '1rem', border: '1px solid #E2E8F0' }}>
                        <ChecklistForm
                          templateId={activeChecklistId}
                          appointmentId={viewAppointment.id}
                          onSuccess={() => {
                            dispatch(fetchAppointments());
                          }}
                          readOnly={(viewAppointment.status || '').toUpperCase() === 'COMPLETED'}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1.25rem', borderTop: '1px solid #e2e8f0', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  {/* WhatsApp Button */}
                  {(viewAppointment.status?.toUpperCase() || 'PENDING') !== 'PENDING' && !(isStaff && fraudProtection) && (
                    <button
                      onClick={() => handleWhatsApp(viewAppointment)}
                      style={{
                        padding: '0.5rem 1rem', background: '#25D366', border: 'none', color: 'white', borderRadius: '0.5rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.1)'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#20bd5a'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#25D366'}
                    >
                      <MessageSquare size={16} />
                      WhatsApp
                    </button>
                  )}

                  {/* Checklist Button */}
                  {/* Checklist Buttons */}
                  {(() => {
                    const servicesList = viewAppointment.services && viewAppointment.services.length > 0
                      ? viewAppointment.services
                      : services.filter(s => s.id?.toString() === viewAppointment.serviceId?.toString());

                    const servicesWithChecklists = servicesList.filter(s => s.checklistTemplateId);

                    if (servicesWithChecklists.length === 0) {
                      return (
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px dashed #e2e8f0' }}>
                          <AlertCircle size={14} />
                          No checklists linked to these services
                        </div>
                      );
                    }

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {servicesWithChecklists.map((s, idx) => {
                          const isActive = activeChecklistId === s.checklistTemplateId && showChecklistInline;
                          return (
                            <button
                              key={idx}
                              onClick={() => {
                                if (isActive) {
                                  setShowChecklistInline(false);
                                  setActiveChecklistId(null);
                                } else {
                                  setActiveChecklistId(s.checklistTemplateId);
                                  setShowChecklistInline(true);
                                }
                              }}
                              style={{
                                padding: '0.5rem 1rem',
                                background: isActive ? '#64748B' : 'var(--primary)',
                                border: 'none',
                                color: 'white',
                                borderRadius: '0.5rem',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.625rem',
                                cursor: 'pointer',
                                transition: 'all 0.23s',
                                boxShadow: '0 4px 12px rgba(var(--primary-rgb), 0.2)',
                                borderBottom: '2px solid rgba(0,0,0,0.1)'
                              }}
                            >
                              <FileText size={18} />
                              {isActive ? `Close ${s.name} Checklist` : `${viewAppointment.status === 'COMPLETED' ? 'View' : 'Fill'} ${s.name} Checklist`}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                {/* Right Actions (Print, Close) */}
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    onClick={() => window.print()}
                    style={{
                      padding: '0.5rem 1rem', background: 'white', border: '1px solid #cbd5e1', color: '#334155', borderRadius: '0.5rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                  >
                    <Printer size={16} />
                    Print Receipt
                  </button>
                  <button
                    onClick={() => setIsViewModalOpen(false)}
                    style={{
                      padding: '0.5rem 1rem', background: '#f1f5f9', border: 'none', color: '#334155', borderRadius: '0.5rem', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e2e8f0'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                  >
                    Close
                  </button>
                </div>
              </div>

            </div>
          </Modal>
        )
      }

      {/* NO SEPARATE CHECKLIST MODAL - NOW INLINE */}
    </div>
  );
};

export default Appointments;
