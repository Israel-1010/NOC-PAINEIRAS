import type { Vector3Tuple } from 'three';
import FloatingLabel from './FloatingLabel';

interface Camera3DProps {
  label: string;
  position: Vector3Tuple;
  rotation?: Vector3Tuple;
  active?: boolean;
}

export default function Camera3D({ label, position, rotation = [0, 0, 0], active = false }: Camera3DProps) {
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <boxGeometry args={[0.42, 0.22, 0.22]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.2} roughness={0.34} />
      </mesh>
      <mesh position={[0, 0, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.08, 0.11, 0.22, 20]} />
        <meshStandardMaterial color="#0f172a" emissive="#0ea5e9" emissiveIntensity={0.45} />
      </mesh>
      <mesh position={[0, 0.18, -0.09]}>
        <boxGeometry args={[0.16, 0.08, 0.12]} />
        <meshStandardMaterial color="#64748b" />
      </mesh>
      <FloatingLabel position={[0, 0.5, 0]} active={active}>
        {label}
      </FloatingLabel>
    </group>
  );
}
