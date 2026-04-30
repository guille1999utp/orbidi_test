"use client";

import { useEffect, useRef, useState } from "react";
import type { UserBrief } from "@/lib/types";
import { UserAvatar } from "@/components/UserBadge";
import clsx from "clsx";

type Props = {
  users: UserBrief[];
  assigneeId: string | null;
  assignee: UserBrief | null;
  onAssign: (userId: string) => Promise<void>;
};

export function AssigneePicker({ users, assigneeId, assignee, onAssign }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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

  const pick = async (id: string) => {
    if (busy) return;
    if (id === (assigneeId ?? "")) {
      setOpen(false);
      return;
    }
    setBusy(true);
    setOpen(false);
    try {
      await onAssign(id);
    } finally {
      setBusy(false);
    }
  };

  const sortedUsers = [...users].sort((a, b) => a.name.localeCompare(b.name, "es"));

  const current =
    assigneeId != null && assigneeId !== ""
      ? assignee ?? sortedUsers.find((u) => u.id === assigneeId) ?? null
      : null;

  return (
    <div ref={rootRef} className="relative mt-2 w-full max-w-md">
      <button
        type="button"
        disabled={busy}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          "flex w-full items-center justify-between gap-3 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-left transition hover:border-zinc-600",
          busy && "pointer-events-none opacity-60",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <UserAvatar user={current} size="sm" />
          <div className="min-w-0">
            <span className="block truncate text-sm font-medium text-zinc-100">
              {current ? current.name : "Sin asignar"}
            </span>
            {current?.email ? (
              <span className="block truncate text-xs text-zinc-500">{current.email}</span>
            ) : null}
          </div>
        </div>
        <span className="shrink-0 text-xs text-zinc-500" aria-hidden>
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <ul
          className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl"
          role="listbox"
        >
          <li>
            <button
              type="button"
              role="option"
              aria-selected={assigneeId == null || assigneeId === ""}
              className={clsx(
                "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-zinc-800",
                !assigneeId && "bg-zinc-800/70",
              )}
              onClick={() => pick("")}
            >
              <UserAvatar user={null} size="sm" />
              <div className="min-w-0">
                <span className="font-medium text-zinc-200">Sin asignar</span>
                <span className="block text-xs text-zinc-500">Nadie trabaja en este ticket</span>
              </div>
            </button>
          </li>
          {sortedUsers.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                role="option"
                aria-selected={assigneeId === u.id}
                className={clsx(
                  "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-zinc-800",
                  assigneeId === u.id && "bg-zinc-800/70",
                )}
                onClick={() => pick(u.id)}
              >
                <UserAvatar user={u} size="sm" />
                <div className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-zinc-200">{u.name}</span>
                  <span className="block truncate text-xs text-zinc-500">{u.email}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
