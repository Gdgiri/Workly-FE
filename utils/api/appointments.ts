import api from '../api';

export interface Appointment {
    id: string;
    serviceId: string;
    stylistId: string;
    customerId: string;
    date: string;
    time: string;
    status: string;
    // Add other fields as needed
}

export interface BookAppointmentData {
    serviceId: string;
    stylistId: string;
    date: string;
    time: string;
}

/**
 * Get all appointments for current user
 */
export const getAppointments = async (): Promise<Appointment[]> => {
    const response = await api.get('/appointments');
    return response.data.appointments;
};

/**
 * Book a new appointment
 */
export const bookAppointment = async (data: BookAppointmentData): Promise<Appointment> => {
    const response = await api.post('/appointments', data);
    return response.data.appointment;
};

/**
 * Cancel an appointment
 */
export const cancelAppointment = async (id: string): Promise<void> => {
    await api.patch(`/appointments/${id}/cancel`);
};
