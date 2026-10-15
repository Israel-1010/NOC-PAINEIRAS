import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";

type DiagnosticStep = { name: string; ok: boolean; ms: number; detail: string };
type DiagnosticReport = { id: string; title: string; ok: boolean; steps: DiagnosticStep[] };

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

function authToken() {
  try {
    const raw = window.localStorage.getItem("rede-clube-session");
    return raw ? (JSON.parse(raw) as { token?: string }).token || "" : "";
  } catch {
    return "";
  }
}

// O que fazer quando cada passo falha (texto para o gestor).
const HINTS: Record<string, string> = {
  "Variáveis do AD": "Confira as variáveis do container no Portainer (Env) e faça o redeploy.",
  "DNS do controlador de domínio": "O servidor não resolve o nome do DC. Use o IP em AD_URL ou ajuste o DNS do host/container.",
  "Conexão de rede (porta LDAP)": "Libere a porta 636 (LDAPS) do servidor do container até o controlador de domínio no firewall.",
  "Login da conta de serviço (bind)": "A conta de AD_BIND_DN pode estar bloqueada, desabilitada, com senha expirada ou senha errada no servidor.",
  "Leitura de usuários e computadores": "A conta de serviço conecta, mas não consegue ler. Confira permissões e AD_BASE_DN.",
  "Variáveis do Intune (Microsoft Graph)": "Adicione as variáveis do Graph (INTUNE_* ou SHAREPOINT_*) no container e faça o redeploy.",
  "DNS da Microsoft": "O servidor não resolve endereços da internet. Ajuste o DNS do host/container.",
  "Conexão HTTPS com a Microsoft": "O servidor não sai para a internet na porta 443. Libere no firewall ou configure o proxy.",
  "Autenticação no Azure (token)": "Segredo do aplicativo expirado ou errado. Gere um novo segredo no Azure (App registrations) e atualize a variável.",
  "Leitura de dispositivos": "O aplicativo autentica, mas falta permissão no Graph (DeviceManagementManagedDevices.Read.All com consentimento de administrador).",
};

export function DiagnosticsDashboard() {
  const [reports, setReports] = useState<DiagnosticReport[] | null>(null);
  const [checkedAt, setCheckedAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const run = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/diagnostics/integrations`, { headers: { Authorization: `Bearer ${authToken()}` } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || `Servidor respondeu ${response.status}.`);
      setReports(payload.reports || []);
      setCheckedAt(payload.checkedAt || "");
    } catch (runError) {
      setError(runError instanceof Error ? `${runError.message} — a própria API pode estar fora do ar ou reiniciando.` : "Falha ao testar.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    run();
  }, [run]);

  return (
    <div className="dg-page">
      <div className="dg-toolbar">
        <p>
          Testes executados <b>a partir do servidor</b> do portal, passo a passo. O primeiro passo com ❌ mostra onde está o problema.
          {checkedAt ? <span> Último teste: {new Date(checkedAt).toLocaleString("pt-BR")}.</span> : null}
        </p>
        <button className="action-button" type="button" onClick={run} disabled={loading}>
          {loading ? <Loader2 size={16} className="dg-spin" /> : <RefreshCw size={16} />}
          {loading ? "Testando..." : "Testar novamente"}
        </button>
      </div>

      {error ? <div className="view-error" role="alert"><XCircle size={22} /><div><strong>{error}</strong></div></div> : null}

      <div className="dg-grid">
        {(reports || []).map((report) => (
          <section className={`dg-card ${report.ok ? "ok" : "fail"}`} key={report.id}>
            <header>
              {report.ok ? <CheckCircle2 size={22} /> : <XCircle size={22} />}
              <h3>{report.title}</h3>
              <span>{report.ok ? "Funcionando" : "Com problema"}</span>
            </header>
            <ol>
              {report.steps.map((item) => (
                <li key={item.name} className={item.ok ? "ok" : "fail"}>
                  {item.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                  <div>
                    <strong>{item.name} <small>{item.ms}ms</small></strong>
                    <span>{item.detail}</span>
                    {!item.ok && HINTS[item.name] ? <em>Como resolver: {HINTS[item.name]}</em> : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))}
        {!reports && loading ? <div className="view-loading">Testando conexões...</div> : null}
      </div>
    </div>
  );
}
