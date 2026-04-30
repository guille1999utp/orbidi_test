"use client";

import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import Link from "next/link";
import type { Ticket, TicketState } from "@/lib/types";
import { PRIORITY_LABELS, STATE_LABELS, STATE_ORDER } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import clsx from "clsx";

function Card({ ticket }: { ticket: Ticket }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: ticket.id,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        "rounded-lg border border-zinc-800 bg-zinc-900 p-3 shadow-sm transition",
        isDragging && "opacity-50 ring-2 ring-sky-600",
      )}
    >
      <div className="flex gap-2">
        <button
          type="button"
          className="mt-0.5 cursor-grab touch-none text-zinc-600 hover:text-zinc-400"
          aria-label="Arrastrar"
          {...listeners}
          {...attributes}
        >
          ⠿
        </button>
        <div className="min-w-0 flex-1">
          <Link href={`/tickets/${ticket.id}`} className="font-medium text-sky-400 hover:underline">
            {ticket.title}
          </Link>
          <p className="mt-1 text-xs text-zinc-500">{PRIORITY_LABELS[ticket.priority]}</p>
        </div>
      </div>
    </div>
  );
}

function Column({ state, tickets }: { state: TicketState; tickets: Ticket[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: state });
  return (
    <div
      ref={setNodeRef}
      className={clsx(
        "flex min-h-[320px] w-72 shrink-0 flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3",
        isOver && "ring-2 ring-sky-600/50",
      )}
    >
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {STATE_LABELS[state]}{" "}
        <span className="font-normal text-zinc-600">({tickets.length})</span>
      </h3>
      <div className="flex flex-1 flex-col gap-2">
        {tickets.map((t) => (
          <Card key={t.id} ticket={t} />
        ))}
      </div>
    </div>
  );
}

export function KanbanBoard({ tickets: initial }: { tickets: Ticket[] }) {
  const { token, mergeTicket } = useAuth();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const onDragEnd = async (e: DragEndEvent) => {
    const tid = e.active.id as string;
    const over = e.over?.id as TicketState | undefined;
    if (!over || !token) return;
    const t = initial.find((x) => x.id === tid);
    if (!t || t.state === over) return;
    const updated = await apiFetch<Ticket>(`/tickets/${tid}`, token, {
      method: "PATCH",
      body: JSON.stringify({ state: over }),
    });
    mergeTicket(updated);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STATE_ORDER.map((state) => (
          <Column
            key={state}
            state={state}
            tickets={initial.filter((t) => t.state === state)}
          />
        ))}
      </div>
    </DndContext>
  );
}
