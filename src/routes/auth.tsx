import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { LovableMark } from "@lovable.dev/cloud-auth-js/react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brand } from "@/components/radar/RadarMark";

const search = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => search.parse(s),
  head: () => ({
    meta: [
      { title: "Entrar · Radar de Ofertas" },
      { name: "description", content: "Acesse o painel do Radar de Ofertas." },
      { property: "og:title", content: "Entrar · Radar de Ofertas" },
      { property: "og:description", content: "Acesse o painel do Radar de Ofertas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function safeRedirect(r: string | undefined) {
  if (!r) return "/painel";
  try {
    const u = new URL(r, window.location.origin);
    if (u.origin !== window.location.origin || u.pathname.startsWith("/auth")) return "/painel";
    return u.pathname + u.search;
  } catch {
    return "/painel";
  }
}

function GoogleLogo() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
    </svg>
  );
}

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: safeRedirect(redirect), replace: true });
    });
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: safeRedirect(redirect), replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate, redirect]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/painel" },
        });
        if (error) throw error;
        if (!data.session) setCheckEmail(true);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg.includes("Invalid login") ? "E-mail ou senha incorretos." : msg);
    } finally {
      setBusy(false);
    }
  }

  async function social(provider: "google" | "lovable") {
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin + "/auth" });
    if (result.error) toast.error("Não foi possível entrar agora. Tente de novo.");
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Brand />
        </div>
        <div className="rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)]">
          {checkEmail ? (
            <div className="space-y-2 text-center">
              <h1 className="text-xl font-bold">Confira seu e-mail</h1>
              <p className="text-sm text-muted-foreground">
                Enviamos um link de confirmação para <b className="text-foreground">{email}</b>. Clique nele para entrar.
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold">{mode === "signin" ? "Entrar no painel" : "Criar conta"}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === "signin" ? "Bem-vindo de volta ao radar." : "A primeira conta criada vira a dona do painel."}
              </p>
              <div className="mt-6 grid gap-2">
                <Button type="button" variant="outline" onClick={() => social("google")}>
                  <GoogleLogo />
                  Continuar com Google
                </Button>
                <Button type="button" variant="outline" onClick={() => social("lovable")}>
                  <LovableMark />
                  Continuar com Lovable
                </Button>
              </div>
              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> ou com e-mail <span className="h-px flex-1 bg-border" />
              </div>
              <form onSubmit={submit} className="grid gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="password">Senha</Label>
                  <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" variant="hero" size="lg" disabled={busy}>
                  {busy ? "Aguarde…" : mode === "signin" ? "Entrar" : "Criar conta"}
                </Button>
              </form>
              <button
                type="button"
                className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              >
                {mode === "signin" ? "Ainda não tem conta? Criar conta" : "Já tem conta? Entrar"}
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
