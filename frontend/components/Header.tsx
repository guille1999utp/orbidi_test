"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { NotificationBell } from "@/components/NotificationBell";

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-4">
        <Link href="/board" className="font-semibold text-white">
          Ticketing
        </Link>
        <div className="flex items-center gap-4">
          <NotificationBell />
          {user && (
            <div className="flex items-center gap-2">
              {user.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatar_url}
                  alt=""
                  className="h-8 w-8 rounded-full"
                />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700 text-xs">
                  {user.name.slice(0, 2)}
                </span>
              )}
              <span className="hidden text-sm text-zinc-300 sm:inline">{user.name}</span>
              <button
                type="button"
                onClick={logout}
                className="text-sm text-zinc-500 hover:text-zinc-300"
              >
                Salir
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
