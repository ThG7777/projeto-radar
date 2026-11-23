import { Flame, Star, TrendingDown, ShoppingBag, Percent, ImageIcon } from "lucide-react";
import type { Offer } from "@/lib/queries";
import { formatBRL, formatSales } from "@/lib/format";
import { Button } from "@/components/ui/button";

export function OfferCard({
  offer,
  onOpen,
  onReject,
}: {
  offer: Offer;
  onOpen: () => void;
  onReject?: () => void;
}) {
  const price = Number(offer.price);
  const original = offer.original_price != null ? Number(offer.original_price) : null;
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border bg-card shadow-[var(--shadow-card)] transition-colors hover:border-primary/50">
      <button type="button" onClick={onOpen} className="relative aspect-square bg-paper">
        {offer.image_url ? (
          <img src={offer.image_url} alt={offer.title} loading="lazy" className="size-full object-contain p-4" />
        ) : (
          <ImageIcon className="absolute inset-0 m-auto size-10 text-muted-foreground" />
        )}
        {offer.discount_pct > 0 && (
          <span className="absolute left-3 top-3 rounded-full bg-deal px-2.5 py-1 font-display text-sm font-extrabold text-deal-foreground">
            -{offer.discount_pct}%
          </span>
        )}
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-1 font-mono text-xs text-primary">
          <Flame className="size-3" /> {Number(offer.score).toFixed(0)}
        </span>
        {offer.price_flag === "lowest" && (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-success px-2.5 py-1 text-xs font-semibold text-success-foreground">
            <TrendingDown className="size-3" /> Menor preço
          </span>
        )}
      </button>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="line-clamp-2 font-sans text-sm font-semibold leading-snug tracking-normal">{offer.title}</h3>
        <div className="flex items-baseline gap-2">
          <span className="font-display text-2xl font-extrabold text-primary">{formatBRL(price)}</span>
          {original && original > price && (
            <span className="price-strike text-sm text-muted-foreground">{formatBRL(original)}</span>
          )}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {offer.sales != null && (
            <span className="inline-flex items-center gap-1">
              <ShoppingBag className="size-3" /> {formatSales(offer.sales)} vendidos
            </span>
          )}
          {offer.rating != null && Number(offer.rating) > 0 && (
            <span className="inline-flex items-center gap-1">
              <Star className="size-3" /> {Number(offer.rating).toFixed(1)}
            </span>
          )}
          {offer.commission_rate != null && (
            <span className="inline-flex items-center gap-1">
              <Percent className="size-3" /> {(Number(offer.commission_rate) * 100).toFixed(1)}% comissão
            </span>
          )}
        </div>
        {offer.coupon && (
          <span className="w-fit rounded-md border border-dashed border-primary/60 px-2 py-0.5 font-mono text-xs text-primary">
            {offer.coupon}
          </span>
        )}
        <div className="mt-auto flex gap-2 pt-1">
          <Button size="sm" variant="hero" className="flex-1" onClick={onOpen}>
            {offer.status === "posted" ? "Ver / repostar" : "Preparar post"}
          </Button>
          {onReject && (
            <Button size="sm" variant="ghost" onClick={onReject}>
              Descartar
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
