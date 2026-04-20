import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";

export const UPLOAD_ROOT = path.join(process.cwd(), "storage", "uploads");

/** 확장자 (소문자, 점 제외) */
export const ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "docx",
  "xlsx",
  "pptx",
  "jpg",
  "jpeg",
  "png",
  "zip"
]);

const EXT_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  zip: "application/zip"
};

export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export function extensionFromFilename(name: string): string {
  const base = path.basename(name);
  const i = base.lastIndexOf(".");
  if (i === -1) {
    return "";
  }
  return base.slice(i + 1).toLowerCase();
}

export function mimeFromExtension(ext: string): string {
  return EXT_TO_MIME[ext.toLowerCase()] ?? "application/octet-stream";
}

function sanitizeFilenameSegment(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-가-힣]/g, "_").slice(0, 200);
}

export type SavedFile = {
  storageKey: string;
  mimeType: string;
  byteSize: number;
};

export async function saveUploadedBuffer(buffer: Buffer, originalName: string): Promise<SavedFile> {
  const ext = extensionFromFilename(originalName);
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error("unsupported_type");
  }
  if (buffer.length > MAX_FILE_BYTES) {
    throw new Error("too_large");
  }
  const mimeType = mimeFromExtension(ext);
  const now = new Date();
  const relDir = path.join(String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, "0"));
  const absDir = path.join(UPLOAD_ROOT, relDir);
  await fs.mkdir(absDir, { recursive: true });
  const safeOriginal = sanitizeFilenameSegment(path.basename(originalName));
  const filename = `${randomUUID()}_${safeOriginal || `file.${ext}`}`;
  const absPath = path.join(absDir, filename);
  await fs.writeFile(absPath, buffer);
  const storageKey = path.join(relDir, filename).replace(/\\/g, "/");
  return { storageKey, mimeType, byteSize: buffer.length };
}

export async function deleteStoredFile(storageKey: string): Promise<void> {
  const abs = path.join(UPLOAD_ROOT, storageKey);
  const normalized = path.normalize(abs);
  if (!normalized.startsWith(path.normalize(UPLOAD_ROOT))) {
    throw new Error("invalid_path");
  }
  await fs.unlink(normalized).catch(() => void 0);
}

export function absolutePathFromStorageKey(storageKey: string): string {
  return path.join(UPLOAD_ROOT, storageKey);
}
