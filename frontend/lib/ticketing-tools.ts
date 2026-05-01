import { tool } from "ai";
import { z } from "zod";
import { assistantFetch } from "@/lib/assistant-server-fetch";
import type { Ticket, TicketState, TicketPriority, UserBrief } from "@/lib/types";

const ticketStateZ = z.enum(["open", "in_progress", "review", "closed"] satisfies TicketState[]);
const ticketPriorityZ = z.enum(["low", "medium", "high", "urgent"] satisfies TicketPriority[]);

function summarizeTicket(t: Ticket) {
  return {
    id: t.id,
    title: t.title,
    state: t.state,
    priority: t.priority,
    assignee: t.assignee ? { id: t.assignee.id, name: t.assignee.name } : null,
    author: { id: t.author.id, name: t.author.name },
  };
}

export function createTicketingTools(token: string) {
  return {
    listTickets: tool({
      description:
        "Lista tickets. Opcionalmente filtra por texto en título o descripción (q). Devuelve id, título, estado, prioridad y asignado.",
      inputSchema: z.object({
        query: z
          .string()
          .optional()
          .describe("Texto para buscar en título o descripción del ticket"),
      }),
      execute: async ({ query }) => {
        try {
          const q = query?.trim();
          const path = q ? `/tickets?q=${encodeURIComponent(q)}` : "/tickets";
          const rows = await assistantFetch<Ticket[]>(path, token);
          return rows.map(summarizeTicket);
        } catch (e) {
          return { error: e instanceof Error ? e.message : String(e) };
        }
      },
    }),

    getTicket: tool({
      description: "Obtiene un ticket por su id (UUID) con título, descripción, estado, prioridad, autor y asignado.",
      inputSchema: z.object({
        ticketId: z.string().uuid().describe("UUID del ticket"),
      }),
      execute: async ({ ticketId }) => {
        try {
          const t = await assistantFetch<Ticket>(`/tickets/${ticketId}`, token);
          return {
            ...summarizeTicket(t),
            description: t.description,
          };
        } catch (e) {
          return { error: e instanceof Error ? e.message : String(e) };
        }
      },
    }),

    listUsers: tool({
      description: "Lista usuarios del sistema con id, nombre y email. Necesario para asignar por id.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const users = await assistantFetch<UserBrief[]>("/users", token);
          return users.map((u) => ({ id: u.id, name: u.name, email: u.email }));
        } catch (e) {
          return { error: e instanceof Error ? e.message : String(e) };
        }
      },
    }),

    addComment: tool({
      description: "Añade un comentario a un ticket. El autor es el usuario de la sesión actual.",
      inputSchema: z.object({
        ticketId: z.string().uuid(),
        body: z.string().min(1).describe("Texto del comentario"),
      }),
      execute: async ({ ticketId, body }) => {
        try {
          const c = await assistantFetch<{ id: string; body: string; created_at: string }>(
            `/tickets/${ticketId}/comments`,
            token,
            { method: "POST", body: JSON.stringify({ body }) },
          );
          return { ok: true as const, commentId: c.id, ticketId, preview: c.body.slice(0, 120) };
        } catch (e) {
          return { error: e instanceof Error ? e.message : String(e) };
        }
      },
    }),

    assignTicket: tool({
      description: "Asigna un ticket a un usuario por su id (UUID). Usa listUsers si no conoces el id.",
      inputSchema: z.object({
        ticketId: z.string().uuid(),
        assigneeUserId: z.string().uuid().describe("UUID del usuario asignado"),
      }),
      execute: async ({ ticketId, assigneeUserId }) => {
        try {
          const t = await assistantFetch<Ticket>(`/tickets/${ticketId}`, token, {
            method: "PATCH",
            body: JSON.stringify({ assignee_id: assigneeUserId }),
          });
          return { ok: true as const, ticket: summarizeTicket(t) };
        } catch (e) {
          return { error: e instanceof Error ? e.message : String(e) };
        }
      },
    }),

    updateTicket: tool({
      description: "Actualiza estado y/o prioridad de un ticket.",
      inputSchema: z.object({
        ticketId: z.string().uuid(),
        state: ticketStateZ.optional(),
        priority: ticketPriorityZ.optional(),
      }),
      execute: async ({ ticketId, state, priority }) => {
        try {
          const body: Record<string, unknown> = {};
          if (state !== undefined) body.state = state;
          if (priority !== undefined) body.priority = priority;
          if (Object.keys(body).length === 0) {
            return { error: "Debes indicar state y/o priority" };
          }
          const t = await assistantFetch<Ticket>(`/tickets/${ticketId}`, token, {
            method: "PATCH",
            body: JSON.stringify(body),
          });
          return { ok: true as const, ticket: summarizeTicket(t) };
        } catch (e) {
          return { error: e instanceof Error ? e.message : String(e) };
        }
      },
    }),

    deleteTicket: tool({
      description:
        "Elimina permanentemente un ticket (y adjuntos asociados en el servidor). Solo cuando el usuario lo pide de forma explícita.",
      inputSchema: z.object({
        ticketId: z.string().uuid(),
      }),
      execute: async ({ ticketId }) => {
        try {
          await assistantFetch(`/tickets/${ticketId}`, token, { method: "DELETE" });
          return { ok: true as const, deletedTicketId: ticketId };
        } catch (e) {
          return { error: e instanceof Error ? e.message : String(e) };
        }
      },
    }),
  };
}

export type TicketingTools = ReturnType<typeof createTicketingTools>;
