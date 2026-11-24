/**
 * Dumbbell3D.tsx
 * Procedural metallic 3D dumbbell with smooth rotation and interactive drag.
 */

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface Dumbbell3DProps {
  scale?: number;
  autoRotate?: boolean;
}

export const Dumbbell3D: React.FC<Dumbbell3DProps> = ({
  scale = 1.0,
  autoRotate = true,
}) => {
  const meshRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (autoRotate && meshRef.current) {
      meshRef.current.rotation.y += delta * 0.7;
      meshRef.current.rotation.x = Math.sin(Date.now() * 0.001) * 0.15;
    }
  });

  const plateMaterial = (
    <meshStandardMaterial
      color="#334155"
      roughness={0.25}
      metalness={0.85}
    />
  );

  const barMaterial = (
    <meshStandardMaterial
      color="#cbd5e1"
      roughness={0.15}
      metalness={0.95}
    />
  );

  const accentMaterial = (
    <meshStandardMaterial
      color="#3b82f6"
      emissive="#2563eb"
      emissiveIntensity={0.4}
      roughness={0.3}
      metalness={0.7}
    />
  );

  return (
    <group ref={meshRef} scale={[scale, scale, scale]} rotation={[0.4, 0.5, 0]}>
      {/* Center Handle Bar */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.07, 0.07, 1.8, 24]} />
        {barMaterial}
      </mesh>

      {/* Grip Knurling Center Ring */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.08, 0.08, 0.7, 24]} />
        <meshStandardMaterial color="#64748b" roughness={0.6} metalness={0.8} />
      </mesh>

      {/* Left Outer Plate */}
      <mesh position={[-0.8, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.48, 0.48, 0.14, 32]} />
        {plateMaterial}
      </mesh>

      {/* Left Inner Plate */}
      <mesh position={[-0.65, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.4, 0.4, 0.12, 32]} />
        {accentMaterial}
      </mesh>

      {/* Left Collar Collar */}
      <mesh position={[-0.52, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.15, 0.15, 0.08, 24]} />
        {barMaterial}
      </mesh>

      {/* Right Outer Plate */}
      <mesh position={[0.8, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.48, 0.48, 0.14, 32]} />
        {plateMaterial}
      </mesh>

      {/* Right Inner Plate */}
      <mesh position={[0.65, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.4, 0.4, 0.12, 32]} />
        {accentMaterial}
      </mesh>

      {/* Right Collar */}
      <mesh position={[0.52, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.15, 0.15, 0.08, 24]} />
        {barMaterial}
      </mesh>
    </group>
  );
};

export default Dumbbell3D;
