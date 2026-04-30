import type { UserBrief } from "@/lib/types";

type Size = "sm" | "md";

export function UserBadge({
  user,
  label,
  size = "sm",
  emptyLabel = "Sin asignar",
}: {
  user: UserBrief | null;
  label?: string;
  size?: Size;
  emptyLabel?: string;
}) {
  const dim = size === "md" ? "h-9 w-9 text-xs" : "h-7 w-7 text-[10px]";
  const nameClass = size === "md" ? "text-sm" : "text-xs";

  if (!user) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <div
          className={`flex shrink-0 items-center justify-center rounded-full border border-dashed border-zinc-600 bg-zinc-800/40 ${dim} font-medium text-zinc-500`}
          aria-hidden
        >
          ?
        </div>
        <div className="min-w-0">
          {label ? (
            <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              {label}
            </span>
          ) : null}
          <span className={`block truncate text-zinc-500 ${nameClass}`}>{emptyLabel}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      {user.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.avatar_url}
          alt=""
          className={`shrink-0 rounded-full object-cover ring-1 ring-zinc-700 ${dim}`}
          referrerPolicy="no-referrer"
        />
      ) : (
        <div
          className={`flex shrink-0 items-center justify-center rounded-full bg-zinc-700 font-medium text-zinc-200 ${dim}`}
          aria-hidden
        >
          {user.name.slice(0, 2).toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        {label ? (
          <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            {label}
          </span>
        ) : null}
        <span className={`block truncate font-medium text-zinc-200 ${nameClass}`} title={user.name}>
          {user.name}
        </span>
      </div>
    </div>
  );
}

/** Solo avatar (útil para filas compactas / Kanban) */
export function UserAvatar({
  user,
  size = "sm",
  title,
}: {
  user: UserBrief | null;
  size?: "xs" | "sm";
  title?: string;
}) {
  const dim = size === "xs" ? "h-6 w-6 text-[9px]" : "h-7 w-7 text-[10px]";
  const label = title ?? (user ? user.name : "Sin asignar");

  if (!user) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-full border border-dashed border-zinc-600 bg-zinc-800/40 ${dim} text-zinc-500`}
        title={label}
      >
        ?
      </div>
    );
  }

  if (user.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatar_url}
        alt=""
        title={label}
        className={`shrink-0 rounded-full object-cover ring-1 ring-zinc-700 ${dim}`}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-zinc-700 font-medium text-zinc-200 ${dim}`}
      title={label}
    >
      {user.name.slice(0, 2).toUpperCase()}
    </div>
  );
}
