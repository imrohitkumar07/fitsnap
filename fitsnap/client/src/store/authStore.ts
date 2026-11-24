/**
 * FitSnap - Client Auth Store (Zustand)
 * Manages authentication lifecycle, JWT persistence, refresh token rotation,
 * user profile caching, and session restoration.
 */

import { create } from 'zustand';
import { get, post, del } from '../api/client';

export interface User {
  id: string;
  email: string;
  createdAt?: string;
  profile?: any;
  goal?: any;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialLoading: boolean;
}

interface AuthActions {
  login: (email: string, password: string, rememberMe?: boolean) => Promise<{ user: User; token: string; refreshToken?: string; isOnboarded: boolean }>;
  demoLogin: () => Promise<{ user: User; token: string; refreshToken?: string; isOnboarded: boolean }>;
  register: (email: string, password: string) => Promise<{ user: User; token: string; refreshToken?: string; isOnboarded: boolean }>;
  forgotPassword: (email: string) => Promise<{ success: boolean; message: string }>;
  resetPassword: (email: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
  deleteAccount: () => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
  setUser: (user: User) => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>((set, getStore) => ({
  user: null,
  token: localStorage.getItem('fitsnap_token'),
  refreshToken: localStorage.getItem('fitsnap_refresh_token'),
  isAuthenticated: !!localStorage.getItem('fitsnap_token'),
  isLoading: false,
  isInitialLoading: true,

  login: async (email, password, rememberMe = true) => {
    set({ isLoading: true });
    try {
      const response: any = await post('/auth/login', { email, password });
      const payload = response.data || response;

      if (rememberMe) {
        localStorage.setItem('fitsnap_token', payload.token);
        if (payload.refreshToken) {
          localStorage.setItem('fitsnap_refresh_token', payload.refreshToken);
        }
      } else {
        sessionStorage.setItem('fitsnap_token', payload.token);
        localStorage.setItem('fitsnap_token', payload.token);
        if (payload.refreshToken) {
          localStorage.setItem('fitsnap_refresh_token', payload.refreshToken);
        }
      }

      set({
        user: payload.user,
        token: payload.token,
        refreshToken: payload.refreshToken || null,
        isAuthenticated: true,
        isLoading: false,
      });

      return payload;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  demoLogin: async () => {
    set({ isLoading: true });
    try {
      const response: any = await post('/auth/demo', {});
      const payload = response.data || response;

      localStorage.setItem('fitsnap_token', payload.token);
      if (payload.refreshToken) {
        localStorage.setItem('fitsnap_refresh_token', payload.refreshToken);
      }

      set({
        user: payload.user,
        token: payload.token,
        refreshToken: payload.refreshToken || null,
        isAuthenticated: true,
        isLoading: false,
      });

      return payload;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  register: async (email, password) => {
    set({ isLoading: true });
    try {
      const response: any = await post('/auth/register', { email, password });
      const payload = response.data || response;

      localStorage.setItem('fitsnap_token', payload.token);
      if (payload.refreshToken) {
        localStorage.setItem('fitsnap_refresh_token', payload.refreshToken);
      }

      set({
        user: payload.user,
        token: payload.token,
        refreshToken: payload.refreshToken || null,
        isAuthenticated: true,
        isLoading: false,
      });

      return payload;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  forgotPassword: async (email) => {
    set({ isLoading: true });
    try {
      const response: any = await post('/auth/forgot-password', { email });
      set({ isLoading: false });
      return response;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  resetPassword: async (email, newPassword) => {
    set({ isLoading: true });
    try {
      const response: any = await post('/auth/reset-password', { email, newPassword });
      set({ isLoading: false });
      return response;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  changePassword: async (currentPassword, newPassword) => {
    set({ isLoading: true });
    try {
      const response: any = await post('/auth/change-password', { currentPassword, newPassword });
      set({ isLoading: false });
      return response;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  deleteAccount: async () => {
    set({ isLoading: true });
    try {
      await del('/auth/account');
      localStorage.removeItem('fitsnap_token');
      localStorage.removeItem('fitsnap_refresh_token');
      sessionStorage.removeItem('fitsnap_token');
      set({
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: () => {
    const refreshToken = localStorage.getItem('fitsnap_refresh_token');
    if (refreshToken) {
      post('/auth/logout', { refreshToken }).catch(() => {});
    }
    localStorage.removeItem('fitsnap_token');
    localStorage.removeItem('fitsnap_refresh_token');
    sessionStorage.removeItem('fitsnap_token');
    set({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  loadUser: async () => {
    const token = localStorage.getItem('fitsnap_token') || sessionStorage.getItem('fitsnap_token');
    if (!token) {
      set({ isAuthenticated: false, isLoading: false, isInitialLoading: false });
      return;
    }

    set({ isLoading: true });
    try {
      const res: any = await get('/auth/me');
      if (res.data?.user) {
        set({
          user: res.data.user,
          isAuthenticated: true,
          isLoading: false,
          isInitialLoading: false,
        });
      } else {
        // Fallback to profile route
        const profRes: any = await get('/profile');
        if (profRes.data?.profile) {
          set({
            user: {
              id: profRes.data.profile.userId,
              email: '',
              profile: profRes.data.profile,
              goal: profRes.data.goal,
            },
            isAuthenticated: true,
            isLoading: false,
            isInitialLoading: false,
          });
        }
      }
    } catch (err: any) {
      // If 401, check if we have a refresh token
      const refreshToken = localStorage.getItem('fitsnap_refresh_token');
      if (refreshToken) {
        try {
          const refreshRes: any = await post('/auth/refresh', { refreshToken });
          const payload = refreshRes.data || refreshRes;
          if (payload?.token) {
            localStorage.setItem('fitsnap_token', payload.token);
            if (payload.refreshToken) {
              localStorage.setItem('fitsnap_refresh_token', payload.refreshToken);
            }
            set({
              user: payload.user,
              token: payload.token,
              refreshToken: payload.refreshToken,
              isAuthenticated: true,
              isLoading: false,
              isInitialLoading: false,
            });
            return;
          }
        } catch {
          // Token refresh also failed
        }
      }

      localStorage.removeItem('fitsnap_token');
      localStorage.removeItem('fitsnap_refresh_token');
      sessionStorage.removeItem('fitsnap_token');
      set({
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
        isInitialLoading: false,
      });
    }
  },

  setUser: (user) => set({ user }),
}));
