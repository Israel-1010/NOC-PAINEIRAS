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

// Leque: arcos concentricos saindo da porta do rack (na direcao -x), como uma estrela de fibras.
// Cada arco respeita a faixa do piso (|z - porta| <= 1.22) e um espaco minimo entre pinos.
export function fanPositions(count: number, port: [number, number]): [number, number][] {
  const spacing = 0.34;
  const maxSpread = 1.22;
  const rings: { r: number; angles: number }[] = [];
  let capacity = 0;
  for (let i = 0; capacity < count && i < 12; i += 1) {
    const r = 0.95 + i * 0.52;
    const theta = Math.min((55 * Math.PI) / 180, Math.asin(Math.min(1, maxSpread / r)));
    const slots = Math.max(1, Math.floor((2 * r * theta) / spacing) + 1);
    rings.push({ r, angles: slots });
    capacity += slots;
  }
  const result: [number, number][] = [];
  let left = count;
  for (const ring of rings) {
    const n = Math.min(ring.angles, left);
    if (n <= 0) break;
    const theta = Math.min((55 * Math.PI) / 180, Math.asin(Math.min(1, maxSpread / ring.r)));
    for (let k = 0; k < n; k += 1) {
      const angle = n === 1 ? 0 : -theta + (2 * theta * k) / (n - 1);
      result.push([port[0] - ring.r * Math.cos(angle), port[1] + ring.r * Math.sin(angle)]);
    }
    left -= n;
  }
  return result;
}

// Ordem do leque: pela numeracao do switch ("01-USW-..."), depois pelo nome; pontos sem switch no fim.
export function fanOrder<T extends BackboneNodeLike>(nodes: T[], switches: SwitchStatus[]) {
  const nameOf = (node: T) => switches.find((sw) => sw.id === node.hostId)?.name ?? '';
  return [...nodes].sort((a, b) => {
    const na = nameOf(a);
    const nb = nameOf(b);
    if (!na !== !nb) return na ? -1 : 1;
    return (na || a.label).localeCompare(nb || b.label, 'pt-BR', { numeric: true });
  });
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
