import { useEffect, useState } from 'react';

// Dados reais para o Digital Twin: o mesmo /api/noc do Painel NOC (Zabbix, UniFi, Beszel),
// reduzido ao que cada cena mostra.

type NocHost = { id: string; name: string; ip: string; up: boolean | null; latencyMs: number | null };
type NocGroup = { key: string; total: number; up: number; down: number; hosts: NocHost[] };
type NocLink = { name: string; online: boolean; latencyMs: number | null; lossPercent: number | null; inBps: number; outBps: number; contractedMbps: number; usagePercent: number | null };
type NocFirewall = {
  name: string;
  cpu: number | null;
  memory: number | null;
  sessions: number | null;
  haMode: string;
  nodes: { hostname: string; synced: boolean | null }[];
  tunnels: { up: number; total: number }[];
  sslVpnUsers: number | null;
  security: { totals: { detected: number; blocked: number } } | null;
};
type NocProblem = { host: string; name: string; severity: number; since: string; category: string };
type NocPayload = {
  generatedAt: string;
  groups: NocGroup[];
  problems: NocProblem[];
  firewalls: NocFirewall[];
  links: NocLink[];
  unifi?: { aps: { online: boolean; clients: number }[]; clients: { total: number; wireless: number; bySsid: { ssid: string; count: number }[] } } | null;
  beszel?: { systems: { name: string; status: string; cpu: number | null; memPct: number | null }[]; containers: { status: string }[] } | null;
};

export type LinkStatus = { name: string; online: boolean; latencyMs: number | null; lossPercent: number | null; inBps: number; outBps: number; contractedMbps: number; usagePercent: number | null };
export type GroupStatus = { up: number; total: number; down: number };
export type SwitchStatus = { id: string; name: string; ip: string; up: boolean | null; latencyMs: number | null };

export type InfraLive = {
  updatedAt: string;
  error: string;
  links: Record<string, LinkStatus | undefined>; // chave = id do link no infraData (wan-hostfiber...)
  firewall: { cpu: number | null; memory: number | null; sessions: number | null; haMode: string; nodes: number; synced: boolean | null; blocked24h: number | null; detected24h: number | null; tunnelsUp: number; tunnelsTotal: number; vpnUsers: number | null } | null;
  groups: Record<string, GroupStatus | undefined>;
  // Switches do Zabbix (grupo Switch), um por backbone na cena.
  switches: SwitchStatus[];
  hosts: { up: number; known: number };
  problems: { total: number; high: number; list: NocProblem[] };
  wifi: { aps: number; apsOnline: number; clients: number; topSsid: { ssid: string; count: number }[] } | null;
  docker: { systems: number; systemsUp: number; cpu: number | null; mem: number | null; containers: number; running: number } | null;
};

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export function authToken() {
  try {
    const raw = window.localStorage.getItem('rede-clube-session');
    return raw ? (JSON.parse(raw) as { token?: string }).token || '' : '';
  } catch {
    return '';
  }
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${authToken()}`);
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (response.status === 401) window.dispatchEvent(new Event('rede-clube-auth-expired'));
  return response;
}

// Qual link do Zabbix e qual link da cena (pelo nome da operadora).
const LINK_MATCH: Record<string, RegExp> = {
  'wan-hostfiber': /host\s*fiber/i,
  'wan-telium': /telium/i,
  'wan-wcs': /\bwcs\b/i,
};

const avg = (values: (number | null)[]) => {
  const valid = values.filter((value): value is number => typeof value === 'number');
  return valid.length ? Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length) : null;
};

// Exportado para o Painel NOC (pagina 3D dos switches), que ja tem o /api/noc carregado.
export function toInfraLive(data: NocPayload): InfraLive {
  const links: InfraLive['links'] = {};
  for (const [id, match] of Object.entries(LINK_MATCH)) {
    const link = data.links.find((entry) => match.test(entry.name));
    if (link) links[id] = link;
  }
  const fw = data.firewalls[0];
  const groups: InfraLive['groups'] = {};
  for (const group of data.groups) groups[group.key] = { up: group.up, total: group.total, down: group.down };
  // Disponibilidade geral: hosts que respondem / hosts com leitura (CFTV fica de fora, como no NOC).
  const counted = data.groups.filter((group) => group.key !== 'cftv' && group.key !== 'links');
  const up = counted.reduce((sum, group) => sum + group.up, 0);
  const known = counted.reduce((sum, group) => sum + group.up + group.down, 0);
  const problems = data.problems.filter((problem) => problem.category !== 'cftv');
  const unifi = data.unifi;
  const beszel = data.beszel;
  return {
    updatedAt: data.generatedAt,
    error: '',
    links,
    firewall: fw
      ? {
          cpu: fw.cpu,
          memory: fw.memory,
          sessions: fw.sessions,
          haMode: fw.haMode,
          nodes: fw.nodes.length,
          synced: fw.nodes.length ? fw.nodes.every((node) => node.synced !== false) : null,
          blocked24h: fw.security?.totals.blocked ?? null,
          detected24h: fw.security?.totals.detected ?? null,
          tunnelsUp: fw.tunnels.reduce((sum, tunnel) => sum + tunnel.up, 0),
          tunnelsTotal: fw.tunnels.reduce((sum, tunnel) => sum + tunnel.total, 0),
          vpnUsers: fw.sslVpnUsers,
        }
      : null,
    groups,
    switches: (data.groups.find((group) => group.key === 'switches')?.hosts || []).map(({ id, name, ip, up: hostUp, latencyMs }) => ({ id, name, ip, up: hostUp, latencyMs })),
    hosts: { up, known },
    problems: { total: problems.length, high: problems.filter((problem) => problem.severity >= 4).length, list: problems.slice(0, 6) },
    wifi: unifi && unifi.aps.length
      ? { aps: unifi.aps.length, apsOnline: unifi.aps.filter((ap) => ap.online).length, clients: unifi.clients.total, topSsid: [...unifi.clients.bySsid].sort((a, b) => b.count - a.count).slice(0, 4) }
      : null,
    docker: beszel && beszel.systems.length
      ? {
          systems: beszel.systems.length,
          systemsUp: beszel.systems.filter((system) => system.status === 'up').length,
          cpu: avg(beszel.systems.map((system) => system.cpu)),
          mem: avg(beszel.systems.map((system) => system.memPct)),
          containers: beszel.containers.length,
          running: beszel.containers.filter((container) => /running|up/i.test(container.status)).length,
        }
      : null,
  };
}

// Atualiza a cada 15 s; mantem a ultima leitura se uma consulta falhar.
export function useInfraLive() {
  const [live, setLive] = useState<InfraLive | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await apiFetch('/api/noc');
        if (!response.ok) throw new Error(response.status === 403 ? 'Sem permissão para os dados do NOC.' : `Falha ao ler o NOC (${response.status}).`);
        const data = (await response.json()) as NocPayload;
        if (!cancelled) {
          setLive(toInfraLive(data));
          setError('');
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Falha ao ler o NOC.');
      }
    };
    load();
    const timer = window.setInterval(load, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);
  return { live, error };
}

export const formatBps = (bps: number) => {
  if (!bps) return '0';
  if (bps >= 1e9) return `${(bps / 1e9).toFixed(2)} Gb/s`;
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(1)} Mb/s`;
  return `${Math.round(bps / 1e3)} kb/s`;
};
