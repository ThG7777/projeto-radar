import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, Radio, Settings, Tag } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Brand } from "./RadarMark";
import { isAdminQuery } from "@/lib/queries";

const nav = [
  { to: "/painel", label: "Ofertas", icon: Tag },
  { to: "/destinos", label: "Destinos", icon: Radio },
  { to: "/config", label: "Configurações", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery(isAdminQuery);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 md:px-6">
          <Link to="/painel">
            <Brand />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "bg-secondary text-foreground" }}
              >
                <n.icon className="size-4" />
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground lg:inline">{data?.email}</span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut /> Sair
            </Button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-4 pb-2 md:hidden">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-muted-foreground"
              activeProps={{ className: "bg-secondary text-foreground" }}
            >
              <n.icon className="size-4" />
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        {isLoading ? (
          <div className="py-24 text-center text-muted-foreground">Carregando…</div>
        ) : data?.isAdmin ? (
          children
        ) : (
          <div className="mx-auto max-w-md rounded-2xl border bg-card p-8 text-center">
            <h1 className="text-xl font-bold">Sem acesso ao painel</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sua conta foi criada, mas só a dona do painel pode usá-lo. Peça para ela liberar seu acesso.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
