"use client";

import { GoogleLogin } from "@react-oauth/google";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";

export default function LoginPage() {
  const { loginWithGoogleCredential, token } = useAuth();
  const router = useRouter();

  const onSuccess = useCallback(
    async (cred: string | undefined) => {
      if (!cred) return;
      await loginWithGoogleCredential(cred);
      router.replace("/board");
    },
    [loginWithGoogleCredential, router],
  );

  useEffect(() => {
    if (token) router.replace("/board");
  }, [token, router]);

  if (token) return null;

  const hasGoogle = !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Ticketing</h1>
        <p className="mt-2 text-zinc-400">Inicia sesión con Google para continuar</p>
      </div>
      {!hasGoogle ? (
        <p className="max-w-md text-center text-sm text-amber-400">
          No hay Client ID de Google en el front (no llegó al bundle de esta compilación). En{" "}
          <code className="text-amber-200">frontend/.env.local</code> define{" "}
          <code className="text-amber-200">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> con el{" "}
          <strong>mismo valor</strong> que <code className="text-amber-200">GOOGLE_CLIENT_ID</code> en
          el backend; con Docker ejecuta{" "}
          <code className="text-amber-200">docker compose build --no-cache frontend</code> y vuelve a
          levantar.
        </p>
      ) : (
        <GoogleLogin
          onSuccess={(c) => onSuccess(c.credential)}
          onError={() => console.error("Login fallido")}
          useOneTap={false}
          type="standard"
          theme="outline"
          size="large"
          text="signin_with"
          shape="rectangular"
          logo_alignment="left"
        />
      )}
      <Link href="/board" className="text-sm text-zinc-500 hover:text-zinc-300">
        Ir al tablero (requiere sesión)
      </Link>
    </div>
  );
}
