import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../../utils/api';
import { Customer } from '../../types';

interface CustomerState {
    customers: Customer[];
    loading: boolean;
    error: string | null;
    lastFetched: number | null;
}

const initialState: CustomerState = {
    customers: [],
    loading: false,
    error: null,
    lastFetched: null,
};

// Async Thunks
export const fetchCustomers = createAsyncThunk(
    'customers/fetchCustomers',
    async (_, { rejectWithValue, getState }) => {
        const state = getState() as any;
        const lastFetched = state.customers.lastFetched;
        const now = Date.now();

        // 5 minutes cache
        if (lastFetched && (now - lastFetched < 5 * 60 * 1000) && state.customers.customers.length > 0) {
            return {
                customers: state.customers.customers,
                fromCache: true
            };
        }

        try {
            const response = await api.get('/customers');
            const data = Array.isArray(response.data) ? response.data : (response.data?.customers || []);
            return { customers: data, fromCache: false };
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.error || error.response?.data?.message || 'Failed to fetch customers');
        }
    }
);

export const createCustomer = createAsyncThunk(
    'customers/createCustomer',
    async (customerData: Partial<Customer>, { rejectWithValue }) => {
        try {
            const response = await api.post('/customers', customerData);
            return response.data;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.error || error.response?.data?.message || 'Failed to create customer');
        }
    }
);

const customerSlice = createSlice({
    name: 'customers',
    initialState,
    reducers: {
        clearCustomerError: (state) => {
            state.error = null;
        },
        invalidateCustomerCache: (state) => {
            state.lastFetched = null;
        }
    },
    extraReducers: (builder) => {
        builder
            // Fetch Customers
            .addCase(fetchCustomers.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchCustomers.fulfilled, (state, action) => {
                state.loading = false;
                if (!action.payload.fromCache) {
                    state.customers = action.payload.customers;
                    state.lastFetched = Date.now();
                }
            })
            .addCase(fetchCustomers.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Create Customer
            .addCase(createCustomer.fulfilled, (state, action) => {
                state.customers.push(action.payload);
            });
    },
});

export const { clearCustomerError, invalidateCustomerCache } = customerSlice.actions;
export default customerSlice.reducer;
