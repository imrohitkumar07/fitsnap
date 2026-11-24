/**
 * BadgeTrophy3D.tsx
 * Metallic gold achievement trophy/medal that users can rotate on touch/drag.
 */

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

interface BadgeTrophy3DProps {
  type?: 'trophy' | 'medal' | 'star';
  title?: string;
  unlocked?: boolean;
}

export const BadgeTrophy3D: React.FC<BadgeTrophy3DProps> = ({
  title = 'Achievement',
  unlocked = true,
}) => {
  const trophyRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (trophyRef.current) {
      trophyRef.current.rotation.y += delta * 0.7;
    }
  });

  const goldMaterial = (
    <meshStandardMaterial
      color={unlocked ? '#fbbf24' : '#64748b'}
      emissive={unlocked ? '#d97706' : '#334155'}
      emissiveIntensity={unlocked ? 0.4 : 0.1}
      roughness={0.15}
      metalness={0.9}
    />
  );

  const pedestalMaterial = (
    <meshStandardMaterial
      color="#1e293b"
      roughness={0.3}
      metalness={0.7}
    />
  );

  return (
    <group ref={trophyRef} position={[0, -0.4, 0]}>
      {/* Octagonal/Cylindrical Base Pedestal */}
      <mesh position={[0, -0.6, 0]}>
        <cylinderGeometry args={[0.7, 0.8, 0.35, 16]} />
        {pedestalMaterial}
      </mesh>

      {/* Trophy Stem */}
      <mesh position={[0, -0.2, 0]}>
        <cylinderGeometry args={[0.16, 0.22, 0.5, 16]} />
        {goldMaterial}
      </mesh>

      {/* Trophy Cup Body */}
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.65, 0.3, 0.7, 24, 1, false]} />
        {goldMaterial}
      </mesh>

      {/* Left Handle */}
      <mesh position={[-0.6, 0.3, 0]}>
        <torusGeometry args={[0.25, 0.06, 12, 24]} />
        {goldMaterial}
      </mesh>

      {/* Right Handle */}
      <mesh position={[0.6, 0.3, 0]}>
        <torusGeometry args={[0.25, 0.06, 12, 24]} />
        {goldMaterial}
      </mesh>

      {/* Label under trophy */}
      {title && (
        <Html position={[0, -1.05, 0]} center>
          <span className="text-[11px] font-bold text-white whitespace-nowrap bg-slate-900/80 px-2.5 py-0.5 rounded-full border border-white/10">
            {title}
          </span>
        </Html>
      )}
    </group>
  );
};

export default BadgeTrophy3D;
