"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, downloadAttachment, uploadTicketAttachmentPresigned, type HealthOut } from "@/lib/api";
import type { Attachment, Comment, Ticket, UserBrief } from "@/lib/types";
import { PRIORITY_LABELS, STATE_LABELS } from "@/lib/types";
import { UserAvatar, UserBadge } from "@/components/UserBadge";
import { AssigneePicker } from "@/components/AssigneePicker";

export default function TicketDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { token, user, mergeTicket, refreshTickets, tickets, subscribeToTicketUpdates } = useAuth();
  const router = useRouter();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [users, setUsers] = useState<UserBrief[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [attachHealth, setAttachHealth] = useState<HealthOut | null>(null);
  const [attachActionErr, setAttachActionErr] = useState("");
  const [highlightActor, setHighlightActor] = useState<UserBrief | null>(null);
  const [deleteTicketErr, setDeleteTicketErr] = useState("");

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const [t, c, a, u] = await Promise.all([
          apiFetch<Ticket>(`/tickets/${id}`, token),
          apiFetch<Comment[]>(`/tickets/${id}/comments`, token),
          apiFetch<Attachment[]>(`/tickets/${id}/attachments`, token),
          apiFetch<UserBrief[]>("/users", token),
        ]);
        setTicket(t);
        setComments(c);
        setAttachments(a);
        setUsers(u);
      } catch {
        setErr("No se pudo cargar el ticket");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, token]);

  useEffect(() => {
    if (!token) return;
    const unsub = subscribeToTicketUpdates((updated) => {
      if (String(updated.id) !== String(id)) return;
      setTicket(updated);
      void (async () => {
        try {
          const [c, a] = await Promise.all([
            apiFetch<Comment[]>(`/tickets/${id}/comments`, token),
            apiFetch<Attachment[]>(`/tickets/${id}/attachments`, token),
          ]);
          setComments(c);
          setAttachments(a);
        } catch {
          /* ignore */
        }
      })();
    });
    return unsub;
  }, [subscribeToTicketUpdates, id, token]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    apiFetch<HealthOut>("/health", token)
      .then((h) => {
        if (!cancelled) setAttachHealth(h);
      })
      .catch(() => {
        if (!cancelled) {
          setAttachHealth({
            status: "ok",
            attachment_storage: "unavailable",
            attachments_message:
              "No se pudo obtener el estado del servidor. Comprueba que el backend esté en marcha y la URL en NEXT_PUBLIC_API_URL.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("ticketing_notif_actor");
      if (!raw) return;
      const parsed = JSON.parse(raw) as { ticketId: string; actor: UserBrief | null };
      if (parsed.ticketId === id && parsed.actor) {
        setHighlightActor(parsed.actor);
      }
      sessionStorage.removeItem("ticketing_notif_actor");
    } catch {
      sessionStorage.removeItem("ticketing_notif_actor");
    }
  }, [id]);

  useEffect(() => {
    if (!ticket || loading || !token) return;
    const found = tickets.some((t) => t.id === id);
    if (tickets.length > 0 && !found) {
      router.replace("/board");
    }
  }, [tickets, id, ticket, loading, token, router]);

  useEffect(() => {
    if (!token || !user) router.replace("/login");
  }, [token, user, router]);

  if (!token || !user) return null;

  const reloadAttachments = async () => {
    if (!token) return;
    const a = await apiFetch<Attachment[]>(`/tickets/${id}/attachments`, token);
    setAttachments(a);
  };

  const onReassign = async (assigneeId: string) => {
    if (!token || !ticket) return;
    const aid = assigneeId === "" ? null : assigneeId;
    const updated = await apiFetch<Ticket>(`/tickets/${id}`, token, {
      method: "PATCH",
      body: JSON.stringify({ assignee_id: aid }),
    });
    setTicket(updated);
    mergeTicket(updated);
    await refreshTickets();
  };

  const onAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !commentBody.trim()) return;
    await apiFetch(`/tickets/${id}/comments`, token, {
      method: "POST",
      body: JSON.stringify({ body: commentBody }),
    });
    setCommentBody("");
    const c = await apiFetch<Comment[]>(`/tickets/${id}/comments`, token);
    setComments(c);
    if (ticket) {
      const t2 = await apiFetch<Ticket>(`/tickets/${id}`, token);
      setTicket(t2);
      mergeTicket(t2);
    }
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setAttachActionErr("");
    if (attachHealth?.attachment_storage !== "s3") {
      setAttachActionErr(
        attachHealth?.attachments_message ??
          "Los adjuntos solo funcionan con S3 configurado en el backend (.env).",
      );
      e.target.value = "";
      return;
    }
    try {
      await uploadTicketAttachmentPresigned(id, token, file);
    } catch (ex) {
      setAttachActionErr(ex instanceof Error ? ex.message : "Error al subir");
      e.target.value = "";
      return;
    }
    e.target.value = "";
    await reloadAttachments();
    if (ticket) {
      const t2 = await apiFetch<Ticket>(`/tickets/${id}`, token);
      setTicket(t2);
      mergeTicket(t2);
      await refreshTickets();
    }
  };

  const onDeleteTicket = async () => {
    if (!token || !confirm("¿Eliminar este ticket, comentarios y adjuntos del servidor?")) return;
    setDeleteTicketErr("");
    try {
      await apiFetch(`/tickets/${id}`, token, { method: "DELETE" });
    } catch (ex) {
      setDeleteTicketErr(ex instanceof Error ? ex.message : "No se pudo eliminar");
      return;
    }
    await refreshTickets();
    router.replace("/board");
  };

  const onDeleteAtt = async (attId: string) => {
    if (!token) return;
    setAttachActionErr("");
    try {
      await apiFetch(`/attachments/${attId}`, token, { method: "DELETE" });
    } catch (ex) {
      setAttachActionErr(ex instanceof Error ? ex.message : "No se pudo eliminar el adjunto");
      return;
    }
    await reloadAttachments();
  };

  if (loading) {
    return (
      <>
        <Header />
        <p className="p-6 text-zinc-500">Cargando…</p>
      </>
    );
  }

  if (err || !ticket) {
    return (
      <>
        <Header />
        <p className="p-6 text-rose-400">{err || "No encontrado"}</p>
        <Link href="/board" className="px-6 text-sky-400">
          Volver
        </Link>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Link href="/board" className="text-sm text-sky-400 hover:underline">
          ← Tablero
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-white">{ticket.title}</h1>
        <div className="mt-3 flex flex-wrap gap-3 text-sm text-zinc-400">
          <span>{STATE_LABELS[ticket.state]}</span>
          <span className="text-zinc-600">·</span>
          <span>{PRIORITY_LABELS[ticket.priority]}</span>
        </div>
        {highlightActor ? (
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-sky-900/40 bg-sky-950/25 px-3 py-2">
            <UserAvatar user={highlightActor} size="sm" title={highlightActor.name} />
            <p className="min-w-0 flex-1 text-sm text-zinc-300">
              Actividad reciente de{" "}
              <span className="font-medium text-zinc-100">{highlightActor.name}</span>
            </p>
            <button
              type="button"
              onClick={() => setHighlightActor(null)}
              className="shrink-0 rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-8 rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-4">
          <UserBadge user={ticket.author} label="Creador" size="md" />
          <UserBadge
            user={ticket.assignee}
            label="Asignado"
            size="md"
            emptyLabel="Sin asignar"
          />
        </div>
        <p className="mt-6 whitespace-pre-wrap text-zinc-300">{ticket.description || "Sin descripción"}</p>

        <section className="mt-8 border-t border-zinc-800 pt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Reasignar</h2>
          <AssigneePicker
            users={users}
            assigneeId={ticket.assignee_id}
            assignee={ticket.assignee}
            onAssign={onReassign}
          />
        </section>

        <section className="mt-8 border-t border-zinc-800 pt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Comentarios</h2>
          <ul className="mt-4 space-y-4">
            {comments.map((c) => (
              <li key={c.id} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <UserAvatar user={c.author} size="sm" />
                  <span className="font-medium text-zinc-300">{c.author.name}</span>
                  <span>{new Date(c.created_at).toLocaleString("es")}</span>
                </div>
                <p className="mt-2 text-sm text-zinc-200">{c.body}</p>
              </li>
            ))}
            {comments.length === 0 && (
              <li className="text-sm text-zinc-600">Aún no hay comentarios</li>
            )}
          </ul>
          <form onSubmit={onAddComment} className="mt-4">
            <textarea
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white"
              rows={3}
              placeholder="Escribe un comentario…"
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
            />
            <button
              type="submit"
              className="mt-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700"
            >
              Publicar
            </button>
          </form>
        </section>

        <section className="mt-8 border-t border-zinc-800 pt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Adjuntos (S3, máx. 10 MB)
          </h2>
          {attachHealth && attachHealth.attachment_storage !== "s3" && attachHealth.attachments_message && (
            <div className="mt-3 flex gap-3 rounded-lg border border-amber-800/50 bg-amber-950/20 px-3 py-2.5">
              <span className="shrink-0 text-amber-400/90" aria-hidden>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              <div className="min-w-0 text-sm">
                <p className="font-medium text-amber-100/95">Almacenamiento de adjuntos</p>
                <p className="mt-0.5 text-amber-100/75">{attachHealth.attachments_message}</p>
              </div>
            </div>
          )}
          {attachActionErr ? (
            <div className="mt-2 flex gap-2 rounded-lg border border-rose-900/40 bg-rose-950/20 px-3 py-2 text-sm text-rose-200">
              <span className="shrink-0 text-rose-400" aria-hidden>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </span>
              <span>{attachActionErr}</span>
            </div>
          ) : null}
          <input
            type="file"
            className="mt-2 text-sm text-zinc-400 enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!attachHealth || attachHealth.attachment_storage !== "s3"}
            onChange={onUpload}
          />
          <ul className="mt-4 space-y-2">
            {attachments.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-sm"
              >
                <span className="text-zinc-300">{a.original_filename}</span>
                <span className="text-xs text-zinc-600">
                  {a.upload_status === "pending"
                    ? "Subiendo…"
                    : `${(a.size_bytes / 1024).toFixed(1)} KB`}{" "}
                  · {a.uploaded_by.name}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-sky-400 hover:underline disabled:opacity-40 disabled:no-underline"
                    disabled={a.upload_status !== "complete"}
                    onClick={() => {
                      setAttachActionErr("");
                      downloadAttachment(a.id, token!, a.original_filename).catch((ex) => {
                        setAttachActionErr(ex instanceof Error ? ex.message : "Error al descargar");
                      });
                    }}
                  >
                    Descargar
                  </button>
                  <button
                    type="button"
                    className="text-rose-400 hover:underline"
                    onClick={() => onDeleteAtt(a.id)}
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8 border-t border-zinc-800 pt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Eliminar ticket</h2>
          <p className="mt-2 text-sm text-zinc-500">
            Quita el ticket de la base de datos y borra los objetos asociados en S3.
          </p>
          {deleteTicketErr ? <p className="mt-2 text-sm text-rose-400">{deleteTicketErr}</p> : null}
          <button
            type="button"
            className="mt-3 rounded-lg border border-rose-900/50 bg-rose-950/40 px-4 py-2 text-sm text-rose-300 hover:bg-rose-950/70"
            onClick={() => void onDeleteTicket()}
          >
            Eliminar ticket
          </button>
        </section>
      </main>
    </>
  );
}
