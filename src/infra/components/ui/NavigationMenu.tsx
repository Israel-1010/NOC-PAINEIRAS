import { Map, Maximize2, Minimize2, Play, RotateCcw, Tv } from 'lucide-react';
import type { SceneId } from '../../types/infra';
import PrimaryButton from './PrimaryButton';

interface NavigationMenuProps {
  activeId: SceneId;
  onSelect: (id: SceneId) => void;
  onStartTour: () => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  // Modo TV: esconde os menus e roda o tour em loop.
  onTvMode: () => void;
}

type MenuRow = {
  id?: SceneId;
  label: string;
  number?: string;
  depth?: 0 | 1 | 2 | 3;
};

const menuRows: MenuRow[] = [
  { id: 'overview', label: 'Visão Geral', number: '01' },
  { id: 'internet', label: 'Links de Internet', number: '02' },
  { id: 'firewall', label: 'FortiGate HA', number: '03' },
  { id: 'datacenter', label: 'CPD', number: '04' },
  { id: 'racks', label: 'Racks', number: '05' },
  { id: 'server-rack', label: 'Rack Servidores', depth: 1 },
  { label: 'Nuvens', number: '06' },
  { id: 'cloud', label: 'Nuvem', depth: 1 },
  { label: 'Oracle', depth: 1 },
  { id: 'cloud-databases', label: 'Banco de Dados', depth: 2 },
  { id: 'cloud-oracle-linux', label: 'Oracle Linux', depth: 2 },
  { id: 'cloud-tsplus', label: 'Windows TSplus', depth: 2 },
  { id: 'cloud-webservice', label: 'Webservice', depth: 2 },
  { id: 'cloud-m365', label: 'Office 365', depth: 1 },
  { id: 'backup', label: 'Backup', number: '07' },
  { id: 'services', label: 'Serviços', number: '08' },
  { id: 'network', label: 'Rede', number: '09' },
  { id: 'switches', label: 'Switches ao vivo', depth: 1 },
  { id: 'wifi', label: 'Wi-Fi', number: '10' },
  { id: 'cftv', label: 'CFTV', number: '11' },
  { id: 'monitoring', label: 'Monitoramento', number: '12' },
];

const selectableRows = menuRows.filter((row): row is MenuRow & { id: SceneId } => Boolean(row.id));
const cloudSceneIds: SceneId[] = ['cloud', 'cloud-databases', 'cloud-oracle-linux', 'cloud-tsplus', 'cloud-webservice', 'cloud-m365'];

function FullscreenButton({ fullscreen, onClick }: { fullscreen: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="grid size-10 shrink-0 place-items-center rounded-md border border-slate-500/30 bg-white/5 text-slate-200 transition hover:bg-white/10"
      title={fullscreen ? 'Sair da tela cheia' : 'Tela cheia (TV)'}
      aria-label={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
    >
      {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
    </button>
  );
}

export default function NavigationMenu({ activeId, onSelect, onStartTour, fullscreen, onToggleFullscreen, onTvMode }: NavigationMenuProps) {
  return (
    <>
      <div className="hud-panel pointer-events-auto absolute left-4 top-4 z-20 flex w-[min(360px,calc(100%-2rem))] items-center gap-2 rounded-lg p-3 lg:hidden">
        <FullscreenButton fullscreen={fullscreen} onClick={onToggleFullscreen} />
        <button
          onClick={onTvMode}
          className="grid size-10 shrink-0 place-items-center rounded-md border border-slate-500/30 bg-white/5 text-slate-200 transition hover:bg-white/10"
          title="Modo TV"
        >
          <Tv size={18} />
        </button>
        <button
          onClick={onStartTour}
          className="grid size-10 shrink-0 place-items-center rounded-md border border-cyan-300/40 bg-cyan-300 text-slate-950 transition hover:bg-cyan-200"
          title="Iniciar tour"
        >
          <Play size={18} />
        </button>
        <select
          value={activeId}
          onChange={(event) => onSelect(event.target.value as SceneId)}
          className="min-w-0 flex-1 rounded-md border border-slate-500/30 bg-slate-950/80 px-3 py-2 text-sm font-semibold text-slate-100 outline-none ring-cyan-200/40 focus:ring-2"
          aria-label="Selecionar cena"
        >
          {selectableRows.map((row) => (
            <option key={row.id} value={row.id}>
              {row.number ? `${row.number} - ` : `${'-- '.repeat(row.depth ?? 0)}`}{row.label}
            </option>
          ))}
        </select>
      </div>

      <aside className="hud-panel pointer-events-auto absolute left-4 top-4 z-20 hidden max-h-[calc(100%-2rem)] w-[260px] flex-col rounded-lg p-4 lg:flex">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/80">InfraVision</p>
            <h2 className="text-lg font-semibold text-white">Digital Twin</h2>
          </div>
          <FullscreenButton fullscreen={fullscreen} onClick={onToggleFullscreen} />
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <PrimaryButton icon={<Play size={16} />} onClick={onStartTour}>
            Tour
          </PrimaryButton>
          <PrimaryButton icon={<RotateCcw size={16} />} variant="secondary" onClick={() => onSelect('overview')}>
            Geral
          </PrimaryButton>
          <PrimaryButton icon={<Tv size={16} />} variant="secondary" className="col-span-2" onClick={onTvMode} title="Esconde os menus e roda o tour sozinho, em loop (para a TV do NOC)">
            Modo TV
          </PrimaryButton>
        </div>

        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          <Map size={14} />
          Cenas
        </div>
        <nav className="min-h-0 flex-1 space-y-1 overflow-auto pr-1">
          {menuRows.map((row) => {
            const active = row.id === activeId;
            const sectionActive = row.label === 'Nuvens' && cloudSceneIds.includes(activeId);
            const depth = row.depth ?? 0;
            const rowId = row.id;
            const content = (
              <>
                <span className={`w-8 text-xs font-semibold tabular-nums text-cyan-200/80 ${depth > 0 ? 'pl-3' : ''}`}>{row.number ?? (depth === 1 ? '->' : '--')}</span>
                <span className={`${rowId ? 'text-sm' : 'text-xs font-semibold uppercase tracking-[0.16em]'} ${depth === 2 ? 'text-[13px]' : ''}`}>{row.label}</span>
              </>
            );

            if (!rowId) {
              return (
                <div
                  key={`${row.label}-${row.number ?? depth}`}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-1.5 text-left ${sectionActive ? 'bg-cyan-300/10 text-cyan-100' : 'text-slate-400'}`}
                  style={{ paddingLeft: 12 + depth * 18 }}
                >
                  {content}
                </div>
              );
            }

            return (
              <button
                key={rowId}
                onClick={() => onSelect(rowId)}
                aria-current={active ? 'true' : undefined}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-1.5 text-left transition ${
                  active ? 'bg-cyan-300/16 text-cyan-100' : 'text-slate-300 hover:bg-white/8 hover:text-white'
                }`}
                style={{ paddingLeft: 12 + depth * 18 }}
              >
                {content}
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
