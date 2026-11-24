/**
 * FitSnap - Global Date Navigation Store
 * Synchronizes selected date across TopBar, Dashboard, Food Diary, and Water Tracker.
 */

import { create } from 'zustand';

interface DateState {
  /** Selected date in YYYY-MM-DD format */
  selectedDate: string;
  /** Whether the selected date is today */
  isToday: boolean;
}

interface DateActions {
  setSelectedDate: (dateStr: string) => void;
  goToPreviousDay: () => void;
  goToNextDay: () => void;
  goToToday: () => void;
}

type DateStore = DateState & DateActions;

const getTodayString = (): string => {
  const now = new Date();
  return now.toISOString().split('T')[0];
};

export const useDateStore = create<DateStore>((set, get) => ({
  selectedDate: getTodayString(),
  isToday: true,

  setSelectedDate: (dateStr: string) => {
    const today = getTodayString();
    set({
      selectedDate: dateStr,
      isToday: dateStr === today,
    });
  },

  goToPreviousDay: () => {
    const current = new Date(get().selectedDate);
    current.setDate(current.getDate() - 1);
    const newStr = current.toISOString().split('T')[0];
    const today = getTodayString();
    set({
      selectedDate: newStr,
      isToday: newStr === today,
    });
  },

  goToNextDay: () => {
    const current = new Date(get().selectedDate);
    current.setDate(current.getDate() + 1);
    const newStr = current.toISOString().split('T')[0];
    const today = getTodayString();
    set({
      selectedDate: newStr,
      isToday: newStr === today,
    });
  },

  goToToday: () => {
    const today = getTodayString();
    set({
      selectedDate: today,
      isToday: true,
    });
  },
}));
