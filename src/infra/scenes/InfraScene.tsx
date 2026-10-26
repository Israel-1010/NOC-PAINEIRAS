import { Float, Grid, Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import type { Group, Vector3Tuple } from 'three';
import { cloudProviders, infraNodes, internetLinks, racks } from '../data/infraData';
import type { SceneId } from '../types/infra';
import type { InfraLive } from '../live';
import Cloud3D from '../components/three/Cloud3D';
import ConnectionLine from '../components/three/ConnectionLine';
import Firewall3D from '../components/three/Firewall3D';
import FloatingLabel from '../components/three/FloatingLabel';
import InternetLink3D, { DOWN_COLOR } from '../components/three/InternetLink3D';
import SwitchGrid from '../components/three/SwitchGrid';

// Switches de acesso no lugar dos antigos backbones, ao lado do Rack Switch.
const SWITCH_GRID_CENTER: Vector3Tuple = [-4.3, 0, -1.3];
// Porta do Rack Switch (no mundo) de onde saem os uplinks.
const SWITCH_RACK_PORT_WORLD: Vector3Tuple = [0.6, 0.06, -1.28];
const SWITCH_GRID_SCENES: SceneId[] = ['overview', 'datacenter', 'racks', 'network', 'switches'];
import Rack3D from '../components/three/Rack3D';
import cloudflareLogo from '../assets/providers/cloudflare-logo.svg';

interface InfraSceneProps {
  activeScene: SceneId;
  selectedRackId?: string | null;
  onSelectNode: (id: string) => void;
  onSelectRack?: (id: string) => void;
  live?: InfraLive | null;
}

interface DataCenterRoomProps extends InfraSceneProps {
  backgroundOnly?: boolean;
  simplifiedRacks?: boolean;
}

function isActive(activeScene: SceneId, scene: SceneId) {
  return activeScene === scene;
}

function isHighlighted(activeScene: SceneId, scene: SceneId) {
  return activeScene === scene || activeScene === 'overview';
}

function CloudJunction({ position }: { position: Vector3Tuple }) {
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.08, 18, 18]} />
        <meshStandardMaterial color="#7dd3fc" emissive="#22d3ee" emissiveIntensity={2.4} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.18, 0.008, 8, 36]} />
        <meshBasicMaterial color="#7dd3fc" transparent opacity={0.55} />
      </mesh>
    </group>
  );
}

function CloudflareNode({ position, active = false }: { position: Vector3Tuple; active?: boolean }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.18, 0.5, 0.12]} />
        <meshStandardMaterial color="#111827" emissive="#f97316" emissiveIntensity={active ? 0.18 : 0.08} roughness={0.38} metalness={0.18} />
      </mesh>
      <mesh position={[0, -0.31, 0.08]}>
        <boxGeometry args={[0.94, 0.035, 0.06]} />
        <meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={1.5} />
      </mesh>
      <Html position={[0, 0.02, 0.14]} center distanceFactor={7} zIndexRange={[18, 0]}>
        <div className="pointer-events-none grid h-[54px] w-[134px] place-items-center rounded-md border border-orange-200/35 bg-white px-3 shadow-glow">
          <img src={cloudflareLogo} alt="Cloudflare" className="max-h-[34px] max-w-[112px] object-contain" />
        </div>
      </Html>
      <FloatingLabel position={[0, 0.55, 0]} active={active}>
        Cloudflare | DNS/WAF/CDN
      </FloatingLabel>
    </group>
  );
}

function CloudServiceCard({
  label,
  subtitle,
  position,
  color,
  compact = false,
}: {
  label: string;
  subtitle: string;
  position: Vector3Tuple;
  color: string;
  compact?: boolean;
}) {
  const width = compact ? 0.58 : 0.82;
  const height = compact ? 0.28 : 0.4;
  const depth = compact ? 0.13 : 0.18;
  const lightWidth = compact ? 0.38 : 0.58;
  const htmlWidth = compact ? 74 : 96;
  const labelSize = compact ? 8 : 9;
  const subtitleSize = compact ? 7 : 8;

  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color="#07111f" emissive={color} emissiveIntensity={0.18} roughness={0.34} metalness={0.2} />
      </mesh>
      <mesh position={[0, compact ? 0.115 : 0.17, compact ? 0.09 : 0.12]}>
        <boxGeometry args={[lightWidth, 0.03, 0.032]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.4} />
      </mesh>
      <mesh position={[compact ? -0.22 : -0.32, compact ? -0.09 : -0.13, compact ? 0.09 : 0.12]}>
        <cylinderGeometry args={[compact ? 0.045 : 0.065, compact ? 0.045 : 0.065, compact ? 0.075 : 0.1, 24]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} />
      </mesh>
      <Html position={[compact ? 0.04 : 0.08, compact ? -0.015 : -0.02, compact ? 0.13 : 0.18]} center zIndexRange={[18, 0]}>
        <div className="pointer-events-none rounded-md border border-cyan-200/25 bg-slate-950/88 px-1.5 py-1 text-center shadow-glow backdrop-blur" style={{ width: htmlWidth }}>
          <p className="truncate font-bold uppercase tracking-wide text-white" style={{ fontSize: labelSize }}>{label}</p>
          <p className="font-semibold uppercase tracking-wide text-cyan-100/80" style={{ fontSize: subtitleSize }}>{subtitle}</p>
        </div>
      </Html>
    </group>
  );
}

function OracleLinuxMachine({ position }: { position: Vector3Tuple }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.05, 0.72, 0.42]} />
        <meshStandardMaterial color="#101827" emissive="#ef4444" emissiveIntensity={0.14} roughness={0.36} metalness={0.28} />
      </mesh>
      <mesh position={[0, 0.22, 0.24]}>
        <boxGeometry args={[0.82, 0.08, 0.035]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={1.4} />
      </mesh>
      <Html position={[0, -0.03, 0.28]} center zIndexRange={[18, 0]}>
        <div className="pointer-events-none w-[132px] rounded-md border border-red-300/30 bg-slate-950/90 px-2 py-1 text-center shadow-glow backdrop-blur">
          <p className="text-[10px] font-bold uppercase tracking-wide text-white">Linux VM</p>
          <p className="text-[8px] font-semibold uppercase tracking-wide text-red-100/85">Aplicacoes Web</p>
        </div>
      </Html>
      {[-0.36, 0, 0.36].map((x, index) => (
        <mesh key={x} position={[x, -0.28, 0.24]}>
          <boxGeometry args={[0.18, 0.1, 0.035]} />
          <meshStandardMaterial color={index === 1 ? '#34d399' : '#22d3ee'} emissive={index === 1 ? '#34d399' : '#22d3ee'} emissiveIntensity={1.2} />
        </mesh>
      ))}
    </group>
  );
}

function WindowsTsplusMachine({
  position,
  label = 'Windows VM',
  subtitle = 'TSPLUS',
  accent = '#38bdf8',
}: {
  position: Vector3Tuple;
  label?: string;
  subtitle?: string;
  accent?: string;
}) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.18, 0.76, 0.42]} />
        <meshStandardMaterial color="#0f1f33" emissive={accent} emissiveIntensity={0.18} roughness={0.34} metalness={0.28} />
      </mesh>
      <mesh position={[0, 0.25, 0.24]}>
        <boxGeometry args={[0.88, 0.08, 0.035]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.35} />
      </mesh>
      {[
        [-0.18, 0.02],
        [0.04, 0.02],
        [-0.18, -0.2],
        [0.04, -0.2],
      ].map(([x, y]) => (
        <mesh key={`${x}-${y}`} position={[x, y, 0.25]}>
          <boxGeometry args={[0.16, 0.16, 0.035]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.2} />
        </mesh>
      ))}
      <Html position={[0.18, -0.04, 0.29]} center zIndexRange={[18, 0]}>
        <div className="pointer-events-none w-[136px] rounded-md border border-sky-300/30 bg-slate-950/90 px-2 py-1 text-center shadow-glow backdrop-blur">
          <p className="text-[10px] font-bold uppercase tracking-wide text-white">{label}</p>
          <p className="text-[8px] font-semibold uppercase tracking-wide text-sky-100/85">{subtitle}</p>
        </div>
      </Html>
    </group>
  );
}

function CftvRack({ position, active }: { position: Vector3Tuple; active: boolean }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.62, 1.12, 0.48]} />
        <meshStandardMaterial color="#111827" emissive="#0ea5e9" emissiveIntensity={active ? 0.22 : 0.12} roughness={0.4} metalness={0.24} />
      </mesh>
      <mesh position={[0, 0, 0.255]}>
        <boxGeometry args={[0.55, 1.02, 0.025]} />
        <meshStandardMaterial color="#020617" transparent opacity={0.68} />
      </mesh>
      {[-0.34, -0.12, 0.1, 0.32].map((y, index) => (
        <group key={y} position={[0, y, 0.27]}>
          <mesh>
            <boxGeometry args={[0.44, 0.12, 0.035]} />
            <meshStandardMaterial color="#172033" emissive="#38bdf8" emissiveIntensity={0.18} roughness={0.34} metalness={0.24} />
          </mesh>
          <mesh position={[-0.15, 0.01, 0.025]}>
            <boxGeometry args={[0.12, 0.022, 0.012]} />
            <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={1.3} />
          </mesh>
          {[0.04, 0.14].map((x) => (
            <mesh key={x} position={[x, 0.01, 0.025]}>
              <sphereGeometry args={[0.02, 12, 12]} />
              <meshStandardMaterial color={index % 2 === 0 ? '#34d399' : '#60a5fa'} emissive={index % 2 === 0 ? '#34d399' : '#60a5fa'} emissiveIntensity={1.6} />
            </mesh>
          ))}
        </group>
      ))}
      <Html position={[0, 0.02, 0.32]} center zIndexRange={[18, 0]}>
        <div className="pointer-events-none w-[104px] rounded-md border border-cyan-200/25 bg-slate-950/88 px-2 py-1 text-center shadow-glow backdrop-blur">
          <p className="text-[9px] font-bold uppercase tracking-wide text-white">Rack CFTV</p>
          <p className="text-[8px] font-semibold uppercase tracking-wide text-cyan-100/80">Dahua</p>
        </div>
      </Html>
      <FloatingLabel position={[0, 0.78, 0]} active={active}>
        Rack CFTV | Dahua
      </FloatingLabel>
    </group>
  );
}

function BackupStorage({ label, position, compact = false }: { label: string; position: Vector3Tuple; compact?: boolean }) {
  const width = compact ? 0.5 : 0.68;
  const height = compact ? 0.62 : 0.86;

  return (
    <group position={position}>
      {[0.2, 0, -0.2].map((offset, index) => (
        <mesh key={offset} position={[0, offset, 0]} castShadow receiveShadow>
          <boxGeometry args={[width, 0.14, 0.32]} />
          <meshStandardMaterial color="#064e3b" emissive="#10b981" emissiveIntensity={0.18 + index * 0.05} roughness={0.38} metalness={0.2} />
        </mesh>
      ))}
      <mesh position={[0, height / 2 - 0.1, 0.18]}>
        <boxGeometry args={[width * 0.78, 0.03, 0.025]} />
        <meshStandardMaterial color="#6ee7b7" emissive="#34d399" emissiveIntensity={1.4} />
      </mesh>
      <Html position={[0, -0.58, 0.18]} center zIndexRange={[18, 0]}>
        <div className="pointer-events-none w-[108px] rounded-md border border-emerald-200/30 bg-slate-950/92 px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wide text-white shadow-glow">
          {label}
        </div>
      </Html>
    </group>
  );
}

function BackupEsxiHost({ label, position }: { label: string; position: Vector3Tuple }) {
  return (
    <group position={position} scale={[1.18, 1.18, 1.18]}>
      {[-0.42, -0.14, 0.14, 0.42].map((x) => (
        <group key={x} position={[x, 0.62, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.22, 0.22, 0.13]} />
            <meshStandardMaterial color="#065f46" emissive="#10b981" emissiveIntensity={0.45} roughness={0.34} metalness={0.18} />
          </mesh>
          <Html position={[0, 0, 0.08]} center zIndexRange={[18, 0]}>
            <div className="pointer-events-none text-[9px] font-black uppercase tracking-wide text-white">VM</div>
          </Html>
        </group>
      ))}
      <mesh position={[0, 0.32, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.18, 0.3, 0.28]} />
        <meshStandardMaterial color="#e58c38" emissive="#f97316" emissiveIntensity={0.18} roughness={0.35} metalness={0.16} />
      </mesh>
      <Html position={[0, 0.32, 0.18]} center zIndexRange={[18, 0]}>
        <div className="pointer-events-none text-[14px] font-black uppercase tracking-[0.25em] text-white">ESXi</div>
      </Html>
      <mesh position={[0, -0.04, 0]} rotation={[0, 0, Math.PI]} castShadow receiveShadow>
        <coneGeometry args={[0.5, 0.38, 4]} />
        <meshStandardMaterial color="#cbd5e1" transparent opacity={0.62} roughness={0.48} />
      </mesh>
      <mesh position={[0, -0.42, 0.02]} castShadow receiveShadow>
        <boxGeometry args={[0.6, 0.22, 0.28]} />
        <meshStandardMaterial color="#064e3b" emissive="#10b981" emissiveIntensity={0.25} roughness={0.34} metalness={0.24} />
      </mesh>
      <mesh position={[-0.18, -0.4, 0.18]}>
        <sphereGeometry args={[0.035, 12, 12]} />
        <meshStandardMaterial color="#6ee7b7" emissive="#34d399" emissiveIntensity={1.7} />
      </mesh>
      <mesh position={[0.14, -0.4, 0.18]}>
        <boxGeometry args={[0.26, 0.035, 0.02]} />
        <meshStandardMaterial color="#6ee7b7" emissive="#34d399" emissiveIntensity={1.4} />
      </mesh>
      <Html position={[0, -0.76, 0.2]} center zIndexRange={[18, 0]}>
        <div className="pointer-events-none rounded-md border border-cyan-200/35 bg-slate-950/94 px-3 py-1 text-center text-[11px] font-black uppercase tracking-wide text-white shadow-glow">
          {label}
        </div>
      </Html>
    </group>
  );
}

function VeeamBackupServer({ position }: { position: Vector3Tuple }) {
  return (
    <group position={position}>
      <Html position={[0, 0.82, 0.16]} center zIndexRange={[18, 0]}>
        <div className="pointer-events-none w-[142px] rounded-md border border-orange-200/35 bg-slate-950/94 px-2 py-1 text-center text-[10px] font-black uppercase tracking-wide text-white shadow-glow">
          Veeam Backup Server
        </div>
      </Html>
      <mesh position={[0, 0.28, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.62, 0.62, 0.18]} />
        <meshStandardMaterial color="#e58c38" emissive="#f97316" emissiveIntensity={0.26} roughness={0.36} metalness={0.18} />
      </mesh>
      <Html position={[0, 0.28, 0.12]} center zIndexRange={[18, 0]}>
        <div className="pointer-events-none text-[28px] font-black leading-none text-white">V</div>
      </Html>
      <mesh position={[0, -0.2, 0.02]} castShadow receiveShadow>
        <boxGeometry args={[0.72, 0.2, 0.26]} />
        <meshStandardMaterial color="#064e3b" emissive="#10b981" emissiveIntensity={0.25} roughness={0.34} metalness={0.24} />
      </mesh>
      <mesh position={[0.12, -0.18, 0.17]}>
        <boxGeometry args={[0.3, 0.03, 0.02]} />
        <meshStandardMaterial color="#6ee7b7" emissive="#34d399" emissiveIntensity={1.4} />
      </mesh>
    </group>
  );
}

function BackupCopyTarget({ position }: { position: Vector3Tuple }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.44, 0.58, 0.18]} />
        <meshStandardMaterial color="#065f46" emissive="#10b981" emissiveIntensity={0.28} roughness={0.34} metalness={0.24} />
      </mesh>
      <mesh position={[0, 0.05, 0.11]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.13, 0.012, 10, 36]} />
        <meshBasicMaterial color="#d1fae5" />
      </mesh>
      <mesh position={[0, 0.05, 0.12]}>
        <sphereGeometry args={[0.025, 10, 10]} />
        <meshStandardMaterial color="#d1fae5" emissive="#34d399" emissiveIntensity={1.4} />
      </mesh>
      <Html position={[0, -0.62, 0.16]} center zIndexRange={[18, 0]}>
        <div className="pointer-events-none w-[96px] rounded-md border border-emerald-200/30 bg-slate-950/92 px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wide text-white shadow-glow">
          Copia Backup
        </div>
      </Html>
    </group>
  );
}

function BackupEnvironment() {
  const productionHosts: Array<{ label: string; position: Vector3Tuple }> = [
    { label: 'Host 46', position: [-2.75, 2.45, -2.75] },
    { label: 'Host 47', position: [-2.75, 1.08, -2.75] },
  ];
  const replicaHosts: Array<{ label: string; position: Vector3Tuple }> = [
    { label: 'Host 25', position: [2.75, 2.45, -2.75] },
    { label: 'Host 36', position: [2.75, 1.08, -2.75] },
  ];
  const storageProd: Vector3Tuple = [-4.55, 1.75, -2.75];
  const storageReplica: Vector3Tuple = [4.55, 1.75, -2.75];
  const veeamPosition: Vector3Tuple = [0, 1.8, -2.75];
  const repositoryPosition: Vector3Tuple = [0, 0.36, -2.75];
  const copyPosition: Vector3Tuple = [1.42, -0.6, -2.75];

  return (
    <group>
      <Html position={[0, 3.68, -2.75]} center zIndexRange={[18, 0]}>
        <div className="pointer-events-none rounded-md border border-cyan-200/35 bg-slate-950/94 px-4 py-1 text-center text-[13px] font-black uppercase tracking-[0.18em] text-white shadow-glow">
          AMBIENTE BACKUP
        </div>
      </Html>
      <mesh position={[0, -0.16, -2.75]} receiveShadow>
        <boxGeometry args={[10.1, 0.04, 3.35]} />
        <meshStandardMaterial color="#07111f" emissive="#0f766e" emissiveIntensity={0.06} roughness={0.62} />
      </mesh>

      <BackupStorage label="Storage Produção" position={storageProd} />
      {productionHosts.map((host) => (
        <BackupEsxiHost key={host.label} label={host.label} position={host.position} />
      ))}
      <VeeamBackupServer position={veeamPosition} />
      <BackupStorage label="Backup Repositório" position={repositoryPosition} compact />
      <BackupCopyTarget position={copyPosition} />
      {replicaHosts.map((host) => (
        <BackupEsxiHost key={host.label} label={host.label} position={host.position} />
      ))}
      <BackupStorage label="Storage Replica" position={storageReplica} compact />

      {productionHosts.map((host, index) => (
        <group key={`prod-flow-${host.label}`}>
          <ConnectionLine from={storageProd} to={[host.position[0] - 0.62, host.position[1] - 0.15, host.position[2]]} active packets={1} color="#34d399" bidirectional thin />
          <ConnectionLine from={[host.position[0] + 0.62, host.position[1] - 0.1, host.position[2]]} to={veeamPosition} active packets={2} color="#f97316" bidirectional thin />
          {index === 0 && (
            <FloatingLabel position={[-1.25, 2.55, -2.75]} active>
              Backup
            </FloatingLabel>
          )}
        </group>
      ))}
      {replicaHosts.map((host, index) => (
        <group key={`replica-flow-${host.label}`}>
          <ConnectionLine from={veeamPosition} to={[host.position[0] - 0.62, host.position[1] - 0.1, host.position[2]]} active packets={2} color="#60a5fa" bidirectional thin />
          <ConnectionLine from={[host.position[0] + 0.62, host.position[1] - 0.15, host.position[2]]} to={storageReplica} active packets={1} color="#34d399" bidirectional thin />
          {index === 0 && (
            <FloatingLabel position={[1.35, 2.15, -2.75]} active>
              Replica
            </FloatingLabel>
          )}
        </group>
      ))}
      <ConnectionLine from={veeamPosition} to={repositoryPosition} active packets={2} color="#f59e0b" straight bidirectional />
      <FloatingLabel position={[0.7, 1.12, -2.75]} active>
        Backup FS
      </FloatingLabel>
      <ConnectionLine from={repositoryPosition} to={copyPosition} active packets={2} color="#f59e0b" bidirectional thin />
    </group>
  );
}

function ServerRackHost({ name, position }: { name: string; position: Vector3Tuple }) {
  return (
    <group position={position}>
      {[-0.33, -0.11, 0.11, 0.33].map((x) => (
        <group key={x} position={[x, 0.78, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.18, 0.18, 0.12]} />
            <meshStandardMaterial color="#075985" emissive="#38bdf8" emissiveIntensity={0.24} roughness={0.35} metalness={0.2} />
          </mesh>
          <Html position={[0, 0, 0.08]} center zIndexRange={[18, 0]}>
            <div className="pointer-events-none text-[8px] font-black uppercase text-white">VM</div>
          </Html>
        </group>
      ))}
      <mesh position={[0, 0.18, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.08, 0.82, 0.48]} />
        <meshStandardMaterial color="#151a20" emissive="#2563eb" emissiveIntensity={0.08} roughness={0.34} metalness={0.36} />
      </mesh>
      <mesh position={[0, 0.34, 0.27]}>
        <boxGeometry args={[0.82, 0.22, 0.035]} />
        <meshStandardMaterial color="#020617" roughness={0.42} metalness={0.2} />
      </mesh>
      {[-0.28, -0.12, 0.04, 0.2].map((y, row) => (
        <group key={y} position={[0, y, 0.27]}>
          <mesh>
            <boxGeometry args={[0.72, 0.04, 0.025]} />
            <meshStandardMaterial color="#0f172a" emissive="#1e293b" emissiveIntensity={0.5} />
          </mesh>
          {[0.32, 0.39].map((x, index) => (
            <mesh key={x} position={[x, 0, 0.02]}>
              <sphereGeometry args={[0.015, 10, 10]} />
              <meshStandardMaterial color={(row + index) % 2 === 0 ? '#22c55e' : '#38bdf8'} emissive={(row + index) % 2 === 0 ? '#22c55e' : '#38bdf8'} emissiveIntensity={1.6} />
            </mesh>
          ))}
        </group>
      ))}
      <Html position={[0, 1.02, 0.34]} center zIndexRange={[32, 0]}>
        <div className="pointer-events-none w-[150px] rounded-md border border-sky-100/70 bg-sky-950/98 px-3 py-1.5 text-center shadow-glow">
          <p className="text-[15px] font-black uppercase tracking-wide text-white drop-shadow">{name}</p>
        </div>
      </Html>
      <Html position={[-0.25, -0.42, 0.31]} center zIndexRange={[18, 0]}>
        <div className="pointer-events-none rounded bg-emerald-900/90 px-2 py-0.5 text-[8px] font-bold uppercase text-white">HBA 1</div>
      </Html>
      <Html position={[0.26, -0.42, 0.31]} center zIndexRange={[18, 0]}>
        <div className="pointer-events-none rounded bg-sky-900/90 px-2 py-0.5 text-[8px] font-bold uppercase text-white">HBA 2</div>
      </Html>
      {[-0.34, -0.18].map((x) => (
        <mesh key={`hba-a-${x}`} position={[x, -0.6, 0.27]}>
          <boxGeometry args={[0.1, 0.12, 0.04]} />
          <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={1.25} />
        </mesh>
      ))}
      {[0.18, 0.34].map((x) => (
        <mesh key={`hba-b-${x}`} position={[x, -0.6, 0.27]}>
          <boxGeometry args={[0.1, 0.12, 0.04]} />
          <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={1.25} />
        </mesh>
      ))}
    </group>
  );
}

function SanSwitch({ position }: { position: Vector3Tuple }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[4.6, 0.38, 0.48]} />
        <meshStandardMaterial color="#111827" emissive="#1d4ed8" emissiveIntensity={0.08} roughness={0.34} metalness={0.34} />
      </mesh>
      {Array.from({ length: 12 }).map((_, index) => (
        <group key={index} position={[-1.92 + index * 0.35, -0.02, 0.27]}>
          <mesh>
            <boxGeometry args={[0.18, 0.14, 0.04]} />
            <meshStandardMaterial color="#020617" emissive={index % 3 === 0 ? '#22c55e' : '#38bdf8'} emissiveIntensity={0.4} />
          </mesh>
          <mesh position={[0, -0.11, 0.03]}>
            <sphereGeometry args={[0.018, 10, 10]} />
            <meshStandardMaterial color={index % 3 === 0 ? '#22c55e' : '#38bdf8'} emissive={index % 3 === 0 ? '#22c55e' : '#38bdf8'} emissiveIntensity={1.5} />
          </mesh>
          <Html position={[0, 0.16, 0.05]} center zIndexRange={[18, 0]}>
            <div className="pointer-events-none text-[7px] font-bold text-slate-100">{index + 1}</div>
          </Html>
        </group>
      ))}
    </group>
  );
}

function SanStorage({ name, position }: { name: string; position: Vector3Tuple }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.85, 0.58, 0.5]} />
        <meshStandardMaterial color="#1f2937" emissive="#10b981" emissiveIntensity={0.08} roughness={0.34} metalness={0.36} />
      </mesh>
      <Html position={[0, 0.38, 0.31]} center zIndexRange={[18, 0]}>
        <div className="pointer-events-none w-[150px] rounded-md border border-emerald-200/35 bg-emerald-900/92 px-2 py-1 text-center shadow-glow">
          <p className="text-[11px] font-black uppercase tracking-wide text-white">{name}</p>
          <p className="text-[9px] font-semibold uppercase text-emerald-100">Array SAN</p>
        </div>
      </Html>
      <Html position={[-0.34, -0.12, 0.31]} center zIndexRange={[18, 0]}>
        <div className="pointer-events-none rounded bg-emerald-900/90 px-2 py-0.5 text-[8px] font-bold uppercase text-white">Porta A</div>
      </Html>
      <Html position={[0.44, -0.12, 0.31]} center zIndexRange={[18, 0]}>
        <div className="pointer-events-none rounded bg-sky-900/90 px-2 py-0.5 text-[8px] font-bold uppercase text-white">Porta B</div>
      </Html>
      <mesh position={[-0.44, -0.29, 0.28]}>
        <boxGeometry args={[0.16, 0.16, 0.04]} />
        <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={1.3} />
      </mesh>
      <mesh position={[0.44, -0.29, 0.28]}>
        <boxGeometry args={[0.16, 0.16, 0.04]} />
        <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={1.3} />
      </mesh>
      {[-0.78, -0.62, -0.46, 0.72, 0.88].map((x, index) => (
        <mesh key={x} position={[x, -0.08 + (index % 2) * 0.13, 0.28]}>
          <boxGeometry args={[0.12, 0.1, 0.03]} />
          <meshStandardMaterial color="#020617" emissive="#334155" emissiveIntensity={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function ServerRackSanEnvironment() {
  const hosts: Array<{ name: string; position: Vector3Tuple }> = [
    { name: 'ESXi-01', position: [-3.45, 2.1, -2.75] },
    { name: 'ESXi-02', position: [-1.15, 2.1, -2.75] },
    { name: 'ESXi-03', position: [1.15, 2.1, -2.75] },
    { name: 'ESXi-04', position: [3.45, 2.1, -2.75] },
  ];
  const vCenter: Vector3Tuple = [0, 3.55, -2.75];
  const sanSwitch: Vector3Tuple = [0, 0.78, -2.75];
  const storage01: Vector3Tuple = [-1.55, -0.42, -2.75];
  const storage02: Vector3Tuple = [1.55, -0.42, -2.75];
  const datastore: Vector3Tuple = [0, -1.38, -2.75];

  return (
    <group>
      <mesh position={[0, -0.17, -2.75]} receiveShadow>
        <boxGeometry args={[8.9, 0.05, 4.35]} />
        <meshStandardMaterial color="#0b1220" emissive="#1d4ed8" emissiveIntensity={0.05} roughness={0.58} />
      </mesh>
      <Html position={vCenter} center zIndexRange={[18, 0]}>
        <div className="pointer-events-none flex w-[320px] items-center gap-4 rounded-lg border border-sky-200/35 bg-slate-950/94 px-5 py-3 text-white shadow-glow">
          <div className="grid size-14 place-items-center rounded-md bg-gradient-to-br from-emerald-500 via-sky-500 to-yellow-400 text-2xl font-black">vC</div>
          <div>
            <p className="text-[17px] font-black">vCenter Server</p>
            <p className="text-[11px] font-semibold text-slate-300">Rede de Gerenciamento - VLAN 10</p>
          </div>
        </div>
      </Html>
      {hosts.map((host) => (
        <ServerRackHost key={host.name} name={host.name} position={host.position} />
      ))}
      <SanSwitch position={sanSwitch} />
      <SanStorage name="Storage 01" position={storage01} />
      <SanStorage name="Storage 02" position={storage02} />
      <group position={datastore}>
        <mesh position={[-0.55, 0, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.18, 32]} />
          <meshStandardMaterial color="#94a3b8" emissive="#64748b" emissiveIntensity={0.25} roughness={0.32} metalness={0.35} />
        </mesh>
        <Html position={[0.3, 0, 0.16]} center zIndexRange={[18, 0]}>
          <div className="pointer-events-none w-[210px] rounded-md border border-slate-200/30 bg-slate-950/94 px-3 py-2 shadow-glow">
            <p className="text-[13px] font-black uppercase text-white">Datastores VMFS</p>
            <p className="text-[10px] font-semibold text-slate-300">Armazenamento Compartilhado</p>
          </div>
        </Html>
      </group>

      {hosts.map((host, index) => (
        <group key={`san-links-${host.name}`}>
          <ConnectionLine from={vCenter} to={[host.position[0], host.position[1] + 0.72, host.position[2]]} active packets={1} color="#38bdf8" via={[[host.position[0], 3.03, -2.75]]} thin />
          <ConnectionLine from={[host.position[0] - 0.26, host.position[1] - 0.62, host.position[2]]} to={[-1.75 + index * 0.42, 0.95, -2.75]} active packets={1} color="#22c55e" via={[[host.position[0] - 0.26, 1.35, -2.75]]} thin />
          <ConnectionLine from={[host.position[0] + 0.26, host.position[1] - 0.62, host.position[2]]} to={[-1.55 + index * 0.42, 0.95, -2.75]} active packets={1} color="#38bdf8" via={[[host.position[0] + 0.26, 1.18, -2.75]]} thin />
        </group>
      ))}
      <ConnectionLine from={[-1.1, 0.58, -2.75]} to={[storage01[0] - 0.44, storage01[1] - 0.25, -2.75]} active packets={1} color="#22c55e" via={[[-1.1, 0.08, -2.75]]} thin />
      <ConnectionLine from={[-0.55, 0.58, -2.75]} to={[storage01[0] + 0.44, storage01[1] - 0.25, -2.75]} active packets={1} color="#38bdf8" via={[[-0.55, 0.02, -2.75]]} thin />
      <ConnectionLine from={[0.55, 0.58, -2.75]} to={[storage02[0] - 0.44, storage02[1] - 0.25, -2.75]} active packets={1} color="#22c55e" via={[[0.55, 0.02, -2.75]]} thin />
      <ConnectionLine from={[1.1, 0.58, -2.75]} to={[storage02[0] + 0.44, storage02[1] - 0.25, -2.75]} active packets={1} color="#38bdf8" via={[[1.1, 0.08, -2.75]]} thin />
      <ConnectionLine from={storage01} to={datastore} active packets={1} color="#60a5fa" thin />
      <ConnectionLine from={storage02} to={datastore} active packets={1} color="#60a5fa" thin />

      <Html position={[5.0, 1.82, -2.75]} center zIndexRange={[18, 0]}>
        <div className="pointer-events-none w-[220px] rounded-lg border border-slate-200/25 bg-slate-950/94 p-4 text-left text-white shadow-glow">
          <p className="mb-2 text-[14px] font-black uppercase">Legenda</p>
          <p className="text-[11px]"><span className="text-sky-300">--</span> Rede de Gerenciamento</p>
          <p className="text-[11px]"><span className="text-emerald-300">--</span> Caminho SAN A</p>
          <p className="text-[11px]"><span className="text-cyan-300">--</span> Caminho SAN B</p>
          <p className="mt-3 text-[14px] font-black uppercase">Resumo</p>
          <p className="text-[11px]">1 vCenter | 4 Hosts ESXi</p>
          <p className="text-[11px]">1 Switch SAN 12 portas</p>
          <p className="text-[11px]">2 Storages SAN | VMFS</p>
        </div>
      </Html>
    </group>
  );
}

function GlobeNode({ active, onClick }: { active: boolean; onClick: () => void }) {
  const ref = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.elapsedTime * 0.24;
  });

  return (
    <group ref={ref} position={[-8, 1.7, 2.6]} onClick={(event) => {
      event.stopPropagation();
      onClick();
    }}>
      <mesh castShadow>
        <sphereGeometry args={[0.55, 36, 36]} />
        <meshStandardMaterial color="#0f172a" emissive="#0ea5e9" emissiveIntensity={active ? 0.72 : 0.32} metalness={0.18} roughness={0.44} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.68, 0.012, 8, 64]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.65} />
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.68, 0.012, 8, 64]} />
        <meshBasicMaterial color="#60a5fa" transparent opacity={0.45} />
      </mesh>
      <FloatingLabel position={[0, 0.9, 0]} active={active}>Internet</FloatingLabel>
    </group>
  );
}

function DataCenterRoom({ activeScene, onSelectRack, backgroundOnly = false, simplifiedRacks = false }: DataCenterRoomProps) {
  const rackLabelsActive = !backgroundOnly && (activeScene === 'racks' || activeScene === 'datacenter' || activeScene === 'switches');
  const powerLineActive = !backgroundOnly && rackLabelsActive;
  const nobreaks: Array<{ label: string; position: Vector3Tuple; target: Vector3Tuple; via: Vector3Tuple[] }> = [
    {
      label: 'Nobreak 01',
      position: [4.35, 0.38, -1.95],
      target: [0.75, 0.12, -1.74],
      via: [
        [4.35, 0.12, -2.34],
        [0.75, 0.12, -2.34],
      ],
    },
    {
      label: 'Nobreak 02',
      position: [4.35, 0.38, -0.82],
      target: [2.55, 0.12, -1.74],
      via: [
        [4.85, 0.12, -0.82],
        [4.85, 0.12, -2.18],
        [2.55, 0.12, -2.18],
      ],
    },
  ];
  const rackInterlinkActive = !backgroundOnly && (activeScene === 'racks' || activeScene === 'datacenter' || activeScene === 'network' || activeScene === 'switches');
  const cftvRackActive = !backgroundOnly && (activeScene === 'racks' || activeScene === 'datacenter' || activeScene === 'network' || activeScene === 'cftv');
  const cftvRackPosition: Vector3Tuple = [5.18, 0.55, -1.38];
  const cftvRackPort: Vector3Tuple = [4.86, 0.24, -1.38];
  const switchRackCftvPort: Vector3Tuple = [1.3, 0.24, -1.02];
  return (
    <group position={[0.4, 0, -0.2]}>
      <mesh receiveShadow position={[1.9, -0.025, -1.1]}>
        <boxGeometry args={[5.8, 0.05, 2.95]} />
        <meshStandardMaterial color="#0b1220" roughness={0.62} />
      </mesh>
      {racks.map((rack) => (
        <Rack3D
          key={rack.id}
          id={rack.id}
          label={rack.label}
          variant={rack.role}
          position={rack.position}
          active={rackLabelsActive}
          simplified={simplifiedRacks}
          onClick={onSelectRack ?? (() => undefined)}
        />
      ))}
      {!backgroundOnly && (
        <>
          {/* Uplink Rack Switch <-> rack VMware (servidores): o caminho dos switches ate os servidores. */}
          <ConnectionLine from={[1.3, 0.18, -0.92]} to={[2.0, 0.18, -0.92]} color="#22d3ee" active={rackInterlinkActive} packets={activeScene === 'switches' ? 4 : 2} straight bidirectional />
          <FloatingLabel position={[1.65, 0.36, -0.92]} active={rackInterlinkActive}>
            Uplink Rack Switch ↔ VMware
          </FloatingLabel>
          {/* Na cena dos switches (e na TV do NOC) ficam so os dois racks: sem nobreaks e CFTV. */}
          {activeScene !== 'switches' && nobreaks.map((nobreak, index) => (
            <group key={nobreak.label}>
              <group position={nobreak.position}>
                <mesh castShadow receiveShadow>
                  <boxGeometry args={[0.48, 0.76, 0.42]} />
                  <meshStandardMaterial color="#111827" emissive="#0f766e" emissiveIntensity={0.18} roughness={0.42} metalness={0.18} />
                </mesh>
                <mesh position={[0, 0.24, 0.225]}>
                  <boxGeometry args={[0.32, 0.08, 0.018]} />
                  <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={1.6} />
                </mesh>
                <mesh position={[-0.14, -0.22, 0.225]}>
                  <sphereGeometry args={[0.035, 12, 12]} />
                  <meshStandardMaterial color="#34d399" emissive="#34d399" emissiveIntensity={1.8} />
                </mesh>
                <mesh position={[0.14, -0.22, 0.225]}>
                  <sphereGeometry args={[0.035, 12, 12]} />
                  <meshStandardMaterial color={index === 0 ? '#22d3ee' : '#34d399'} emissive={index === 0 ? '#22d3ee' : '#34d399'} emissiveIntensity={1.8} />
                </mesh>
                <FloatingLabel position={[0, 0.62, 0]} active={rackLabelsActive}>
                  {nobreak.label}
                </FloatingLabel>
              </group>
              <ConnectionLine from={[nobreak.position[0], 0.12, nobreak.position[2]]} to={nobreak.target} via={nobreak.via} color={index === 0 ? '#f59e0b' : '#34d399'} active={powerLineActive} packets={1} thin />
            </group>
          ))}
          {activeScene !== 'switches' && <CftvRack position={cftvRackPosition} active={cftvRackActive} />}
          {activeScene !== 'switches' && (<ConnectionLine
            from={cftvRackPort}
            to={switchRackCftvPort}
            via={[
              [4.55, 0.1, -0.74],
              [1.3, 0.1, -0.74],
            ]}
            color="#60a5fa"
            active={cftvRackActive}
            packets={2}
            bidirectional
            thin
          />)}
        </>
      )}
    </group>
  );
}

export default function InfraScene({ activeScene, selectedRackId, onSelectNode, onSelectRack, live = null }: InfraSceneProps) {
  const linkState = (id: string) => live?.links[id];
  const rackOnlyScene = activeScene === 'datacenter' || activeScene === 'racks';
  const serverRackScene = activeScene === 'server-rack';
  const oracleLinuxScene = activeScene === 'cloud-oracle-linux';
  const oracleTsplusScene = activeScene === 'cloud-tsplus';
  const oracleWebserviceScene = activeScene === 'cloud-webservice';
  const backupScene = activeScene === 'backup';
  const focusedCloudScene = activeScene === 'cloud-databases' || oracleLinuxScene || oracleTsplusScene || oracleWebserviceScene || activeScene === 'cloud-m365';
  const isolatedScene = focusedCloudScene || backupScene || serverRackScene;
  const cloudSceneWithRackBase = activeScene === 'cloud-databases' || oracleLinuxScene || oracleTsplusScene || oracleWebserviceScene;

  const fortigateWanPorts: Vector3Tuple[][] = [
    [
      [-0.92, 2.75, -2.0],
      [0.52, 2.75, -2.0],
    ],
    [
      [-0.72, 2.75, -2.0],
      [0.72, 2.75, -2.0],
    ],
    [
      [-0.52, 2.75, -2.0],
      [0.92, 2.75, -2.0],
    ],
  ];
  const firewallHaNodes: Array<{ label: string; position: Vector3Tuple }> = [
    { label: 'FortiGate 01 | HA', position: [-0.82, 2.35, -2.35] },
    { label: 'FortiGate 02 | HA', position: [0.92, 2.35, -2.35] },
  ];
  const fortigateCloudPort: Vector3Tuple = [0.05, 2.65, -2.15];
  const cloudJunction: Vector3Tuple = [1.6, 3.55, -3.1];
  const cloudflarePosition: Vector3Tuple = [0.85, 4.0, -3.45];
  const oraclePublicEntry: Vector3Tuple = [2.55, 3.75, -3.2];
  const awsPublicEntry: Vector3Tuple = [5.85, 3.75, -3.2];
  const oracleDatabaseCards: Array<{ label: string; subtitle: string; position: Vector3Tuple }> = [
    { label: 'CPM', subtitle: 'PRODUÇÃO', position: [1.35, 3.28, -3.1] },
    { label: 'CPMHML', subtitle: 'TESTE / HML', position: [3.75, 3.28, -3.1] },
  ];
  const oracleSmallDatabaseCards: Array<{ label: string; subtitle: string; position: Vector3Tuple; color: string }> = [
    { label: 'SIGA', subtitle: 'PROD', position: [1.35, 2.76, -3.08], color: '#ef4444' },
    { label: 'SIIG', subtitle: 'PROD', position: [1.35, 2.48, -3.08], color: '#ef4444' },
    { label: 'MED4WEB', subtitle: 'PROD', position: [1.35, 2.2, -3.08], color: '#ef4444' },
    { label: 'ALIVE', subtitle: 'PROD', position: [1.35, 1.92, -3.08], color: '#ef4444' },
    { label: 'ALMITEC', subtitle: 'PROD', position: [1.35, 1.64, -3.08], color: '#ef4444' },
    { label: 'SIGA', subtitle: 'HML', position: [3.75, 2.76, -3.08], color: '#f97316' },
    { label: 'SIIG', subtitle: 'HML', position: [3.75, 2.48, -3.08], color: '#f97316' },
    { label: 'MED4WEB', subtitle: 'HML', position: [3.75, 2.2, -3.08], color: '#f97316' },
    { label: 'ALIVE', subtitle: 'HML', position: [3.75, 1.92, -3.08], color: '#f97316' },
    { label: 'ALMITEC', subtitle: 'HML', position: [3.75, 1.64, -3.08], color: '#f97316' },
  ];
  const databaseVpnStart: Vector3Tuple = [2.95, 1.7, -1.55];
  const databaseVpnEnd: Vector3Tuple = [2.55, 3.72, -3.28];
  const databaseVpnPath: Vector3Tuple[] = [
    [2.95, 2.35, -2.15],
    [2.65, 3.05, -2.85],
  ];
  const oracleLinuxPosition: Vector3Tuple = [2.55, 3.28, -3.1];
  const oracleLinuxOutput: Vector3Tuple = [2.55, 2.92, -3.02];
  const cloudflareOracleEntry: Vector3Tuple = [1.42, 3.18, -3.08];
  const oracleNginxProxyPosition: Vector3Tuple = [1.78, 2.22, -3.08];
  const oracleDockerPosition: Vector3Tuple = [2.62, 2.22, -3.08];
  const oraclePortainerPosition: Vector3Tuple = [3.4, 2.22, -3.08];
  const oracleAppsWebPosition: Vector3Tuple = [4.22, 2.22, -3.08];
  const oracleContainerCards: Array<{ label: string; subtitle: string; position: Vector3Tuple; color: string }> = [
    { label: 'Nginx Proxy', subtitle: 'REVERSO', position: oracleNginxProxyPosition, color: '#34d399' },
    { label: 'Docker', subtitle: 'ENGINE', position: oracleDockerPosition, color: '#22d3ee' },
    { label: 'Portainer', subtitle: 'GERÊNCIA', position: oraclePortainerPosition, color: '#38bdf8' },
    { label: 'Apps Web', subtitle: 'CONTAINERS', position: oracleAppsWebPosition, color: '#f97316' },
  ];
  const oracleWebApps: Array<{ label: string; subtitle: string; position: Vector3Tuple }> = [
    { label: 'PaineirasVisit', subtitle: 'APP WEB', position: [5.25, 2.92, -3.08] },
    { label: 'Admissão', subtitle: 'APP WEB', position: [5.25, 2.32, -3.08] },
    { label: 'Desligamento RH', subtitle: 'APP WEB', position: [5.25, 1.72, -3.08] },
  ];
  const windowsTsplusPosition: Vector3Tuple = [2.45, 3.28, -3.1];
  const tsplusCloudflarePosition: Vector3Tuple = [0.78, 3.24, -3.08];
  const tsplusCloudflareEntry: Vector3Tuple = [1.4, 3.24, -3.08];
  const tsplusRackPort: Vector3Tuple = [2.95, 1.24, -0.96];
  const activeDirectoryPosition: Vector3Tuple = [4.15, 3.28, -3.08];
  const internalControlCards: Array<{ label: string; subtitle: string; position: Vector3Tuple; color: string; type: 'rack' }> = [
    { label: 'Apps Internas', subtitle: 'NO RACK', position: tsplusRackPort, color: '#38bdf8', type: 'rack' },
  ];
  const webservicePosition: Vector3Tuple = [2.55, 3.28, -3.1];
  const webserviceAppsWebPosition: Vector3Tuple = [2.55, 2.18, -3.08];
  const webserviceCpmPosition: Vector3Tuple = [1.55, 1.82, -3.08];
  const webserviceClients: Array<{ label: string; subtitle: string; position: Vector3Tuple; color: string }> = [
    { label: 'iOS', subtitle: 'MOBILE', position: [1.45, 2.58, -3.08], color: '#60a5fa' },
    { label: 'Android', subtitle: 'MOBILE', position: [3.65, 2.58, -3.08], color: '#34d399' },
    { label: 'Web Alive', subtitle: 'PORTAL', position: [4.45, 3.12, -3.08], color: '#f97316' },
  ];
  const m365ServiceCards: Array<{ label: string; subtitle: string; position: Vector3Tuple }> = [
    { label: 'Azure AD', subtitle: 'IDENTIDADE', position: [2.45, 3.18, -3.08] },
    { label: 'SharePoint', subtitle: 'PORTAL / DOCS', position: [3.62, 3.18, -3.08] },
    { label: 'OneDrive', subtitle: 'ARQUIVOS', position: [4.78, 3.18, -3.08] },
    { label: 'Teams', subtitle: 'COLABORAÇÃO', position: [5.95, 3.18, -3.08] },
    { label: 'Intune', subtitle: 'DISPOSITIVOS', position: [3.05, 2.36, -3.08] },
    { label: 'MDM', subtitle: 'GESTÃO MOBILE', position: [4.2, 2.36, -3.08] },
    { label: 'Defender', subtitle: 'SEGURANÇA', position: [5.35, 2.36, -3.08] },
  ];

  return (
    <group>
      <ambientLight intensity={0.32} />
      <hemisphereLight args={['#67e8f9', '#020617', 0.9]} />
      <directionalLight position={[5, 8, 5]} intensity={2.5} castShadow shadow-mapSize={[2048, 2048]} />
      <pointLight position={[-3, 3.2, 2]} intensity={16} color="#22d3ee" />
      <pointLight position={[5.2, 4.2, 1.5]} intensity={12} color="#60a5fa" />

      {!rackOnlyScene && (
        <Grid
          position={[0, -0.03, 0]}
          args={[18, 18]}
          cellSize={0.75}
          cellThickness={0.55}
          cellColor="#1e3a8a"
          sectionSize={3}
          sectionThickness={1.1}
          sectionColor="#0891b2"
          fadeDistance={18}
          fadeStrength={1}
        />
      )}

      {!rackOnlyScene && activeScene === 'overview' && <GlobeNode active={false} onClick={() => onSelectNode('internet')} />}
      {!rackOnlyScene &&
        !isolatedScene &&
        (activeScene === 'internet' || activeScene === 'firewall' || activeScene === 'overview') &&
        internetLinks.map((link) => (
          <InternetLink3D
            key={link.id}
            label={link.label}
            provider={link.provider}
            logo={link.logo}
            position={link.position}
            color={link.color}
            active={isActive(activeScene, 'internet')}
            online={linkState(link.id)?.online ?? null}
            latencyMs={linkState(link.id)?.latencyMs ?? null}
          />
        ))}
      {!rackOnlyScene &&
        !isolatedScene &&
        activeScene !== 'switches' &&
        firewallHaNodes.map((firewall) => (
          <Firewall3D
            key={firewall.label}
            id="firewall"
            label={firewall.label}
            position={firewall.position}
            active={isActive(activeScene, 'firewall') || isActive(activeScene, 'internet')}
            onClick={onSelectNode}
          />
        ))}
      {!rackOnlyScene && activeScene === 'firewall' && (
        <group>
          <ConnectionLine from={[-0.22, 2.1, -2.16]} to={[0.32, 2.1, -2.16]} active packets={2} color="#f59e0b" straight bidirectional />
          <FloatingLabel position={[0.05, 2.5, -2.16]} active>
            HA Sync
          </FloatingLabel>
        </group>
      )}
      {(!isolatedScene || cloudSceneWithRackBase) && (
        <DataCenterRoom
          activeScene={activeScene}
          selectedRackId={selectedRackId}
          onSelectNode={onSelectNode}
          onSelectRack={onSelectRack}
          backgroundOnly={cloudSceneWithRackBase}
          simplifiedRacks={oracleTsplusScene}
        />
      )}

      {!isolatedScene && SWITCH_GRID_SCENES.includes(activeScene) && live && live.switches.length > 0 && (
        <SwitchGrid
          switches={live.switches}
          center={SWITCH_GRID_CENTER}
          rackPort={SWITCH_RACK_PORT_WORLD}
          showLabels={activeScene !== 'overview'}
          animate={activeScene !== 'overview'}
          floorEdgeX={5.2}
        />
      )}
      {serverRackScene && <ServerRackSanEnvironment />}
      {backupScene && <BackupEnvironment />}

      {!rackOnlyScene && (activeScene === 'cloud' || activeScene === 'cloud-databases' || oracleLinuxScene || oracleTsplusScene || oracleWebserviceScene || activeScene === 'cloud-m365' || activeScene === 'overview') && (
        <group>
          {activeScene === 'cloud' && <CloudJunction position={cloudJunction} />}
          {(activeScene === 'cloud' || oracleLinuxScene || oracleTsplusScene || oracleWebserviceScene || activeScene === 'overview') && (
            <CloudflareNode
              position={oracleTsplusScene ? tsplusCloudflarePosition : oracleLinuxScene ? [0.8, 3.18, -3.08] : oracleWebserviceScene ? [0.8, 3.18, -3.08] : cloudflarePosition}
              active={activeScene === 'cloud' || oracleLinuxScene || oracleTsplusScene || oracleWebserviceScene}
            />
          )}
          {cloudProviders
            .filter((cloud) => {
              if (activeScene === 'cloud-databases') return cloud.id === 'oracle-cloud';
              if (oracleLinuxScene || oracleTsplusScene || oracleWebserviceScene) return cloud.id === 'oracle-cloud';
              if (activeScene === 'cloud-m365') return cloud.id === 'office365-cloud';
              return true;
            })
            .map((cloud, index) => (
              <Float key={cloud.id} speed={0.9 + index * 0.12} floatIntensity={0.2} rotationIntensity={0.04}>
                <Cloud3D
                  id="cloud"
                  label={cloud.label}
                  logo={cloud.logo}
                  color={cloud.color}
                  position={cloud.position}
                  active={isActive(activeScene, 'cloud') || isActive(activeScene, 'cloud-databases') || oracleLinuxScene || oracleTsplusScene || oracleWebserviceScene}
                  onClick={onSelectNode}
                />
              </Float>
          ))}
          {activeScene === 'cloud' && (
            <group>
              <ConnectionLine from={cloudflarePosition} to={oraclePublicEntry} active packets={2} color="#f97316" bidirectional />
              <ConnectionLine from={cloudflarePosition} to={awsPublicEntry} active packets={2} color="#f97316" bidirectional />
              <FloatingLabel position={[3.25, 3.5, -3.15]} active>
                Entrada publica de sites e apps
              </FloatingLabel>
            </group>
          )}
          {activeScene === 'cloud-databases' && (
            <group>
              <FloatingLabel position={[2.55, 3.75, -3.1]} active>
                Oracle Cloud | Bancos de Dados
              </FloatingLabel>
              <ConnectionLine from={databaseVpnStart} to={databaseVpnEnd} via={databaseVpnPath} active packets={3} color="#22d3ee" bidirectional />
              <FloatingLabel position={[3.0, 2.7, -2.45]} active>
                VPN Site-to-Site | Clube Geral
              </FloatingLabel>
              {oracleDatabaseCards.map((database) => (
                <group key={database.label}>
                  <ConnectionLine from={[2.55, 3.82, -3.35]} to={database.position} active packets={2} color="#ef4444" />
                  <CloudServiceCard label={database.label} subtitle={database.subtitle} position={database.position} color="#ef4444" />
                </group>
              ))}
              {oracleSmallDatabaseCards.map((database) => (
                <group key={`${database.subtitle}-${database.label}`}>
                  <CloudServiceCard label={database.label} subtitle={database.subtitle} position={database.position} color={database.color} compact />
                </group>
              ))}
            </group>
          )}
          {oracleTsplusScene && (
            <group>
              <FloatingLabel position={[2.55, 4.02, -3.1]} active>
                Oracle Cloud | Windows TSplus
              </FloatingLabel>
              <ConnectionLine from={[2.55, 3.82, -3.35]} to={windowsTsplusPosition} active packets={2} color="#38bdf8" />
              <ConnectionLine from={tsplusCloudflareEntry} to={[1.92, 3.24, -3.08]} active packets={3} color="#f97316" straight bidirectional />
              <WindowsTsplusMachine position={windowsTsplusPosition} />
              <WindowsTsplusMachine position={activeDirectoryPosition} label="Active Directory" subtitle="IDENTIDADE" accent="#34d399" />
              <FloatingLabel position={[1.45, 2.84, -3.08]} active>
                Sistemas.clubepaineiras.com.br
              </FloatingLabel>
              <FloatingLabel position={[3.05, 2.62, -2.74]} active>
                Site-to-Site | Rack / TSplus
              </FloatingLabel>
              {internalControlCards.map((service) => (
                <group key={service.label}>
                  <CloudServiceCard label={service.label} subtitle={service.subtitle} position={service.position} color={service.color} />
                </group>
              ))}
              <ConnectionLine from={tsplusRackPort} to={[2.45, 2.94, -3.02]} active packets={2} color="#38bdf8" straight bidirectional thin />
              <ConnectionLine from={[3.04, 3.28, -3.08]} to={[3.56, 3.28, -3.08]} active packets={2} color="#34d399" straight bidirectional />
            </group>
          )}
          {oracleWebserviceScene && (
            <group>
              <FloatingLabel position={[2.55, 3.95, -3.1]} active>
                Oracle Cloud | Windows Webservice
              </FloatingLabel>
              <ConnectionLine from={[2.55, 3.82, -3.35]} to={webservicePosition} active packets={2} color="#38bdf8" />
              <ConnectionLine from={[1.42, 3.18, -3.08]} to={[2.02, 3.16, -3.08]} active packets={2} color="#f97316" straight bidirectional />
              <WindowsTsplusMachine position={webservicePosition} label="Windows Server" subtitle="C# WEBSERVICE" accent="#60a5fa" />
              <FloatingLabel position={[1.66, 3.52, -3.08]} active>
                Entrada dos apps mobile e portal
              </FloatingLabel>
              <CloudServiceCard label="Apps Web" subtitle="CONTAINERS" position={webserviceAppsWebPosition} color="#f97316" />
              <ConnectionLine from={webserviceAppsWebPosition} to={[2.55, 2.92, -3.02]} active packets={2} color="#f97316" straight bidirectional />
              <CloudServiceCard label="CPM" subtitle="PRODUÇÃO" position={webserviceCpmPosition} color="#ef4444" />
              <ConnectionLine from={[2.2, 2.94, -3.02]} to={webserviceCpmPosition} active packets={2} color="#ef4444" straight bidirectional />
              {webserviceClients.map((client) => (
                <group key={client.label}>
                  <ConnectionLine from={client.position} to={[2.55, 3.02, -3.02]} active packets={1} color={client.color} straight bidirectional thin />
                  <CloudServiceCard label={client.label} subtitle={client.subtitle} position={client.position} color={client.color} />
                </group>
              ))}
            </group>
          )}
          {oracleLinuxScene && (
            <group>
              <FloatingLabel position={[2.55, 4.22, -3.1]} active>
                Oracle Cloud | Linux e Containers
              </FloatingLabel>
              <ConnectionLine from={[2.55, 3.82, -3.35]} to={oracleLinuxPosition} active packets={2} color="#ef4444" />
              <OracleLinuxMachine position={oracleLinuxPosition} />
              <ConnectionLine from={cloudflareOracleEntry} to={oracleNginxProxyPosition} active packets={3} color="#f97316" straight bidirectional />
              <ConnectionLine from={oracleLinuxOutput} to={oracleNginxProxyPosition} active packets={2} color="#34d399" straight bidirectional />
              <ConnectionLine from={oracleNginxProxyPosition} to={oracleDockerPosition} active packets={2} color="#22d3ee" straight bidirectional />
              <ConnectionLine from={oracleDockerPosition} to={oraclePortainerPosition} active packets={2} color="#38bdf8" straight bidirectional />
              <ConnectionLine from={oraclePortainerPosition} to={oracleAppsWebPosition} active packets={2} color="#f97316" straight bidirectional />
              <FloatingLabel position={[0.98, 3.42, -3.08]} active>
                Acesso via Cloudflare
              </FloatingLabel>
              {oracleContainerCards.map((service) => (
                <group key={service.label}>
                  <CloudServiceCard label={service.label} subtitle={service.subtitle} position={service.position} color={service.color} />
                </group>
              ))}
              <FloatingLabel position={[3.05, 2.78, -3.08]} active>
                Fluxo: Nginx | Docker | Portainer | Apps
              </FloatingLabel>
              {oracleWebApps.map((app) => (
                <group key={app.label}>
                  <ConnectionLine from={oracleAppsWebPosition} to={app.position} active packets={1} color="#f97316" straight />
                  <CloudServiceCard label={app.label} subtitle={app.subtitle} position={app.position} color="#f97316" />
                </group>
              ))}
            </group>
          )}
          {activeScene === 'cloud-m365' && (
            <group>
              <FloatingLabel position={[4.2, 3.92, -3.08]} active>
                Office 365 | Servicos
              </FloatingLabel>
              {m365ServiceCards.map((service) => (
                <group key={service.label}>
                  <ConnectionLine from={[4.2, 3.82, -3.35]} to={service.position} active packets={service.label === 'Azure AD' ? 2 : 1} color="#0ea5e9" />
                  <CloudServiceCard label={service.label} subtitle={service.subtitle} position={service.position} color="#0ea5e9" />
                </group>
              ))}
            </group>
          )}
        </group>
      )}

      {!rackOnlyScene &&
        !isolatedScene &&
        (activeScene === 'internet' || activeScene === 'firewall' || activeScene === 'overview') &&
        internetLinks.flatMap((link, index) =>
          fortigateWanPorts[index].map((port, portIndex) => (
            <ConnectionLine
              key={`internet-link-${link.id}-${portIndex}`}
              from={link.position}
              to={port}
              active={(isHighlighted(activeScene, 'internet') || isHighlighted(activeScene, 'firewall')) && linkState(link.id)?.online !== false}
              packets={portIndex === 0 ? index + 2 : 1}
              color={linkState(link.id)?.online === false ? DOWN_COLOR : link.color}
              straight
              bidirectional
              thin={portIndex === 1}
            />
          )),
        )}
      {!rackOnlyScene &&
        !isolatedScene &&
        (isHighlighted(activeScene, 'firewall') || isHighlighted(activeScene, 'network') || isHighlighted(activeScene, 'datacenter')) && (
          <group>
            <ConnectionLine from={[-0.82, 1.82, -2.35]} to={[1.2, 1.25, -1.05]} active packets={3} color="#22d3ee" bidirectional />
            <ConnectionLine from={[0.92, 1.82, -2.35]} to={[1.5, 1.25, -1.05]} active packets={3} color="#38bdf8" bidirectional />
          </group>
        )}
      {!rackOnlyScene &&
        activeScene === 'cloud' && (
          <group>
            <ConnectionLine from={fortigateCloudPort} to={cloudJunction} active packets={4} color="#7dd3fc" bidirectional />
            {cloudProviders.map((cloud) => (
              <ConnectionLine
                key={`cloud-link-${cloud.id}`}
                from={cloudJunction}
                to={[cloud.position[0], cloud.position[1] - 0.45, cloud.position[2]]}
                active
                packets={2}
                color="#7dd3fc"
                straight
                bidirectional
              />
            ))}
          </group>
        )}

    </group>
  );
}
