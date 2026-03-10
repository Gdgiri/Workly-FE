import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../utils/api';

interface SaleState {
    loading: boolean;
    error: string | null;
}

const initialState: SaleState = {
    loading: false,
    error: null,
};

// Async Thunk for cancelling a sale
export const cancelSale = createAsyncThunk(
    'sales/cancelSale',
    async ({ id, reason }: { id: string; reason: string }, { rejectWithValue }) => {
        try {
            const response = await api.post(`/sales/${id}/cancel`, { reason });
            return response.data;
        } catch (error: any) {
            return rejectWithValue(
                error.response?.data?.error ||
                error.response?.data?.message ||
                'Failed to cancel sale'
            );
        }
    }
);

const saleSlice = createSlice({
    name: 'sales',
    initialState,
    reducers: {
        clearSaleError: (state) => {
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(cancelSale.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(cancelSale.fulfilled, (state) => {
                state.loading = false;
            })
            .addCase(cancelSale.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export const { clearSaleError } = saleSlice.actions;
export default saleSlice.reducer;
