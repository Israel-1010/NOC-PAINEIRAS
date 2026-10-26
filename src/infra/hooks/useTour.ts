import { useCallback, useEffect, useMemo, useState } from 'react';
import { tourSteps } from '../data/infraData';
import type { SceneId, TourStep } from '../types/infra';

export interface TourState {
  activeStep: TourStep;
  activeIndex: number;
  isLast: boolean;
  isTouring: boolean;
  isPaused: boolean;
  goToStep: (id: SceneId) => void;
  next: () => void;
  previous: () => void;
  start: () => void;
  pause: () => void;
  finish: () => void;
}

export function useTour(initialTour = false, initialScene?: SceneId): TourState {
  const initialIndex = Math.max(
    0,
    tourSteps.findIndex((step) => step.id === initialScene),
  );
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [isTouring, setIsTouring] = useState(initialTour);
  const [isPaused, setIsPaused] = useState(false);

  const goToStep = useCallback((id: SceneId) => {
    const nextIndex = tourSteps.findIndex((step) => step.id === id);
    if (nextIndex >= 0) {
      setActiveIndex(nextIndex);
    }
  }, []);

  const next = useCallback(() => {
    setActiveIndex((current) => Math.min(current + 1, tourSteps.length - 1));
  }, []);

  const previous = useCallback(() => {
    setActiveIndex((current) => Math.max(current - 1, 0));
  }, []);

  const start = useCallback(() => {
    setIsTouring(true);
    setIsPaused(false);
    setActiveIndex(0);
  }, []);

  const pause = useCallback(() => {
    setIsPaused((current) => !current);
  }, []);

  const finish = useCallback(() => {
    setIsTouring(false);
    setIsPaused(false);
  }, []);

  useEffect(() => {
    if (!isTouring || isPaused) return;
    // Tour em loop (bom para a TV do NOC): do ultimo passo volta para a visao geral.
    const timer = window.setTimeout(() => {
      setActiveIndex((current) => (current >= tourSteps.length - 1 ? 0 : current + 1));
    }, 7600);

    return () => window.clearTimeout(timer);
  }, [activeIndex, isPaused, isTouring]);

  return useMemo(
    () => ({
      activeStep: tourSteps[activeIndex],
      activeIndex,
      isLast: activeIndex >= tourSteps.length - 1,
      isTouring,
      isPaused,
      goToStep,
      next,
      previous,
      start,
      pause,
      finish,
    }),
    [activeIndex, finish, goToStep, isPaused, isTouring, next, pause, previous, start],
  );
}
