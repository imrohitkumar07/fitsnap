/**
 * CameraButton3D.tsx
 * Large glossy 3D camera lens button with tactile spring press animation.
 */

import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface CameraButton3DProps {
  onPress?: () => void;
  disabled?: boolean;
}

export const CameraButton3D: React.FC<CameraButton3DProps> = ({
  onPress,
  disabled = false,
}) => {
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      // Gentle floating/breathing animation
      const t = state.clock.getElapsedTime();
      const hoverY = hovered ? 0.1 : 0;
      const breathe = Math.sin(t * 3) * 0.05;
      groupRef.current.position.y = hoverY + breathe;
      groupRef.current.scale.setScalar(pressed ? 0.9 : hovered ? 1.05 : 1.0);
    }
  });

  return (
    <group
      ref={groupRef}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (!disabled) {
          setPressed(true);
        }
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        if (!disabled) {
          setPressed(false);
          onPress?.();
        }
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        if (!disabled) setHovered(true);
      }}
      onPointerOut={() => {
        setHovered(false);
        setPressed(false);
      }}
      position={[0, 0, 0]}
    >
      {/* Outer Glow Halo */}
      <mesh position={[0, 0, -0.1]}>
        <ringGeometry args={[1.35, 1.55, 32]} />
        <meshBasicMaterial
          color="#38bdf8"
          transparent
          opacity={hovered ? 0.6 : 0.25}
        />
      </mesh>

      {/* Main Button Bezel Body */}
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.3, 1.35, 0.35, 48]} />
        <meshStandardMaterial
          color="#1e293b"
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>

      {/* Outer Metallic Rim */}
      <mesh position={[0, 0, 0.18]}>
        <torusGeometry args={[1.2, 0.08, 16, 48]} />
        <meshStandardMaterial
          color="#38bdf8"
          emissive="#0284c7"
          emissiveIntensity={0.5}
          roughness={0.1}
          metalness={0.9}
        />
      </mesh>

      {/* Glass Camera Lens Center */}
      <mesh position={[0, 0, 0.15]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.9, 0.9, 0.1, 32]} />
        <meshPhysicalMaterial
          color="#0284c7"
          transmission={0.7}
          roughness={0.05}
          metalness={0.2}
          reflectivity={0.9}
          transparent
          opacity={0.85}
        />
      </mesh>

      {/* Lens Reflection Highlight Sphere */}
      <mesh position={[0.3, 0.3, 0.22]}>
        <sphereGeometry args={[0.16, 16, 16]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.6} />
      </mesh>

      {/* Aperture Core Dot */}
      <mesh position={[0, 0, 0.2]}>
        <circleGeometry args={[0.35, 24]} />
        <meshStandardMaterial color="#0f172a" roughness={0.9} />
      </mesh>
    </group>
  );
};

export default CameraButton3D;
