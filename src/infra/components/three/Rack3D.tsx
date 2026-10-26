import { Html } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import type { Vector3Tuple } from 'three';
import FloatingLabel from './FloatingLabel';

interface Rack3DProps {
  id: string;
  label: string;
  variant?: 'network' | 'servers';
  position: Vector3Tuple;
  active?: boolean;
  simplified?: boolean;
  onClick: (id: string) => void;
}

function NetworkShelf({ y, unit }: { y: number; unit: number }) {
  return (
    <group position={[0, y, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.98, 0.13, 0.42]} />
        <meshStandardMaterial color="#dbeafe" emissive="#1d4ed8" emissiveIntensity={0.08} roughness={0.28} metalness={0.26} />
      </mesh>
      <mesh position={[-0.36, 0.004, 0.224]}>
        <circleGeometry args={[0.035, 24]} />
        <meshStandardMaterial color="#38bdf8" emissive="#22d3ee" emissiveIntensity={1.9} />
      </mesh>
      <mesh position={[-0.22, 0.004, 0.225]}>
        <boxGeometry args={[0.12, 0.018, 0.01]} />
        <meshStandardMaterial color="#64748b" emissive="#0f172a" emissiveIntensity={0.2} />
      </mesh>
      {Array.from({ length: 12 }).map((_, index) => (
        <mesh key={index} position={[-0.08 + index * 0.052, 0.005, 0.224]}>
          <boxGeometry args={[0.031, 0.027, 0.012]} />
          <meshStandardMaterial
            color={index % 4 === 0 ? '#34d399' : '#22d3ee'}
            emissive={index % 4 === 0 ? '#34d399' : '#22d3ee'}
            emissiveIntensity={1.25}
          />
        </mesh>
      ))}
      <mesh position={[0.39, 0.005, 0.225]}>
        <boxGeometry args={[0.1, 0.024, 0.012]} />
        <meshStandardMaterial color={unit % 2 === 0 ? '#22d3ee' : '#34d399'} emissive={unit % 2 === 0 ? '#22d3ee' : '#34d399'} emissiveIntensity={1.2} />
      </mesh>
    </group>
  );
}

function VMwareHost({ y }: { y: number }) {
  return (
    <group position={[0, y, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.96, 0.16, 0.42]} />
        <meshStandardMaterial color="#172033" emissive="#2563eb" emissiveIntensity={0.12} roughness={0.34} metalness={0.32} />
      </mesh>
      <mesh position={[-0.32, 0.006, 0.224]}>
        <boxGeometry args={[0.18, 0.038, 0.012]} />
        <meshStandardMaterial color="#60a5fa" emissive="#60a5fa" emissiveIntensity={1.2} />
      </mesh>
      {[0.1, 0.22, 0.34].map((x) => (
        <mesh key={x} position={[x, 0.006, 0.224]}>
          <sphereGeometry args={[0.024, 12, 12]} />
          <meshStandardMaterial color="#34d399" emissive="#34d399" emissiveIntensity={1.8} />
        </mesh>
      ))}
    </group>
  );
}

function CompactServerUnit({ y, color, accent, label }: { y: number; color: string; accent: string; label: string }) {
  return (
    <group position={[0, y, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.96, 0.13, 0.42]} />
        <meshStandardMaterial color={color} emissive={accent} emissiveIntensity={0.16} roughness={0.32} metalness={0.28} />
      </mesh>
      <mesh position={[-0.33, 0.005, 0.224]}>
        <boxGeometry args={[0.18, 0.034, 0.012]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.2} />
      </mesh>
      <Html position={[0.18, 0.045, 0.236]} center occlude zIndexRange={[9, 0]}>
        <div className="rounded bg-slate-950/88 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wide text-slate-100">
          {label}
        </div>
      </Html>
    </group>
  );
}

function RackSidePanel({ variant }: { variant: 'network' | 'servers' }) {
  const accent = variant === 'network' ? '#22d3ee' : '#60a5fa';
  const alert = variant === 'network' ? '#34d399' : '#ef4444';

  return (
    <group position={[0.57, -0.02, 0.02]} rotation={[0, Math.PI / 2, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.5, 1.34, 0.018]} />
        <meshStandardMaterial color="#061329" emissive="#0f3f6b" emissiveIntensity={0.18} roughness={0.36} metalness={0.22} />
      </mesh>
      {Array.from({ length: 13 }).map((_, index) => (
        <mesh key={index} position={[-0.17 + (index % 3) * 0.16, 0.52 - index * 0.082, 0.014]}>
          <boxGeometry args={[index % 3 === 0 ? 0.12 : 0.07, 0.014, 0.008]} />
          <meshStandardMaterial color={index % 5 === 0 ? alert : accent} emissive={index % 5 === 0 ? alert : accent} emissiveIntensity={1.25} />
        </mesh>
      ))}
      {[-0.26, -0.08, 0.1, 0.28].map((y, index) => (
        <mesh key={y} position={[0.2, y, 0.014]}>
          <boxGeometry args={[0.06, 0.05, 0.008]} />
          <meshStandardMaterial color={index % 2 === 0 ? '#38bdf8' : '#34d399'} emissive={index % 2 === 0 ? '#38bdf8' : '#34d399'} emissiveIntensity={1.4} />
        </mesh>
      ))}
    </group>
  );
}

function RackFrontModules({ variant, simplified }: { variant: 'network' | 'servers'; simplified: boolean }) {
  if (simplified) {
    return (
      <group>
        {[-0.48, -0.18, 0.12, 0.42].map((y, index) => (
          <group key={y} position={[0, y, 0.382]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[0.78, 0.18, 0.04]} />
              <meshStandardMaterial color="#0b2140" emissive="#1d4ed8" emissiveIntensity={0.18} roughness={0.34} metalness={0.28} />
            </mesh>
            <mesh position={[-0.26, 0.02, 0.028]}>
              <boxGeometry args={[0.18, 0.035, 0.012]} />
              <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={1.4} />
            </mesh>
            <mesh position={[0.27, 0.02, 0.028]}>
              <sphereGeometry args={[0.026, 12, 12]} />
              <meshStandardMaterial color={index % 2 === 0 ? '#34d399' : '#60a5fa'} emissive={index % 2 === 0 ? '#34d399' : '#60a5fa'} emissiveIntensity={1.5} />
            </mesh>
          </group>
        ))}
      </group>
    );
  }

  return (
    <group>
      {(variant === 'network' ? [-0.66, -0.43, -0.2, 0.03, 0.26, 0.49, 0.68] : [-0.68, -0.49, -0.3, -0.11, 0.12, 0.3, 0.48, 0.66, 0.82]).map((y, index) => (
        <group key={y} position={[0, y, 0.382]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.82, variant === 'network' ? 0.13 : 0.12, 0.04]} />
            <meshStandardMaterial color="#0b2140" emissive={variant === 'network' ? '#0891b2' : '#1d4ed8'} emissiveIntensity={0.18} roughness={0.32} metalness={0.26} />
          </mesh>
          <mesh position={[-0.32, 0.01, 0.028]}>
            <boxGeometry args={[0.16, 0.03, 0.012]} />
            <meshStandardMaterial color={variant === 'network' ? '#22d3ee' : '#60a5fa'} emissive={variant === 'network' ? '#22d3ee' : '#60a5fa'} emissiveIntensity={1.35} />
          </mesh>
          {[0.02, 0.13, 0.24, 0.35].map((x, ledIndex) => (
            <mesh key={x} position={[x, 0.01, 0.028]}>
              <boxGeometry args={[0.035, 0.025, 0.012]} />
              <meshStandardMaterial
                color={(index + ledIndex) % 5 === 0 ? '#ef4444' : (ledIndex % 2 === 0 ? '#22d3ee' : '#34d399')}
                emissive={(index + ledIndex) % 5 === 0 ? '#ef4444' : (ledIndex % 2 === 0 ? '#22d3ee' : '#34d399')}
                emissiveIntensity={1.45}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

export default function Rack3D({ id, label, variant = 'servers', position, active = false, simplified = false, onClick }: Rack3DProps) {
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onClick(id);
  };

  return (
    <group position={position} onClick={handleClick}>
      <mesh receiveShadow position={[0, -1.0, 0]}>
        <boxGeometry args={[1.36, 0.06, 0.86]} />
        <meshStandardMaterial color="#0a2544" emissive="#0ea5e9" emissiveIntensity={0.08} roughness={0.5} metalness={0.18} />
      </mesh>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.1, 1.85, 0.65]} />
        <meshStandardMaterial color={active ? '#155e75' : '#1e5b96'} emissive={active ? '#0891b2' : '#0f3f6b'} emissiveIntensity={active ? 0.22 : 0.1} metalness={0.36} roughness={0.34} />
      </mesh>
      <mesh position={[-0.49, 0, 0.36]}>
        <boxGeometry args={[0.055, 1.68, 0.055]} />
        <meshStandardMaterial color="#082f49" emissive="#0ea5e9" emissiveIntensity={0.22} roughness={0.28} metalness={0.38} />
      </mesh>
      <mesh position={[0.49, 0, 0.36]}>
        <boxGeometry args={[0.055, 1.68, 0.055]} />
        <meshStandardMaterial color="#082f49" emissive="#0ea5e9" emissiveIntensity={0.22} roughness={0.28} metalness={0.38} />
      </mesh>
      <mesh position={[0, 0, 0.34]}>
        <boxGeometry args={[1.02, 1.76, 0.025]} />
        <meshStandardMaterial color="#031525" transparent opacity={0.42} />
      </mesh>
      <RackFrontModules variant={variant} simplified={simplified} />
      <RackSidePanel variant={variant} />
      {!simplified && variant === 'network'
        ? [-0.66, -0.43, -0.2, 0.03, 0.26, 0.49, 0.68].map((y, index) => <NetworkShelf key={y} y={y} unit={index} />)
        : !simplified && [
            <VMwareHost key="vmware-01" y={-0.68} />,
            <VMwareHost key="vmware-02" y={-0.49} />,
            <VMwareHost key="vmware-03" y={-0.3} />,
            <VMwareHost key="vmware-04" y={-0.11} />,
            <CompactServerUnit key="storage-01" y={0.12} color="#10233a" accent="#60a5fa" label="Storage 01" />,
            <CompactServerUnit key="storage-02" y={0.3} color="#10233a" accent="#38bdf8" label="Storage 02" />,
            <CompactServerUnit key="storage-03" y={0.48} color="#10233a" accent="#34d399" label="Storage 03" />,
            <CompactServerUnit key="veeam" y={0.66} color="#12251a" accent="#22c55e" label="Veeam" />,
            <CompactServerUnit key="oracle" y={0.82} color="#2f1111" accent="#ef4444" label="Oracle DB" />,
          ]}
      {variant === 'servers' && !simplified && (
        <Html position={[0, 1, 0.43]} center occlude zIndexRange={[9, 0]}>
          <div className="rounded-md border border-sky-200/35 bg-slate-950/88 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-sky-100 shadow-glow">
            VMware Cluster
          </div>
        </Html>
      )}
      <mesh position={[0, 1.02, 0]}>
        <boxGeometry args={[1.18, 0.08, 0.72]} />
        <meshStandardMaterial color="#5b9bd5" emissive="#1d4ed8" emissiveIntensity={0.12} metalness={0.44} roughness={0.28} />
      </mesh>
      <mesh position={[0, 1.09, 0.03]}>
        <boxGeometry args={[1.08, 0.04, 0.62]} />
        <meshStandardMaterial color="#2f6ea8" emissive="#0ea5e9" emissiveIntensity={0.12} metalness={0.42} roughness={0.26} />
      </mesh>
      <FloatingLabel position={[0, 1.28, 0]} active={active}>
        {label}
      </FloatingLabel>
    </group>
  );
}
