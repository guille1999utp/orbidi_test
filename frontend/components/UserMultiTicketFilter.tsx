"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { UserBrief } from "@/lib/types";
import { UserAvatar } from "@/components/UserBadge";
import clsx from "clsx";

/** Incluido en `selected` cuando el filtro de asignación incluye tickets sin responsable */
export const ASSIGNEE_FILTER_UNASSIGNED = "__unassigned__";

function FilterAllIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M18 18.72a9.09 9.09 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 1 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"
      />
    </svg>
  );
}

function toggleId(selected: readonly string[], id: string): string[] {
  const set = new Set(selected);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  return [...set];
}

type Variant = "assignee" | "author";

type Props = {
  variant: Variant;
  /** IDs de usuario y, si `variant === "assignee"`, opcionalmente `ASSIGNEE_FILTER_UNASSIGNED` */
  selected: readonly string[];
  onChange: (next: string[]) => void;
  users: UserBrief[];
  label?: string;
  className?: string;
};

export function UserMultiTicketFilter({
  variant,
  selected,
  onChange,
  users,
  label,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const sorted = useMemo(
    () => [...users].sort((a, b) => a.name.localeCompare(b.name, "es")),
    [users],
  );

  const defaultLabel = variant === "assignee" ? "Asignado a" : "Creado por";

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const summary = useMemo(() => {
    if (selected.length === 0) {
      return {
        primary: "Cualquiera",
        secondary: variant === "assignee" ? "Sin filtrar por asignación" : "Sin filtrar por autor",
        previews: [] as { user: UserBrief | null; key: string }[],
      };
    }
    if (selected.length === 1 && selected[0] === ASSIGNEE_FILTER_UNASSIGNED) {
      return {
        primary: "Sin asignar",
        secondary: "Solo sin responsable",
        previews: [{ user: null, key: ASSIGNEE_FILTER_UNASSIGNED }],
      };
    }
    const previews: { user: UserBrief | null; key: string }[] = [];
    for (const id of selected) {
      if (id === ASSIGNEE_FILTER_UNASSIGNED) previews.push({ user: null, key: id });
      else {
        const u = sorted.find((x) => x.id === id);
        if (u) previews.push({ user: u, key: id });
      }
    }
    if (previews.length === 1 && previews[0].user) {
      const u = previews[0].user;
      return { primary: u.name, secondary: u.email ?? "", previews };
    }
    const names = previews.map((p) => (p.user ? p.user.name : "Sin asignar"));
    const head = names.slice(0, 3).join(", ");
    const extra = names.length - 3;
    return {
      primary: `${selected.length} seleccionados`,
      secondary: extra > 0 ? `${head} +${extra}` : head,
      previews: previews.slice(0, 4),
    };
  }, [selected, sorted, variant]);

  return (
    <div ref={rootRef} className={clsx("relative", className)}>
      <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
        {label ?? defaultLabel}
      </span>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full min-w-[220px] max-w-sm items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-left transition hover:border-zinc-700"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {selected.length === 0 ? (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-600 bg-zinc-800/60 text-zinc-400">
              <FilterAllIcon className="h-4 w-4" />
            </div>
          ) : selected.length === 1 && selected[0] !== ASSIGNEE_FILTER_UNASSIGNED ? (
            <UserAvatar user={summary.previews[0]?.user ?? null} size="sm" title={summary.primary} />
          ) : (
            <div className="flex shrink-0 -space-x-2">
              {summary.previews.slice(0, 3).map((p, i) => (
                <div key={p.key} className="ring-2 ring-zinc-900 rounded-full" style={{ zIndex: 3 - i }}>
                  <UserAvatar user={p.user} size="sm" title={p.user?.name ?? "Sin asignar"} />
                </div>
              ))}
              {selected.length > 3 ? (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-700 text-[10px] font-medium text-zinc-200 ring-2 ring-zinc-900">
                  +{selected.length - 3}
                </div>
              ) : null}
            </div>
          )}
          <div className="min-w-0">
            <span className="block truncate text-sm font-medium text-zinc-100">{summary.primary}</span>
            {summary.secondary ? (
              <span className="block truncate text-xs text-zinc-500">{summary.secondary}</span>
            ) : null}
          </div>
        </div>
        <span className="shrink-0 text-xs text-zinc-500" aria-hidden>
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open ? (
        <ul
          className="absolute z-50 mt-1 max-h-72 min-w-full overflow-auto rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl"
          role="listbox"
          aria-multiselectable="true"
        >
          <li>
            <button
              type="button"
              role="option"
              aria-selected={selected.length === 0}
              className={clsx(
                "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-zinc-800",
                selected.length === 0 && "bg-zinc-800/70",
              )}
              onClick={() => onChange([])}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-600 bg-zinc-800/60 text-zinc-400">
                <FilterAllIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-medium text-zinc-200">Todos</span>
                <span className="block text-xs text-zinc-500">Quitar filtro (mostrar todos)</span>
              </div>
            </button>
          </li>
          {variant === "assignee" ? (
            <li>
              <button
                type="button"
                role="option"
                aria-selected={selectedSet.has(ASSIGNEE_FILTER_UNASSIGNED)}
                className={clsx(
                  "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-zinc-800",
                  selectedSet.has(ASSIGNEE_FILTER_UNASSIGNED) && "bg-zinc-800/70",
                )}
                onClick={() => onChange(toggleId(selected, ASSIGNEE_FILTER_UNASSIGNED))}
              >
                <UserAvatar user={null} size="sm" />
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-zinc-200">Sin asignar</span>
                  <span className="block text-xs text-zinc-500">Tickets sin responsable</span>
                </div>
                <span
                  className={clsx(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs",
                    selectedSet.has(ASSIGNEE_FILTER_UNASSIGNED)
                      ? "border-sky-500 bg-sky-600 text-white"
                      : "border-zinc-600 text-transparent",
                  )}
                  aria-hidden
                >
                  ✓
                </span>
              </button>
            </li>
          ) : null}
          {sorted.map((u) => {
            const isOn = selectedSet.has(u.id);
            return (
              <li key={u.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isOn}
                  className={clsx(
                    "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-zinc-800",
                    isOn && "bg-zinc-800/70",
                  )}
                  onClick={() => onChange(toggleId(selected, u.id))}
                >
                  <UserAvatar user={u} size="sm" />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-zinc-200">{u.name}</span>
                    <span className="block truncate text-xs text-zinc-500">{u.email}</span>
                  </div>
                  <span
                    className={clsx(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs",
                      isOn ? "border-sky-500 bg-sky-600 text-white" : "border-zinc-600 text-transparent",
                    )}
                    aria-hidden
                  >
                    ✓
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
