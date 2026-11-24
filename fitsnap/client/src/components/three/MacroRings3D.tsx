/**
 * MacroRings3D.tsx
 * Three concentric glowing rings displaying Protein (blue), Carbs (amber), and Fat (pink).
 * Interactive on hover/touch to display live progress percentages.
 */

import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

interface MacroItem {
  current: number;
  goal: number;
}

interface MacroRings3DProps {
  protein?: MacroItem;
  carbs?: MacroItem;
  fat?: MacroItem;
}

const SingleRing: React.FC<{
  radius: number;
  tube: number;
  color: string;
  fraction: number;
  label: string;
  valueText: string;
  rotationOffset: number;
}> = ({ radius, tube, color, fraction, label, valueText, rotationOffset }) => {
  const [hovered, setHovered] = useState(false);
  const ringRef = useRef<THREE.Group>(null);

  // Cap fraction at 1.0 for arc length
  const validFraction = Math.max(0.02, Math.min(fraction, 1.0));
  const arcLength = validFraction * Math.PI * 2;

  return (
    <group
      ref={ringRef}
      rotation={[0, 0, rotationOffset]}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* Background track ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, tube * 0.75, 16, 64, Math.PI * 2]} />
        <meshStandardMaterial
          color="#1e293b"
          opacity={0.35}
          transparent
          roughness={0.7}
        />
      </mesh>

      {/* Progress ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, tube, 24, 64, arcLength]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered ? 0.6 : 0.35}
          roughness={0.25}
          metalness={0.4}
        />
      </mesh>

      {/* Interactive Tooltip */}
      {hovered && (
        <Html position={[0, radius + 0.35, 0]} center distanceFactor={8}>
          <div className="pointer-events-none rounded-xl bg-slate-900/90 px-2.5 py-1 text-[11px] font-semibold text-white shadow-xl backdrop-blur-md border border-white/20 whitespace-nowrap">
            <span style={{ color }}>{label}</span>: {valueText} ({Math.round(fraction * 100)}%)
          </div>
        </Html>
      )}
    </group>
  );
};

export const MacroRings3D: React.FC<MacroRings3DProps> = ({
  protein = { current: 85, goal: 120 },
  carbs = { current: 180, goal: 250 },
  fat = { current: 45, goal: 65 },
}) => {
  const groupRef = useRef<THREE.Group>(null);

  // Subtle breathing rotation
  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.z += delta * 0.15;
    }
  });

  const pRatio = protein.goal > 0 ? protein.current / protein.goal : 0;
  const cRatio = carbs.goal > 0 ? carbs.current / carbs.goal : 0;
  const fRatio = fat.goal > 0 ? fat.current / fat.goal : 0;

  return (
    <group ref={groupRef} rotation={[-Math.PI / 4, 0, 0]}>
      {/* Outer: Fat (Pink #f472b6) */}
      <SingleRing
        radius={1.7}
        tube={0.09}
        color="#f472b6"
        fraction={fRatio}
        label="Fat"
        valueText={`${Math.round(fat.current)}g / ${fat.goal}g`}
        rotationOffset={0}
      />

      {/* Middle: Carbs (Amber #fbbf24) */}
      <SingleRing
        radius={1.35}
        tube={0.09}
        color="#fbbf24"
        fraction={cRatio}
        label="Carbs"
        valueText={`${Math.round(carbs.current)}g / ${carbs.goal}g`}
        rotationOffset={Math.PI / 3}
      />

      {/* Inner: Protein (Blue #60a5fa) */}
      <SingleRing
        radius={1.0}
        tube={0.09}
        color="#60a5fa"
        fraction={pRatio}
        label="Protein"
        valueText={`${Math.round(protein.current)}g / ${protein.goal}g`}
        rotationOffset={Math.PI / 2}
      />
    </group>
  );
};

export default MacroRings3D;
