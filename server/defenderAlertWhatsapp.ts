// Envia os alertas novos do Microsoft Defender (XDR) ao mesmo grupo de WhatsApp do NOC.
// So os que pedem acao: severidade alta/media ainda abertos e, das maquinas (Defender for Endpoint),
// tambem os baixos. Informativos (e-mail removido apos entrega, liberacao de quarentena...) ficam so no painel.
// O Graph pode publicar o alerta com atraso: considera alertas criados nas ultimas 3 h; os ids enviados
// ficam em data/defender-alerts-sent.json para nunca repetir.

import path from "node:path";
import { fetchDefenderAlerts, isDefenderConfigured, type DefenderAlert } from "./defenderClient";
import { isWhatsappConfigured, readStore, sendWhatsApp, writeStore } from "./fazAlertWhatsapp";

const POLL_MS = 3 * 60 * 1000;
const MAX_AGE_MS = 3 * 3600 * 1000;
const MAX_PER_CYCLE = 5;
const storePath = path.resolve(process.cwd(), "data", "defender-alerts-sent.json");

export function defenderNeedsAction(alert: DefenderAlert) {
  if (alert.status === "resolved") return false;
  if (alert.severity === "high" || alert.severity === "medium") return true;
  return alert.severity === "low" && alert.source === "endpoint";
}

const ICONS: Record<string, string> = { high: "🔴", medium: "🟠", low: "🟡" };
const LABELS: Record<string, string> = { high: "ALTO", medium: "MÉDIO", low: "BAIXO" };
const SOURCES: Record<string, string> = { email: "E-mail (Defender for Office 365)", endpoint: "Máquina (Defender for Endpoint)", identity: "Identidade", cloud: "Apps na nuvem" };

export function formatDefenderAlert(alert: DefenderAlert) {
  const lines = [`${ICONS[alert.severity] || "⚪"} *MICROSOFT DEFENDER · ${LABELS[alert.severity] || alert.severity.toUpperCase()}*`, `*${alert.title}*`];
  if (SOURCES[alert.source]) lines.push(`🛡️ ${SOURCES[alert.source]}`);
  if (alert.device) lines.push(`💻 Máquina: ${alert.device}`);
  if (alert.user) lines.push(`👤 Usuário: ${alert.user}`);
  if (alert.file) lines.push(`📄 Arquivo: ${alert.file}`);
  lines.push(`🕒 ${new Date(alert.time).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`);
  if (alert.url) lines.push(alert.url);
  return lines.join("\n");
}

async function cycle() {
  const alerts = await fetchDefenderAlerts(1);
  const store = await readStore(storePath);
  const sent = new Set(store.sent);
  const now = Date.now();
  let count = 0;
  let changed = false;
  for (const alert of [...alerts].reverse()) {
    if (sent.has(alert.id)) continue;
    const wanted = defenderNeedsAction(alert) && now - new Date(alert.time).getTime() < MAX_AGE_MS;
    if (wanted && count >= MAX_PER_CYCLE) continue;
    if (wanted) {
      await sendWhatsApp(formatDefenderAlert(alert));
      count++;
    }
    sent.add(alert.id);
    changed = true;
  }
  if (changed) await writeStore({ sent: [...sent], cooldown: {} }, storePath);
}

let started = false;
export function startDefenderAlertWhatsapp() {
  if (started || !isDefenderConfigured() || !isWhatsappConfigured()) return;
  started = true;
  const run = () => cycle().catch((error) => console.warn(`Alertas Defender -> WhatsApp: ${error instanceof Error ? error.message : error}`));
  setTimeout(run, 30000);
  setInterval(run, POLL_MS);
  console.log("Alertas do Microsoft Defender -> WhatsApp ativos.");
}
