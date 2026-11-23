import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, RefreshCw, Send, Sparkles, Check, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { fetchImageDataUrl, generateOfferCaption, postOfferToTelegram } from "@/lib/offers.functions";
import { renderBanner, canvasToBlob } from "@/lib/banner";
import type { Offer } from "@/lib/queries";

export function OfferEditor({
  offer,
  brand,
  open,
  onOpenChange,
}: {
  offer: Offer | null;
  brand: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const fetchImage = useServerFn(fetchImageDataUrl);
  const genCaption = useServerFn(generateOfferCaption);
  const post = useServerFn(postOfferToTelegram);

  const [coupon, setCoupon] = useState("");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [busy, setBusy] = useState<null | "ai" | "save" | "approve" | "post">(null);
  const imageRef = useRef<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!offer || !open) return;
    setCoupon(offer.coupon ?? "");
    setTitle(offer.title);
    setCaption(offer.caption ?? "");
    setPreview(null);
    imageRef.current = null;
    void draw(offer.title, offer.coupon ?? "", true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offer?.id, open]);

  async function draw(t: string, c: string, loadImage = false) {
    if (!offer) return;
    setRendering(true);
    try {
      if (loadImage && offer.image_url && !imageRef.current) {
        try {
          const { dataUrl } = await fetchImage({ data: { url: offer.image_url } });
          imageRef.current = dataUrl;
        } catch (e) {
          toast.warning("Não consegui carregar a foto do produto para o banner.");
          console.error(e);
        }
      }
      const canvas = await renderBanner({
        imageDataUrl: imageRef.current,
        title: t,
        price: Number(offer.price),
        originalPrice: offer.original_price != null ? Number(offer.original_price) : null,
        discountPct: offer.discount_pct,
        coupon: c.trim() || null,
        brand,
      });
      canvasRef.current = canvas;
      setPreview(canvas.toDataURL("image/png"));
    } finally {
      setRendering(false);
    }
  }

  async function uploadBanner(): Promise<string | null> {
    if (!offer || !canvasRef.current) return null;
    const blob = await canvasToBlob(canvasRef.current);
    const path = `${offer.id}.png`;
    const { error } = await supabase.storage.from("banners").upload(path, blob, { upsert: true, contentType: "image/png" });
    if (error) throw new Error(`Falha ao salvar o banner: ${error.message}`);
    return path;
  }

  async function save(extra: Partial<Offer> = {}) {
    if (!offer) return;
    const banner_path = await uploadBanner();
    const { error } = await supabase
      .from("offers")
      .update({ coupon: coupon.trim() || null, caption: caption || null, banner_path, ...extra })
      .eq("id", offer.id);
    if (error) throw new Error(error.message);
    await qc.invalidateQueries({ queryKey: ["offers"] });
  }

  async function run(kind: NonNullable<typeof busy>, fn: () => Promise<void>) {
    setBusy(kind);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  if (!offer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preparar post</DialogTitle>
          <DialogDescription className="line-clamp-1">{offer.title}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
          <div className="space-y-3">
            <div className="relative aspect-square overflow-hidden rounded-xl border bg-muted">
              {preview && <img src={preview} alt="Banner da oferta" className="size-full" />}
              {rendering && (
                <div className="absolute inset-0 grid place-items-center bg-background/60">
                  <Loader2 className="size-6 animate-spin text-primary" />
                </div>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="banner-title">Título no banner</Label>
              <Input id="banner-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <Button variant="secondary" size="sm" onClick={() => draw(title, coupon)} disabled={rendering}>
              <RefreshCw /> Atualizar banner
            </Button>
          </div>

          <div className="flex flex-col gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="coupon">Cupom (opcional)</Label>
              <Input
                id="coupon"
                placeholder="Ex.: RADAR10"
                value={coupon}
                onChange={(e) => setCoupon(e.target.value)}
                onBlur={() => draw(title, coupon)}
              />
            </div>
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="caption">Texto do post</Label>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() =>
                    run("ai", async () => {
                      const r = await genCaption({ data: { offerId: offer.id, coupon: coupon.trim() || null } });
                      setCaption(r.caption);
                      setTitle(r.shortTitle);
                      await draw(r.shortTitle, coupon);
                      toast.success("Texto criado!");
                    })
                  }
                >
                  {busy === "ai" ? <Loader2 className="animate-spin" /> : <Sparkles />} Gerar com IA
                </Button>
              </div>
              <Textarea
                id="caption"
                rows={12}
                className="font-mono text-xs"
                placeholder="Clique em “Gerar com IA” ou escreva o texto. Aceita <b>negrito</b>, <s>riscado</s> e links."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
              />
            </div>
            {offer.affiliate_url && (
              <a
                href={offer.affiliate_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
              >
                <ExternalLink className="size-3" /> Abrir link de afiliado
              </a>
            )}
            <div className="mt-auto flex flex-wrap gap-2">
              <Button
                variant="secondary"
                disabled={busy !== null}
                onClick={() => run("save", async () => { await save(); toast.success("Salvo."); })}
              >
                {busy === "save" ? <Loader2 className="animate-spin" /> : null} Salvar
              </Button>
              {offer.status === "new" && (
                <Button
                  variant="success"
                  disabled={busy !== null}
                  onClick={() =>
                    run("approve", async () => {
                      await save({ status: "approved" });
                      toast.success("Oferta aprovada e na fila.");
                      onOpenChange(false);
                    })
                  }
                >
                  {busy === "approve" ? <Loader2 className="animate-spin" /> : <Check />} Aprovar
                </Button>
              )}
              <Button
                variant="hero"
                className="flex-1"
                disabled={busy !== null || !caption.trim()}
                onClick={() =>
                  run("post", async () => {
                    await save();
                    const { results } = await post({ data: { offerId: offer.id } });
                    const ok = results.filter((r) => r.ok);
                    const bad = results.filter((r) => !r.ok);
                    if (ok.length) toast.success(`Postado em ${ok.map((r) => r.destination).join(", ")}`);
                    bad.forEach((r) => toast.error(`${r.destination}: ${r.error}`));
                    await qc.invalidateQueries({ queryKey: ["offers"] });
                    if (ok.length) onOpenChange(false);
                  })
                }
              >
                {busy === "post" ? <Loader2 className="animate-spin" /> : <Send />} Postar no Telegram
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
