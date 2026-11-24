import { create } from 'zustand';
import { get as apiGet, post } from '../api/client';

// ── Types ────────────────────────────────────────────────────────

export interface WaterLog {
  id: string;
  userId: string;
  amountMl: number;
  loggedAt: string;
}

interface WaterState {
  todayLogs: WaterLog[];
  totalToday: number;
}

interface WaterActions {
  /** Fetch all water logs for today */
  fetchTodayLogs: () => Promise<void>;
  /** Add a water entry in milliliters */
  addWater: (amountMl: number) => Promise<void>;
}

type WaterStore = WaterState & WaterActions;

// ── Store ────────────────────────────────────────────────────────

export const useWaterStore = create<WaterStore>((set) => ({
  todayLogs: [],
  totalToday: 0,

  fetchTodayLogs: async () => {
    try {
      const logs = await apiGet<WaterLog[]>('/water/today');
      const total = logs.reduce((sum, log) => sum + log.amountMl, 0);
      set({ todayLogs: logs, totalToday: total });
    } catch (error) {
      console.error('Failed to fetch water logs:', error);
    }
  },

  addWater: async (amountMl) => {
    try {
      const log = await post<WaterLog>('/water/log', { amountMl });
      set((state) => ({
        todayLogs: [...state.todayLogs, log],
        totalToday: state.totalToday + amountMl,
      }));
    } catch (error) {
      console.error('Failed to add water:', error);
      throw error;
    }
  },
}));
