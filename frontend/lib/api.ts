function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");
}

export function apiUrl(path: string): string {
  const API = apiBase();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API}/api${p}`;
}

export function wsUrl(token: string): string {
  const base = apiBase().replace(/^http:/, "ws:").replace(/^https:/, "wss:");
  return `${base}/api/ws?token=${encodeURIComponent(token)}`;
}

/** Extrae el mensaje legible de respuestas de error de FastAPI (`detail`). */
export function parseApiErrorMessage(raw: string): string {
  const t = raw.trim();
  if (!t) return "Error desconocido";
  try {
    const j = JSON.parse(t) as { detail?: unknown };
    if (typeof j.detail === "string") return j.detail;
    if (Array.isArray(j.detail)) {
      return j.detail
        .map((item) => {
          if (item && typeof item === "object" && "msg" in item) {
            return String((item as { msg: string }).msg);
          }
          return JSON.stringify(item);
        })
        .join(" ");
    }
  } catch {
    /* no es JSON */
  }
  return t;
}

export async function apiFetch<T>(
  path: string,
  token: string | null,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (
    init?.body &&
    typeof init.body === "string" &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(apiUrl(path), { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(parseApiErrorMessage(text));
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export type HealthOut = {
  status: string;
  /** s3 = operativo; misconfigured = bucket sin credenciales; unavailable = sin S3 */
  attachment_storage: "s3" | "misconfigured" | "unavailable";
  attachments_message: string | null;
};

export type AttachmentPresignOut = {
  attachment_id: string;
  upload_url: string;
  method: string;
  headers: Record<string, string>;
};

/** Sube el fichero directamente a S3 con URL prefirmada y finaliza el registro en la API. */
export async function uploadTicketAttachmentPresigned(
  ticketId: string,
  token: string,
  file: File,
): Promise<void> {
  const presign = await apiFetch<AttachmentPresignOut>(
    `/tickets/${ticketId}/attachments/presign`,
    token,
    {
      method: "POST",
      body: JSON.stringify({
        filename: file.name,
        content_type: file.type || "application/octet-stream",
        size_bytes: file.size,
      }),
    },
  );
  const putRes = await fetch(presign.upload_url, {
    method: presign.method || "PUT",
    body: file,
    headers: presign.headers,
  });
  if (!putRes.ok) {
    const errText = await putRes.text();
    throw new Error(
      errText ? parseApiErrorMessage(errText) : "Error al subir el archivo a S3 (revisa CORS del bucket).",
    );
  }
  await apiFetch(`/attachments/${presign.attachment_id}/finalize-s3`, token, {
    method: "POST",
  });
}

export async function downloadAttachment(
  attachmentId: string,
  token: string,
  filename: string,
): Promise<void> {
  const meta = await apiFetch<{ url: string; auth_required: boolean }>(
    `/attachments/${attachmentId}/download-url`,
    token,
  );
  const res = await fetch(
    meta.url,
    meta.auth_required ? { headers: { Authorization: `Bearer ${token}` } } : {},
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      text ? parseApiErrorMessage(text) : `No se pudo descargar (${res.status})`,
    );
  }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(blobUrl);
}
