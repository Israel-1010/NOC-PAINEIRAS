import type { ThreeEvent } from '@react-three/fiber';

// Switch no mapa de backbones: "pino" pequeno (base hexagonal + haste + luz na cor do estado).
// Nos pequenos e iguais deixam a topologia (as fibras) aparecer; o estado vem pela cor e,
// quando cai, tambem pelo rotulo e pelo feixe (DownBeacon), nunca so pela cor.

export const PIN_UP = '#2dd4bf';
export const PIN_DOWN = '#ef4444';
export const PIN_UNKNOWN = '#64748b';

interface SwitchPinProps {
  status: boolean | null;
  floorY: number; // altura do piso relativa ao grupo do ponto
  selected?: boolean;
  pending?: boolean;
  hovered?: boolean;
  onPointerOver?: (event: ThreeEvent<PointerEvent>) => void;
  onPointerOut?: (event: ThreeEvent<PointerEvent>) => void;
}

export default function SwitchPin({ status, floorY, selected = false, pending = false, hovered = false, onPointerOver, onPointerOut }: SwitchPinProps) {
  const color = status === true ? PIN_UP : status === false ? PIN_DOWN : PIN_UNKNOWN;
  const glow = status === null ? 0.35 : hovered ? 3 : 2.1;
  const ringColor = selected ? '#a7f3d0' : pending ? '#fef08a' : color;

  return (
    <group position={[0, floorY, 0]}>
      {/* Area de toque maior que o pino (invisivel), para facilitar o hover/clique. */}
      <mesh position={[0, 0.15, 0]} onPointerOver={onPointerOver} onPointerOut={onPointerOut}>
        <cylinderGeometry args={[0.16, 0.16, 0.32, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh receiveShadow castShadow position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.1, 0.115, 0.04, 6]} />
        <meshStandardMaterial color="#0b1424" emissive={color} emissiveIntensity={0.12} metalness={0.55} roughness={0.32} />
      </mesh>
      <mesh position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 6]}>
        <ringGeometry args={[selected || pending ? 0.15 : 0.125, selected || pending ? 0.19 : 0.15, 6]} />
        <meshBasicMaterial color={ringColor} transparent opacity={selected || pending ? 0.95 : status === null ? 0.25 : 0.6} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.13, 0]}>
        <cylinderGeometry args={[0.007, 0.007, 0.18, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={status === null ? 0.3 : 0.9} />
      </mesh>
      <mesh position={[0, 0.245, 0]} scale={hovered ? 1.35 : 1}>
        <sphereGeometry args={[0.038, 20, 20]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={glow} />
      </mesh>
    </group>
  );
}
