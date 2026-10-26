import { useFrame, useThree } from '@react-three/fiber';
import gsap from 'gsap';
import { RefObject, useEffect, useMemo } from 'react';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { TourStep } from '../../types/infra';
import { tupleToVector3 } from '../../utils/math';

interface CameraControllerProps {
  activeStep: TourStep;
  controlsRef: RefObject<OrbitControlsImpl | null>;
  disabled?: boolean;
}

export default function CameraController({ activeStep, controlsRef, disabled = false }: CameraControllerProps) {
  const { camera } = useThree();
  const target = useMemo(() => tupleToVector3(activeStep.target), [activeStep.target]);

  useEffect(() => {
    if (disabled) return;
    const controls = controlsRef.current;
    const cameraTween = gsap.to(camera.position, {
      x: activeStep.camera[0],
      y: activeStep.camera[1],
      z: activeStep.camera[2],
      duration: 1.7,
      ease: 'power3.inOut',
    });

    let targetTween: gsap.core.Tween | undefined;
    if (controls) {
      targetTween = gsap.to(controls.target, {
        x: activeStep.target[0],
        y: activeStep.target[1],
        z: activeStep.target[2],
        duration: 1.7,
        ease: 'power3.inOut',
        onUpdate: () => controls.update(),
      });
    }

    return () => {
      cameraTween.kill();
      targetTween?.kill();
    };
  }, [activeStep, camera.position, controlsRef, disabled]);

  useFrame(() => {
    if (!controlsRef.current) {
      camera.lookAt(target);
    }
  });

  return null;
}
