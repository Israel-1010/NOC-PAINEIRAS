import fs from "node:fs/promises";
import path from "node:path";
import { isSharePointConfigured } from "./config";
import {
  attachItemImage,
  detachItemImage,
  findItemImage,
  getTaskContext,
  newImageId,
  type ItemImage,
  type ProjectAccess,
} from "./projectStore";
import { deleteSharePointFile, downloadSharePointFile, SharePointWriteError, uploadProjectImage } from "./sharePointClient";

const uploadsDir = path.resolve(process.cwd(), "data", "uploads");
const allowedTypes: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};
const maxBytes = 8 * 1024 * 1024;

function safeId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "");
}

function localPath(taskId: string, imageId: string, mimeType: string) {
  return path.join(uploadsDir, safeId(taskId), `${safeId(imageId)}${allowedTypes[mimeType] || ".img"}`);
}

function stamp(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}h${pad(date.getMinutes())}m${pad(date.getSeconds())}`;
}

export async function uploadItemImage(taskId: string, itemId: string, input: unknown, access: ProjectAccess) {
  const source = (input && typeof input === "object" ? input : {}) as { name?: unknown; mimeType?: unknown; data?: unknown };
  const mimeType = String(source.mimeType || "");
  if (!allowedTypes[mimeType]) throw new Error("Envie uma imagem JPG, PNG, WEBP ou GIF.");
  const content = Buffer.from(String(source.data || "").replace(/^data:[^,]+,/, ""), "base64");
  if (!content.length) throw new Error("Imagem vazia.");
  if (content.length > maxBytes) throw new Error("Imagem muito grande (maximo 8 MB).");

  const context = await getTaskContext(taskId, itemId, access);
  if (context.imageCount >= 60) throw new Error("Limite de 60 imagens por item.");

  const now = new Date();
  const imageId = newImageId();
  const fileName = `${stamp(now)} - ${context.itemText.slice(0, 50)}${allowedTypes[mimeType]}`;
  const image: ItemImage = {
    id: imageId,
    name: fileName,
    mimeType,
    size: content.length,
    storage: "local",
    driveId: "",
    driveItemId: "",
    webUrl: "",
    path: "",
    uploadedBy: access.user.login,
    uploadedByName: access.user.name || access.user.login,
    at: now.toISOString(),
  };

  // Preferencia: pasta do POP no SharePoint (Projetos/<Projeto>/<Tarefa>).
  let warning = "";
  if (isSharePointConfigured()) {
    try {
      const uploaded = await uploadProjectImage(context.projectName, context.taskTitle, fileName, content, mimeType);
      Object.assign(image, { storage: "sharepoint", driveId: uploaded.driveId, driveItemId: uploaded.itemId, webUrl: uploaded.webUrl, path: uploaded.path });
    } catch (error) {
      warning = error instanceof SharePointWriteError && error.permission
        ? "SharePoint sem permissao de gravacao (o aplicativo precisa de Sites.ReadWrite.All). Imagem salva no servidor do portal."
        : `Nao foi possivel gravar no SharePoint (${error instanceof Error ? error.message : "erro"}). Imagem salva no servidor do portal.`;
    }
  } else {
    warning = "SharePoint nao configurado. Imagem salva no servidor do portal.";
  }

  if (image.storage === "local") {
    const target = localPath(taskId, imageId, mimeType);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content);
  }

  const task = await attachItemImage(taskId, itemId, image, access);
  return { task, image, warning };
}

export async function readItemImage(taskId: string, itemId: string, imageId: string, access: ProjectAccess) {
  const image = await findItemImage(taskId, itemId, imageId, access);
  const content = image.storage === "sharepoint"
    ? await downloadSharePointFile(image.driveId, image.driveItemId)
    : await fs.readFile(localPath(taskId, image.id, image.mimeType));
  return { image, content };
}

export async function removeItemImage(taskId: string, itemId: string, imageId: string, access: ProjectAccess) {
  const { task, image } = await detachItemImage(taskId, itemId, imageId, access);
  try {
    if (image.storage === "sharepoint") await deleteSharePointFile(image.driveId, image.driveItemId);
    else await fs.rm(localPath(taskId, image.id, image.mimeType), { force: true });
  } catch (error) {
    // A referencia ja saiu da tarefa; o arquivo pode ser apagado depois manualmente.
    console.warn("[imagens] falha ao apagar arquivo:", error instanceof Error ? error.message : error);
  }
  return task;
}
