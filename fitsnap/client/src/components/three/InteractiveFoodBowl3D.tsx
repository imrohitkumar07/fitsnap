/**
 * InteractiveFoodBowl3D.tsx
 * Ultra-realistic 3D Ceramic Food Platter with high-resolution texture,
 * porcelain glaze clearcoat, and real-time mouse/cursor tilt physics.
 * Properly scaled and contained with zero edge clipping.
 */

import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

export const InteractiveFoodBowl3D: React.FC = () => {
  const rootGroupRef = useRef<THREE.Group>(null);
  const plateRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.DirectionalLight>(null);

  const { pointer } = useThree();

  // Load high-resolution circular food texture
  const foodTexture = useTexture('/textures/food_bowl_round.png');
  foodTexture.colorSpace = THREE.SRGBColorSpace;
  foodTexture.minFilter = THREE.LinearMipmapLinearFilter;
  foodTexture.magFilter = THREE.LinearFilter;

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();

    // Smooth cursor parallax tilt
    if (rootGroupRef.current) {
      const targetRotY = pointer.x * 0.45;
      const targetRotX = -pointer.y * 0.35 + 0.52; // gentle tilt towards camera

      rootGroupRef.current.rotation.y = THREE.MathUtils.lerp(
        rootGroupRef.current.rotation.y,
        targetRotY,
        0.06
      );
      rootGroupRef.current.rotation.x = THREE.MathUtils.lerp(
        rootGroupRef.current.rotation.x,
        targetRotX,
        0.06
      );

      // Subtle parallax translation within safe bounds
      rootGroupRef.current.position.x = THREE.MathUtils.lerp(
        rootGroupRef.current.position.x,
        pointer.x * 0.2,
        0.05
      );
      rootGroupRef.current.position.y = THREE.MathUtils.lerp(
        rootGroupRef.current.position.y,
        pointer.y * 0.15 - 0.1,
        0.05
      );
    }

    // Specular light follow
    if (lightRef.current) {
      lightRef.current.position.x = pointer.x * 3 + 3;
      lightRef.current.position.y = pointer.y * 3 + 5;
    }

    // Breathing float
    if (plateRef.current) {
      plateRef.current.position.y = Math.sin(t * 1.6) * 0.04;
    }
  });

  return (
    <group ref={rootGroupRef} position={[0, -0.1, 0]} scale={[0.88, 0.88, 0.88]}>
      {/* Balanced Studio Lighting */}
      <ambientLight intensity={1.1} />
      <directionalLight
        ref={lightRef}
        position={[3, 5, 4]}
        intensity={2.2}
        color="#ffffff"
      />
      <directionalLight position={[-3, 2, -2]} intensity={0.8} color="#93c5fd" />
      <pointLight position={[0, 2.5, 2]} intensity={1.2} color="#fed7aa" />

      {/* Main 3D Plate Group */}
      <group ref={plateRef}>
        {/* Soft Radial Contact Shadow */}
        <mesh position={[0, -0.32, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[4.8, 4.8]} />
          <meshBasicMaterial
            color="#020617"
            transparent
            opacity={0.4}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* 3D Porcelain Plate Rim (Gloss Ceramic) */}
        <mesh position={[0, -0.1, 0]}>
          <cylinderGeometry args={[2.2, 1.9, 0.22, 64]} />
          <meshPhysicalMaterial
            color="#ffffff"
            roughness={0.12}
            metalness={0.04}
            clearcoat={1.0}
            clearcoatRoughness={0.06}
            reflectivity={0.95}
          />
        </mesh>

        {/* Plate Base */}
        <mesh position={[0, -0.2, 0]}>
          <cylinderGeometry args={[1.55, 1.45, 0.08, 48]} />
          <meshPhysicalMaterial
            color="#f1f5f9"
            roughness={0.2}
            metalness={0.05}
            clearcoat={0.8}
          />
        </mesh>

        {/* High-Definition Food Texture Surface */}
        <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, -Math.PI / 4]}>
          <circleGeometry args={[2.08, 64]} />
          <meshStandardMaterial
            map={foodTexture}
            roughness={0.32}
            metalness={0.08}
          />
        </mesh>

        {/* Outer Porcelain Glaze Ring */}
        <mesh position={[0, 0.025, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.14, 0.05, 16, 64]} />
          <meshPhysicalMaterial
            color="#ffffff"
            roughness={0.08}
            metalness={0.04}
            clearcoat={1.0}
            clearcoatRoughness={0.04}
          />
        </mesh>
      </group>
    </group>
  );
};

export default InteractiveFoodBowl3D;
