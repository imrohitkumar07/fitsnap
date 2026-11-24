/**
 * CalorieSphere3D.tsx
 * A glossy glass sphere with an animated liquid/glow level showing calories consumed.
 */

import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

interface CalorieSphere3DProps {
  current?: number;
  goal?: number;
  burned?: number;
}

export const CalorieSphere3D: React.FC<CalorieSphere3DProps> = ({
  current = 1450,
  goal = 2000,
  burned = 320,
}) => {
  const sphereRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const fillRatio = Math.min(Math.max(current / (goal || 2000), 0.05), 1.0);
  const targetScale = fillRatio * 1.35;

  useFrame((state, delta) => {
    if (sphereRef.current) {
      sphereRef.current.rotation.y += delta * 0.3;
    }
    if (innerRef.current) {
      innerRef.current.rotation.y -= delta * 0.2;
      // Gentle pulse
      const t = state.clock.getElapsedTime();
      const pulse = Math.sin(t * 2) * 0.03;
      innerRef.current.scale.set(targetScale + pulse, targetScale + pulse, targetScale + pulse);
    }
  });

  return (
    <group
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* Outer Glass Shell */}
      <mesh ref={sphereRef}>
        <sphereGeometry args={[1.5, 32, 32]} />
        <meshPhysicalMaterial
          color="#38bdf8"
          transmission={0.85}
          roughness={0.15}
          metalness={0.1}
          thickness={0.8}
          transparent
          opacity={0.6}
        />
      </mesh>

      {/* Inner Glowing Calorie Core */}
      <mesh ref={innerRef} position={[0, -0.2, 0]}>
        <sphereGeometry args={[1.0, 32, 32]} />
        <meshStandardMaterial
          color={fillRatio >= 1.0 ? '#ef4444' : '#3b82f6'}
          emissive={fillRatio >= 1.0 ? '#f87171' : '#60a5fa'}
          emissiveIntensity={0.6}
          roughness={0.3}
          metalness={0.2}
          transparent
          opacity={0.85}
        />
      </mesh>

      {/* Orbiting Energy Ring */}
      <mesh rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[1.75, 0.03, 16, 64]} />
        <meshStandardMaterial
          color="#60a5fa"
          emissive="#93c5fd"
          emissiveIntensity={0.8}
        />
      </mesh>

      {/* Overlay HTML readout */}
      <Html position={[0, 0, 0]} center>
        <div className="flex flex-col items-center pointer-events-none select-none text-center">
          <span className="text-2xl font-black text-white drop-shadow-md tracking-tight">
            {Math.round(current)}
          </span>
          <span className="text-[11px] font-medium text-slate-300 uppercase tracking-widest">
            / {goal} kcal
          </span>
          {hovered && (
            <div className="mt-2 rounded-xl bg-slate-900/90 px-2.5 py-1 text-[10px] text-brand-300 border border-white/20 whitespace-nowrap shadow-lg">
              Burned: -{Math.round(burned)} kcal
            </div>
          )}
        </div>
      </Html>
    </group>
  );
};

export default CalorieSphere3D;
