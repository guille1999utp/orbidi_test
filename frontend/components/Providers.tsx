"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "@/lib/auth-context";
import { AssistantShell } from "@/components/AssistantShell";

const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

export function Providers({ children }: { children: React.ReactNode }) {
  const inner = (
    <AuthProvider>
      <AssistantShell>{children}</AssistantShell>
    </AuthProvider>
  );
  if (!clientId) return inner;
  return <GoogleOAuthProvider clientId={clientId}>{inner}</GoogleOAuthProvider>;
}
