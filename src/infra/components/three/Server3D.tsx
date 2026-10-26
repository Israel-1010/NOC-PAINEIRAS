import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group } from 'three';

interface Server3DProps {
  y: number;
  width?: number;
}

export default function Server3D({ y, width = 0.95 }: Server3DProps) {
  const fanRef = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (fanRef.current) {
      fanRef.current.rotation.z = clock.elapsedTime * 8;
    }
  });

  return (
    <group position={[0, y, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, 0.12, 0.42]} />
        <meshStandardMaterial color="#111827" roughness={0.42} metalness={0.35} />
      </mesh>
      <mesh position={[-0.35, 0.005, 0.222]}>
        <boxGeometry args={[0.18, 0.035, 0.01]} />
        <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[0.32, 0.005, 0.222]}>
        <sphereGeometry args={[0.028, 12, 12]} />
        <meshStandardMaterial color="#34d399" emissive="#34d399" emissiveIntensity={2} />
      </mesh>
      <group ref={fanRef} position={[0.05, 0.01, 0.225]}>
        <mesh>
          <torusGeometry args={[0.08, 0.01, 8, 24]} />
          <meshStandardMaterial color="#64748b" emissive="#334155" emissiveIntensity={0.3} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <boxGeometry args={[0.14, 0.016, 0.012]} />
          <meshStandardMaterial color="#94a3b8" />
        </mesh>
      </group>
    </group>
  );
}
