"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import type { Ticket, TicketPriority, TicketState } from "@/lib/types";
import { STATE_LABELS, PRIORITY_LABELS } from "@/lib/types";

export function CreateTicketModal({ onClose }: { onClose: () => void }) {
  const { token, refreshTickets } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [state, setState] = useState<TicketState>("open");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setErr("");
    setLoading(true);
    try {
      await apiFetch<Ticket>("/tickets", token, {
        method: "POST",
        body: JSON.stringify({
          title,
          description,
          state,
          priority,
        }),
      });
      await refreshTickets();
      onClose();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl"
      >
        <h2 className="text-lg font-semibold text-white">Nuevo ticket</h2>
        <label className="mt-4 block text-sm text-zinc-400">
          Título
          <input
            required
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="mt-3 block text-sm text-zinc-400">
          Descripción
          <textarea
            rows={4}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="text-sm text-zinc-400">
            Estado
            <select
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
              value={state}
              onChange={(e) => setState(e.target.value as TicketState)}
            >
              {(Object.keys(STATE_LABELS) as TicketState[]).map((s) => (
                <option key={s} value={s}>
                  {STATE_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-zinc-400">
            Prioridad
            <select
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TicketPriority)}
            >
              {(Object.keys(PRIORITY_LABELS) as TicketPriority[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </label>
        </div>
        {err && <p className="mt-2 text-sm text-rose-400">{err}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            Crear
          </button>
        </div>
      </form>
    </div>
  );
}
