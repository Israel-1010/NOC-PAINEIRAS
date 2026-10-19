import dns from "node:dns/promises";
import net from "node:net";
import { adConfig, intuneConfig, isAdConfigured, isIntuneConfigured } from "./config";
import { getAdStatus, getAdSummary } from "./adClient";
import { getIntuneStatus, getIntuneSummary } from "./intuneClient";
import { isUnifiConfigured, testUnifi, unifiTargets } from "./unifiClient";
import { getLinksLive, isZabbixConfigured, zabbixHost, zabbixVersion, zbx } from "./zabbixClient";

export type DiagnosticStep = { name: string; ok: boolean; ms: number; detail: string };
export type DiagnosticReport = { id: string; title: string; ok: boolean; steps: DiagnosticStep[] };

type ErrorFormatter = (error: unknown) => string;

async function step(steps: DiagnosticStep[], name: string, run: () => Promise<string>, formatError: ErrorFormatter) {
  const started = Date.now();
  try {
    const detail = await run();
    steps.push({ name, ok: true, ms: Date.now() - started, detail });
    return true;
  } catch (error) {
    steps.push({ name, ok: false, ms: Date.now() - started, detail: formatError(error) });
    return false;
  }
}

function tcpCheck(host: string, port: number, timeoutMs = 5000) {
  return new Promise<string>((resolve, reject) => {
    const socket = net.connect({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`Porta ${port} sem resposta em ${timeoutMs / 1000}s (firewall ou rota bloqueando o servidor).`));
    }, timeoutMs);
    socket.once("connect", () => {
      clearTimeout(timer);
      socket.end();
      resolve(`Porta ${port} aberta.`);
    });
    socket.once("error", (error: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      reject(new Error(`Nao conectou na porta ${port}: ${error.code || error.message}.`));
    });
  });
}

async function resolveHost(host: string) {
  const addresses = await dns.lookup(host, { all: true });
  return `${host} → ${addresses.map((item) => item.address).join(", ")}`;
}

export async function diagnoseAd(formatError: ErrorFormatter): Promise<DiagnosticReport> {
  const steps: DiagnosticStep[] = [];
  let url: URL | null = null;

  const configured = await step(steps, "Variáveis do AD", async () => {
    if (adConfig.useMock) throw new Error("AD_USE_MOCK esta ativo (padrao). Defina AD_USE_MOCK=false no servidor.");
    const missing = [
      !adConfig.url && "AD_URL",
      !adConfig.baseDn && "AD_BASE_DN",
      !adConfig.bindDn && "AD_BIND_DN",
      !adConfig.bindPassword && "AD_BIND_PASSWORD",
    ].filter(Boolean);
    if (missing.length || !isAdConfigured()) throw new Error(`Faltando no servidor: ${missing.join(", ")}.`);
    url = new URL(adConfig.url!);
    return `${url.protocol}//${url.hostname}:${url.port || (url.protocol === "ldaps:" ? "636" : "389")} · TLS ${adConfig.tlsRejectUnauthorized ? "validando certificado" : "sem validar certificado"}`;
  }, formatError);
  if (!configured || !url) return { id: "ad", title: "Active Directory", ok: false, steps };

  const host = (url as URL).hostname;
  const port = Number((url as URL).port || ((url as URL).protocol === "ldaps:" ? 636 : 389));
  if (!(await step(steps, "DNS do controlador de domínio", () => resolveHost(host), formatError))) return { id: "ad", title: "Active Directory", ok: false, steps };
  if (!(await step(steps, "Conexão de rede (porta LDAP)", () => tcpCheck(host, port), formatError))) return { id: "ad", title: "Active Directory", ok: false, steps };
  if (!(await step(steps, "Login da conta de serviço (bind)", async () => (await getAdStatus()).message, formatError))) return { id: "ad", title: "Active Directory", ok: false, steps };
  await step(steps, "Leitura de usuários e computadores", async () => {
    const summary = await getAdSummary();
    return `${summary.users.total} usuários · ${summary.computers.total} computadores · ${summary.groups.total} grupos`;
  }, formatError);

  return { id: "ad", title: "Active Directory", ok: steps.every((item) => item.ok), steps };
}

export async function diagnoseIntune(formatError: ErrorFormatter): Promise<DiagnosticReport> {
  const steps: DiagnosticStep[] = [];
  const configured = await step(steps, "Variáveis do Intune (Microsoft Graph)", async () => {
    if (intuneConfig.useMock) throw new Error("INTUNE_USE_MOCK=true no servidor (dados de exemplo).");
    const missing = [
      !intuneConfig.tenantId && "INTUNE_TENANT_ID (ou SHAREPOINT_TENANT_ID)",
      !intuneConfig.clientId && "INTUNE_CLIENT_ID (ou SHAREPOINT_CLIENT_ID)",
      !intuneConfig.clientSecret && "INTUNE_CLIENT_SECRET (ou SHAREPOINT_CLIENT_SECRET)",
    ].filter(Boolean);
    if (missing.length || !isIntuneConfigured()) throw new Error(`Faltando no servidor: ${missing.join(", ")}.`);
    return "Tenant, aplicativo e segredo configurados.";
  }, formatError);
  if (!configured) return { id: "intune", title: "Intune", ok: false, steps };

  if (!(await step(steps, "DNS da Microsoft", async () => `${await resolveHost("login.microsoftonline.com")} · ${await resolveHost("graph.microsoft.com")}`, formatError))) {
    return { id: "intune", title: "Intune", ok: false, steps };
  }
  if (!(await step(steps, "Conexão HTTPS com a Microsoft", () => tcpCheck("graph.microsoft.com", 443), formatError))) {
    return { id: "intune", title: "Intune", ok: false, steps };
  }
  if (!(await step(steps, "Autenticação no Azure (token)", async () => (await getIntuneStatus()).message, formatError))) {
    return { id: "intune", title: "Intune", ok: false, steps };
  }
  await step(steps, "Leitura de dispositivos", async () => {
    const summary = await getIntuneSummary();
    return `${summary.total} dispositivos · ${summary.compliant} conformes · ${summary.nonCompliant} não conformes`;
  }, formatError);

  return { id: "intune", title: "Intune", ok: steps.every((item) => item.ok), steps };
}

export async function diagnoseZabbix(formatError: ErrorFormatter): Promise<DiagnosticReport> {
  const steps: DiagnosticStep[] = [];
  const done = (ok = steps.every((item) => item.ok)) => ({ id: "zabbix", title: "Zabbix (links de internet)", ok, steps });
  if (!(await step(steps, "Variáveis do Zabbix", async () => {
    if (!isZabbixConfigured()) throw new Error("Faltando no servidor: ZABBIX_URL e ZABBIX_API_TOKEN (ou ZABBIX_USER e ZABBIX_PASSWORD).");
    return zabbixHost();
  }, formatError))) return done(false);
  const [host, portText] = zabbixHost().split(":");
  if (!(await step(steps, "Conexão de rede com o Zabbix", () => tcpCheck(host, Number(portText) || 80), formatError))) return done(false);
  if (!(await step(steps, "API do Zabbix", async () => `Versão ${await zabbixVersion()}`, formatError))) return done(false);
  if (!(await step(steps, "Autenticação na API", async () => `${(await zbx<unknown[]>("host.get", { output: ["hostid"], limit: 1000 })).length} equipamentos visíveis`, formatError))) return done(false);
  await step(steps, "Leitura dos links", async () => {
    const live = await getLinksLive();
    if (!live.links.length) throw new Error("Nenhum link encontrado (grupo de hosts com 'Link' no nome).");
    return live.links.map((link) => `${link.name} ${(link.inBps / 1e6).toFixed(0)}/${(link.outBps / 1e6).toFixed(0)} Mbps`).join(" · ");
  }, formatError);
  return done();
}

export async function diagnoseUnifi(formatError: ErrorFormatter): Promise<DiagnosticReport> {
  const steps: DiagnosticStep[] = [];
  const done = (ok = steps.every((item) => item.ok)) => ({ id: "unifi", title: "Controladora UniFi", ok, steps });
  if (!(await step(steps, "Variáveis da UniFi", async () => {
    if (!isUnifiConfigured()) throw new Error("Nenhuma controladora configurada (Painel NOC > botão Wi-Fi, ou variáveis UNIFI_*).");
    return unifiTargets().map((target) => `${target.name} (${target.host})`).join(" · ");
  }, formatError))) return done(false);
  for (const target of unifiTargets()) {
    const [host, portText] = target.host.split(":");
    await step(steps, `Conexão de rede com a controladora ${target.name}`, () => tcpCheck(host, Number(portText) || 443), formatError);
  }
  const { results } = await testUnifi();
  for (const result of results) {
    steps.push({ name: `Login e leitura: ${result.name}`, ok: result.ok, ms: 0, detail: result.message });
  }
  return done();
}