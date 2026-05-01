"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { TicketTable } from "@/components/TicketTable";
import { KanbanBoard } from "@/components/KanbanBoard";
import { CreateTicketModal } from "@/components/CreateTicketModal";
import { UserMultiTicketFilter, ASSIGNEE_FILTER_UNASSIGNED } from "@/components/UserMultiTicketFilter";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import type { TicketPriority, TicketState, UserBrief } from "@/lib/types";
import { STATE_LABELS, PRIORITY_LABELS } from "@/lib/types";

type View = "list" | "kanban";

export default function BoardPage() {
  const { token, user, tickets } = useAuth();
  const router = useRouter();
  const [view, setView] = useState<View>("list");
  const [q, setQ] = useState("");
  const [stateF, setStateF] = useState<TicketState | "">("");
  const [priorityF, setPriorityF] = useState<TicketPriority | "">("");
  const [assigneeFilterIds, setAssigneeFilterIds] = useState<string[]>([]);
  const [authorFilterIds, setAuthorFilterIds] = useState<string[]>([]);
  const [sort, setSort] = useState<string>("updated_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [createOpen, setCreateOpen] = useState(false);
  const [usersForAssigneeFilter, setUsersForAssigneeFilter] = useState<UserBrief[]>([]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const u = await apiFetch<UserBrief[]>("/users", token);
        if (!cancelled) setUsersForAssigneeFilter(u);
      } catch {
        if (!cancelled) setUsersForAssigneeFilter([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const filterUsers = useMemo(() => {
    if (usersForAssigneeFilter.length > 0) return usersForAssigneeFilter;
    const map = new Map<string, UserBrief>();
    for (const t of tickets) {
      if (t.assignee) map.set(t.assignee.id, t.assignee);
      if (t.author) map.set(t.author.id, t.author);
    }
    return [...map.values()];
  }, [usersForAssigneeFilter, tickets]);
  const filtered = useMemo(() => {
    let list = [...tickets];
    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(s) ||
          (t.description || "").toLowerCase().includes(s),
      );
    }
    if (stateF) list = list.filter((t) => t.state === stateF);
    if (priorityF) list = list.filter((t) => t.priority === priorityF);
    if (assigneeFilterIds.length > 0) {
      const wantUnassigned = assigneeFilterIds.includes(ASSIGNEE_FILTER_UNASSIGNED);
      const assigneeIds = new Set(assigneeFilterIds.filter((id) => id !== ASSIGNEE_FILTER_UNASSIGNED));
      list = list.filter(
        (t) => (wantUnassigned && !t.assignee_id) || (!!t.assignee_id && assigneeIds.has(t.assignee_id)),
      );
    }
    if (authorFilterIds.length > 0) {
      const authorSet = new Set(authorFilterIds);
      list = list.filter((t) => authorSet.has(t.author_id));
    }
    list.sort((a, b) => {
      let cmp = 0;
      if (sort === "title") cmp = a.title.localeCompare(b.title);
      else if (sort === "priority") cmp = a.priority.localeCompare(b.priority);
      else if (sort === "state") cmp = a.state.localeCompare(b.state);
      else if (sort === "created_at")
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      else cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      return order === "asc" ? cmp : -cmp;
    });
    return list;
  }, [tickets, q, stateF, priorityF, assigneeFilterIds, authorFilterIds, sort, order]);

  useEffect(() => {
    if (!token || !user) router.replace("/login");
  }, [token, user, router]);

  if (!token || !user) return null;

  const onSort = (field: string) => {
    if (sort === field) setOrder(order === "asc" ? "desc" : "asc");
    else {
      setSort(field);
      setOrder("desc");
    }
  };

  return (
    <>
      <Header />
      <main className="mx-auto max-w-[1600px] px-4 py-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Tablero</h1>
            <p className="text-sm text-zinc-500">Lista y Kanban comparten los mismos tickets</p>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
          >
            Nuevo ticket
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="flex rounded-lg border border-zinc-800 p-0.5">
            <button
              type="button"
              onClick={() => setView("list")}
              className={`rounded-md px-3 py-1.5 text-sm ${view === "list" ? "bg-zinc-800 text-white" : "text-zinc-400"}`}
            >
              Lista
            </button>
            <button
              type="button"
              onClick={() => setView("kanban")}
              className={`rounded-md px-3 py-1.5 text-sm ${view === "kanban" ? "bg-zinc-800 text-white" : "text-zinc-400"}`}
            >
              Kanban
            </button>
          </div>
          <input
            placeholder="Buscar…"
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-white placeholder:text-zinc-600"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-white"
            value={stateF}
            onChange={(e) => setStateF(e.target.value as TicketState | "")}
          >
            <option value="">Todos los estados</option>
            {(Object.keys(STATE_LABELS) as TicketState[]).map((s) => (
              <option key={s} value={s}>
                {STATE_LABELS[s]}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-white"
            value={priorityF}
            onChange={(e) => setPriorityF(e.target.value as TicketPriority | "")}
          >
            <option value="">Todas las prioridades</option>
            {(Object.keys(PRIORITY_LABELS) as TicketPriority[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
          <UserMultiTicketFilter
            variant="assignee"
            className="shrink-0"
            selected={assigneeFilterIds}
            onChange={setAssigneeFilterIds}
            users={filterUsers}
            label="Asignado a"
          />
          <UserMultiTicketFilter
            variant="author"
            className="shrink-0"
            selected={authorFilterIds}
            onChange={setAuthorFilterIds}
            users={filterUsers}
            label="Creado por"
          />
        </div>

        {view === "list" ? (
          <TicketTable tickets={filtered} sort={sort} order={order} onSort={onSort} />
        ) : (
          <KanbanBoard tickets={filtered} />
        )}
      </main>
      {createOpen && <CreateTicketModal onClose={() => setCreateOpen(false)} />}
    </>
  );
}
