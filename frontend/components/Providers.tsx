"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "@/lib/auth-context";

const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

export function Providers({ children }: { children: React.ReactNode }) {
  const inner = <AuthProvider>{children}</AuthProvider>;
  if (!clientId) return inner;
  console.log("clientId", clientId);
  return <GoogleOAuthProvider clientId={clientId}>{inner}</GoogleOAuthProvider>;
}
