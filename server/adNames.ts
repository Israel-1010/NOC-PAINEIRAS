import { resolveAdUserIdentity } from "./adClient";

// Nome e departamento do AD a partir do login (registro), para paineis que so recebem o login
// (VPN do FortiGate/FortiAnalyzer). Cache de 10 min: o NOC atualiza a cada poucos segundos.
const TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; name: string; department: string }>();

export async function adNames(logins: string[]) {
  const result = new Map<string, { name: string; department: string }>();
  await Promise.all(
    Array.from(new Set(logins.filter(Boolean))).map(async (login) => {
      const key = login.toLowerCase();
      const hit = cache.get(key);
      if (hit && Date.now() - hit.at < TTL_MS) {
        result.set(login, hit);
        return;
      }
      try {
        const { profile } = await resolveAdUserIdentity(login);
        const entry = { at: Date.now(), name: String(profile.displayName || profile.cn || login), department: String(profile.department || "") };
        cache.set(key, entry);
        result.set(login, entry);
      } catch {
        // Login que nao existe no AD (ex.: usuario local do FortiGate): guarda para nao reconsultar.
        const entry = { at: Date.now(), name: login, department: "" };
        cache.set(key, entry);
        result.set(login, entry);
      }
    }),
  );
  return result;
}

// IP de casa e dado pessoal: no painel (TV) aparece so o inicio (177.140.x.x).
export function maskIp(ip: string) {
  const first = ip.split(/[;,]/)[0].trim();
  const parts = first.split(".");
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.x.x` : first ? "IP externo" : "";
}
