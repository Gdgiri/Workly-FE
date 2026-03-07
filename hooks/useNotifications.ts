import { useState, useEffect, useCallback } from 'react';

import api from '../utils/api';

interface AppointmentNotification {
    id: string;
    customerId: string;
    customerName: string;
    serviceId: string;
    serviceName: string;
    appointmentDate: string;
    appointmentTime: string;
    completedAt: string;
    status: string;
    stylistName?: string;
}

const VIEWED_NOTIFICATIONS_KEY = 'viewedNotifications';
const POLL_INTERVAL = 30000; // 30 seconds

export const useNotifications = () => {
    const [notifications, setNotifications] = useState<AppointmentNotification[]>([]);
    const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);

    // Load viewed notification IDs from localStorage
    useEffect(() => {
        const stored = localStorage.getItem(VIEWED_NOTIFICATIONS_KEY);
        if (stored) {
            try {
                const ids = JSON.parse(stored);
                setViewedIds(new Set(ids));
            } catch (error) {
                console.error('Failed to parse viewed notifications:', error);
            }
        }
    }, []);

    // Fetch completed appointments
    const fetchCompletedAppointments = useCallback(async () => {
        try {
            // Use api utility which handles token
            const response = await api.get('/appointments', {
                params: { status: 'COMPLETED' }
            });

            const data = response.data;

            // Handle both array response and object with appointments property
            const appointmentsData = Array.isArray(data) ? data : (data?.appointments || []);

            // Validate that we have an array
            if (!Array.isArray(appointmentsData)) {
                console.error('Appointments data is not an array:', data);
                setNotifications([]);
                setLoading(false);
                return;
            }

            // Filter to ensure ONLY completed appointments (case-insensitive)
            const completedOnly = appointmentsData.filter((apt: any) =>
                apt.status && apt.status.toUpperCase() === 'COMPLETED'
            );

            // Sort by completion time (most recent first)
            const sorted = completedOnly.sort((a: any, b: any) => {
                const dateA = new Date(a.updatedAt || a.createdAt).getTime();
                const dateB = new Date(b.updatedAt || b.createdAt).getTime();
                return dateB - dateA;
            });

            // Take only the last 10 completed appointments
            const recentCompletions = sorted.slice(0, 10).map((apt: any) => ({
                id: apt.id,
                customerId: apt.customerId,
                customerName: apt.customer?.name || 'Unknown Customer',
                serviceId: apt.serviceId,
                serviceName: apt.service?.name || 'Unknown Service',
                appointmentDate: apt.appointmentDate,
                appointmentTime: apt.appointmentTime,
                completedAt: apt.updatedAt || apt.createdAt,
                status: apt.status,
                stylistName: apt.stylist?.name || 'Any Staff'
            }));

            setNotifications(recentCompletions);
            setLoading(false);
        } catch (error: any) {
            // Suppress 401 errors from polling to avoid console spam
            if (error.response && error.response.status === 401) {
                // console.warn('Polling failed: Unauthorized'); 
            } else {
                console.error('Error fetching notifications:', error);
            }
            setLoading(false);
        }
    }, []);

    // Initial fetch and polling
    useEffect(() => {
        fetchCompletedAppointments();

        const interval = setInterval(fetchCompletedAppointments, POLL_INTERVAL);

        return () => clearInterval(interval);
    }, [fetchCompletedAppointments]);

    // Calculate unread count
    const unreadCount = notifications.filter(n => !viewedIds.has(n.id)).length;

    // Mark notification as read
    const markAsRead = useCallback((id: string) => {
        setViewedIds(prev => {
            const newSet = new Set(prev);
            newSet.add(id);
            localStorage.setItem(VIEWED_NOTIFICATIONS_KEY, JSON.stringify(Array.from(newSet)));
            return newSet;
        });
    }, []);

    // Mark all as read
    const markAllAsRead = useCallback(() => {
        const allIds = notifications.map(n => n.id);
        setViewedIds(new Set(allIds));
        localStorage.setItem(VIEWED_NOTIFICATIONS_KEY, JSON.stringify(allIds));
    }, [notifications]);

    // Check if notification is read
    const isRead = useCallback((id: string) => viewedIds.has(id), [viewedIds]);

    // Clear all notifications
    const clearAll = useCallback(() => {
        setNotifications([]);
        setViewedIds(new Set());
        localStorage.setItem(VIEWED_NOTIFICATIONS_KEY, JSON.stringify([]));
    }, []);

    return {
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        clearAll,
        isRead,
        refresh: fetchCompletedAppointments
    };
};
