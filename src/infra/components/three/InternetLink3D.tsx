import { Html } from '@react-three/drei';
import type { Vector3Tuple } from 'three';
import FloatingLabel from './FloatingLabel';
import GlowEffect from './GlowEffect';

export const DOWN_COLOR = '#ef4444';

interface InternetLink3DProps {
  label: string;
  provider: string;
  logo: string;
  position: Vector3Tuple;
  color: string;
  active?: boolean;
  // Estado real do Zabbix: null = sem leitura.
  online?: boolean | null;
  latencyMs?: number | null;
}

export default function InternetLink3D({ label, provider, logo, position, color, active = false, online = null, latencyMs = null }: InternetLink3DProps) {
  const down = online === false;
  const tone = down ? DOWN_COLOR : color;
  return (
    <group position={position} scale={[0.78, 0.78, 0.78]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.9, 0.24, 0.58]} />
        <meshStandardMaterial color="#0f172a" emissive={tone} emissiveIntensity={down ? 0.5 : active ? 0.32 : 0.1} roughness={0.42} metalness={0.18} />
      </mesh>
      <mesh position={[0, 0.16, 0.31]}>
        <boxGeometry args={[0.62, 0.055, 0.02]} />
        <meshStandardMaterial color={tone} emissive={tone} emissiveIntensity={1.8} />
      </mesh>
      {active && (
        <Html position={[0, 0.6, 0]} center occlude zIndexRange={[9, 0]}>
          <div className={`grid h-[54px] w-[128px] place-items-center rounded-md border bg-slate-950/86 px-3 shadow-glow backdrop-blur ${down ? 'border-rose-400/70' : 'border-cyan-200/35'}`}>
            <img src={logo} alt={provider} className="max-h-8 max-w-[104px] object-contain" />
          </div>
        </Html>
      )}
      <FloatingLabel position={[0, 1.05, 0]} active={active || down}>
        {label} | {provider}
        {online === true && latencyMs !== null ? ` · ${latencyMs} ms` : ''}
        {down ? ' · OFFLINE' : ''}
      </FloatingLabel>
      {(active || down) && <GlowEffect radius={0.5} color={tone} speed={down ? 3 : 1.2} />}
    </group>
  );
}
