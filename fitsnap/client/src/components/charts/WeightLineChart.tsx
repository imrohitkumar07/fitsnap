/**
 * FitSnap - Weight Progress 2D Line Chart (Recharts)
 * Visualizes daily scale weight along with a smoothed 7-day moving average trend line.
 */

import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

interface WeightEntry {
  date: string;
  weightKg: number;
  movingAverage7d?: number;
}

interface WeightLineChartProps {
  data: WeightEntry[];
}

export const WeightLineChart: React.FC<WeightLineChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-44 flex items-center justify-center text-xs text-slate-400">
        No weight history recorded yet.
      </div>
    );
  }

  const formattedData = data.map((d) => ({
    ...d,
    formattedDate: new Date(d.date).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    }),
  }));

  const weights = data.map((d) => d.weightKg);
  const minWeight = Math.floor(Math.min(...weights) - 1);
  const maxWeight = Math.ceil(Math.max(...weights) + 1);

  return (
    <div className="w-full h-52">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" />
          <XAxis
            dataKey="formattedDate"
            stroke="#94a3b8"
            fontSize={10}
            tickLine={false}
          />
          <YAxis
            domain={[minWeight, maxWeight]}
            stroke="#94a3b8"
            fontSize={10}
            tickLine={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload;
                return (
                  <div className="rounded-xl bg-[#0F172A] border border-white/20 p-2.5 text-xs shadow-xl text-white">
                    <p className="text-[#94A3B8] text-[10px]">{item.formattedDate}</p>
                    <p className="font-bold text-[#38BDF8]">{item.weightKg} kg (Logged)</p>
                    {item.movingAverage7d && (
                      <p className="font-semibold text-[#F59E0B]">
                        {item.movingAverage7d} kg (7-day Trend)
                      </p>
                    )}
                  </div>
                );
              }
              return null;
            }}
          />
          <Line
            type="monotone"
            dataKey="weightKg"
            name="Daily Weight"
            stroke="#38bdf8"
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#38bdf8', strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#0284C7' }}
          />
          <Line
            type="monotone"
            dataKey="movingAverage7d"
            name="7-day Trend"
            stroke="#F59E0B"
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default WeightLineChart;
