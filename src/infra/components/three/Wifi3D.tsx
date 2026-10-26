import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group, Mesh, Vector3Tuple } from 'three';
import FloatingLabel from './FloatingLabel';

interface Wifi3DProps {
  label: string;
  position: Vector3Tuple;
  active?: boolean;
}

export default function Wifi3D({ label, position, active = false }: Wifi3DProps) {
  const rings = useRef<Mesh[]>([]);
  const deviceRef = useRef<Group>(null);

  useFrame(({ clock }) => {
    rings.current.forEach((ring, index) => {
      const phase = ((clock.elapsedTime * 0.55 + index * 0.22) % 1) + 0.2;
      ring.scale.setScalar(phase * 2.6);
      const material = ring.material;
      if ('opacity' in material) {
        material.opacity = Math.max(0, 0.52 - phase * 0.35);
      }
    });
    if (deviceRef.current) {
      deviceRef.current.position.x = Math.sin(clock.elapsedTime * 0.8) * 0.18;
    }
  });

  return (
    <group position={position}>
      <mesh castShadow>
        <boxGeometry args={[0.55, 0.12, 0.36]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.48} />
      </mesh>
      <mesh position={[0, 0.09, 0.19]}>
        <sphereGeometry args={[0.035, 12, 12]} />
        <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={2} />
      </mesh>
      {[0, 1, 2].map((index) => (
        <mesh
          key={index}
          ref={(node) => {
            if (node) rings.current[index] = node;
          }}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[0.36, 0.009, 8, 54]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.25} depthWrite={false} />
        </mesh>
      ))}
      <group ref={deviceRef} position={[0.72, -0.22, 0.2]}>
        <mesh>
          <boxGeometry args={[0.16, 0.28, 0.03]} />
          <meshStandardMaterial color="#0f172a" emissive="#38bdf8" emissiveIntensity={0.4} />
        </mesh>
      </group>
      <FloatingLabel position={[0, 0.65, 0]} active={active}>
        {label}
      </FloatingLabel>
    </group>
  );
}
