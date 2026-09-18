import { execFile } from "node:child_process";
import { resolveSrv } from "node:dns/promises";
import { promisify } from "node:util";
import { adConfig } from "./config";

const execFileAsync = promisify(execFile);
const eventCache = new Map<string, { expiresAt: number; value: unknown }>();

function domainFromBaseDn() {
  return adConfig.baseDn
    ?.split(",")
    .map((part) => part.trim())
    .filter((part) => part.toUpperCase().startsWith("DC="))
    .map((part) => part.replace(/^DC=/i, ""))
    .join(".");
}

async function getDomainControllers() {
  const configured = process.env.AD_EVENT_DCS;
  if (configured) {
    return configured
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  const domain = domainFromBaseDn();
  if (domain) {
    try {
      const records = await resolveSrv(`_ldap._tcp.dc._msdcs.${domain}`);
      const hosts = records.map((record) => record.name.replace(/\.$/, "")).filter(Boolean);
      if (hosts.length) {
        return Array.from(new Set(hosts));
      }
    } catch {
      // Fallback to AD_URL below when DNS SRV lookup is unavailable.
    }
  }

  if (!adConfig.url) return [];

  try {
    const url = new URL(adConfig.url);
    return [url.hostname];
  } catch {
    return [];
  }
}

function buildPowerShell(dc: string, hours: number) {
  const safeDc = dc.replace(/'/g, "''");

  return `
$ErrorActionPreference = "Stop"
$events = Get-WinEvent -ComputerName '${safeDc}' -FilterHashtable @{ LogName='Security'; Id=4740; StartTime=(Get-Date).AddHours(-${hours}) } -MaxEvents 50
$events | ForEach-Object {
  $xml = [xml]$_.ToXml()
  $data = @{}
  foreach ($item in $xml.Event.EventData.Data) {
    $data[$item.Name] = $item.'#text'
  }
  [pscustomobject]@{
    domainController = '${safeDc}'
    timeCreated = $_.TimeCreated
    targetUser = $data.TargetUserName
    targetDomain = $data.TargetDomainName
    callerComputer = $data.CallerComputerName
    subjectUser = $data.SubjectUserName
  }
} | ConvertTo-Json -Depth 4
`;
}

export async function listLockoutEvents(hours = 24) {
  const cacheKey = `lockout-events:${hours}`;
  const cached = eventCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const domainControllers = await getDomainControllers();

  if (!domainControllers.length) {
    return {
      source: "eventlog",
      available: false,
      items: [],
      errors: ["Nenhum Domain Controller configurado para eventos."],
    };
  }

  const results = await Promise.all(
    domainControllers.map(async (dc) => {
      try {
        const { stdout } = await execFileAsync(
          "powershell.exe",
          ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", buildPowerShell(dc, hours)],
          { timeout: 6000, windowsHide: true },
        );

        const trimmed = stdout.trim();
        if (!trimmed) return { items: [], errors: [] };

        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return { items: parsed, errors: [] };
        }
        return { items: [parsed], errors: [] };
      } catch (error) {
        const maybeStderr = error as { stderr?: string };
        const rawMessage =
          maybeStderr.stderr?.trim() || (error instanceof Error ? error.message.split("\n")[0] : "Erro desconhecido");
        const message = rawMessage.startsWith("Command failed:")
          ? "Nao foi possivel ler o Security Log via Windows Event Log/RPC. Verifique firewall, WinRM/RPC e permissao Event Log Readers."
          : rawMessage;
        return { items: [], errors: [`${dc}: ${message}`] };
      }
    }),
  );

  const items = results.flatMap((result) => result.items);
  const errors = results.flatMap((result) => result.errors);

  const value = {
    source: "eventlog",
    available: errors.length < domainControllers.length,
    items,
    errors,
  };

  eventCache.set(cacheKey, { expiresAt: Date.now() + 60000, value });
  return value;
}
