/**
 * FitSnap - WorkoutLog Page
 * 3D rotating Dumbbell, workout templates, recent sessions, and PR badges.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { SceneWrapper } from '../components/three/SceneWrapper';
import { Dumbbell3D } from '../components/three/Dumbbell3D';
import { EmptyState } from '../components/ui/EmptyState';
import { get } from '../api/client';

export const WorkoutLog: React.FC = () => {
  const navigate = useNavigate();
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [prs, setPrs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWorkoutData = async () => {
    try {
      setLoading(true);
      const res = await get('/workouts/history');
      if (res.data) {
        setWorkouts(res.data.history || []);
        setPrs(res.data.personalRecords || []);
      }
    } catch (err) {
      console.error('Failed to load workout history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkoutData();
  }, []);

  return (
    <div className="min-h-screen pb-24 pt-4 px-4 max-w-md mx-auto space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <span className="text-[11px] font-semibold text-brand-400 uppercase tracking-widest">
            Training & Fitness
          </span>
          <h1 className="text-2xl font-black text-white">Workouts</h1>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => navigate('/workout/session')}
          className="shadow-glow"
        >
          ⚡ Start Workout
        </Button>
      </div>

      {/* 3D Dumbbell Hero Banner */}
      <GlassCard className="p-4 text-center relative overflow-hidden">
        <SceneWrapper height="180px" iconType="workout">
          <Dumbbell3D scale={1.0} autoRotate={true} />
        </SceneWrapper>

        <div className="mt-2">
          <h3 className="text-base font-bold text-white">Ready to Train?</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Track strength sets, cardio distance, and calories burned with precision MET equations.
          </p>
        </div>

        <div className="pt-3">
          <Button
            variant="primary"
            size="lg"
            className="w-full shadow-glow"
            onClick={() => navigate('/workout/session')}
          >
            Start New Session
          </Button>
        </div>
      </GlassCard>

      {/* Exercise Library Shortcut */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Exercise Library
        </span>
        <button
          onClick={() => navigate('/workout/exercises')}
          className="text-xs text-brand-400 hover:text-brand-300 font-semibold"
        >
          Browse All (40+) →
        </button>
      </div>

      {/* Personal Records (PRs) */}
      {prs.length > 0 && (
        <GlassCard className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              🏆 Personal Records (PRs)
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {prs.slice(0, 4).map((pr, idx) => (
              <div
                key={idx}
                className="p-3 rounded-2xl bg-amber-500/10 border border-amber-400/20 text-center"
              >
                <span className="text-[10px] text-amber-300 font-semibold truncate block">
                  {pr.exerciseName}
                </span>
                <span className="text-base font-black text-white mt-1 block">
                  {pr.weightKg} kg
                </span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Recent Workouts */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
          Recent Sessions
        </span>

        {workouts.length === 0 && !loading ? (
          <EmptyState
            icon={<span className="text-3xl">🏋️‍♂️</span>}
            title="No Workouts Logged Yet"
            description="Hit the gym or start a cardio run to log your first session and track burned calories."
            actionLabel="Start First Workout"
            onAction={() => navigate('/workout/session')}
          />
        ) : (
          workouts.map((w) => (
            <GlassCard key={w.id} className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">{w.name}</h4>
                  <span className="text-[10px] text-slate-400">
                    {(() => {
                      try {
                        const d = new Date(w.date);
                        return !isNaN(d.getTime()) ? d.toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Today';
                      } catch {
                        return 'Today';
                      }
                    })()} • {w.durationMin} mins
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black text-emerald-400 block">
                    -{w.caloriesBurned} kcal
                  </span>
                  <span className="text-[10px] text-slate-400 capitalize">{w.type}</span>
                </div>
              </div>

              {w.exercises?.length > 0 && (
                <div className="pt-2 border-t border-white/5 space-y-1">
                  {w.exercises.map((ex: any) => (
                    <div key={ex.id} className="flex justify-between text-xs text-slate-300">
                      <span>{ex.exercise?.name}</span>
                      <span className="text-slate-400">
                        {ex.sets && ex.reps ? `${ex.sets} × ${ex.reps} @ ${ex.weightKg || 0}kg` : `${ex.durationMin || 0} mins`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          ))
        )}
      </div>
    </div>
  );
};

export default WorkoutLog;
