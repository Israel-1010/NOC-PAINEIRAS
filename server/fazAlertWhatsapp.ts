// Envia os alertas dos event handlers do FortiAnalyzer ao grupo de WhatsApp do NOC (o mesmo dos
// alertas do Zabbix), pela Evolution API. Le a cada 2 min; so manda os que pedem acao (criterio em
// fortiAnalyzerClient.ts: ataque, forca bruta, maquina comprometida, disco do FortiAnalyzer...).
// Nao repete: guarda os ids enviados em data/faz-alerts-sent.json e segura o mesmo alerta por 2 h
// (forca bruta: um aviso a cada 6 h, de qualquer origem; disco/log do FortiAnalyzer: a cada 12 h).
// Ao subir o portal, ignora alertas com mais de 30 min (sem rajada de atrasados).
// Variaveis: EVOLUTION_URL, EVOLUTION_INSTANCE, EVOLUTION_API_KEY e NOC_WHATSAPP_GROUP (id do grupo, ...@g.us).

import fs from "node:fs/promises";
import path from "node:path";
import { fetchAnalyzerAlerts, isFortiAnalyzerConfigured, type AnalyzerAlert } from "./fortiAnalyzerClient";

const evolutionUrl = (process.env.EVOLUTION_URL || "").trim().replace(/\/+$/, "");
const instance = (process.env.EVOLUTION_INSTANCE || "").trim();
const apiKey = (process.env.EVOLUTION_API_KEY || "").trim();
const group = (process.env.NOC_WHATSAPP_GROUP || "").trim();

const POLL_MS = 2 * 60 * 1000;
const MAX_AGE_MS = 30 * 60 * 1000;
const COOLDOWN_MS = 2 * 3600 * 1000;
const MAX_PER_CYCLE = 6;

const dataDir = path.resolve(process.cwd(), "data");
const storePath = path.join(dataDir, "faz-alerts-sent.json");

const DEVICE_EVENT = /local device event|disk full/i;

export function isFazAlertWhatsappConfigured() {
  return Boolean(isFortiAnalyzerConfigured() && evolutionUrl && instance && apiKey && group);
}

// Mesmo assunto conta como o mesmo alerta: um ataque que dispara 3 handlers vira 1 mensagem.
const cooldownKey = (alert: AnalyzerAlert) => (/brute/i.test(alert.handler) ? "brute-force" : `${alert.source}|${alert.subject}`);
const cooldownMs = (alert: AnalyzerAlert) =>
  DEVICE_EVENT.test(`${alert.handler} ${alert.subject}`) ? 12 * 3600 * 1000 : /brute/i.test(alert.handler) ? 6 * 3600 * 1000 : COOLDOWN_MS;

const TITLES: [RegExp, string][] = [
  [/brute force/i, "Força bruta no login (VPN/firewall)"],
  [/disk full/i, "Disco do FortiAnalyzer cheio"],
  [/outbreak alert/i, "Ataque conhecido (Outbreak Alert)"],
  [/malicious code/i, "Código malicioso detectado"],
  [/botnet/i, "Botnet detectada"],
  [/compromised/i, "Máquina da rede falando com servidor de malware (C&C)"],
];
const title = (alert: AnalyzerAlert) => TITLES.find(([pattern]) => pattern.test(`${alert.handler} ${alert.subject}`))?.[1] || alert.handler || "Alerta";

const ICONS: Record<string, string> = { critical: "🚨", high: "🔴", medium: "🟠", low: "🟡" };
const LABELS: Record<string, string> = { critical: "CRÍTICO", high: "ALTO", medium: "MÉDIO", low: "BAIXO" };

const when = (iso: string) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

export function formatAlert(alert: AnalyzerAlert) {
  const lines = [`${ICONS[alert.severity] || "⚪"} *FORTIANALYZER · ${LABELS[alert.severity] || alert.severity.toUpperCase()}*`, `*${title(alert)}*`];
  if (alert.subject && alert.subject !== alert.handler) lines.push(alert.subject);
  if (alert.user) lines.push(`👤 Usuário: ${alert.user}`);
  if (alert.source) lines.push(`🌐 Origem: ${alert.source}`);
  if (alert.count > 1) lines.push(`🔁 ${alert.count} eventos`);
  if (alert.device) lines.push(`🛡️ ${alert.device}`);
  if (alert.time) lines.push(`🕒 ${when(alert.time)}`);
  return lines.join("\n");
}

export async function sendWhatsApp(text: string) {
  const url = `${evolutionUrl}/message/sendText/${encodeURIComponent(instance)}`;
  const post = (body: unknown) =>
    fetch(url, { method: "POST", signal: AbortSignal.timeout(15000), headers: { "Content-Type": "application/json", apikey: apiKey }, body: JSON.stringify(body) });
  let response = await post({ number: group, text });
  // Evolution v1 usa outro formato de corpo.
  if (response.status === 400 || response.status === 404) response = await post({ number: group, options: { delay: 0 }, textMessage: { text } });
  if (!response.ok) throw new Error(`Evolution API respondeu ${response.status} (${(await response.text()).slice(0, 120)}).`);
}

type Store = { sent: string[]; cooldown: Record<string, number> };

async function readStore(): Promise<Store> {
  try {
    const parsed = JSON.parse(await fs.readFile(storePath, "utf8")) as Partial<Store>;
    return { sent: Array.isArray(parsed.sent) ? parsed.sent : [], cooldown: parsed.cooldown && typeof parsed.cooldown === "object" ? parsed.cooldown : {} };
  } catch {
    return { sent: [], cooldown: {} };
  }
}

async function writeStore(store: Store) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(storePath, JSON.stringify(store, null, 2));
}

async function cycle() {
  const alerts = await fetchAnalyzerAlerts();
  const store = await readStore();
  const sent = new Set(store.sent);
  const now = Date.now();
  // cooldown guarda ate quando segurar cada alerta.
  for (const [key, until] of Object.entries(store.cooldown)) if (now > until) delete store.cooldown[key];

  let count = 0;
  let changed = false;
  // Mais antigos primeiro, para o grupo ler na ordem em que aconteceram.
  for (const alert of [...alerts].reverse()) {
    if (sent.has(alert.id)) continue;
    const age = now - new Date(alert.time).getTime();
    const key = cooldownKey(alert);
    const wanted = alert.action && age < MAX_AGE_MS && !store.cooldown[key];
    // Passou do limite do ciclo: fica para o proximo.
    if (wanted && count >= MAX_PER_CYCLE) continue;
    if (!wanted) {
      // Fora do criterio, atrasado ou repetido: marca como visto para nao mandar depois.
      sent.add(alert.id);
      changed = true;
      continue;
    }
    await sendWhatsApp(formatAlert(alert));
    sent.add(alert.id);
    store.cooldown[key] = now + cooldownMs(alert);
    count++;
    changed = true;
  }
  if (changed) await writeStore({ sent: [...sent].slice(-500), cooldown: store.cooldown });
  return count;
}

let started = false;
export function startFazAlertWhatsapp() {
  if (started || !isFazAlertWhatsappConfigured()) return;
  started = true;
  const run = () =>
    cycle().catch((error) => console.warn(`Alertas FortiAnalyzer -> WhatsApp: ${error instanceof Error ? error.message : error}`));
  setTimeout(run, 20000);
  setInterval(run, POLL_MS);
  console.log("Alertas do FortiAnalyzer -> WhatsApp ativos.");
}
