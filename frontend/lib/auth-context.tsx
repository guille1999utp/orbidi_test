"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Ticket, UserBrief } from "@/lib/types";
import { apiFetch, wsUrl } from "@/lib/api";

const STORAGE_KEY = "ticketing_token";

type AuthContextValue = {
  token: string | null;
  user: UserBrief | null;
  loginWithGoogleCredential: (credential: string) => Promise<void>;
  logout: () => void;
  tickets: Ticket[];
  setTickets: React.Dispatch<React.SetStateAction<Ticket[]>>;
  mergeTicket: (t: Ticket) => void;
  refreshTickets: () => Promise<void>;
  unreadCount: number;
  refreshUnread: () => Promise<void>;
  notificationsOpen: boolean;
  setNotificationsOpen: (v: boolean) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserBrief | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem(STORAGE_KEY);
    const u = localStorage.getItem("ticketing_user");
    if (t) setToken(t);
    if (u)
      try {
        setUser(JSON.parse(u));
      } catch {
        /* ignore */
      }
    setHydrated(true);
  }, []);

  const refreshTickets = useCallback(async () => {
    if (!token) return;
    const data = await apiFetch<Ticket[]>("/tickets", token);
    setTickets(data);
  }, [token]);

  const refreshUnread = useCallback(async () => {
    if (!token) return;
    const { count } = await apiFetch<{ count: number }>(
      "/notifications/unread-count",
      token,
    );
    setUnreadCount(count);
  }, [token]);

  const mergeTicket = useCallback((t: Ticket) => {
    setTickets((prev) => {
      const i = prev.findIndex((x) => x.id === t.id);
      if (i === -1) return [t, ...prev];
      const next = [...prev];
      next[i] = t;
      return next;
    });
  }, []);

  useEffect(() => {
    if (!token || !hydrated) return;
    refreshTickets();
    refreshUnread();
  }, [token, hydrated, refreshTickets, refreshUnread]);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    let ws: WebSocket | null = null;
    const connect = () => {
      ws = new WebSocket(wsUrl(token));
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string) as {
            type: string;
            payload?: { ticket?: Ticket };
          };
          if (msg.type === "ticket_updated" && msg.payload?.ticket) {
            mergeTicket(msg.payload.ticket);
          }
          if (msg.type === "notifications_changed") {
            refreshUnread();
          }
        } catch {
          /* ignore */
        }
      };
      ws.onclose = () => {
        if (alive) setTimeout(connect, 2000);
      };
    };
    connect();
    return () => {
      alive = false;
      ws?.close();
    };
  }, [token, mergeTicket, refreshUnread]);

  const loginWithGoogleCredential = async (credential: string) => {
    const res = await apiFetch<{ access_token: string; user: UserBrief }>(
      "/auth/google",
      null,
      {
        method: "POST",
        body: JSON.stringify({ credential }),
      },
    );
    setToken(res.access_token);
    setUser(res.user);
    localStorage.setItem(STORAGE_KEY, res.access_token);
    localStorage.setItem("ticketing_user", JSON.stringify(res.user));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setTickets([]);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("ticketing_user");
  };

  const value = useMemo(
    () => ({
      token,
      user,
      loginWithGoogleCredential,
      logout,
      tickets,
      setTickets,
      mergeTicket,
      refreshTickets,
      unreadCount,
      refreshUnread,
      notificationsOpen,
      setNotificationsOpen,
    }),
    [
      token,
      user,
      tickets,
      mergeTicket,
      refreshTickets,
      unreadCount,
      refreshUnread,
      notificationsOpen,
    ],
  );

  if (!hydrated) return null;

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth dentro de AuthProvider");
  return ctx;
}
