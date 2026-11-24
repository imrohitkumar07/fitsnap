/**
 * ScanAnimation3D.tsx
 * AI Vision analysis loading state: rotating plate with oscillating laser scanning ring.
 */

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

interface ScanAnimation3DProps {
  statusText?: string;
}

export const ScanAnimation3D: React.FC<ScanAnimation3DProps> = ({
  statusText = 'AI identifying food & estimating macros...',
}) => {
  const plateRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();

    // Plate rotation
    if (plateRef.current) {
      plateRef.current.rotation.y += delta * 0.8;
    }

    // Oscillating scanning laser ring (up and down)
    if (ringRef.current) {
      ringRef.current.position.y = Math.sin(t * 3.5) * 0.9;
    }

    // Swirling spark particles
    if (particlesRef.current) {
      particlesRef.current.rotation.y += delta * 1.5;
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* Subject: Food Plate */}
      <group ref={plateRef} position={[0, -0.4, 0]}>
        {/* Ceramic Plate */}
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[1.5, 1.2, 0.12, 32]} />
          <meshStandardMaterial
            color="#f8fafc"
            roughness={0.15}
            metalness={0.1}
          />
        </mesh>
        {/* Plate Rim */}
        <mesh position={[0, 0.06, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.4, 0.08, 16, 32]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.2} />
        </mesh>

        {/* Abstract food items on plate */}
        <mesh position={[-0.4, 0.15, 0.2]}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial color="#f59e0b" roughness={0.5} />
        </mesh>
        <mesh position={[0.4, 0.15, -0.2]}>
          <boxGeometry args={[0.5, 0.3, 0.5]} />
          <meshStandardMaterial color="#10b981" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.15, 0.3]}>
          <sphereGeometry args={[0.25, 16, 16]} />
          <meshStandardMaterial color="#ef4444" roughness={0.3} />
        </mesh>
      </group>

      {/* Moving Scanning Laser Ring */}
      <mesh ref={ringRef} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.7, 0.035, 16, 48]} />
        <meshStandardMaterial
          color="#38bdf8"
          emissive="#38bdf8"
          emissiveIntensity={1.2}
        />
      </mesh>

      {/* Conical scanning beam gradient */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[1.7, 1.3, 1.6, 32, 1, true]} />
        <meshBasicMaterial
          color="#38bdf8"
          transparent
          opacity={0.07}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Swirling Sparkles */}
      <group ref={particlesRef}>
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const angle = (i / 6) * Math.PI * 2;
          return (
            <mesh
              key={i}
              position={[Math.cos(angle) * 1.3, Math.sin(i * 1.5) * 0.5, Math.sin(angle) * 1.3]}
            >
              <sphereGeometry args={[0.04, 8, 8]} />
              <meshBasicMaterial color="#67e8f9" />
            </mesh>
          );
        })}
      </group>

      {/* Status Label */}
      <Html position={[0, -1.6, 0]} center>
        <div className="pointer-events-none text-center select-none">
          <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-900/90 px-4 py-2 border border-brand-500/30 backdrop-blur-md shadow-glow">
            <span className="w-2 h-2 rounded-full bg-brand-400 animate-ping" />
            <span className="text-xs font-semibold text-brand-300">
              {statusText}
            </span>
          </div>
        </div>
      </Html>
    </group>
  );
};

export default ScanAnimation3D;
