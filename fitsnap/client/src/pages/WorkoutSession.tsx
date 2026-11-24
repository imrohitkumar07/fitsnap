/**
 * FitSnap - WorkoutSession Page
 * Active live workout tracker with sets/reps/weight, 3D rest timer ring, and celebratory confetti.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { SceneWrapper } from '../components/three/SceneWrapper';
import { RestTimerRing3D } from '../components/three/RestTimerRing3D';
import { ConfettiBurst3D } from '../components/three/ConfettiBurst3D';
import { get, post } from '../api/client';
import { toast } from '../components/ui/Toast';
import type { WorkoutType } from '../../../shared/types';

export const WorkoutSession: React.FC = () => {
  const navigate = useNavigate();

  const [type, setType] = useState<WorkoutType>('strength');
  const [name, setName] = useState('Strength Workout');
  const [durationMin, setDurationMin] = useState(45);
  const [exercisesList, setExercisesList] = useState<any[]>([]);

  // Active workout exercises
  const [activeExercises, setActiveExercises] = useState<any[]>([
    {
      exerciseId: '',
      exerciseName: 'Barbell Bench Press',
      sets: 3,
      reps: 10,
      weightKg: 60,
    },
  ]);

  // 3D Rest Timer
  const [restSeconds, setRestSeconds] = useState(60);
  const [timerActive, setTimerActive] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch exercises from library
  useEffect(() => {
    const fetchLibrary = async () => {
      try {
        const res = await get('/workouts/exercises');
        if (res.data) {
          setExercisesList(res.data);
          if (res.data.length > 0 && !activeExercises[0].exerciseId) {
            setActiveExercises([
              {
                exerciseId: res.data[0].id,
                exerciseName: res.data[0].name,
                sets: 3,
                reps: 10,
                weightKg: 50,
              },
            ]);
          }
        }
      } catch (err) {
        console.error('Failed to load exercise library:', err);
      }
    };
    fetchLibrary();
  }, []);

  // Timer countdown
  useEffect(() => {
    let interval: any = null;
    if (timerActive && restSeconds > 0) {
      interval = setInterval(() => {
        setRestSeconds((prev) => prev - 1);
      }, 1000);
    } else if (restSeconds === 0) {
      setTimerActive(false);
      toast.success('Rest time over! Next set! 💥');
    }
    return () => clearInterval(interval);
  }, [timerActive, restSeconds]);

  const startRestTimer = (secs: number = 60) => {
    setRestSeconds(secs);
    setTimerActive(true);
  };

  const handleAddExercise = () => {
    const defaultEx = exercisesList[0] || { id: 'default', name: 'Exercise' };
    setActiveExercises((prev) => [
      ...prev,
      {
        exerciseId: defaultEx.id,
        exerciseName: defaultEx.name,
        sets: 3,
        reps: 10,
        weightKg: 40,
      },
    ]);
  };

  const handleUpdateExercise = (index: number, field: string, val: any) => {
    setActiveExercises((prev) =>
      prev.map((ex, i) => (i === index ? { ...ex, [field]: val } : ex))
    );
  };

  const handleRemoveExercise = (index: number) => {
    if (activeExercises.length <= 1) return;
    setActiveExercises((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFinishWorkout = async () => {
    setIsSaving(true);
    try {
      await post('/workouts', {
        type,
        name: name || `${type} session`,
        durationMin: Number(durationMin),
        exercises: activeExercises.map((ex, i) => ({
          exerciseId: ex.exerciseId || exercisesList[0]?.id,
          sets: Number(ex.sets || 3),
          reps: Number(ex.reps || 10),
          weightKg: Number(ex.weightKg || 0),
          order: i,
        })),
      });

      setShowConfetti(true);
      toast.success('Workout completed! Great work! 🎉');
      setTimeout(() => {
        navigate('/workout');
      }, 1800);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save workout');
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen pb-24 pt-4 px-4 max-w-md mx-auto space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() => navigate('/workout')}
          className="p-2 text-slate-300 hover:text-white rounded-full hover:bg-white/10"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-white">Active Session</h1>
        <div className="w-8" />
      </div>

      {/* Confetti celebration if finished */}
      {showConfetti && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          <SceneWrapper height="100vh">
            <ConfettiBurst3D active={true} count={100} />
          </SceneWrapper>
        </div>
      )}

      {/* Workout Overview Input */}
      <GlassCard className="p-4 space-y-3">
        <Input
          label="Workout Title"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Chest & Triceps"
        />

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Category
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as WorkoutType)}
              className="w-full rounded-2xl bg-slate-900/60 border border-white/15 px-3 py-2.5 text-xs text-white outline-none focus:border-brand-500"
            >
              <option value="strength">Strength</option>
              <option value="cardio">Cardio</option>
              <option value="yoga">Yoga</option>
              <option value="sports">Sports</option>
            </select>
          </div>

          <Input
            label="Duration (Mins)"
            type="number"
            min={5}
            max={240}
            value={durationMin}
            onChange={(e) => setDurationMin(Number(e.target.value))}
          />
        </div>
      </GlassCard>

      {/* 3D Rest Timer Ring Component */}
      <GlassCard className="p-4 text-center">
        <div className="flex items-center justify-between mb-1 px-1">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Between Sets Rest Timer
          </span>
          <span className="text-[10px] text-brand-400 font-semibold">
            {timerActive ? 'Active' : 'Paused'}
          </span>
        </div>

        <SceneWrapper height="190px" iconType="workout">
          <RestTimerRing3D
            totalSeconds={60}
            remainingSeconds={restSeconds}
            isActive={timerActive}
          />
        </SceneWrapper>

        <div className="flex justify-center gap-2 mt-2">
          <button
            onClick={() => startRestTimer(30)}
            className="px-3 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-[10px] font-bold text-slate-300 border border-white/10"
          >
            30s
          </button>
          <button
            onClick={() => startRestTimer(60)}
            className="px-3 py-1 rounded-xl bg-brand-500/20 hover:bg-brand-500/30 text-[10px] font-bold text-brand-300 border border-brand-500/30 shadow-glow"
          >
            60s Rest
          </button>
          <button
            onClick={() => startRestTimer(90)}
            className="px-3 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-[10px] font-bold text-slate-300 border border-white/10"
          >
            90s
          </button>
          {timerActive && (
            <button
              onClick={() => setTimerActive(false)}
              className="px-3 py-1 rounded-xl bg-red-500/20 text-[10px] font-bold text-red-300 border border-red-500/30"
            >
              Stop
            </button>
          )}
        </div>
      </GlassCard>

      {/* Exercises in Session */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Exercises ({activeExercises.length})
          </span>
          <button
            onClick={handleAddExercise}
            className="text-xs text-brand-400 hover:text-brand-300 font-semibold"
          >
            + Add Exercise
          </button>
        </div>

        {activeExercises.map((ex, idx) => (
          <GlassCard key={idx} className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <select
                value={ex.exerciseId}
                onChange={(e) => {
                  const selected = exercisesList.find((el) => el.id === e.target.value);
                  handleUpdateExercise(idx, 'exerciseId', e.target.value);
                  if (selected) handleUpdateExercise(idx, 'exerciseName', selected.name);
                }}
                className="bg-transparent text-sm font-bold text-white outline-none border-b border-white/20 pb-1 max-w-[220px]"
              >
                {exercisesList.map((el) => (
                  <option key={el.id} value={el.id} className="bg-slate-900 text-white">
                    {el.name} ({el.category})
                  </option>
                ))}
              </select>

              <button
                onClick={() => handleRemoveExercise(idx)}
                className="text-slate-500 hover:text-red-400 text-xs p-1"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Input
                label="Sets"
                type="number"
                min={1}
                max={20}
                value={ex.sets}
                onChange={(e) => handleUpdateExercise(idx, 'sets', Number(e.target.value))}
              />
              <Input
                label="Reps"
                type="number"
                min={1}
                max={100}
                value={ex.reps}
                onChange={(e) => handleUpdateExercise(idx, 'reps', Number(e.target.value))}
              />
              <Input
                label="Weight (kg)"
                type="number"
                min={0}
                max={500}
                step={2.5}
                value={ex.weightKg}
                onChange={(e) => handleUpdateExercise(idx, 'weightKg', Number(e.target.value))}
              />
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Finish Session Button */}
      <div className="pt-2">
        <Button
          variant="primary"
          size="lg"
          className="w-full shadow-glow-lg"
          onClick={handleFinishWorkout}
          isLoading={isSaving}
        >
          Finish Workout & Calculate Burned
        </Button>
      </div>
    </div>
  );
};

export default WorkoutSession;
