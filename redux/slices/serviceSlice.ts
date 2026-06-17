import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../../utils/api';
import { Service } from '../../types';

interface ServiceState {
    services: Service[];
    categories: string[];
    loading: boolean;
    error: string | null;
    lastFetched: number | null;
}

const initialState: ServiceState = {
    services: [],
    categories: [],
    loading: false,
    error: null,
    lastFetched: null,
};

// Async Thunks

export const fetchServices = createAsyncThunk(
    'services/fetchServices',
    async (_, { rejectWithValue, getState }) => {
        const state = getState() as any;
        const lastFetched = state.services.lastFetched;
        const now = Date.now();

        // 5 minutes cache validity (optional, but good for performance)
        if (lastFetched && (now - lastFetched < 5 * 60 * 1000) && state.services.services.length > 0) {
            return {
                services: state.services.services,
                categories: state.services.categories,
                fromCache: true
            };
        }

        try {
            const [servicesRes, categoriesRes] = await Promise.all([
                api.get('/services'),
                api.get('/categories', { params: { type: 'SERVICE' } })
            ]);

            const servicesData = Array.isArray(servicesRes.data) ? servicesRes.data : (servicesRes.data?.services || []);

            // Map backend isActive to frontend active
            const mappedServices = (servicesData || []).filter((s: any) => s).map((s: any) => ({
                ...s,
                active: s.isActive !== undefined ? s.isActive : s.active
            }));

            // Process categories
            const catNames = (categoriesRes.data || [])
                .filter((c: any) => c && c.name && c.isActive !== false)
                .map((c: any) => c.name);

            return { services: mappedServices, categories: catNames, fromCache: false };
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.error || error.response?.data?.message || 'Failed to fetch services');
        }
    }
);

export const createService = createAsyncThunk(
    'services/createService',
    async (serviceData: Partial<Service>, { rejectWithValue }) => {
        try {
            const response = await api.post('/services', serviceData);
            // Map the response to frontend structure if needed
            const s = response.data.service || response.data;
            return {
                ...s,
                active: s.isActive !== undefined ? s.isActive : s.active
            };
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.error || error.response?.data?.message || 'Failed to create service');
        }
    }
);

export const updateService = createAsyncThunk(
    'services/updateService',
    async ({ id, data }: { id: string | number; data: Partial<Service> }, { rejectWithValue }) => {
        try {
            const response = await api.put(`/services/${id}`, data);
            const s = response.data.service || response.data;
            return {
                ...s,
                active: s.isActive !== undefined ? s.isActive : s.active
            };
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.error || error.response?.data?.message || 'Failed to update service');
        }
    }
);

export const deleteService = createAsyncThunk(
    'services/deleteService',
    async (id: string | number, { rejectWithValue }) => {
        try {
            await api.delete(`/services/${id}`);
            return id;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.error || error.response?.data?.message || 'Failed to delete service');
        }
    }
);

const serviceSlice = createSlice({
    name: 'services',
    initialState,
    reducers: {
        clearServiceError: (state) => {
            state.error = null;
        },
        invalidateServiceCache: (state) => {
            state.lastFetched = null;
        }
    },
    extraReducers: (builder) => {
        builder
            // Fetch Services
            .addCase(fetchServices.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchServices.fulfilled, (state, action) => {
                state.loading = false;
                if (!action.payload.fromCache) {
                    state.services = action.payload.services;
                    state.categories = action.payload.categories;
                    state.lastFetched = Date.now();
                }
            })
            .addCase(fetchServices.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Create Service
            .addCase(createService.fulfilled, (state, action) => {
                state.services.push(action.payload);
            })
            // Update Service
            .addCase(updateService.fulfilled, (state, action) => {
                const index = state.services.findIndex(s => s.id === action.payload.id);
                if (index !== -1) {
                    state.services[index] = action.payload;
                }
            })
            // Delete Service
            .addCase(deleteService.fulfilled, (state, action) => {
                state.services = state.services.filter(s => s.id !== action.payload);
            });
    },
});

export const { clearServiceError, invalidateServiceCache } = serviceSlice.actions;
export default serviceSlice.reducer;
