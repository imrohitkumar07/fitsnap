/**
 * Mascot3D.tsx
 * FitSnap AI Mascot: friendly glowing companion orb with idle float, reactive expressions, and glowing eyes.
 */

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

interface Mascot3DProps {
  mood?: 'idle' | 'happy' | 'thinking';
  message?: string;
  onClick?: () => void;
}

export const Mascot3D: React.FC<Mascot3DProps> = ({
  mood = 'idle',
  message,
  onClick,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const eyeLeftRef = useRef<THREE.Mesh>(null);
  const eyeRightRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();

    if (groupRef.current) {
      // Floating motion
      const floatY = Math.sin(t * 2.5) * 0.12;
      groupRef.current.position.y = floatY;

      // Slight tilt on side-to-side
      groupRef.current.rotation.z = Math.sin(t * 1.5) * 0.08;

      if (mood === 'thinking') {
        groupRef.current.rotation.y += delta * 1.5;
      } else {
        groupRef.current.rotation.y = Math.sin(t * 0.8) * 0.2;
      }
    }

    // Eye blinking
    if (eyeLeftRef.current && eyeRightRef.current) {
      const blink = Math.sin(t * 3);
      const scaleY = blink > 0.95 ? 0.1 : 1.0;
      eyeLeftRef.current.scale.y = scaleY;
      eyeRightRef.current.scale.y = scaleY;
    }
  });

  const getMascotColor = () => {
    switch (mood) {
      case 'happy':
        return '#38bdf8';
      case 'thinking':
        return '#a855f7';
      case 'idle':
      default:
        return '#3b82f6';
    }
  };

  const color = getMascotColor();

  return (
    <group
      ref={groupRef}
      position={[0, 0, 0]}
      onClick={onClick}
      onPointerOver={() => {
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'default';
      }}
    >
      {/* Outer Glow Energy Halo */}
      <mesh>
        <sphereGeometry args={[1.25, 32, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.15}
        />
      </mesh>

      {/* Main Mascot Orb Body */}
      <mesh>
        <sphereGeometry args={[1.0, 32, 32]} />
        <meshPhysicalMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.5}
          roughness={0.1}
          metalness={0.1}
          transmission={0.4}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* Inner Energy Core */}
      <mesh>
        <sphereGeometry args={[0.65, 24, 24]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={0.8}
        />
      </mesh>

      {/* Cute Stylized Eyes */}
      <group position={[0, 0.15, 0.88]}>
        {/* Left Eye */}
        <mesh ref={eyeLeftRef} position={[-0.26, 0, 0]}>
          <capsuleGeometry args={[0.07, 0.1, 8, 16]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>

        {/* Right Eye */}
        <mesh ref={eyeRightRef} position={[0.26, 0, 0]}>
          <capsuleGeometry args={[0.07, 0.1, 8, 16]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </group>

      {/* Mascot Speech Bubble (if message given) */}
      {message && (
        <Html position={[0, 1.4, 0]} center>
          <div className="rounded-2xl bg-slate-900/95 border border-brand-500/40 px-3.5 py-2 shadow-glow max-w-xs text-center backdrop-blur-xl">
            <p className="text-xs font-semibold text-white leading-relaxed">
              {message}
            </p>
          </div>
        </Html>
      )}
    </group>
  );
};

export default Mascot3D;
