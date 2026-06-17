import React, { useState, useRef, useEffect } from 'react';

import { motion, AnimatePresence } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../redux/store';
import { fetchStylists, invalidateStylistCache } from '../redux/slices/stylistSlice';
import { WorkingHoursConfig } from '../components/WorkingHoursConfig';
import {
  MdAdd,
  MdEdit,
  MdEmail,
  MdPhone,
  MdAccessTime,
  MdCalendarToday,
  MdOutlineGridView,
  MdFormatListBulleted,
  MdWarning,
  MdCheckCircle,
  MdChevronLeft,
  MdChevronRight,
  MdLoop,
  MdExpandMore,
  MdExpandLess,
  MdLock,
} from 'react-icons/md';
import { Search } from 'lucide-react';
import { HiOutlineDocumentReport } from 'react-icons/hi';
import { Table, Button, Card, Modal, Input, Select, SearchableSelect, Skeleton } from '../components/UI';
import { Stylist, Service, Customer, Appointment, Category } from '../types';
import { useToast } from '../components/ToastContext';
import { useCurrency } from '../components/CurrencyContext';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinary';
import { removeImageBackground } from '../utils/backgroundRemoval';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { allMenuItems } from '../components/Layout';

const PermissionsSelector = ({ permissions, onChange }: { permissions: string[], onChange: (p: string[]) => void }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const { user } = useAuth();
  const appId = (user as any)?.app_id || 'salon';

  // Dynamically generate modules from Sidebar items that are accessible to STAFF
  const modules = allMenuItems
    .filter(item => {
      if (item.id === 'dashboard' || item.id === 'ask-ai') return false;
      if (!item.roles.includes('STAFF')) return false;
      if (item.id === 'checklist' && appId !== 'workly-service') return false;
      return true;
    })
    .map(item => ({
      id: item.id,
      label: item.label,
      actions: (item.id === 'packages' || item.id === 'vouchers')
        ? ['view', 'add', 'edit', 'adjust']
        : ['view', 'add', 'edit']
    }));

  const handleToggle = (module: string, action: string) => {
    const permString = `${module}.${action}`;
    if (permissions.includes(permString)) {
      onChange(permissions.filter(p => p !== permString));
    } else {
      onChange([...permissions, permString]);
    }
  };

  const activeCount = permissions.length;

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '0.75rem', overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1rem',
          background: 'var(--bg-body)',
          border: 'none',
          cursor: 'pointer'
        }}
      >
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--primary)', display: 'flex' }}><MdLock size={16} /></span>
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Access Permissions</span>
          {activeCount > 0 && (
            <span style={{ fontSize: '0.75rem', background: 'var(--primary)', color: 'white', padding: '0.1rem 0.5rem', borderRadius: '1rem' }}>
              {activeCount} active
            </span>
          )}
        </div>
        <span style={{ display: 'flex' }}>
          {isExpanded ? <MdExpandLess size={16} /> : <MdExpandMore size={16} />}
        </span>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            style={{ overflow: 'hidden', background: 'white' }}
          >
            <div style={{ padding: '1rem' }}>
              {/* Header Row */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1fr',
                gap: '0.5rem',
                paddingBottom: '0.75rem',
                marginBottom: '0.5rem',
                borderBottom: '1px solid var(--border-light)',
                fontWeight: 600,
                fontSize: '0.85rem',
                color: 'var(--text-black)',
                textAlign: 'center'
              }}>
                <div style={{ textAlign: 'left', paddingLeft: '0.5rem' }}>Module</div>
                <div>View</div>
                <div>Add</div>
                <div>Edit</div>
                <div>Adjust</div>
              </div>

              {modules.map(mod => (
                <div key={mod.id} style={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1fr',
                  gap: '0.5rem',
                  padding: '0.75rem 0',
                  borderBottom: '1px solid #f1f5f9',
                  alignItems: 'center'
                }}>
                  <div style={{ fontWeight: 500, fontSize: '0.9rem', color: 'var(--text-dark)', paddingLeft: '0.5rem' }}>{mod.label}</div>
                  {['view', 'add', 'edit', 'adjust'].map(action => {
                    const isAvailable = mod.actions.includes(action);
                    return (
                      <div key={action} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {isAvailable ? (
                          <input
                            type="checkbox"
                            checked={permissions.includes(`${mod.id}.${action}`)}
                            onChange={() => handleToggle(mod.id, action)}
                            style={{
                              accentColor: 'var(--primary)',
                              width: '1.1rem',
                              height: '1.1rem',
                              cursor: 'pointer'
                            }}
                          />
                        ) : (
                          <span style={{ opacity: 0.1 }}>-</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const DEFAULT_AVATARS = {
  male: 'https://png.pngtree.com/png-clipart/20230927/original/pngtree-man-avatar-image-for-profile-png-image_13001877.png',
  female: 'https://www.shutterstock.com/image-vector/black-woman-smiling-portrait-vector-600nw-2281497689.jpg',
  other: 'https://img.freepik.com/free-vector/smiling-young-man-illustration_1308-173524.jpg'
};

const isValidAvatar = (url: string | null | undefined): boolean => {
  if (!url) return false;
  const trimmed = url.trim();
  if (trimmed === '' || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined') return false;
  return true;
};

const Stylists: React.FC = () => {
  const { showToast } = useToast();
  const { user, isStaff, isAdmin, isManager, hasPermission } = useAuth();
  const appId = (user as any)?.app_id || 'salon';
  const canAdd = hasPermission('stylists', 'add');
  const canEdit = hasPermission('stylists', 'edit');
  const [viewMode, setViewMode] = useState<'list' | 'roaster'>('list');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

  // Reset pagination when search changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null); // Separate ref for edit modal
  const [isUploading, setIsUploading] = useState(false);
  const [removeBgAddEnabled, setRemoveBgAddEnabled] = useState(false);
  const [removeBgEditEnabled, setRemoveBgEditEnabled] = useState(false);

  // Edit Stylist State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStylist, setEditingStylist] = useState<Stylist | null>(null);
  const [newStylistPermissions, setNewStylistPermissions] = useState<string[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({}); // New state

  // Roster Management State
  const [rosterModalOpen, setRosterModalOpen] = useState(false);
  const [selectedRosterCell, setSelectedRosterCell] = useState<{ stylistId: number | string, date: string, currentStatus: string } | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [leaveConflictError, setLeaveConflictError] = useState<string | null>(null);

  // Controlled state for roster modal
  const [rosterFormState, setRosterFormState] = useState({
    morningStart: '',
    morningEnd: '',
    afternoonStart: '',
    afternoonEnd: ''
  });



  // Appointments for conflict validation
  const [appointments, setAppointments] = useState<Partial<Appointment>[]>([]);

  // Fetch stylists from API
  const dispatch = useDispatch<AppDispatch>();
  const { stylists, loading: stylistsLoading } = useSelector((state: RootState) => state.stylists);
  const filteredStylists = stylists.filter(stylist =>
    (stylist.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (stylist.specialization && stylist.specialization.toString().toLowerCase().includes(searchTerm.toLowerCase()))
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false); // Ref for immediate blocking
  // const [isInitialLoading, setIsInitialLoading] = useState(true); // Removed local state

  // Initialize roster form state when cell is selected and modal opens
  React.useEffect(() => {
    if (selectedRosterCell && rosterModalOpen) {
      const stylist = stylists.find(s => s.id === selectedRosterCell.stylistId);
      const dayHours = stylist?.dateSpecificHours?.[selectedRosterCell.date] || {};

      let mStart = '09:00', mEnd = '13:00', aStart = '14:00', aEnd = '18:00';

      // Check date specific
      if (dayHours.morning) {
        mStart = dayHours.morning.start;
        mEnd = dayHours.morning.end;
      } else if (dayHours.start) {
        // Legacy or single shift date-specific
        mStart = dayHours.start;
        mEnd = '13:00'; // Synthesized
      } else {
        // Fallback to weekly schedule
        const dayName = new Date(selectedRosterCell.date).toLocaleDateString('en-US', { weekday: 'short' });
        const weekHours = stylist?.workingHours?.[dayName] || {};

        mStart = weekHours.morning?.start || weekHours.start || '09:00';
        mEnd = weekHours.morning?.end || '13:00';
      }

      if (dayHours.afternoon) {
        aStart = dayHours.afternoon.start;
        aEnd = dayHours.afternoon.end;
      } else if (dayHours.end) {
        aStart = '14:00';
        aEnd = dayHours.end;
      } else {
        const dayName = new Date(selectedRosterCell.date).toLocaleDateString('en-US', { weekday: 'short' });
        const weekHours = stylist?.workingHours?.[dayName] || {};

        aStart = weekHours.afternoon?.start || '14:00';
        aEnd = weekHours.afternoon?.end || weekHours.end || '18:00';
      }

      setRosterFormState({
        morningStart: mStart,
        morningEnd: mEnd,
        afternoonStart: aStart,
        afternoonEnd: aEnd
      });
    }
  }, [selectedRosterCell, rosterModalOpen, stylists]);


  // Fetch services for specialization dropdown
  const [services, setServices] = useState<Service[]>([]);
  // Fetch categories for specialization dropdown
  const [categories, setCategories] = useState<Category[]>([]);
  const [newStylistImgUrl, setNewStylistImgUrl] = useState(''); // Standardized image state
  const [newStylistGender, setNewStylistGender] = useState(''); // Gender for add modal

  const INITIAL_WORKING_HOURS = {
    'Mon': { morning: { start: '09:00', end: '13:00' }, afternoon: { start: '14:00', end: '17:00' } },
    'Tue': { morning: { start: '09:00', end: '13:00' }, afternoon: { start: '14:00', end: '17:00' } },
    'Wed': { morning: { start: '09:00', end: '13:00' }, afternoon: { start: '14:00', end: '17:00' } },
    'Thu': { morning: { start: '09:00', end: '13:00' }, afternoon: { start: '14:00', end: '17:00' } },
    'Fri': { morning: { start: '09:00', end: '13:00' }, afternoon: { start: '14:00', end: '17:00' } },
  };

  // Default working hours: Mon-Fri, 09:00-17:00
  const [newStylistWorkingHours, setNewStylistWorkingHours] = useState<any>(INITIAL_WORKING_HOURS);


  const handleGenderChange = (gender: string, isEdit: boolean) => {
    const defaultAvatarUrl = (DEFAULT_AVATARS as any)[gender.toLowerCase()] || '';

    // Helper to check if current image is a default one
    const isDefaultImage = (url: string) => Object.values(DEFAULT_AVATARS).includes(url) || !url;

    if (isEdit && editingStylist) {
      // Only update image if the current one is a default avatar or empty.
      // If user has uploaded a custom image, preserve it.
      const shouldUpdateImage = isDefaultImage(editingStylist.imgUrl || '');

      setEditingStylist({
        ...editingStylist,
        gender: gender as any,
        imgUrl: shouldUpdateImage ? defaultAvatarUrl : editingStylist.imgUrl
      });
    } else {
      // For new stylist, same logic: preserve custom upload if exists
      const shouldUpdateImage = isDefaultImage(newStylistImgUrl);

      setNewStylistGender(gender);
      if (shouldUpdateImage) {
        setNewStylistImgUrl(defaultAvatarUrl);
      }
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
        // Ensure removeImageBackground is imported or available
        // If not standard in this file, we might need to check imports. 
        // Assuming imports are correct from previous steps.
        try {
          fileToUpload = await removeImageBackground(file);
        } catch (err) {
          console.error("Background removal failed, uploading original.", err);
          showToast('Background removal failed, uploading original image.', 'warning');
        }
      }
      const url = await uploadToCloudinary(fileToUpload);
      console.log('Image uploaded successfully:', url);

      if (isEdit && editingStylist) {
        setEditingStylist({ ...editingStylist, imgUrl: url });
      } else {
        setNewStylistImgUrl(url);
      }
      showToast('Image uploaded successfully', 'success');
    } catch (error: any) {
      console.error('Cloudinary upload error:', error);
      showToast(error.message || 'Failed to upload image', 'error');
    } finally {
      setIsUploading(false);
      // Reset input
      if (e.target) e.target.value = '';
    }
  };

  const handleRemoveImage = async (isEdit: boolean = false) => {
    const url = isEdit ? editingStylist?.imgUrl : newStylistImgUrl;
    if (!url) return;

    try {
      await deleteFromCloudinary(url);
      if (isEdit && editingStylist) {
        setEditingStylist({ ...editingStylist, imgUrl: '' });
      } else {
        setNewStylistImgUrl('');
      }
      showToast('Image removed from server', 'success');
    } catch (error: any) {
      console.error('Cloudinary delete error:', error);
      showToast(error.message || 'Failed to remove image', 'error');
      // Optimistic Update
      if (isEdit && editingStylist) {
        setEditingStylist({ ...editingStylist, imgUrl: '' });
      } else {
        setNewStylistImgUrl('');
      }
    }
  };

  const fetchServices = async () => {
    try {
      const response = await api.get('/services');
      const dataRaw = response.data;
      const data = Array.isArray(dataRaw) ? dataRaw : (dataRaw?.services || []);
      const activeServices = data.filter((s: any) => s.isActive !== false && s.active !== false);
      setServices(activeServices);
    } catch (error) {
      console.error("Error fetching services for stylist view:", error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await api.get('/categories', { params: { type: 'SERVICE' } });
      const data = Array.isArray(response.data) ? response.data : (response.data?.categories || []);
      setCategories(data.filter((c: any) => c.isActive !== false && c.active !== false));
    } catch (error) {
      console.error("Error fetching categories for stylist view:", error);
    }
  };

  // const fetchStylists = async () => { ... } // Removed local fetch logic

  useEffect(() => {
    dispatch(fetchStylists(false));
  }, [dispatch]);

  const fetchAppointments = async () => {
    try {
      const response = await api.get('/appointments');
      setAppointments(response.data);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    }
  };

  React.useEffect(() => {
    // fetchStylists(); // Handled by Redux
    fetchAppointments();
    fetchServices();
    fetchCategories();
  }, []);

  const handleAddStylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return; // Block if already submitting

    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const form = e.target as HTMLFormElement;
      const nameInput = form.querySelector('input[placeholder="e.g. Jessica Smith"]') as HTMLInputElement;
      const emailInput = form.querySelector('input[type="email"]') as HTMLInputElement;
      const phoneInput = form.querySelector('input[placeholder="(555) 000-0000"]') as HTMLInputElement;
      const specializationInput = form.querySelector('input[name="specialization"]') as HTMLInputElement;
      const basicPriceInput = form.querySelector('input[name="basicPrice"]') as HTMLInputElement;

      // Collect working hours from state
      const workingHours = newStylistWorkingHours;

      // Get Account Status (Active/Inactive)
      const accountStatusSelect = form.querySelector('select[name="accountStatus"]') as HTMLSelectElement;
      const isAvailable = accountStatusSelect ? accountStatusSelect.value === 'active' : true;

      const genderSelect = form.querySelector('select[name="gender"]') as HTMLSelectElement;
      const gender = genderSelect ? genderSelect.value : undefined;

      // VALIDATION
      const newErrors: Record<string, string> = {};
      if (!nameInput.value.trim()) newErrors.name = 'Specialist name is required';
      if (!gender) newErrors.gender = 'Gender is required';
      if (!phoneInput.value.trim()) newErrors.phone = 'Phone number is required';

      if (Object.keys(newErrors).length > 0) {
        setFormErrors(newErrors);
        showToast('Please fill all required fields', 'error');
        return;
      }

      setFormErrors({});

      const newStylist = {
        name: nameInput.value,
        gender,
        email: emailInput.value,
        phone: phoneInput.value,
        specialization: specializationInput ? Array.from(new Set(specializationInput.value.split(',').map(s => s.trim()).filter(Boolean))).join(', ') : 'General',
        basicPrice: basicPriceInput ? parseFloat(basicPriceInput.value) || 0 : 0,
        workingHours,
        isAvailable,
        permissions: newStylistPermissions,
        imgUrl: newStylistImgUrl
      };

      const response = await api.post('/stylists', newStylist);

      showToast('Specialist added successfully!', 'success');
      setNewStylistImgUrl('');
      setNewStylistWorkingHours(INITIAL_WORKING_HOURS);
      setNewStylistPermissions([]);
      setIsModalOpen(false);
      dispatch(invalidateStylistCache());
      dispatch(fetchStylists(true)); // Refresh list
    } catch (error) {
      console.error('Error adding stylist:', error);
      showToast('Error adding stylist', 'error');
    } finally {
      setIsSubmitting(false);
      submittingRef.current = false;
    }
  };

  const handleEditStylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStylist) return;

    // VALIDATION
    const newErrors: Record<string, string> = {};
    if (!editingStylist.name.trim()) newErrors.name = 'Specialist name is required';
    if (!editingStylist.gender) newErrors.gender = 'Gender is required';
    if (!editingStylist.phone.trim()) newErrors.phone = 'Phone number is required';

    if (Object.keys(newErrors).length > 0) {
      setFormErrors(newErrors);
      showToast('Please fill all required fields', 'error');
      return;
    }

    setFormErrors({});
    setIsSubmitting(true);

    try {
      await api.put(`/stylists/${editingStylist.id}`, editingStylist);

      showToast('Specialist updated successfully!', 'success');
      setIsEditModalOpen(false);
      setEditingStylist(null);
      dispatch(invalidateStylistCache());
      dispatch(fetchStylists(true));
    } catch (error) {
      console.error('Error updating stylist:', error);
      showToast('Error updating specialist', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (stylist: Stylist, newStatus: string) => {
    // newStatus: 'active' | 'inactive'
    const isAvailable = newStatus === 'active';
    // We also update the local status for immediate UI feedback if needed, but fetchStylists will handle it.
    // Ideally we should sync 'status' field too if backend relies on it, but isAvailable is the source of truth for "Active/Inactive"
    const updatedStylist = { ...stylist, isAvailable };

    try {
      await api.put(`/stylists/${stylist.id}`, updatedStylist);

      showToast(`Specialist marked as ${newStatus}`, 'success');
      dispatch(invalidateStylistCache());
      dispatch(fetchStylists(true));
    } catch (error) {
      console.error('Error updating status:', error);
      showToast('Error updating status', 'error');
    }
  };

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Generate current week dates dynamically
  const getCurrentWeekDates = () => {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, ...
    const monday = new Date(today);
    // Find Monday of the current week
    monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
    // Apply week offset
    monday.setDate(monday.getDate() + (weekOffset * 7));

    const weekDates = [];
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      weekDates.push({
        day: dayNames[i],
        date: date.toISOString().split('T')[0] // YYYY-MM-DD format
      });
    }

    return weekDates;
  };

  const currentWeekDates = getCurrentWeekDates();

  // Helper to format time from 24-hour to 12-hour format
  const formatTime = (time24: string) => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  // Helper to check if a specific date is a working day based on base schedule
  const getScheduleForDate = (stylist: Stylist, dayName: string, dateString: string) => {
    // Check leave
    if (stylist.leaves?.includes(dateString)) return { type: 'leave', label: 'OFF' };

    // Check date-specific hours FIRST
    if (stylist.dateSpecificHours?.[dateString]) {
      const schedule = stylist.dateSpecificHours[dateString];
      if (schedule.morning || schedule.afternoon) {
        let label = '';
        if (schedule.morning?.start && schedule.morning?.end && schedule.morning.start !== schedule.morning.end) {
          label += `${formatTime(schedule.morning.start)}-${formatTime(schedule.morning.end)}`;
        }
        if (schedule.afternoon?.start && schedule.afternoon?.end && schedule.afternoon.start !== schedule.afternoon.end) {
          if (label) label += '\n';
          label += `${formatTime(schedule.afternoon.start)}-${formatTime(schedule.afternoon.end)}`;
        }
        if (!label) return { type: 'off', label: 'OFF' };
        return { type: 'work', label };
      }
      // Fallback for single shift date specific
      if (schedule.start && schedule.end && schedule.start !== schedule.end) {
        const startFormatted = formatTime(schedule.start);
        const endFormatted = formatTime(schedule.end);
        return { type: 'work', label: `${startFormatted} -\n${endFormatted}` };
      }
      return { type: 'off', label: 'OFF' };
    }

    // Check base schedule
    const schedule = stylist.workingHours?.[dayName];
    if (schedule) {
      if (schedule.morning || schedule.afternoon) {
        let label = '';
        if (schedule.morning?.start && schedule.morning?.end && schedule.morning.start !== schedule.morning.end) {
          label += `${formatTime(schedule.morning.start)}-${formatTime(schedule.morning.end)}`;
        }
        if (schedule.afternoon?.start && schedule.afternoon?.end && schedule.afternoon.start !== schedule.afternoon.end) {
          if (label) label += '\n';
          label += `${formatTime(schedule.afternoon.start)}-${formatTime(schedule.afternoon.end)}`;
        }
        if (!label) return { type: 'off', label: 'OFF' };
        return { type: 'work', label };
      }
      if (schedule.start && schedule.end && schedule.start !== schedule.end) {
        const startFormatted = formatTime(schedule.start);
        const endFormatted = formatTime(schedule.end);
        return { type: 'work', label: `${startFormatted} -\n${endFormatted}` };
      }
    }
    return { type: 'off', label: 'OFF' };
  };

  const openRosterEdit = (stylistId: number | string, date: string, currentStatus: string) => {
    setSelectedRosterCell({ stylistId, date, currentStatus });
    setLeaveConflictError(null);
    setRosterModalOpen(true);
  };

  const handleRosterUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRosterCell) return;

    setIsSubmitting(true);

    const form = e.target as HTMLFormElement;
    const newStatus = (form.elements.namedItem('status') as HTMLSelectElement).value; // 'work' | 'leave'

    if (newStatus === 'leave') {
      // VALIDATION: Check for appointments
      const conflict = appointments.find(
        apt => {
          // Convert stylistId to string for comparison if needed
          const aptStylistId = typeof apt.stylistId === 'string' ? apt.stylistId : apt.stylistId?.toString();
          const selectedStylistId = selectedRosterCell.stylistId.toString();

          // Extract date from appointment (handle both 'date' and 'startTime' fields)
          let aptDate = '';
          if (apt.date) {
            aptDate = apt.date.split('T')[0]; // Extract YYYY-MM-DD
          } else if (apt.startTime) {
            aptDate = new Date(apt.startTime).toISOString().split('T')[0];
          }

          return aptStylistId === selectedStylistId &&
            aptDate === selectedRosterCell.date &&
            (apt.status === 'CONFIRMED' || apt.status === 'PENDING');
        }
      );

      if (conflict) {
        const time = conflict.time || (conflict.startTime ? new Date(conflict.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'scheduled time');
        const customerName = conflict.customerName || 'A customer';
        setLeaveConflictError(`Cannot set leave. ${customerName} has an appointment at ${time}. Please cancel or reschedule it first.`);
        setIsSubmitting(false); // Reset submitting state
        return;
      }
      // If no conflict, proceed to update roster
    } else {
    }

    // Save roster changes to backend
    try {
      const stylist = stylists.find(s => s.id === selectedRosterCell.stylistId);
      if (stylist) {
        let updatedLeaves = stylist.leaves || [];
        let updatedDateSpecificHours = { ...(stylist.dateSpecificHours || {}) };

        // Get the day name from the date
        const dayName = new Date(selectedRosterCell.date).toLocaleDateString('en-US', { weekday: 'short' });

        if (newStatus === 'leave') {
          if (!updatedLeaves.includes(selectedRosterCell.date)) {
            updatedLeaves = [...updatedLeaves, selectedRosterCell.date];
          }
          // Remove date specific hours if switching to leave
          delete updatedDateSpecificHours[selectedRosterCell.date];
        } else {
          updatedLeaves = updatedLeaves.filter(d => d !== selectedRosterCell.date);

          // Update working hours for this SPECIFIC DATE
          const morningStart = (form.elements.namedItem('morningStart') as HTMLInputElement)?.value;
          const morningEnd = (form.elements.namedItem('morningEnd') as HTMLInputElement)?.value;
          const afternoonStart = (form.elements.namedItem('afternoonStart') as HTMLInputElement)?.value;
          const afternoonEnd = (form.elements.namedItem('afternoonEnd') as HTMLInputElement)?.value;

          updatedDateSpecificHours[selectedRosterCell.date] = {
            morning: (morningStart && morningEnd) ? { start: morningStart, end: morningEnd } : undefined,
            afternoon: (afternoonStart && afternoonEnd) ? { start: afternoonStart, end: afternoonEnd } : undefined
          };
        }

        await api.patch(`/stylists/${selectedRosterCell.stylistId}/roster`, {
          leaves: updatedLeaves,
          dateSpecificHours: updatedDateSpecificHours
        });

        showToast('Roster updated successfully!', 'success');
        // Refresh appointments to ensure data is current
        await fetchAppointments();
        // Refresh stylists to update the roster display
        dispatch(invalidateStylistCache());
        dispatch(fetchStylists(true));
      }
    } catch (error) {
      console.error('Error updating roster:', error);
      showToast('Error saving roster changes', 'error');
    } finally {
      setIsSubmitting(false);
      setRosterModalOpen(false);
    }
  };

  return (
    <div className="space-y-6" style={{ position: 'relative' }}>
      {/* Loading Overlay */}
      {/* Skeleton Loading State */}


      {!stylistsLoading && (
        <>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1.5rem',
            marginBottom: '1.5rem',
            padding: '1.5rem',
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-md)',
            border: '1px solid var(--border-light)'
          }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flex: 1 }}>
              <div style={{
                display: 'flex',
                background: 'var(--bg-body)',
                padding: '0.5rem',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-light)',
                boxShadow: 'var(--shadow-sm)',
                gap: '0.5rem'
              }}>
                <button
                  onClick={() => setViewMode('list')}
                  style={{
                    padding: '0.625rem 1.25rem',
                    borderRadius: '0.625rem',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    background: viewMode === 'list' ? 'white' : 'transparent',
                    color: viewMode === 'list' ? 'var(--primary)' : '#64748b',
                    boxShadow: viewMode === 'list' ? '0 2px 8px rgba(79, 70, 229, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    transform: viewMode === 'list' ? 'translateY(-1px)' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (viewMode !== 'list') {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.5)';
                      e.currentTarget.style.color = '#475569';
                      e.currentTarget.style.transform = 'translateY(-0.5px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (viewMode !== 'list') {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#64748b';
                      e.currentTarget.style.transform = 'none';
                    }
                  }}
                >
                  <span style={{
                    display: 'flex',
                    transition: 'transform 0.3s ease',
                    transform: viewMode === 'list' ? 'scale(1.1)' : 'scale(1)'
                  }}>
                    <span style={{ display: 'flex' }}><MdFormatListBulleted size={16} /></span>
                  </span>
                  List View
                </button>
                <button
                  onClick={() => setViewMode('roaster')}
                  style={{
                    padding: '0.625rem 1.25rem',
                    borderRadius: '0.625rem',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    background: viewMode === 'roaster' ? 'white' : 'transparent',
                    color: viewMode === 'roaster' ? 'var(--primary)' : '#64748b',
                    boxShadow: viewMode === 'roaster' ? '0 2px 8px rgba(79, 70, 229, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    transform: viewMode === 'roaster' ? 'translateY(-1px)' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (viewMode !== 'roaster') {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.5)';
                      e.currentTarget.style.color = '#475569';
                      e.currentTarget.style.transform = 'translateY(-0.5px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (viewMode !== 'roaster') {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#64748b';
                      e.currentTarget.style.transform = 'none';
                    }
                  }}
                >
                  <span style={{
                    display: 'flex',
                    transition: 'transform 0.3s ease',
                    transform: viewMode === 'roaster' ? 'scale(1.1)' : 'scale(1)'
                  }}>
                    <span style={{ display: 'flex' }}><MdCalendarToday size={16} /></span>
                  </span>
                  Weekly Roster
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              {/* Enhanced Search Input */}
              <div className="relative" style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder={appId === 'workly-project' ? "Search staff..." : "Search specialists..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    height: '44px',
                    padding: '0 1rem 0 3rem',
                    borderRadius: 'var(--radius-lg)',
                    border: '1.5px solid var(--border)',
                    fontSize: '0.875rem',
                    width: '280px',
                    background: 'var(--bg-card)',
                    color: 'var(--text-dark)',
                    transition: 'all var(--transition-base)',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(35, 76, 106, 0.1), var(--shadow-md)';
                    e.currentTarget.style.width = '320px';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.width = '280px';
                  }}
                />
                <div style={{
                  position: 'absolute',
                  left: '1rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-light)',
                  display: 'flex',
                  pointerEvents: 'none',
                  zIndex: 1
                }}>
                  <Search size={18} />
                </div>
              </div>

                <Button
                  onClick={() => {
                    setNewStylistImgUrl('');
                    setNewStylistGender('');
                    setNewStylistWorkingHours(INITIAL_WORKING_HOURS);
                    setNewStylistPermissions([]);
                    setIsModalOpen(true);
                  }}
                  icon={<MdAdd size={18} />}
                  disabled={!canAdd}
                  title={!canAdd ? "Ask Admin for permission" : ""}
                  style={{
                    height: '44px',
                    padding: '0 1.5rem',
                    fontWeight: 600,
                    letterSpacing: '0.01em',
                    opacity: !canAdd ? 0.5 : 1,
                    cursor: !canAdd ? 'not-allowed' : 'pointer'
                  }}
                >
                  {appId === 'workly-project' ? 'Add Staff' : 'Add Specialist'}
                </Button>
            </div>
          </div>

          {/* ROSTER VIEW */}
          {viewMode === 'roaster' && (
            <Card className="overflow-hidden p-0" style={{ boxShadow: 'var(--shadow-lg)' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1.5rem',
                borderBottom: '1px solid var(--border-light)',
                background: 'linear-gradient(to bottom, var(--bg-card), var(--bg-hover))'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: 'var(--radius-lg)',
                    background: 'linear-gradient(135deg, var(--primary-light) 0%, rgba(232, 244, 248, 0.6) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--primary)',
                    boxShadow: 'var(--shadow-sm)'
                  }}>
                    <MdCalendarToday size={24} />
                  </div>
                  <div>
                    <h3 style={{
                      fontSize: '1.25rem',
                      fontWeight: 700,
                      margin: 0,
                      color: 'var(--text-dark)',
                      letterSpacing: '-0.025em',
                      marginBottom: '0.25rem'
                    }}>
                      Weekly Roster
                    </h3>
                    {currentWeekDates.length > 0 && (
                      <div style={{
                        fontSize: '0.875rem',
                        color: 'var(--text-black)',
                        fontWeight: 500
                      }}>
                        {new Date(currentWeekDates[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(currentWeekDates[6].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    style={{
                      padding: '0.5rem',
                      minWidth: '44px',
                      height: '44px',
                      borderRadius: 'var(--radius-md)'
                    }}
                    onClick={() => setWeekOffset(prev => prev - 1)}
                  >
                    <MdChevronLeft size={20} />
                  </Button>
                  <Button
                    variant="outline"
                    style={{
                      padding: '0.5rem',
                      minWidth: '44px',
                      height: '44px',
                      borderRadius: 'var(--radius-md)'
                    }}
                    onClick={() => setWeekOffset(prev => prev + 1)}
                  >
                    <MdChevronRight size={20} />
                  </Button>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ minWidth: '800px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '150px' }}>Specialist</th>
                      {currentWeekDates.map(d => {
                        const leaveCount = filteredStylists.filter(s => s.leaves?.includes(d.date)).length;
                        return (
                          <th key={d.date} className="text-center">
                            <div>{d.day}</div>
                            <div style={{ fontSize: '0.7rem', fontWeight: 'normal' }}>{d.date.split('-').slice(1).join('/')}</div>
                            {leaveCount > 0 && (
                              <div style={{
                                fontSize: '0.65rem',
                                color: '#ef4444',
                                background: '#fee2e2',
                                display: 'inline-block',
                                padding: '0.1rem 0.4rem',
                                borderRadius: '0.5rem',
                                marginTop: '0.2rem',
                                fontWeight: 600
                              }}>
                                {leaveCount} Leave{leaveCount > 1 ? 's' : ''}
                              </div>
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {stylistsLoading ? (
                      Array.from({ length: 5 }).map((_, rIdx) => (
                        <tr key={`roster-skeleton-${rIdx}`}>
                          <td style={{ padding: '1rem' }}>
                            <div className="flex items-center gap-2">
                              <Skeleton width="2rem" height="2rem" circle />
                              <Skeleton width="100px" height="1.1rem" />
                            </div>
                          </td>
                          {currentWeekDates.map(d => (
                            <td key={d.date} style={{ padding: '0.75rem' }}>
                              <Skeleton width="100%" height="2.5rem" borderRadius="var(--radius-lg)" />
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : filteredStylists.map(stylist => (
                      <tr key={stylist.id}>
                        <td style={{ fontWeight: 600, padding: '1rem' }}>
                          <div className="flex items-center gap-2">
                            <div style={{
                              width: '2rem',
                              height: '2rem',
                              borderRadius: '50%',
                              backgroundImage: isValidAvatar(stylist.imgUrl) ? `url("${stylist.imgUrl}")` : `url("${(DEFAULT_AVATARS as any)[(stylist.gender || 'other').toLowerCase()] || DEFAULT_AVATARS.other}")`,
                              backgroundColor: 'var(--bg-body)',
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.75rem',
                              fontWeight: 'bold',
                              color: 'var(--primary)'
                            }}>
                              {/* No initials needed as default avatar is always present */}
                            </div>
                            {stylist.name}
                          </div>
                        </td>
                        {currentWeekDates.map(d => {
                          const schedule = getScheduleForDate(stylist, d.day, d.date);
                          const isOff = schedule.type === 'leave' || schedule.type === 'off';

                          return (
                            <td key={d.date} className="text-center" style={{ padding: '0.75rem' }}>
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => openRosterEdit(stylist.id, d.date, schedule.type)}
                                style={{
                                  width: '100%',
                                  padding: '0.75rem 0.5rem',
                                  borderRadius: 'var(--radius-lg)',
                                  border: isOff
                                    ? (schedule.type === 'leave' ? '1.5px solid #FCA5A5' : '1.5px solid #E2E8F0')
                                    : '1.5px solid #A7F3D0',
                                  cursor: 'pointer',
                                  background: isOff
                                    ? (schedule.type === 'leave'
                                      ? 'linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)'
                                      : 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)')
                                    : 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)',
                                  color: isOff ? (schedule.type === 'leave' ? '#B91C1C' : '#64748B') : '#047857',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  whiteSpace: 'pre-line',
                                  transition: 'all var(--transition-base)',
                                  boxShadow: 'var(--shadow-sm)'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                                  e.currentTarget.style.transform = 'translateY(-2px)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                                  e.currentTarget.style.transform = 'translateY(0)';
                                }}
                              >
                                {schedule.label}
                              </motion.button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* CARD VIEW (Existing) */}
          {viewMode === 'list' && (
            <>
              {(() => {
                const totalPages = Math.ceil(filteredStylists.length / itemsPerPage);
                const currentData = filteredStylists.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

                return (
                  <>
                    <div className="grid md-grid-cols-2 lg-grid-cols-3 gap-6">
                      {stylistsLoading ? (
                        Array.from({ length: 6 }).map((_, idx) => (
                          <Card key={`skeleton-${idx}`} style={{ minHeight: '320px', padding: '1.5rem' }}>
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <div style={{ position: 'relative' }}>
                                  <Skeleton width="4rem" height="4rem" circle />
                                  <div style={{ position: 'absolute', bottom: '2px', right: '2px' }}>
                                    <Skeleton width="14px" height="14px" circle />
                                  </div>
                                </div>
                                <div>
                                  <Skeleton width="120px" height="1.25rem" style={{ marginBottom: '0.5rem' }} />
                                  <Skeleton width="80px" height="1.4rem" borderRadius="1rem" />
                                </div>
                              </div>
                              <Skeleton width="32px" height="32px" borderRadius="var(--radius-md)" />
                            </div>
                            <div className="space-y-3 pt-4 border-t border-slate-100 mt-4">
                              <Skeleton height="3.2rem" borderRadius="var(--radius-md)" />
                              <Skeleton height="3.2rem" borderRadius="var(--radius-md)" />
                            </div>
                            <div className="pt-4 border-t border-slate-100 mt-4">
                              <Skeleton width="80px" height="0.7rem" style={{ marginBottom: '0.75rem' }} />
                              <div className="flex gap-2">
                                <Skeleton width="60px" height="1.8rem" borderRadius="1rem" />
                                <Skeleton width="60px" height="1.8rem" borderRadius="1rem" />
                              </div>
                            </div>
                          </Card>
                        ))
                      ) : (
                        currentData.map((stylist, idx) => (
                          <motion.div
                            key={stylist.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            whileHover={{ y: -4, scale: 1.02 }}
                          >
                            <Card style={{
                              minHeight: '320px',
                              display: 'flex',
                              flexDirection: 'column',
                              position: 'relative',
                              overflow: 'hidden',
                              cursor: 'pointer'
                            }}>
                              {/* Decorative gradient accent */}
                              <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                height: '3px',
                                background: stylist.isAvailable
                                  ? 'linear-gradient(90deg, #10B981, #059669)'
                                  : 'linear-gradient(90deg, #EF4444, #DC2626)',
                                zIndex: 1
                              }} />

                              <div className="flex items-start justify-between" style={{ marginTop: '1.25rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                                  <div style={{
                                    width: '4rem',
                                    height: '4rem',
                                    borderRadius: '50%',
                                    backgroundImage: isValidAvatar(stylist.imgUrl) ? `url("${stylist.imgUrl}")` : `url("${(DEFAULT_AVATARS as any)[(stylist.gender || 'other').toLowerCase()] || DEFAULT_AVATARS.other}")`,
                                    backgroundColor: 'var(--bg-body)',
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '2px solid var(--bg-card)',
                                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1), 0 0 0 1px var(--primary-light)',
                                    position: 'relative'
                                  }}>
                                    {/* Status indicator ring */}
                                    <div style={{
                                      position: 'absolute',
                                      bottom: '1px',
                                      right: '1px',
                                      width: '14px',
                                      height: '14px',
                                      borderRadius: '50%',
                                      background: stylist.isAvailable ? '#10B981' : '#EF4444',
                                      border: '2px solid var(--bg-card)',
                                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)'
                                    }} />
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.375rem' }}>
                                      <h3 style={{
                                        fontWeight: 700,
                                        margin: 0,
                                        color: 'var(--text-dark)',
                                        fontSize: '1rem',
                                        letterSpacing: '-0.025em'
                                      }}>
                                        {stylist.name}
                                      </h3>
                                    </div>
                                    <div style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.375rem',
                                      padding: '0.2rem 0.625rem',
                                      borderRadius: 'var(--radius-full)',
                                      background: stylist.isAvailable
                                        ? 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)'
                                        : 'linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)',
                                      width: 'fit-content',
                                      border: `1px solid ${stylist.isAvailable ? '#A7F3D0' : '#FECACA'}`
                                    }}>
                                      <span style={{
                                        width: '6px',
                                        height: '6px',
                                        borderRadius: '50%',
                                        background: stylist.isAvailable ? '#10B981' : '#EF4444',
                                        boxShadow: `0 0 6px ${stylist.isAvailable ? '#10B981' : '#EF4444'}40`
                                      }} />
                                      <span style={{
                                        fontSize: '0.7rem',
                                        fontWeight: 600,
                                        color: stylist.isAvailable ? '#047857' : '#B91C1C'
                                      }}>
                                        {stylist.isAvailable ? 'Active' : 'Inactive'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!canEdit) {
                                          showToast("Ask Admin for permission", "error");
                                          return;
                                      }
                                      const rawSpecs = stylist.specialization
                                        ? (typeof stylist.specialization === 'string' ? stylist.specialization.split(',') : (Array.isArray(stylist.specialization) ? stylist.specialization : [stylist.specialization]))
                                        : [];
                                      const uniqueSpecs = Array.from(new Set(rawSpecs.map((s: string) => s.trim()).filter(Boolean)));

                                      const stylistToEdit = {
                                        ...stylist,
                                        workingHours: stylist.workingHours || {},
                                        permissions: stylist.permissions || [],
                                        specialization: uniqueSpecs.join(', ')
                                      };
                                      setEditingStylist(stylistToEdit);
                                      setIsEditModalOpen(true);
                                    }}
                                    disabled={!canEdit}
                                    style={{
                                      color: 'var(--primary)',
                                      border: 'none',
                                      background: 'var(--primary-light)',
                                      cursor: !canEdit ? 'not-allowed' : 'pointer',
                                      padding: '0.5rem',
                                      borderRadius: 'var(--radius-md)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      transition: 'all var(--transition-base)',
                                      boxShadow: 'var(--shadow-sm)',
                                      opacity: !canEdit ? 0.5 : 1
                                    }}
                                    onMouseEnter={(e) => {
                                      if (canEdit) {
                                        e.currentTarget.style.background = 'var(--primary)';
                                        e.currentTarget.style.color = 'white';
                                        e.currentTarget.style.transform = 'scale(1.1)';
                                        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      if (canEdit) {
                                        e.currentTarget.style.background = 'var(--primary-light)';
                                        e.currentTarget.style.color = 'var(--primary)';
                                        e.currentTarget.style.transform = 'scale(1)';
                                        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                                      }
                                    }}
                                    title={!canEdit ? "Ask Admin for permission" : "Edit Specialist"}
                                  >
                                    <MdEdit size={18} />
                                  </button>
                              </div>

                              <div className="space-y-2" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-light)' }}>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.625rem',
                                  padding: '0.5rem',
                                  background: 'var(--bg-body)',
                                  borderRadius: 'var(--radius-md)',
                                  border: '1px solid var(--border-light)'
                                }}>
                                  <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: 'var(--radius-md)',
                                    background: 'var(--bg-input)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--primary)',
                                    border: '1px solid var(--border)',
                                    flexShrink: 0
                                  }}>
                                    <MdEmail size={14} />
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-light)', marginBottom: '0.125rem' }}>Email</div>
                                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-dark)', fontWeight: 500, wordBreak: 'break-word' }}>
                                      {stylist.email}
                                    </div>
                                  </div>
                                </div>

                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.625rem',
                                  padding: '0.5rem',
                                  background: 'var(--bg-body)',
                                  borderRadius: 'var(--radius-md)',
                                  border: '1px solid var(--border-light)'
                                }}>
                                  <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: 'var(--radius-md)',
                                    background: 'var(--bg-input)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--primary)',
                                    border: '1px solid var(--border)',
                                    flexShrink: 0
                                  }}>
                                    <MdPhone size={14} />
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-light)', marginBottom: '0.125rem' }}>Phone</div>
                                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-dark)', fontWeight: 500 }}>
                                      {stylist.phone}
                                    </div>
                                  </div>
                                  {stylist.gender && (
                                    <span style={{
                                      fontSize: '0.65rem',
                                      padding: '0.25rem 0.625rem',
                                      borderRadius: 'var(--radius-full)',
                                      background: stylist.gender === 'female'
                                        ? 'linear-gradient(135deg, #FDF2F8 0%, #FCE7F3 100%)'
                                        : stylist.gender === 'male'
                                          ? 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)'
                                          : 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)',
                                      color: stylist.gender === 'female' ? '#BE185D' : stylist.gender === 'male' ? '#1D4ED8' : '#64748B',
                                      border: `1px solid ${stylist.gender === 'female' ? '#FBCFE8' : stylist.gender === 'male' ? '#BFDBFE' : '#E2E8F0'}`,
                                      textTransform: 'capitalize',
                                      fontWeight: 600,
                                      whiteSpace: 'nowrap',
                                      boxShadow: 'var(--shadow-sm)'
                                    }}>
                                      {stylist.gender}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {appId !== 'workly-project' && (
                                <div style={{
                                  marginTop: '1rem',
                                  paddingTop: '1rem',
                                  borderTop: '1px solid var(--border-light)'
                                }}>
                                  <div style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 600,
                                    color: 'var(--text-light)',
                                    marginBottom: '0.5rem',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                  }}>
                                    Specializations
                                  </div>
                                  <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                                    {(() => {
                                      const specs = stylist.specialization
                                        ? (typeof stylist.specialization === 'string'
                                          ? stylist.specialization.split(',').map(s => s.trim()).filter(Boolean)
                                          : Array.isArray(stylist.specialization)
                                            ? stylist.specialization
                                            : [stylist.specialization])
                                        : [];

                                      if (specs.length === 0) {
                                        return (
                                          <span style={{
                                            fontSize: '0.7rem',
                                            background: 'var(--bg-body)',
                                            padding: '0.375rem 0.75rem',
                                            borderRadius: 'var(--radius-full)',
                                            color: 'var(--text-black)',
                                            border: '1px solid var(--border)',
                                            fontWeight: 500
                                          }}>
                                            General
                                          </span>
                                        );
                                      }

                                      return specs.map((spec, idx) => (
                                        <motion.span
                                          key={idx}
                                          whileHover={{ scale: 1.05 }}
                                          style={{
                                            fontSize: '0.75rem',
                                            background: 'var(--bg-input)',
                                            padding: '0.5rem 1rem',
                                            borderRadius: 'var(--radius-full)',
                                            color: 'var(--text-dark)',
                                            fontWeight: 600,
                                            border: '1px solid var(--border)',
                                            boxShadow: 'var(--shadow-sm)',
                                            cursor: 'default',
                                            transition: 'all var(--transition-fast)'
                                          }}
                                        >
                                          {spec}
                                        </motion.span>
                                      ));
                                    })()}
                                  </div>
                                </div>
                              )}
                            </Card>
                          </motion.div>
                        )))}
                    </div>

                    {/* Enhanced Pagination Controls */}
                    {filteredStylists.length > 0 && (
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '2rem',
                        padding: '1.5rem',
                        background: 'var(--bg-card)',
                        borderRadius: 'var(--radius-xl)',
                        boxShadow: 'var(--shadow-md)',
                        border: '1px solid var(--border-light)'
                      }}>
                        <div style={{
                          fontSize: '0.875rem',
                          color: 'var(--text-black)',
                          fontWeight: 500
                        }}>
                          Showing <span style={{ fontWeight: 700, color: 'var(--text-dark)' }}>{((currentPage - 1) * itemsPerPage) + 1}</span> to{' '}
                          <span style={{ fontWeight: 700, color: 'var(--text-dark)' }}>{Math.min(currentPage * itemsPerPage, filteredStylists.length)}</span> of{' '}
                          <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{filteredStylists.length}</span> specialists
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '44px',
                              height: '44px',
                              borderRadius: 'var(--radius-md)',
                              border: '1.5px solid var(--border)',
                              background: currentPage === 1 ? 'var(--bg-body)' : 'var(--bg-card)',
                              color: currentPage === 1 ? 'var(--text-light)' : 'var(--text-dark)',
                              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                              transition: 'all var(--transition-base)',
                              boxShadow: currentPage === 1 ? 'none' : 'var(--shadow-sm)'
                            }}
                            onMouseEnter={(e) => {
                              if (currentPage !== 1) {
                                e.currentTarget.style.borderColor = 'var(--primary)';
                                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (currentPage !== 1) {
                                e.currentTarget.style.borderColor = 'var(--border)';
                                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                              }
                            }}
                          >
                            <MdChevronLeft size={20} />
                          </motion.button>
                          <div style={{
                            padding: '0.5rem 1.25rem',
                            background: 'var(--primary-light)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--primary)'
                          }}>
                            <span style={{
                              fontSize: '0.875rem',
                              fontWeight: 700,
                              color: 'var(--primary)'
                            }}>
                              Page {currentPage} of {Math.max(1, totalPages)}
                            </span>
                          </div>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '44px',
                              height: '44px',
                              borderRadius: 'var(--radius-md)',
                              border: '1.5px solid var(--border)',
                              background: currentPage === totalPages ? 'var(--bg-body)' : 'var(--bg-card)',
                              color: currentPage === totalPages ? 'var(--text-light)' : 'var(--text-dark)',
                              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                              transition: 'all var(--transition-base)',
                              boxShadow: currentPage === totalPages ? 'none' : 'var(--shadow-sm)'
                            }}
                            onMouseEnter={(e) => {
                              if (currentPage !== totalPages) {
                                e.currentTarget.style.borderColor = 'var(--primary)';
                                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (currentPage !== totalPages) {
                                e.currentTarget.style.borderColor = 'var(--border)';
                                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                              }
                            }}
                          >
                            <MdChevronRight size={20} />
                          </motion.button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </>
          )}

          {/* CREATE STYLIST MODAL (Existing) */}
          <Modal
            isOpen={isModalOpen}
            onClose={() => { setIsModalOpen(false); }}
            title={appId === 'workly-project' ? 'Add New Staff' : 'Add New Specialist'}
          >
            <form className="space-y-4" onSubmit={handleAddStylist}>
              {/* Circular Avatar Display (Auto-assigned or Uploaded) */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1rem', gap: '0.75rem' }}>
                <input
                  type="file"
                  id="stylist-add-image"
                  ref={fileInputRef}
                  onChange={(e) => handleImageUpload(e, false)}
                  accept="image/*"
                  style={{ display: 'none' }}
                />
                <label
                  htmlFor="stylist-add-image"
                  style={{
                    width: '100px',
                    height: '100px',
                    borderRadius: '50%',
                    backgroundImage: isValidAvatar(newStylistImgUrl) ? `url("${newStylistImgUrl}")` : `url("${(DEFAULT_AVATARS as any)[newStylistGender.toLowerCase()] || DEFAULT_AVATARS.other}")`,
                    backgroundColor: 'var(--bg-body)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '3px solid white',
                    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
                    overflow: 'hidden',
                    position: 'relative',
                    cursor: 'pointer'
                  }}>
                  {isUploading && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <LoadingSpinner size="sm" color="white" />
                    </div>
                  )}
                  {!newStylistImgUrl && !isUploading && (<MdAdd size={40} color="white" />)}
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>Avatar</p>
                  {newStylistImgUrl && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleRemoveImage(false); }}
                      style={{ fontSize: '0.75rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Remove
                    </button>
                  )}
                </div>
                {/* Background Removal Checkbox */}
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="checkbox"
                    id="removeBgAdd"
                    checked={removeBgAddEnabled}
                    onChange={(e) => setRemoveBgAddEnabled(e.target.checked)}
                    style={{ accentColor: 'var(--primary)', width: '14px', height: '14px' }}
                  />
                  <label htmlFor="removeBgAdd" style={{ fontSize: '0.8rem', color: 'var(--text-black)', userSelect: 'none', cursor: 'pointer' }}>
                    Remove background using AI
                  </label>
                </div>
              </div>

              <div className="grid md-grid-cols-3 gap-4">
                <div className="flex flex-col">
                  <Input label="Full Name" placeholder="e.g. Jessica Smith" />
                  {formErrors.name && <span style={{ color: 'red', fontSize: '0.75rem', marginTop: '-0.25rem', marginBottom: '0.5rem', display: 'block' }}>{formErrors.name}</span>}
                </div>
                <div className="flex flex-col">
                  <Select
                    label="Gender"
                    name="gender"
                    value={newStylistGender}
                    onChange={(e) => handleGenderChange(e.target.value, false)}
                    options={[
                      { value: '', label: 'Select gender' },
                      { value: 'male', label: 'Male' },
                      { value: 'female', label: 'Female' },
                      { value: 'other', label: 'Other' }
                    ]}
                  />
                  {formErrors.gender && <span style={{ color: 'red', fontSize: '0.75rem', marginTop: '-0.25rem', marginBottom: '0.5rem', display: 'block' }}>{formErrors.gender}</span>}
                </div>
                <Input label="Email" type="email" placeholder="jessica@lumiere.com" />
              </div>

              <div className="grid md-grid-cols-3 gap-4">
                <div className="flex flex-col">
                  <Input label="Phone" placeholder="(555) 000-0000" />
                  {formErrors.phone && <span style={{ color: 'red', fontSize: '0.75rem', marginTop: '-0.25rem', marginBottom: '0.5rem', display: 'block' }}>{formErrors.phone}</span>}
                </div>
                {appId === 'workly-tailor' && (
                  <Input type="number" name="basicPrice" label="Basic Price" placeholder="0" />
                )}
                <Select
                  label="Account Status"
                  name="accountStatus"
                  defaultValue="active"
                  options={[
                    { value: 'active', label: 'Active' },
                    { value: 'inactive', label: 'Inactive' }
                  ]}
                />
                <Select
                  label="Current Status"
                  options={[
                    { value: 'working', label: 'Working' },
                    { value: 'off', label: 'Off Duty' },
                    { value: 'break', label: 'On Break' }
                  ]}
                />
              </div>

              {appId !== 'workly-project' && (
                <SearchableSelect
                  label="Specialization"
                  name="specialization"
                  placeholder="Select multiple..."
                  multiple
                  dropdownDirection="up"
                  options={[
                    { value: '', label: 'Select Specialization' },
                    ...categories.map(category => ({
                      value: category.name,
                      label: category.name
                    }))
                  ]}
                />
              )}

              <div style={{ paddingTop: '0.5rem' }}>
                <label className="input-label" style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ display: 'flex', color: 'var(--text-black)' }}><MdAccessTime size={16} /></span> Working Hours Configuration
                </label>
                <WorkingHoursConfig
                  value={newStylistWorkingHours}
                  onChange={setNewStylistWorkingHours}
                />
              </div>


              {appId !== 'workly-project' && (!isStaff || isAdmin || isManager) && (
                <div style={{ paddingTop: '1rem' }}>
                  <PermissionsSelector
                    permissions={newStylistPermissions}
                    onChange={setNewStylistPermissions}
                  />
                </div>
              )}

              <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting} isLoading={isSubmitting}>
                  {appId === 'workly-project' ? 'Save Staff' : 'Save Specialist'}
                </Button>
              </div>
            </form>
          </Modal>


          {/* ROSTER EDIT MODAL */}
          <Modal
            isOpen={rosterModalOpen}
            onClose={() => setRosterModalOpen(false)}
            title="Manage Schedule"
          >
            <form onSubmit={handleRosterUpdate}>
              {selectedRosterCell && (
                <div className="space-y-4">
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-black">Stylist</span>
                      <span className="font-semibold">{stylists.find(s => s.id === selectedRosterCell.stylistId)?.name}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-black">Date</span>
                      <span className="font-semibold">{selectedRosterCell.date}</span>
                    </div>
                  </div>

                  <Select
                    label="Availability"
                    name="status"
                    defaultValue={selectedRosterCell.currentStatus === 'work' || selectedRosterCell.currentStatus === 'off' ? 'work' : 'leave'}
                    options={[
                      { value: 'work', label: 'Working' },
                      { value: 'leave', label: 'On Leave / Off' }
                    ]}
                    onChange={() => setLeaveConflictError(null)}
                  />

                  {/* Show time inputs only if Working */}
                  <div className="space-y-4">
                    <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <h5 className="text-xs font-bold text-blue-900 uppercase tracking-wider">Morning Shift</h5>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <Input
                          label="Start Time"
                          type="time"
                          name="morningStart"
                          value={rosterFormState.morningStart}
                          onChange={(e) => setRosterFormState(prev => ({ ...prev, morningStart: e.target.value }))}
                        />
                        <Input
                          label="End Time"
                          type="time"
                          name="morningEnd"
                          value={rosterFormState.morningEnd}
                          onChange={(e) => setRosterFormState(prev => ({ ...prev, morningEnd: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-100">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                        <h5 className="text-xs font-bold text-amber-900 uppercase tracking-wider">Afternoon Shift</h5>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <Input
                          label="Start Time"
                          type="time"
                          name="afternoonStart"
                          value={rosterFormState.afternoonStart}
                          onChange={(e) => setRosterFormState(prev => ({ ...prev, afternoonStart: e.target.value }))}
                        />
                        <Input
                          label="End Time"
                          type="time"
                          name="afternoonEnd"
                          value={rosterFormState.afternoonEnd}
                          onChange={(e) => setRosterFormState(prev => ({ ...prev, afternoonEnd: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>

                  {leaveConflictError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-3 items-start">
                      <span style={{ marginTop: 2, color: '#dc2626', display: 'flex' }}><MdWarning size={18} /></span>
                      <p className="text-sm text-red-700 m-0">{leaveConflictError}</p>
                    </div>
                  )}

                  <div className="flex justify-end pt-4 border-t border-gray-200 gap-3">
                    <Button type="button" variant="ghost" onClick={() => setRosterModalOpen(false)}>Cancel</Button>
                    <Button type="submit" isLoading={isSubmitting}>Save Changes</Button>
                  </div>
                </div>
              )}
            </form>
          </Modal>

          {/* EDIT STYLIST MODAL */}
          <Modal
            isOpen={isEditModalOpen}
            onClose={() => { setIsEditModalOpen(false); setEditingStylist(null); }}
            title="Edit Specialist"
          >
            {editingStylist && (
              <form className="space-y-6" onSubmit={handleEditStylist}>
                {/* Circular Avatar Display (Auto-assigned or Uploaded) */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1rem', gap: '0.75rem' }}>
                  <input
                    type="file"
                    id="stylist-edit-image"
                    ref={editFileInputRef}
                    onChange={(e) => handleImageUpload(e, true)}
                    accept="image/*"
                    style={{ display: 'none' }}
                  />
                  <label
                    htmlFor="stylist-edit-image"
                    style={{
                      width: '100px',
                      height: '100px',
                      borderRadius: '50%',
                      backgroundImage: isValidAvatar(editingStylist.imgUrl) ? `url("${editingStylist.imgUrl}")` : `url("${(DEFAULT_AVATARS as any)[editingStylist.gender?.toLowerCase() || 'male'] || DEFAULT_AVATARS.male}")`,
                      backgroundColor: 'var(--bg-body)',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '3px solid white',
                      boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
                      overflow: 'hidden',
                      position: 'relative',
                      cursor: 'pointer'
                    }}>
                    {isUploading && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <LoadingSpinner size="sm" color="white" />
                      </div>
                    )}
                    {(!editingStylist.imgUrl || editingStylist.imgUrl === 'null' || editingStylist.imgUrl === 'undefined') && !isUploading && (
                      // No initials overlay needed since we have a default illustrated avatar
                      null
                    )}
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>Avatar</p>
                    {editingStylist.imgUrl && editingStylist.imgUrl !== 'null' && editingStylist.imgUrl !== 'undefined' && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleRemoveImage(true); }}
                        style={{ fontSize: '0.75rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  {/* Background Removal Checkbox */}
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="checkbox"
                      id="removeBgEdit"
                      checked={removeBgEditEnabled}
                      onChange={(e) => setRemoveBgEditEnabled(e.target.checked)}
                      style={{ accentColor: 'var(--primary)', width: '14px', height: '14px' }}
                    />
                    <label htmlFor="removeBgEdit" style={{ fontSize: '0.8rem', color: 'var(--text-black)', userSelect: 'none', cursor: 'pointer' }}>
                      Remove background using AI
                    </label>
                  </div>
                </div>

                <div className="grid md-grid-cols-3 gap-4">
                  <Input
                    label="Full Name"
                    placeholder="e.g. Jessica Smith"
                    value={editingStylist.name}
                    onChange={e => setEditingStylist({ ...editingStylist, name: e.target.value })}
                    required
                  />
                  <Select
                    label="Gender"
                    value={editingStylist.gender || ''}
                    onChange={e => handleGenderChange(e.target.value, true)}
                    options={[
                      { value: '', label: 'Select gender' },
                      { value: 'male', label: 'Male' },
                      { value: 'female', label: 'Female' },
                      { value: 'other', label: 'Other' }
                    ]}
                    required
                  />
                  <Input
                    label="Email Address"
                    type="email"
                    placeholder="jessica@example.com"
                    value={editingStylist.email}
                    onChange={e => setEditingStylist({ ...editingStylist, email: e.target.value })}
                    required
                  />
                </div>

                <div className="grid md-grid-cols-3 gap-4">
                  <Input
                    label="Phone Number"
                    placeholder="(555) 000-0000"
                    value={editingStylist.phone || ''}
                    onChange={e => setEditingStylist({ ...editingStylist, phone: e.target.value })}
                    required
                  />
                  {appId === 'workly-tailor' && (
                    <Input
                      type="number"
                      label="Basic Price"
                      name="basicPrice"
                      value={editingStylist.basicPrice || 0}
                      onChange={e => setEditingStylist({ ...editingStylist, basicPrice: parseFloat(e.target.value) || 0 })}
                    />
                  )}
                  <Select
                    label="Account Status"
                    value={editingStylist.isAvailable ? 'active' : 'inactive'}
                    onChange={e => setEditingStylist({ ...editingStylist, isAvailable: e.target.value === 'active' })}
                    options={[
                      { value: 'active', label: 'Active' },
                      { value: 'inactive', label: 'Inactive' }
                    ]}
                  />

                  <Select
                    label="Current Status"
                    value={editingStylist.status || 'working'} // Use status field
                    onChange={e => setEditingStylist({ ...editingStylist, status: e.target.value })}
                    options={[
                      { value: 'working', label: 'Working' },
                      { value: 'off', label: 'Off Duty' },
                      { value: 'break', label: 'On Break' }
                    ]}
                  />
                </div>

                <div>
                  {appId !== 'workly-project' && (
                    <SearchableSelect
                      label="Specialization"
                      name="specialization"
                      value={editingStylist.specialization || ''}
                      onChange={(e) => {
                        setEditingStylist({ ...editingStylist, specialization: e.target.value });
                      }}
                      multiple
                      options={[
                        { value: '', label: 'Select Specialization' },
                        ...categories.map(category => ({
                          value: category.name,
                          label: category.name
                        }))
                      ]}
                    />
                  )}

                  {/* Display selected specializations as tags */}
                  {/* <div style={{ marginTop: '0.75rem' }}>
                <label className="input-label" style={{ fontSize: '0.75rem', marginBottom: '0.5rem', display: 'block', color: 'var(--text-black)' }}>Selected Specializations:</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', minHeight: '2rem', padding: '0.5rem', background: 'var(--bg-body)', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                  {(() => {
                    if (!editingStylist.specialization) {
                      return <span style={{ fontSize: '0.75rem', color: 'var(--text-black)', fontStyle: 'italic' }}>No specializations selected</span>;
                    }

                    const specs = typeof editingStylist.specialization === 'string'
                      ? editingStylist.specialization.split(',').map(s => s.trim()).filter(Boolean)
                      : Array.isArray(editingStylist.specialization)
                        ? editingStylist.specialization
                        : [editingStylist.specialization];

                    if (specs.length === 0) {
                      return <span style={{ fontSize: '0.75rem', color: 'var(--text-black)', fontStyle: 'italic' }}>No specializations selected</span>;
                    }

                    return specs.map((spec, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: '0.75rem',
                          background: 'linear-gradient(135deg, var(--primary-light) 0%, #e0f2fe 100%)',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '1rem',
                          color: 'var(--primary)',
                          fontWeight: 500,
                          border: '1px solid rgba(99, 102, 241, 0.1)',
                          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                        }}
                      >
                        {spec}
                      </span>
                    ));
                  })()}
                </div>
              </div> */}
                </div>

                {/* Working Hours Configuration */}
                {/* Working Hours Configuration */}
                <div style={{ marginTop: '1rem' }}>
                  <label className="input-label" style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ display: 'flex', color: 'var(--text-black)' }}><MdAccessTime size={16} /></span> Working Hours Configuration
                  </label>

                  <WorkingHoursConfig
                    value={editingStylist.workingHours || {}}
                    onChange={(newHours) => setEditingStylist({ ...editingStylist, workingHours: newHours })}
                  />
                </div>

                {appId !== 'workly-project' && (
                  (!isStaff || isAdmin || isManager) && editingStylist.email !== user?.email && editingStylist.authId !== user?.id ? (
                    <div style={{ paddingTop: '1.5rem' }}>
                      <PermissionsSelector
                        permissions={editingStylist.permissions || []}
                        onChange={(newPerms) => setEditingStylist({ ...editingStylist, permissions: newPerms })}
                      />
                    </div>
                  ) : (
                    <div style={{
                      paddingTop: '1.5rem',
                      padding: '1rem',
                      backgroundColor: 'var(--bg-body)',
                      borderRadius: '0.75rem',
                      border: '1px solid var(--border-light)',
                      fontSize: '0.85rem',
                      color: 'var(--text-light)',
                      textAlign: 'center',
                      marginTop: '1rem'
                    }}>
                      🛡️ Access permissions can only be modified by a Supervisor (Administrator or Manager) and self-updating permissions is blocked.
                    </div>
                  )
                )}



                <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <Button type="button" variant="ghost" onClick={() => { setIsEditModalOpen(false); setEditingStylist(null); }}>Cancel</Button>
                  <Button type="submit" isLoading={isSubmitting}>{appId === 'workly-project' ? 'Update Staff' : 'Update Specialist'}</Button>
                </div>
              </form>
            )}
          </Modal>
        </>
      )}

    </div >
  );
};

export default Stylists;


