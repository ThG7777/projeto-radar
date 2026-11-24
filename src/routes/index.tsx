import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BadgePercent, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Brand, RadarMark } from "@/components/radar/RadarMark";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Radar de Ofertas · Painel de ofertas de afiliado" },
      { name: "description", content: "Garimpa promoções reais na Shopee, cria o banner e posta nos seus grupos de ofertas." },
      { property: "og:title", content: "Radar de Ofertas" },
      { property: "og:description", content: "Garimpa promoções reais na Shopee, cria o banner e posta nos seus grupos de ofertas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const steps = [
  { icon: BadgePercent, title: "Garimpa", text: "Busca produtos com desconto real e muitas vendas." },
  { icon: Sparkles, title: "Cria", text: "Monta banner e texto vendedor com cupom." },
  { icon: Send, title: "Posta", text: "Você aprova e envia para seus grupos." },
];

function Index() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-8">
      <header className="flex items-center justify-between">
        <Brand />
        <Button asChild variant="outline" size="sm">
          <Link to="/painel">Entrar</Link>
        </Button>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center py-20 text-center">
        <RadarMark className="mb-8 size-24" />
        <h1 className="max-w-3xl text-5xl font-extrabold leading-[1.02] md:text-7xl">
          Só promoção <span className="text-primary">de verdade</span> no seu grupo.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          O painel do Radar de Ofertas encontra os melhores descontos, gera o banner e dispara para o Telegram.
        </p>
        <Button asChild variant="hero" size="lg" className="mt-10">
          <Link to="/painel">
            Abrir o painel <ArrowRight />
          </Link>
        </Button>
      </section>

      <section className="grid gap-4 pb-8 md:grid-cols-3">
        {steps.map((s, i) => (
          <div key={s.title} className="rounded-2xl border bg-card/70 p-5">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-primary">0{i + 1}</span>
              <s.icon className="size-5 text-primary" />
              <h2 className="text-lg font-bold">{s.title}</h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
