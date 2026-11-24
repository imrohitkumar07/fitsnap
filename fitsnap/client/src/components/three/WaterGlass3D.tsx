/**
 * WaterGlass3D.tsx
 * A translucent 3D glass with rising animated water and floating bubble particles.
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

interface WaterGlass3DProps {
  currentMl?: number;
  goalMl?: number;
  isPouring?: boolean;
}

export const WaterGlass3D: React.FC<WaterGlass3DProps> = ({
  currentMl = 1250,
  goalMl = 2500,
  isPouring = false,
}) => {
  const liquidRef = useRef<THREE.Mesh>(null);
  const bubblesGroup = useRef<THREE.Group>(null);

  // Fill fraction 0 to 1
  const targetFill = Math.min(Math.max(currentMl / (goalMl || 2500), 0.05), 1.0);
  const maxWaterHeight = 2.0;
  const currentHeight = targetFill * maxWaterHeight;

  // Generate random bubble positions
  const bubbles = useMemo(() => {
    return Array.from({ length: 15 }).map(() => ({
      x: (Math.random() - 0.5) * 1.0,
      y: (Math.random() - 0.5) * 1.5,
      z: (Math.random() - 0.5) * 1.0,
      speed: 0.5 + Math.random() * 1.0,
      size: 0.04 + Math.random() * 0.05,
    }));
  }, []);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();

    // Subtle wave on top surface of liquid
    if (liquidRef.current) {
      liquidRef.current.position.y = -1.0 + currentHeight / 2;
      liquidRef.current.scale.y = Math.max(0.01, currentHeight);
      if (isPouring) {
        liquidRef.current.rotation.y += delta * 2;
      }
    }

    // Animate bubbles floating up
    if (bubblesGroup.current) {
      bubblesGroup.current.children.forEach((bubble, i) => {
        const b = bubbles[i];
        bubble.position.y += delta * b.speed;
        if (bubble.position.y > -1.0 + currentHeight) {
          bubble.position.y = -1.0;
        }
      });
    }
  });

  return (
    <group position={[0, -0.2, 0]}>
      {/* Outer Glass Cylinder */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.9, 0.75, 2.3, 32, 1, true]} />
        <meshPhysicalMaterial
          color="#e0f2fe"
          transmission={0.9}
          roughness={0.1}
          metalness={0.05}
          thickness={0.5}
          transparent
          opacity={0.4}
        />
      </mesh>

      {/* Glass Base */}
      <mesh position={[0, -1.15, 0]}>
        <cylinderGeometry args={[0.75, 0.75, 0.1, 32]} />
        <meshPhysicalMaterial
          color="#bae6fd"
          roughness={0.2}
          transparent
          opacity={0.6}
        />
      </mesh>

      {/* Animated Water Mesh */}
      <mesh ref={liquidRef} position={[0, -1.0 + currentHeight / 2, 0]}>
        <cylinderGeometry args={[0.82, 0.7, 1.0, 32]} />
        <meshStandardMaterial
          color="#38bdf8"
          roughness={0.15}
          metalness={0.1}
          transparent
          opacity={0.75}
        />
      </mesh>

      {/* Floating Bubbles */}
      <group ref={bubblesGroup}>
        {bubbles.map((b, i) => (
          <mesh key={i} position={[b.x, b.y, b.z]}>
            <sphereGeometry args={[b.size, 12, 12]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive="#7dd3fc"
              emissiveIntensity={0.5}
              transparent
              opacity={0.7}
            />
          </mesh>
        ))}
      </group>

      {/* Center readout overlay */}
      <Html position={[0, -1.5, 0]} center>
        <div className="flex flex-col items-center pointer-events-none select-none text-center">
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black text-brand-400 drop-shadow">
              {currentMl}
            </span>
            <span className="text-xs text-slate-400">/ {goalMl} ml</span>
          </div>
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
            {Math.round((currentMl / (goalMl || 1)) * 100)}% of Goal
          </span>
        </div>
      </Html>
    </group>
  );
};

export default WaterGlass3D;
