import type { Vector3Tuple } from 'three';

export type SceneId =
  | 'overview'
  | 'internet'
  | 'firewall'
  | 'datacenter'
  | 'racks'
  | 'server-rack'
  | 'cloud'
  | 'cloud-databases'
  | 'cloud-oracle-linux'
  | 'cloud-tsplus'
  | 'cloud-webservice'
  | 'cloud-m365'
  | 'backup'
  | 'services'
  | 'network'
  | 'switches'
  | 'wifi'
  | 'cftv'
  | 'monitoring';

export type InfraNodeKind =
  | 'internet'
  | 'cloud'
  | 'cloudflare'
  | 'firewall'
  | 'datacenter'
  | 'rack'
  | 'switch'
  | 'server'
  | 'database'
  | 'storage'
  | 'wifi'
  | 'camera'
  | 'dashboard'
  | 'department'
  | 'service';

export interface TourStep {
  id: SceneId;
  title: string;
  eyebrow: string;
  description: string;
  camera: Vector3Tuple;
  target: Vector3Tuple;
}

export interface InfraNode {
  id: string;
  label: string;
  kind: InfraNodeKind;
  position: Vector3Tuple;
  details: string[];
  scene: SceneId;
}

export interface RackInfo {
  id: string;
  label: string;
  role: 'network' | 'servers';
  position: Vector3Tuple;
  services: string[];
}

export interface InternetLinkInfo {
  id: string;
  label: string;
  provider: string;
  logo: string;
  position: Vector3Tuple;
  color: string;
  details: string[];
}

export interface CloudProviderInfo {
  id: string;
  label: string;
  logo: string;
  position: Vector3Tuple;
  color: string;
  details: string[];
}
