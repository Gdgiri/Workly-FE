import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { getCurrentUser } from '../../utils/api/user';

// Define AuthState based on existing types
export interface User {
    id: number | string;
    authId?: string;
    adminId?: string; // Business Owner's ID
    name: string;
    email: string;
    phone?: string;
    role: 'ADMIN' | 'MANAGER' | 'STAFF' | 'CUSTOMER';
    imgUrl?: string;
    appName?: string;
    businessName?: string;
    app_id?: string;
    permissions?: string[];
    // Add other fields as needed based on API response
}

interface AuthState {
    user: User | null;
    accessToken: string | null;
    refreshToken: string | null;
    isAuthenticated: boolean;
    loading: boolean;
    error: string | null;
    registrationSuccess: boolean;
}

// Initial state - load from localStorage for persistence
const initialState: AuthState = {
    user: localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null,
    accessToken: localStorage.getItem('accessToken'),
    refreshToken: localStorage.getItem('refreshToken'),
    isAuthenticated: !!localStorage.getItem('accessToken'),
    loading: false,
    error: null,
    registrationSuccess: false,
};

// Async Thunks
interface LoginPayload {
    email: string;
    password: string;
    appId: string;
    businessName: string;
}

export const loginUser = createAsyncThunk(
    'auth/loginUser',
    async ({ email, password, appId, businessName }: LoginPayload, { rejectWithValue, dispatch }) => {
        try {
            const AUTH_SERVICE_URL = (import.meta as any).env.VITE_AUTH_SERVICE_URL || 'https://authservice-salon-backend-1.onrender.com';

            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            };
            if (AUTH_SERVICE_URL.includes('ngrok')) {
                headers['ngrok-skip-browser-warning'] = 'true';
            }

            const response = await fetch(`${AUTH_SERVICE_URL}/auth/login`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    email,
                    password,
                    app_id: appId
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                return rejectWithValue(errorData?.error || errorData?.message || `Login failed: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();

            if (result.status === 'success') {
                // Store tokens
                localStorage.setItem('accessToken', result.data.accessToken);
                // localStorage.setItem('refreshToken', result.data.refreshToken); // Not yet implemented

                // Inject businessName into user object and ensure phone is mapped
                const userData = {
                    ...result.data.user,
                    phone: result.data.user.phone || result.data.user.phone_number,
                    appName: appId,
                    businessName
                };
                localStorage.setItem('user', JSON.stringify(userData));

                // Verify token is stored
                const storedToken = localStorage.getItem('accessToken');
                if (!storedToken) {
                    console.error('❌ CRITICAL: Token not found in localStorage after storage!');
                    return rejectWithValue('Token storage failed');
                }

                // Fetch user profile from Salon Backend to get role
                let backendUser = null;
                try {
                    backendUser = await dispatch(fetchCurrentUser()).unwrap();
                } catch (error: any) {
                    console.error('⚠️ Failed to fetch current user:', error);
                    console.error('   Error details:', error.response?.data || error.message);
                    // Use Auth Service user data as fallback - preserve the actual role
                    backendUser = {
                        ...userData,
                        role: result.data.user.role || 'CUSTOMER' // Use actual role from Auth Service
                    };
                }

                // Return backend user data (with role) instead of Auth Service user data

                // STRICT LOGIN VALIDATION: Check if URL business name matches user's actual business name
                if (backendUser && backendUser.businessName) {
                    const urlBusinessName = businessName.toLowerCase().replace(/\s+/g, '').trim();
                    const userBusinessName = backendUser.businessName.toLowerCase().replace(/\s+/g, '').trim();

                    if (urlBusinessName !== userBusinessName) {
                        console.warn(`Login blocked: URL business '${businessName}' (norm: '${urlBusinessName}') does not match user business '${backendUser.businessName}' (norm: '${userBusinessName}')`);

                        // Clear session immediately
                        localStorage.removeItem('accessToken');
                        localStorage.removeItem('refreshToken');
                        localStorage.removeItem('user');

                        return rejectWithValue(`Please use the correct URL.`);
                    }
                }

                return {
                    accessToken: result.data.accessToken,
                    refreshToken: null,
                    user: backendUser  // Use backend user with role
                };
            } else {
                return rejectWithValue(result.errors ? result.errors.join(', ') : (result.message || 'Login failed'));
            }
        } catch (error: any) {
            return rejectWithValue(error.message || 'Network error occurred');
        }
    }
);

interface RegisterPayload {
    name: string;
    email: string;
    phone: string;
    password: string;
    appId: string;
    businessName: string;
}

export const registerUser = createAsyncThunk(
    'auth/registerUser',
    async ({ name, email, phone, password, appId, businessName }: RegisterPayload, { rejectWithValue, dispatch }) => {
        try {
            const AUTH_SERVICE_URL = (import.meta as any).env.VITE_AUTH_SERVICE_URL || 'https://authservice-salon-backend-1.onrender.com';

            const response = await fetch(`${AUTH_SERVICE_URL}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(AUTH_SERVICE_URL.includes('ngrok') ? { 'ngrok-skip-browser-warning': 'true' } : {})
                },
                body: JSON.stringify({
                    name,
                    email,
                    phone_number: phone,
                    password,
                    app_id: appId,
                    role: 'USER' // Default user role for registration
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                return rejectWithValue(errorData?.error || errorData?.message || `Registration failed: ${response.status}`);
            }

            const result = await response.json();

            if (result.status === 'success') {
                // CRITICAL: Auto-login after registration to trigger user creation in Salon Backend
                try {
                    await dispatch(loginUser({ email, password, appId, businessName })).unwrap();
                } catch (loginError) {
                    console.error('⚠️ Auto-login failed:', loginError);
                }

                return { success: true };
            } else {
                return rejectWithValue(result.message || 'Registration failed');
            }
        } catch (error: any) {
            return rejectWithValue(error.message || 'Registration failed');
        }
    }
);

interface ForgotPasswordPayload {
    email: string;
    appId: string;
    businessName: string;
}

export const forgotPassword = createAsyncThunk(
    'auth/forgotPassword',
    async ({ email, appId, businessName }: ForgotPasswordPayload, { rejectWithValue }) => {
        try {
            const AUTH_SERVICE_URL = (import.meta as any).env.VITE_AUTH_SERVICE_URL || 'https://authservice-salon-backend-1.onrender.com';
            const response = await fetch(`${AUTH_SERVICE_URL}/${appId}/${businessName}/forgot-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(AUTH_SERVICE_URL.includes('ngrok') ? { 'ngrok-skip-browser-warning': 'true' } : {})
                },
                body: JSON.stringify({ email }),
            });
            const result = await response.json();
            console.log('Forgot Password response:', result);
            if (result.status === 'success') return result.message;
            else return rejectWithValue(result.errors ? result.errors.join(', ') : (result.message || result.error || 'Failed to send reset link'));
        } catch (error: any) {
            console.error('Forgot Password network/parsing error:', error);
            return rejectWithValue(error.message || 'Failed to send reset link');
        }
    }
);

interface ResetPasswordPayload {
    password: string;
    token: string;
    appId: string;
    businessName: string;
}

export const resetPassword = createAsyncThunk(
    'auth/resetPassword',
    async ({ password, token, appId, businessName }: ResetPasswordPayload, { rejectWithValue }) => {
        try {
            const AUTH_SERVICE_URL = (import.meta as any).env.VITE_AUTH_SERVICE_URL || 'https://authservice-salon-backend-1.onrender.com';
            const response = await fetch(`${AUTH_SERVICE_URL}/${appId}/${businessName}/reset-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(AUTH_SERVICE_URL.includes('ngrok') ? { 'ngrok-skip-browser-warning': 'true' } : {})
                },
                body: JSON.stringify({ password, token }),
            });
            const result = await response.json();
            console.log('Reset Password response:', result);
            if (result.status === 'success') return result.message;
            else return rejectWithValue(result.errors ? result.errors.join(', ') : (result.message || result.error || 'Password reset failed'));
        } catch (error: any) {
            console.error('Reset Password network/parsing error:', error);
            return rejectWithValue(error.message || 'Password reset failed');
        }
    }
);

/**
 * Handle OAuth callback - store token and fetch user profile
 */
export const handleOAuthCallback = createAsyncThunk(
    'auth/handleOAuthCallback',
    async (token: string, { rejectWithValue }) => {
        try {
            // Store token
            localStorage.setItem('accessToken', token);

            // Fetch user profile from backend
            const user = await getCurrentUser();
            localStorage.setItem('user', JSON.stringify(user));

            return { accessToken: token, user };
        } catch (error: any) {
            localStorage.removeItem('accessToken');
            return rejectWithValue(error.message || 'Failed to fetch user profile');
        }
    }
);

/**
 * Fetch current user profile from backend
 */
// Add this check to authSlice.ts
export const fetchCurrentUser = createAsyncThunk(
    'auth/fetchCurrentUser',
    async (_, { rejectWithValue }) => {
        try {
            const user = await getCurrentUser();

            // Safety check: Don't overwrite state with null/empty if backend fails
            if (!user || Object.keys(user).length === 0) {
                console.warn('⚠️ Backend returned empty user profile. Keeping local cache.');
                // Try to get from localStorage as fallback
                const cachedUser = localStorage.getItem('user');
                if (cachedUser) return JSON.parse(cachedUser);
                throw new Error("No user profile available");
            }

            localStorage.setItem('user', JSON.stringify(user));
            return user;
        } catch (error: any) {
            console.error('❌ Failed to fetch current user:', error);
            return rejectWithValue(error.message || 'Failed to fetch user profile');
        }
    }
);
// export const fetchCurrentUser = createAsyncThunk(
//     'auth/fetchCurrentUser',
//     async (_, { rejectWithValue }) => {
//         try {
//             const user = await getCurrentUser();
//             localStorage.setItem('user', JSON.stringify(user));
//             return user;
//         } catch (error: any) {
//             console.error('❌ Failed to fetch current user:', error);
//             return rejectWithValue(error.message || 'Failed to fetch user profile');
//         }
//     }
// );

export const logoutUser = createAsyncThunk(
    'auth/logout',
    async (_, { dispatch }) => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        return null;
    }
);

// Slice
const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        // You can add synchronous actions here if needed
        clearError: (state) => {
            state.error = null;
        },
        // Action to re-hydrate state from localStorage if needed explicitly, 
        // though we set initial state from localStorage directly.
        setUser: (state, action: PayloadAction<User>) => {
            state.user = action.payload;
            state.isAuthenticated = true;
        }
    },
    extraReducers: (builder) => {
        builder
            // Login
            .addCase(loginUser.pending, (state) => {
                state.loading = true;
                state.error = null;
                state.registrationSuccess = false;
            })
            .addCase(loginUser.fulfilled, (state, action) => {
                state.loading = false;
                state.isAuthenticated = true;
                state.accessToken = action.payload.accessToken;
                state.refreshToken = action.payload.refreshToken;
                state.user = action.payload.user;
                state.error = null;
            })
            .addCase(loginUser.rejected, (state, action) => {
                state.loading = false;
                state.isAuthenticated = false;
                state.error = action.payload as string;
            })
            // Register
            .addCase(registerUser.pending, (state) => {
                state.loading = true;
                state.error = null;
                state.registrationSuccess = false;
            })
            .addCase(registerUser.fulfilled, (state, action) => {
                state.loading = false;
                state.isAuthenticated = false; // No Auto-login as per user request
                state.registrationSuccess = true;
                state.error = null;
                // We do not store tokens here, forcing user to login
            })
            .addCase(registerUser.rejected, (state, action) => {
                state.loading = false;
                state.isAuthenticated = false;
                state.error = action.payload as string;
            })
            // Forgot Password
            .addCase(forgotPassword.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(forgotPassword.fulfilled, (state) => {
                state.loading = false;
                state.error = null;
            })
            .addCase(forgotPassword.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Reset Password
            .addCase(resetPassword.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(resetPassword.fulfilled, (state) => {
                state.loading = false;
                state.error = null;
            })
            .addCase(resetPassword.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // OAuth Callback
            .addCase(handleOAuthCallback.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(handleOAuthCallback.fulfilled, (state, action) => {
                state.loading = false;
                state.isAuthenticated = true;
                state.accessToken = action.payload.accessToken;
                state.user = action.payload.user;
                state.error = null;
            })
            .addCase(handleOAuthCallback.rejected, (state, action) => {
                state.loading = false;
                state.isAuthenticated = false;
                state.error = action.payload as string;
            })
            // Fetch Current User
            .addCase(fetchCurrentUser.pending, (state) => {
                state.loading = true;
            })
            .addCase(fetchCurrentUser.fulfilled, (state, action) => {
                state.loading = false;
                state.user = action.payload;
            })
            .addCase(fetchCurrentUser.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Logout
            .addCase(logoutUser.fulfilled, (state) => {
                state.user = null;
                state.accessToken = null;
                state.refreshToken = null;
                state.isAuthenticated = false;
                state.error = null;
            });
    },
});

export const { clearError, setUser } = authSlice.actions;
export default authSlice.reducer;



// import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
// import { getCurrentUser } from '../../utils/api/user';

// // Define AuthState based on existing types
// export interface User {
//     id: number | string;
//     authId?: string;
//     adminId?: string; // Business Owner's ID
//     name: string;
//     email: string;
//     phone?: string;
//     role: 'ADMIN' | 'MANAGER' | 'STAFF' | 'CUSTOMER';
//     imgUrl?: string;
//     appName?: string;
//     businessName?: string;
//     app_id?: string;
//     permissions?: string[];
//     // Add other fields as needed based on API response
// }

// interface AuthState {
//     user: User | null;
//     accessToken: string | null;
//     refreshToken: string | null;
//     isAuthenticated: boolean;
//     loading: boolean;
//     error: string | null;
//     registrationSuccess: boolean;
// }

// // Initial state - load from localStorage for persistence
// const initialState: AuthState = {
//     user: localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null,
//     accessToken: localStorage.getItem('accessToken'),
//     refreshToken: localStorage.getItem('refreshToken'),
//     isAuthenticated: !!localStorage.getItem('accessToken'),
//     loading: false,
//     error: null,
//     registrationSuccess: false,
// };

// // Async Thunks
// interface LoginPayload {
//     email: string;
//     password: string;
//     appId: string;
//     businessName: string;
// }

// export const loginUser = createAsyncThunk(
//     'auth/loginUser',
//     async ({ email, password, appId, businessName }: LoginPayload, { rejectWithValue, dispatch }) => {
//         try {
//             const AUTH_SERVICE_URL = (import.meta as any).env.VITE_AUTH_SERVICE_URL || 'https://authservice-salon-backend-1.onrender.com';

//             const response = await fetch(`${AUTH_SERVICE_URL}/auth/login`, {
//                 method: 'POST',
//                 headers: {
//                     'Content-Type': 'application/json',
//                 },
//                 body: JSON.stringify({
//                     email,
//                     password,
//                     app_id: appId
//                 }),
//             });

//             if (!response.ok) {
//                 const errorData = await response.json().catch(() => null);
//                 return rejectWithValue(errorData?.error || errorData?.message || `Login failed: ${response.status} ${response.statusText}`);
//             }

//             const result = await response.json();

//             if (result.status === 'success') {
//                 // Store tokens
//                 localStorage.setItem('accessToken', result.data.accessToken);
//                 // localStorage.setItem('refreshToken', result.data.refreshToken); // Not yet implemented

//                 // Inject businessName into user object and ensure phone is mapped
//                 const userData = {
//                     ...result.data.user,
//                     phone: result.data.user.phone || result.data.user.phone_number,
//                     appName: appId,
//                     businessName
//                 };
//                 localStorage.setItem('user', JSON.stringify(userData));

//                 // Verify token is stored
//                 const storedToken = localStorage.getItem('accessToken');
//                 if (!storedToken) {
//                     console.error('❌ CRITICAL: Token not found in localStorage after storage!');
//                     return rejectWithValue('Token storage failed');
//                 }

//                 // Fetch user profile from Salon Backend to get role
//                 let backendUser = null;
//                 try {
//                     backendUser = await dispatch(fetchCurrentUser()).unwrap();
//                 } catch (error: any) {
//                     console.error('⚠️ Failed to fetch current user:', error);
//                     console.error('   Error details:', error.response?.data || error.message);
//                     // Use Auth Service user data as fallback - preserve the actual role
//                     backendUser = {
//                         ...userData,
//                         role: result.data.user.role || 'CUSTOMER' // Use actual role from Auth Service
//                     };
//                 }

//                 // Return backend user data (with role) instead of Auth Service user data

//                 // STRICT LOGIN VALIDATION: Check if URL business name matches user's actual business name
//                 if (backendUser && backendUser.businessName) {
//                     const urlBusinessName = businessName.toLowerCase().replace(/\s+/g, '').trim();
//                     const userBusinessName = backendUser.businessName.toLowerCase().replace(/\s+/g, '').trim();

//                     if (urlBusinessName !== userBusinessName) {
//                         console.warn(`Login blocked: URL business '${businessName}' (norm: '${urlBusinessName}') does not match user business '${backendUser.businessName}' (norm: '${userBusinessName}')`);

//                         // Clear session immediately
//                         localStorage.removeItem('accessToken');
//                         localStorage.removeItem('refreshToken');
//                         localStorage.removeItem('user');

//                         return rejectWithValue(`Please use the correct URL.`);
//                     }
//                 }

//                 return {
//                     accessToken: result.data.accessToken,
//                     refreshToken: null,
//                     user: backendUser  // Use backend user with role
//                 };
//             } else {
//                 return rejectWithValue(result.message || 'Login failed');
//             }
//         } catch (error: any) {
//             return rejectWithValue(error.message || 'Network error occurred');
//         }
//     }
// );

// interface RegisterPayload {
//     name: string;
//     email: string;
//     phone: string;
//     password: string;
//     appId: string;
//     businessName: string;
// }

// export const registerUser = createAsyncThunk(
//     'auth/registerUser',
//     async ({ name, email, phone, password, appId, businessName }: RegisterPayload, { rejectWithValue, dispatch }) => {
//         try {
//             const AUTH_SERVICE_URL = (import.meta as any).env.VITE_AUTH_SERVICE_URL || 'https://authservice-salon-backend-1.onrender.com';

//             const response = await fetch(`${AUTH_SERVICE_URL}/auth/register`, {
//                 method: 'POST',
//                 headers: {
//                     'Content-Type': 'application/json',
//                 },
//                 body: JSON.stringify({
//                     name,
//                     email,
//                     phone_number: phone,
//                     password,
//                     app_id: appId,
//                     role: 'USER' // Default user role for registration
//                 }),
//             });

//             if (!response.ok) {
//                 const errorData = await response.json().catch(() => null);
//                 return rejectWithValue(errorData?.error || errorData?.message || `Registration failed: ${response.status}`);
//             }

//             const result = await response.json();

//             if (result.status === 'success') {
//                 // CRITICAL: Auto-login after registration to trigger user creation in Salon Backend
//                 try {
//                     await dispatch(loginUser({ email, password, appId, businessName })).unwrap();
//                 } catch (loginError) {
//                     console.error('⚠️ Auto-login failed:', loginError);
//                 }

//                 return { success: true };
//             } else {
//                 return rejectWithValue(result.message || 'Registration failed');
//             }
//         } catch (error: any) {
//             return rejectWithValue(error.message || 'Registration failed');
//         }
//     }
// );

// interface ForgotPasswordPayload {
//     email: string;
//     appId: string;
//     businessName: string;
// }

// export const forgotPassword = createAsyncThunk(
//     'auth/forgotPassword',
//     async ({ email, appId, businessName }: ForgotPasswordPayload, { rejectWithValue }) => {
//         try {
//             // Simulate API call or real one
//             const response = await fetch(`https://authservice-salon-backend-1.onrender.com/${appId}/${businessName}/forgot-password`, {
//                 method: 'POST',
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify({ email }),
//             });
//             const result = await response.json();
//             if (result.status === 'success') return result.message;
//             else return rejectWithValue(result.error || 'Failed to send reset link');
//         } catch (error: any) {
//             return rejectWithValue(error.message || 'Failed to send reset link');
//         }
//     }
// );

// interface ResetPasswordPayload {
//     password: string;
//     appId: string; // usually token is in URL, but let's stick to context for now
//     businessName: string;
//     // heavily simplified, usually needs a token
// }

// export const resetPassword = createAsyncThunk(
//     'auth/resetPassword',
//     async ({ password, appId, businessName }: ResetPasswordPayload, { rejectWithValue }) => {
//         try {
//             // Simulate API call
//             const response = await fetch(`https://authservice-salon-backend-1.onrender.com/${appId}/${businessName}/reset-password`, {
//                 method: 'POST',
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify({ password }),
//             });
//             const result = await response.json();
//             if (result.status === 'success') return result.message;
//             else return rejectWithValue(result.error || 'Password reset failed');
//         } catch (error: any) {
//             return rejectWithValue(error.message || 'Password reset failed');
//         }
//     }
// );

// /**
//  * Handle OAuth callback - store token and fetch user profile
//  */
// export const handleOAuthCallback = createAsyncThunk(
//     'auth/handleOAuthCallback',
//     async (token: string, { rejectWithValue }) => {
//         try {
//             // Store token
//             localStorage.setItem('accessToken', token);

//             // Fetch user profile from backend
//             const user = await getCurrentUser();
//             localStorage.setItem('user', JSON.stringify(user));

//             return { accessToken: token, user };
//         } catch (error: any) {
//             localStorage.removeItem('accessToken');
//             return rejectWithValue(error.message || 'Failed to fetch user profile');
//         }
//     }
// );

// /**
//  * Fetch current user profile from backend
//  */
// export const fetchCurrentUser = createAsyncThunk(
//     'auth/fetchCurrentUser',
//     async (_, { rejectWithValue }) => {
//         try {
//             const user = await getCurrentUser();
//             localStorage.setItem('user', JSON.stringify(user));
//             return user;
//         } catch (error: any) {
//             console.error('❌ Failed to fetch current user:', error);
//             return rejectWithValue(error.message || 'Failed to fetch user profile');
//         }
//     }
// );

// export const logoutUser = createAsyncThunk(
//     'auth/logout',
//     async (_, { dispatch }) => {
//         localStorage.removeItem('accessToken');
//         localStorage.removeItem('refreshToken');
//         localStorage.removeItem('user');
//         return null;
//     }
// );

// // Slice
// const authSlice = createSlice({
//     name: 'auth',
//     initialState,
//     reducers: {
//         // You can add synchronous actions here if needed
//         clearError: (state) => {
//             state.error = null;
//         },
//         // Action to re-hydrate state from localStorage if needed explicitly, 
//         // though we set initial state from localStorage directly.
//         setUser: (state, action: PayloadAction<User>) => {
//             state.user = action.payload;
//             state.isAuthenticated = true;
//         }
//     },
//     extraReducers: (builder) => {
//         builder
//             // Login
//             .addCase(loginUser.pending, (state) => {
//                 state.loading = true;
//                 state.error = null;
//                 state.registrationSuccess = false;
//             })
//             .addCase(loginUser.fulfilled, (state, action) => {
//                 state.loading = false;
//                 state.isAuthenticated = true;
//                 state.accessToken = action.payload.accessToken;
//                 state.refreshToken = action.payload.refreshToken;
//                 state.user = action.payload.user;
//                 state.error = null;
//             })
//             .addCase(loginUser.rejected, (state, action) => {
//                 state.loading = false;
//                 state.isAuthenticated = false;
//                 state.error = action.payload as string;
//             })
//             // Register
//             .addCase(registerUser.pending, (state) => {
//                 state.loading = true;
//                 state.error = null;
//                 state.registrationSuccess = false;
//             })
//             .addCase(registerUser.fulfilled, (state, action) => {
//                 state.loading = false;
//                 state.isAuthenticated = false; // No Auto-login as per user request
//                 state.registrationSuccess = true;
//                 state.error = null;
//                 // We do not store tokens here, forcing user to login
//             })
//             .addCase(registerUser.rejected, (state, action) => {
//                 state.loading = false;
//                 state.isAuthenticated = false;
//                 state.error = action.payload as string;
//             })
//             // Forgot Password
//             .addCase(forgotPassword.pending, (state) => {
//                 state.loading = true;
//                 state.error = null;
//             })
//             .addCase(forgotPassword.fulfilled, (state) => {
//                 state.loading = false;
//                 state.error = null;
//             })
//             .addCase(forgotPassword.rejected, (state, action) => {
//                 state.loading = false;
//                 state.error = action.payload as string;
//             })
//             // Reset Password
//             .addCase(resetPassword.pending, (state) => {
//                 state.loading = true;
//                 state.error = null;
//             })
//             .addCase(resetPassword.fulfilled, (state) => {
//                 state.loading = false;
//                 state.error = null;
//             })
//             .addCase(resetPassword.rejected, (state, action) => {
//                 state.loading = false;
//                 state.error = action.payload as string;
//             })
//             // OAuth Callback
//             .addCase(handleOAuthCallback.pending, (state) => {
//                 state.loading = true;
//                 state.error = null;
//             })
//             .addCase(handleOAuthCallback.fulfilled, (state, action) => {
//                 state.loading = false;
//                 state.isAuthenticated = true;
//                 state.accessToken = action.payload.accessToken;
//                 state.user = action.payload.user;
//                 state.error = null;
//             })
//             .addCase(handleOAuthCallback.rejected, (state, action) => {
//                 state.loading = false;
//                 state.isAuthenticated = false;
//                 state.error = action.payload as string;
//             })
//             // Fetch Current User
//             .addCase(fetchCurrentUser.pending, (state) => {
//                 state.loading = true;
//             })
//             .addCase(fetchCurrentUser.fulfilled, (state, action) => {
//                 state.loading = false;
//                 state.user = action.payload;
//             })
//             .addCase(fetchCurrentUser.rejected, (state, action) => {
//                 state.loading = false;
//                 state.error = action.payload as string;
//             })
//             // Logout
//             .addCase(logoutUser.fulfilled, (state) => {
//                 state.user = null;
//                 state.accessToken = null;
//                 state.refreshToken = null;
//                 state.isAuthenticated = false;
//                 state.error = null;
//             });
//     },
// });

// export const { clearError, setUser } = authSlice.actions;
// export default authSlice.reducer;
