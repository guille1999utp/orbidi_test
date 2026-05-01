/** Types aligned with FastAPI backend */

export type TicketState = "open" | "in_progress" | "review" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";

export interface UserBrief {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  author_id: string;
  assignee_id: string | null;
  state: TicketState;
  priority: TicketPriority;
  created_at: string;
  updated_at: string;
  author: UserBrief;
  assignee: UserBrief | null;
}

export interface Comment {
  id: string;
  ticket_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author: UserBrief;
}

export interface Attachment {
  id: string;
  ticket_id: string;
  original_filename: string;
  storage_backend: string;
  upload_status: string;
  content_type: string | null;
  size_bytes: number;
  created_at: string;
  uploaded_by: UserBrief;
}

export interface AppNotification {
  id: string;
  ticket_id: string | null;
  type: "assigned" | "comment" | "status_change";
  message: string;
  is_read: boolean;
  created_at: string;
}

export const STATE_LABELS: Record<TicketState, string> = {
  open: "Abierto",
  in_progress: "En progreso",
  review: "En revisión",
  closed: "Cerrado",
};

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

export const STATE_ORDER: TicketState[] = ["open", "in_progress", "review", "closed"];
