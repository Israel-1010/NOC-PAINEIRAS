import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Mesh, Vector3Tuple } from 'three';
import { Color, Vector3 } from 'three';

interface ConnectionLineProps {
  from: Vector3Tuple;
  to: Vector3Tuple;
  color?: string;
  active?: boolean;
  packets?: number;
  straight?: boolean;
  bidirectional?: boolean;
  thin?: boolean;
  via?: Vector3Tuple[];
}

export default function ConnectionLine({ from, to, color = '#22d3ee', active = true, packets = 2, straight = false, bidirectional = false, thin = false, via = [] }: ConnectionLineProps) {
  const refs = useRef<Mesh[]>([]);
  // As coordenadas chegam como arrays novos a cada render: a chave em texto evita recalcular a curva.
  const key = `${from.join(',')}|${to.join(',')}|${via.map((point) => point.join(',')).join(';')}|${straight}`;
  const points = useMemo(() => {
    const start = new Vector3(...from);
    const end = new Vector3(...to);
    if (via.length > 0) {
      return [start, ...via.map((point) => new Vector3(...point)), end];
    }
    if (straight) {
      return [start, end];
    }
    const mid = start.clone().lerp(end, 0.5);
    mid.y += 0.45;
    return [start, mid, end];
  }, [key]);
  const emissiveColor = useMemo(() => new Color(color), [color]);

  useFrame(({ clock }) => {
    refs.current.forEach((packet, index) => {
      const rawPhase = (clock.elapsedTime * 0.28 + index / Math.max(packets, 1)) % 1;
      const phase = bidirectional && index % 2 === 1 ? 1 - rawPhase : rawPhase;
      const segmentCount = points.length - 1;
      const segmentProgress = Math.min(phase * segmentCount, segmentCount - 0.0001);
      const segmentIndex = Math.floor(segmentProgress);
      const localT = segmentProgress - segmentIndex;
      packet.position.lerpVectors(points[segmentIndex], points[segmentIndex + 1], localT);
      packet.visible = active;
    });
  });

  return (
    <group>
      <Line points={points} color={color} lineWidth={active ? (thin ? 0.85 : straight ? 3.2 : 1.6) : 0.45} transparent opacity={active ? (thin ? 0.58 : 0.82) : 0.2} />
      {Array.from({ length: packets }).map((_, index) => (
        <mesh
          key={index}
          ref={(node) => {
            if (node) refs.current[index] = node;
          }}
        >
          <sphereGeometry args={[thin ? 0.026 : 0.055, 16, 16]} />
          <meshStandardMaterial color={color} emissive={emissiveColor} emissiveIntensity={thin ? 1.8 : 2.5} />
        </mesh>
      ))}
    </group>
  );
}
