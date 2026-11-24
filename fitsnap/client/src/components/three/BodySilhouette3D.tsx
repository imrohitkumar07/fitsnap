/**
 * BodySilhouette3D.tsx
 * Stylized 3D body silhouette displaying which muscle groups have been trained.
 * Regions are dynamically colored and illuminated based on workout intensity.
 */

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

interface BodySilhouette3DProps {
  muscleGroups?: Record<string, number>; // value 0.0 to 1.0
  onSelectMuscle?: (group: string) => void;
}

export const BodySilhouette3D: React.FC<BodySilhouette3DProps> = ({
  muscleGroups = { chest: 0.8, legs: 0.9, arms: 0.6, back: 0.4, core: 0.5, shoulders: 0.7 },
  onSelectMuscle,
}) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(Date.now() * 0.001) * 0.2;
    }
  });

  const getRegionMaterial = (intensity: number = 0) => {
    const isTrained = intensity > 0;
    const color = isTrained ? '#38bdf8' : '#334155';
    const emissive = isTrained ? '#0284c7' : '#0f172a';

    return (
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={intensity * 0.7}
        roughness={0.4}
        metalness={0.5}
      />
    );
  };

  return (
    <group ref={groupRef} position={[0, -0.2, 0]}>
      {/* Head */}
      <mesh position={[0, 1.45, 0]}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial color="#475569" roughness={0.5} />
      </mesh>

      {/* Shoulders */}
      <mesh
        position={[0, 1.05, 0]}
        onClick={() => onSelectMuscle?.('shoulders')}
      >
        <boxGeometry args={[1.1, 0.2, 0.3]} />
        {getRegionMaterial(muscleGroups.shoulders)}
      </mesh>

      {/* Chest */}
      <mesh
        position={[0, 0.8, 0]}
        onClick={() => onSelectMuscle?.('chest')}
      >
        <boxGeometry args={[0.75, 0.35, 0.3]} />
        {getRegionMaterial(muscleGroups.chest)}
      </mesh>

      {/* Core / Abs */}
      <mesh
        position={[0, 0.4, 0]}
        onClick={() => onSelectMuscle?.('core')}
      >
        <boxGeometry args={[0.6, 0.4, 0.25]} />
        {getRegionMaterial(muscleGroups.core)}
      </mesh>

      {/* Left Arm */}
      <mesh
        position={[-0.55, 0.7, 0]}
        rotation={[0, 0, 0.15]}
        onClick={() => onSelectMuscle?.('arms')}
      >
        <capsuleGeometry args={[0.09, 0.6, 8, 16]} />
        {getRegionMaterial(muscleGroups.arms)}
      </mesh>

      {/* Right Arm */}
      <mesh
        position={[0.55, 0.7, 0]}
        rotation={[0, 0, -0.15]}
        onClick={() => onSelectMuscle?.('arms')}
      >
        <capsuleGeometry args={[0.09, 0.6, 8, 16]} />
        {getRegionMaterial(muscleGroups.arms)}
      </mesh>

      {/* Left Leg */}
      <mesh
        position={[-0.22, -0.45, 0]}
        onClick={() => onSelectMuscle?.('legs')}
      >
        <capsuleGeometry args={[0.13, 0.9, 8, 16]} />
        {getRegionMaterial(muscleGroups.legs)}
      </mesh>

      {/* Right Leg */}
      <mesh
        position={[0.22, -0.45, 0]}
        onClick={() => onSelectMuscle?.('legs')}
      >
        <capsuleGeometry args={[0.13, 0.9, 8, 16]} />
        {getRegionMaterial(muscleGroups.legs)}
      </mesh>

      {/* Legend Badge */}
      <Html position={[0, -1.3, 0]} center>
        <div className="flex items-center gap-2 rounded-xl bg-slate-900/80 px-2.5 py-1 border border-white/10 select-none pointer-events-none whitespace-nowrap">
          <span className="w-2 h-2 rounded-full bg-brand-400 shadow-glow" />
          <span className="text-[10px] text-slate-300 font-semibold">
            Trained Muscle Groups
          </span>
        </div>
      </Html>
    </group>
  );
};

export default BodySilhouette3D;
