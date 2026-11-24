/**
 * RestTimerRing3D.tsx
 * 3D countdown torus ring for rest intervals between workout sets.
 */

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

interface RestTimerRing3DProps {
  totalSeconds?: number;
  remainingSeconds?: number;
  isActive?: boolean;
}

export const RestTimerRing3D: React.FC<RestTimerRing3DProps> = ({
  totalSeconds = 60,
  remainingSeconds = 45,
  isActive = true,
}) => {
  const ringRef = useRef<THREE.Group>(null);

  const ratio = Math.max(0.01, Math.min(remainingSeconds / (totalSeconds || 1), 1.0));
  const arcLength = ratio * Math.PI * 2;

  // Determine dynamic ring color based on urgency
  const ringColor = ratio > 0.5 ? '#10b981' : ratio > 0.25 ? '#fbbf24' : '#ef4444';

  useFrame((_, delta) => {
    if (ringRef.current && isActive) {
      ringRef.current.rotation.z -= delta * 0.4;
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* Background Track */}
      <mesh>
        <torusGeometry args={[1.5, 0.08, 16, 64]} />
        <meshStandardMaterial
          color="#1e293b"
          opacity={0.3}
          transparent
          roughness={0.7}
        />
      </mesh>

      {/* Dynamic Depleting Arc */}
      <group ref={ringRef} rotation={[0, 0, Math.PI / 2]}>
        <mesh>
          <torusGeometry args={[1.5, 0.1, 24, 64, arcLength]} />
          <meshStandardMaterial
            color={ringColor}
            emissive={ringColor}
            emissiveIntensity={0.6}
            roughness={0.2}
            metalness={0.3}
          />
        </mesh>
      </group>

      {/* Countdown Center Readout */}
      <Html position={[0, 0, 0]} center>
        <div className="flex flex-col items-center pointer-events-none select-none text-center">
          <span className="text-3xl font-black text-white tracking-tight drop-shadow-md">
            {remainingSeconds}s
          </span>
          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-0.5">
            Rest Timer
          </span>
        </div>
      </Html>
    </group>
  );
};

export default RestTimerRing3D;
