import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../../utils/api';
import { Appointment } from '../../types';

interface AppointmentState {
    appointments: Appointment[];
    loading: boolean;
    error: string | null;
    lastFetched: number | null;
}

const initialState: AppointmentState = {
    appointments: [],
    loading: false,
    error: null,
    lastFetched: null,
};

export const fetchAppointments = createAsyncThunk(
    'appointments/fetchAppointments',
    async (_, { rejectWithValue }) => {
        try {
            const response = await api.get('/appointments');
            const data = response.data;
            // Handle wrapper object if present
            if (data && data.appointments && Array.isArray(data.appointments)) {
                return data.appointments;
            }
            if (Array.isArray(data)) {
                return data;
            }
            return [];
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.error || error.response?.data?.message || 'Failed to fetch appointments');
        }
    }
);

export const createAppointment = createAsyncThunk(
    'appointments/createAppointment',
    async (appointmentData: any, { rejectWithValue }) => {
        try {
            const response = await api.post('/appointments', appointmentData);
            return response.data;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.error || error.response?.data?.message || 'Failed to create appointment');
        }
    }
);

export const updateAppointment = createAsyncThunk(
    'appointments/updateAppointment',
    async ({ id, data }: { id: string | number; data: any }, { rejectWithValue }) => {
        try {
            const response = await api.put(`/appointments/${id}`, data);
            return response.data;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.error || error.response?.data?.message || 'Failed to update appointment');
        }
    }
);

export const cancelAppointment = createAsyncThunk(
    'appointments/cancelAppointment',
    async ({ id, reason }: { id: string | number; reason: string }, { rejectWithValue }) => {
        try {
            const response = await api.patch(`/appointments/${id}/cancel`, { cancellationReason: reason });
            return { id, data: response.data };
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.error || error.response?.data?.message || 'Failed to cancel appointment');
        }
    }
);

// WhatsApp status update (from Appointments.tsx logic)
export const updateAppointmentStatus = createAsyncThunk(
    'appointments/updateStatus',
    async ({ id, status }: { id: string | number; status: string }, { rejectWithValue }) => {
        try {
            const response = await api.put(`/appointments/${id}`, { status });
            return response.data;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.error || error.response?.data?.message || 'Failed to update status');
        }
    }
);

const appointmentSlice = createSlice({
    name: 'appointments',
    initialState,
    reducers: {
        clearAppointmentError: (state) => {
            state.error = null;
        },
        invalidateAppointments: (state) => {
            state.lastFetched = null;
        }
    },
    extraReducers: (builder) => {
        builder
            // Fetch
            .addCase(fetchAppointments.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchAppointments.fulfilled, (state, action: PayloadAction<Appointment[]>) => {
                state.loading = false;
                state.appointments = action.payload;
                state.lastFetched = Date.now();
            })
            .addCase(fetchAppointments.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Create
            .addCase(createAppointment.fulfilled, (state, action: PayloadAction<Appointment>) => {
                state.appointments.unshift(action.payload);
            })
            // Update & Status Update
            .addCase(updateAppointment.fulfilled, (state, action: PayloadAction<Appointment>) => {
                const index = state.appointments.findIndex((a) => a.id === action.payload.id);
                if (index !== -1) {
                    state.appointments[index] = action.payload;
                }
            })
            .addCase(updateAppointmentStatus.fulfilled, (state, action: PayloadAction<Appointment>) => {
                const index = state.appointments.findIndex((a) => a.id === action.payload.id);
                if (index !== -1) {
                    state.appointments[index] = action.payload;
                }
            })
            // Cancel
            .addCase(cancelAppointment.fulfilled, (state, action) => {
                const { id, data } = action.payload;
                const index = state.appointments.findIndex((a) => a.id === id);
                if (index !== -1) {
                    // Update the local state with the returned cancelled appointment or just update status
                    if (data && data.status) {
                        state.appointments[index] = data;
                    } else {
                        state.appointments[index].status = 'cancelled';
                    }
                }
            });
    },
});

export const { clearAppointmentError, invalidateAppointments } = appointmentSlice.actions;
export default appointmentSlice.reducer;
