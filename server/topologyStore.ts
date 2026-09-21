import fs from "node:fs/promises";
import path from "node:path";

type TopologyNodeType = "core" | "switch" | "firewall" | "fiber" | "server" | "internet";

type TopologyNode = {
  id: string;
  name: string;
  type: TopologyNodeType;
  ip: string;
  vendor: string;
  network: string;
  x: number;
  y: number;
};

type TopologyLink = {
  id: string;
  from: string;
  to: string;
  label: string;
  medium: "fibra" | "utp" | "wan" | "trunk";
};

type TopologyNetwork = {
  id: string;
  name: string;
  cidr: string;
  vlan: string;
  gateway: string;
  notes: string;
};

export type TopologyState = {
  networks: TopologyNetwork[];
  nodes: TopologyNode[];
  links: TopologyLink[];
};

const dataDir = path.resolve("data");
const storePath = path.join(dataDir, "topology.json");

const fallbackTopology: TopologyState = {
  networks: [
    { id: "net-mgmt", name: "Gerencia UniFi", cidr: "192.168.9.0/24", vlan: "9", gateway: "192.168.9.1", notes: "Rede inicial para catracas/trielo e switches UniFi." },
    { id: "net-core", name: "Core / Servidores", cidr: "10.200.1.0/24", vlan: "1", gateway: "10.200.1.1", notes: "Backbone principal." },
  ],
  nodes: [
    { id: "node-internet", name: "Internet", type: "internet", ip: "", vendor: "ISP", network: "WAN", x: 50, y: 12 },
    { id: "node-fortinet", name: "Fortinet", type: "firewall", ip: "10.200.1.1", vendor: "Fortinet", network: "Core / Servidores", x: 50, y: 30 },
    { id: "node-core", name: "Core", type: "core", ip: "10.200.1.2", vendor: "Core", network: "Core / Servidores", x: 50, y: 50 },
    { id: "node-unifi", name: "UniFi Switch", type: "switch", ip: "192.168.9.2", vendor: "UniFi", network: "Gerencia UniFi", x: 28, y: 70 },
    { id: "node-fiber", name: "Fibra CFTV", type: "fiber", ip: "", vendor: "Fibra", network: "Backbone", x: 72, y: 70 },
  ],
  links: [
    { id: "link-internet-fw", from: "node-internet", to: "node-fortinet", label: "WAN", medium: "wan" },
    { id: "link-fw-core", from: "node-fortinet", to: "node-core", label: "LAN", medium: "trunk" },
    { id: "link-core-unifi", from: "node-core", to: "node-unifi", label: "Trunk UniFi", medium: "utp" },
    { id: "link-core-fiber", from: "node-core", to: "node-fiber", label: "Fibra", medium: "fibra" },
  ],
};

function clean(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function clampPercent(value: unknown, fallback: number) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.max(4, Math.min(96, Math.round(numberValue * 10) / 10));
}

function normalizeNodeType(value: unknown): TopologyNodeType {
  return value === "core" || value === "switch" || value === "firewall" || value === "fiber" || value === "server" || value === "internet"
    ? value
    : "switch";
}

function normalizeLinkMedium(value: unknown): TopologyLink["medium"] {
  return value === "fibra" || value === "utp" || value === "wan" || value === "trunk" ? value : "utp";
}

function normalizeTopology(input: unknown): TopologyState {
  const source = input && typeof input === "object" ? input as Partial<TopologyState> : {};
  const rawNetworks = Array.isArray(source.networks) ? source.networks : fallbackTopology.networks;
  const rawNodes = Array.isArray(source.nodes) ? source.nodes : fallbackTopology.nodes;
  const rawLinks = Array.isArray(source.links) ? source.links : fallbackTopology.links;

  const networks = rawNetworks.map((network, index) => ({
    id: clean((network as Partial<TopologyNetwork>).id) || `net-${index}`,
    name: clean((network as Partial<TopologyNetwork>).name) || `Rede ${index + 1}`,
    cidr: clean((network as Partial<TopologyNetwork>).cidr),
    vlan: clean((network as Partial<TopologyNetwork>).vlan),
    gateway: clean((network as Partial<TopologyNetwork>).gateway),
    notes: clean((network as Partial<TopologyNetwork>).notes),
  }));

  const nodes = rawNodes.map((node, index) => ({
    id: clean((node as Partial<TopologyNode>).id) || `node-${index}`,
    name: clean((node as Partial<TopologyNode>).name) || `Equipamento ${index + 1}`,
    type: normalizeNodeType((node as Partial<TopologyNode>).type),
    ip: clean((node as Partial<TopologyNode>).ip),
    vendor: clean((node as Partial<TopologyNode>).vendor),
    network: clean((node as Partial<TopologyNode>).network),
    x: clampPercent((node as Partial<TopologyNode>).x, 50),
    y: clampPercent((node as Partial<TopologyNode>).y, 50),
  }));

  const nodeIds = new Set(nodes.map((node) => node.id));
  const links = rawLinks
    .map((link, index) => ({
      id: clean((link as Partial<TopologyLink>).id) || `link-${index}`,
      from: clean((link as Partial<TopologyLink>).from),
      to: clean((link as Partial<TopologyLink>).to),
      label: clean((link as Partial<TopologyLink>).label),
      medium: normalizeLinkMedium((link as Partial<TopologyLink>).medium),
    }))
    .filter((link) => nodeIds.has(link.from) && nodeIds.has(link.to));

  return { networks, nodes, links };
}

export async function getTopology() {
  try {
    const raw = await fs.readFile(storePath, "utf8");
    return normalizeTopology(JSON.parse(raw));
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : "";
    if (code !== "ENOENT") {
      throw error;
    }

    await saveTopology(fallbackTopology);
    return fallbackTopology;
  }
}

export async function saveTopology(topology: unknown) {
  const normalized = normalizeTopology(topology);
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(`${storePath}.tmp`, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  await fs.rename(`${storePath}.tmp`, storePath);
  return normalized;
}
