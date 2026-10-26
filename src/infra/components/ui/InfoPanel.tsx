import { motion } from 'framer-motion';
import { Activity, AlertTriangle, Radio, Server, ShieldCheck, X } from 'lucide-react';
import type { InfraNode, RackInfo, SceneId, TourStep } from '../../types/infra';
import { internetLinks } from '../../data/infraData';
import { formatBps, type GroupStatus, type InfraLive } from '../../live';

interface InfoPanelProps {
  activeStep: TourStep;
  selectedNode?: InfraNode | null;
  selectedRack?: RackInfo | null;
  live: InfraLive | null;
  liveError: string;
  onClose: () => void;
}

type State = 'ok' | 'warning' | 'critical' | 'neutral';
type Metric = { label: string; value: string; state: State; hint?: string };

const pct = (value: number | null, warn = 75, crit = 90): Metric['state'] => (value === null ? 'neutral' : value >= crit ? 'critical' : value >= warn ? 'warning' : 'ok');
const groupMetric = (label: string, group: GroupStatus | undefined): Metric | null =>
  group && group.total
    ? { label, value: `${group.up}/${group.total}`, state: group.down === 0 ? 'ok' : group.up === 0 ? 'critical' : 'warning', hint: group.down ? `${group.down} sem resposta` : 'todos respondendo' }
    : null;

// Metricas reais de cada cena (cenas sem integracao ficam sem o bloco).
function metricsFor(scene: SceneId, live: InfraLive, rack: RackInfo | null | undefined): Metric[] {
  const list: (Metric | null)[] = [];
  const fw = live.firewall;
  const linksUp = internetLinks.filter((link) => live.links[link.id]?.online).length;
  const availability = live.hosts.known ? (live.hosts.up / live.hosts.known) * 100 : null;
  const view: SceneId | 'rack-01' = rack?.id === 'rack-01' ? 'rack-01' : rack?.id === 'rack-02' ? 'server-rack' : scene;

  switch (view) {
    case 'overview':
      list.push(
        availability === null ? null : { label: 'Disponibilidade', value: `${availability.toFixed(1)}%`, state: availability >= 98 ? 'ok' : availability >= 90 ? 'warning' : 'critical', hint: `${live.hosts.up} de ${live.hosts.known} dispositivos` },
        { label: 'Problemas ativos', value: String(live.problems.total), state: live.problems.high ? 'critical' : live.problems.total ? 'warning' : 'ok', hint: `${live.problems.high} alta ou maior` },
        { label: 'Links de internet', value: `${linksUp}/${internetLinks.length}`, state: linksUp === internetLinks.length ? 'ok' : linksUp ? 'warning' : 'critical' },
        fw ? { label: 'FortiGate CPU', value: fw.cpu === null ? '—' : `${fw.cpu}%`, state: pct(fw.cpu) } : null,
        live.wifi ? { label: 'Clientes Wi-Fi', value: String(live.wifi.clients), state: 'neutral' } : null,
        live.docker ? { label: 'Containers', value: `${live.docker.running}/${live.docker.containers}`, state: live.docker.running === live.docker.containers ? 'ok' : 'warning' } : null,
      );
      break;
    case 'internet':
      for (const link of internetLinks) {
        const status = live.links[link.id];
        list.push(
          status
            ? {
                label: link.provider,
                value: status.online ? `${status.latencyMs ?? '—'} ms` : 'OFFLINE',
                state: !status.online ? 'critical' : (status.lossPercent ?? 0) > 2 ? 'warning' : 'ok',
                hint: status.online ? `↓ ${formatBps(status.inBps)} · ↑ ${formatBps(status.outBps)} de ${status.contractedMbps >= 1000 ? `${status.contractedMbps / 1000} Gb` : `${status.contractedMbps} Mb`}` : 'sem resposta no Zabbix',
              }
            : { label: link.provider, value: '—', state: 'neutral', hint: 'link não encontrado no Zabbix' },
        );
      }
      break;
    case 'firewall':
      if (fw) {
        list.push(
          { label: 'CPU', value: fw.cpu === null ? '—' : `${fw.cpu}%`, state: pct(fw.cpu) },
          { label: 'Memória', value: fw.memory === null ? '—' : `${fw.memory}%`, state: pct(fw.memory, 80, 92) },
          { label: 'Sessões', value: fw.sessions === null ? '—' : fw.sessions.toLocaleString('pt-BR'), state: 'neutral' },
          { label: 'HA', value: fw.nodes ? `${fw.nodes} nós` : '—', state: fw.synced === false ? 'warning' : 'ok', hint: fw.synced === false ? 'fora de sincronia' : fw.haMode || 'sincronizado' },
          fw.blocked24h === null ? null : { label: 'Bloqueados 24 h', value: fw.blocked24h.toLocaleString('pt-BR'), state: 'neutral', hint: fw.detected24h ? `${fw.detected24h.toLocaleString('pt-BR')} detectados` : undefined },
          fw.tunnelsTotal ? { label: 'Túneis VPN', value: `${fw.tunnelsUp}/${fw.tunnelsTotal}`, state: fw.tunnelsUp === fw.tunnelsTotal ? 'ok' : 'warning' } : null,
        );
      }
      break;
    case 'datacenter':
    case 'racks':
      list.push(groupMetric('Switches', live.groups.switches), groupMetric('Servidores', live.groups.servidores), { label: 'Problemas ativos', value: String(live.problems.total), state: live.problems.high ? 'critical' : live.problems.total ? 'warning' : 'ok' });
      break;
    case 'rack-01':
    case 'network':
    case 'backbones':
    case 'switches':
      list.push(groupMetric('Switches respondendo', live.groups.switches), live.wifi ? { label: 'Antenas UniFi', value: `${live.wifi.apsOnline}/${live.wifi.aps}`, state: live.wifi.apsOnline === live.wifi.aps ? 'ok' : 'warning' } : null);
      break;
    case 'server-rack':
      list.push(groupMetric('Servidores respondendo', live.groups.servidores));
      if (live.docker) list.push({ label: 'Hosts Docker', value: `${live.docker.systemsUp}/${live.docker.systems}`, state: live.docker.systemsUp === live.docker.systems ? 'ok' : 'critical' }, { label: 'Containers', value: `${live.docker.running}/${live.docker.containers}`, state: live.docker.running === live.docker.containers ? 'ok' : 'warning' });
      break;
    case 'services':
      if (live.docker) {
        list.push(
          { label: 'Containers rodando', value: `${live.docker.running}/${live.docker.containers}`, state: live.docker.running === live.docker.containers ? 'ok' : 'warning' },
          { label: 'Hosts Docker', value: `${live.docker.systemsUp}/${live.docker.systems}`, state: live.docker.systemsUp === live.docker.systems ? 'ok' : 'critical' },
          { label: 'CPU média', value: live.docker.cpu === null ? '—' : `${live.docker.cpu}%`, state: pct(live.docker.cpu) },
          { label: 'Memória média', value: live.docker.mem === null ? '—' : `${live.docker.mem}%`, state: pct(live.docker.mem, 80, 92) },
        );
      }
      break;
    case 'wifi':
      if (live.wifi) {
        list.push(
          { label: 'Antenas online', value: `${live.wifi.apsOnline}/${live.wifi.aps}`, state: live.wifi.apsOnline === live.wifi.aps ? 'ok' : 'warning' },
          { label: 'Clientes conectados', value: String(live.wifi.clients), state: 'neutral' },
          ...live.wifi.topSsid.map((entry) => ({ label: entry.ssid, value: String(entry.count), state: 'neutral' as State, hint: 'clientes' })),
        );
      }
      break;
    case 'monitoring':
      list.push(
        { label: 'Problemas ativos', value: String(live.problems.total), state: live.problems.high ? 'critical' : live.problems.total ? 'warning' : 'ok' },
        { label: 'Alta ou maior', value: String(live.problems.high), state: live.problems.high ? 'critical' : 'ok' },
        availability === null ? null : { label: 'Disponibilidade', value: `${availability.toFixed(1)}%`, state: availability >= 98 ? 'ok' : availability >= 90 ? 'warning' : 'critical' },
      );
      break;
    default:
      break;
  }
  return list.filter((item): item is Metric => Boolean(item));
}

const stateClass: Record<State, string> = {
  ok: 'text-emerald-300',
  warning: 'text-amber-300',
  critical: 'text-rose-300',
  neutral: 'text-slate-100',
};

export default function InfoPanel({ activeStep, selectedNode, selectedRack, live, liveError, onClose }: InfoPanelProps) {
  const details = selectedRack?.services ?? selectedNode?.details ?? [];
  const title = selectedRack?.label ?? selectedNode?.label ?? activeStep.title;
  const metrics = live ? metricsFor(activeStep.id, live, selectedRack) : [];
  const updated = live ? new Date(live.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
  const showProblems = live && (activeStep.id === 'monitoring' || activeStep.id === 'overview') && !selectedRack && !selectedNode && live.problems.list.length > 0;
  // Switches caidos (cada um e um backbone vermelho na cena).
  const downSwitches = live && (['overview', 'datacenter', 'racks', 'network', 'backbones', 'switches'] as SceneId[]).includes(activeStep.id) ? live.switches.filter((sw) => sw.up === false) : [];

  return (
    <motion.section
      key={`${activeStep.id}-${title}`}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35 }}
      className="hud-panel pointer-events-auto absolute right-4 top-4 z-20 max-h-[calc(100%-2rem)] w-[min(360px,calc(100%-2rem))] overflow-y-auto rounded-lg p-5"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/80">{selectedRack || selectedNode ? 'Elemento selecionado' : activeStep.eyebrow}</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">{title}</h2>
        </div>
        {(selectedRack || selectedNode) && (
          <button
            onClick={onClose}
            className="grid size-9 shrink-0 place-items-center rounded-md border border-slate-500/30 bg-white/5 text-slate-200 transition hover:bg-white/10"
            title="Fechar painel"
          >
            <X size={17} />
          </button>
        )}
      </div>

      <p className="mb-5 text-sm leading-6 text-slate-300">{selectedRack || selectedNode ? 'Inventário visual e contexto técnico deste componente.' : activeStep.description}</p>

      {metrics.length > 0 && (
        <div className="mb-5">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            Ao vivo
            <span className="ml-auto font-normal normal-case tracking-normal text-slate-500">{updated}</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            {metrics.map((metric) => (
              <div key={metric.label} className="rounded-md border border-white/10 bg-slate-950/48 p-3" title={metric.hint}>
                <p className="truncate text-xs text-slate-400">{metric.label}</p>
                <p className={`text-lg font-semibold tabular-nums ${stateClass[metric.state]}`}>{metric.value}</p>
                {metric.hint && <p className="truncate text-[11px] text-slate-500">{metric.hint}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {downSwitches.length > 0 && (
        <div className="mb-5">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-rose-300">
            <AlertTriangle size={13} /> Switches sem resposta
          </p>
          <ul className="space-y-1.5">
            {downSwitches.map((sw) => (
              <li key={sw.id} className="flex items-center justify-between gap-2 rounded-md border border-rose-400/40 bg-rose-500/10 px-3 py-2">
                <span className="truncate text-xs font-semibold text-rose-100">{sw.name}</span>
                <span className="shrink-0 font-mono text-[11px] text-rose-200/80">{sw.ip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showProblems && live && (
        <div className="mb-5">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            <AlertTriangle size={13} /> Problemas recentes
          </p>
          <ul className="space-y-1.5">
            {live.problems.list.map((problem) => (
              <li key={`${problem.host}-${problem.name}-${problem.since}`} className="rounded-md border border-white/10 bg-slate-950/48 px-3 py-2">
                <p className={`truncate text-xs font-semibold ${problem.severity >= 4 ? 'text-rose-300' : 'text-amber-300'}`}>{problem.host}</p>
                <p className="truncate text-[11px] text-slate-400">{problem.name}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {details.length > 0 && (
        <div className="mb-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Capacidades</p>
          <div className="flex flex-wrap gap-2">
            {details.map((item) => (
              <span key={item} className="rounded-md border border-cyan-200/20 bg-cyan-200/10 px-2.5 py-1 text-xs text-cyan-100">
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      {!selectedRack && !selectedNode && metrics.length === 0 && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Segurança', icon: ShieldCheck },
            { label: 'Operação', icon: Activity },
            { label: 'Serviços', icon: Server },
          ].map((item) => (
            <div key={item.label} className="rounded-md border border-white/10 bg-white/5 p-3 text-center">
              <item.icon className="mx-auto mb-2 text-cyan-200" size={18} />
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">{item.label}</p>
            </div>
          ))}
        </div>
      )}

      {selectedRack?.id === 'rack-01' && live?.wifi && (
        <p className="mt-1 flex items-center gap-2 text-sm leading-6 text-slate-300">
          <Radio size={15} className="text-cyan-200" /> {live.wifi.apsOnline} antenas UniFi online atendendo {live.wifi.clients} clientes.
        </p>
      )}

      {liveError && (
        <p className="mt-4 rounded-md border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs text-amber-200">
          {live ? `Exibindo a última leitura. ${liveError}` : liveError}
        </p>
      )}
    </motion.section>
  );
}
