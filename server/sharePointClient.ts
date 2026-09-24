import { isSharePointConfigured, sharePointConfig } from "./config";

type GraphToken = {
  access_token: string;
  expires_in: number;
};

type GraphCollection<T> = {
  value: T[];
  "@odata.nextLink"?: string;
};

type GraphSite = {
  id: string;
  displayName?: string;
  webUrl?: string;
};

type GraphDrive = {
  id: string;
  name?: string;
  webUrl?: string;
};

type GraphIdentity = {
  user?: {
    displayName?: string;
    email?: string;
  };
};

type GraphDriveItem = {
  id: string;
  name: string;
  webUrl: string;
  size?: number;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
  folder?: {
    childCount?: number;
  };
  file?: {
    mimeType?: string;
  };
  createdBy?: GraphIdentity;
  lastModifiedBy?: GraphIdentity;
  parentReference?: {
    path?: string;
  };
};

export type PopDocument = {
  id: string;
  name: string;
  kind: "folder" | "file";
  webUrl: string;
  size: number;
  extension: string;
  mimeType: string;
  category: string;
  path: string;
  modifiedAt: string;
  modifiedBy: string;
};

type FolderReadError = {
  folder: string;
  message: string;
};

let tokenCache: { token: string; expiresAt: number } | null = null;
let driveCache: { siteId?: string; driveId: string; siteName: string; driveName: string; expiresAt: number } | null = null;

function encodePath(path: string) {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment.trim()))
    .filter(Boolean)
    .join("/");
}

function folderPathCandidates(path: string) {
  const normalized = decodeURIComponent(path).replace(/^\/+/, "").trim();
  const candidates = new Set<string>([normalized]);
  const libraryPrefixes = ["Documentos Compartilhados/", "Shared Documents/", "Documents/"];

  for (const prefix of libraryPrefixes) {
    if (normalized.toLowerCase().startsWith(prefix.toLowerCase())) {
      candidates.add(normalized.slice(prefix.length));
    }

    const marker = `/${prefix}`;
    const markerIndex = normalized.toLowerCase().indexOf(marker.toLowerCase());
    if (markerIndex >= 0) {
      candidates.add(normalized.slice(markerIndex + marker.length));
    }
  }

  return Array.from(candidates).filter(Boolean);
}

function fileExtension(name: string) {
  const match = /\.([^.]+)$/.exec(name);
  return match ? match[1].toUpperCase() : "";
}

function parentCategory(item: GraphDriveItem) {
  const rawPath = item.parentReference?.path || "";
  const decoded = decodeURIComponent(rawPath);
  const parts = decoded.split("/").filter(Boolean);
  return parts[parts.length - 1] || "POP";
}

function normalizeItem(item: GraphDriveItem): PopDocument {
  return {
    id: item.id,
    name: item.name,
    kind: item.folder ? "folder" : "file",
    webUrl: item.webUrl,
    size: Number(item.size || 0),
    extension: item.folder ? "PASTA" : fileExtension(item.name),
    mimeType: item.file?.mimeType || "",
    category: parentCategory(item),
    path: decodeURIComponent(item.parentReference?.path || ""),
    modifiedAt: item.lastModifiedDateTime || item.createdDateTime || "",
    modifiedBy: item.lastModifiedBy?.user?.displayName || item.createdBy?.user?.displayName || "SharePoint",
  };
}

async function getAccessToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.token;
  }

  if (!sharePointConfig.tenantId || !sharePointConfig.clientId || !sharePointConfig.clientSecret) {
    throw new Error("SharePoint nao configurado. Preencha tenant, client id e client secret.");
  }

  const body = new URLSearchParams({
    client_id: sharePointConfig.clientId,
    client_secret: sharePointConfig.clientSecret,
    grant_type: "client_credentials",
    scope: "https://graph.microsoft.com/.default",
  });
  const response = await fetch(`https://login.microsoftonline.com/${sharePointConfig.tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = await response.json() as GraphToken & { error_description?: string };

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || "Falha ao autenticar no Microsoft Graph.");
  }

  tokenCache = {
    token: payload.access_token,
    expiresAt: Date.now() + Math.max(60, Number(payload.expires_in || 3600) - 60) * 1000,
  };
  return tokenCache.token;
}

async function graphGet<T>(pathOrUrl: string) {
  const token = await getAccessToken();
  const url = pathOrUrl.startsWith("https://") ? pathOrUrl : `https://graph.microsoft.com/v1.0${pathOrUrl}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = typeof payload === "object" && payload && "error" in payload
      ? (payload as { error?: { message?: string } }).error?.message
      : "";
    throw new Error(message || "Falha ao consultar SharePoint.");
  }

  return payload as T;
}

async function resolveDrive() {
  if (driveCache && driveCache.expiresAt > Date.now()) {
    return driveCache;
  }

  let siteId = "";
  let siteName = "SharePoint";
  let driveId = sharePointConfig.driveId || "";
  let driveName = "Documentos";

  if (!driveId) {
    if (!sharePointConfig.hostname || !sharePointConfig.sitePath) {
      throw new Error("Informe SHAREPOINT_DRIVE_ID ou SHAREPOINT_HOSTNAME + SHAREPOINT_SITE_PATH.");
    }

    const sitePath = sharePointConfig.sitePath.startsWith("/") ? sharePointConfig.sitePath : `/${sharePointConfig.sitePath}`;
    const site = await graphGet<GraphSite>(`/sites/${sharePointConfig.hostname}:${sitePath}`);
    siteId = site.id;
    siteName = site.displayName || site.webUrl || "SharePoint";
    const drive = await graphGet<GraphDrive>(`/sites/${site.id}/drive`);
    driveId = drive.id;
    driveName = drive.name || "Documentos";
  }

  driveCache = {
    siteId,
    driveId,
    siteName,
    driveName,
    expiresAt: Date.now() + 10 * 60 * 1000,
  };
  return driveCache;
}

async function listFolderChildren(driveId: string, depth = 0, folderItemId?: string, folderPath?: string): Promise<PopDocument[]> {
  const select = "$select=id,name,webUrl,size,createdDateTime,lastModifiedDateTime,folder,file,createdBy,lastModifiedBy,parentReference";
  const top = "$top=200";
  const readErrors: FolderReadError[] = [];
  const documents = await listFolderChildrenSafe(driveId, depth, readErrors, folderItemId, folderPath);
  (documents as Array<PopDocument> & { readErrors?: FolderReadError[] }).readErrors = readErrors;
  return documents;
}

async function listFolderChildrenSafe(
  driveId: string,
  depth: number,
  readErrors: FolderReadError[],
  folderItemId?: string,
  folderPath?: string,
): Promise<PopDocument[]> {
  const select = "$select=id,name,webUrl,size,createdDateTime,lastModifiedDateTime,folder,file,createdBy,lastModifiedBy,parentReference";
  const top = "$top=200";
  const paths: string[] = [];

  if (folderItemId) {
    paths.push(`/drives/${driveId}/items/${encodeURIComponent(folderItemId)}/children?${select}&${top}`);
  } else if (folderPath) {
    paths.push(...folderPathCandidates(folderPath).map((candidate) => `/drives/${driveId}/root:/${encodePath(candidate)}:/children?${select}&${top}`));
  } else {
    throw new Error("Pasta do SharePoint nao informada.");
  }

  const documents: PopDocument[] = [];
  let lastError: unknown = null;

  for (const startPath of paths) {
    try {
      let next: string | undefined = startPath;

      while (next) {
        const currentPage = next;
        const page: GraphCollection<GraphDriveItem> = await graphGet<GraphCollection<GraphDriveItem>>(currentPage);
        for (const item of page.value || []) {
          const normalized = normalizeItem(item);
          documents.push(normalized);

          if (item.folder && depth < 2) {
            try {
              const children = await listFolderChildrenSafe(driveId, depth + 1, readErrors, item.id);
              documents.push(...children);
            } catch (error) {
              readErrors.push({
                folder: item.name,
                message: error instanceof Error ? error.message : "Falha ao abrir subpasta.",
              });
            }
          }
        }
        next = page["@odata.nextLink"];
      }

      return documents;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(lastError instanceof Error ? lastError.message : "Falha ao abrir pasta do SharePoint.");
}

export async function listPopDocuments(search = "") {
  if (!isSharePointConfigured()) {
    return {
      ok: false,
      configured: false,
      source: "sharepoint",
      message: "SharePoint ainda nao configurado.",
      siteName: "SharePoint",
      driveName: "POP",
      total: 0,
      items: [] as PopDocument[],
    };
  }

  const drive = await resolveDrive();
  const items = await listFolderChildren(drive.driveId, 0, sharePointConfig.folderItemId, sharePointConfig.folderPath) as Array<PopDocument> & { readErrors?: FolderReadError[] };
  const readErrors = items.readErrors || [];
  const normalizedSearch = search.trim().toLowerCase();
  const filtered = normalizedSearch
    ? items.filter((item) => `${item.name} ${item.category} ${item.extension} ${item.modifiedBy}`.toLowerCase().includes(normalizedSearch))
    : items;

  return {
    ok: true,
    configured: true,
    source: "sharepoint",
    message: readErrors.length
      ? `POP carregado, mas ${readErrors.length} subpasta(s) nao abriram.`
      : "POP sincronizado com SharePoint.",
    warnings: readErrors,
    siteName: drive.siteName,
    driveName: drive.driveName,
    total: filtered.length,
    items: filtered.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt)).slice(0, 200),
  };
}
