import { create } from 'zustand';
import { get as apiGet, post, del } from '../api/client';

export interface FoodItem {
  name: string;
  portionG: number;
  portionLabel?: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
  sugarG?: number;
  sodiumMg?: number;
  confidence?: number;
  isAiEstimate?: boolean;
  needsConfirmation?: boolean;
  badge?: string;
  source?: string;
  modelAgreement?: boolean;
  agreementDetails?: string;
  portions?: Array<{ description: string; gramWeight: number }>;
  embedding?: number[];
  recognitionState?: string;
}

export interface AnalysisResult {
  foods: FoodItem[];
  photoUrl?: string;
  embedding?: number[];
  userPrototypeMatches?: any[];
  recognitionState?: string;
  stateMessage?: string;
  calibratedConfidence?: number;
  entropy?: number;
  prototypeDistance?: number;
  closestPrototypeClass?: string | null;
  predictions?: Array<{
    class_name: string;
    confidence: number;
    display_name: string;
    fdc_id?: string;
    category?: string;
    per_100g?: any;
    default_portion?: any;
    portions?: any[];
  }>;
  qualityChecks?: {
    is_blurry: boolean;
    is_dark: boolean;
    is_overexposed: boolean;
    is_low_entropy: boolean;
    entropy: number;
    laplacian_var: number;
  };
}

export interface FoodLog {
  id: string;
  userId: string;
  mealType: string;
  photoUrl?: string;
  date: string;
  items: FoodItem[];
}

interface FoodState {
  todayLogs: FoodLog[];
  isAnalyzing: boolean;
  analysisResult: AnalysisResult | null;
}

interface FoodActions {
  fetchTodayLogs: () => Promise<void>;
  setAnalysisResult: (result: AnalysisResult | null) => void;
  deleteFoodLog: (id: string) => Promise<void>;
  clearAnalysis: () => void;
}

type FoodStore = FoodState & FoodActions;

export const useFoodStore = create<FoodStore>((set) => ({
  todayLogs: [],
  isAnalyzing: false,
  analysisResult: null,

  fetchTodayLogs: async () => {
    try {
      const res = await apiGet<any>('/food/log');
      if (res.data?.logs) {
        set({ todayLogs: res.data.logs });
      }
    } catch (error) {
      console.error('Failed to fetch food logs:', error);
    }
  },

  setAnalysisResult: (result) => set({ analysisResult: result }),

  deleteFoodLog: async (id) => {
    try {
      await del(`/food/log/${id}`);
      set((state) => ({
        todayLogs: state.todayLogs.filter((log) => log.id !== id),
      }));
    } catch (error) {
      console.error('Failed to delete food log:', error);
      throw error;
    }
  },

  clearAnalysis: () => set({ analysisResult: null }),
}));
