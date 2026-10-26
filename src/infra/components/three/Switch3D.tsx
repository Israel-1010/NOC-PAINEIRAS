import type { ThreeEvent } from '@react-three/fiber';
import type { Vector3Tuple } from 'three';
import FloatingLabel from './FloatingLabel';

interface Switch3DProps {
  id: string;
  position: Vector3Tuple;
  label?: string;
  active?: boolean;
  onClick?: (id: string) => void;
}

export default function Switch3D({ id, position, label = 'Switch Core', active = false, onClick }: Switch3DProps) {
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onClick?.(id);
  };

  return (
    <group position={position} onClick={handleClick}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.55, 0.28, 0.7]} />
        <meshStandardMaterial color={active ? '#164e63' : '#1f2937'} metalness={0.45} roughness={0.35} />
      </mesh>
      {Array.from({ length: 12 }).map((_, index) => (
        <mesh key={index} position={[-0.62 + index * 0.112, 0.02, 0.37]}>
          <boxGeometry args={[0.055, 0.055, 0.018]} />
          <meshStandardMaterial color={index % 3 === 0 ? '#34d399' : '#22d3ee'} emissive={index % 3 === 0 ? '#34d399' : '#22d3ee'} emissiveIntensity={1.4} />
        </mesh>
      ))}
      <FloatingLabel position={[0, 0.55, 0]} active={active}>
        {label}
      </FloatingLabel>
    </group>
  );
}
