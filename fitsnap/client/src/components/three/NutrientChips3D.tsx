/**
 * NutrientChips3D.tsx
 * Floating 3D chips displaying detected nutrients with gentle floating animations.
 */

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

interface NutrientData {
  label: string;
  value: string;
  color: string;
  subtext?: string;
}

interface NutrientChips3DProps {
  nutrients?: NutrientData[];
}

const DEFAULT_NUTRIENTS: NutrientData[] = [
  { label: 'Calories', value: '450 kcal', color: '#38bdf8', subtext: 'Est. Portion' },
  { label: 'Protein', value: '28g', color: '#60a5fa', subtext: '25% daily' },
  { label: 'Carbs', value: '45g', color: '#fbbf24', subtext: '18% daily' },
  { label: 'Fat', value: '14g', color: '#f472b6', subtext: '21% daily' },
];

export const NutrientChips3D: React.FC<NutrientChips3DProps> = ({
  nutrients = DEFAULT_NUTRIENTS,
}) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      const t = state.clock.getElapsedTime();
      groupRef.current.children.forEach((child, i) => {
        child.position.y += Math.sin(t * 2 + i * 1.2) * 0.0015;
      });
    }
  });

  const positions: [number, number, number][] = [
    [-1.2, 0.7, 0],
    [1.2, 0.7, 0],
    [-1.2, -0.7, 0],
    [1.2, -0.7, 0],
  ];

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {nutrients.slice(0, 4).map((nut, idx) => {
        const pos = positions[idx] || [0, 0, 0];

        return (
          <group key={nut.label} position={pos}>
            {/* 3D Glass Pill Plaque */}
            <mesh>
              <boxGeometry args={[1.7, 0.9, 0.1]} />
              <meshPhysicalMaterial
                color="#0f172a"
                roughness={0.2}
                metalness={0.1}
                transmission={0.4}
                transparent
                opacity={0.85}
              />
            </mesh>

            {/* Glowing Accent Border Pill */}
            <mesh position={[0, 0, 0.06]}>
              <boxGeometry args={[1.65, 0.85, 0.02]} />
              <meshStandardMaterial
                color={nut.color}
                emissive={nut.color}
                emissiveIntensity={0.3}
                transparent
                opacity={0.2}
              />
            </mesh>

            {/* HTML typography */}
            <Html position={[0, 0, 0.1]} center distanceFactor={8}>
              <div className="flex flex-col items-center pointer-events-none select-none text-center px-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {nut.label}
                </span>
                <span
                  className="text-sm font-black mt-0.5 tracking-tight"
                  style={{ color: nut.color }}
                >
                  {nut.value}
                </span>
                {nut.subtext && (
                  <span className="text-[9px] text-slate-400">
                    {nut.subtext}
                  </span>
                )}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
};

export default NutrientChips3D;
