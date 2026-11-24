/**
 * FitSnap - History & Trends Page
 * Interactive calendar date picker, 7-day and 30-day calorie adherence,
 * 3D procedural weekly bar columns, weight moving average trends, and hydration charts.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar as CalendarIcon,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Droplets,
  Flame,
  Box,
  BarChart2,
} from 'lucide-react';
import { useDateStore } from '../store/dateStore';
import { get } from '../api/client';
import { toast } from '../components/ui/Toast';
import SceneWrapper from '../components/three/SceneWrapper';
import { WeeklyBars3D } from '../components/three/WeeklyBars3D';
import WeightLineChart from '../components/charts/WeightLineChart';

export const History: React.FC = () => {
  const navigate = useNavigate();
  const { setSelectedDate } = useDateStore();

  const [timeRange, setTimeRange] = useState<'7' | '30'>('7');
  const [view3D, setView3D] = useState(false);
  const [loading, setLoading] = useState(true);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [weightHistory, setWeightHistory] = useState<any[]>([]);
  const [weightTrend, setWeightTrend] = useState<any>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const [histRes, weightRes] = await Promise.all([
        get(`/dashboard/history?days=${timeRange}`),
        get('/weight/history'),
      ]);

      if (histRes.data) {
        setHistoryData(histRes.data);
      }
      if (weightRes.data) {
        setWeightHistory(weightRes.data || []);
        setWeightTrend(weightRes.trend || null);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
      toast.error('Failed to load history metrics.');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Aggregate stats
  const totalDays = historyData.length;
  const daysOnTarget = historyData.filter((d) => d.onTarget).length;
  const avgCalories =
    totalDays > 0
      ? Math.round(historyData.reduce((s, d) => s + (d.calories || 0), 0) / totalDays)
      : 0;
  const avgProtein =
    totalDays > 0
      ? Math.round(historyData.reduce((s, d) => s + (d.protein || 0), 0) / totalDays)
      : 0;
  const adherenceRate = totalDays > 0 ? Math.round((daysOnTarget / totalDays) * 100) : 0;

  const handleSelectDate = (dateStr: string) => {
    setSelectedDate(dateStr);
    toast.info(`Loaded data for ${dateStr}`);
    navigate('/dashboard');
  };

  const formatSafeDate = (dateVal: string | Date, opts?: Intl.DateTimeFormatOptions) => {
    try {
      const parsed = new Date(dateVal);
      if (isNaN(parsed.getTime())) return 'Today';
      return parsed.toLocaleDateString([], opts || { weekday: 'short' });
    } catch {
      return 'Today';
    }
  };

  const weekly3DData = historyData.slice(0, 7).map((d) => ({
    day: formatSafeDate(d.date, { weekday: 'short' }),
    calories: d.calories || 0,
    burned: d.burned || 0,
    isToday: d.isToday,
  })).reverse();

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-200 pb-12">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#2F5BFF] font-mono">
            LONGITUDINAL ANALYTICS
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-[#0F172A] dark:text-white tracking-tight">
            Nutrition History &amp; Trends
          </h1>
          <p className="text-xs sm:text-sm text-[#475569] dark:text-[#94A3B8] mt-0.5">
            Monitor nutritional consistency and calorie goal adherence over time.
          </p>
        </div>

        {/* Range Toggle (7 Days vs 30 Days) */}
        <div className="inline-flex p-1 rounded-xl bg-white dark:bg-white/5 border border-[#0F172A]/[0.08] dark:border-white/10 shadow-subtle self-start sm:self-auto">
          <button
            onClick={() => setTimeRange('7')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              timeRange === '7'
                ? 'bg-[#2F5BFF] text-white shadow-subtle'
                : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A]'
            }`}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => setTimeRange('30')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              timeRange === '30'
                ? 'bg-[#2F5BFF] text-white shadow-subtle'
                : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A]'
            }`}
          >
            Last 30 Days
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#12151D] rounded-card border border-[#0F172A]/[0.08] dark:border-white/10 p-4 shadow-subtle">
          <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block">
            Adherence Rate
          </span>
          <span className="text-2xl font-bold font-display text-[#16A34A] mt-1 block">
            {adherenceRate}%
          </span>
          <span className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
            {daysOnTarget} of {totalDays} days on target
          </span>
        </div>

        <div className="bg-white dark:bg-[#12151D] rounded-card border border-[#0F172A]/[0.08] dark:border-white/10 p-4 shadow-subtle">
          <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block">
            Average Calories
          </span>
          <span className="text-2xl font-bold font-display text-[#0F172A] dark:text-white mt-1 block">
            {avgCalories}
          </span>
          <span className="text-[11px] text-[#94A3B8]">kcal / day</span>
        </div>

        <div className="bg-white dark:bg-[#12151D] rounded-card border border-[#0F172A]/[0.08] dark:border-white/10 p-4 shadow-subtle">
          <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block">
            Average Protein
          </span>
          <span className="text-2xl font-bold font-display text-[#2F5BFF] mt-1 block">
            {avgProtein}g
          </span>
          <span className="text-[11px] text-[#94A3B8]">grams / day</span>
        </div>

        <div className="bg-white dark:bg-[#12151D] rounded-card border border-[#0F172A]/[0.08] dark:border-white/10 p-4 shadow-subtle">
          <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block">
            Net Weight Change
          </span>
          <span className="text-2xl font-bold font-display text-[#38BDF8] mt-1 block">
            {weightTrend ? `${weightTrend.netChangeKg > 0 ? '+' : ''}${weightTrend.netChangeKg} kg` : '0 kg'}
          </span>
          <span className="text-[11px] text-[#94A3B8]">
            {weightTrend ? `Current: ${weightTrend.currentWeightKg} kg` : 'Log weight daily'}
          </span>
        </div>
      </div>

      {/* Primary Calorie Bar Chart (2D or 3D) */}
      <div className="bg-white dark:bg-[#12151D] rounded-card border border-[#0F172A]/[0.08] dark:border-white/10 shadow-subtle p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold font-display text-[#0F172A] dark:text-white">
              Calorie Intake vs Daily Goal
            </h2>
            <span className="text-xs text-[#94A3B8]">
              Target line: {historyData[0]?.targetCalories || 2200} kcal/day
            </span>
          </div>

          <div className="flex items-center gap-3">
            {timeRange === '7' && (
              <button
                onClick={() => setView3D(!view3D)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  view3D
                    ? 'bg-[#2F5BFF] text-white border-[#2F5BFF]'
                    : 'border-[#0F172A]/10 dark:border-white/10 text-[#475569] dark:text-[#94A3B8]'
                }`}
              >
                {view3D ? <BarChart2 className="w-3.5 h-3.5" /> : <Box className="w-3.5 h-3.5" />}
                <span>{view3D ? '2D View' : '3D Bars'}</span>
              </button>
            )}

            <div className="hidden sm:flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#2F5BFF]" />
                <span className="text-[#475569] dark:text-[#94A3B8]">Logged</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-[#16A34A]" />
                <span className="text-[#475569] dark:text-[#94A3B8]">Target</span>
              </div>
            </div>
          </div>
        </div>

        {view3D && timeRange === '7' ? (
          <div className="w-full h-64 relative bg-[#0F172A]/5 dark:bg-black/20 rounded-xl overflow-hidden">
            <SceneWrapper height="256px" fallbackIcon="chart">
              <WeeklyBars3D
                data={weekly3DData}
                goal={historyData[0]?.targetCalories || 2200}
              />
            </SceneWrapper>
          </div>
        ) : (
          <div className="h-56 flex items-end justify-between gap-1.5 sm:gap-2 pt-6 pb-2 border-b border-[#0F172A]/[0.06] dark:border-white/10">
            {historyData.map((d, idx) => {
              const heightPct = Math.min(Math.round(((d.calories || 0) / 2600) * 100), 100);
              return (
                <div
                  key={idx}
                  onClick={() => handleSelectDate(d.date)}
                  className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group cursor-pointer"
                  title={`${d.date}: ${d.calories} kcal`}
                >
                  <div
                    className={`w-full rounded-t-sm transition-all group-hover:opacity-80 ${
                      d.onTarget ? 'bg-[#2F5BFF]' : 'bg-[#93B5FD] dark:bg-[#2F5BFF]/60'
                    }`}
                    style={{ height: `${Math.max(heightPct, 6)}%` }}
                  />
                  <span className="text-[10px] font-mono text-[#94A3B8] transform -rotate-45 sm:rotate-0 origin-center truncate">
                    {d.shortDate || d.date.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-xs text-[#94A3B8] text-center">
          Click any bar to jump to that date's detailed food log.
        </p>
      </div>

      {/* Weight Progress & Moving Average Trend Chart */}
      <div className="bg-white dark:bg-[#12151D] rounded-card border border-[#0F172A]/[0.08] dark:border-white/10 shadow-subtle p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold font-display text-[#0F172A] dark:text-white">
              Weight Progress &amp; 7-Day Moving Average
            </h2>
            <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
              Smoothed trend projection filters out temporary daily water weight fluctuations.
            </p>
          </div>
          <span className="text-xs font-mono font-semibold text-[#38BDF8]">
            {weightHistory.length} scale logs
          </span>
        </div>

        <WeightLineChart data={weightHistory} />
      </div>

      {/* Historical Dates List with One-Click Jump */}
      <div className="bg-white dark:bg-[#12151D] rounded-card border border-[#0F172A]/[0.08] dark:border-white/10 shadow-subtle p-6 space-y-3">
        <h2 className="text-base font-bold font-display text-[#0F172A] dark:text-white">
          Daily Log Archive
        </h2>

        <div className="divide-y divide-[#0F172A]/[0.06] dark:divide-white/10 max-h-80 overflow-y-auto">
          {historyData.map((d, idx) => (
            <div
              key={idx}
              onClick={() => handleSelectDate(d.date)}
              className="py-3 flex items-center justify-between hover:bg-[#F7F8FA] dark:hover:bg-white/5 px-2 rounded-lg cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3">
                <CalendarIcon className="w-4 h-4 text-[#94A3B8]" />
                <div>
                  <span className="text-sm font-semibold text-[#0F172A] dark:text-white block">
                    {formatSafeDate(d.date, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  <span className="text-xs text-[#94A3B8]">
                    Protein: {d.protein || 0}g • Water: {d.water || 0}ml
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-bold text-[#0F172A] dark:text-white">
                  {d.calories || 0} kcal
                </span>
                {d.onTarget ? (
                  <span className="text-[10px] font-semibold text-[#16A34A] bg-[#16A34A]/10 px-2 py-0.5 rounded-full">
                    On Target
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-[#F59E0B] bg-[#F59E0B]/10 px-2 py-0.5 rounded-full">
                    Variance
                  </span>
                )}
                <ArrowRight className="w-4 h-4 text-[#94A3B8]" />
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default History;
