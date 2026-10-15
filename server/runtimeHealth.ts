// Saude do processo: quando subiu e os ultimos erros (visiveis em Administracao > Diagnostico).
export type RuntimeError = { at: string; kind: string; where: string; message: string };

export const startedAt = new Date().toISOString();
const recentErrors: RuntimeError[] = [];

function firstLine(value: unknown) {
  const text = value instanceof Error ? `${value.name}: ${value.message}` : String(value);
  return text.split("\n")[0].slice(0, 400);
}

export function recordError(kind: string, where: string, error: unknown) {
  recentErrors.unshift({ at: new Date().toISOString(), kind, where, message: firstLine(error) });
  recentErrors.splice(30);
}

export function runtimeInfo() {
  return {
    startedAt,
    uptimeSec: Math.round(process.uptime()),
    node: process.version,
    memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    errors: recentErrors.slice(0, 15),
  };
}

// Um erro inesperado em qualquer integracao nao pode derrubar o portal inteiro.
export function installCrashGuards() {
  process.on("unhandledRejection", (reason) => {
    recordError("promessa nao tratada", "processo", reason);
    console.error("[erro] promessa nao tratada:", reason);
  });
  process.on("uncaughtException", (error) => {
    recordError("excecao nao tratada", "processo", error);
    console.error("[erro] excecao nao tratada:", error);
  });
}
