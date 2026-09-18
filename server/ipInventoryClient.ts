import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import XLSX from "xlsx";

export type IpInventoryItem = {
  id: string;
  ip: string;
  name: string;
  location: string;
  category: string;
  vlan: string;
  network: string;
  status: "Usado" | "Livre" | "Reservado";
  sourceSheet: string;
  notes: string;
  updatedAt: string;
};

export type IpInventoryLink = {
  id: string;
  provider: string;
  type: "Circuito" | "Uso";
  name: string;
  url: string;
  category: string;
  speed: string;
  fortinetIp: string;
  port: string;
  gateway: string;
  mask: string;
  ipCount: string;
  range: string;
  usedIp: string;
  location: string;
  service: string;
  ports: string;
  status: "Ativo" | "Atencao" | "Inativo";
  notes: string;
  updatedAt: string;
};

type IpInventoryStore = {
  items: IpInventoryItem[];
  links: IpInventoryLink[];
};

const workbookPath = path.resolve("IP.xlsx");
const dataDir = path.resolve("data");
const storePath = path.join(dataDir, "ipInventory.json");
const ipPattern = /\b(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?\b/g;

function clean(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function isIp(value: string) {
  return /^(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?$/.test(value);
}

function rowText(row: unknown[]) {
  return row.map(clean).filter(Boolean).join(" ");
}

function inferStatus(row: unknown[], label: string): IpInventoryItem["status"] {
  const text = rowText(row).toLowerCase();
  if (text.includes("livre") || text.includes("free")) return "Livre";
  if (text.includes("reserv")) return "Reservado";
  return label ? "Usado" : "Livre";
}

function inferLabel(row: unknown[], ip: string) {
  const values = row
    .map(clean)
    .filter(Boolean)
    .map((value) => value.replace(ip, "").trim())
    .filter((value) => value && !isIp(value))
    .filter((value) => !["ip", "local", "novo ip", "ip antigo", "usado", "livre"].includes(value.toLowerCase()));

  return values.slice(0, 4).join(" - ");
}

function makeId(sourceSheet: string, rowIndex: number, ip: string, occurrence: number) {
  return crypto
    .createHash("sha1")
    .update(`${sourceSheet}:${rowIndex}:${ip}:${occurrence}`)
    .digest("hex")
    .slice(0, 16);
}

function makeNetworkId(category: string, network: string, ip: string) {
  return crypto
    .createHash("sha1")
    .update(`${category}:${network}:${ip}`)
    .digest("hex")
    .slice(0, 16);
}

function ipLastOctet(ip: string) {
  const match = /^192\.168\.9\.(\d{1,3})$/.exec(ip);
  if (!match) return null;
  const octet = Number(match[1]);
  return octet >= 0 && octet <= 255 ? octet : null;
}

function mergeNetworkItem(base: IpInventoryItem, incoming: IpInventoryItem, category: string, now: string) {
  const next = { ...base };

  for (const field of ["name", "location", "notes", "vlan", "network"] as const) {
    const currentValue = clean(next[field]);
    const incomingValue = clean(incoming[field]);

    if (!currentValue && incomingValue) {
      next[field] = incomingValue;
    } else if (currentValue && incomingValue && currentValue !== incomingValue && !currentValue.includes(incomingValue)) {
      next[field] = `${currentValue} | ${incomingValue}`;
    }
  }

  if (next.status !== "Usado" && incoming.status === "Usado") {
    next.status = "Usado";
  }

  next.category = category;
  next.vlan = "9";
  next.network = "192.168.9.0/24";
  next.sourceSheet = category;
  next.updatedAt = now;
  return next;
}

function normalizeCatracasTrieloNetwork(items: IpInventoryItem[]) {
  const category = "CATRACAS - TRIELO";
  const now = new Date().toISOString();
  const kept: IpInventoryItem[] = [];
  const byIp = new Map<string, IpInventoryItem>();

  for (const item of items) {
    const isTrieloCategory = item.category === category || item.category === "TRIELO";
    const inNetwork = ipLastOctet(item.ip) !== null;

    if (isTrieloCategory && inNetwork) {
      const current = { ...item, category, vlan: "9", network: "192.168.9.0/24", sourceSheet: category, updatedAt: now };
      const existing = byIp.get(current.ip);
      byIp.set(current.ip, existing ? mergeNetworkItem(existing, current, category, now) : current);
      continue;
    }

    if (item.category === "TRIELO") {
      continue;
    }

    kept.push(item);
  }

  for (let lastOctet = 0; lastOctet <= 255; lastOctet += 1) {
    const ip = `192.168.9.${lastOctet}`;
    const existing = byIp.get(ip);

    if (existing) {
      byIp.set(ip, {
        ...existing,
        id: existing.id || makeNetworkId(category, "192.168.9.0/24", ip),
        category,
        vlan: "9",
        network: "192.168.9.0/24",
        sourceSheet: category,
        updatedAt: now,
      });
      continue;
    }

    const reserved = lastOctet === 0 || lastOctet === 255;

    byIp.set(ip, {
      id: makeNetworkId(category, "192.168.9.0/24", ip),
      ip,
      name: reserved ? (lastOctet === 0 ? "Rede 192.168.9.0/24" : "Broadcast 192.168.9.255") : "",
      location: reserved ? category : "",
      category,
      vlan: "9",
      network: "192.168.9.0/24",
      status: reserved ? "Reservado" : "Livre",
      sourceSheet: category,
      notes: reserved ? "Endereco reservado da sub-rede 192.168.9.0/24" : "Livre na sub-rede 192.168.9.0/24",
      updatedAt: now,
    });
  }

  const networkItems = Array.from(byIp.values()).sort((a, b) => Number(a.ip.split(".").pop()) - Number(b.ip.split(".").pop()));
  return [...kept, ...networkItems];
}

function importWorkbook() {
  const workbook = XLSX.readFile(workbookPath, { cellDates: false });
  const items: IpInventoryItem[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      raw: false,
      blankrows: false,
      defval: "",
    });

    rows.forEach((row, rowIndex) => {
      const text = rowText(row);
      const matches = [...text.matchAll(ipPattern)].map((match) => match[0]);

      matches.forEach((ip, occurrence) => {
        const name = inferLabel(row, ip);
        items.push({
          id: makeId(sheetName, rowIndex, ip, occurrence),
          ip,
          name,
          location: name,
          category: sheetName,
          vlan: "",
          network: "",
          status: inferStatus(row, name),
          sourceSheet: sheetName,
          notes: text.replace(ip, "").trim(),
          updatedAt: new Date().toISOString(),
        });
      });
    });
  }

  const seen = new Set<string>();
  const deduped = items.filter((item) => {
    const key = `${item.category}:${item.ip}:${item.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return normalizeCatracasTrieloNetwork(deduped);
}

function preserveNetworkVlans(items: IpInventoryItem[], previousItems: IpInventoryItem[]) {
  const vlanCountsByNetwork = new Map<string, Map<string, number>>();

  for (const item of previousItems) {
    if (item.network && item.vlan) {
      const key = `${item.category}:${item.network}`;
      const counts = vlanCountsByNetwork.get(key) || new Map<string, number>();
      counts.set(item.vlan, (counts.get(item.vlan) || 0) + 1);
      vlanCountsByNetwork.set(key, counts);
    }
  }

  const vlanByNetwork = new Map<string, string>();
  for (const [key, counts] of vlanCountsByNetwork.entries()) {
    const winner = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
    if (winner) vlanByNetwork.set(key, winner[0]);
  }

  return items.map((item) => {
    const vlan = item.network ? vlanByNetwork.get(`${item.category}:${item.network}`) : "";
    return vlan ? { ...item, vlan } : item;
  });
}

async function readStore(): Promise<IpInventoryStore> {
  try {
    const raw = await fs.readFile(storePath, "utf8");
    const store = JSON.parse(raw) as { items: Partial<IpInventoryItem>[]; links?: Partial<IpInventoryLink>[] };
    return {
      items: store.items.map((item) => ({
        id: clean(item.id),
        ip: clean(item.ip),
        name: clean(item.name),
        location: clean(item.location),
        category: clean(item.category) || "Geral",
        vlan: clean(item.vlan),
        network: clean(item.network),
        status: ["Usado", "Livre", "Reservado"].includes(String(item.status)) ? item.status as IpInventoryItem["status"] : "Usado",
        sourceSheet: clean(item.sourceSheet) || "Manual",
        notes: clean(item.notes),
        updatedAt: clean(item.updatedAt) || new Date().toISOString(),
      })),
      links: (store.links || []).map((link) => ({
        id: clean(link.id) || crypto.randomUUID(),
        provider: clean(link.provider),
        type: ["Circuito", "Uso"].includes(String(link.type)) ? link.type as IpInventoryLink["type"] : "Circuito",
        name: clean(link.name),
        url: clean(link.url),
        category: clean(link.category) || "Geral",
        speed: clean(link.speed),
        fortinetIp: clean(link.fortinetIp),
        port: clean(link.port),
        gateway: clean(link.gateway),
        mask: clean(link.mask),
        ipCount: clean(link.ipCount),
        range: clean(link.range),
        usedIp: clean(link.usedIp),
        location: clean(link.location),
        service: clean(link.service),
        ports: clean(link.ports),
        status: ["Ativo", "Atencao", "Inativo"].includes(String(link.status)) ? link.status as IpInventoryLink["status"] : "Ativo",
        notes: clean(link.notes),
        updatedAt: clean(link.updatedAt) || new Date().toISOString(),
      })),
    };
  } catch {
    const items = importWorkbook();
    await writeStore(items, []);
    return { items, links: [] };
  }
}

async function writeStore(items: IpInventoryItem[], links: IpInventoryLink[] = []) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(storePath, JSON.stringify({ items, links }, null, 2), "utf8");
}

function normalizePayload(payload: Record<string, unknown>, current?: IpInventoryItem): IpInventoryItem {
  const now = new Date().toISOString();
  const status = String(payload.status || current?.status || "Usado") as IpInventoryItem["status"];

  return {
    id: current?.id || crypto.randomUUID(),
    ip: clean(payload.ip ?? current?.ip),
    name: clean(payload.name ?? current?.name),
    location: clean(payload.location ?? current?.location),
    category: clean(payload.category ?? current?.category) || "Geral",
    vlan: clean(payload.vlan ?? current?.vlan),
    network: clean(payload.network ?? current?.network),
    status: ["Usado", "Livre", "Reservado"].includes(status) ? status : "Usado",
    sourceSheet: current?.sourceSheet || clean(payload.sourceSheet) || "Manual",
    notes: clean(payload.notes ?? current?.notes),
    updatedAt: now,
  };
}

function parseIpv4(ip: string) {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return null;
  }

  return ((parts[0] * 256 + parts[1]) * 256 + parts[2]) * 256 + parts[3];
}

function formatIpv4(value: number) {
  return [
    Math.floor(value / 16777216) % 256,
    Math.floor(value / 65536) % 256,
    Math.floor(value / 256) % 256,
    value % 256,
  ].join(".");
}

function parseCidr(cidr: string) {
  const [ip, prefixRaw] = cidr.split("/");
  const prefix = Number(prefixRaw);
  const ipNumber = parseIpv4(clean(ip));

  if (ipNumber === null || !Number.isInteger(prefix) || prefix < 20 || prefix > 32) {
    throw new Error("Informe uma rede CIDR valida entre /20 e /32. Exemplo: 192.168.9.0/24.");
  }

  const size = 2 ** (32 - prefix);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const networkNumber = (ipNumber & mask) >>> 0;

  return {
    cidr: `${formatIpv4(networkNumber)}/${prefix}`,
    first: networkNumber,
    last: networkNumber + size - 1,
    size,
    prefix,
  };
}

export async function getIpSummary() {
  const { items } = await readStore();
  const categories = new Set(items.map((item) => item.category).filter(Boolean));

  return {
    total: items.length,
    used: items.filter((item) => item.status === "Usado").length,
    free: items.filter((item) => item.status === "Livre").length,
    reserved: items.filter((item) => item.status === "Reservado").length,
    categories: categories.size,
  };
}

export async function listIps(query = "", status = "", category = "") {
  const { items, links } = await readStore();
  const search = query.trim().toLowerCase();
  const filtered = items.filter((item) => {
    const matchesSearch = !search || [item.ip, item.name, item.location, item.category, item.vlan, item.network, item.status, item.notes].join(" ").toLowerCase().includes(search);
    const matchesStatus = !status || item.status === status;
    const matchesCategory = !category || item.category === category;
    return matchesSearch && matchesStatus && matchesCategory;
  });
  const categories = Array.from(new Set(items.map((item) => item.category).filter(Boolean))).sort();

  return { items: filtered, categories, links };
}

export async function createIp(payload: Record<string, unknown>) {
  const store = await readStore();
  const next = normalizePayload(payload);
  if (!next.ip) throw new Error("Informe o IP.");
  store.items.unshift(next);
  await writeStore(store.items, store.links);
  return { message: "IP cadastrado.", item: next };
}

export async function updateIp(id: string, payload: Record<string, unknown>) {
  const store = await readStore();
  const index = store.items.findIndex((item) => item.id === id);
  if (index < 0) throw new Error("IP nao encontrado.");
  const next = normalizePayload(payload, store.items[index]);
  if (!next.ip) throw new Error("Informe o IP.");
  store.items[index] = next;
  await writeStore(store.items, store.links);
  return { message: "IP atualizado.", item: next };
}

export async function deleteIp(id: string) {
  const store = await readStore();
  const next = store.items.filter((item) => item.id !== id);
  if (next.length === store.items.length) throw new Error("IP nao encontrado.");
  await writeStore(next, store.links);
  return { message: "IP removido." };
}

export async function renameIpCategory(payload: Record<string, unknown>) {
  const from = clean(payload.from);
  const to = clean(payload.to);

  if (!from) throw new Error("Informe a categoria atual.");
  if (!to) throw new Error("Informe o novo nome da categoria.");

  const store = await readStore();
  const now = new Date().toISOString();
  let updated = 0;

  const items = store.items.map((item) => {
    if (item.category !== from) return item;
    updated += 1;
    return { ...item, category: to, updatedAt: now };
  });

  if (!updated) throw new Error("Categoria nao encontrada.");

  await writeStore(items, store.links);
  return { message: "Categoria renomeada.", category: to, updated };
}

export async function updateIpNetworkVlan(payload: Record<string, unknown>) {
  const network = clean(payload.network);
  const category = clean(payload.category);
  const vlan = clean(payload.vlan);

  if (!network) throw new Error("Informe a rede.");
  if (!vlan) throw new Error("Informe a VLAN.");

  const store = await readStore();
  const now = new Date().toISOString();
  let updated = 0;

  const items = store.items.map((item) => {
    if (item.network !== network) return item;
    if (category && item.category !== category) return item;
    updated += 1;
    return { ...item, vlan, updatedAt: now };
  });

  if (!updated) throw new Error("Rede nao encontrada.");

  await writeStore(items, store.links);
  return { message: "VLAN aplicada.", network, category, vlan, updated };
}

export async function createIpNetwork(payload: Record<string, unknown>) {
  const cidr = clean(payload.cidr);
  const category = clean(payload.category) || cidr;
  const vlan = clean(payload.vlan);
  const sourceSheet = clean(payload.sourceSheet) || category;
  const network = parseCidr(cidr);
  const store = await readStore();
  const now = new Date().toISOString();
  const existingByKey = new Map(store.items.map((item) => [`${item.category}:${item.ip}`, item]));
  const nextItems = store.items.filter((item) => {
    const ipNumber = parseIpv4(item.ip);
    const inGeneratedRange = ipNumber !== null && ipNumber >= network.first && ipNumber <= network.last;
    return item.category !== category || !inGeneratedRange;
  });
  let created = 0;
  let updated = 0;

  for (let value = network.first; value <= network.last; value += 1) {
    const ip = formatIpv4(value);
    const reserved = network.size > 2 && (value === network.first || value === network.last);
    const existing = existingByKey.get(`${category}:${ip}`) || existingByKey.get(`${sourceSheet}:${ip}`);

    if (existing) {
      nextItems.push({
        ...existing,
        category,
        vlan: vlan || existing.vlan || "",
        network: network.cidr,
        sourceSheet,
        updatedAt: now,
      });
      updated += 1;
      continue;
    }

    nextItems.push({
      id: makeNetworkId(category, network.cidr, ip),
      ip,
      name: reserved ? (value === network.first ? `Rede ${network.cidr}` : `Broadcast ${ip}`) : "",
      location: reserved ? category : "",
      category,
      vlan,
      network: network.cidr,
      status: reserved ? "Reservado" : "Livre",
      sourceSheet,
      notes: reserved ? `Endereco reservado da sub-rede ${network.cidr}` : `Livre na sub-rede ${network.cidr}`,
      updatedAt: now,
    });
    created += 1;
  }

  await writeStore(nextItems, store.links);
  return { message: "Rede criada.", category, network: network.cidr, created, updated, total: network.size };
}

function normalizeLinkPayload(payload: Record<string, unknown>, current?: IpInventoryLink): IpInventoryLink {
  const status = String(payload.status || current?.status || "Ativo") as IpInventoryLink["status"];
  const type = String(payload.type || current?.type || "Circuito") as IpInventoryLink["type"];
  const provider = clean(payload.provider ?? current?.provider);
  const service = clean(payload.service ?? current?.service);
  const name = clean(payload.name ?? current?.name) || [provider, service || type].filter(Boolean).join(" - ");

  return {
    id: current?.id || crypto.randomUUID(),
    provider,
    type: ["Circuito", "Uso"].includes(type) ? type : "Circuito",
    name,
    url: clean(payload.url ?? current?.url),
    category: clean(payload.category ?? current?.category) || provider || "Geral",
    speed: clean(payload.speed ?? current?.speed),
    fortinetIp: clean(payload.fortinetIp ?? current?.fortinetIp),
    port: clean(payload.port ?? current?.port),
    gateway: clean(payload.gateway ?? current?.gateway),
    mask: clean(payload.mask ?? current?.mask),
    ipCount: clean(payload.ipCount ?? current?.ipCount),
    range: clean(payload.range ?? current?.range),
    usedIp: clean(payload.usedIp ?? current?.usedIp),
    location: clean(payload.location ?? current?.location),
    service,
    ports: clean(payload.ports ?? current?.ports),
    status: ["Ativo", "Atencao", "Inativo"].includes(status) ? status : "Ativo",
    notes: clean(payload.notes ?? current?.notes),
    updatedAt: new Date().toISOString(),
  };
}

export async function createIpLink(payload: Record<string, unknown>) {
  const store = await readStore();
  const link = normalizeLinkPayload(payload);

  if (!link.name) throw new Error("Informe o nome do link.");
  if (!link.provider) throw new Error("Informe o provedor.");

  store.links.unshift(link);
  await writeStore(store.items, store.links);
  return { message: "Link cadastrado.", link };
}

export async function updateIpLink(id: string, payload: Record<string, unknown>) {
  const store = await readStore();
  const index = store.links.findIndex((link) => link.id === id);
  if (index < 0) throw new Error("Link nao encontrado.");

  const link = normalizeLinkPayload(payload, store.links[index]);
  if (!link.name) throw new Error("Informe o nome do link.");
  if (!link.provider) throw new Error("Informe o provedor.");

  store.links[index] = link;
  await writeStore(store.items, store.links);
  return { message: "Link atualizado.", link };
}

export async function deleteIpLink(id: string) {
  const store = await readStore();
  const links = store.links.filter((link) => link.id !== id);
  if (links.length === store.links.length) throw new Error("Link nao encontrado.");

  await writeStore(store.items, links);
  return { message: "Link removido." };
}

export async function reimportIps() {
  const store = await readStore();
  const items = preserveNetworkVlans(importWorkbook(), store.items);
  await writeStore(items, store.links);
  return { message: "Planilha reimportada.", total: items.length };
}
