import { anthropic } from "@ai-sdk/anthropic";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { createTicketingTools } from "@/lib/ticketing-tools";

export const maxDuration = 60;

/** Modelos recientes: p. ej. claude-sonnet-4-20250514, claude-haiku-4-5, claude-opus-4-0 */
const ANTHROPIC_MODEL =
  process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-5";

const SYSTEM = `Eres el asistente del sistema de tickets (Ticketing).
Tienes herramientas para listar y leer tickets, listar usuarios, añadir comentarios, asignar responsables, cambiar estado o prioridad, y eliminar tickets.

Reglas:
- Responde siempre en español, de forma breve y clara.
- Usa listTickets o getTicket para obtener UUIDs; no inventes IDs.
- Para asignar, usa listUsers para encontrar el id del usuario si hace falta.
- deleteTicket es irreversible: úsalo solo si el usuario lo pide claramente.
- Tras cada acción exitosa, resume en una frase lo que ocurrió.

Contexto de estados: open=Abierto, in_progress=En progreso, review=En revisión, closed=Cerrado.
Prioridades: low, medium, high, urgent.`;

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return new Response("No autorizado", { status: 401 });
  }
  const token = auth.slice(7).trim();
  if (!token) {
    return new Response("Token vacío", { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      {
        error:
          "Falta ANTHROPIC_API_KEY en el servidor (.env.local del frontend). Obtén una clave en Anthropic y reinicia next dev.",
      },
      { status: 503 },
    );
  }

  let body: { messages: UIMessage[] };
  try {
    body = await req.json();
  } catch {
    return new Response("JSON inválido", { status: 400 });
  }

  const { messages } = body;
  if (!Array.isArray(messages)) {
    return new Response("messages debe ser un array", { status: 400 });
  }

  const tools = createTicketingTools(token);
  const modelMessages = await convertToModelMessages(messages, { tools });

  const result = streamText({
    model: anthropic(ANTHROPIC_MODEL),
    system: SYSTEM,
    messages: modelMessages,
    tools,
    stopWhen: stepCountIs(12),
  });

  return result.toUIMessageStreamResponse();
}
