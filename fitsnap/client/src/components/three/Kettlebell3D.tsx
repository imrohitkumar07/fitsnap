/**
 * Kettlebell3D.tsx
 * Procedural metallic 3D kettlebell with cast-iron texture and smooth rotation.
 */

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface Kettlebell3DProps {
  scale?: number;
  autoRotate?: boolean;
}

export const Kettlebell3D: React.FC<Kettlebell3DProps> = ({
  scale = 1.0,
  autoRotate = true,
}) => {
  const meshRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (autoRotate && meshRef.current) {
      meshRef.current.rotation.y += delta * 0.6;
    }
  });

  const ironMaterial = (
    <meshStandardMaterial
      color="#1e293b"
      roughness={0.4}
      metalness={0.7}
    />
  );

  return (
    <group ref={meshRef} scale={[scale, scale, scale]} position={[0, -0.3, 0]}>
      {/* Kettlebell Bell Body */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.75, 32, 32]} />
        {ironMaterial}
      </mesh>

      {/* Flat bottom base */}
      <mesh position={[0, -0.7, 0]}>
        <cylinderGeometry args={[0.45, 0.45, 0.1, 32]} />
        {ironMaterial}
      </mesh>

      {/* Handle Base Pillars */}
      <mesh position={[-0.32, 0.68, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.45, 16]} />
        {ironMaterial}
      </mesh>
      <mesh position={[0.32, 0.68, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.45, 16]} />
        {ironMaterial}
      </mesh>

      {/* Top Handle Torus Arc */}
      <mesh position={[0, 0.85, 0]}>
        <torusGeometry args={[0.34, 0.08, 16, 32, Math.PI]} />
        <meshStandardMaterial
          color="#334155"
          roughness={0.2}
          metalness={0.9}
        />
      </mesh>

      {/* Brand Stripe ring around bell */}
      <mesh position={[0, 0.1, 0]}>
        <torusGeometry args={[0.76, 0.02, 16, 48]} />
        <meshStandardMaterial
          color="#38bdf8"
          emissive="#0284c7"
          emissiveIntensity={0.6}
        />
      </mesh>
    </group>
  );
};

export default Kettlebell3D;
