import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Radar, Search } from "lucide-react";
import { AppShell } from "@/components/radar/AppShell";
import { OfferCard } from "@/components/radar/OfferCard";
import { OfferEditor } from "@/components/radar/OfferEditor";
import { ManualOfferDialog } from "@/components/radar/ManualOfferDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { offerCountsQuery, offersQuery, settingsQuery, type Offer, type OfferStatus } from "@/lib/queries";
import { searchShopee } from "@/lib/offers.functions";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Ofertas · Radar das Ofertas" },
      { name: "description", content: "Fila de ofertas garimpadas para aprovar e postar." },
      { property: "og:title", content: "Ofertas · Radar das Ofertas" },
      { property: "og:description", content: "Fila de ofertas garimpadas para aprovar e postar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <Painel />
    </AppShell>
  ),
});

const tabs: { value: OfferStatus; label: string }[] = [
  { value: "new", label: "Novas" },
  { value: "approved", label: "Aprovadas" },
  { value: "posted", label: "Postadas" },
  { value: "rejected", label: "Descartadas" },
];

function Painel() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<OfferStatus>("new");
  const [keyword, setKeyword] = useState("");
  const [searching, setSearching] = useState(false);
  const [editing, setEditing] = useState<Offer | null>(null);
  const search = useServerFn(searchShopee);

  const { data: settings } = useQuery(settingsQuery);
  const { data: counts } = useQuery(offerCountsQuery);
  const { data: offers, isLoading } = useQuery(offersQuery(status));

  const target = settings?.daily_target ?? 25;
  const posted = counts?.postedToday ?? 0;
  const pct = Math.min(100, Math.round((posted / target) * 100));

  async function runSearch() {
    setSearching(true);
    try {
      const r = await search({ data: { keyword: keyword.trim() || undefined } });
      toast.success(`${r.found} produtos analisados · ${r.added} ofertas novas`, {
        description: r.fake ? `${r.fake} descartadas por promoção falsa.` : undefined,
      });
      r.errors.slice(0, 3).forEach((e) => toast.error(e));
      setStatus("new");
      qc.invalidateQueries({ queryKey: ["offers"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSearching(false);
    }
  }

  async function reject(o: Offer) {
    const { error } = await supabase.from("offers").update({ status: "rejected" }).eq("id", o.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["offers"] });
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">Postadas hoje</p>
          <p className="mt-1 font-display text-4xl font-extrabold">
            {posted}
            <span className="text-xl text-muted-foreground"> / {target}</span>
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">Novas no radar</p>
          <p className="mt-1 font-display text-4xl font-extrabold text-primary">{counts?.fresh ?? 0}</p>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">Aprovadas na fila</p>
          <p className="mt-1 font-display text-4xl font-extrabold text-success">{counts?.approved ?? 0}</p>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-11 pl-9"
            placeholder="Buscar uma palavra (ex.: air fryer) ou deixe vazio para usar suas palavras salvas"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
          />
        </div>
        <Button variant="hero" size="lg" onClick={runSearch} disabled={searching}>
          {searching ? <Loader2 className="animate-spin" /> : <Radar />} Garimpar na Shopee
        </Button>
        <ManualOfferDialog />
      </section>

      <section className="space-y-5">
        <Tabs value={status} onValueChange={(v) => setStatus(v as OfferStatus)}>
          <TabsList>
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="py-16 text-center text-muted-foreground">Carregando ofertas…</div>
        ) : !offers?.length ? (
          <div className="rounded-2xl border border-dashed p-12 text-center">
            <p className="font-display text-xl font-bold">Nada por aqui ainda</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              {status === "new"
                ? "Clique em “Garimpar na Shopee” para buscar promoções, ou adicione uma oferta manualmente."
                : "As ofertas aparecem aqui conforme você aprova, posta ou descarta."}
            </p>
            {status === "new" && (
              <p className="mt-4 text-xs text-muted-foreground">
                Ainda sem grupo cadastrado? <Link to="/destinos" className="text-primary underline">Cadastre o Telegram</Link>.
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {offers.map((o) => (
              <OfferCard
                key={o.id}
                offer={o}
                onOpen={() => setEditing(o)}
                onReject={o.status === "new" || o.status === "approved" ? () => reject(o) : undefined}
              />
            ))}
          </div>
        )}
      </section>

      <OfferEditor
        offer={editing}
        brand={settings?.brand_name ?? "Radar das Ofertas"}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
      />
    </div>
  );
}
