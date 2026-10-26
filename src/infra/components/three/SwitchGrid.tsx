import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import type { Mesh, MeshBasicMaterial, Vector3Tuple } from 'three';
import { switchShortName } from '../../backboneSwitches';
import type { SwitchStatus } from '../../live';

// Switches do Zabbix numa grade espacada propria (fora do piso apertado dos backbones):
// cada um e um switch 1U (corpo claro estilo UniFi, frente escura e faixa de LED na cor do estado).

export const SWITCH_GRID_COLUMNS = 6;
export const SWITCH_GRID_SPACING: [number, number] = [1.12, 0.92];

const UP = '#34d399';
const DOWN = '#ef4444';
const UNKNOWN = '#64748b';

// Centro da grade no mundo e tamanho, para a camera e para a fibra-tronco.
export function switchGridLayout(count: number, center: Vector3Tuple) {
  const columns = Math.min(SWITCH_GRID_COLUMNS, Math.max(1, count));
  const rows = Math.max(1, Math.ceil(count / columns));
  const width = (columns - 1) * SWITCH_GRID_SPACING[0];
  const depth = (rows - 1) * SWITCH_GRID_SPACING[1];
  const position = (index: number): Vector3Tuple => [
    center[0] - width / 2 + (index % columns) * SWITCH_GRID_SPACING[0],
    center[1],
    center[2] - depth / 2 + Math.floor(index / columns) * SWITCH_GRID_SPACING[1],
  ];
  return { columns, rows, width, depth, position };
}

function PulsePad({ color }: { color: string }) {
  const ref = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) (ref.current.material as MeshBasicMaterial).opacity = 0.25 + Math.abs(Math.sin(clock.elapsedTime * 3)) * 0.45;
  });
  return (
    <mesh ref={ref} position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[0.86, 0.52]} />
      <meshBasicMaterial color={color} transparent opacity={0.4} depthWrite={false} />
    </mesh>
  );
}

function DownBeam() {
  const ref = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) (ref.current.material as MeshBasicMaterial).opacity = 0.2 + Math.abs(Math.sin(clock.elapsedTime * 3)) * 0.45;
  });
  return (
    <mesh ref={ref} position={[0, 0.75, 0]}>
      <cylinderGeometry args={[0.025, 0.07, 1.4, 12, 1, true]} />
      <meshBasicMaterial color={DOWN} transparent opacity={0.45} depthWrite={false} />
    </mesh>
  );
}

function SwitchUnit({ sw, position, showLabel }: { sw: SwitchStatus; position: Vector3Tuple; showLabel: boolean }) {
  const [hovered, setHovered] = useState(false);
  const color = sw.up === true ? UP : sw.up === false ? DOWN : UNKNOWN;
  const down = sw.up === false;
  return (
    <group
      position={position}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {down ? (
        <PulsePad color={DOWN} />
      ) : (
        <mesh position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.8, 0.46]} />
          <meshBasicMaterial color={color} transparent opacity={sw.up ? 0.12 : 0.06} depthWrite={false} />
        </mesh>
      )}
      <group position={[0, 0.08, 0]} scale={hovered ? 1.08 : 1}>
        {/* Corpo 1U */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.64, 0.075, 0.32]} />
          <meshStandardMaterial color={down ? '#fca5a5' : '#e5e7eb'} roughness={0.42} metalness={0.25} />
        </mesh>
        {/* Frente escura com a faixa de LED (estado) e as portas */}
        <mesh position={[0, 0, 0.161]}>
          <boxGeometry args={[0.62, 0.06, 0.004]} />
          <meshStandardMaterial color="#0f172a" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.016, 0.164]}>
          <boxGeometry args={[0.54, 0.008, 0.004]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={sw.up === null ? 0.4 : 2.2} />
        </mesh>
        {Array.from({ length: 8 }).map((_, index) => (
          <mesh key={index} position={[-0.245 + index * 0.07, -0.01, 0.164]}>
            <boxGeometry args={[0.045, 0.022, 0.004]} />
            <meshStandardMaterial color="#1e293b" emissive={sw.up ? '#0ea5e9' : '#000000'} emissiveIntensity={sw.up ? 0.25 : 0} />
          </mesh>
        ))}
        {/* Logo/LED de status no topo */}
        <mesh position={[0.25, 0.039, 0.1]}>
          <cylinderGeometry args={[0.018, 0.018, 0.004, 16]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={sw.up === null ? 0.4 : 2.5} />
        </mesh>
      </group>
      {down && <DownBeam />}
      {(showLabel || down || hovered) && (
        <Html position={[0, down ? 1.55 : 0.02, down ? 0 : 0.36]} center zIndexRange={[18, 0]}>
          <div
            className={`pointer-events-none whitespace-nowrap rounded px-1.5 py-0.5 text-center text-[9px] font-semibold leading-tight ${
              down
                ? 'border border-rose-400/70 bg-rose-950/90 text-rose-100 shadow-[0_0_20px_rgba(239,68,68,0.45)]'
                : hovered
                  ? 'border border-emerald-300/50 bg-slate-950/92 text-emerald-50'
                  : 'bg-slate-950/70 text-slate-200'
            }`}
          >
            {switchShortName(sw.name)}
            {down ? ' · SEM RESPOSTA' : hovered ? ` · ${sw.ip} · ${sw.latencyMs ?? '—'} ms` : ''}
          </div>
        </Html>
      )}
    </group>
  );
}

interface SwitchGridProps {
  switches: SwitchStatus[];
  center: Vector3Tuple;
  // Cena "Switches": todos os nomes; nas outras, so os caidos (e o do mouse).
  showLabels: boolean;
}

export default function SwitchGrid({ switches, center, showLabels }: SwitchGridProps) {
  if (!switches.length) return null;
  // Ordem fixa pela numeracao do switch: cada um tem sempre o mesmo lugar (nao pula quando cai).
  const ordered = [...switches].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));
  const grid = switchGridLayout(ordered.length, center);
  return (
    <group>
      {/* Piso da area dos switches */}
      <mesh receiveShadow position={[center[0], center[1] - 0.012, center[2]]}>
        <boxGeometry args={[grid.width + 1.2, 0.025, grid.depth + 1.1]} />
        <meshStandardMaterial color="#07111f" emissive="#0e7490" emissiveIntensity={0.06} roughness={0.6} />
      </mesh>
      {ordered.map((sw, index) => (
        <SwitchUnit key={sw.id} sw={sw} position={grid.position(index)} showLabel={showLabels} />
      ))}
    </group>
  );
}
