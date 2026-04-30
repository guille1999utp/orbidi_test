"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import type { AppNotification } from "@/lib/types";

export function NotificationBell() {
  const { token, unreadCount, refreshUnread, notificationsOpen, setNotificationsOpen } =
    useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (!notificationsOpen || !token) return;
    (async () => {
      const list = await apiFetch<AppNotification[]>("/notifications", token);
      setItems(list);
    })().catch(console.error);
  }, [notificationsOpen, token]);

  const markAll = async () => {
    if (!token) return;
    await apiFetch("/notifications/mark-all-read", token, { method: "POST" });
    await refreshUnread();
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setNotificationsOpen(!notificationsOpen)}
        className="relative rounded-lg px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
      >
        Alertas
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-xs font-medium text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      {notificationsOpen && (
        <div className="absolute right-0 mt-2 w-80 max-h-[70vh] overflow-auto rounded-lg border border-zinc-800 bg-zinc-900 py-2 shadow-xl">
          <div className="flex items-center justify-between border-b border-zinc-800 px-3 pb-2">
            <span className="text-xs font-medium text-zinc-400">Notificaciones</span>
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
              <li className="px-3 py-4 text-sm text-zinc-500">Sin alertas</li>
            )}
            {items.map((n) => (
              <li
                key={n.id}
                className={`px-3 py-2 text-sm ${n.is_read ? "opacity-60" : "bg-zinc-800/50"}`}
              >
                <p className="text-zinc-200">{n.message}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {new Date(n.created_at).toLocaleString("es")}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
