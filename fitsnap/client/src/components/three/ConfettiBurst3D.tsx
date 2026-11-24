/**
 * ConfettiBurst3D.tsx
 * 3D celebration particle burst for PR achievements and completed goals.
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface ConfettiBurst3DProps {
  count?: number;
  active?: boolean;
}

const COLORS = ['#38bdf8', '#fbbf24', '#f472b6', '#34d399', '#a855f7', '#60a5fa'];

export const ConfettiBurst3D: React.FC<ConfettiBurst3DProps> = ({
  count = 60,
  active = true,
}) => {
  const groupRef = useRef<THREE.Group>(null);

  const particles = useMemo(() => {
    return Array.from({ length: count }).map(() => ({
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        Math.random() * 4 + 2,
        (Math.random() - 0.5) * 4
      ),
      rotationSpeed: new THREE.Vector3(
        Math.random() * 5,
        Math.random() * 5,
        Math.random() * 5
      ),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: Math.random() * 0.08 + 0.04,
    }));
  }, [count]);

  useFrame((_, delta) => {
    if (!active || !groupRef.current) return;

    groupRef.current.children.forEach((mesh, i) => {
      const p = particles[i];
      if (!p) return;

      mesh.position.addScaledVector(p.velocity, delta);
      // Gravity
      p.velocity.y -= delta * 5.0;

      // Rotation
      mesh.rotation.x += p.rotationSpeed.x * delta;
      mesh.rotation.y += p.rotationSpeed.y * delta;

      // Reset when falling too low
      if (mesh.position.y < -3) {
        mesh.position.set(0, 0, 0);
        p.velocity.set(
          (Math.random() - 0.5) * 4,
          Math.random() * 3 + 2,
          (Math.random() - 0.5) * 4
        );
      }
    });
  });

  if (!active) return null;

  return (
    <group ref={groupRef} position={[0, -0.5, 0]}>
      {particles.map((p, i) => (
        <mesh key={i} position={[0, 0, 0]}>
          <boxGeometry args={[p.size, p.size * 1.5, 0.01]} />
          <meshBasicMaterial color={p.color} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
};

export default ConfettiBurst3D;
