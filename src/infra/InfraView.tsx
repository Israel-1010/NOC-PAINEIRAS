import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerformanceMonitor, Preload, Stats } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { infraNodes, racks } from './data/infraData';
import { useTour } from './hooks/useTour';
import InfraScene from './scenes/InfraScene';
import CameraController from './components/three/CameraController';
import InfoPanel from './components/ui/InfoPanel';
import NavigationMenu from './components/ui/NavigationMenu';
import TourController from './components/ui/TourController';
import { useInfraLive } from './live';
import type { InfraNode, RackInfo } from './types/infra';
import './infra.css';

// Digital Twin da infraestrutura (projeto InfraVision) dentro do portal, com dados reais do NOC.
export default function InfraView() {
  const tour = useTour(false);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedRackId, setSelectedRackId] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);
  // Qualidade cai sozinha quando o FPS despenca (TV/PC fraco): sem bloom e com menos resolucao.
  const [lowQuality, setLowQuality] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const { live, error } = useInfraLive();

  const selectedNode = useMemo<InfraNode | null>(() => infraNodes.find((node) => node.id === selectedNodeId) ?? null, [selectedNodeId]);
  const selectedRack = useMemo<RackInfo | null>(() => racks.find((rack) => rack.id === selectedRackId) ?? null, [selectedRackId]);

  // Modo TV: menus escondidos e tour automatico em loop. Liga pelo botao "Modo TV" (TV que ja abre
  // o navegador em tela cheia/kiosk) ou ao entrar em tela cheia.
  const [tvMode, setTvMode] = useState(false);
  const { start: startTour, finish: finishTour } = tour;
  const enterTvMode = () => {
    setTvMode(true);
    startTour();
  };
  const exitTvMode = () => {
    setTvMode(false);
    finishTour();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
  };
  useEffect(() => {
    const onChange = () => {
      const isFull = document.fullscreenElement === rootRef.current;
      setFullscreen(isFull);
      if (isFull) {
        setTvMode(true);
        startTour();
      }
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [startTour]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    else rootRef.current?.requestFullscreen().catch(() => undefined);
  };

  return (
    <div ref={rootRef} className={`infra-root${fullscreen ? ' is-fullscreen' : ''}`}>
      <div className="relative h-full w-full overflow-hidden bg-surface text-slate-50">
        <div className="canvas-stage absolute inset-0">
          <Canvas
            shadows={!lowQuality}
            dpr={lowQuality ? 1 : [1, 1.75]}
            camera={{ position: [13, 10, 13], fov: 45, near: 0.1, far: 100 }}
            gl={{ antialias: !lowQuality, alpha: false, powerPreference: 'high-performance' }}
          >
            <color attach="background" args={['#020617']} />
            <fog attach="fog" args={['#020617', 12, 36]} />
            <Suspense fallback={null}>
              <PerformanceMonitor onDecline={() => setLowQuality(true)}>
                <CameraController activeStep={tour.activeStep} controlsRef={controlsRef} disabled={tour.isPaused} />
                <InfraScene
                  activeScene={tour.activeStep.id}
                  selectedRackId={selectedRackId}
                  live={live}
                  onSelectNode={(id) => {
                    const node = infraNodes.find((item) => item.id === id);
                    if (node) tour.goToStep(node.scene);
                    setSelectedNodeId(id);
                    setSelectedRackId(null);
                  }}
                  onSelectRack={(id) => {
                    tour.goToStep(id === 'rack-02' ? 'server-rack' : 'racks');
                    setSelectedRackId(id);
                    setSelectedNodeId(null);
                  }}
                />
                <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.08} minDistance={3} maxDistance={22} maxPolarAngle={Math.PI * 0.48} />
                {!lowQuality && (
                  <EffectComposer multisampling={4}>
                    <Bloom intensity={0.34} luminanceThreshold={0.2} luminanceSmoothing={0.7} />
                    <Vignette darkness={0.42} offset={0.18} />
                  </EffectComposer>
                )}
                <Preload all />
              </PerformanceMonitor>
            </Suspense>
            {showStats && <Stats />}
          </Canvas>
        </div>

        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_35%,rgba(2,6,23,0.58))]" />
        {tvMode ? (
          // Modo TV: so um selo discreto (cena atual) e o botao de sair; o 3D ocupa a tela.
          <div className="hud-panel pointer-events-auto absolute left-4 top-4 z-20 flex items-center gap-3 rounded-lg px-4 py-3">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-emerald-400" />
            </span>
            <div>
              <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-200/80">InfraVision · ao vivo</p>
              <p className="text-base font-semibold text-white">{tour.activeStep.title}</p>
            </div>
            <button
              onClick={exitTvMode}
              className="ml-2 rounded-md border border-slate-500/30 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
              title="Sair do modo TV"
            >
              Sair
            </button>
          </div>
        ) : (
          <NavigationMenu
            activeId={tour.activeStep.id}
            onSelect={tour.goToStep}
            onStartTour={tour.start}
            fullscreen={fullscreen}
            onToggleFullscreen={toggleFullscreen}
            onTvMode={enterTvMode}
          />
        )}
        <InfoPanel
          activeStep={tour.activeStep}
          selectedNode={selectedNode}
          selectedRack={selectedRack}
          live={live}
          liveError={error}
          onClose={() => {
            setSelectedNodeId(null);
            setSelectedRackId(null);
          }}
        />
        {tour.isTouring && !tvMode && <TourController tour={tour} />}

        <div className="pointer-events-auto absolute bottom-4 right-4 z-20 flex items-center gap-2">
          {lowQuality && (
            <button
              onClick={() => setLowQuality(false)}
              className="rounded-md border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-200 backdrop-blur transition hover:bg-amber-300/20"
              title="O efeito de brilho foi desligado porque o computador estava lento. Clique para religar."
            >
              Modo leve
            </button>
          )}
          <button
            onClick={() => setShowStats((current) => !current)}
            className="rounded-md border border-slate-500/30 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 backdrop-blur transition hover:bg-white/10"
          >
            FPS
          </button>
        </div>
      </div>
    </div>
  );
}
