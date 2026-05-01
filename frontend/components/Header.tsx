"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { NotificationBell } from "@/components/NotificationBell";

function LogOutIcon({ className }: { className?: string }) {
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
        d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0-3-3m0 0-3 3m3-3h12.75"
      />
    </svg>
  );
}

export function Header() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const onLogout = () => {
    logout();
    router.replace("/login");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-4">
        <Link href="/board" className="font-semibold text-white">
          Ticketing
        </Link>
        <div className="flex items-center gap-3 sm:gap-4">
          <NotificationBell />
          {user ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden h-6 w-px bg-zinc-800 sm:block" aria-hidden />
              <div className="flex min-w-0 max-w-[200px] items-center gap-2">
                {user.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatar_url}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded-full ring-1 ring-zinc-700"
                  />
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-xs font-medium text-zinc-200 ring-1 ring-zinc-600">
                    {user.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <span className="hidden truncate text-sm text-zinc-300 sm:inline" title={user.name}>
                  {user.name}
                </span>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="flex shrink-0 items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-sm font-medium text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800 hover:text-white"
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
              >
                <LogOutIcon className="h-4 w-4" />
                <span>Salir</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
