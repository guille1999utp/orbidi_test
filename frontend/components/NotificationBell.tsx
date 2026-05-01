"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import type { AppNotification } from "@/lib/types";
import { UserAvatar } from "@/components/UserBadge";

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

export function NotificationBell() {
  const router = useRouter();
  const { token, unreadCount, refreshUnread, notificationsOpen, setNotificationsOpen } =
    useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!notificationsOpen || !token) return;
    (async () => {
      const list = await apiFetch<AppNotification[]>("/notifications", token);
      setItems(list);
    })().catch(console.error);
  }, [notificationsOpen, token]);

  useEffect(() => {
    if (!notificationsOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [notificationsOpen, setNotificationsOpen]);

  const markAll = async () => {
    if (!token) return;
    await apiFetch("/notifications/mark-all-read", token, { method: "POST" });
    await refreshUnread();
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const onItemClick = async (n: AppNotification) => {
    if (!token) return;
    try {
      await apiFetch(`/notifications/${n.id}/read`, token, { method: "POST" });
    } catch {
      /* ignore */
    }
    await refreshUnread();
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    setNotificationsOpen(false);
    if (n.ticket_id) {
      sessionStorage.setItem(
        "ticketing_notif_actor",
        JSON.stringify({ ticketId: n.ticket_id, actor: n.actor }),
      );
      router.push(`/tickets/${n.ticket_id}`);
    }
  };

  const totalLabel = items.length;

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setNotificationsOpen(!notificationsOpen)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-zinc-300 hover:bg-zinc-800"
        title="Notificaciones"
        aria-label={unreadCount > 0 ? `Notificaciones, ${unreadCount} sin leer` : "Notificaciones"}
      >
        <BellIcon className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold leading-none text-white">
            {unreadCount > 99 ? "99" : unreadCount}
          </span>
        )}
      </button>
      {notificationsOpen && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-h-[70vh] overflow-auto rounded-lg border border-zinc-800 bg-zinc-900 py-2 shadow-xl">
          <div className="flex items-center justify-between border-b border-zinc-800 px-3 pb-2">
            <span className="text-xs font-medium text-zinc-400">
              Notificaciones
              {totalLabel > 0 ? (
                <span className="ml-1.5 text-zinc-500">({totalLabel})</span>
              ) : null}
            </span>
            <button
              type="button"
              onClick={markAll}
              className="text-xs text-sky-400 hover:underline"
            >
              Marcar leídas
            </button>
          </div>
          <ul className="divide-y divide-zinc-800">
            {items.length === 0 && (
              <li className="px-3 py-4 text-center text-sm text-zinc-500">No hay notificaciones</li>
            )}
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => void onItemClick(n)}
                  className={`flex w-full gap-2 px-3 py-2.5 text-left text-sm transition hover:bg-zinc-800/80 ${
                    n.is_read ? "opacity-70" : "bg-zinc-800/40"
                  }`}
                >
                  <span className="shrink-0 pt-0.5">
                    <UserAvatar user={n.actor} size="sm" title={n.actor?.name ?? "Sistema"} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-3 text-zinc-200">{n.message}</span>
                    <span className="mt-1 block text-xs text-zinc-500">
                      {new Date(n.created_at).toLocaleString("es")}
                      {n.ticket_id ? " · Ver ticket" : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
