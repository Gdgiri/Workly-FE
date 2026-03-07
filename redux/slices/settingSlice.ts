import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../../utils/api';

interface SettingState {
    settings: any | null;
    loading: boolean;
    error: string | null;
    lastFetched: number | null;
}

const initialState: SettingState = {
    settings: null,
    loading: false,
    error: null,
    lastFetched: null,
};

// Async Thunks
export const fetchSettings = createAsyncThunk(
    'settings/fetchSettings',
    async (_, { rejectWithValue, getState }) => {
        const state = getState() as any;
        const lastFetched = state.settings.lastFetched;
        const now = Date.now();

        // 30 minutes cache for settings
        if (lastFetched && (now - lastFetched < 30 * 60 * 1000) && state.settings.settings) {
            return {
                settings: state.settings.settings,
                fromCache: true
            };
        }

        try {
            const response = await api.get('/settings');
            return { settings: response.data, fromCache: false };
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.error || error.response?.data?.message || 'Failed to fetch settings');
        }
    }
);

const settingSlice = createSlice({
    name: 'settings',
    initialState,
    reducers: {
        clearSettingError: (state) => {
            state.error = null;
        },
        invalidateSettingCache: (state) => {
            state.lastFetched = null;
        }
    },
    extraReducers: (builder) => {
        builder
            // Fetch Settings
            .addCase(fetchSettings.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchSettings.fulfilled, (state, action) => {
                state.loading = false;
                if (!action.payload.fromCache) {
                    state.settings = action.payload.settings;
                    state.lastFetched = Date.now();
                }
            })
            .addCase(fetchSettings.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export const { clearSettingError, invalidateSettingCache } = settingSlice.actions;
export default settingSlice.reducer;
