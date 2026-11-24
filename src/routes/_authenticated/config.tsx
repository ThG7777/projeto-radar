import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, CircleDashed, X } from "lucide-react";
import { AppShell } from "@/components/radar/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { settingsQuery } from "@/lib/queries";
import { getIntegrationStatus } from "@/lib/offers.functions";

export const Route = createFileRoute("/_authenticated/config")({
  head: () => ({
    meta: [
      { title: "Configurações · Radar de Ofertas" },
      { name: "description", content: "Filtros de promoção, palavras de busca e integrações." },
      { property: "og:title", content: "Configurações · Radar de Ofertas" },
      { property: "og:description", content: "Filtros de promoção, palavras de busca e integrações." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <Config />
    </AppShell>
  ),
});

type Form = {
  brand_name: string;
  min_discount: string;
  min_sales: string;
  min_rating: string;
  min_price: string;
  max_price: string;
  daily_target: string;
};

function Config() {
  const qc = useQueryClient();
  const statusFn = useServerFn(getIntegrationStatus);
  const { data: settings } = useQuery(settingsQuery);
  const { data: status } = useQuery({ queryKey: ["integrations"], queryFn: () => statusFn() });
  const [form, setForm] = useState<Form | null>(null);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [kw, setKw] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setForm({
      brand_name: settings.brand_name,
      min_discount: String(settings.min_discount),
      min_sales: String(settings.min_sales),
      min_rating: String(settings.min_rating),
      min_price: String(settings.min_price),
      max_price: String(settings.max_price),
      daily_target: String(settings.daily_target),
    });
    setKeywords(settings.keywords);
  }, [settings]);

  if (!form) return <div className="py-16 text-center text-muted-foreground">Carregando…</div>;
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    const n = (s: string) => Number(s.replace(",", "."));
    const { error } = await supabase
      .from("app_settings")
      .update({
        brand_name: form.brand_name.trim() || "Radar de Ofertas",
        min_discount: Math.round(n(form.min_discount)),
        min_sales: Math.round(n(form.min_sales)),
        min_rating: n(form.min_rating),
        min_price: n(form.min_price),
        max_price: n(form.max_price),
        daily_target: Math.round(n(form.daily_target)),
        keywords,
      })
      .eq("id", 1);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Configurações salvas.");
    qc.invalidateQueries({ queryKey: ["settings"] });
  }

  const field = (id: keyof Form, label: string, hint?: string) => (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} inputMode="decimal" value={form[id]} onChange={set(id)} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <form onSubmit={save} className="space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold">Configurações</h1>
          <p className="mt-1 text-muted-foreground">O que conta como “promoção boa” para o seu radar.</p>
        </div>

        <section className="grid gap-4 rounded-2xl border bg-card p-5 md:grid-cols-2">
          <div className="grid gap-1.5 md:col-span-2">
            <Label htmlFor="brand_name">Nome nos banners e posts</Label>
            <Input id="brand_name" value={form.brand_name} onChange={set("brand_name")} />
          </div>
          {field("min_discount", "Desconto mínimo (%)")}
          {field("min_sales", "Vendas mínimas", "Produtos com menos vendas são ignorados.")}
          {field("min_rating", "Nota mínima", "De 0 a 5.")}
          {field("daily_target", "Meta de posts por dia")}
          {field("min_price", "Preço mínimo (R$)")}
          {field("max_price", "Preço máximo (R$)")}
        </section>

        <section className="space-y-3 rounded-2xl border bg-card p-5">
          <div>
            <h2 className="text-lg font-bold">Palavras de busca</h2>
            <p className="text-sm text-muted-foreground">O garimpo procura os mais vendidos de cada uma.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {keywords.map((k) => (
              <span key={k} className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm">
                {k}
                <button type="button" aria-label={`Remover ${k}`} onClick={() => setKeywords(keywords.filter((x) => x !== k))}>
                  <X className="size-3.5 text-muted-foreground hover:text-foreground" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Nova palavra (ex.: organizador)"
              value={kw}
              onChange={(e) => setKw(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const v = kw.trim().toLowerCase();
                  if (v && !keywords.includes(v)) setKeywords([...keywords, v]);
                  setKw("");
                }
              }}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const v = kw.trim().toLowerCase();
                if (v && !keywords.includes(v)) setKeywords([...keywords, v]);
                setKw("");
              }}
            >
              Adicionar
            </Button>
          </div>
        </section>

        <Button type="submit" variant="hero" size="lg" disabled={saving}>
          Salvar configurações
        </Button>
      </form>

      <aside className="h-fit space-y-4 rounded-2xl border bg-card p-5">
        <h2 className="text-lg font-bold">Integrações</h2>
        <Integration ok={Boolean(status?.bot)} name="Telegram" detail={status?.bot ? `@${status.bot.username}` : "Não conectado"} />
        <Integration
          ok={Boolean(status?.shopee)}
          name="Shopee (afiliados)"
          detail={status?.shopee ? "API conectada" : "Falta o App ID e o Secret da Open API"}
        />
        <Integration ok={false} name="Mercado Livre" detail="Próxima fase · por enquanto use “Adicionar oferta”" />
        <Integration ok={false} name="WhatsApp" detail="Próxima fase" />
      </aside>
    </div>
  );
}

function Integration({ ok, name, detail }: { ok: boolean; name: string; detail: string }) {
  return (
    <div className="flex items-start gap-3">
      {ok ? <CheckCircle2 className="mt-0.5 size-5 text-success" /> : <CircleDashed className="mt-0.5 size-5 text-muted-foreground" />}
      <div>
        <p className="font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}
