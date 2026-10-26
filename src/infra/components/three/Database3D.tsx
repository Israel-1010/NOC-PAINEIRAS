import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Mesh, Vector3Tuple } from 'three';
import FloatingLabel from './FloatingLabel';

interface Database3DProps {
  label: string;
  position: Vector3Tuple;
  color?: string;
  active?: boolean;
}

export default function Database3D({ label, position, color = '#38bdf8', active = false }: Database3DProps) {
  const ref = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = Math.sin(clock.elapsedTime * 1.4) * 0.035;
    }
  });

  return (
    <group position={position}>
      <mesh ref={ref} castShadow receiveShadow>
        <cylinderGeometry args={[0.32, 0.32, 0.48, 32]} />
        <meshStandardMaterial color="#0f172a" emissive={color} emissiveIntensity={active ? 0.48 : 0.22} metalness={0.22} roughness={0.38} />
      </mesh>
      <mesh position={[0, 0.25, 0]}>
        <torusGeometry args={[0.32, 0.018, 8, 32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.3} />
      </mesh>
      <FloatingLabel position={[0, 0.72, 0]} active={active}>
        {label}
      </FloatingLabel>
    </group>
  );
}
