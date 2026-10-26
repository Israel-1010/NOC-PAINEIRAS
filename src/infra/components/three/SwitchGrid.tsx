import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import type { Mesh, MeshBasicMaterial, Vector3Tuple } from 'three';
import { switchShortName } from '../../backboneSwitches';
import type { SwitchStatus } from '../../live';
import ConnectionLine from './ConnectionLine';

// Switches do Zabbix em grade ao lado do Rack Switch, cada um ligado por um uplink organizado
// (como numa bandeja de cabos): tronco da porta do rack -> espinha na lateral da grade ->
// ramal por fileira, atras dos switches -> descida curta ate cada switch, na cor do estado dele.

export const SWITCH_GRID_COLUMNS = 7;
export const SWITCH_GRID_SPACING: [number, number] = [1.0, 0.95];
// Bandeja de cabos elevada por tras das fileiras (fica visivel da camera, nao some atras dos switches).
const CABLE_Y = 0.24;
// Porta de uplink na traseira do switch (altura do corpo).
const PORT_Y = 0.08;
const UP = '#34d399';
const DOWN = '#ef4444';
const UNKNOWN = '#64748b';
const CABLE = '#22d3ee';

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

function PulsePad() {
  const ref = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) (ref.current.material as MeshBasicMaterial).opacity = 0.25 + Math.abs(Math.sin(clock.elapsedTime * 3)) * 0.45;
  });
  return (
    <mesh ref={ref} position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[0.82, 0.5]} />
      <meshBasicMaterial color={DOWN} transparent opacity={0.4} depthWrite={false} />
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
        <PulsePad />
      ) : (
        <mesh position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.78, 0.46]} />
          <meshBasicMaterial color={color} transparent opacity={sw.up ? 0.1 : 0.05} depthWrite={false} />
        </mesh>
      )}
      <group position={[0, 0.08, 0]} scale={hovered ? 1.08 : 1}>
        {/* Corpo 1U */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.62, 0.075, 0.32]} />
          <meshStandardMaterial color={down ? '#fca5a5' : '#e5e7eb'} roughness={0.42} metalness={0.25} />
        </mesh>
        {/* Frente escura: faixa de LED (estado) e portas */}
        <mesh position={[0, 0, 0.161]}>
          <boxGeometry args={[0.6, 0.06, 0.004]} />
          <meshStandardMaterial color="#0f172a" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.016, 0.164]}>
          <boxGeometry args={[0.52, 0.008, 0.004]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={sw.up === null ? 0.4 : 2.2} />
        </mesh>
        {Array.from({ length: 8 }).map((_, index) => (
          <mesh key={index} position={[-0.245 + index * 0.07, -0.01, 0.164]}>
            <boxGeometry args={[0.045, 0.022, 0.004]} />
            <meshStandardMaterial color="#1e293b" emissive={sw.up ? '#0ea5e9' : '#000000'} emissiveIntensity={sw.up ? 0.25 : 0} />
          </mesh>
        ))}
        {/* Porta de uplink (atras), onde chega o cabo */}
        <mesh position={[0, 0, -0.165]}>
          <boxGeometry args={[0.08, 0.03, 0.01]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={sw.up === null ? 0.3 : 1.4} />
        </mesh>
      </group>
      {down && <DownBeam />}
      {(showLabel || down || hovered) && (
        // Nome em cima do switch (o caido sobe acima do feixe).
        <Html position={[0, down ? 1.55 : 0.3, 0]} center zIndexRange={[18, 0]}>
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
  // Porta do Rack Switch (mundo) de onde sai o tronco dos uplinks.
  rackPort: Vector3Tuple;
  // Cena "Switches ao vivo": todos os nomes; nas outras, so os caidos (e o do mouse).
  showLabels: boolean;
  // Trafego animado nos cabos (desligado na visao geral para nao poluir).
  animate: boolean;
  // Ate onde (x) a laje vai a direita (borda do piso do CPD), formando um piso so.
  floorEdgeX?: number;
}

export default function SwitchGrid({ switches, center, rackPort, showLabels, animate, floorEdgeX }: SwitchGridProps) {
  if (!switches.length) return null;
  // Ordem fixa pela numeracao do switch: cada um tem sempre o mesmo lugar (nao pula quando cai).
  const ordered = [...switches].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));
  const grid = switchGridLayout(ordered.length, center);
  const spineX = center[0] + grid.width / 2 + 0.6;
  const rowZ = (row: number) => center[2] - grid.depth / 2 + row * SWITCH_GRID_SPACING[1];
  const cableZ = (row: number) => rowZ(row) - 0.36; // atras da fileira
  const floorLeft = center[0] - grid.width / 2 - 0.7;
  const floorRight = floorEdgeX ?? center[0] + grid.width / 2 + 0.9;
  const firstCable = cableZ(0);
  const lastCable = cableZ(grid.rows - 1);
  // Tronco: da porta do rack, pelo piso, ate a espinha.
  const trunkEnd: Vector3Tuple = [spineX, CABLE_Y, Math.min(Math.max(rackPort[2], firstCable), lastCable)];

  return (
    <group>
      {/* Laje unica (switches + CPD): mesma cor do piso do CPD, 1 cm abaixo dele para nao piscar
          onde se sobrepoem. So aparece junto com a grade. */}
      <mesh receiveShadow position={[(floorLeft + floorRight) / 2, -0.035, center[2]]}>
        <boxGeometry args={[floorRight - floorLeft, 0.05, grid.depth + 1.3]} />
        <meshStandardMaterial color="#0b1220" roughness={0.62} />
      </mesh>

      <ConnectionLine
        from={rackPort}
        to={trunkEnd}
        via={[[rackPort[0], CABLE_Y, rackPort[2]], [rackPort[0], CABLE_Y, trunkEnd[2]]]}
        color={CABLE}
        active
        packets={animate ? 4 : 0}
        bidirectional
      />
      {/* Espinha ao longo da lateral da grade */}
      <ConnectionLine from={[spineX, CABLE_Y, firstCable]} to={[spineX, CABLE_Y, lastCable]} color={CABLE} active packets={animate ? 3 : 0} straight bidirectional />

      {Array.from({ length: grid.rows }).map((_, row) => {
        const rowItems = ordered.slice(row * grid.columns, (row + 1) * grid.columns);
        const leftX = grid.position(row * grid.columns)[0];
        return (
          <group key={`row-${row}`}>
            {/* Ramal da fileira, atras dos switches */}
            <ConnectionLine from={[spineX, CABLE_Y, cableZ(row)]} to={[leftX, CABLE_Y, cableZ(row)]} color={CABLE} active packets={animate ? 3 : 0} straight thin />
            {/* Descida da bandeja ate a porta de uplink de cada switch, na cor do estado,
                com trafego animado enquanto o switch responde (parado e vermelho quando cai). */}
            {rowItems.map((sw, column) => {
              const [x, , z] = grid.position(row * grid.columns + column);
              const color = sw.up === true ? UP : sw.up === false ? DOWN : UNKNOWN;
              return (
                <ConnectionLine
                  key={`drop-${sw.id}`}
                  from={[x, CABLE_Y, cableZ(row)]}
                  to={[x, PORT_Y, z - 0.17]}
                  color={color}
                  active
                  packets={animate && sw.up === true ? 2 : 0}
                  straight
                  bidirectional
                />
              );
            })}
          </group>
        );
      })}

      {ordered.map((sw, index) => (
        <SwitchUnit key={sw.id} sw={sw} position={grid.position(index)} showLabel={showLabels} />
      ))}
    </group>
  );
}
