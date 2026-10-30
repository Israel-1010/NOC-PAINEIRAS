import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Maximize2, Minus, Network, Plus, RefreshCw, Router, Search, Shield, Wifi, X } from "lucide-react";

// Topologia: a arvore de ligacoes das controladoras UniFi, como a tela da propria controladora
// (raiz no topo, barramento, porta de cada ponta e velocidade). Atualiza a cada 10 s.

type TopoNode = {
  id: string;
  name: string;
  type: "switch" | "ap" | "gateway" | "other";
  model: string;
  state: "online" | "offline" | "updating" | "warning" | "pending";
  ip: string;
  controller: string;
  site: string;
  clients: number;
  portsUp: number;
  portsTotal: number;
  poeWatts: number;
  txBps: number | null;
  rxBps: number | null;
  lastSeen: string;
  version: string;
  ports: { idx: number; name: string; up: boolean; speed: number; poeWatts: number }[];
  external: boolean;
};
type TopoEdge = { from: string; to: string; parentPort: number | null; localPort: number | null; speedMbps: number | null; maxSeenMbps: number | null; fullDuplex: boolean | null; wireless: boolean; lastKnown: boolean };
type Source = { id: string; name: string; via: string; ok: boolean; message: string; at: string; hasTopology: boolean };
type Topology = { generatedAt: string; sources: Source[]; nodes: TopoNode[]; edges: TopoEdge[] };

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const REFRESH_MS = 10000;

async function api<T>(path: string): Promise<T> {
  let token = "";
  try {
    token = (JSON.parse(window.localStorage.getItem("rede-clube-session") || "{}") as { token?: string }).token || "";
  } catch {
    /* sem sessao: o servidor responde 401 */
  }
  const response = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 401) window.dispatchEvent(new Event("rede-clube-auth-expired"));
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((payload as { message?: string }).message || "Não foi possível falar com o servidor.");
  return payload as T;
}

const speedLabel = (mbps: number | null) => (!mbps ? "" : mbps >= 1000 ? `${mbps / 1000}G` : `${mbps}M`);
const bpsLabel = (value: number | null) => {
  if (value === null) return "—";
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)} Gbps`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)} Mbps`;
  return `${Math.round(value / 1e3)} kbps`;
};
const sinceLabel = (iso: string) => {
  if (!iso) return "";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return minutes < 60 ? `${minutes} min` : minutes < 2880 ? `${Math.round(minutes / 60)} h` : `${Math.round(minutes / 1440)} dias`;
};
const STATE_LABEL: Record<TopoNode["state"], string> = { online: "Online", offline: "Fora do ar", updating: "Atualizando", warning: "Sem resposta", pending: "Pendente" };
// Ligacao lenta: abaixo de 1G entre equipamentos, ou mais lenta do que ja foi (10G que virou 1G).
const isSlow = (edge: TopoEdge) => Boolean(edge.speedMbps && !edge.wireless && (edge.speedMbps < 1000 || (edge.maxSeenMbps && edge.speedMbps < edge.maxSeenMbps)));
const isProblem = (node: TopoNode, edge?: TopoEdge) => node.state !== "online" || Boolean(edge && (edge.lastKnown || isSlow(edge) || edge.fullDuplex === false));

/* ---------- Layout da arvore ---------- */
// Cada filho vira uma coluna; quando os filhos nao cabem na largura, quebram em linhas presas a um "trilho" a esquerda.
const COL = 138;
const NODE_H = 92;
const GAP = 64;
const RAIL = 22;

type Placed = { id: string; cx: number; y: number };
type Line = { x1: number; y1: number; x2: number; y2: number; kind: "ok" | "slow" | "down" };
type Chip = { cx: number; y: number; text: string; kind: "ok" | "slow" | "down" };
type Block = { width: number; height: number; place: (x0: number, y0: number, out: Out) => number };
type Out = { nodes: Placed[]; lines: Line[]; chips: Chip[]; dots: { x: number; y: number }[] };

function buildLayout(roots: string[], children: Map<string, TopoEdge[]>, nodes: Map<string, TopoNode>, avail: number) {
  const seen = new Set<string>();
  const edgeKind = (edge: TopoEdge): Line["kind"] => (edge.lastKnown || nodes.get(edge.to)?.state === "offline" ? "down" : isSlow(edge) ? "slow" : "ok");

  function measure(id: string): Block {
    seen.add(id);
    const kids = (children.get(id) || []).filter((edge) => !seen.has(edge.to) && nodes.has(edge.to));
    const blocks = kids.map((edge) => ({ edge, block: measure(edge.to) }));
    if (!blocks.length) {
      return { width: COL, height: NODE_H, place: (x0, y0, out) => (out.nodes.push({ id, cx: x0 + COL / 2, y: y0 }), x0 + COL / 2) };
    }
    // Empacota os filhos em linhas que caibam na largura disponivel.
    const rows: (typeof blocks)[] = [[]];
    let rowWidth = 0;
    const limit = Math.max(COL * 2, avail - RAIL);
    for (const item of blocks) {
      if (rows[rows.length - 1].length && rowWidth + item.block.width > limit) {
        rows.push([]);
        rowWidth = 0;
      }
      rows[rows.length - 1].push(item);
      rowWidth += item.block.width;
    }
    const wrapped = rows.length > 1;
    const offset = wrapped ? RAIL : 0;
    const rowWidths = rows.map((row) => row.reduce((sum, item) => sum + item.block.width, 0));
    const rowHeights = rows.map((row) => Math.max(...row.map((item) => item.block.height)));
    const width = Math.max(COL, offset + Math.max(...rowWidths));
    const height = NODE_H + rowHeights.reduce((sum, h) => sum + GAP + h, 0);

    return {
      width,
      height,
      place: (x0, y0, out) => {
        let rowY = y0 + NODE_H + GAP;
        const busYs: number[] = [];
        let firstCenters: number[] = [];
        rows.forEach((row, rowIndex) => {
          // Uma linha so: centraliza os filhos no bloco; com quebra, alinha a esquerda junto ao trilho.
          let x = x0 + offset + (wrapped ? 0 : (width - rowWidths[rowIndex]) / 2);
          const centers: number[] = [];
          for (const { edge, block } of row) {
            const cx = block.place(x, rowY, out);
            centers.push(cx);
            const kind = edgeKind(edge);
            out.lines.push({ x1: cx, y1: rowY - GAP / 2, x2: cx, y2: rowY, kind });
            const speed = speedLabel(edge.speedMbps);
            const was = edge.maxSeenMbps && edge.speedMbps && edge.speedMbps < edge.maxSeenMbps ? ` (era ${speedLabel(edge.maxSeenMbps)})` : "";
            out.chips.push({
              cx,
              y: rowY - GAP / 2 + 6,
              // Porta no aparelho de cima ⇄ porta no de baixo ("–" quando a UniFi nao informa).
              text: edge.wireless ? "sem fio" : `${edge.parentPort ?? "–"} ⇄ ${edge.localPort ?? "–"}${speed ? ` · ${speed}${was}` : ""}`,
              kind,
            });
            x += block.width;
          }
          const busY = rowY - GAP / 2;
          busYs.push(busY);
          const left = wrapped ? x0 + RAIL / 2 : Math.min(...centers);
          out.lines.push({ x1: left, y1: busY, x2: Math.max(...centers), y2: busY, kind: "ok" });
          if (rowIndex === 0) firstCenters = centers;
          rowY += rowHeights[rowIndex] + GAP;
        });
        // O pai fica centralizado sobre a primeira linha de filhos.
        const cx = wrapped ? x0 + offset + rowWidths[0] / 2 : (Math.min(...firstCenters) + Math.max(...firstCenters)) / 2;
        out.nodes.push({ id, cx, y: y0 });
        out.lines.push({ x1: cx, y1: y0 + NODE_H - 6, x2: cx, y2: busYs[0], kind: "ok" });
        out.dots.push({ x: cx, y: busYs[0] });
        if (wrapped) {
          // Trilho: liga o barramento da 1a linha aos das linhas seguintes.
          out.lines.push({ x1: x0 + RAIL / 2, y1: busYs[0], x2: x0 + RAIL / 2, y2: busYs[busYs.length - 1], kind: "ok" });
          out.lines.push({ x1: x0 + RAIL / 2, y1: busYs[0], x2: cx, y2: busYs[0], kind: "ok" });
        }
        return cx;
      },
    };
  }

  const out: Out = { nodes: [], lines: [], chips: [], dots: [] };
  let x = 0;
  let height = 0;
  for (const root of roots) {
    const block = measure(root);
    block.place(x, 0, out);
    x += block.width + 24;
    height = Math.max(height, block.height);
  }
  return { ...out, width: Math.max(x - 24, COL), height: height + 8 };
}

const ICON: Record<TopoNode["type"], typeof Network> = { switch: Network, ap: Wifi, gateway: Shield, other: Router };

type Graph = { nodes: Map<string, TopoNode>; children: Map<string, TopoEdge[]>; parentEdge: Map<string, TopoEdge>; roots: string[]; loose: TopoNode[] };

function buildGraph(data: Topology | null): Graph {
  const nodes = new Map((data?.nodes || []).map((node) => [node.id, node]));
  const children = new Map<string, TopoEdge[]>();
  const parentEdge = new Map<string, TopoEdge>();
  for (const edge of data?.edges || []) {
    if (!nodes.has(edge.to) || !nodes.has(edge.from) || parentEdge.has(edge.to)) continue;
    parentEdge.set(edge.to, edge);
    children.set(edge.from, [...(children.get(edge.from) || []), edge]);
  }
  // Filhos na ordem das portas do pai (ordem fisica), depois pelo nome.
  for (const list of children.values()) list.sort((a, b) => (a.parentPort ?? 999) - (b.parentPort ?? 999) || (nodes.get(a.to)?.name || "").localeCompare(nodes.get(b.to)?.name || "", "pt-BR", { numeric: true }));
  const roots = Array.from(nodes.keys()).filter((id) => !parentEdge.has(id) && children.has(id));
  const loose = Array.from(nodes.values()).filter((node) => !parentEdge.has(node.id) && !children.has(node.id));
  return { nodes, children, parentEdge, roots, loose };
}

type Layout = ReturnType<typeof buildLayout>;

// O desenho (linhas, caixinhas de porta e aparelhos), igual na tela do portal e na TV.
function TreeStage({ layout, graph, selected, dim, match, onSelect }: { layout: Layout; graph: Graph; selected?: string | null; dim?: (id: string) => boolean; match?: (id: string) => boolean; onSelect?: (id: string) => void }) {
  return (
    <>
      <svg className="ut-lines" width={layout.width} height={layout.height} aria-hidden="true">
        {layout.lines.map((line, index) => (
          <line key={index} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} className={`ut-line ${line.kind}`} />
        ))}
        {layout.dots.map((dot, index) => <circle key={index} cx={dot.x} cy={dot.y} r={5} className="ut-dot" />)}
      </svg>
      {layout.chips.map((chip, index) => (
        <span key={index} className={`ut-chip ${chip.kind}`} style={{ left: chip.cx, top: chip.y }}>{chip.text}</span>
      ))}
      {layout.nodes.map((placed) => {
        const item = graph.nodes.get(placed.id)!;
        const Icon = ICON[item.type];
        const offline = item.state === "offline";
        const className = `ut-node ${item.type} state-${item.state}${item.external ? " external" : ""}${dim?.(item.id) ? " dim" : ""}${match?.(item.id) ? " match" : ""}${selected === item.id ? " selected" : ""}`;
        const label = `${item.name}, ${STATE_LABEL[item.state]}${offline && item.lastSeen ? ` há ${sinceLabel(item.lastSeen)}` : ""}`;
        const content = (
          <>
            <span className="ut-icon">{offline ? <X size={20} /> : <Icon size={20} />}</span>
            <strong>{item.name}</strong>
            <small>
              {offline ? `fora há ${sinceLabel(item.lastSeen) || "?"}` : item.state !== "online" ? STATE_LABEL[item.state] : item.external ? item.id : item.type === "ap" ? `${item.clients} clientes` : `${item.portsUp}/${item.portsTotal} portas`}
            </small>
          </>
        );
        return onSelect ? (
          <button key={placed.id} type="button" className={className} style={{ left: placed.cx, top: placed.y }} onClick={() => onSelect(item.id)} aria-label={label}>{content}</button>
        ) : (
          <div key={placed.id} className={className} style={{ left: placed.cx, top: placed.y }} title={label}>{content}</div>
        );
      })}
    </>
  );
}

// Painel NOC (TV): a arvore inteira encaixada na tela, sem rolagem. Escolhe a largura das linhas
// que deixa o desenho no formato da tela (maior escala possivel).
export function TopologyFit({ headers }: { headers: Record<string, string> }) {
  const [data, setData] = useState<Topology | null>(null);
  const [error, setError] = useState("");
  const [size, setSize] = useState({ width: 1600, height: 800 });
  const boxRef = useRef<HTMLDivElement>(null);
  const headerKey = JSON.stringify(headers);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/noc/unifi-topology`, { headers: JSON.parse(headerKey) as Record<string, string> });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error((payload as { message?: string }).message || `erro ${response.status}`);
        if (!cancelled) {
          setData(payload as Topology);
          setError("");
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : String(loadError));
      }
    };
    void load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [headerKey]);

  useLayoutEffect(() => {
    const element = boxRef.current;
    if (!element) return;
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, []);

  const graph = useMemo(() => buildGraph(data), [data]);
  const fit = useMemo(() => {
    let best: { layout: Layout; scale: number } | null = null;
    for (const factor of [1, 1.25, 1.5, 1.8, 2.2, 2.7, 3.3, 4]) {
      const layout = buildLayout(graph.roots, graph.children, graph.nodes, size.width * factor);
      const scale = Math.min(size.width / layout.width, size.height / layout.height, 1.8);
      if (!best || scale > best.scale) best = { layout, scale };
    }
    return best!;
  }, [graph, size]);

  const problems = Array.from(graph.nodes.values()).filter((node) => isProblem(node, graph.parentEdge.get(node.id)));
  const devices = Array.from(graph.nodes.values()).filter((node) => !node.external);

  return (
    <div className="noc-page ut-tv">
      <p className="ut-tv-head">
        <span>{devices.filter((node) => node.type === "switch").length} switches · {devices.filter((node) => node.type === "ap").length} APs</span>
        {problems.length ? <b className="tone-critical">{problems.length} com problema: {problems.slice(0, 4).map((node) => node.name).join(", ")}{problems.length > 4 ? "…" : ""}</b> : <b className="tone-good">tudo online</b>}
        {error ? <span className="tone-warning">sem atualização: {error}</span> : null}
        <span className="ut-tv-legend">porta de cima ⇄ porta de baixo · velocidade</span>
      </p>
      <div className="ut-tv-box" ref={boxRef}>
        {!data ? (
          <p className="noc-empty">{error ? `Topologia indisponível: ${error}` : "Lendo as controladoras UniFi..."}</p>
        ) : !graph.roots.length ? (
          <p className="noc-empty">Nenhuma controladora com leitura direta (cadastre a controladora dos switches no Painel NOC → Wi-Fi).</p>
        ) : (
          <div
            className="ut-stage"
            style={{
              width: fit.layout.width,
              height: fit.layout.height,
              transform: `translate(${Math.max(0, (size.width - fit.layout.width * fit.scale) / 2)}px, 0) scale(${fit.scale})`,
            }}
          >
            <TreeStage layout={fit.layout} graph={graph} />
          </div>
        )}
      </div>
    </div>
  );
}

export function UnifiTopology() {
  const [data, setData] = useState<Topology | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const [zoom, setZoom] = useState(1);
  const [term, setTerm] = useState("");
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [viewport, setViewport] = useState(1200);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<Topology>("/api/topology/unifi"));
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, REFRESH_MS);
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(clock);
    };
  }, [load]);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setViewport(element.clientWidth));
    observer.observe(element);
    setViewport(element.clientWidth);
    return () => observer.disconnect();
  }, [data !== null]);

  const graph = useMemo(() => buildGraph(data), [data]);

  const layout = useMemo(() => buildLayout(graph.roots, graph.children, graph.nodes, Math.max(COL * 3, viewport / zoom - 24)), [graph, viewport, zoom]);

  const needle = term.trim().toLowerCase();
  const matches = useMemo(() => new Set(needle ? Array.from(graph.nodes.values()).filter((node) => `${node.name} ${node.ip} ${node.id} ${node.model}`.toLowerCase().includes(needle)).map((node) => node.id) : []), [graph, needle]);
  // "So com problema": o problema e os ancestrais dele (para ver onde esta pendurado).
  const problemSet = useMemo(() => {
    const set = new Set<string>();
    for (const node of graph.nodes.values()) {
      if (!isProblem(node, graph.parentEdge.get(node.id))) continue;
      let current: string | undefined = node.id;
      while (current && !set.has(current)) {
        set.add(current);
        current = graph.parentEdge.get(current)?.from;
      }
    }
    return set;
  }, [graph]);
  const problems = Array.from(graph.nodes.values()).filter((node) => isProblem(node, graph.parentEdge.get(node.id)));

  function focusNode(id: string) {
    const placed = layout.nodes.find((node) => node.id === id);
    const element = scrollRef.current;
    if (!placed || !element) return;
    element.scrollTo({ left: placed.cx * zoom - element.clientWidth / 2, top: placed.y * zoom - 80, behavior: "smooth" });
    setSelected(id);
  }

  if (!data) {
    return error ? (
      <div className="pm-error" role="alert"><AlertTriangle size={16} /><span>Não foi possível carregar a topologia: {error}</span><button type="button" className="ct-secondary" onClick={load}>Tentar novamente</button></div>
    ) : (
      <div className="view-loading">Lendo as controladoras UniFi...</div>
    );
  }

  const age = Math.max(0, Math.round((now - new Date(data.generatedAt).getTime()) / 1000));
  const withTree = data.sources.filter((source) => source.hasTopology);
  const devices = data.nodes.filter((node) => !node.external);
  const node = selected ? graph.nodes.get(selected) || null : null;

  return (
    <div className="ut-page">
      <section className="ut-bar">
        <div className="ut-stats">
          <span className={`ut-live${age > 45 || error ? " stale" : ""}`} role="status">
            <i aria-hidden="true" /> {error ? `Sem resposta do servidor · dados de ${age} s atrás` : `Atualizado há ${age} s`}
          </span>
          <span>{devices.filter((item) => item.type === "switch").length} switches · {devices.filter((item) => item.type === "ap").length} APs</span>
          {problems.length ? <span className="ut-alert"><AlertTriangle size={14} /> {problems.length} com problema</span> : <span className="ut-ok">tudo online</span>}
          <span className="ct-muted">Em cada ligação: porta no aparelho de cima ⇄ porta no de baixo · velocidade</span>
          {data.sources.map((source) => (
            <span key={source.id} className={`ut-source${source.ok ? "" : " down"}`} title={source.message || (source.hasTopology ? "" : "Lida pelo Zabbix: sem ligações (só leitura direta traz a topologia).")}>
              {source.name}{source.hasTopology ? "" : " · sem topologia"}{source.ok ? "" : " · sem resposta"}
            </span>
          ))}
        </div>
        <div className="ut-tools">
          <label className="pm-search">
            <Search size={16} />
            <input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && matches.size) focusNode(Array.from(matches)[0]);
              }}
              placeholder="Buscar switch ou AP (nome, IP ou MAC) e Enter"
            />
          </label>
          <div className="ct-filters" role="group" aria-label="Mostrar">
            <button type="button" aria-pressed={!onlyProblems} className={!onlyProblems ? "active" : ""} onClick={() => setOnlyProblems(false)}>Todos</button>
            <button type="button" aria-pressed={onlyProblems} className={onlyProblems ? "active" : ""} onClick={() => setOnlyProblems(true)}>Com problema <small>{problems.length}</small></button>
          </div>
          <div className="ut-zoom" role="group" aria-label="Zoom">
            <button type="button" className="pm-icon-btn" aria-label="Diminuir" onClick={() => setZoom((value) => Math.max(0.5, Math.round((value - 0.1) * 10) / 10))}><Minus size={15} /></button>
            <button type="button" className="ut-zoom-value" title="Voltar a 100%" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
            <button type="button" className="pm-icon-btn" aria-label="Aumentar" onClick={() => setZoom((value) => Math.min(1.6, Math.round((value + 0.1) * 10) / 10))}><Plus size={15} /></button>
            <button type="button" className="pm-icon-btn" title="Encaixar a árvore na tela" aria-label="Encaixar" onClick={() => setZoom(0.7)}><Maximize2 size={15} /></button>
            <button type="button" className="pm-icon-btn" title="Atualizar agora" aria-label="Atualizar agora" onClick={load}><RefreshCw size={15} /></button>
          </div>
        </div>
      </section>

      {!withTree.length ? (
        <div className="pm-error" role="alert">
          <AlertTriangle size={16} />
          <span>Nenhuma controladora com leitura direta: a árvore precisa que o portal leia a controladora dos switches (Painel NOC → Wi-Fi → adicionar controladora, ex.: https://10.0.0.56:8443, usuário só leitura).</span>
        </div>
      ) : null}

      <div className="ut-canvas-wrap" ref={scrollRef}>
        <div className="ut-canvas" style={{ width: layout.width * zoom + 32, height: layout.height * zoom + 32 }}>
          <div className="ut-stage" style={{ width: layout.width, height: layout.height, transform: `scale(${zoom})` }}>
            <TreeStage
              layout={layout}
              graph={graph}
              selected={selected}
              dim={(id) => (onlyProblems && !problemSet.has(id)) || Boolean(needle && !matches.has(id))}
              match={(id) => matches.has(id)}
              onSelect={setSelected}
            />
          </div>
        </div>
      </div>

      {graph.loose.length ? (
        <p className="inv-note">Sem ligação conhecida ({graph.loose.length}): {graph.loose.map((item) => item.name).join(", ")}.</p>
      ) : null}

      {node ? <NodeDrawer node={node} graph={graph} onClose={() => setSelected(null)} onGo={(id) => focusNode(id)} /> : null}
    </div>
  );
}

function NodeDrawer({
  node,
  graph,
  onClose,
  onGo,
}: {
  node: TopoNode;
  graph: { nodes: Map<string, TopoNode>; children: Map<string, TopoEdge[]>; parentEdge: Map<string, TopoEdge> };
  onClose: () => void;
  onGo: (id: string) => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const up = graph.parentEdge.get(node.id);
  const parent = up ? graph.nodes.get(up.from) : null;
  // Caminho ate o topo (gateway).
  const path: TopoNode[] = [];
  let current = up?.from;
  while (current && path.length < 12) {
    const item = graph.nodes.get(current);
    if (!item) break;
    path.unshift(item);
    current = graph.parentEdge.get(current)?.from;
  }
  const byPort = new Map((graph.children.get(node.id) || []).map((edge) => [edge.parentPort, graph.nodes.get(edge.to)]));

  return (
    <aside className="side-drawer ut-drawer" role="dialog" aria-label={`Aparelho ${node.name}`}>
      <header className="side-drawer-head">
        <div>
          <p className="eyebrow">{node.type === "switch" ? "Switch" : node.type === "ap" ? "Ponto de acesso" : node.type === "gateway" ? "Gateway" : "Aparelho"}</p>
          <h2>{node.name}</h2>
          <p className="inv-drawer-sub">{[STATE_LABEL[node.state], node.model, node.ip, node.controller].filter(Boolean).join(" · ")}</p>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
      </header>
      {node.state === "offline" ? <div className="pm-error" role="alert"><AlertTriangle size={16} /><span>Fora do ar{node.lastSeen ? ` há ${sinceLabel(node.lastSeen)} (visto em ${new Date(node.lastSeen).toLocaleString("pt-BR")})` : ""}.</span></div> : null}
      <section className="inv-block">
        <h3>Ligação</h3>
        {up && parent ? (
          <p className="ut-uplink">
            <button type="button" className="ut-link" onClick={() => onGo(parent.id)}>{parent.name}</button> porta {up.parentPort ?? "?"} ⇄ porta {up.localPort ?? "?"} deste aparelho
            {up.speedMbps ? ` · ${speedLabel(up.speedMbps)}` : ""}{up.maxSeenMbps && up.speedMbps && up.speedMbps < up.maxSeenMbps ? ` (já esteve em ${speedLabel(up.maxSeenMbps)})` : ""}
            {up.fullDuplex === false ? " · half duplex" : ""}{up.lastKnown ? " · última ligação conhecida" : ""}
          </p>
        ) : (
          <p className="ct-muted">{node.external ? `Aparelho fora da UniFi (MAC ${node.id}); normalmente o firewall.` : "Topo da árvore."}</p>
        )}
        {path.length ? <p className="ut-path">Caminho: {path.map((item) => item.name).join(" › ")} › <b>{node.name}</b></p> : null}
      </section>
      {!node.external ? (
        <section className="inv-block">
          <h3>Agora</h3>
          <dl className="ut-facts">
            <div><dt>{node.type === "ap" ? "Clientes" : "Clientes ligados"}</dt><dd>{node.clients}</dd></div>
            {node.portsTotal ? <div><dt>Portas ativas</dt><dd>{node.portsUp} de {node.portsTotal}</dd></div> : null}
            {node.poeWatts ? <div><dt>PoE</dt><dd>{node.poeWatts} W</dd></div> : null}
            <div><dt>Tráfego</dt><dd>↓ {bpsLabel(node.txBps)} · ↑ {bpsLabel(node.rxBps)}</dd></div>
            {node.version ? <div><dt>Firmware</dt><dd>{node.version}</dd></div> : null}
          </dl>
        </section>
      ) : null}
      {node.ports.length ? (
        <section className="inv-block">
          <h3>Portas</h3>
          <table className="ut-ports">
            <thead><tr><th>Porta</th><th>Estado</th><th>PoE</th><th>Ligado a</th></tr></thead>
            <tbody>
              {node.ports.map((port) => {
                const child = byPort.get(port.idx);
                return (
                  <tr key={port.idx} className={port.up ? "" : "off"}>
                    <td>{port.idx}{port.name && port.name !== `Port ${port.idx}` ? <small> {port.name}</small> : null}</td>
                    <td>{port.up ? speedLabel(port.speed) || "ativa" : "desligada"}</td>
                    <td>{port.poeWatts ? `${port.poeWatts} W` : ""}</td>
                    <td>{child ? <button type="button" className="ut-link" onClick={() => onGo(child.id)}>{child.name}</button> : port.idx === up?.localPort && parent ? <span className="ct-muted">↑ {parent.name}</span> : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ) : null}
    </aside>
  );
}
