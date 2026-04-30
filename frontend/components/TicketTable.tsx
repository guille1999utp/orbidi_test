"use client";

import Link from "next/link";
import type { Ticket } from "@/lib/types";
import { PRIORITY_LABELS, STATE_LABELS } from "@/lib/types";
import clsx from "clsx";

export function TicketTable({
  tickets,
  sort,
  order,
  onSort,
}: {
  tickets: Ticket[];
  sort: string;
  order: "asc" | "desc";
  onSort: (field: typeof sort) => void;
}) {
  const head = (label: string, field: string) => (
    <th className="px-3 py-2 text-left">
      <button
        type="button"
        className="font-medium text-zinc-400 hover:text-white"
        onClick={() => onSort(field)}
      >
        {label}
        {sort === field && (order === "asc" ? " ↑" : " ↓")}
      </button>
    </th>
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800">
      <table className="w-full text-sm">
        <thead className="border-b border-zinc-800 bg-zinc-900/80">
          <tr>
            {head("Título", "title")}
            {head("Estado", "state")}
            {head("Prioridad", "priority")}
            <th className="px-3 py-2 text-left font-medium text-zinc-400">Autor</th>
            <th className="px-3 py-2 text-left font-medium text-zinc-400">Asignado</th>
            {head("Actualizado", "updated_at")}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {tickets.map((t) => (
            <tr key={t.id} className="hover:bg-zinc-900/50">
              <td className="px-3 py-2">
                <Link href={`/tickets/${t.id}`} className="font-medium text-sky-400 hover:underline">
                  {t.title}
                </Link>
              </td>
              <td className="px-3 py-2">{STATE_LABELS[t.state]}</td>
              <td className="px-3 py-2">
                <span
                  className={clsx(
                    "rounded px-2 py-0.5 text-xs",
                    t.priority === "urgent" && "bg-rose-950 text-rose-300",
                    t.priority === "high" && "bg-orange-950 text-orange-300",
                    t.priority === "medium" && "bg-zinc-800 text-zinc-300",
                    t.priority === "low" && "bg-zinc-800/50 text-zinc-400",
                  )}
                >
                  {PRIORITY_LABELS[t.priority]}
                </span>
              </td>
              <td className="px-3 py-2 text-zinc-400">{t.author.name}</td>
              <td className="px-3 py-2 text-zinc-400">{t.assignee?.name ?? "—"}</td>
              <td className="px-3 py-2 text-zinc-500">
                {new Date(t.updated_at).toLocaleString("es")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
