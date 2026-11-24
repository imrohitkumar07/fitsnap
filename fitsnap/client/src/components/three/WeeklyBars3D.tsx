/**
 * WeeklyBars3D.tsx
 * 7 procedural rounded 3D bar columns for weekly data, with hover details and interactive selection.
 */

import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';

interface DayData {
  day: string;
  calories: number;
  burned?: number;
  isToday?: boolean;
}

interface WeeklyBars3DProps {
  data?: DayData[];
  goal?: number;
  onSelectDay?: (day: DayData) => void;
}

const DEFAULT_DAYS: DayData[] = [
  { day: 'Mon', calories: 1850, burned: 350 },
  { day: 'Tue', calories: 2100, burned: 420 },
  { day: 'Wed', calories: 1750, burned: 300 },
  { day: 'Thu', calories: 2050, burned: 510 },
  { day: 'Fri', calories: 2200, burned: 450 },
  { day: 'Sat', calories: 1950, burned: 380 },
  { day: 'Sun', calories: 1450, burned: 200, isToday: true },
];

export const WeeklyBars3D: React.FC<WeeklyBars3DProps> = ({
  data = DEFAULT_DAYS,
  goal = 2000,
  onSelectDay,
}) => {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const maxCalories = Math.max(...data.map((d) => d.calories), goal * 1.2);
  const maxHeight = 2.4;

  const barWidth = 0.38;
  const spacing = 0.65;
  const startX = -((data.length - 1) * spacing) / 2;

  return (
    <group position={[0, -0.6, 0]}>
      {/* Baseline ground plate */}
      <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[5.2, 1.2]} />
        <meshStandardMaterial color="#0f172a" roughness={0.8} />
      </mesh>

      {/* Goal reference dashed line */}
      <group position={[0, (goal / maxCalories) * maxHeight, 0]}>
        <mesh>
          <boxGeometry args={[4.8, 0.02, 0.02]} />
          <meshBasicMaterial color="#94a3b8" opacity={0.4} transparent />
        </mesh>
      </group>

      {/* 7 Interactive Bars */}
      {data.map((item, idx) => {
        const height = Math.max(0.2, (item.calories / maxCalories) * maxHeight);
        const xPos = startX + idx * spacing;
        const isSelected = selectedIdx === idx;
        const isOverGoal = item.calories > goal;

        const barColor = item.isToday
          ? '#38bdf8'
          : isOverGoal
          ? '#fbbf24'
          : '#3b82f6';

        return (
          <group
            key={item.day}
            position={[xPos, 0, 0]}
            onPointerOver={(e) => {
              e.stopPropagation();
              setSelectedIdx(idx);
            }}
            onPointerOut={() => setSelectedIdx(null)}
            onClick={() => {
              setSelectedIdx(idx);
              onSelectDay?.(item);
            }}
          >
            {/* 3D Bar */}
            <mesh position={[0, height / 2, 0]}>
              <boxGeometry args={[barWidth, height, barWidth]} />
              <meshStandardMaterial
                color={barColor}
                emissive={barColor}
                emissiveIntensity={isSelected ? 0.6 : 0.25}
                roughness={0.2}
                metalness={0.3}
              />
            </mesh>

            {/* Day Label */}
            <Html position={[0, -0.3, 0]} center distanceFactor={8}>
              <div
                className={`text-[10px] font-bold select-none cursor-pointer tracking-wider ${
                  item.isToday ? 'text-brand-400 font-extrabold' : 'text-slate-400'
                }`}
              >
                {item.day}
              </div>
            </Html>

            {/* Hover details badge */}
            {isSelected && (
              <Html position={[0, height + 0.4, 0]} center distanceFactor={8}>
                <div className="pointer-events-none rounded-xl bg-slate-900/95 px-2.5 py-1 text-center shadow-xl backdrop-blur-md border border-white/20 whitespace-nowrap z-20">
                  <div className="text-[11px] font-extrabold text-white">
                    {item.calories} kcal
                  </div>
                  {item.burned ? (
                    <div className="text-[9px] text-brand-300">
                      -{item.burned} burned
                    </div>
                  ) : null}
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
};

export default WeeklyBars3D;
