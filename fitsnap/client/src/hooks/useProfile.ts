import { useState, useEffect, useCallback } from 'react';
import { get, put } from '../api/client';

export interface UserProfile {
  id?: string;
  name: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  heightCm: number;
  weightKg: number;
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive';
  goal: 'lose' | 'maintain' | 'gain';
  bmr?: number;
  tdee?: number;
}

export interface UserGoals {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  waterMl: number;
}

interface UseProfileReturn {
  profile: UserProfile | null;
  goal: UserGoals | null;
  isLoading: boolean;
  error: string | null;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useProfile(): UseProfileReturn {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [goal, setGoal] = useState<UserGoals | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res: any = await get('/profile');
      if (res.data) {
        setProfile(res.data.profile);
        setGoal(res.data.goal);
      }
    } catch (err: any) {
      const status = err.response?.status;
      if (status !== 404) {
        setError('Failed to load profile');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updateProfile = useCallback(async (data: Partial<UserProfile>) => {
    try {
      const res: any = await put('/profile', data);
      if (res.data) {
        setProfile(res.data.profile);
        setGoal(res.data.goal);
      }
    } catch {
      throw new Error('Failed to update profile');
    }
  }, []);

  return {
    profile,
    goal,
    isLoading,
    error,
    updateProfile,
    refetch: fetchProfile,
  };
}
