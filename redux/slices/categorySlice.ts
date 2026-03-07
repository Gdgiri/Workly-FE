import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../../utils/api';

export interface Category {
    id: string;
    name: string;
    description?: string;
    type: 'service' | 'product' | 'expense';
    itemCount?: number;
    createdAt?: string;
    active: boolean;
    imgUrl?: string;
}

interface CategoryState {
    serviceCategories: Category[];
    productCategories: Category[];
    expenseCategories: Category[];
    loading: boolean;
    error: string | null;
    lastFetched: {
        service: number | null;
        product: number | null;
        expense: number | null;
    };
}

const initialState: CategoryState = {
    serviceCategories: [],
    productCategories: [],
    expenseCategories: [],
    loading: false,
    error: null,
    lastFetched: {
        service: null,
        product: null,
        expense: null
    },
};

// Async Thunks
export const fetchCategories = createAsyncThunk(
    'categories/fetchCategories',
    async (type: 'service' | 'product' | 'expense', { rejectWithValue, getState }) => {
        const state = getState() as any;
        const lastFetched = state.categories.lastFetched[type];
        const now = Date.now();
        const categoryKey = `${type}Categories`;

        // 5 min cache
        if (lastFetched && (now - lastFetched < 5 * 60 * 1000) && state.categories[categoryKey].length > 0) {
            return {
                type,
                categories: state.categories[categoryKey],
                fromCache: true
            };
        }

        try {
            const apiType = type === 'service' ? 'SERVICE' : type === 'product' ? 'PRODUCT' : 'EXPENSE';
            const response = await api.get('/categories', { params: { type: apiType } });

            const categories = response.data.map((cat: any) => ({
                id: cat.id,
                name: cat.name,
                description: cat.description,
                type: cat.type === 'SERVICE' ? 'service' : cat.type === 'PRODUCT' ? 'product' : 'expense',
                active: cat.isActive, // Map isActive to active
                imgUrl: cat.imgUrl,
                itemCount: cat._count?.services || 0 // Backend might return different counts, simple fallback
            }));

            return { type, categories, fromCache: false };
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.error || error.response?.data?.message || 'Failed to fetch categories');
        }
    }
);

export const addCategory = createAsyncThunk(
    'categories/addCategory',
    async (categoryData: any, { rejectWithValue }) => {
        try {
            const apiType = categoryData.type === 'service' ? 'SERVICE' : categoryData.type === 'product' ? 'PRODUCT' : 'EXPENSE';
            const response = await api.post('/categories', { ...categoryData, type: apiType });

            const cat = response.data;
            return {
                id: cat.id,
                name: cat.name,
                description: cat.description,
                type: cat.type === 'SERVICE' ? 'service' : cat.type === 'PRODUCT' ? 'product' : 'expense',
                active: cat.isActive,
                imgUrl: cat.imgUrl,
                itemCount: 0
            };
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.error || error.response?.data?.message || 'Failed to add category');
        }
    }
);

export const updateCategory = createAsyncThunk(
    'categories/updateCategory',
    async ({ id, data }: { id: string, data: any }, { rejectWithValue }) => {
        try {
            const response = await api.put(`/categories/${id}`, data);
            const cat = response.data;
            return {
                id: cat.id,
                name: cat.name,
                description: cat.description,
                // type might not be returned on update or unchangeable, assume it's same or mapped
                type: cat.type === 'SERVICE' ? 'service' : cat.type === 'PRODUCT' ? 'product' : 'expense',
                active: cat.isActive,
                imgUrl: cat.imgUrl,
                itemCount: cat._count?.services || 0
            };
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.error || error.response?.data?.message || 'Failed to update category');
        }
    }
);

export const deleteCategory = createAsyncThunk(
    'categories/deleteCategory',
    async ({ id, type }: { id: string, type: 'service' | 'product' | 'expense' }, { rejectWithValue }) => {
        try {
            await api.delete(`/categories/${id}`);
            return { id, type };
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.error || error.response?.data?.message || 'Failed to delete category');
        }
    }
);

const categorySlice = createSlice({
    name: 'categories',
    initialState,
    reducers: {
        clearCategoryError: (state) => {
            state.error = null;
        },
        invalidateCategoryCache: (state) => {
            state.lastFetched = { service: null, product: null, expense: null };
        }
    },
    extraReducers: (builder) => {
        builder
            // Fetch
            .addCase(fetchCategories.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchCategories.fulfilled, (state, action) => {
                state.loading = false;
                if (!action.payload.fromCache) {
                    const key = `${action.payload.type}Categories` as keyof CategoryState;
                    // @ts-ignore
                    state[key] = action.payload.categories;
                    state.lastFetched[action.payload.type] = Date.now();
                }
            })
            .addCase(fetchCategories.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Add
            .addCase(addCategory.fulfilled, (state, action) => {
                const key = `${action.payload.type}Categories` as keyof CategoryState;
                // @ts-ignore
                state[key].push(action.payload);
            })
            // Update
            .addCase(updateCategory.fulfilled, (state, action) => {
                const key = `${action.payload.type}Categories` as keyof CategoryState;
                // @ts-ignore
                const index = state[key].findIndex((c: Category) => c.id === action.payload.id);
                if (index !== -1) {
                    // @ts-ignore
                    state[key][index] = { ...state[key][index], ...action.payload };
                }
            })
            // Delete
            .addCase(deleteCategory.fulfilled, (state, action) => {
                const key = `${action.payload.type}Categories` as keyof CategoryState;
                // @ts-ignore
                state[key] = state[key].filter((c: Category) => c.id !== action.payload.id);
            });
    },
});

export const { clearCategoryError, invalidateCategoryCache } = categorySlice.actions;
export default categorySlice.reducer;
