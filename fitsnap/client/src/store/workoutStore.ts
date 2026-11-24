import { create } from 'zustand';
import { get as apiGet, post } from '../api/client';

// ── Types ────────────────────────────────────────────────────────

export interface Exercise {
  id: string;
  name: string;
  category: string;
  muscleGroup: string;
  met: number;
  equipment?: string;
}

export interface WorkoutSet {
  reps: number;
  weightKg: number;
  durationSec?: number;
}

export interface WorkoutExercise {
  exerciseId: string;
  exerciseName: string;
  sets: WorkoutSet[];
}

export interface Workout {
  id: string;
  userId: string;
  name: string;
  exercises: WorkoutExercise[];
  durationMin: number;
  caloriesBurned: number;
  loggedAt: string;
}

export interface WorkoutTemplate {
  id: string;
  userId: string;
  name: string;
  exercises: Omit<WorkoutExercise, 'sets'>[];
}

interface WorkoutState {
  todayWorkouts: Workout[];
  exercises: Exercise[];
  templates: WorkoutTemplate[];
}

interface WorkoutActions {
  /** Fetch all workouts logged today */
  fetchTodayWorkouts: () => Promise<void>;
  /** Fetch the exercise library */
  fetchExercises: () => Promise<void>;
  /** Log a completed workout */
  logWorkout: (workout: Omit<Workout, 'id' | 'userId' | 'loggedAt'>) => Promise<void>;
  /** Fetch saved workout templates */
  fetchTemplates: () => Promise<void>;
  /** Save a new workout template */
  saveTemplate: (template: Omit<WorkoutTemplate, 'id' | 'userId'>) => Promise<void>;
}

type WorkoutStore = WorkoutState & WorkoutActions;

// ── Store ────────────────────────────────────────────────────────

export const useWorkoutStore = create<WorkoutStore>((set) => ({
  todayWorkouts: [],
  exercises: [],
  templates: [],

  fetchTodayWorkouts: async () => {
    try {
      const workouts = await apiGet<Workout[]>('/workout/today');
      set({ todayWorkouts: workouts });
    } catch (error) {
      console.error('Failed to fetch today workouts:', error);
    }
  },

  fetchExercises: async () => {
    try {
      const exercises = await apiGet<Exercise[]>('/workout/exercises');
      set({ exercises });
    } catch (error) {
      console.error('Failed to fetch exercises:', error);
    }
  },

  logWorkout: async (workout) => {
    try {
      const saved = await post<Workout>('/workout/log', workout);
      set((state) => ({
        todayWorkouts: [...state.todayWorkouts, saved],
      }));
    } catch (error) {
      console.error('Failed to log workout:', error);
      throw error;
    }
  },

  fetchTemplates: async () => {
    try {
      const templates = await apiGet<WorkoutTemplate[]>('/workout/templates');
      set({ templates });
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    }
  },

  saveTemplate: async (template) => {
    try {
      const saved = await post<WorkoutTemplate>('/workout/templates', template);
      set((state) => ({
        templates: [...state.templates, saved],
      }));
    } catch (error) {
      console.error('Failed to save template:', error);
      throw error;
    }
  },
}));
