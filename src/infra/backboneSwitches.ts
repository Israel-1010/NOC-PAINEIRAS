import type { SwitchStatus } from './live';

// Cada backbone da cena e uma AREA do clube (portaria, futebol, biblioteca...) e agrupa os
// switches do Zabbix daquela area; a cor do backbone resume o estado deles.

export type AreaNodeLike = { id: string; label: string; hostIds?: string[] };
export type AreaState = 'ok' | 'partial' | 'down' | 'unknown' | 'none';

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

// Para cada switch ainda sem area, a area de nome mais parecido (so quando a escolha e unica).
// Ex.: "RACK PORTARIA" recebe "16-USW-PORTARIA 02" e "17-USW-PORTARIA 01".
export function matchAreas(nodes: AreaNodeLike[], switches: SwitchStatus[]) {
  const assigned = new Set(nodes.flatMap((node) => node.hostIds ?? []));
  const result = new Map<string, string[]>();
  for (const sw of switches) {
    if (assigned.has(sw.id)) continue;
    const swTokens = tokens(sw.name);
    const scored = nodes
      .map((node) => ({ node, score: tokens(node.label).filter((token) => swTokens.includes(token)).length }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);
    if (scored.length && (scored.length === 1 || scored[0].score > scored[1].score)) {
      result.set(scored[0].node.id, [...(result.get(scored[0].node.id) ?? []), sw.id]);
    }
  }
  return result;
}

export function areaStatus(hostIds: string[] | undefined, byId: Map<string, SwitchStatus>) {
  const members = (hostIds ?? []).map((id) => byId.get(id)).filter((sw): sw is SwitchStatus => Boolean(sw));
  const up = members.filter((sw) => sw.up === true).length;
  const down = members.filter((sw) => sw.up === false);
  const state: AreaState = !members.length ? 'none' : down.length === members.length ? 'down' : down.length ? 'partial' : up ? 'ok' : 'unknown';
  return { members, up, down, state };
}
