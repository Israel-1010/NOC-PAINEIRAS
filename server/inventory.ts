// Inventario de maquinas: cruza AD, Intune, Defender for Endpoint, Milvus e Entra numa linha por maquina
// (pelo nome NetBIOS; o serial liga Intune e Milvus quando a maquina foi renomeada) e aponta as divergencias.
// Somente leitura nas fontes. Grava so as excecoes ("ignorar com motivo") e um retrato diario das contagens.
// Uma fonte fora do ar suspende as divergencias que dependem dela (nunca vira "fora do Intune" falso).

import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type { AuthUser } from "./auth";
import { listAdComputersForInventory } from "./adClient";
import { intuneConfig, isIntuneConfigured } from "./config";
import { listMachines } from "./defenderActions";
import { graphAll, isDefenderConfigured } from "./defenderClient";
import { windowsInfo } from "./intuneWindows";
import { listMilvusDevices } from "./milvusClient";

type SourceId = "ad" | "entra" | "intune" | "defender" | "milvus";
type SourceState = { id: SourceId; label: string; state: "ok" | "down" | "off"; count: number; error: string; partial: boolean };
type Kind = "estacao" | "servidor" | "mac" | "movel" | "outro";
type Family = "win11" | "win10" | "antigo" | "";

// Prazos (dias). O lastLogonTimestamp do AD replica com ate ~14 dias de atraso: nunca usar menos que isso nele.
const LIMITS = { ad: 90, intune: 30, defender: 7, milvus: 30, active: 30, grace: 7 };

// Catalogo das divergencias: a tela usa os rotulos, a aba, a cor e o "o que fazer" daqui.
const ISSUES = [
  { code: "fora-intune", tab: "seguranca", tone: "bad", label: "Fora do Intune", needs: ["ad", "intune"], action: "Em uso no AD e sem gerenciamento. Rode dsregcmd /status na máquina, confira a GPO de inscrição automática e o ingresso híbrido no Entra." },
  { code: "sem-defender", tab: "seguranca", tone: "bad", label: "Sem Defender", needs: ["defender"], action: "Em uso e sem o Defender for Endpoint. Faça o onboarding (política de EDR do Intune; script ou GPO nos servidores)." },
  { code: "sem-bitlocker", tab: "seguranca", tone: "bad", label: "Sem BitLocker", needs: ["intune"], action: "Disco sem criptografia. Atribua a política de BitLocker do Intune e confira a chave de recuperação no Entra." },
  { code: "so-antigo", tab: "seguranca", tone: "bad", label: "Sistema sem suporte", needs: [], action: "Windows 7/8.1 ou Server 2008/2012: sem atualização de segurança. Substitua ou isole da rede." },
  { code: "windows-10", tab: "seguranca", tone: "warn", label: "Windows 10", needs: [], action: "Sem suporte da Microsoft desde 14/10/2025. Agende a atualização em Intune > Windows 10 ou troque o equipamento." },
  { code: "parada-ad", tab: "limpeza", tone: "neutral", label: "Parada no AD", needs: ["ad"], action: "Sem logon há mais de 90 dias. Confirme com o setor, desative a conta e mova para a OU de desativadas; exclua depois de mais 90 dias." },
  { code: "desativada-ad", tab: "limpeza", tone: "neutral", label: "Desativada no AD", needs: ["ad"], action: "Conta de computador desativada. Se a máquina não existe mais, exclua pela ficha do AD." },
  { code: "intune-parado", tab: "limpeza", tone: "warn", label: "Intune sem sincronizar", needs: ["intune"], action: "Sem sincronizar há mais de 30 dias. Ligue a máquina e peça sincronização; se ela saiu do clube, retire do Intune." },
  { code: "intune-duplicado", tab: "limpeza", tone: "warn", label: "Duplicada no Intune", needs: ["intune"], action: "Mais de um registro com este nome no Intune (reinstalação). Exclua o registro antigo no portal do Intune." },
  { code: "defender-parado", tab: "limpeza", tone: "warn", label: "Defender sem contato", needs: ["defender"], action: "A máquina está em uso, mas o Defender não reporta há mais de 7 dias. Verifique o serviço Sense e a conexão com a internet." },
  { code: "milvus-parado", tab: "limpeza", tone: "warn", label: "Milvus sem contato", needs: ["milvus"], action: "O agente do Milvus não reporta há mais de 30 dias. Reinstale o agente ou dê baixa no Milvus se a máquina saiu." },
  { code: "so-intune", tab: "cadastro", tone: "warn", label: "Fora do AD", needs: ["ad", "intune"], action: "Windows no Intune sem conta no AD. O padrão do clube é híbrido: ingresse no domínio ou confirme se a máquina é do clube." },
  { code: "fora-milvus", tab: "cadastro", tone: "info", label: "Fora do Milvus", needs: ["milvus"], action: "Em uso e sem o agente do Milvus. Instale o agente para ter hardware, serial e usuário." },
  { code: "nome-fora-padrao", tab: "cadastro", tone: "neutral", label: "Nome fora do padrão", needs: [], action: "O padrão é N + patrimônio (notebook) ou D + patrimônio (desktop). Renomeie a máquina." },
  { code: "serial-repetido", tab: "cadastro", tone: "info", label: "Serial em outro nome", needs: [], action: "O mesmo número de série aparece com outro nome (renomeada ou reinstalada). Confira o nome atual e limpe o registro antigo." },
] as const;
type IssueCode = (typeof ISSUES)[number]["code"];

type AdInfo = { name: string; os: string; enabled: boolean; lastLogon: string; pwdLastSet: string; created: string; ou: string; dn: string };
type EntraInfo = { trust: string; enabled: boolean; lastSignIn: string };
type IntuneInfo = { id: string; name: string; os: string; osVersion: string; user: string; userName: string; lastSync: string; enrolled: string; encrypted: boolean; compliance: string; owner: string; serial: string; model: string; aadId: string; duplicates: number };
type DefenderInfo = { id: string; name: string; os: string; health: string; risk: string; lastSeen: string; ip: string; user: string };
type MilvusInfo = { name: string; kind: string; os: string; user: string; ip: string; serial: string; model: string; lastSeen: string };
type Exception = { key: string; code: IssueCode; reason: string; note: string; by: string; at: string; until: string | null };

export type InventoryMachine = Machine;
type Machine = {
  key: string;
  name: string;
  kind: Kind;
  os: string;
  family: Family;
  user: string;
  serial: string;
  model: string;
  asset: string;
  lastSeen: string;
  active: boolean;
  ad: AdInfo | null;
  entra: EntraInfo | null;
  intune: IntuneInfo | null;
  defender: DefenderInfo | null;
  milvus: MilvusInfo | null;
  issues: { code: IssueCode; detail: string; ignored?: Exception }[];
};

class InventoryError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

/* ---------- Datas ---------- */
const DAY = 864e5;
const NEVER = Number.POSITIVE_INFINITY;

// FILETIME do AD (100 ns desde 1601); 0 e o valor maximo significam "nunca".
function fileTime(value: string) {
  if (!/^\d{12,}$/.test(value || "")) return "";
  const ms = Number(BigInt(value) / 10000n) - 11644473600000;
  return ms > 0 && ms < 4102444800000 ? new Date(ms).toISOString() : "";
}

// "20210312153000.0Z" (generalizedTime do AD).
function generalizedTime(value: string) {
  const match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(value || "");
  return match ? `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z` : "";
}

function iso(value: string) {
  if (!value) return "";
  const date = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  return Number.isNaN(date.getTime()) || date.getFullYear() < 2000 ? "" : date.toISOString();
}

const age = (value: string) => (value ? Math.floor((Date.now() - new Date(value).getTime()) / DAY) : NEVER);
const newest = (...values: string[]) => values.filter(Boolean).sort().pop() || "";

/* ---------- Nomes e classificacao ---------- */
// Chave de casamento: nome antes do primeiro ponto, maiusculo, cortado em 15 (limite NetBIOS do AD).
const keyOf = (name: string) => String(name || "").split(".")[0].trim().toUpperCase().slice(0, 15);
const STANDARD_NAME = /^[ND]\d+$/;

function familyOf(machine: Machine): Family {
  if (machine.intune && /windows/i.test(machine.intune.os)) {
    const family = windowsInfo(machine.intune.osVersion).family;
    if (family === "win10" || family === "win11") return family;
  }
  const text = [machine.ad?.os, machine.defender?.os, machine.milvus?.os].filter(Boolean).join(" ");
  if (/windows (7|8|xp|vista)|server 20(03|08|12)/i.test(text)) return "antigo";
  if (/windows ?11/i.test(text)) return "win11";
  if (/windows ?10/i.test(text) && !/server/i.test(text)) return "win10";
  return "";
}

function kindOf(machine: Machine): Kind {
  if (machine.intune && /android|ios|ipados/i.test(machine.intune.os)) return "movel";
  const text = [machine.ad?.os, machine.defender?.os, machine.milvus?.os, machine.intune?.os].filter(Boolean).join(" ");
  if (/server/i.test(text)) return "servidor";
  // Sem sistema informado, a OU do AD diz o tipo (ex.: TIER1/T1Servers, Domain Controllers, T3Linux).
  if (/server|servidor|domain controllers/i.test(machine.ad?.ou || "")) return "servidor";
  if (/linux/i.test(machine.ad?.ou || "")) return "outro";
  if (machine.intune && /windows/i.test(machine.intune.os) && windowsInfo(machine.intune.osVersion).family === "server") return "servidor";
  if (/mac ?os|os x|darwin/i.test(text) || /^(imac|macbook)/i.test(machine.name)) return "mac";
  if (/linux|ubuntu|debian|centos/i.test(text)) return "outro";
  return "estacao";
}

function osLabel(machine: Machine) {
  if (machine.intune && /windows/i.test(machine.intune.os)) {
    const info = windowsInfo(machine.intune.osVersion);
    if (info.family !== "unknown") return machine.kind === "servidor" && machine.ad?.os ? machine.ad.os : info.label;
  }
  if (machine.intune && !/windows/i.test(machine.intune.os)) return [machine.intune.os, machine.intune.osVersion].filter(Boolean).join(" ");
  return machine.ad?.os || machine.defender?.os || machine.milvus?.os || "";
}

/* ---------- Leitura das fontes ---------- */
type Loaded<T> = { state: SourceState; data: T[] };

async function readSource<T>(id: SourceId, label: string, load: () => Promise<{ items: T[]; partial?: boolean } | null>): Promise<Loaded<T>> {
  try {
    const result = await load();
    if (!result) return { state: { id, label, state: "off", count: 0, error: "não configurado", partial: false }, data: [] };
    return { state: { id, label, state: "ok", count: result.items.length, error: "", partial: Boolean(result.partial) }, data: result.items };
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error)).split("\n")[0].slice(0, 200);
    return { state: { id, label, state: "down", count: 0, error: message, partial: false }, data: [] };
  }
}

type RawIntune = {
  id: string; deviceName: string; operatingSystem: string; osVersion: string; userPrincipalName?: string; userDisplayName?: string;
  lastSyncDateTime: string; enrolledDateTime: string; isEncrypted: boolean; complianceState: string; managedDeviceOwnerType: string;
  serialNumber?: string; model?: string; manufacturer?: string; azureADDeviceId?: string;
};
type RawEntra = { deviceId: string; displayName: string; operatingSystem: string; trustType: string | null; accountEnabled: boolean; approximateLastSignInDateTime: string | null };

const graphReady = () => !intuneConfig.useMock && isIntuneConfigured();

async function loadSources() {
  const [ad, intune, entra, defender, milvus] = await Promise.all([
    readSource("ad", "Active Directory", async () => {
      const items = await listAdComputersForInventory();
      return items ? { items } : null;
    }),
    readSource("intune", "Intune", async () => {
      if (!graphReady()) return null;
      const select = "id,deviceName,operatingSystem,osVersion,userPrincipalName,userDisplayName,lastSyncDateTime,enrolledDateTime,isEncrypted,complianceState,managedDeviceOwnerType,serialNumber,model,manufacturer,azureADDeviceId";
      return { items: await graphAll<RawIntune>(`/deviceManagement/managedDevices?$top=999&$select=${select}`, 10) };
    }),
    readSource("entra", "Entra ID", async () => {
      if (!graphReady()) return null;
      const select = "deviceId,displayName,operatingSystem,trustType,accountEnabled,approximateLastSignInDateTime";
      return { items: await graphAll<RawEntra>(`/devices?$top=999&$select=${select}`, 10) };
    }),
    readSource("defender", "Defender", async () => {
      if (!isDefenderConfigured()) return null;
      const { machines } = await listMachines();
      // A lista tambem traz aparelhos so "descobertos" na rede, sem o agente: esses nao contam.
      return { items: machines.filter((machine) => machine.onboarding === "Onboarded" && !/android|ios/i.test(machine.os)), partial: machines.length >= 1000 };
    }),
    readSource("milvus", "Milvus", () => listMilvusDevices()),
  ]);
  return { ad, intune, entra, defender, milvus };
}

/* ---------- Cruzamento ---------- */
function blank(key: string, name: string): Machine {
  return { key, name, kind: "estacao", os: "", family: "", user: "", serial: "", model: "", asset: "", lastSeen: "", active: false, ad: null, entra: null, intune: null, defender: null, milvus: null, issues: [] };
}

function build(sources: Awaited<ReturnType<typeof loadSources>>) {
  const rows = new Map<string, Machine>();
  const row = (name: string) => {
    const key = keyOf(name);
    if (!key) return null;
    if (!rows.has(key)) rows.set(key, blank(key, name.split(".")[0]));
    return rows.get(key)!;
  };

  for (const computer of sources.ad.data) {
    const target = row(computer.cn);
    if (!target || target.ad) continue;
    target.ad = {
      name: computer.cn,
      os: computer.operatingSystem,
      enabled: !(Number(computer.userAccountControl) & 2),
      lastLogon: fileTime(computer.lastLogonTimestamp),
      pwdLastSet: fileTime(computer.pwdLastSet),
      created: generalizedTime(computer.whenCreated),
      ou: computer.distinguishedName.split(",").filter((part) => /^OU=/i.test(part)).map((part) => part.slice(3)).reverse().join(" / "),
      dn: computer.distinguishedName,
    };
  }

  // Intune: celulares viram uma linha por aparelho (os Android do clube tem todos o mesmo nome "MDP").
  const byName = new Map<string, RawIntune[]>();
  for (const device of sources.intune.data) {
    if (/android|ios|ipados/i.test(device.operatingSystem)) {
      const mobile = blank(`MOVEL:${device.id}`, device.deviceName || "Celular");
      mobile.intune = intuneInfo(device, 0);
      rows.set(mobile.key, mobile);
      continue;
    }
    const key = keyOf(device.deviceName);
    if (key) byName.set(key, [...(byName.get(key) || []), device]);
  }
  for (const devices of byName.values()) {
    // Reinscrita: o registro de sync mais recente e o principal; os outros contam como duplicados.
    const [main] = [...devices].sort((a, b) => String(b.lastSyncDateTime).localeCompare(String(a.lastSyncDateTime)));
    const target = row(main.deviceName);
    if (target) target.intune = intuneInfo(main, devices.length - 1);
  }

  for (const machine of sources.defender.data) {
    const target = row(machine.name);
    if (!target || (target.defender && target.defender.lastSeen >= machine.lastSeen)) continue;
    target.defender = { id: machine.id, name: machine.name, os: machine.os, health: machine.health, risk: machine.risk, lastSeen: iso(machine.lastSeen), ip: machine.ip, user: machine.user };
  }

  for (const device of sources.milvus.data) {
    const target = row(device.hostname);
    const lastSeen = iso(device.updatedAt);
    if (!target || (target.milvus && target.milvus.lastSeen >= lastSeen)) continue;
    target.milvus = { name: device.hostname, kind: device.kind, os: device.os, user: device.user, ip: device.ip, serial: device.serial, model: [device.brand, device.model].filter(Boolean).join(" "), lastSeen };
  }

  // Entra so complementa (tipo de ingresso): pelo deviceId do Intune e, sem ele, pelo nome (prefere o hibrido).
  const entraById = new Map(sources.entra.data.map((device) => [device.deviceId, device]));
  const entraByName = new Map<string, RawEntra>();
  for (const device of sources.entra.data) {
    const key = keyOf(device.displayName);
    const current = entraByName.get(key);
    if (!current || (device.trustType === "ServerAd" && current.trustType !== "ServerAd")) entraByName.set(key, device);
  }

  const machines = [...rows.values()];
  for (const machine of machines) {
    const entra = (machine.intune?.aadId && entraById.get(machine.intune.aadId)) || (machine.key.startsWith("MOVEL:") ? undefined : entraByName.get(machine.key));
    if (entra) machine.entra = { trust: entra.trustType || "", enabled: entra.accountEnabled, lastSignIn: iso(entra.approximateLastSignInDateTime || "") };
    machine.name = machine.intune?.name || machine.ad?.name || machine.defender?.name || machine.milvus?.name || machine.name;
    machine.kind = kindOf(machine);
    // Nome de computador Windows nao diferencia maiusculas; o Defender e o Intune as vezes mandam minusculo.
    if (machine.kind === "estacao" || machine.kind === "servidor") machine.name = machine.name.toUpperCase();
    machine.family = familyOf(machine);
    machine.os = osLabel(machine);
    machine.user = machine.intune?.userName || machine.defender?.user || machine.milvus?.user || "";
    machine.serial = machine.intune?.serial || machine.milvus?.serial || "";
    machine.model = machine.intune?.model || machine.milvus?.model || "";
    machine.asset = /^[ND](\d{3,})/.exec(machine.key)?.[1] || "";
    machine.lastSeen = newest(machine.ad?.lastLogon || "", machine.intune?.lastSync || "", machine.defender?.lastSeen || "", machine.milvus?.lastSeen || "");
    machine.active = age(machine.lastSeen) <= LIMITS.active;
  }

  addIssues(machines, sources);
  return machines.sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true }));
}

function intuneInfo(device: RawIntune, duplicates: number): IntuneInfo {
  return {
    id: device.id,
    name: device.deviceName,
    os: device.operatingSystem,
    osVersion: device.osVersion,
    user: device.userPrincipalName || "",
    userName: device.userDisplayName || "",
    lastSync: iso(device.lastSyncDateTime),
    enrolled: iso(device.enrolledDateTime),
    encrypted: Boolean(device.isEncrypted),
    compliance: device.complianceState,
    owner: device.managedDeviceOwnerType,
    serial: (device.serialNumber || "").trim(),
    model: [device.manufacturer, device.model].filter(Boolean).join(" "),
    aadId: device.azureADDeviceId && !/^0{8}-/.test(device.azureADDeviceId) ? device.azureADDeviceId : "",
    duplicates,
  };
}

function addIssues(machines: Machine[], sources: Awaited<ReturnType<typeof loadSources>>) {
  const ok = (id: SourceId) => sources[id].state.state === "ok";
  const days = (value: string) => (age(value) === NEVER ? "nunca" : `há ${age(value)} dias`);

  // Mesmo serial em nomes diferentes (Intune x Milvus): renomeada ou reinstalada.
  const serials = new Map<string, Set<string>>();
  for (const machine of machines) {
    for (const serial of [machine.intune?.serial, machine.milvus?.serial]) {
      const clean = (serial || "").trim().toUpperCase();
      if (clean.length >= 5 && !/^(0+|default|to be filled|system serial)/i.test(clean)) serials.set(clean, (serials.get(clean) || new Set<string>()).add(machine.key));
    }
  }

  for (const machine of machines) {
    const add = (code: IssueCode, detail = "") => machine.issues.push({ code, detail });
    const computer = machine.kind === "estacao" || machine.kind === "servidor";
    const { ad, intune, defender, milvus } = machine;

    if (machine.kind === "estacao") {
      if (ok("ad") && ok("intune") && ad?.enabled && !intune && age(ad.lastLogon) <= LIMITS.ad && age(ad.created) > LIMITS.grace) add("fora-intune", `logon no AD ${days(ad.lastLogon)}`);
      // Windows em uso que so o Defender ou o Milvus conhecem: nem no AD nem no Intune.
      else if (ok("ad") && ok("intune") && !ad && !intune && machine.active && /windows/i.test(machine.os)) add("fora-intune", `fora do AD também; visto só ${[defender ? "no Defender" : "", milvus ? "no Milvus" : ""].filter(Boolean).join(" e ")}`);
      if (ok("ad") && ok("intune") && intune && !ad) add("so-intune", machine.entra?.trust === "AzureAd" ? "ingressada só no Entra" : intune.owner === "personal" ? "aparelho pessoal" : "");
      if (ok("intune") && intune && /windows/i.test(intune.os) && !intune.encrypted) add("sem-bitlocker");
      // Parada nao entra aqui: o trabalho dela e a limpeza, nao atualizar ou renomear.
      if (machine.active && machine.family === "win10") add("windows-10", machine.os);
      if (machine.active && !STANDARD_NAME.test(machine.key)) add("nome-fora-padrao");
      // O agente do Milvus so vai nas estacoes (nao ha servidor no Milvus).
      if (machine.active && ok("milvus") && !milvus) add("fora-milvus");
    }
    if (computer && machine.family === "antigo" && machine.active) add("so-antigo", machine.os);
    if (computer && machine.active && ok("defender") && !defender) add("sem-defender");
    // O AD atrasa o logon; a atividade recente que vale aqui e a do Intune ou do Milvus.
    if (defender && ok("defender") && age(defender.lastSeen) > LIMITS.defender && Math.min(age(intune?.lastSync || ""), age(milvus?.lastSeen || "")) <= LIMITS.defender) {
      add("defender-parado", `último contato ${days(defender.lastSeen)}`);
    }
    if (ad && ok("ad")) {
      // Computador ligado troca a senha da conta a cada 30 dias: pwdLastSet tambem mostra que esta vivo.
      const seen = newest(ad.lastLogon, ad.pwdLastSet);
      if (!ad.enabled) add("desativada-ad");
      else if (seen ? age(seen) > LIMITS.ad : age(ad.created) > 30) add("parada-ad", seen ? `sem logon ${days(seen)}` : "nunca fez logon");
    }
    if (intune && ok("intune") && age(intune.lastSync) > LIMITS.intune) add("intune-parado", `sem sincronizar ${days(intune.lastSync)}`);
    if (intune?.duplicates) add("intune-duplicado", `${intune.duplicates + 1} registros`);
    if (milvus && ok("milvus") && age(milvus.lastSeen) > LIMITS.milvus) add("milvus-parado", `último contato ${days(milvus.lastSeen)}`);
    const others = new Set<string>();
    for (const serial of [intune?.serial, milvus?.serial]) {
      for (const key of serials.get((serial || "").trim().toUpperCase()) || []) if (key !== machine.key) others.add(key);
    }
    if (others.size) add("serial-repetido", `mesmo serial de ${[...others].join(", ")}`);
  }
}

/* ---------- Excecoes ("ignorar com motivo") ---------- */
export const dataDir = path.resolve(process.cwd(), "data");
const exceptionsPath = path.join(dataDir, "inventory-exceptions.json");
const historyPath = path.join(dataDir, "inventory-history.json");
let writeQueue: Promise<unknown> = Promise.resolve();

export function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fsSync.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(file: string, value: unknown) {
  const run = writeQueue.then(async () => {
    await fs.mkdir(dataDir, { recursive: true });
    const temp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await fs.rename(temp, file);
  });
  writeQueue = run.catch(() => undefined);
  return run;
}

const readExceptions = () => readJson<{ exceptions: Exception[] }>(exceptionsPath, { exceptions: [] }).exceptions;
const validException = (item: Exception) => !item.until || item.until > new Date().toISOString();

// "machine" (e nao "key"): a auditoria mascara campos chamados key.
export async function addInventoryException(body: Record<string, unknown>, user?: AuthUser) {
  const key = String(body.machine || "").trim();
  const code = String(body.code || "") as IssueCode;
  const reason = String(body.reason || "").trim().slice(0, 80);
  const note = String(body.note || "").trim().slice(0, 300);
  const days = Number(body.days);
  if (!key || !ISSUES.some((issue) => issue.code === code)) throw new InventoryError("Máquina ou divergência inválida.");
  if (!reason) throw new InventoryError("Escolha o motivo.");
  if (note.length < 5) throw new InventoryError("Escreva uma observação (mínimo 5 caracteres).");
  if (![0, 30, 90].includes(days)) throw new InventoryError("Validade inválida.");
  const item: Exception = { key, code, reason, note, by: user?.login || "", at: new Date().toISOString(), until: days ? new Date(Date.now() + days * DAY).toISOString() : null };
  await writeJson(exceptionsPath, { exceptions: [...readExceptions().filter((current) => !(current.key === key && current.code === code)), item] });
  return { ok: true, exception: item };
}

export async function removeInventoryException(key: string, code: string) {
  const exceptions = readExceptions();
  const rest = exceptions.filter((current) => !(current.key === key && current.code === code));
  if (rest.length === exceptions.length) throw new InventoryError("Exceção não encontrada.", 404);
  await writeJson(exceptionsPath, { exceptions: rest });
  return { ok: true };
}

/* ---------- Resumo e historico ---------- */
type Snapshot = { date: string; machines: number; active: number; counts: Partial<Record<IssueCode, number>>; coverage: Record<string, number> };

function summarize(machines: Machine[]) {
  const counts: Partial<Record<IssueCode, number>> = {};
  for (const machine of machines) {
    for (const code of new Set(machine.issues.filter((issue) => !issue.ignored).map((issue) => issue.code))) counts[code] = (counts[code] || 0) + 1;
  }
  // Cobertura sobre as estacoes em uso (vistas em ate 30 dias em alguma fonte).
  const stations = machines.filter((machine) => machine.kind === "estacao" && machine.active);
  const coverage = {
    stations: stations.length,
    intune: stations.filter((machine) => machine.intune).length,
    defender: stations.filter((machine) => machine.defender).length,
    bitlocker: stations.filter((machine) => machine.intune?.encrypted).length,
    win11: stations.filter((machine) => machine.family === "win11").length,
    milvus: stations.filter((machine) => machine.milvus).length,
  };
  return { machines: machines.length, active: machines.filter((machine) => machine.active).length, counts, coverage };
}

const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

// Um retrato por dia (o ultimo do dia vale), so quando nenhuma fonte configurada caiu. Guarda ~13 meses.
async function recordHistory(machines: Machine[], sources: SourceState[]) {
  if (sources.some((source) => source.state === "down")) return;
  const snapshot: Snapshot = { date: today(), ...summarize(applyExceptions(machines)) };
  const history = readJson<{ days: Snapshot[] }>(historyPath, { days: [] }).days.filter((day) => day.date !== snapshot.date);
  await writeJson(historyPath, { days: [...history, snapshot].slice(-400) });
}

function applyExceptions(machines: Machine[]) {
  const exceptions = readExceptions().filter(validException);
  return machines.map((machine) => ({
    ...machine,
    issues: machine.issues.map((issue) => {
      const ignored = exceptions.find((item) => item.key === machine.key && item.code === issue.code);
      return ignored ? { ...issue, ignored } : { code: issue.code, detail: issue.detail };
    }),
  }));
}

/* ---------- Cache ---------- */
type Built = { checkedAt: string; sources: SourceState[]; machines: Machine[] };
const FRESH_MS = 10 * 60 * 1000;
let cache: { at: number; value: Built } | null = null;
let building: Promise<Built> | null = null;

function rebuild() {
  if (building) return building;
  building = loadSources()
    .then(async (sources) => {
      const machines = build(sources);
      const value: Built = { checkedAt: new Date().toISOString(), sources: Object.values(sources).map((source) => source.state), machines };
      cache = { at: Date.now(), value };
      await recordHistory(machines, value.sources).catch((error) => console.error("[inventario] historico:", error));
      return value;
    })
    .finally(() => {
      building = null;
    });
  return building;
}

// refresh: le tudo de novo (no maximo uma vez por minuto). Cache velho responde na hora e atualiza por tras.
export async function getInventory(refresh = false) {
  const elapsed = cache ? Date.now() - cache.at : NEVER;
  let built: Built;
  if (!cache || (refresh && elapsed > 60000)) built = await rebuild();
  else {
    if (elapsed > FRESH_MS) void rebuild().catch(() => undefined);
    built = cache.value;
  }
  const machines = applyExceptions(built.machines);
  const down = new Set(built.sources.filter((source) => source.state !== "ok").map((source) => source.id as string));
  return {
    checkedAt: built.checkedAt,
    sources: built.sources,
    limits: LIMITS,
    catalog: ISSUES.map((issue) => ({ ...issue, suspended: (issue.needs as readonly string[]).some((need) => down.has(need)) })),
    summary: summarize(machines),
    history: readJson<{ days: Snapshot[] }>(historyPath, { days: [] }).days.slice(-120),
    machines,
  };
}
