import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../../utils/api';
import { ComboPackage } from '../../types';

interface PackageState {
    packages: ComboPackage[];
    loading: boolean;
    error: string | null;
    lastFetched: number | null;
}

const initialState: PackageState = {
    packages: [],
    loading: false,
    error: null,
    lastFetched: null,
};

// Async Thunks
export const fetchPackages = createAsyncThunk(
    'packages/fetchPackages',
    async (_, { rejectWithValue, getState }) => {
        const state = getState() as any;
        const lastFetched = state.packages.lastFetched;
        const now = Date.now();

        if (lastFetched && (now - lastFetched < 5 * 60 * 1000) && state.packages.packages.length > 0) {
            return {
                packages: state.packages.packages,
                fromCache: true
            };
        }

        try {
            const response = await api.get('/packages');
            const data = Array.isArray(response.data) ? response.data : (response.data?.packages || []);
            return { packages: data, fromCache: false };
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.error || error.response?.data?.message || 'Failed to fetch packages');
        }
    }
);

export const createPackage = createAsyncThunk(
    'packages/createPackage',
    async (packageData: Partial<ComboPackage>, { rejectWithValue }) => {
        try {
            const response = await api.post('/packages', packageData);
            return response.data;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.error || error.response?.data?.message || 'Failed to create package');
        }
    }
);

export const updatePackage = createAsyncThunk(
    'packages/updatePackage',
    async ({ id, data }: { id: string | number; data: Partial<ComboPackage> }, { rejectWithValue }) => {
        try {
            const response = await api.put(`/packages/${id}`, data);
            return response.data;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.error || error.response?.data?.message || 'Failed to update package');
        }
    }
);

export const deletePackage = createAsyncThunk(
    'packages/deletePackage',
    async (id: string | number, { rejectWithValue }) => {
        try {
            await api.delete(`/packages/${id}`);
            return id;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.error || error.response?.data?.message || 'Failed to delete package');
        }
    }
);

const packageSlice = createSlice({
    name: 'packages',
    initialState,
    reducers: {
        clearPackageError: (state) => {
            state.error = null;
        },
        invalidatePackageCache: (state) => {
            state.lastFetched = null;
        }
    },
    extraReducers: (builder) => {
        builder
            // Fetch Packages
            .addCase(fetchPackages.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchPackages.fulfilled, (state, action) => {
                state.loading = false;
                if (!action.payload.fromCache) {
                    state.packages = action.payload.packages;
                    state.lastFetched = Date.now();
                }
            })
            .addCase(fetchPackages.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Create Package
            .addCase(createPackage.fulfilled, (state, action) => {
                state.packages.push(action.payload);
            })
            // Update Package
            .addCase(updatePackage.fulfilled, (state, action) => {
                const index = state.packages.findIndex(p => p.id === action.payload.id);
                if (index !== -1) {
                    state.packages[index] = action.payload;
                }
            })
            // Delete Package
            .addCase(deletePackage.fulfilled, (state, action) => {
                state.packages = state.packages.filter(p => p.id !== action.payload);
            });
    },
});

export const { clearPackageError, invalidatePackageCache } = packageSlice.actions;
export default packageSlice.reducer;
