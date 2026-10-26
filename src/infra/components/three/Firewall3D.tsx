import { Html } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import type { Vector3Tuple } from 'three';
import fortinetLogo from '../../assets/providers/fortinet-logo.svg';
import FloatingLabel from './FloatingLabel';

interface Firewall3DProps {
  id: string;
  position: Vector3Tuple;
  label?: string;
  active?: boolean;
  onClick: (id: string) => void;
}

export default function Firewall3D({ id, position, label = 'FortiGate | VPN | IPS | WAF', active = false, onClick }: Firewall3DProps) {
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onClick(id);
  };

  const portColors = ['#22d3ee', '#60a5fa', '#34d399', '#22d3ee', '#60a5fa', '#34d399'];

  return (
    <group position={position} scale={[0.92, 0.92, 0.92]} onClick={handleClick}>
      <mesh castShadow receiveShadow position={[0, -0.08, 0]}>
        <boxGeometry args={[1.32, 0.42, 0.46]} />
        <meshStandardMaterial color="#111827" emissive="#7f1d1d" emissiveIntensity={active ? 0.18 : 0.07} roughness={0.34} metalness={0.42} />
      </mesh>

      <mesh castShadow receiveShadow position={[0, 0.09, 0.26]}>
        <boxGeometry args={[1.34, 0.16, 0.07]} />
        <meshStandardMaterial color="#b91c1c" emissive="#ef4444" emissiveIntensity={active ? 0.45 : 0.2} roughness={0.3} metalness={0.32} />
      </mesh>

      <mesh position={[0, -0.14, 0.3]}>
        <boxGeometry args={[1.18, 0.2, 0.045]} />
        <meshStandardMaterial color="#0f172a" emissive="#020617" emissiveIntensity={0.2} roughness={0.45} metalness={0.28} />
      </mesh>

      <Html position={[0, 0.1, 0.34]} center zIndexRange={[12, 0]}>
        <div className="pointer-events-none grid h-[24px] w-[104px] place-items-center rounded-sm bg-white px-2 shadow-glow">
          <img src={fortinetLogo} alt="Fortinet" className="max-h-[15px] max-w-[88px] object-contain" />
        </div>
      </Html>

      <group position={[-0.18, -0.15, 0.33]}>
        {Array.from({ length: 6 }).map((_, index) => (
          <mesh key={index} position={[index * 0.09, 0, 0]}>
            <boxGeometry args={[0.055, 0.045, 0.022]} />
            <meshStandardMaterial color="#020617" emissive={portColors[index]} emissiveIntensity={0.65} />
          </mesh>
        ))}
      </group>

      {[-0.5, -0.42, 0.42, 0.5].map((x, index) => (
        <mesh key={x} position={[x, -0.27, 0.31]}>
          <sphereGeometry args={[0.023, 12, 12]} />
          <meshStandardMaterial color={index % 2 === 0 ? '#34d399' : '#22d3ee'} emissive={index % 2 === 0 ? '#34d399' : '#22d3ee'} emissiveIntensity={1.8} />
        </mesh>
      ))}

      <mesh position={[0, -0.34, 0]}>
        <boxGeometry args={[1.08, 0.045, 0.56]} />
        <meshStandardMaterial color="#020617" transparent opacity={0.42} />
      </mesh>

      <FloatingLabel position={[0, 0.48, 0]} active={active}>
        {label}
      </FloatingLabel>
    </group>
  );
}
