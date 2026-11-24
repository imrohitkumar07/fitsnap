/**
 * OnboardingScene3D.tsx
 * Welcoming 3D scene with floating procedural fitness primitives:
 * Dumbbell, Crisp Apple, and Water Drop that respond to onboarding step changes.
 */

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Dumbbell3D } from './Dumbbell3D';
import * as THREE from 'three';

interface OnboardingScene3DProps {
  step?: number;
}

export const OnboardingScene3D: React.FC<OnboardingScene3DProps> = ({ step = 0 }) => {
  const appleRef = useRef<THREE.Group>(null);
  const dropRef = useRef<THREE.Group>(null);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();

    // Apple bobbing
    if (appleRef.current) {
      appleRef.current.position.y = 0.5 + Math.sin(t * 2) * 0.12;
      appleRef.current.rotation.y += delta * 0.5;
    }

    // Water droplet bobbing
    if (dropRef.current) {
      dropRef.current.position.y = -0.5 + Math.sin(t * 2.5 + 1) * 0.15;
      dropRef.current.rotation.y += delta * 0.6;
    }

    // Reaction to step changes
    if (groupRef.current) {
      const targetRotationY = step * 0.4;
      groupRef.current.rotation.y += (targetRotationY - groupRef.current.rotation.y) * 0.05;
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Floating Dumbbell (Left/Center) */}
      <group position={[-0.9, -0.2, 0]}>
        <Dumbbell3D scale={0.75} autoRotate={true} />
      </group>

      {/* Floating Crisp Apple (Top Right) */}
      <group ref={appleRef} position={[0.9, 0.5, 0]}>
        {/* Apple Body */}
        <mesh>
          <sphereGeometry args={[0.42, 24, 24]} />
          <meshStandardMaterial
            color="#ef4444"
            emissive="#dc2626"
            emissiveIntensity={0.25}
            roughness={0.2}
            metalness={0.1}
          />
        </mesh>
        {/* Apple Stem */}
        <mesh position={[0, 0.42, 0]} rotation={[0, 0, 0.2]}>
          <cylinderGeometry args={[0.02, 0.02, 0.18, 8]} />
          <meshStandardMaterial color="#78350f" roughness={0.8} />
        </mesh>
        {/* Apple Leaf */}
        <mesh position={[0.07, 0.42, 0]} rotation={[0, 0, -0.5]}>
          <boxGeometry args={[0.12, 0.02, 0.06]} />
          <meshStandardMaterial color="#22c55e" roughness={0.4} />
        </mesh>
      </group>

      {/* Floating Water Droplet (Bottom Right) */}
      <group ref={dropRef} position={[0.9, -0.6, 0]}>
        {/* Teardrop geometry */}
        <mesh position={[0, -0.1, 0]}>
          <sphereGeometry args={[0.35, 24, 24]} />
          <meshPhysicalMaterial
            color="#38bdf8"
            transmission={0.8}
            roughness={0.1}
            metalness={0.1}
            transparent
            opacity={0.85}
          />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <coneGeometry args={[0.32, 0.4, 24]} />
          <meshPhysicalMaterial
            color="#38bdf8"
            transmission={0.8}
            roughness={0.1}
            metalness={0.1}
            transparent
            opacity={0.85}
          />
        </mesh>
      </group>
    </group>
  );
};

export default OnboardingScene3D;
