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
    });
    pools.set(normalizedDatabase, pool);
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
  const source = sourceForKind(kind);
  const [rows] = await getPool(source.database).query(`DESCRIBE ${quoteId(source.table)}`);
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

export async function getWifiStatus() {
  if (!isWifiPortalConfigured()) {
    return {
      ok: false,
      configured: false,
      database: `${wifiPortalConfig.associadosDatabase} / ${wifiPortalConfig.colaboradoresDatabase}`,
      message: "Banco WiFi nao configurado.",
    };
  }

  try {
    await Promise.all([
      getPool(wifiPortalConfig.associadosDatabase).query("SELECT 1"),
      getPool(wifiPortalConfig.colaboradoresDatabase).query("SELECT 1"),
    ]);
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
  const searchable = columns.map((column) => column.name);
  const search = String(query.search || "").trim();
  const params: unknown[] = [];
  let where = "";

  if (search && searchable.length) {
    where = `WHERE ${searchable.map((column) => `CAST(${quoteId(column)} AS CHAR) LIKE ?`).join(" OR ")}`;
    params.push(...searchable.map(() => `%${search}%`));
  }

  const [countRows] = await getPool(source.database).query(
    `SELECT COUNT(*) AS total FROM ${quoteId(source.table)} ${where}`,
    params,
  );
  const total = Number((countRows as Array<{ total: number }>)[0]?.total || 0);

  const [rows] = await getPool(source.database).query(
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
    items: rows as Record<string, unknown>[],
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

  const [result] = await getPool(source.database).execute(
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

  const [result] = await getPool(source.database).execute(
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

  const [result] = await getPool(source.database).execute(
    `DELETE FROM ${quoteId(source.table)} WHERE ${quoteId(primary.name)} = ? LIMIT 1`,
    [id],
  );

  return {
    message: "Registro WiFi removido.",
    result,
  };
}
