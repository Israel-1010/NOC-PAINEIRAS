import mysql, { type Pool } from "mysql2/promise";
import { isWifiPortalConfigured, wifiPortalConfig } from "./config";

export type WifiKind = "associados" | "colaboradores";

export type WifiColumn = {
  name: string;
  type: string;
  nullable: boolean;
  key: string;
  defaultValue: unknown;
  extra: string;
  primary: boolean;
  autoIncrement: boolean;
  writable: boolean;
};

type DescribeRow = {
  Field: string;
  Type: string;
  Null: "YES" | "NO";
  Key: string;
  Default: unknown;
  Extra: string;
};

let pool: Pool | null = null;

function ensureName(value: string, label: string) {
  if (!/^[A-Za-z0-9_]+$/.test(value)) {
    throw new Error(`${label} invalido para MySQL.`);
  }
  return value;
}

function quoteId(value: string) {
  return `\`${ensureName(value, "Identificador").replace(/`/g, "``")}\``;
}

function tableForKind(kind: string) {
  if (kind === "associados") return ensureName(wifiPortalConfig.associadosTable, "Tabela de associados");
  if (kind === "colaboradores") return ensureName(wifiPortalConfig.colaboradoresTable, "Tabela de colaboradores");
  throw new Error("Secao WiFi invalida.");
}

function getPool() {
  if (!isWifiPortalConfigured()) {
    throw new Error("Banco WiFi nao configurado. Preencha WIFI_DB_HOST, WIFI_DB_USER, WIFI_DB_PASSWORD e WIFI_DB_NAME.");
  }

  if (!pool) {
    pool = mysql.createPool({
      host: wifiPortalConfig.host,
      port: wifiPortalConfig.port,
      user: wifiPortalConfig.user,
      password: wifiPortalConfig.password,
      database: wifiPortalConfig.database,
      waitForConnections: true,
      connectionLimit: 6,
      charset: "utf8mb4",
      dateStrings: true,
    });
  }

  return pool;
}

function normalizeColumn(row: DescribeRow): WifiColumn {
  const extra = String(row.Extra || "");
  const autoIncrement = extra.toLowerCase().includes("auto_increment");
  const primary = row.Key === "PRI";

  return {
    name: row.Field,
    type: row.Type,
    nullable: row.Null === "YES",
    key: row.Key,
    defaultValue: row.Default,
    extra,
    primary,
    autoIncrement,
    writable: !autoIncrement,
  };
}

async function getColumns(kind: string) {
  const table = tableForKind(kind);
  const [rows] = await getPool().query(`DESCRIBE ${quoteId(table)}`);
  return (rows as DescribeRow[]).map(normalizeColumn);
}

function primaryColumn(columns: WifiColumn[]) {
  return columns.find((column) => column.primary) || columns[0];
}

function writableColumns(columns: WifiColumn[]) {
  return columns.filter((column) => column.writable);
}

function normalizeData(data: unknown, columns: WifiColumn[], mode: "create" | "update") {
  const source = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const allowed = new Set(writableColumns(columns).map((column) => column.name));
  const normalized: Record<string, unknown> = {};

  for (const column of columns) {
    if (!allowed.has(column.name)) continue;
    if (mode === "update" && column.primary) continue;
    if (!(column.name in source)) continue;

    const value = source[column.name];
    normalized[column.name] = value === "" && column.nullable ? null : value;
  }

  return normalized;
}

export async function getWifiStatus() {
  if (!isWifiPortalConfigured()) {
    return {
      ok: false,
      configured: false,
      database: wifiPortalConfig.database,
      message: "Banco WiFi nao configurado.",
    };
  }

  try {
    await getPool().query("SELECT 1");
    return {
      ok: true,
      configured: true,
      database: wifiPortalConfig.database,
      message: "MySQL conectado.",
    };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      database: wifiPortalConfig.database,
      message: error instanceof Error ? error.message : "Falha MySQL.",
    };
  }
}

export async function getWifiSchema(kind: string) {
  const table = tableForKind(kind);
  const columns = await getColumns(kind);
  return {
    kind,
    table,
    primaryKey: primaryColumn(columns)?.name || "",
    columns,
  };
}

export async function listWifiRecords(kind: string, query: { search?: string; page?: string; pageSize?: string }) {
  const table = tableForKind(kind);
  const columns = await getColumns(kind);
  const primary = primaryColumn(columns);
  const page = Math.max(1, Number(query.page || 1) || 1);
  const pageSize = Math.max(5, Math.min(100, Number(query.pageSize || 20) || 20));
  const offset = (page - 1) * pageSize;
  const searchable = columns.map((column) => column.name);
  const search = String(query.search || "").trim();
  const params: unknown[] = [];
  let where = "";

  if (search && searchable.length) {
    where = `WHERE ${searchable.map((column) => `CAST(${quoteId(column)} AS CHAR) LIKE ?`).join(" OR ")}`;
    params.push(...searchable.map(() => `%${search}%`));
  }

  const [countRows] = await getPool().query(
    `SELECT COUNT(*) AS total FROM ${quoteId(table)} ${where}`,
    params,
  );
  const total = Number((countRows as Array<{ total: number }>)[0]?.total || 0);

  const [rows] = await getPool().query(
    `SELECT * FROM ${quoteId(table)} ${where} ORDER BY ${quoteId(primary.name)} DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );

  return {
    kind,
    table,
    columns,
    primaryKey: primary.name,
    page,
    pageSize,
    total,
    items: rows as Record<string, unknown>[],
  };
}

export async function createWifiRecord(kind: string, body: unknown) {
  const table = tableForKind(kind);
  const columns = await getColumns(kind);
  const data = normalizeData(body, columns, "create");
  const names = Object.keys(data);

  if (!names.length) {
    throw new Error("Informe ao menos um campo para inserir.");
  }

  const [result] = await getPool().execute(
    `INSERT INTO ${quoteId(table)} (${names.map(quoteId).join(", ")}) VALUES (${names.map(() => "?").join(", ")})`,
    names.map((name) => data[name]) as any[],
  );

  return {
    message: "Registro WiFi inserido.",
    result,
  };
}

export async function updateWifiRecord(kind: string, id: string, body: unknown) {
  const table = tableForKind(kind);
  const columns = await getColumns(kind);
  const primary = primaryColumn(columns);
  const data = normalizeData(body, columns, "update");
  const names = Object.keys(data);

  if (!primary) throw new Error("Tabela sem coluna primaria para edicao.");
  if (!names.length) throw new Error("Informe ao menos um campo para atualizar.");

  const [result] = await getPool().execute(
    `UPDATE ${quoteId(table)} SET ${names.map((name) => `${quoteId(name)} = ?`).join(", ")} WHERE ${quoteId(primary.name)} = ? LIMIT 1`,
    [...names.map((name) => data[name]), id] as any[],
  );

  return {
    message: "Registro WiFi atualizado.",
    result,
  };
}

export async function deleteWifiRecord(kind: string, id: string) {
  const table = tableForKind(kind);
  const columns = await getColumns(kind);
  const primary = primaryColumn(columns);
  if (!primary) throw new Error("Tabela sem coluna primaria para remocao.");

  const [result] = await getPool().execute(
    `DELETE FROM ${quoteId(table)} WHERE ${quoteId(primary.name)} = ? LIMIT 1`,
    [id],
  );

  return {
    message: "Registro WiFi removido.",
    result,
  };
}
