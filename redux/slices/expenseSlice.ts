import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../../utils/api';

export interface Expense {
    id: string;
    title: string;
    amount: number;
    category: string;
    date: string;
    description?: string;
    cashierName?: string;

    attachments?: Attachment[];
    createdAt: string;
    updatedAt: string;
}

export interface Attachment {
    title: string;
    remarks: string;
    url: string;
}

interface ExpenseState {
    expenses: Expense[];
    loading: boolean;
    error: string | null;
}

const initialState: ExpenseState = {
    expenses: [],
    loading: false,
    error: null,
};


export const fetchExpenses = createAsyncThunk(
    'expense/fetchExpenses',
    async (_, { rejectWithValue }) => {
        try {
            const response = await api.get('/expenses');
            return response.data;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.error || error.response?.data?.message || 'An unknown error occurred');
        }
    }
);

export const createExpense = createAsyncThunk(
    'expense/createExpense',
    async (expenseData: Partial<Expense>, { rejectWithValue }) => {
        try {
            const response = await api.post('/expenses', expenseData);
            return response.data;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.error || error.response?.data?.message || 'An unknown error occurred');
        }
    }
);

export const updateExpense = createAsyncThunk(
    'expense/updateExpense',
    async ({ id, data }: { id: string; data: Partial<Expense> }, { rejectWithValue }) => {
        try {
            const response = await api.put(`/expenses/${id}`, data);
            return response.data;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.error || error.response?.data?.message || 'An unknown error occurred');
        }
    }
);

export const deleteExpense = createAsyncThunk(
    'expense/deleteExpense',
    async (id: string, { rejectWithValue }) => {
        try {
            await api.delete(`/expenses/${id}`);
            return id;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.error || error.response?.data?.message || 'An unknown error occurred');
        }
    }
);


const expenseSlice = createSlice({
    name: 'expense',
    initialState,
    reducers: {
        clearExpenseError: (state) => {
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            // Fetch Expenses
            .addCase(fetchExpenses.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchExpenses.fulfilled, (state, action: PayloadAction<Expense[]>) => {
                state.loading = false;
                state.expenses = action.payload;
            })
            .addCase(fetchExpenses.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Create Expense
            .addCase(createExpense.fulfilled, (state, action: PayloadAction<Expense>) => {
                state.expenses.unshift(action.payload);
            })
            // Update Expense
            .addCase(updateExpense.fulfilled, (state, action: PayloadAction<Expense>) => {
                const index = state.expenses.findIndex((e) => e.id === action.payload.id);
                if (index !== -1) {
                    state.expenses[index] = action.payload;
                }
            })
            // Delete Expense
            .addCase(deleteExpense.fulfilled, (state, action: PayloadAction<string>) => {
                state.expenses = state.expenses.filter((e) => e.id !== action.payload);
            });
    },
});

export const { clearExpenseError } = expenseSlice.actions;
export default expenseSlice.reducer;
