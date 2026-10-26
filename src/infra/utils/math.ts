import type { Vector3Tuple } from 'three';
import { Vector3 } from 'three';

export function tupleToVector3(value: Vector3Tuple): Vector3 {
  return new Vector3(value[0], value[1], value[2]);
}

export function lerpTuple(a: Vector3Tuple, b: Vector3Tuple, t: number): Vector3Tuple {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}
