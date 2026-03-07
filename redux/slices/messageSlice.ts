import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../../utils/api';

interface Message {
    id: string | number;
    status: 'SENT' | 'PENDING' | 'FAILED';
    type: string;
    customerPhone: string;
    createdAt: string;
    content?: string;
    metadata?: any;
    error?: string;
    orderId?: string;
}

interface MessageState {
    messages: Message[];
    loading: boolean;
    error: string | null;
    lastFetched: number | null;
}

const initialState: MessageState = {
    messages: [],
    loading: false,
    error: null,
    lastFetched: null,
};

export const fetchMessages = createAsyncThunk(
    'messages/fetchMessages',
    async (_, { rejectWithValue }) => {
        try {
            const response = await api.get('/message-logs');
            const data = response.data;
            if (Array.isArray(data)) {
                return data;
            }
            return data.logs || [];
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.error || error.message || 'Failed to fetch messages');
        }
    }
);

export const resendMessage = createAsyncThunk(
    'messages/resendMessage',
    async (id: string | number, { rejectWithValue }) => {
        try {
            const response = await api.post(`/message-logs/${id}/resend`);
            return { id, data: response.data };
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.message || error.message || 'Failed to resend message');
        }
    }
);

const messageSlice = createSlice({
    name: 'messages',
    initialState,
    reducers: {
        clearMessageError: (state) => {
            state.error = null;
        },
        invalidateMessages: (state) => {
            state.lastFetched = null;
        }
    },
    extraReducers: (builder) => {
        builder
            // Fetch
            .addCase(fetchMessages.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchMessages.fulfilled, (state, action: PayloadAction<Message[]>) => {
                state.loading = false;
                state.messages = action.payload;
                state.lastFetched = Date.now();
            })
            .addCase(fetchMessages.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Resend (Optimistic update or re-fetch needed? The API usually sends new message or updates status)
            // If resend creates a NEW log, we should fetchMessages.
            // If it updates existing, we update it.
            // For now, let's assume we re-fetch in component, but we can also handle it here if backend returns updated msg.
            .addCase(resendMessage.fulfilled, (state, action) => {
                // Typically resend might update the status of the "PENDING" message to "SENT" or create a new one.
                // We will let the component dispatch fetchMessages after resend for simplicity
            });
    },
});

export const { clearMessageError, invalidateMessages } = messageSlice.actions;
export default messageSlice.reducer;
