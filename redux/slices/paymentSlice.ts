import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../../utils/api';
import { Payment, PaymentMethod } from '../../types';

interface PaymentState {
    payments: Payment[];
    stats: {
        totalRevenue: number;
        totalCash: number;
        totalDigital: number;
        totalBalanceAmount: number;
        totalBalanceCount: number;
    };
    paymentMethods: PaymentMethod[];
    specialists: string[];
    pagination: {
        totalCount: number;
        totalPages: number;
        currentPage: number;
        limit: number;
    };
    loading: boolean;
    error: string | null;
    lastFetched: number | null;
    lastParams: string | null;
}

const initialState: PaymentState = {
    payments: [],
    stats: {
        totalRevenue: 0,
        totalCash: 0,
        totalDigital: 0,
        totalBalanceAmount: 0,
        totalBalanceCount: 0
    },
    paymentMethods: [], // Might be managed by settingSlice or auth? But payments page uses them
    specialists: [],
    pagination: {
        totalCount: 0,
        totalPages: 1,
        currentPage: 1,
        limit: 10
    },
    loading: false,
    error: null,
    lastFetched: null,
    lastParams: null,
};

// Async Thunks
export const fetchPayments = createAsyncThunk(
    'payments/fetchPayments',
    async (params: any, { rejectWithValue, getState }) => {
        const state = getState() as any;
        const lastFetched = state.payments.lastFetched;
        const now = Date.now();
        const lastParams = state.payments.lastParams;
        const paramsString = JSON.stringify(params || {});
        const isSameParams = lastParams === paramsString;

        // Simple cache: If parameters match and cached < 2 mins ago
        if (isSameParams && lastFetched && (now - lastFetched < 2 * 60 * 1000) && state.payments.payments.length > 0) {
            return {
                payments: state.payments.payments,
                stats: state.payments.stats,
                pagination: state.payments.pagination,
                fromCache: true
            };
        }

        try {
            const response = await api.get('/payments', { params });
            const data = response.data;
            return {
                payments: data.payments,
                stats: data.stats,
                pagination: {
                    totalCount: data.pagination.total,
                    totalPages: data.pagination.totalPages,
                    currentPage: data.pagination.page,
                    limit: data.pagination.limit
                },
                fromCache: false
            };
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.error || error.response?.data?.message || 'Failed to fetch payments');
        }
    }
);

export const fetchSpecialists = createAsyncThunk(
    'payments/fetchSpecialists',
    async (_, { rejectWithValue }) => {
        try {
            const response = await api.get('/payments/specialists');
            return Array.isArray(response.data) ? response.data : [];
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.error || error.response?.data?.message || 'Failed to fetch specialists');
        }
    }
);

const paymentSlice = createSlice({
    name: 'payments',
    initialState,
    reducers: {
        clearPaymentError: (state) => {
            state.error = null;
        },
        invalidatePaymentCache: (state) => {
            state.lastFetched = null;
        }
    },
    extraReducers: (builder) => {
        builder
            // Fetch Payments
            .addCase(fetchPayments.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchPayments.fulfilled, (state, action) => {
                state.loading = false;
                if (!action.payload.fromCache) {
                    state.payments = action.payload.payments;
                    state.stats = action.payload.stats;
                    state.pagination = action.payload.pagination;
                    // Only update lastFetched if it was a default fetch (to avoid caching filtered results as "main" cache)
                    // Actually, for simplicity, let's just update it. Next default fetch will check time.
                    state.lastFetched = Date.now();
                    state.lastParams = JSON.stringify(action.meta.arg || {});
                }
            })
            .addCase(fetchPayments.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Fetch Specialists
            .addCase(fetchSpecialists.fulfilled, (state, action) => {
                state.specialists = action.payload;
            });
    },
});

export const { clearPaymentError, invalidatePaymentCache } = paymentSlice.actions;
export default paymentSlice.reducer;
