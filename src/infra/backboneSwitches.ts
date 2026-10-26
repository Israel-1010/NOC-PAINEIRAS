import type { SwitchStatus } from './live';

// Ligacao entre os pontos de backbone da cena e os switches do Zabbix.

export type BackboneNodeLike = { id: string; label: string; position: [number, number, number]; hostId?: string };

// "01-USW-FITNESS-BOXE" -> "FITNESS-BOXE"; "08-Core Servidores" -> "Core Servidores".
export function switchShortName(name: string) {
  return name.replace(/^\d+\s*-\s*/, '').replace(/^U?SW[-\s]+/i, '').trim().slice(0, 28) || name.slice(0, 28);
}

const STOP = new Set(['rack', 'usw', 'sw', 'switch', 'core', 'de', 'do', 'da', 'backbone']);
const tokens = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token && !STOP.has(token) && !/^\d+$/.test(token));

// Associa pontos sem switch ao switch de nome mais parecido, so quando a escolha e unica.
export function matchByName(nodes: BackboneNodeLike[], switches: SwitchStatus[]) {
  const used = new Set(nodes.map((node) => node.hostId).filter(Boolean));
  const result = new Map<string, string>();
  for (const node of nodes) {
    if (node.hostId) continue;
    const nodeTokens = tokens(node.label);
    if (!nodeTokens.length) continue;
    const scored = switches
      .filter((sw) => !used.has(sw.id))
      .map((sw) => ({ sw, score: tokens(sw.name).filter((token) => nodeTokens.includes(token)).length }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);
    // Empate (ex.: "portaria" -> PORTARIA 01 e PORTARIA 02) fica para o gestor escolher.
    if (scored.length && (scored.length === 1 || scored[0].score > scored[1].score)) {
      result.set(node.id, scored[0].sw.id);
      used.add(scored[0].sw.id);
    }
  }
  return result;
}

// Posicoes livres no piso dos backbones (mesma area que o arrastar permite).
export function freeSlots(occupied: [number, number, number][], count: number) {
  const slots: [number, number][] = [];
  for (let z = -2.45; z <= 0.1 && slots.length < count; z += 0.42) {
    for (let x = -0.5; x >= -3.7 && slots.length < count; x -= 0.42) {
      if (occupied.every((pos) => Math.hypot(pos[0] - x, pos[2] - z) > 0.36)) slots.push([x, z]);
    }
  }
  return slots;
}
