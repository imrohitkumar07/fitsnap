/**
 * AuthHeroScene3D.tsx
 * High-end interactive 3D hero scene for Login & Register screens.
 * Features a floating metallic dumbbell, glowing energy core, floating macro torus rings,
 * and sparkling cosmic particles that respond to mouse tilt / parallax.
 */

import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import * as THREE from 'three';

export const AuthHeroScene3D: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  const dumbbellRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);

  const { pointer } = useThree();

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();

    // Mouse parallax reaction
    if (groupRef.current) {
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        pointer.x * 0.4,
        0.05
      );
      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        -pointer.y * 0.25,
        0.05
      );
    }

    // Dumbbell rotation
    if (dumbbellRef.current) {
      dumbbellRef.current.rotation.y += delta * 0.5;
      dumbbellRef.current.rotation.z = Math.sin(t * 0.8) * 0.15;
    }

    // Core pulsing glow
    if (coreRef.current) {
      coreRef.current.rotation.y -= delta * 0.3;
      const s = 1.0 + Math.sin(t * 2) * 0.05;
      coreRef.current.scale.set(s, s, s);
    }

    // Rings spinning around
    if (ring1Ref.current) {
      ring1Ref.current.rotation.x += delta * 0.4;
      ring1Ref.current.rotation.y += delta * 0.3;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.y -= delta * 0.35;
      ring2Ref.current.rotation.z += delta * 0.25;
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Ambient Lighting & Rim Light */}
      <ambientLight intensity={0.7} />
      <directionalLight position={[4, 5, 4]} intensity={2.0} color="#ffffff" />
      <pointLight position={[-3, -2, -2]} intensity={2.5} color="#38bdf8" />
      <pointLight position={[3, -2, 2]} intensity={2.0} color="#a855f7" />

      {/* Floating Center Dumbbell */}
      <Float speed={2} rotationIntensity={0.5} floatIntensity={0.8}>
        <group ref={dumbbellRef} position={[0, 0.2, 0]} rotation={[0.4, 0.6, 0.2]}>
          {/* Handle */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.07, 0.07, 2.0, 24]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.15} metalness={0.95} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.08, 0.08, 0.8, 24]} />
            <meshStandardMaterial color="#64748b" roughness={0.6} metalness={0.8} />
          </mesh>

          {/* Left Weights */}
          <mesh position={[-0.9, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.55, 0.55, 0.16, 32]} />
            <meshStandardMaterial color="#1e293b" roughness={0.2} metalness={0.85} />
          </mesh>
          <mesh position={[-0.72, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.44, 0.44, 0.12, 32]} />
            <meshStandardMaterial color="#3b82f6" emissive="#1d4ed8" emissiveIntensity={0.5} roughness={0.2} metalness={0.8} />
          </mesh>
          <mesh position={[-0.58, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.18, 0.18, 0.08, 24]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.9} />
          </mesh>

          {/* Right Weights */}
          <mesh position={[0.9, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.55, 0.55, 0.16, 32]} />
            <meshStandardMaterial color="#1e293b" roughness={0.2} metalness={0.85} />
          </mesh>
          <mesh position={[0.72, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.44, 0.44, 0.12, 32]} />
            <meshStandardMaterial color="#3b82f6" emissive="#1d4ed8" emissiveIntensity={0.5} roughness={0.2} metalness={0.8} />
          </mesh>
          <mesh position={[0.58, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.18, 0.18, 0.08, 24]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.9} />
          </mesh>
        </group>
      </Float>

      {/* Orbiting Glowing Macro Energy Rings */}
      <mesh ref={ring1Ref} position={[0, 0.2, 0]}>
        <torusGeometry args={[1.7, 0.025, 16, 64]} />
        <meshStandardMaterial
          color="#38bdf8"
          emissive="#38bdf8"
          emissiveIntensity={1.2}
          roughness={0.1}
        />
      </mesh>

      <mesh ref={ring2Ref} position={[0, 0.2, 0]} rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[2.0, 0.02, 16, 64]} />
        <meshStandardMaterial
          color="#a855f7"
          emissive="#c084fc"
          emissiveIntensity={0.9}
          roughness={0.1}
        />
      </mesh>

      {/* Central Ethereal Glow Sphere */}
      <mesh ref={coreRef} position={[0, 0.2, 0]}>
        <sphereGeometry args={[0.45, 32, 32]} />
        <meshPhysicalMaterial
          color="#38bdf8"
          emissive="#0284c7"
          emissiveIntensity={0.8}
          transmission={0.85}
          roughness={0.1}
          metalness={0.1}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* Orbiting Particle Sparkles */}
      <group>
        {Array.from({ length: 24 }).map((_, i) => {
          const angle = (i / 24) * Math.PI * 2;
          const radius = 1.4 + (i % 3) * 0.35;
          const y = Math.sin(i * 1.7) * 0.8;
          return (
            <mesh
              key={i}
              position={[Math.cos(angle) * radius, y, Math.sin(angle) * radius]}
            >
              <sphereGeometry args={[0.035, 8, 8]} />
              <meshBasicMaterial
                color={i % 2 === 0 ? '#38bdf8' : '#fbbf24'}
              />
            </mesh>
          );
        })}
      </group>
    </group>
  );
};

export default AuthHeroScene3D;
