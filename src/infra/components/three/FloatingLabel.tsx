import { Html } from '@react-three/drei';
import type { ReactNode } from 'react';
import type { Vector3Tuple } from 'three';

interface FloatingLabelProps {
  children: ReactNode;
  position?: Vector3Tuple;
  active?: boolean;
}

export default function FloatingLabel({ children, position = [0, 0, 0], active = false }: FloatingLabelProps) {
  if (!active) return null;

  return (
    <Html position={position} center occlude zIndexRange={[8, 0]}>
      <div
        className="whitespace-nowrap rounded-md border border-cyan-200/55 bg-slate-950/82 px-2.5 py-1 text-[10px] font-semibold text-cyan-50 shadow-glow backdrop-blur"
      >
        {children}
      </div>
    </Html>
  );
}
