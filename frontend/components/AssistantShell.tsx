"use client";

import { useAuth } from "@/lib/auth-context";
import { AssistantPanel } from "@/components/AssistantPanel";

export function AssistantShell({ children }: { children: React.ReactNode }) {
  const { token, refreshTickets } = useAuth();
  return (
    <>
      {children}
      {token ? <AssistantPanel token={token} onActionsDone={refreshTickets} /> : null}
    </>
  );
}
