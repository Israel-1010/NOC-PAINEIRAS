import { Html } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import type { Vector3Tuple } from 'three';

interface Cloud3DProps {
  id: string;
  label: string;
  logo: string;
  color: string;
  position: Vector3Tuple;
  active?: boolean;
  onClick: (id: string) => void;
}

export default function Cloud3D({ id, label, logo, color, position, active = false, onClick }: Cloud3DProps) {
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onClick(id);
  };

  return (
    <group position={position} scale={[0.82, 0.82, 0.82]} onClick={handleClick}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.72, 0.62, 0.08]} />
        <meshStandardMaterial color="#020617" emissive={color} emissiveIntensity={active ? 0.12 : 0.04} transparent opacity={0.18} roughness={0.44} />
      </mesh>
      <mesh position={[0, -0.42, 0.14]}>
        <boxGeometry args={[1.38, 0.035, 0.08]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.45} />
      </mesh>
      <Html position={[0, 0.02, 0.28]} center zIndexRange={[20, 0]}>
        <div className="pointer-events-none grid h-[78px] w-[178px] place-items-center rounded-md border border-slate-200 bg-white px-4 shadow-glow">
          <img src={logo} alt={label} className="max-h-[60px] max-w-[154px] object-contain" />
        </div>
      </Html>
    </group>
  );
}
