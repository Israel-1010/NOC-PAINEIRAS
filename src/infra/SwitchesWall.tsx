import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { Suspense, useMemo, useState } from 'react';
import { Vector3 } from 'three';
import InfraScene from './scenes/InfraScene';
import { switchShortName } from './backboneSwitches';
import { toInfraLive } from './live';
import './infra.css';

// Pagina do Painel NOC (TV): so a cena dos switches (grade, uplinks, Rack Switch e rack VMware),
// com os dados que o NOC ja carregou (funciona tambem com a chave de TV, sem login).

const TARGET = new Vector3(-2.0, 0.1, -1.1);
const CAMERA = new Vector3(-1.8, 6.1, 5.4);

// Camera fixa com um balanco lento (a imagem nao fica parada na TV, sem atrapalhar a leitura).
function SlowSway() {
  const camera = useThree((state) => state.camera);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    camera.position.set(CAMERA.x + Math.sin(t * 0.08) * 0.9, CAMERA.y + Math.sin(t * 0.05) * 0.15, CAMERA.z);
    camera.lookAt(TARGET);
  });
  return null;
}

export default function SwitchesWall({ data }: { data: unknown }) {
  const live = useMemo(() => toInfraLive(data as Parameters<typeof toInfraLive>[0]), [data]);
  const [lowQuality, setLowQuality] = useState(false);
  const down = live.switches.filter((sw) => sw.up === false);
  const up = live.switches.filter((sw) => sw.up === true).length;

  return (
    <div className="infra-root infra-wall">
      <div className="relative h-full w-full overflow-hidden bg-surface text-slate-50">
        <div className="canvas-stage absolute inset-0">
          <Canvas
            shadows={!lowQuality}
            dpr={lowQuality ? 1 : [1, 1.6]}
            camera={{ position: CAMERA.toArray(), fov: 42, near: 0.1, far: 100 }}
            gl={{ antialias: !lowQuality, alpha: false, powerPreference: 'high-performance' }}
          >
            <color attach="background" args={['#020617']} />
            <fog attach="fog" args={['#020617', 12, 30]} />
            <Suspense fallback={null}>
              <PerformanceMonitor onDecline={() => setLowQuality(true)}>
                <SlowSway />
                <InfraScene activeScene="switches" live={live} onSelectNode={() => undefined} />
                {!lowQuality && (
                  <EffectComposer multisampling={4}>
                    <Bloom intensity={0.38} luminanceThreshold={0.2} luminanceSmoothing={0.7} />
                    <Vignette darkness={0.45} offset={0.2} />
                  </EffectComposer>
                )}
              </PerformanceMonitor>
            </Suspense>
          </Canvas>
        </div>

        {/* Resumo sobreposto: quantos respondem e quais estao fora. */}
        <div className="hud-panel pointer-events-none absolute left-4 top-4 z-20 rounded-lg px-5 py-4">
          <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-200/80">Switches de acesso · ao vivo</p>
          <p className="mt-1 text-4xl font-semibold tabular-nums">
            <span className={down.length ? 'text-amber-300' : 'text-emerald-300'}>{up}</span>
            <span className="text-2xl text-slate-400">/{live.switches.length}</span>
          </p>
          <p className="text-xs text-slate-400">{down.length ? `${down.length} sem resposta` : 'todos respondendo'}</p>
        </div>
        {down.length > 0 && (
          <div className="hud-panel pointer-events-none absolute right-4 top-4 z-20 w-[min(360px,40%)] rounded-lg p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-rose-300">Sem resposta</p>
            <ul className="space-y-1.5">
              {down.slice(0, 8).map((sw) => (
                <li key={sw.id} className="flex items-center justify-between gap-2 rounded-md border border-rose-400/40 bg-rose-500/10 px-3 py-2">
                  <span className="truncate text-sm font-semibold text-rose-100">{switchShortName(sw.name)}</span>
                  <span className="shrink-0 font-mono text-xs text-rose-200/80">{sw.ip}</span>
                </li>
              ))}
              {down.length > 8 && <li className="text-xs text-rose-200/80">+{down.length - 8} outros</li>}
            </ul>
          </div>
        )}
        <div className="pointer-events-none absolute bottom-4 left-4 z-20 flex items-center gap-4 rounded-md bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
          <span className="flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-full bg-emerald-400" /> respondendo</span>
          <span className="flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-full bg-rose-500" /> sem resposta</span>
          <span className="flex items-center gap-1.5"><i className="inline-block h-0.5 w-5 bg-cyan-300" /> uplink (tráfego animado = link ativo)</span>
        </div>
      </div>
    </div>
  );
}
