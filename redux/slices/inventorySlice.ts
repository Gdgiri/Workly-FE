import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../../utils/api';
import { Product } from '../../types';

interface InventoryState {
    products: Product[];
    categories: string[];
    history: any[]; // InventoryMovement[]
    loading: boolean;
    error: string | null;
    lastFetched: number | null;
    lastHistoryFetched: number | null;
}

const initialState: InventoryState = {
    products: [],
    categories: [],
    history: [],
    loading: false,
    error: null,
    lastFetched: null,
    lastHistoryFetched: null,
};

// Async Thunks
export const fetchInventory = createAsyncThunk(
    'inventory/fetchInventory',
    async (_, { rejectWithValue, getState }) => {
        const state = getState() as any;
        const lastFetched = state.inventory.lastFetched;
        const now = Date.now();

        if (lastFetched && (now - lastFetched < 5 * 60 * 1000) && state.inventory.products.length > 0) {
            return {
                products: state.inventory.products,
                categories: state.inventory.categories,
                fromCache: true
            };
        }

        try {
            const [inventoryRes, categoriesRes] = await Promise.all([
                api.get('/inventory'),
                api.get('/categories', { params: { type: 'PRODUCT' } })
            ]);

            const productsData = Array.isArray(inventoryRes.data) ? inventoryRes.data : (inventoryRes.data?.inventory || inventoryRes.data?.products || []);

            // Process categories
            const catNames = (categoriesRes.data || [])
                .filter((c: any) => c && c.name)
                .map((c: any) => c.name);

            return { products: productsData, categories: catNames, fromCache: false };
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.error || error.response?.data?.message || 'Failed to fetch inventory');
        }
    }
);

export const fetchInventoryHistory = createAsyncThunk(
    'inventory/fetchHistory',
    async (_, { rejectWithValue, getState }) => {
        const state = getState() as any;
        const lastHistoryFetched = state.inventory.lastHistoryFetched;
        const now = Date.now();

        if (lastHistoryFetched && (now - lastHistoryFetched < 5 * 60 * 1000) && state.inventory.history.length > 0) {
            return {
                history: state.inventory.history,
                fromCache: true
            };
        }

        try {
            const response = await api.get('/inventory/history');
            if (response.data) {
                const history = response.data.map((m: any) => ({
                    id: m.id,
                    productId: m.productId,
                    timestamp: m.createdAt,
                    type: m.type.toLowerCase().includes('received') ? 'received' :
                        m.type.toLowerCase().includes('adjustment_add') ? 'adjustment_add' :
                            m.type.toLowerCase().includes('adjustment_remove') ? 'adjustment_remove' :
                                m.type.toLowerCase().includes('sold') ? 'sold' : 'received',
                    quantity: m.quantity,
                    balanceAfter: m.balanceAfter,
                    remarks: m.remarks,
                    performedBy: 'Admin',
                    productName: m.product?.name || 'Unknown Product'
                }));
                return { history, fromCache: false };
            }
            return { history: [], fromCache: false };
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.error || error.response?.data?.message || 'Failed to fetch inventory history');
        }
    }
);

// We might want CRUD for products too, but focusing on fetch for now as requested
// Add CRUD thunks here if needed later

const inventorySlice = createSlice({
    name: 'inventory',
    initialState,
    reducers: {
        clearInventoryError: (state) => {
            state.error = null;
        },
        invalidateInventoryCache: (state) => {
            state.lastFetched = null;
            state.lastHistoryFetched = null;
        }
    },
    extraReducers: (builder) => {
        builder
            // Fetch Inventory
            .addCase(fetchInventory.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchInventory.fulfilled, (state, action) => {
                state.loading = false;
                if (!action.payload.fromCache) {
                    state.products = action.payload.products;
                    state.categories = action.payload.categories;
                    state.lastFetched = Date.now();
                }
            })
            .addCase(fetchInventory.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Fetch Inventory History
            .addCase(fetchInventoryHistory.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchInventoryHistory.fulfilled, (state, action) => {
                state.loading = false;
                if (!action.payload.fromCache) {
                    state.history = action.payload.history;
                    state.lastHistoryFetched = Date.now();
                } else {
                    // Cache hit, data already in state
                }
            })
            .addCase(fetchInventoryHistory.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export const { clearInventoryError, invalidateInventoryCache } = inventorySlice.actions;
export default inventorySlice.reducer;
