import { ChevronLeft, ChevronRight, Pause, Play, Square } from 'lucide-react';
import type { TourState } from '../../hooks/useTour';
import PrimaryButton from './PrimaryButton';

interface TourControllerProps {
  tour: TourState;
}

export default function TourController({ tour }: TourControllerProps) {
  return (
    <div className="hud-panel pointer-events-auto absolute bottom-4 left-1/2 z-20 flex w-[min(720px,calc(100vw-2rem))] -translate-x-1/2 items-center gap-3 rounded-lg p-3">
      <div className="hidden min-w-0 flex-1 sm:block">
        <p className="truncate text-xs uppercase tracking-[0.2em] text-cyan-200/80">{tour.activeStep.eyebrow}</p>
        <p className="truncate text-sm font-semibold text-white">{tour.activeStep.title}</p>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <PrimaryButton variant="secondary" icon={<ChevronLeft size={16} />} onClick={tour.previous} disabled={tour.activeIndex === 0}>
          Anterior
        </PrimaryButton>
        <PrimaryButton variant="secondary" icon={tour.isPaused ? <Play size={16} /> : <Pause size={16} />} onClick={tour.pause}>
          {tour.isPaused ? 'Retomar' : 'Pausar'}
        </PrimaryButton>
        <PrimaryButton icon={<ChevronRight size={16} />} onClick={tour.next} disabled={tour.isLast}>
          Proximo
        </PrimaryButton>
        <PrimaryButton variant="ghost" icon={<Square size={15} />} onClick={tour.finish}>
          Finalizar
        </PrimaryButton>
      </div>
    </div>
  );
}
