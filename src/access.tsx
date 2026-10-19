import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, LockKeyhole, RefreshCw, RotateCcw, Search, ShieldCheck, Users } from "lucide-react";

type ViewInfo = { id: string; label: string; sensitive: boolean };
type AccessUser = {
  login: string;
  name: string;
  title: string;
  isAdmin: boolean;
  adminSource: "servidor" | "painel" | "";
  custom: boolean;
  views: string[];
  updatedAt: string;
  updatedBy: string;
};
type AccessData = {
  views: ViewInfo[];
  defaults: string[];
  users: AccessUser[];
  teamError: string;
  loginAllowedOu: string;
};

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

function authToken() {
  try {
    const raw = window.localStorage.getItem("rede-clube-session");
    return raw ? (JSON.parse(raw) as { token?: string }).token || "" : "";
  } catch {
    return "";
  }
}

async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${authToken()}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${API_BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  if (response.status === 401) window.dispatchEvent(new Event("rede-clube-auth-expired"));
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((payload as { message?: string }).message || "Falha ao falar com o servidor.");
  return payload as T;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return `${parts[0][0] || ""}${parts.length > 1 ? parts[parts.length - 1][0] : ""}`.toUpperCase();
}

export function AccessDashboard() {
  const [data, setData] = useState<AccessData | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [savedLogin, setSavedLogin] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      setData(await api<AccessData>("/api/access"));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nao foi possivel carregar os acessos.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (login: string) => {
    setSavedLogin(login);
    window.setTimeout(() => setSavedLogin((current) => (current === login ? "" : current)), 1500);
  };

  async function saveUser(user: AccessUser, views: string[]) {
    setData((current) => current && {
      ...current,
      users: current.users.map((item) => (item.login === user.login ? { ...item, views, custom: true } : item)),
    });
    try {
      await api(`/api/access/users/${encodeURIComponent(user.login)}`, "PUT", { views, name: user.name });
      flash(user.login);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Nao foi possivel salvar.");
      load();
    }
  }

  async function resetUser(user: AccessUser) {
    try {
      await api(`/api/access/users/${encodeURIComponent(user.login)}`, "DELETE");
      await load();
      flash(user.login);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Nao foi possivel restaurar o padrao.");
    }
  }

  async function setAdmin(user: AccessUser, admin: boolean) {
    if (admin && !window.confirm(`Tornar ${user.name} gestor? Gestores veem tudo e controlam os acessos.`)) return;
    try {
      await api(`/api/access/admins/${encodeURIComponent(user.login)}`, "PUT", { admin });
      await load();
      flash(user.login);
    } catch (adminError) {
      setError(adminError instanceof Error ? adminError.message : "Nao foi possivel alterar o gestor.");
    }
  }

  async function saveDefaults(views: string[]) {
    // Quem usa o padrao acompanha a mudanca na hora.
    setData((current) => current && {
      ...current,
      defaults: views,
      users: current.users.map((item) => (item.custom || item.isAdmin ? item : { ...item, views })),
    });
    try {
      await api("/api/access/defaults", "PUT", { views });
      flash("__defaults");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Nao foi possivel salvar o padrao.");
      load();
    }
  }

  const users = useMemo(() => {
    const term = filter.trim().toLowerCase();
    return (data?.users || []).filter((user) => !term || `${user.name} ${user.login} ${user.title}`.toLowerCase().includes(term));
  }, [data, filter]);

  if (!data) {
    return error ? (
      <div className="view-error" role="alert"><AlertTriangle size={24} /><div><strong>{error}</strong></div></div>
    ) : (
      <div className="view-loading">Carregando acessos...</div>
    );
  }

  const toggle = (views: string[], id: string) => (views.includes(id) ? views.filter((view) => view !== id) : [...views, id]);
  const allIds = data.views.map((view) => view.id);

  return (
    <div className="ac-page">
      <section className="ac-intro">
        <div className="ac-intro-item">
          <ShieldCheck size={20} />
          <div>
            <strong>Quem entra no portal</strong>
            <span>
              {data.loginAllowedOu
                ? <>Somente usuários da OU <b>{data.loginAllowedOu}</b> do Active Directory. Gestores sempre entram.</>
                : "Qualquer usuário do AD (restrição por OU desligada)."}
            </span>
          </div>
        </div>
        <div className="ac-intro-item">
          <LockKeyhole size={20} />
          <div>
            <strong>O que cada um vê</strong>
            <span>Marque os itens do menu por pessoa. Itens com <i className="ac-dot" /> dão acesso a dados sensíveis. O bloqueio vale também no servidor.</span>
          </div>
        </div>
      </section>

      {error ? (
        <div className="pm-error" role="alert">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      ) : null}
      {data.teamError ? (
        <div className="pm-error" role="alert">
          <AlertTriangle size={16} />
          <span>Não foi possível listar a equipe do AD: {data.teamError}</span>
        </div>
      ) : null}

      <div className="ac-toolbar">
        <label className="pm-search">
          <Search size={16} />
          <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Buscar pessoa, registro ou cargo" />
        </label>
        <span className="ac-count"><Users size={15} /> {data.users.length} pessoas</span>
        <button className="pm-icon-btn" type="button" title="Atualizar" aria-label="Atualizar" onClick={load}>
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="ac-table-wrap">
        <table className="ac-table">
          <thead>
            <tr>
              <th className="ac-person-col">Pessoa</th>
              {data.views.map((view) => (
                <th key={view.id} className={view.sensitive ? "sensitive" : ""} title={view.sensitive ? "Dados sensíveis" : undefined}>
                  <span>{view.label}</span>
                </th>
              ))}
              <th className="ac-actions-col" />
            </tr>
          </thead>
          <tbody>
            <tr className="ac-defaults-row">
              <td className="ac-person-col">
                <div className="ac-person">
                  <span className="ac-avatar defaults"><Users size={15} /></span>
                  <div>
                    <strong>Padrão</strong>
                    <small>Vale para quem não tem acesso personalizado</small>
                  </div>
                </div>
              </td>
              {data.views.map((view) => (
                <td key={view.id} className={view.sensitive ? "sensitive" : ""}>
                  <input
                    type="checkbox"
                    aria-label={`Padrão: ${view.label}`}
                    checked={data.defaults.includes(view.id)}
                    onChange={() => saveDefaults(toggle(data.defaults, view.id))}
                  />
                </td>
              ))}
              <td className="ac-actions-col">{savedLogin === "__defaults" ? <span className="ac-saved"><Check size={14} /> Salvo</span> : null}</td>
            </tr>

            {users.map((user) => (
              <tr key={user.login} className={user.isAdmin ? "admin" : user.custom ? "custom" : ""}>
                <td className="ac-person-col">
                  <div className="ac-person">
                    <span className="ac-avatar">{initials(user.name)}</span>
                    <div>
                      <strong>
                        {user.name}
                        {user.isAdmin ? <em className="ac-badge admin">Gestor</em> : user.custom ? <em className="ac-badge custom">Personalizado</em> : <em className="ac-badge">Padrão</em>}
                      </strong>
                      <small>{user.login}{user.title ? ` · ${user.title}` : ""}</small>
                    </div>
                  </div>
                </td>
                {data.views.map((view) => (
                  <td key={view.id} className={view.sensitive ? "sensitive" : ""}>
                    <input
                      type="checkbox"
                      aria-label={`${user.name}: ${view.label}`}
                      checked={user.views.includes(view.id)}
                      disabled={user.isAdmin}
                      onChange={() => saveUser(user, toggle(user.views, view.id))}
                    />
                  </td>
                ))}
                <td className="ac-actions-col">
                  {savedLogin === user.login ? (
                    <span className="ac-saved"><Check size={14} /> Salvo</span>
                  ) : user.isAdmin ? (
                    <div className="ac-row-actions">
                      {user.adminSource === "painel" ? (
                        <button type="button" onClick={() => setAdmin(user, false)} title="Tirar o papel de gestor">Remover gestor</button>
                      ) : user.adminSource === "servidor" ? (
                        <span className="ac-note">definido no servidor</span>
                      ) : null}
                    </div>
                  ) : (
                    <div className="ac-row-actions">
                      <button type="button" onClick={() => saveUser(user, allIds)} title="Liberar todos os itens">Tudo</button>
                      <button type="button" onClick={() => saveUser(user, [])} title="Bloquear todos os itens">Nada</button>
                      {user.custom ? (
                        <button type="button" onClick={() => resetUser(user)} title="Voltar a usar o padrão"><RotateCcw size={12} /> Padrão</button>
                      ) : null}
                      <button type="button" onClick={() => setAdmin(user, true)} title="Tornar gestor do portal"><ShieldCheck size={12} /> Gestor</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TvKeysSection />
    </div>
  );
}

type TvKeyInfo = { id: string; name: string; createdAt: string; createdBy: string; lastUsedAt: string };

// Chaves para TVs/monitores do NOC: abrem so o Painel NOC, sem login pessoal.
function TvKeysSection() {
  const [keys, setKeys] = useState<TvKeyInfo[]>([]);
  const [name, setName] = useState("");
  const [created, setCreated] = useState<{ name: string; url: string } | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setKeys((await api<{ keys: TvKeyInfo[] }>("/api/tv-keys")).keys);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Falha ao carregar as chaves de TV.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    try {
      const result = await api<{ name: string; key: string }>("/api/tv-keys", "POST", { name: name || "TV NOC" });
      setCreated({ name: result.name, url: `${window.location.origin}/?tv=${result.key}` });
      setName("");
      load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Falha ao criar a chave.");
    }
  }

  async function revoke(key: TvKeyInfo) {
    if (!window.confirm(`Revogar a chave "${key.name}"? A TV que usa essa chave para de mostrar o painel.`)) return;
    await api(`/api/tv-keys/${encodeURIComponent(key.id)}`, "DELETE");
    load();
  }

  return (
    <section className="ac-tv">
      <h3><ShieldCheck size={18} /> Telas de TV (modo quiosque)</h3>
      <p>
        Gere um endereço para a TV do NOC. Ele abre <b>somente o Painel NOC</b>, em tela cheia, sem login pessoal e sem expirar.
        Não dá acesso a nenhuma outra área.
      </p>
      {error ? <div className="pm-error"><AlertTriangle size={16} /><span>{error}</span></div> : null}
      <div className="ac-tv-form">
        <input value={name} maxLength={60} onChange={(event) => setName(event.target.value)} placeholder="Nome da tela (ex.: TV sala de TI)" />
        <button className="pm-btn primary" type="button" onClick={create}>Gerar endereço da TV</button>
      </div>
      {created ? (
        <div className="ac-tv-created">
          <strong>Endereço da "{created.name}" (copie agora, ele não aparece de novo):</strong>
          <code>{created.url}</code>
          <button className="pm-btn ghost" type="button" onClick={() => navigator.clipboard?.writeText(created.url)}>Copiar</button>
        </div>
      ) : null}
      {keys.length ? (
        <ul className="ac-tv-list">
          {keys.map((key) => (
            <li key={key.id}>
              <strong>{key.name}</strong>
              <span>criada por {key.createdBy} em {new Date(key.createdAt).toLocaleDateString("pt-BR")}</span>
              <span>{key.lastUsedAt ? `último uso ${new Date(key.lastUsedAt).toLocaleString("pt-BR")}` : "ainda não usada"}</span>
              <button type="button" onClick={() => revoke(key)}>Revogar</button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="ac-tv-empty">Nenhuma TV cadastrada.</p>
      )}
    </section>
  );
}
