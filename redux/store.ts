import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import expenseReducer from './slices/expenseSlice';
import appointmentReducer from './slices/appointmentSlice';
import messageReducer from './slices/messageSlice';

import serviceReducer from './slices/serviceSlice';
import packageReducer from './slices/packageSlice';
import inventoryReducer from './slices/inventorySlice';

import customerReducer from './slices/customerSlice';
import settingReducer from './slices/settingSlice';
import paymentReducer from './slices/paymentSlice';
import categoryReducer from './slices/categorySlice';
import stylistReducer from './slices/stylistSlice';

import saleReducer from './slices/saleSlice';

export const store = configureStore({
    reducer: {
        auth: authReducer,
        expense: expenseReducer,
        appointments: appointmentReducer,
        messages: messageReducer,
        services: serviceReducer,
        packages: packageReducer,
        inventory: inventoryReducer,
        customers: customerReducer,
        settings: settingReducer,
        payments: paymentReducer,
        categories: categoryReducer,
        stylists: stylistReducer,
        sales: saleReducer,
    },
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
