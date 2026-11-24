/**
 * FitSnap - Calorie & Burned 2D Bar Chart (Recharts)
 */

import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

interface DailyHistory {
  day: string;
  calories: number;
  burned: number;
}

interface CalorieHistoryChartProps {
  data: DailyHistory[];
}

export const CalorieHistoryChart: React.FC<CalorieHistoryChartProps> = ({ data }) => {
  return (
    <div className="w-full h-52">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="day" stroke="#94a3b8" fontSize={10} tickLine={false} />
          <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload;
                return (
                  <div className="rounded-xl bg-slate-900/90 border border-white/20 p-2 text-xs shadow-xl backdrop-blur-md">
                    <p className="text-slate-400 text-[10px] font-bold">{item.day}</p>
                    <p className="font-semibold text-brand-400">Eaten: {item.calories} kcal</p>
                    <p className="font-semibold text-emerald-400">Burned: {item.burned} kcal</p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
          <Bar dataKey="calories" name="Calories Eaten" fill="#38bdf8" radius={[4, 4, 0, 0]} />
          <Bar dataKey="burned" name="Calories Burned" fill="#10b981" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CalorieHistoryChart;
