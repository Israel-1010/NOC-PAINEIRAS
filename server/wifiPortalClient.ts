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

const pools = new Map<string, Pool>();
const schemaCache = new Map<string, { expiresAt: number; columns: WifiColumn[] }>();
const schemaCacheMs = 5 * 60 * 1000;

function ensureName(value: string, label: string) {
  if (!/^[A-Za-z0-9_]+$/.test(value)) {
    throw new Error(`${label} invalido para MySQL.`);
  }
  return value;
}

function quoteId(value: string) {
  return `\`${ensureName(value, "Identificador").replace(/`/g, "``")}\``;
}

function sourceForKind(kind: string) {
  if (kind === "associados") {
    return {
      database: ensureName(wifiPortalConfig.associadosDatabase, "Banco de associados"),
      table: ensureName(wifiPortalConfig.associadosTable, "Tabela de associados"),
    };
  }

  if (kind === "colaboradores") {
    return {
      database: ensureName(wifiPortalConfig.colaboradoresDatabase, "Banco de colaboradores"),
      table: ensureName(wifiPortalConfig.colaboradoresTable, "Tabela de colaboradores"),
    };
  }

  throw new Error("Secao WiFi invalida.");
}

function getPool(database: string) {
  if (!isWifiPortalConfigured()) {
    throw new Error("Banco WiFi nao configurado. Preencha WIFI_DB_HOST, WIFI_DB_USER, WIFI_DB_PASSWORD e os bancos/tabelas WiFi.");
  }

  const normalizedDatabase = ensureName(database, "Banco MySQL");
  let pool = pools.get(normalizedDatabase);

  if (!pool) {
    pool = mysql.createPool({
      host: wifiPortalConfig.host,
      port: wifiPortalConfig.port,
      user: wifiPortalConfig.user,
      password: wifiPortalConfig.password,
      database: normalizedDatabase,
      waitForConnections: true,
      connectionLimit: 6,
      charset: "utf8mb4",
      dateStrings: true,
      connectTimeout: wifiPortalConfig.connectTimeoutMs,
    });
    pools.set(normalizedDatabase, pool);
  }

  return pool;
}

async function queryRows<T>(database: string, sql: string, values: unknown[] = []) {
  const [rows] = await getPool(database).query({
    sql,
    values,
    timeout: wifiPortalConfig.queryTimeoutMs,
  } as any);
  return rows as T[];
}

async function executeQuery(database: string, sql: string, values: unknown[] = []) {
  const [result] = await getPool(database).query({
    sql,
    values,
    timeout: wifiPortalConfig.queryTimeoutMs,
  } as any);
  return result;
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
  const source = sourceForKind(kind);
  const cacheKey = `${source.database}.${source.table}`;
  const cached = schemaCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.columns;
  }

  const rows = await queryRows<DescribeRow>(source.database, `DESCRIBE ${quoteId(source.table)}`);
  const columns = rows.map(normalizeColumn);
  schemaCache.set(cacheKey, { expiresAt: Date.now() + schemaCacheMs, columns });
  return columns;
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

function applyKindDefaults(kind: string, data: Record<string, unknown>, columns: WifiColumn[]) {
  if (kind !== "colaboradores") return data;

  const columnNames = new Set(columns.map((column) => column.name.toLowerCase()));
  const next = { ...data };

  if (columnNames.has("attribute") && !next.attribute) {
    next.attribute = "Cleartext-Password";
  }

  if (columnNames.has("op") && !next.op) {
    next.op = ":=";
  }

  return next;
}

function isTextColumn(column: WifiColumn) {
  return /(char|text|enum|set|json)/i.test(column.type);
}

function searchableColumns(kind: string, columns: WifiColumn[]) {
  if (kind === "colaboradores") {
    const preferred = ["username", "value", "attribute"];
    const selected = preferred
      .map((name) => columns.find((column) => column.name.toLowerCase() === name))
      .filter(Boolean) as WifiColumn[];

    if (selected.length) return selected;
  }

  const preferred = ["nome", "name", "email", "cpf", "matricula", "registro", "username", "value"];
  const selected = columns.filter((column) => {
    const name = column.name.toLowerCase();
    return isTextColumn(column) && preferred.some((item) => name.includes(item));
  });

  if (selected.length) return selected;
  return columns.filter(isTextColumn).slice(0, 8);
}

export async function getWifiStatus(kind?: string) {
  if (!isWifiPortalConfigured()) {
    return {
      ok: false,
      configured: false,
      database: `${wifiPortalConfig.associadosDatabase} / ${wifiPortalConfig.colaboradoresDatabase}`,
      message: "Banco WiFi nao configurado.",
    };
  }

  try {
    if (kind) {
      const source = sourceForKind(kind);
      await queryRows(source.database, "SELECT 1 AS ok");
    } else {
      await queryRows(wifiPortalConfig.associadosDatabase, "SELECT 1 AS ok");
    }

    return {
      ok: true,
      configured: true,
      database: `${wifiPortalConfig.associadosDatabase} / ${wifiPortalConfig.colaboradoresDatabase}`,
      message: "MySQL conectado.",
    };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      database: `${wifiPortalConfig.associadosDatabase} / ${wifiPortalConfig.colaboradoresDatabase}`,
      message: error instanceof Error ? error.message : "Falha MySQL.",
    };
  }
}

export async function getWifiSchema(kind: string) {
  const source = sourceForKind(kind);
  const columns = await getColumns(kind);
  return {
    kind,
    database: source.database,
    table: source.table,
    primaryKey: primaryColumn(columns)?.name || "",
    columns,
  };
}

export async function listWifiRecords(kind: string, query: { search?: string; page?: string; pageSize?: string }) {
  const source = sourceForKind(kind);
  const columns = await getColumns(kind);
  const primary = primaryColumn(columns);
  const page = Math.max(1, Number(query.page || 1) || 1);
  const pageSize = Math.max(5, Math.min(100, Number(query.pageSize || 20) || 20));
  const offset = (page - 1) * pageSize;
  const searchable = searchableColumns(kind, columns).map((column) => column.name);
  const search = String(query.search || "").trim();
  const params: unknown[] = [];
  let where = "";

  if (search && searchable.length) {
    where = `WHERE ${searchable.map((column) => `${quoteId(column)} LIKE ?`).join(" OR ")}`;
    params.push(...searchable.map(() => `%${search}%`));
  }

  const countRows = await queryRows<{ total: number }>(
    source.database,
    `SELECT COUNT(*) AS total FROM ${quoteId(source.table)} ${where}`,
    params,
  );
  const total = Number(countRows[0]?.total || 0);

  const rows = await queryRows<Record<string, unknown>>(
    source.database,
    `SELECT * FROM ${quoteId(source.table)} ${where} ORDER BY ${quoteId(primary.name)} DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );

  return {
    kind,
    database: source.database,
    table: source.table,
    columns,
    primaryKey: primary.name,
    page,
    pageSize,
    total,
    items: rows,
  };
}

export async function createWifiRecord(kind: string, body: unknown) {
  const source = sourceForKind(kind);
  const columns = await getColumns(kind);
  const data = applyKindDefaults(kind, normalizeData(body, columns, "create"), columns);
  const names = Object.keys(data);

  if (!names.length) {
    throw new Error("Informe ao menos um campo para inserir.");
  }

  const result = await executeQuery(
    source.database,
    `INSERT INTO ${quoteId(source.table)} (${names.map(quoteId).join(", ")}) VALUES (${names.map(() => "?").join(", ")})`,
    names.map((name) => data[name]) as any[],
  );

  return {
    message: "Registro WiFi inserido.",
    result,
  };
}

export async function updateWifiRecord(kind: string, id: string, body: unknown) {
  const source = sourceForKind(kind);
  const columns = await getColumns(kind);
  const primary = primaryColumn(columns);
  const data = applyKindDefaults(kind, normalizeData(body, columns, "update"), columns);
  const names = Object.keys(data);

  if (!primary) throw new Error("Tabela sem coluna primaria para edicao.");
  if (!names.length) throw new Error("Informe ao menos um campo para atualizar.");

  const result = await executeQuery(
    source.database,
    `UPDATE ${quoteId(source.table)} SET ${names.map((name) => `${quoteId(name)} = ?`).join(", ")} WHERE ${quoteId(primary.name)} = ? LIMIT 1`,
    [...names.map((name) => data[name]), id] as any[],
  );

  return {
    message: "Registro WiFi atualizado.",
    result,
  };
}

export async function deleteWifiRecord(kind: string, id: string) {
  const source = sourceForKind(kind);
  const columns = await getColumns(kind);
  const primary = primaryColumn(columns);
  if (!primary) throw new Error("Tabela sem coluna primaria para remocao.");

  const result = await executeQuery(
    source.database,
    `DELETE FROM ${quoteId(source.table)} WHERE ${quoteId(primary.name)} = ? LIMIT 1`,
    [id],
  );

  return {
    message: "Registro WiFi removido.",
    result,
  };
}
