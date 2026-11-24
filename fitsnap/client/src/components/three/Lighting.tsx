/**
 * Lighting.tsx
 *
 * Reusable lighting rig for every 3D scene in FitSnap.
 * Drop this into any R3F `<Canvas>` to get consistent, attractive
 * lighting with soft shadows and an environment map.
 *
 * @module Lighting
 */

import React from 'react';
import { Environment, ContactShadows } from '@react-three/drei';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface LightingProps {
  /** Environment map preset. @default 'city' */
  envPreset?: 'city' | 'sunset' | 'dawn' | 'night' | 'warehouse' | 'forest' | 'apartment' | 'studio' | 'park' | 'lobby';
  /** Show contact shadows on the ground plane. @default true */
  contactShadows?: boolean;
  /** Intensity of the environment light. @default 0.4 */
  envIntensity?: number;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

/**
 * Standard three-point lighting setup with environment map and contact shadows.
 *
 * - **Key light** — directional, positioned upper-right with soft shadows.
 * - **Fill light** — ambient, low intensity.
 * - **Environment** — drei `Environment` with "city" preset for realistic reflections.
 * - **Contact shadows** — subtle, blurred shadow plane at y = -1.5.
 */
const Lighting: React.FC<LightingProps> = ({
  envPreset = 'city',
  contactShadows = true,
  envIntensity = 0.4,
}) => {
  return (
    <>
      {/* Environment map for reflections / IBL */}
      <Environment preset={envPreset} environmentIntensity={envIntensity} />

      {/* Key light — directional with soft shadow */}
      <directionalLight
        position={[5, 8, 3]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.5}
        shadow-camera-far={50}
        shadow-bias={-0.0001}
      />

      {/* Fill light — ambient */}
      <ambientLight intensity={0.35} />

      {/* Contact shadows on the ground plane */}
      {contactShadows && (
        <ContactShadows
          position={[0, -1.5, 0]}
          opacity={0.35}
          scale={10}
          blur={2.5}
          far={4}
          color="#000000"
        />
      )}
    </>
  );
};

export default Lighting;
