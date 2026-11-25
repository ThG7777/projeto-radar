import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Radar, Send, Trash2 } from "lucide-react";
import { AppShell } from "@/components/radar/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { destinationsQuery } from "@/lib/queries";
import { detectTelegramChats, getIntegrationStatus, sendTelegramTest } from "@/lib/offers.functions";

export const Route = createFileRoute("/_authenticated/destinos")({
  head: () => ({
    meta: [
      { title: "Destinos · Radar de Ofertas" },
      { name: "description", content: "Grupos e canais do Telegram que recebem as ofertas." },
      { property: "og:title", content: "Destinos · Radar de Ofertas" },
      { property: "og:description", content: "Grupos e canais do Telegram que recebem as ofertas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <Destinos />
    </AppShell>
  ),
});

function Destinos() {
  const qc = useQueryClient();
  const statusFn = useServerFn(getIntegrationStatus);
  const detect = useServerFn(detectTelegramChats);
  const test = useServerFn(sendTelegramTest);
  const { data: status } = useQuery({ queryKey: ["integrations"], queryFn: () => statusFn() });
  const { data: dests } = useQuery(destinationsQuery);
  const [found, setFound] = useState<{ chatId: string; title: string; type: string }[] | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [manual, setManual] = useState({ chatId: "", title: "" });

  const refresh = () => qc.invalidateQueries({ queryKey: ["destinations"] });

  async function add(chatId: string, title: string) {
    const { error } = await supabase.from("destinations").insert({ platform: "telegram", chat_id: chatId, title });
    if (error) {
      toast.error(error.code === "23505" ? "Esse grupo já está cadastrado." : error.message);
      return;
    }
    toast.success(`${title} adicionado.`);
    refresh();
  }

  async function runDetect() {
    setDetecting(true);
    try {
      const r = await detect();
      setFound(r.chats);
      if (!r.chats.length) toast.info("Nenhum grupo encontrado ainda. Veja o passo a passo ao lado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setDetecting(false);
    }
  }

  const known = new Set((dests ?? []).map((d) => d.chat_id));
  const botHandle = status?.bot ? `@${status.bot.username}` : "seu bot";

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold">Destinos</h1>
          <p className="mt-1 text-muted-foreground">Grupos e canais do Telegram que recebem cada oferta postada.</p>
        </div>

        <div className="space-y-3">
          {(dests ?? []).length === 0 && (
            <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              Nenhum grupo cadastrado ainda.
            </div>
          )}
          {(dests ?? []).map((d) => (
            <div key={d.id} className="flex items-center gap-4 rounded-2xl border bg-card p-4">
              <Switch
                checked={d.enabled}
                onCheckedChange={async (v) => {
                  await supabase.from("destinations").update({ enabled: v }).eq("id", d.id);
                  refresh();
                }}
                aria-label={`Ativar ${d.title}`}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{d.title}</p>
                <p className="font-mono text-xs text-muted-foreground">{d.chat_id}</p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  try {
                    await test({ data: { chatId: d.chat_id } });
                    toast.success("Mensagem de teste enviada!");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : String(e));
                  }
                }}
              >
                <Send /> Testar
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Remover"
                onClick={async () => {
                  await supabase.from("destinations").delete().eq("id", d.id);
                  refresh();
                }}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Encontrar grupos do bot</h2>
              <p className="text-sm text-muted-foreground">Lista os grupos e canais onde {botHandle} foi adicionado.</p>
            </div>
            <Button variant="hero" onClick={runDetect} disabled={detecting}>
              {detecting ? <Loader2 className="animate-spin" /> : <Radar />} Procurar grupos
            </Button>
          </div>
          {found && found.length > 0 && (
            <div className="mt-4 space-y-2">
              {found.map((c) => (
                <div key={c.chatId} className="flex items-center justify-between rounded-xl bg-secondary px-4 py-3">
                  <div>
                    <p className="font-medium">{c.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.type === "channel" ? "Canal" : "Grupo"} · {c.chatId}
                    </p>
                  </div>
                  {known.has(c.chatId) ? (
                    <span className="text-xs text-success">Já cadastrado</span>
                  ) : (
                    <Button size="sm" onClick={() => add(c.chatId, c.title)}>
                      <Plus /> Adicionar
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <form
          className="grid gap-3 rounded-2xl border bg-card p-5 md:grid-cols-[1fr_1fr_auto] md:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (!manual.chatId.trim()) return;
            void add(manual.chatId.trim(), manual.title.trim() || manual.chatId.trim());
            setManual({ chatId: "", title: "" });
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="chat-id">ID ou @ do canal</Label>
            <Input id="chat-id" placeholder="@radardeofertas ou -100…" value={manual.chatId} onChange={(e) => setManual({ ...manual, chatId: e.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="chat-title">Nome</Label>
            <Input id="chat-title" placeholder="Radar de Ofertas #1" value={manual.title} onChange={(e) => setManual({ ...manual, title: e.target.value })} />
          </div>
          <Button type="submit" variant="outline">
            <Plus /> Adicionar
          </Button>
        </form>
      </div>

      <aside className="h-fit space-y-4 rounded-2xl border bg-card p-5">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Bot conectado</p>
          {status?.bot ? (
            <p className="mt-1 font-display text-xl font-bold">
              {status.bot.name} <span className="text-primary">@{status.bot.username}</span>
            </p>
          ) : (
            <p className="mt-1 text-sm text-destructive">{status?.telegramError ?? "Verificando…"}</p>
          )}
        </div>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>No Telegram, abra seu grupo ou canal de ofertas.</li>
          <li>
            Adicione <b className="text-foreground">{botHandle}</b> como <b className="text-foreground">administrador</b> (com permissão para postar).
          </li>
          <li>Em grupos, mande qualquer mensagem depois de adicionar o bot.</li>
          <li>Volte aqui e clique em <b className="text-foreground">Procurar grupos</b>.</li>
          <li>Use <b className="text-foreground">Testar</b> para confirmar que chegou.</li>
        </ol>
      </aside>
    </div>
  );
}
