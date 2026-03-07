import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../../utils/api';
import { Stylist } from '../../types';

interface StylistState {
    stylists: Stylist[];
    loading: boolean;
    error: string | null;
    lastFetched: number | null;
}

const initialState: StylistState = {
    stylists: [],
    loading: false,
    error: null,
    lastFetched: null,
};

// Async Thunks
export const fetchStylists = createAsyncThunk(
    'stylists/fetchStylists',
    async (_, { rejectWithValue, getState }) => {
        const state = getState() as any;
        const lastFetched = state.stylists.lastFetched;
        const now = Date.now();

        // 5 minutes cache
        if (lastFetched && (now - lastFetched < 5 * 60 * 1000) && state.stylists.stylists.length > 0) {
            return {
                stylists: state.stylists.stylists,
                fromCache: true
            };
        }

        try {
            const response = await api.get('/stylists');
            const data = response.data;
            const stylistsArray = Array.isArray(data) ? data : (data.stylists || []);

            // Parse leaves and dateSpecificHours if they are JSON strings
            const parsedData = stylistsArray.map((s: any) => {
                const rawWorkingHours = typeof s.workingHours === 'string' ? JSON.parse(s.workingHours) : (s.workingHours || {});
                const rawDateSpecificHours = typeof s.dateSpecificHours === 'string' ? JSON.parse(s.dateSpecificHours) : (s.dateSpecificHours || {});

                const normalizeHours = (hours: any) => {
                    const normalized: any = {};
                    Object.keys(hours).forEach(key => {
                        const dayData = hours[key];
                        if (!dayData) {
                            normalized[key] = null;
                            return;
                        }

                        // If already has morning/afternoon, keep it
                        if (dayData.morning || dayData.afternoon) {
                            normalized[key] = dayData;
                        } else if (dayData.start || dayData.end) {
                            // Convert legacy to split shifts
                            normalized[key] = {
                                morning: { start: dayData.start || '09:00', end: '13:00' },
                                afternoon: { start: '14:00', end: dayData.end || '18:00' }
                            };
                        } else {
                            normalized[key] = dayData;
                        }
                    });
                    return normalized;
                };

                return {
                    ...s,
                    leaves: Array.isArray(s.leaves) ? s.leaves : (s.leaves ? JSON.parse(s.leaves) : []),
                    workingHours: normalizeHours(rawWorkingHours),
                    dateSpecificHours: normalizeHours(rawDateSpecificHours),
                    status: s.isAvailable ? 'working' : 'off',
                    permissions: Array.isArray(s.permissions) ? s.permissions : (s.permissions ? JSON.parse(s.permissions) : []),
                    specialization: (() => {
                        const rawSpecs = s.specialization
                            ? (typeof s.specialization === 'string' ? s.specialization.split(',') : (Array.isArray(s.specialization) ? s.specialization : [s.specialization]))
                            : [];
                        const uniqueSpecs = Array.from(new Set(rawSpecs.map((spec: string) => spec.trim()).filter(Boolean)));
                        return uniqueSpecs.join(', ');
                    })()
                };
            });
            return { stylists: parsedData, fromCache: false };
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.message || error.message || 'Failed to fetch stylists');
        }
    }
);

const stylistSlice = createSlice({
    name: 'stylists',
    initialState,
    reducers: {
        clearStylistError: (state) => {
            state.error = null;
        },
        invalidateStylistCache: (state) => {
            state.lastFetched = null;
        }
    },
    extraReducers: (builder) => {
        builder
            // Fetch Stylists
            .addCase(fetchStylists.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchStylists.fulfilled, (state, action) => {
                state.loading = false;
                if (!action.payload.fromCache) {
                    state.stylists = action.payload.stylists;
                    state.lastFetched = Date.now();
                }
            })
            .addCase(fetchStylists.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export const { clearStylistError, invalidateStylistCache } = stylistSlice.actions;
export default stylistSlice.reducer;
