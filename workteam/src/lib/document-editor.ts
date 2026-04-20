import crypto from "node:crypto";

/**
 * 외부 편집기 임베드 URL (환경변수 기반). 문서 파일 URL을 직접 노출하지 않는다.
 * DOCUMENT_EDITOR_BASE_URL, DOCUMENT_EDITOR_API_SECRET 이 없으면 null.
 */
export function buildDocumentEditorEmbedUrl(params: {
  documentId: string;
  viewerUserId: string;
}): string | null {
  const base = process.env.DOCUMENT_EDITOR_BASE_URL?.trim();
  const secret = process.env.DOCUMENT_EDITOR_API_SECRET?.trim();
  if (!base || !secret) {
    return null;
  }
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const payload = `${params.documentId}:${params.viewerUserId}:${exp}`;
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const u = new URL("/embed", base.endsWith("/") ? base : `${base}/`);
  u.searchParams.set("doc", params.documentId);
  u.searchParams.set("exp", String(exp));
  u.searchParams.set("sig", sig);
  return u.toString();
}
