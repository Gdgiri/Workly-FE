import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useParams, useNavigate, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase, Calendar, Clock, Plus, Users, ClipboardList,
  CheckCircle2, Play, Pause, Square, FileText, CheckCircle,
  AlertCircle, Trash2, Eye, FileDown, ArrowLeft, Camera,
  Upload, Edit, Save, RefreshCw, ChevronDown, ChevronUp, Tags
} from 'lucide-react';
import { Card, KPICard, Button, Input, Select, SearchableSelect, Table, Modal } from '../components/UI';
import { useToast } from '../components/ToastContext';
import { useCurrency } from '../components/CurrencyContext';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Local types
interface Project {
  id: string;
  name: string;
  description: string | null;
  customerId: string;
  adminId: string;
  startDate: string;
  endDate: string | null;
  status: string;
  billingRate: number;
  overtimeRateMultiplier: number;
  standardShiftHours: number;
  customer?: { id: string; name: string };
  _count?: { tasks: number; timeLogs: number };
}

interface ProjectTask {
  id: string;
  projectId: string;
  assignedStaffId: string;
  title: string;
  description: string | null;
  date: string;
  status: string; // PENDING, IN_PROGRESS, COMPLETED
  completedAt: string | null;
  attachments: any;
  remarks: string | null;
  project?: Project;
  staff?: { id: string; name: string };
}

interface ProjectTimeLog {
  id: string;
  projectId: string;
  staffId: string;
  clockIn: string;
  clockOut: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  totalBreakMinutes: number;
  workDate: string;
  regularHours: number;
  overtimeHours: number;
  totalHours: number;
  notes: string | null;
  project: Project;
  staff: { id: string; name: string };
}

const WorklyProject: React.FC = () => {
  const { showToast } = useToast();
  const { symbol, formatPrice } = useCurrency();
  const { isStaff, isAdmin, isManager } = useAuth();
  const isUserAdmin = !isStaff || isAdmin || isManager;
  // @ts-ignore
  const user = useSelector((state) => state.auth.user);
  const { appId, businessName } = useParams<{ appId: string; businessName: string }>();

  // --- STATE ---
  const navigate = useNavigate();
  const location = useLocation();
  const pathParts = location.pathname.split('/');
  const activeTabFromUrl = pathParts[pathParts.length - 1];
  const VALID_TABS = ['overview', 'tasks', 'attendance', 'billing', 'services', 'categories'] as const;
  type ActiveTab = typeof VALID_TABS[number];
  const activeTab: ActiveTab = VALID_TABS.includes(activeTabFromUrl as ActiveTab)
    ? (activeTabFromUrl as ActiveTab)
    : 'overview';

  useEffect(() => {
    if (!VALID_TABS.includes(activeTabFromUrl as ActiveTab)) {
      navigate('overview', { replace: true });
    }
  }, [activeTabFromUrl, navigate]);

  const [projects, setProjects] = useState<Project[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [projectTasks, setProjectTasks] = useState<ProjectTask[]>([]);
  const [timeLogs, setTimeLogs] = useState<ProjectTimeLog[]>([]);
  
  // Loading states
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Modals
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Form states
  const [projectForm, setProjectForm] = useState({
    name: '',
    description: '',
    customerId: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    assignedStaff: [] as {
      staffId: string;
      billingRate: number;
      overtimeRateMultiplier: number;
      standardShiftHours: number;
      enableOvertime: boolean;
    }[]
  });

  const [taskForm, setTaskForm] = useState({
    projectId: '',
    assignedStaffId: '',
    title: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    endDate: ''
  });

  // Billing filter states
  const [selectedBillingProject, setSelectedBillingProject] = useState('');
  const [billingPeriod, setBillingPeriod] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [billingReport, setBillingReport] = useState<any>(null);
  const [loadingBilling, setLoadingBilling] = useState(false);

  // Bill History & Payments States
  const [billHistory, setBillHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<any | null>(null);
  const [expandedBillId, setExpandedBillId] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentMethod: 'Cash',
    transactionId: '',
    notes: ''
  });

  // --- STAFF STATE ---
  const [staffTasks, setStaffTasks] = useState<ProjectTask[]>([]);
  const [activeShift, setActiveShift] = useState<ProjectTimeLog | null>(null);
  const [loadingStaffData, setLoadingStaffData] = useState(false);
  const [clockOutNotes, setClockOutNotes] = useState('');
  const [isClockOutModalOpen, setIsClockOutModalOpen] = useState(false);

  // Proof-of-work completion modal
  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);
  const [taskCompletionRemarks, setTaskCompletionRemarks] = useState('');
  const [proofOfWorkUrl, setProofOfWorkUrl] = useState('');
  const [isTaskCompleteModalOpen, setIsTaskCompleteModalOpen] = useState(false);

  // ── Catalog: Categories & Services state ──────────────────────────
  const [catalogCategories, setCatalogCategories] = useState<any[]>([]);
  const [catalogServices, setCatalogServices] = useState<any[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [isSvcModalOpen, setIsSvcModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<any | null>(null);
  const [editingSvc, setEditingSvc] = useState<any | null>(null);
  const [catForm, setCatForm] = useState({ name: '', description: '', color: '#6366F1' });
  const [svcForm, setSvcForm] = useState({
    name: '', description: '', category: '', price: '', duration: '0', isActive: true
  });

  // Live Timer states
  const [liveDuration, setLiveDuration] = useState('00:00:00');
  const [liveBreak, setLiveBreak] = useState('00:00:00');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // --- REFRESH DATA ---
  const fetchAdminDashboard = async () => {
    setLoadingProjects(true);
    try {
      const [projRes, custRes, staffRes] = await Promise.all([
        api.get('/projects'),
        api.get('/customers'),
        api.get('/stylists') // Specialists / staff table
      ]);
      setProjects(projRes.data);
      setCustomers(custRes.data);
      setStaffList(staffRes.data);

      if (projRes.data.length > 0 && !selectedBillingProject) {
        setSelectedBillingProject(projRes.data[0].id);
      }
    } catch (e: any) {
      showToast(e.response?.data?.error || 'Failed to fetch admin dashboard context', 'error');
    } finally {
      setLoadingProjects(false);
    }
  };

  const fetchCatalog = async () => {
    setLoadingCatalog(true);
    try {
      const [catRes, svcRes] = await Promise.all([
        api.get('/projects/catalog/categories'),
        api.get('/projects/catalog/services')
      ]);
      setCatalogCategories(catRes.data);
      setCatalogServices(svcRes.data);
    } catch (e: any) {
      showToast('Failed to load project catalog', 'error');
    } finally {
      setLoadingCatalog(false);
    }
  };

  const fetchProjectDetails = async (projId: string) => {
    setLoadingDetails(true);
    try {
      const [tasksRes, logsRes] = await Promise.all([
        api.get(`/projects/${projId}/tasks`),
        api.get(`/projects/${projId}`)
      ]);
      setProjectTasks(tasksRes.data);
      if (logsRes.data && logsRes.data.timeLogs) {
        setTimeLogs(logsRes.data.timeLogs);
      }
    } catch (e: any) {
      showToast('Failed to load project details', 'error');
    } finally {
      setLoadingDetails(false);
    }
  };

  const fetchStaffDashboard = async () => {
    setLoadingStaffData(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const [tasksRes, activeShiftRes] = await Promise.all([
        api.get(`/projects/tasks/staff?date=${todayStr}`),
        api.get('/projects/timelogs/active')
      ]);
      setStaffTasks(tasksRes.data);
      setActiveShift(activeShiftRes.data);
    } catch (e: any) {
      showToast('Failed to fetch daily staff work card', 'error');
    } finally {
      setLoadingStaffData(false);
    }
  };

  useEffect(() => {
    if (isUserAdmin) {
      fetchAdminDashboard();
      fetchCatalog();
    } else {
      fetchStaffDashboard();
    }
  }, [isUserAdmin]);

  // Handle active project details fetch
  useEffect(() => {
    if (isUserAdmin && projects.length > 0) {
      // Pick first project details by default or when project list changes
      fetchProjectDetails(projects[0].id);
    }
  }, [projects, isUserAdmin]);

  // Handle billing project change to load history
  useEffect(() => {
    if (selectedBillingProject) {
      fetchBillHistory(selectedBillingProject);
    }
  }, [selectedBillingProject]);

  // Live timer interval for shift on-duty status
  useEffect(() => {
    if (activeShift) {
      timerRef.current = setInterval(() => {
        const now = new Date().getTime();
        const clockInTime = new Date(activeShift.clockIn).getTime();
        
        // Calculate shift duration
        let elapsedMs = now - clockInTime;
        
        // Calculate break duration
        let breakMs = activeShift.totalBreakMinutes * 60000;
        if (activeShift.breakStart && !activeShift.breakEnd) {
          const breakStartTime = new Date(activeShift.breakStart).getTime();
          breakMs += (now - breakStartTime);
        }

        // Net shift hours (minus break time if break is already over)
        // If currently on break, the break continues to increase.
        const formatTimeDiff = (ms: number) => {
          const hours = Math.floor(ms / (1000 * 60 * 60));
          const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
          const secs = Math.floor((ms % (1000 * 60)) / 1000);
          return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        };

        setLiveDuration(formatTimeDiff(Math.max(0, elapsedMs - breakMs)));
        setLiveBreak(formatTimeDiff(breakMs));
      }, 1000);
    } else {
      setLiveDuration('00:00:00');
      setLiveBreak('00:00:00');
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeShift]);

  // --- ACTIONS ---
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingProject) {
        await api.put(`/projects/${editingProject.id}`, projectForm);
        showToast('Project updated successfully', 'success');
      } else {
        await api.post('/projects', projectForm);
        showToast('Project created successfully', 'success');
      }
      setIsProjectModalOpen(false);
      setEditingProject(null);
      fetchAdminDashboard();
    } catch (e: any) {
      showToast(e.response?.data?.error || 'Failed to save project rules', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditProject = (proj: Project) => {
    setEditingProject(proj);
    setProjectForm({
      name: proj.name,
      description: proj.description || '',
      customerId: proj.customerId,
      startDate: proj.startDate.split('T')[0],
      endDate: proj.endDate ? proj.endDate.split('T')[0] : '',
      latitude: proj.latitude?.toString() || '',
      longitude: proj.longitude?.toString() || '',
      geofenceRadius: proj.geofenceRadius?.toString() || '100',
      assignedStaff: (proj as any).staff?.map((s: any) => ({
        staffId: s.staffId,
        billingRate: s.billingRate ?? 0,
        overtimeRateMultiplier: s.overtimeRateMultiplier ?? 1.5,
        standardShiftHours: s.standardShiftHours ?? 8.0,
        enableOvertime: s.enableOvertime ?? true
      })) || []
    });
    setIsProjectModalOpen(true);
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project? All tasks and time logs will be deleted!')) return;
    try {
      await api.delete(`/projects/${id}`);
      showToast('Project deleted successfully', 'success');
      fetchAdminDashboard();
    } catch (e: any) {
      showToast('Failed to delete project', 'error');
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/projects/tasks', taskForm);
      showToast('Daily schedule assigned successfully', 'success');
      setIsTaskModalOpen(false);
      setTaskForm({
        projectId: '',
        assignedStaffId: '',
        title: '',
        description: '',
        date: new Date().toISOString().split('T')[0]
      });
      if (taskForm.projectId) {
        fetchProjectDetails(taskForm.projectId);
      }
    } catch (e: any) {
      showToast(e.response?.data?.error || 'Failed to assign schedule', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTask = async (taskId: string, projId: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return;
    try {
      await api.delete(`/projects/tasks/${taskId}`);
      showToast('Schedule deleted successfully', 'success');
      fetchProjectDetails(projId);
    } catch (e: any) {
      showToast('Failed to delete schedule', 'error');
    }
  };

  // --- CLOCK CONTROLS ---
  const handleClockIn = async (projectId: string) => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser', 'error');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const res = await api.post('/projects/timelogs/clock-in', {
            projectId,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
          setActiveShift(res.data);
          showToast(`Clocked in successfully at ${new Date(res.data.clockIn).toLocaleTimeString()}`, 'success');
          fetchStaffDashboard();
        } catch (e: any) {
          showToast(e.response?.data?.error || 'Failed to clock in', 'error');
        }
      },
      (error) => {
        showToast('Location access denied. Please allow location access to clock into this project.', 'error');
      }
    );
  };

  const handleToggleBreak = async () => {
    if (!activeShift) return;
    const isCurrentlyOnBreak = activeShift.breakStart && !activeShift.breakEnd;
    const endpoint = isCurrentlyOnBreak ? '/projects/timelogs/break-end' : '/projects/timelogs/break-start';
    
    try {
      const res = await api.post(endpoint, { projectId: activeShift.projectId });
      setActiveShift(res.data);
      showToast(isCurrentlyOnBreak ? 'Duty resumed. Break session ended.' : 'On Break. Billable timer paused.', 'info');
    } catch (e: any) {
      showToast(e.response?.data?.error || 'Failed to update break status', 'error');
    }
  };

  const handleClockOut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;

    try {
      const res = await api.post('/projects/timelogs/clock-out', {
        projectId: activeShift.projectId,
        notes: clockOutNotes
      });
      showToast(`Clocked out successfully. Regular: ${res.data.regularHours}h, Overtime: ${res.data.overtimeHours}h`, 'success');
      setActiveShift(null);
      setIsClockOutModalOpen(false);
      setClockOutNotes('');
      fetchStaffDashboard();
    } catch (e: any) {
      showToast(e.response?.data?.error || 'Failed to clock out', 'error');
    }
  };

  // --- TASK COMPLETE (PROOF-OF-WORK) ---
  const handleOpenTaskComplete = (task: ProjectTask) => {
    setSelectedTask(task);
    setTaskCompletionRemarks('');
    setProofOfWorkUrl('');
    setIsTaskCompleteModalOpen(true);
  };

  const handleCompleteTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;

    try {
      await api.patch(`/projects/tasks/${selectedTask.id}/complete`, {
        remarks: taskCompletionRemarks,
        attachments: proofOfWorkUrl ? [proofOfWorkUrl] : []
      });
      showToast('Task marked complete with proof-of-work', 'success');
      setIsTaskCompleteModalOpen(false);
      setSelectedTask(null);
      fetchStaffDashboard();
    } catch (e: any) {
      showToast('Failed to complete task', 'error');
    }
  };

  // Simulate Cloudinary upload for Proof of Work
  const handleSimulateUpload = () => {
    const mockUrls = [
      'https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&w=500&q=80',
      'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=500&q=80',
      'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&w=500&q=80'
    ];
    const randomUrl = mockUrls[Math.floor(Math.random() * mockUrls.length)];
    setProofOfWorkUrl(randomUrl);
    showToast('Proof of work photo uploaded successfully', 'success');
  };

  // --- REPORT GENERATION ---
  const fetchBillingReport = async () => {
    if (!selectedBillingProject) {
      showToast('Please select a project', 'error');
      return;
    }
    setLoadingBilling(true);
    try {
      const res = await api.get(`/projects/${selectedBillingProject}/reports/manpower?startDate=${billingPeriod.startDate}&endDate=${billingPeriod.endDate}`);
      setBillingReport(res.data);
    } catch (e: any) {
      showToast('Failed to compile billing report', 'error');
    } finally {
      setLoadingBilling(false);
    }
  };

  const handleDownloadInvoicePDF = () => {
    if (!billingReport) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    
    // Brand header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(35, 76, 106); // Workly signature dark blue color
    doc.text(user?.businessName?.toUpperCase() || 'WORKLY MANPOWER SUPPLY', 14, 25);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Email: ${user?.email || 'billing@workly.com'}`, 14, 32);
    doc.text(`Phone: ${user?.businessPhone || 'N/A'}`, 14, 37);

    // Bill title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('MANPOWER INVOICE / REPORT', pageWidth - 14, 25, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Billing Period: ${new Date(billingReport.startDate).toLocaleDateString()} - ${new Date(billingReport.endDate).toLocaleDateString()}`, pageWidth - 14, 32, { align: 'right' });
    doc.text(`Generated At: ${new Date().toLocaleDateString()}`, pageWidth - 14, 37, { align: 'right' });

    // Dividers
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 45, pageWidth - 14, 45);

    // Client Info
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('CLIENT DETAILS:', 14, 55);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(billingReport.project?.customer?.name || 'Client Name', 14, 62);
    doc.setFontSize(10);
    doc.text(`Project Name: ${billingReport.project?.name}`, 14, 68);
    doc.text(`Rate Config: ${symbol}${billingReport.project?.billingRate}/hr (OT Multiplier: ${billingReport.project?.overtimeRateMultiplier}x)`, 14, 73);

    // Main summary card in PDF
    doc.setFillColor(248, 250, 252);
    doc.rect(pageWidth - 95, 52, 81, 26, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('BILLING SUMMARY', pageWidth - 90, 58);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Shifts Worked: ${billingReport.summary?.totalShifts}`, pageWidth - 90, 64);
    doc.text(`Net Shift Hours: ${billingReport.summary?.totalHours}h`, pageWidth - 90, 69);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL BILL DUE: ${formatPrice(billingReport.summary?.totalBilling)}`, pageWidth - 90, 74);

    // Table dataset
    const tableData = billingReport.staffReportList.map((item: any) => [
      item.staffName,
      item.shiftsCount,
      `${item.totalBreakMinutes} mins`,
      `${item.totalRegularHours} hrs`,
      `${item.totalOvertimeHours} hrs`,
      `${item.totalHours} hrs`,
      `${symbol}${item.totalBilling.toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 85,
      head: [['Staff Name', 'Shifts', 'Breaks', 'Regular Hours', 'Overtime Hours', 'Total Hours', 'Billing Amount']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [35, 76, 106],
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 9,
        cellPadding: 4,
        textColor: [30, 41, 59]
      },
      columnStyles: {
        0: { cellWidth: 'auto', halign: 'left' },
        1: { halign: 'center' },
        2: { halign: 'center' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right', fontStyle: 'bold' }
      }
    });

    // Sub-table for tasks completion summary
    const taskStartY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('DAILY COMPLETED SCHEDULES LOG', 14, taskStartY);

    const completedTasksData = billingReport.tasks
      .filter((t: any) => t.status === 'COMPLETED')
      .map((t: any) => [
        new Date(t.date).toLocaleDateString(),
        t.title,
        t.staff?.name || 'N/A',
        t.remarks || 'None',
        t.attachments && t.attachments.length > 0 ? 'Verified' : 'No photo'
      ]);

    autoTable(doc, {
      startY: taskStartY + 5,
      head: [['Date', 'Task Title', 'Completed By', 'Remarks/Notes', 'Proof of Work']],
      body: completedTasksData.length > 0 ? completedTasksData : [['-', 'No completed schedules found in this period', '-', '-', '-']],
      theme: 'grid',
      headStyles: {
        fillColor: [71, 85, 105],
        textColor: [255, 255, 255],
        fontSize: 9
      },
      styles: {
        fontSize: 8,
        cellPadding: 3
      }
    });

    // PDF Footer
    const footerY = doc.internal.pageSize.height - 20;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text('Thank you for choosing Workly Manpower Supply Services!', pageWidth / 2, footerY, { align: 'center' });
    doc.text('This invoice represents net working hours after break deductions.', pageWidth / 2, footerY + 5, { align: 'center' });

    doc.save(`Manpower_Bill_${billingReport.project?.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
    showToast('Manpower Invoicing PDF downloaded', 'success');
  };

  // --- BILL HISTORY & RECORD PAYMENTS ---
  const fetchBillHistory = async (projId: string) => {
    if (!projId) return;
    setLoadingHistory(true);
    try {
      const res = await api.get(`/projects/${projId}/bills`);
      setBillHistory(res.data);
    } catch (e: any) {
      showToast('Failed to load bill history', 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleUpdateStaffReport = (staffId: string, field: string, value: string) => {
    setBillingReport((prev: any) => {
      if (!prev) return prev;
      const numValue = parseFloat(value) || 0;
      
      const newStaffList = prev.staffReportList.map((item: any) => {
        if (item.staffId === staffId) {
          const newItem = { ...item, [field]: numValue };
          if (field === 'totalRegularHours' || field === 'totalOvertimeHours') {
              newItem.totalHours = newItem.totalRegularHours + newItem.totalOvertimeHours;
              const rate = prev.project?.billingRate || 0;
              const otRate = rate * (prev.project?.overtimeRateMultiplier || 1.5);
              newItem.totalBilling = (newItem.totalRegularHours * rate) + (newItem.totalOvertimeHours * otRate);
          }
          return newItem;
        }
        return item;
      });

      const newTotalRegular = newStaffList.reduce((sum: number, item: any) => sum + item.totalRegularHours, 0);
      const newTotalOvertime = newStaffList.reduce((sum: number, item: any) => sum + item.totalOvertimeHours, 0);
      const newTotalBilling = newStaffList.reduce((sum: number, item: any) => sum + item.totalBilling, 0);

      return {
        ...prev,
        staffReportList: newStaffList,
        summary: {
          ...prev.summary,
          totalRegularHours: newTotalRegular,
          totalOvertimeHours: newTotalOvertime,
          totalBilling: newTotalBilling
        }
      };
    });
  };

  const handleRecordBill = async () => {
    if (!billingReport || !selectedBillingProject) return;
    setSubmitting(true);
    try {
      await api.post(`/projects/${selectedBillingProject}/bills`, {
        startDate: billingPeriod.startDate,
        endDate: billingPeriod.endDate,
        notes: `Manpower bill for ${billingReport.project.name} (${billingPeriod.startDate} to ${billingPeriod.endDate})`,
        customTotalAmount: billingReport.summary.totalBilling,
        customItems: billingReport.staffReportList.map((item: any) => ({
           type: 'service',
           itemId: selectedBillingProject,
           name: `${item.staffName} (${item.totalRegularHours}h Reg, ${item.totalOvertimeHours}h OT)`,
           quantity: 1,
           price: item.totalBilling,
           discount: 0
        }))
      });
      showToast('Manpower bill recorded successfully in transactions!', 'success');
      fetchBillHistory(selectedBillingProject);
    } catch (e: any) {
      showToast(e.response?.data?.error || 'Failed to record bill', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBill) return;
    setSubmitting(true);
    try {
      await api.post(`/sales/${selectedBill.id}/payments`, {
        amount: parseFloat(paymentForm.amount),
        paymentMethod: paymentForm.paymentMethod,
        transactionId: paymentForm.transactionId,
        notes: paymentForm.notes
      });
      showToast('Payment recorded successfully against bill!', 'success');
      setIsPaymentModalOpen(false);
      setSelectedBill(null);
      setPaymentForm({
        amount: '',
        paymentMethod: 'Cash',
        transactionId: '',
        notes: ''
      });
      if (selectedBillingProject) {
        fetchBillHistory(selectedBillingProject);
      }
    } catch (e: any) {
      showToast(e.response?.data?.error || 'Failed to record payment', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadHistoricalInvoicePDF = (bill: any) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    
    // Brand header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(35, 76, 106);
    doc.text(user?.businessName?.toUpperCase() || 'WORKLY MANPOWER SUPPLY', 14, 25);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Email: ${user?.email || 'billing@workly.com'}`, 14, 32);
    doc.text(`Phone: ${user?.businessPhone || 'N/A'}`, 14, 37);

    // Bill title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('INVOICE / BILL DETAILS', pageWidth - 14, 25, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Invoice No: ${bill.saleNumber}`, pageWidth - 14, 32, { align: 'right' });
    doc.text(`Date: ${new Date(bill.createdAt).toLocaleDateString()}`, pageWidth - 14, 37, { align: 'right' });

    // Dividers
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 45, pageWidth - 14, 45);

    // Client Info
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('CLIENT DETAILS:', 14, 55);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(bill.customer?.name || 'Client Name', 14, 62);
    doc.setFontSize(10);
    doc.text(`Billing Description: ${bill.notes || 'Manpower Supply Contract'}`, 14, 68);

    // Summary Box
    doc.setFillColor(248, 250, 252);
    doc.rect(pageWidth - 95, 52, 81, 30, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('INVOICE SUMMARY', pageWidth - 90, 58);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Bill Amount: ${formatPrice(bill.totalAmount)}`, pageWidth - 90, 64);
    doc.text(`Total Amount Paid: ${formatPrice(bill.paidAmount)}`, pageWidth - 90, 69);
    doc.setFont('helvetica', 'bold');
    doc.text(`BALANCE DUE: ${formatPrice(bill.balanceAmount)}`, pageWidth - 90, 75);

    // Items table
    let itemsArray: any[] = [];
    if (typeof bill.items === 'string') {
      try {
        itemsArray = JSON.parse(bill.items);
      } catch (e) {}
    } else if (Array.isArray(bill.items)) {
      itemsArray = bill.items;
    }

    const tableData = itemsArray.map((item: any) => [
      item.name || 'Manpower Supply Services',
      item.quantity || 1,
      `${symbol}${item.price.toFixed(2)}`,
      `${symbol}${item.price.toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 88,
      head: [['Description', 'Qty', 'Unit Price', 'Total']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [35, 76, 106],
        textColor: [255, 255, 255]
      }
    });

    // Payments Log table
    const payStartY = (doc as any).lastAutoTable.finalY + 12;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('TRANSACTION LOG / PAYMENTS RECEIVED', 14, payStartY);

    const paymentsData = (bill.payments || []).map((p: any) => [
      new Date(p.createdAt).toLocaleDateString(),
      p.invoiceNumber || p.id.slice(0, 8),
      p.paymentMethod,
      p.transactionId || 'N/A',
      `${symbol}${p.amount.toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: payStartY + 5,
      head: [['Date', 'Transaction Receipt No', 'Method', 'Ref Transaction ID', 'Amount Received']],
      body: paymentsData.length > 0 ? paymentsData : [['-', 'No payments recorded yet', '-', '-', '-']],
      theme: 'grid',
      headStyles: {
        fillColor: [71, 85, 105],
        textColor: [255, 255, 255]
      }
    });

    // Footer
    const footerY = doc.internal.pageSize.height - 20;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text('Thank you for choosing Workly Manpower Supply Services!', pageWidth / 2, footerY, { align: 'center' });

    doc.save(`Invoice_${bill.saleNumber}.pdf`);
    showToast('Historical Invoicing PDF downloaded', 'success');
  };

  // --- RENDER ADMIN INTERFACE ---
  const renderAdminView = () => {
    return (
      <div className="space-y-6">

        {/* Tab content */}
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* KPI Summary Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', width: '100%', marginBottom: '1.5rem' }}>
                <div className="flex-1 min-w-0">
                  <KPICard
                    title="Active Projects"
                    value={projects.length}
                    icon={Briefcase}
                    color="#3B82F6"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <KPICard
                    title="Total Headcount"
                    value={staffList.length}
                    icon={Users}
                    color="#10B981"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <KPICard
                    title="Total Schedules Completed"
                    value={projectTasks.filter(t => t.status === 'COMPLETED').length}
                    icon={ClipboardList}
                    color="#EC4899"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <KPICard
                    title="Projected Billing"
                    value={formatPrice(timeLogs.reduce((sum, log) => {
                      const billingRate = log.project?.billingRate || 0;
                      const otMultiplier = log.project?.overtimeRateMultiplier || 1.5;
                      const regBill = log.regularHours * billingRate;
                      const otBill = log.overtimeHours * (billingRate * otMultiplier);
                      return sum + regBill + otBill;
                    }, 0))}
                    icon={Clock}
                    color="#8B5CF6"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800">Manpower Projects</h2>
                <Button onClick={() => {
                  setEditingProject(null);
                  setProjectForm({
                    name: '',
                    description: '',
                    customerId: customers[0]?.id || '',
                    startDate: new Date().toISOString().split('T')[0],
                    endDate: '',
                    billingRate: '0',
                    overtimeRateMultiplier: '1.5',
                    standardShiftHours: '8.0',
                    latitude: '',
                    longitude: '',
                    geofenceRadius: '100',
                    assignedStaffIds: [] as string[]
                  });
                  setIsProjectModalOpen(true);
                }} icon={<Plus size={16} />}>
                  Create Project
                </Button>
              </div>

              {loadingProjects ? (
                <div>Loading projects...</div>
              ) : projects.length === 0 ? (
                <Card>
                  <div className="text-center py-8 text-gray-500">
                    <Briefcase size={48} className="mx-auto mb-3 opacity-30" />
                    <p>No manpower supply projects created yet.</p>
                  </div>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {projects.map((proj) => (
                    <motion.div
                      whileHover={{ y: -4, scale: 1.01 }}
                      transition={{ duration: 0.2 }}
                      key={proj.id}
                      className="relative overflow-hidden bg-white rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col group"
                    >
                      {/* Abstract Background Element */}
                      <div className="absolute -right-8 -top-8 w-32 h-32 bg-gradient-to-br from-blue-50 to-indigo-50/50 rounded-full blur-2xl opacity-70 group-hover:opacity-100 transition-opacity"></div>
                      <div className="absolute top-6 right-6 opacity-[0.03] pointer-events-none group-hover:opacity-[0.06] transition-opacity transform group-hover:scale-110 duration-500">
                        <Briefcase size={80} />
                      </div>

                      <div className="p-6 flex-1 flex flex-col z-10 relative">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-xl font-extrabold text-slate-800 tracking-tight leading-tight group-hover:text-blue-700 transition-colors">
                            {proj.name}
                          </h3>
                        </div>
                        <p className="text-sm text-slate-500 mb-6 flex-1 line-clamp-2 leading-relaxed">
                          {proj.description || 'No description provided.'}
                        </p>

                        <div className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100/50 mt-auto">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Client</span>
                            <span className="text-sm text-slate-900 font-bold">{proj.customer?.name || 'Unknown'}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rate</span>
                            <span className="text-sm text-blue-700 font-extrabold bg-blue-50 px-2 py-0.5 rounded-lg">{symbol}{proj.billingRate}/hr</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Shift</span>
                            <span className="text-sm text-slate-700 font-medium">{proj.standardShiftHours} hrs ({proj.overtimeRateMultiplier}x OT)</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</span>
                            <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black tracking-widest uppercase ${
                              proj.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800 shadow-sm shadow-emerald-100' : 'bg-slate-100 text-slate-600'
                            }`}>{proj.status}</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex justify-end gap-2 relative z-10">
                        <Button 
                          variant="secondary" 
                          className="!bg-white !shadow-sm hover:!bg-slate-50 !text-slate-700 !border-slate-200"
                          onClick={() => handleEditProject(proj)} 
                          icon={<Edit size={14} />}
                        >
                          Edit
                        </Button>
                        <Button 
                          variant="danger" 
                          className="!bg-red-50 !text-red-700 hover:!bg-red-100 !border-transparent"
                          onClick={() => handleDeleteProject(proj.id)} 
                          icon={<Trash2 size={14} />}
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'tasks' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-bold text-gray-800">Staff Schedules</h2>
                  <select
                    onChange={(e) => fetchProjectDetails(e.target.value)}
                    className="form-control"
                    style={{ width: '200px', height: '38px', padding: '0 10px' }}
                  >
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <Button onClick={() => {
                  setTaskForm({
                    projectId: projects[0]?.id || '',
                    assignedStaffId: staffList[0]?.id || '',
                    title: '',
                    description: '',
                    date: new Date().toISOString().split('T')[0]
                  });
                  setIsTaskModalOpen(true);
                }} icon={<Plus size={16} />}>
                  Add Schedule
                </Button>
              </div>

              {loadingDetails ? (
                <div>Loading schedules...</div>
              ) : projectTasks.length === 0 ? (
                <Card>
                  <div className="text-center py-8 text-gray-500">
                    <ClipboardList size={48} className="mx-auto mb-3 opacity-30" />
                    <p>No schedules assigned for this project yet.</p>
                  </div>
                </Card>
              ) : (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Schedule Title</th>
                        <th>Assigned Staff</th>
                        <th>Status</th>
                        <th>Remarks / Proof</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projectTasks.map((task) => (
                        <tr key={task.id}>
                          <td>{new Date(task.date).toLocaleDateString()}</td>
                          <td>
                            <div className="font-semibold">{task.title}</div>
                            <div className="text-xs text-gray-500">{task.description}</div>
                          </td>
                          <td>{task.staff?.name || 'N/A'}</td>
                          <td>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              task.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                            }`}>{task.status}</span>
                          </td>
                          <td>
                            {task.status === 'COMPLETED' ? (
                              <div className="text-xs space-y-1">
                                <p className="font-medium text-gray-700">{task.remarks || 'No remarks.'}</p>
                                {task.attachments && task.attachments.length > 0 && (
                                  <a href={task.attachments[0]} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                                    <Eye size={12} /> View Photo Proof
                                  </a>
                                )}
                              </div>
                            ) : '-'}
                          </td>
                          <td>
                            <Button variant="danger" onClick={() => handleDeleteTask(task.id, task.projectId)} icon={<Trash2 size={12} />} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'attendance' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold text-gray-800">Shift Clocks Monitor</h2>
                <select
                  onChange={(e) => fetchProjectDetails(e.target.value)}
                  className="form-control"
                  style={{ width: '200px', height: '38px', padding: '0 10px' }}
                >
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {loadingDetails ? (
                <div>Loading shift logs...</div>
              ) : timeLogs.length === 0 ? (
                <Card>
                  <div className="text-center py-8 text-gray-500">
                    <Clock size={48} className="mx-auto mb-3 opacity-30" />
                    <p>No shifts recorded for this project yet.</p>
                  </div>
                </Card>
              ) : (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Staff Name</th>
                        <th>Clock In</th>
                        <th>Clock Out</th>
                        <th>Breaks (Deducted)</th>
                        <th>Billable Hours</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {timeLogs.map((log) => (
                        <tr key={log.id}>
                          <td>{new Date(log.workDate).toLocaleDateString()}</td>
                          <td className="font-semibold">{log.staff?.name || 'N/A'}</td>
                          <td>{new Date(log.clockIn).toLocaleTimeString()}</td>
                          <td>{log.clockOut ? new Date(log.clockOut).toLocaleTimeString() : <span className="text-green-600 font-bold animate-pulse">ON DUTY</span>}</td>
                          <td>{log.totalBreakMinutes.toFixed(1)} mins</td>
                          <td>
                            {log.clockOut ? (
                              <div className="text-xs">
                                <div><span className="font-bold">Total:</span> {log.totalHours} hrs</div>
                                <div><span className="text-gray-500">Reg:</span> {log.regularHours}h | <span className="text-gray-500">OT:</span> {log.overtimeHours}h</div>
                              </div>
                            ) : '-'}
                          </td>
                          <td className="text-xs max-w-xs truncate" title={log.notes || ''}>{log.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'billing' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="space-y-6"
            >
              <Card className="mb-6 shadow-sm border border-gray-100">
                <div className="p-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', alignItems: 'end' }}>
                  <div className="space-y-2" style={{ gridColumn: 'span 2' }}>
                  <label className="text-xs font-bold text-gray-700 uppercase">Select Project</label>
                  <SearchableSelect
                    value={selectedBillingProject}
                    onChange={(e: any) => setSelectedBillingProject(e.target.value)}
                    options={projects.map(p => ({ value: p.id, label: p.name }))}
                    placeholder="Choose a project..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-700 uppercase">Start Date</label>
                  <input
                    type="date"
                    value={billingPeriod.startDate}
                    onChange={(e) => setBillingPeriod(prev => ({ ...prev, startDate: e.target.value }))}
                    className="form-control"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-700 uppercase">End Date</label>
                  <input
                    type="date"
                    value={billingPeriod.endDate}
                    onChange={(e) => setBillingPeriod(prev => ({ ...prev, endDate: e.target.value }))}
                    className="form-control"
                  />
                </div>
                <Button onClick={fetchBillingReport} disabled={loadingBilling} icon={<RefreshCw size={16} />}>
                  {loadingBilling ? 'Compiling...' : 'Calculate bill'}
                </Button>
                </div>
              </Card>

              {billingReport && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-6"
                >
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-800">Manpower Supply Billing Invoice</h3>
                    <div className="flex gap-2">
                      <Button onClick={handleRecordBill} isLoading={submitting} icon={<Save size={16} />}>
                        Save Bill / Record Invoice
                      </Button>
                      <Button onClick={handleDownloadInvoicePDF} variant="outline" icon={<FileDown size={16} />}>
                        Download Billing PDF
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
                    <div>
                      <div className="text-xs text-blue-800 font-bold uppercase tracking-wider">Total Shift Clocks</div>
                      <div className="text-2xl font-bold mt-1 text-blue-900">{billingReport.summary.totalShifts} shifts</div>
                    </div>
                    <div>
                      <div className="text-xs text-blue-800 font-bold uppercase tracking-wider">Regular Shift Hours</div>
                      <div className="text-2xl font-bold mt-1 text-blue-900">{billingReport.summary.totalRegularHours} hrs</div>
                    </div>
                    <div>
                      <div className="text-xs text-blue-800 font-bold uppercase tracking-wider">Overtime Shift Hours</div>
                      <div className="text-2xl font-bold mt-1 text-blue-900">{billingReport.summary.totalOvertimeHours} hrs</div>
                    </div>
                    <div>
                      <div className="text-xs text-blue-800 font-bold uppercase tracking-wider">Total Due Bill Amount</div>
                      <div className="text-2xl font-extrabold mt-1 text-green-700">{formatPrice(billingReport.summary.totalBilling)}</div>
                    </div>
                  </div>

                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Staff Name</th>
                          <th>Shifts Count</th>
                          <th>Total Break Time</th>
                          <th>Regular Hours</th>
                          <th>Overtime Hours</th>
                          <th>Total Hours</th>
                          <th>Total Billing</th>
                        </tr>
                      </thead>
                      <tbody>
                        {billingReport.staffReportList.map((item: any) => (
                          <tr key={item.staffId}>
                            <td className="font-semibold">{item.staffName}</td>
                            <td>{item.shiftsCount}</td>
                            <td>{item.totalBreakMinutes} mins</td>
                            <td>
                              <input 
                                type="number" 
                                step="0.5"
                                className="w-16 px-1 py-0.5 border border-gray-300 rounded text-sm bg-white" 
                                value={item.totalRegularHours} 
                                onChange={(e) => handleUpdateStaffReport(item.staffId, 'totalRegularHours', e.target.value)} 
                              /> hrs
                            </td>
                            <td>
                              <input 
                                type="number" 
                                step="0.5"
                                className="w-16 px-1 py-0.5 border border-gray-300 rounded text-sm bg-white" 
                                value={item.totalOvertimeHours} 
                                onChange={(e) => handleUpdateStaffReport(item.staffId, 'totalOvertimeHours', e.target.value)} 
                              /> hrs
                            </td>
                            <td>{item.totalHours} hrs</td>
                            <td className="font-bold text-green-700">
                              <div className="flex items-center gap-1">
                                <span>{formatPrice(0).replace(/[0-9.,]/g, '')}</span>
                                <input 
                                  type="number" 
                                  step="0.01"
                                  className="w-20 px-1 py-0.5 border border-gray-300 rounded text-sm bg-white font-bold text-green-700" 
                                  value={item.totalBilling} 
                                  onChange={(e) => handleUpdateStaffReport(item.staffId, 'totalBilling', e.target.value)} 
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}

              {/* Bill History Section */}
              <div className="mt-8 space-y-4 pt-6 border-t border-gray-150">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <FileText className="text-blue-600" size={20} />
                  Bill & Invoice History
                </h3>

                {loadingHistory ? (
                  <div className="text-sm text-gray-500">Loading bill history...</div>
                ) : billHistory.length === 0 ? (
                  <Card>
                    <div className="text-center py-6 text-gray-500">
                      <FileText size={40} className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No recorded invoices found for this project location.</p>
                    </div>
                  </Card>
                ) : (
                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Bill Number</th>
                          <th>Billing Period & Notes</th>
                          <th>Total Amount</th>
                          <th>Paid</th>
                          <th>Balance</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {billHistory.map((bill) => (
                          <React.Fragment key={bill.id}>
                            <tr>
                              <td className="font-bold text-blue-900">
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => setExpandedBillId(expandedBillId === bill.id ? null : bill.id)}
                                    className="text-gray-500 hover:text-blue-600 transition-colors p-1"
                                    title="Toggle payment transactions"
                                  >
                                    {expandedBillId === bill.id ? (
                                      <ChevronUp size={14} />
                                    ) : (
                                      <ChevronDown size={14} />
                                    )}
                                  </button>
                                  {bill.saleNumber}
                                </div>
                              </td>
                              <td className="text-xs max-w-xs">{bill.notes || '-'}</td>
                              <td className="font-semibold">{formatPrice(bill.totalAmount)}</td>
                              <td className="text-green-600 font-semibold">{formatPrice(bill.paidAmount)}</td>
                              <td className={bill.balanceAmount > 0 ? "text-red-500 font-semibold animate-pulse" : "text-gray-500"}>
                                {formatPrice(bill.balanceAmount)}
                              </td>
                              <td>
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                  bill.paymentStatus === 'PAID'
                                    ? 'bg-green-100 text-green-800'
                                    : bill.paymentStatus === 'PARTIAL'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-red-100 text-red-800'
                                }`}>{bill.paymentStatus}</span>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <div className="flex gap-2 justify-end">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDownloadHistoricalInvoicePDF(bill)}
                                    icon={<FileDown size={12} />}
                                    title="Download invoice PDF"
                                  />
                                  {bill.balanceAmount > 0 && (
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        setSelectedBill(bill);
                                        setPaymentForm({
                                          amount: bill.balanceAmount.toString(),
                                          paymentMethod: 'Cash',
                                          transactionId: '',
                                          notes: ''
                                        });
                                        setIsPaymentModalOpen(true);
                                      }}
                                      icon={<Clock size={12} />}
                                    >
                                      Record Payment
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                            {expandedBillId === bill.id && (
                              <tr className="bg-slate-50/50">
                                <td colSpan={7} className="p-4 border-t border-b border-gray-150">
                                  <div className="space-y-3 pl-8 pr-4 py-2">
                                    <div className="flex justify-between items-center">
                                      <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                                        <Clock size={14} className="text-blue-500" />
                                        Associated Payment Transactions
                                      </h4>
                                      <span className="text-xs text-gray-500">
                                        Total Received: <span className="font-semibold text-green-600">{formatPrice(bill.paidAmount)}</span>
                                      </span>
                                    </div>
                                    
                                    {(!bill.payments || bill.payments.length === 0) ? (
                                      <div className="text-xs text-gray-500 py-3 text-center bg-white rounded-lg border border-dashed border-gray-200">
                                        No payments/transactions recorded for this bill yet.
                                      </div>
                                    ) : (
                                      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                                        <table className="min-w-full divide-y divide-gray-100 text-xs text-left">
                                          <thead className="bg-slate-100/80 text-gray-700 font-semibold uppercase tracking-wider text-[10px]">
                                            <tr>
                                              <th className="p-3">Date & Time</th>
                                              <th className="p-3">Receipt / ID</th>
                                              <th className="p-3">Payment Method</th>
                                              <th className="p-3">Reference Tx ID</th>
                                              <th className="p-3">Amount</th>
                                              <th className="p-3">Notes</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-gray-100 text-gray-600">
                                            {bill.payments.map((p: any) => (
                                              <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="p-3 whitespace-nowrap">
                                                  {new Date(p.createdAt).toLocaleDateString()} {new Date(p.createdAt).toLocaleTimeString()}
                                                </td>
                                                <td className="p-3 font-mono text-gray-800 whitespace-nowrap">
                                                  {p.invoiceNumber || p.id.slice(0, 8)}
                                                </td>
                                                <td className="p-3 whitespace-nowrap">
                                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 uppercase">
                                                    {p.paymentMethod}
                                                  </span>
                                                </td>
                                                <td className="p-3 font-mono text-gray-500 whitespace-nowrap">
                                                  {p.transactionId || 'N/A'}
                                                </td>
                                                <td className="p-3 font-bold text-green-700 whitespace-nowrap">
                                                  {formatPrice(p.amount)}
                                                </td>
                                                <td className="p-3 max-w-xs truncate" title={p.notes || ''}>
                                                  {p.notes || '-'}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── CATEGORIES TAB ── */}
        <AnimatePresence mode="wait">
          {activeTab === 'categories' && (
            <motion.div
              key="categories"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Work Categories</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Organise your project service catalog into categories (e.g. Security, Cleaning, Driver)</p>
                </div>
                <Button onClick={() => { setEditingCat(null); setCatForm({ name: '', description: '', color: '#6366F1' }); setIsCatModalOpen(true); }} icon={<Plus size={16} />}>
                  Add Category
                </Button>
              </div>

              {loadingCatalog ? (
                <div className="text-center py-16 text-gray-400">Loading categories...</div>
              ) : catalogCategories.length === 0 ? (
                <Card>
                  <div className="text-center py-16">
                    <Tags size={48} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500 font-medium">No project categories yet</p>
                    <p className="text-sm text-gray-400 mt-1">Create categories to organise your project services</p>
                  </div>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {catalogCategories.map((cat) => (
                    <motion.div
                      key={cat.id}
                      whileHover={{ y: -2 }}
                      className="relative bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden group"
                    >
                      {/* Color strip */}
                      <div className="h-1.5 w-full" style={{ background: cat.imgUrl || '#6366F1' }} />
                      <div className="p-5">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-bold text-gray-800 text-base">{cat.name}</h3>
                            {cat.description && <p className="text-xs text-gray-500 mt-1">{cat.description}</p>}
                          </div>
                          <span className="text-xs bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full">
                            {cat.serviceCount ?? 0} service{(cat.serviceCount ?? 0) !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100 justify-end">
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setEditingCat(cat);
                              setCatForm({ name: cat.name, description: cat.description || '', color: cat.imgUrl || '#6366F1' });
                              setIsCatModalOpen(true);
                            }}
                            icon={<Edit size={13} />}
                          >Edit</Button>
                          <Button
                            variant="danger"
                            onClick={async () => {
                              if (!confirm(`Delete category "${cat.name}"?`)) return;
                              try {
                                await api.delete(`/projects/catalog/categories/${cat.id}`);
                                showToast('Category deleted', 'success');
                                fetchCatalog();
                              } catch (e: any) {
                                showToast(e.response?.data?.error || 'Failed to delete', 'error');
                              }
                            }}
                            icon={<Trash2 size={13} />}
                          />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── SERVICES TAB ── */}
        <AnimatePresence mode="wait">
          {activeTab === 'services' && (
            <motion.div
              key="services"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Project Services</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Define billable services offered under manpower contracts (e.g. Security Guard, Housekeeping, Driver)</p>
                </div>
                <Button onClick={() => { setEditingSvc(null); setSvcForm({ name: '', description: '', category: '', price: '', duration: '0', isActive: true }); setIsSvcModalOpen(true); }} icon={<Plus size={16} />}>
                  Add Service
                </Button>
              </div>

              {loadingCatalog ? (
                <div className="text-center py-16 text-gray-400">Loading services...</div>
              ) : catalogServices.length === 0 ? (
                <Card>
                  <div className="text-center py-16">
                    <Briefcase size={48} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500 font-medium">No project services yet</p>
                    <p className="text-sm text-gray-400 mt-1">Add services to build your project billing catalog</p>
                  </div>
                </Card>
              ) : (
                <Card>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-3 px-4 font-semibold text-gray-600">Service</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-600">Category</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-600">Unit Rate</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-600">Duration</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-600">Status</th>
                          <th className="text-right py-3 px-4 font-semibold text-gray-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {catalogServices.map((svc) => (
                          <tr key={svc.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-semibold text-gray-800">{svc.name}</div>
                              {svc.description && <div className="text-xs text-gray-400 mt-0.5">{svc.description}</div>}
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold">{svc.category || 'General'}</span>
                            </td>
                            <td className="py-3 px-4 font-bold text-blue-700">{formatPrice(svc.price)}</td>
                            <td className="py-3 px-4 text-gray-600">{svc.duration > 0 ? `${svc.duration} min` : '—'}</td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${svc.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'}`}>
                                {svc.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex gap-2 justify-end">
                                <Button
                                  variant="secondary"
                                  onClick={() => {
                                    setEditingSvc(svc);
                                    setSvcForm({
                                      name: svc.name,
                                      description: svc.description || '',
                                      category: svc.category || '',
                                      price: svc.price.toString(),
                                      duration: svc.duration.toString(),
                                      isActive: svc.isActive
                                    });
                                    setIsSvcModalOpen(true);
                                  }}
                                  icon={<Edit size={13} />}
                                >Edit</Button>
                                <Button
                                  variant="danger"
                                  onClick={async () => {
                                    if (!confirm(`Delete service "${svc.name}"?`)) return;
                                    try {
                                      await api.delete(`/projects/catalog/services/${svc.id}`);
                                      showToast('Service deleted', 'success');
                                      fetchCatalog();
                                    } catch (e: any) {
                                      showToast(e.response?.data?.error || 'Failed to delete', 'error');
                                    }
                                  }}
                                  icon={<Trash2 size={13} />}
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {/* Category Modal */}
              <AnimatePresence>
                {isCatModalOpen && (
                  <Modal
                    title={editingCat ? 'Edit Category' : 'New Project Category'}
                    onClose={() => setIsCatModalOpen(false)}
                  >
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      setSubmitting(true);
                      try {
                        if (editingCat) {
                          await api.put(`/projects/catalog/categories/${editingCat.id}`, catForm);
                          showToast('Category updated', 'success');
                        } else {
                          await api.post('/projects/catalog/categories', catForm);
                          showToast('Category created', 'success');
                        }
                        setIsCatModalOpen(false);
                        fetchCatalog();
                      } catch (e: any) {
                        showToast(e.response?.data?.error || 'Failed to save category', 'error');
                      } finally {
                        setSubmitting(false);
                      }
                    }} className="space-y-4">
                      <Input label="Category Name" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} required />
                      <Input label="Description (Optional)" value={catForm.description} onChange={(e) => setCatForm({ ...catForm, description: e.target.value })} />
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-700 uppercase">Color</label>
                        <div className="flex items-center gap-3">
                          <input type="color" value={catForm.color} onChange={(e) => setCatForm({ ...catForm, color: e.target.value })} className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer" />
                          <span className="text-sm text-gray-500">{catForm.color}</span>
                        </div>
                      </div>
                      <div className="flex justify-end gap-3 pt-3 border-t">
                        <Button variant="secondary" onClick={() => setIsCatModalOpen(false)}>Cancel</Button>
                        <Button type="submit" isLoading={submitting}>{editingCat ? 'Update' : 'Create'} Category</Button>
                      </div>
                    </form>
                  </Modal>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Service Create/Edit Modal — lives outside tab check so it persists */}
        <AnimatePresence>
          {isSvcModalOpen && (
            <Modal
              title={editingSvc ? 'Edit Project Service' : 'New Project Service'}
              onClose={() => setIsSvcModalOpen(false)}
            >
              <form onSubmit={async (e) => {
                e.preventDefault();
                setSubmitting(true);
                try {
                  if (editingSvc) {
                    await api.put(`/projects/catalog/services/${editingSvc.id}`, svcForm);
                    showToast('Service updated', 'success');
                  } else {
                    await api.post('/projects/catalog/services', svcForm);
                    showToast('Service created', 'success');
                  }
                  setIsSvcModalOpen(false);
                  fetchCatalog();
                } catch (e: any) {
                  showToast(e.response?.data?.error || 'Failed to save service', 'error');
                } finally {
                  setSubmitting(false);
                }
              }} className="space-y-4">
                <Input label="Service Name" placeholder="e.g. Security Guard, Housekeeping" value={svcForm.name} onChange={(e) => setSvcForm({ ...svcForm, name: e.target.value })} required />
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 uppercase">Category</label>
                  <select
                    className="form-control w-full"
                    value={svcForm.category}
                    onChange={(e) => setSvcForm({ ...svcForm, category: e.target.value })}
                  >
                    <option value="">Select a category...</option>
                    {catalogCategories.map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <Input label="Description (Optional)" value={svcForm.description} onChange={(e) => setSvcForm({ ...svcForm, description: e.target.value })} />
                <div className="grid grid-cols-2 gap-4">
                  <Input label={`Unit Rate (${symbol})`} type="number" step="0.01" placeholder="0.00" value={svcForm.price} onChange={(e) => setSvcForm({ ...svcForm, price: e.target.value })} required />
                  <Input label="Duration (minutes, optional)" type="number" value={svcForm.duration} onChange={(e) => setSvcForm({ ...svcForm, duration: e.target.value })} />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="svcActive" checked={svcForm.isActive} onChange={(e) => setSvcForm({ ...svcForm, isActive: e.target.checked })} className="w-4 h-4 text-blue-600 rounded" />
                  <label htmlFor="svcActive" className="text-sm font-medium text-gray-700">Service is Active</label>
                </div>
                <div className="flex justify-end gap-3 pt-3 border-t">
                  <Button variant="secondary" onClick={() => setIsSvcModalOpen(false)}>Cancel</Button>
                  <Button type="submit" isLoading={submitting}>{editingSvc ? 'Update' : 'Create'} Service</Button>
                </div>
              </form>
            </Modal>
          )}
        </AnimatePresence>
      </div>
    );
  };

  // --- RENDER STAFF INTERFACE ---
  const renderStaffView = () => {
    const isCurrentlyOnBreak = activeShift?.breakStart && !activeShift?.breakEnd;

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* On Duty / Shift Controls Card */}
        <div className="space-y-6">
          <Card>
            <div className="text-center py-4 space-y-4">
              <div className="flex justify-center">
                <div className={`p-4 rounded-full ${
                  activeShift ? (isCurrentlyOnBreak ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600') : 'bg-slate-100 text-slate-400'
                }`}>
                  <Clock size={36} className={activeShift && !isCurrentlyOnBreak ? 'animate-pulse' : ''} />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-gray-800">
                  {activeShift ? (isCurrentlyOnBreak ? 'Duty Paused (On Break)' : 'On Duty (Shift Running)') : 'Off Duty'}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {activeShift ? `Clocked in at ${new Date(activeShift.clockIn).toLocaleTimeString()}` : 'Please select a project to start work.'}
                </p>
              </div>

              {activeShift && (
                <div className="grid grid-cols-2 gap-4 py-3 bg-slate-50 rounded-xl">
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Duty Duration</div>
                    <div className="text-xl font-bold mt-1 text-slate-800">{liveDuration}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Break Duration</div>
                    <div className="text-xl font-bold mt-1 text-slate-800">{liveBreak}</div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                {!activeShift ? (
                  <div className="space-y-3">
                    <select
                      id="staff-project-select"
                      className="form-control w-full"
                      defaultValue=""
                    >
                      <option value="" disabled>Select project location...</option>
                      {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <Button
                      fullWidth
                      onClick={() => {
                        const select = document.getElementById('staff-project-select') as HTMLSelectElement;
                        if (!select?.value) {
                          showToast('Please select a project location first', 'error');
                          return;
                        }
                        handleClockIn(select.value);
                      }}
                      icon={<Play size={16} />}
                    >
                      Clock In
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      fullWidth
                      variant="secondary"
                      onClick={handleToggleBreak}
                      icon={isCurrentlyOnBreak ? <Play size={14} /> : <Pause size={14} />}
                    >
                      {isCurrentlyOnBreak ? 'Resume' : 'Break'}
                    </Button>
                    <Button
                      fullWidth
                      variant="danger"
                      onClick={() => setIsClockOutModalOpen(true)}
                      icon={<Square size={14} />}
                    >
                      Clock Out
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Task Checklist Panel */}
        <div className="lg:col-span-2 space-y-6">
          <Card title="Today's Assigned Daily Schedules">
            {loadingStaffData ? (
              <div>Loading assigned schedules...</div>
            ) : staffTasks.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <CheckCircle2 size={48} className="mx-auto mb-3 opacity-30 text-green-600" />
                <p className="font-semibold">All cleared!</p>
                <p className="text-xs mt-1">No schedules assigned to you for today.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {staffTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`flex items-start justify-between p-4 rounded-xl border transition-all ${
                      task.status === 'COMPLETED'
                        ? 'bg-green-50/50 border-green-200'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className={`font-semibold ${task.status === 'COMPLETED' ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                        {task.title}
                      </div>
                      <p className="text-xs text-gray-500">{task.description || 'No description.'}</p>
                      <div className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full inline-block font-bold">
                        {task.project?.name}
                      </div>
                    </div>

                    <div>
                      {task.status === 'COMPLETED' ? (
                        <span className="flex items-center gap-1 text-green-600 text-xs font-bold">
                          <CheckCircle size={16} /> Completed
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleOpenTaskComplete(task)}
                          disabled={!activeShift || isCurrentlyOnBreak}
                          title={!activeShift ? 'You must clock in first' : ''}
                        >
                          Mark Done
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    );
  };

  return (
    <div className="page-content" style={{ padding: '2rem' }}>
      {/* Modals Container */}
      <AnimatePresence>
        {/* Create/Edit Project Modal */}
        {isProjectModalOpen && (
          <Modal
            isOpen={isProjectModalOpen}
            onClose={() => setIsProjectModalOpen(false)}
            title={editingProject ? 'Edit Manpower Project Rules' : 'Create Manpower Project'}
          >
            <form onSubmit={handleCreateProject} className="space-y-4">
              <Input
                label="Project Location / Site Name"
                placeholder="e.g. Warehouse A Construction"
                value={projectForm.name}
                onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                required
              />
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 uppercase">Assign Staff & Set Rates</label>
                <div className="flex gap-2 mb-3">
                  <select
                    id="add-staff-select"
                    className="form-control flex-1"
                    defaultValue=""
                  >
                    <option value="" disabled>Select a staff member to add...</option>
                    {staffList.filter((s: any) => !(projectForm.assignedStaff || []).some(ps => ps.staffId === s.id)).map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name} (Base Rate: {s.basicPrice || 0})</option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    onClick={() => {
                      const select = document.getElementById('add-staff-select') as HTMLSelectElement;
                      if (!select.value) return;
                      const staff = staffList.find((s: any) => s.id === select.value);
                      if (!staff) return;
                      
                      setProjectForm({
                        ...projectForm,
                        assignedStaff: [
                          ...(projectForm.assignedStaff || []),
                          {
                            staffId: staff.id,
                            billingRate: staff.basicPrice || 0,
                            overtimeRateMultiplier: 1.5,
                            standardShiftHours: 8.0,
                            enableOvertime: true
                          }
                        ]
                      });
                      select.value = "";
                    }}
                  >
                    Add Staff
                  </Button>
                </div>
                
                {(projectForm.assignedStaff || []).length > 0 && (
                  <div className="border rounded-xl overflow-hidden border-slate-200 shadow-sm mt-4">
                    <table className="min-w-full divide-y divide-slate-100 text-sm text-left">
                      <thead className="bg-slate-50 text-slate-700">
                        <tr>
                          <th className="px-4 py-3 font-semibold whitespace-nowrap">Staff Name</th>
                          <th className="px-3 py-3 font-semibold text-center whitespace-nowrap">Hourly Rate</th>
                          <th className="px-3 py-3 font-semibold text-center whitespace-nowrap">OT Multiplier</th>
                          <th className="px-3 py-3 font-semibold text-center whitespace-nowrap">Shift Hrs</th>
                          <th className="px-3 py-3 font-semibold text-center whitespace-nowrap" title="Enable Overtime">OT</th>
                          <th className="px-3 py-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {(projectForm.assignedStaff || []).map((ps, idx) => {
                          const staffName = staffList.find((s: any) => s.id === ps.staffId)?.name || 'Unknown';
                          return (
                            <tr key={ps.staffId} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-4 py-2 font-medium text-slate-800 flex items-center h-full min-h-[44px]">
                                {staffName}
                              </td>
                              <td className="px-2 py-2 text-center align-middle">
                                <input
                                  type="number"
                                  step="0.01"
                                  className="form-control text-sm w-20 text-center mx-auto"
                                  value={ps.billingRate}
                                  onChange={(e) => {
                                    const newStaff = [...(projectForm.assignedStaff || [])];
                                    newStaff[idx].billingRate = parseFloat(e.target.value) || 0;
                                    setProjectForm({ ...projectForm, assignedStaff: newStaff });
                                  }}
                                />
                              </td>
                              <td className="px-2 py-2 text-center align-middle">
                                <input
                                  type="number"
                                  step="0.1"
                                  className="form-control text-sm w-20 text-center mx-auto"
                                  value={ps.overtimeRateMultiplier}
                                  onChange={(e) => {
                                    const newStaff = [...(projectForm.assignedStaff || [])];
                                    newStaff[idx].overtimeRateMultiplier = parseFloat(e.target.value) || 0;
                                    setProjectForm({ ...projectForm, assignedStaff: newStaff });
                                  }}
                                />
                              </td>
                              <td className="px-2 py-2 text-center align-middle">
                                <input
                                  type="number"
                                  step="0.5"
                                  className="form-control text-sm w-20 text-center mx-auto"
                                  value={ps.standardShiftHours}
                                  onChange={(e) => {
                                    const newStaff = [...(projectForm.assignedStaff || [])];
                                    newStaff[idx].standardShiftHours = parseFloat(e.target.value) || 0;
                                    setProjectForm({ ...projectForm, assignedStaff: newStaff });
                                  }}
                                />
                              </td>
                              <td className="px-2 py-2 text-center align-middle">
                                <input
                                  type="checkbox"
                                  checked={ps.enableOvertime}
                                  onChange={(e) => {
                                    const newStaff = [...(projectForm.assignedStaff || [])];
                                    newStaff[idx].enableOvertime = e.target.checked;
                                    setProjectForm({ ...projectForm, assignedStaff: newStaff });
                                  }}
                                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                                />
                              </td>
                              <td className="px-3 py-2 text-right align-middle">
                                <button
                                  type="button"
                                  className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                  onClick={() => {
                                    setProjectForm({
                                      ...projectForm,
                                      assignedStaff: (projectForm.assignedStaff || []).filter(s => s.staffId !== ps.staffId)
                                    });
                                  }}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Select Client"
                  value={projectForm.customerId}
                  onChange={(e) => setProjectForm({ ...projectForm, customerId: e.target.value })}
                  options={customers.map((c) => ({ value: c.id, label: c.name }))}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Start Date"
                  type="date"
                  value={projectForm.startDate}
                  onChange={(e) => setProjectForm({ ...projectForm, startDate: e.target.value })}
                  required
                />
                <Input
                  label="End Date (Optional)"
                  type="date"
                  value={projectForm.endDate}
                  onChange={(e) => setProjectForm({ ...projectForm, endDate: e.target.value })}
                />
              </div>
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg space-y-3">
                <h4 className="text-sm font-semibold text-blue-900">Geo-Fencing (Optional)</h4>
                <p className="text-xs text-blue-700">Enter latitude and longitude to restrict staff clock-ins to a specific physical location.</p>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Latitude"
                    placeholder="e.g. 12.9716"
                    value={projectForm.latitude}
                    onChange={(e) => setProjectForm({ ...projectForm, latitude: e.target.value })}
                  />
                  <Input
                    label="Longitude"
                    placeholder="e.g. 77.5946"
                    value={projectForm.longitude}
                    onChange={(e) => setProjectForm({ ...projectForm, longitude: e.target.value })}
                  />
                </div>
                <Input
                  label="Geofence Radius (meters)"
                  type="number"
                  value={projectForm.geofenceRadius}
                  onChange={(e) => setProjectForm({ ...projectForm, geofenceRadius: e.target.value })}
                />
              </div>
              <Input
                label="Project Description"
                placeholder="Details of manpower supply contract..."
                value={projectForm.description}
                onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
              />
              <div className="flex justify-end gap-3 pt-3 border-t">
                <Button variant="secondary" onClick={() => setIsProjectModalOpen(false)}>Cancel</Button>
                <Button type="submit" isLoading={submitting}>Save Project</Button>
              </div>
            </form>
          </Modal>
        )}

        {/* Assign Task Modal */}
        {isTaskModalOpen && (
          <Modal
            isOpen={isTaskModalOpen}
            onClose={() => setIsTaskModalOpen(false)}
            title="Assign Daily Schedule"
          >
            <form onSubmit={handleCreateTask} className="space-y-4">
              <Select
                label="Select Project"
                value={taskForm.projectId}
                onChange={(e) => setTaskForm({ ...taskForm, projectId: e.target.value })}
                options={projects.map((p) => ({ value: p.id, label: p.name }))}
                required
              />
              <Select
                label="Assign Staff Member"
                value={taskForm.assignedStaffId}
                onChange={(e) => setTaskForm({ ...taskForm, assignedStaffId: e.target.value })}
                options={staffList.map((s) => ({ value: s.id, label: s.name }))}
                required
              />
              <Input
                label="Schedule Title"
                placeholder="e.g. Daily shift handover checklist"
                value={taskForm.title}
                onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                required
              />
              <Input
                label="Schedule Description (Optional)"
                placeholder="Detailed instructions for the staff..."
                value={taskForm.description}
                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Target/Start Date"
                  type="date"
                  value={taskForm.date}
                  onChange={(e) => setTaskForm({ ...taskForm, date: e.target.value })}
                  required
                />
                <Input
                  label="End Date (Optional for multi-day task)"
                  type="date"
                  value={taskForm.endDate}
                  onChange={(e) => setTaskForm({ ...taskForm, endDate: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t">
                <Button variant="secondary" onClick={() => setIsTaskModalOpen(false)}>Cancel</Button>
                <Button type="submit" isLoading={submitting}>Assign Schedule</Button>
              </div>
            </form>
          </Modal>
        )}

        {/* Staff Clock Out Notes Modal */}
        {isClockOutModalOpen && (
          <Modal
            isOpen={isClockOutModalOpen}
            onClose={() => setIsClockOutModalOpen(false)}
            title="Complete Daily Shift Clock-Out"
          >
            <form onSubmit={handleClockOut} className="space-y-4">
              <div className="p-4 bg-blue-50 text-blue-900 rounded-xl flex gap-3 text-sm">
                <AlertCircle className="flex-shrink-0" />
                <p>Please log any shift handovers, breaks details, or specific safety incidents before completing your shift.</p>
              </div>
              <Input
                label="Shift Completion Notes / Handover Details"
                placeholder="Completed packing list, all clean..."
                value={clockOutNotes}
                onChange={(e) => setClockOutNotes(e.target.value)}
                required
              />
              <div className="flex justify-end gap-3 pt-3 border-t">
                <Button variant="secondary" onClick={() => setIsClockOutModalOpen(false)}>Cancel</Button>
                <Button type="submit" variant="danger">Clock Out & End Duty</Button>
              </div>
            </form>
          </Modal>
        )}

        {/* Staff Task Proof-Of-Work Completion Modal */}
        {isTaskCompleteModalOpen && (
          <Modal
            isOpen={isTaskCompleteModalOpen}
            onClose={() => setIsTaskCompleteModalOpen(false)}
            title={`Complete Daily Schedule: ${selectedTask?.title}`}
          >
            <form onSubmit={handleCompleteTask} className="space-y-4">
              <Input
                label="Completion Remarks / Details"
                placeholder="Provide details on how task was completed..."
                value={taskCompletionRemarks}
                onChange={(e) => setTaskCompletionRemarks(e.target.value)}
                required
              />

              <div className="space-y-2">
                <label className="input-label">Upload Proof of Work Photo</label>
                {proofOfWorkUrl ? (
                  <div className="relative rounded-xl overflow-hidden border border-gray-200">
                    <img src={proofOfWorkUrl} alt="Proof of work preview" className="w-full h-48 object-cover" />
                    <button
                      type="button"
                      onClick={() => setProofOfWorkUrl('')}
                      className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full hover:bg-red-700"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center space-y-3">
                    <Camera size={36} className="mx-auto text-gray-400" />
                    <div>
                      <Button variant="secondary" onClick={handleSimulateUpload} icon={<Upload size={14} />}>
                        Simulate Camera Photo Upload
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">Provide photo proof to client report.</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <Button variant="secondary" onClick={() => setIsTaskCompleteModalOpen(false)}>Cancel</Button>
                <Button type="submit">Verify & Complete Schedule</Button>
              </div>
            </form>
          </Modal>
        )}

        {/* Record Payment Modal */}
        {isPaymentModalOpen && selectedBill && (
          <Modal
            isOpen={isPaymentModalOpen}
            onClose={() => setIsPaymentModalOpen(false)}
            title={`Record Payment for ${selectedBill.saleNumber}`}
          >
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Invoice Total:</span>
                  <span className="font-semibold text-gray-800">{formatPrice(selectedBill.totalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Already Paid:</span>
                  <span className="font-semibold text-green-600">{formatPrice(selectedBill.paidAmount)}</span>
                </div>
                <div className="flex justify-between border-t pt-2 border-slate-200">
                  <span className="font-bold text-gray-800">Remaining Balance:</span>
                  <span className="font-bold text-red-600">{formatPrice(selectedBill.balanceAmount)}</span>
                </div>
              </div>

              <Input
                label="Payment Amount"
                type="number"
                step="0.01"
                min="0.01"
                max={selectedBill.balanceAmount.toString()}
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                required
              />

              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Payment Method"
                  value={paymentForm.paymentMethod}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                  options={[
                    { value: 'Cash', label: 'Cash' },
                    { value: 'onlinepay', label: 'onlinepay' }
                  ]}
                  required
                />
                <Input
                  label="Reference Transaction ID (Optional)"
                  placeholder="e.g. UPI / Bank Tx ID"
                  value={paymentForm.transactionId}
                  onChange={(e) => setPaymentForm({ ...paymentForm, transactionId: e.target.value })}
                />
              </div>

              <Input
                label="Payment Remarks / Notes (Optional)"
                placeholder="e.g. Cheque clearance / cash received by..."
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
              />

              <div className="flex justify-end gap-3 pt-3 border-t">
                <Button variant="secondary" onClick={() => setIsPaymentModalOpen(false)}>Cancel</Button>
                <Button type="submit" isLoading={submitting}>Submit Payment</Button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Manpower Supply Portal</h1>
          <p className="text-sm text-gray-500 mt-1">Independent billing, breaks & clock tracker for client project locations.</p>
        </div>
      </div>

      {isUserAdmin ? renderAdminView() : renderStaffView()}
    </div>
  );
};

export default WorklyProject;
