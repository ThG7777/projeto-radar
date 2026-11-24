import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { discountFromPrices } from "@/lib/format";

const toNum = (s: string) => {
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function ManualOfferDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ title: "", image: "", original: "", price: "", link: "", coupon: "", source: "shopee" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const price = toNum(f.price);
    const original = toNum(f.original);
    if (!price) {
      toast.error("Informe o preço atual.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("offers").insert({
      source: "manual",
      title: f.title.trim(),
      image_url: f.image.trim() || null,
      price,
      original_price: original,
      discount_pct: discountFromPrices(original, price),
      affiliate_url: f.link.trim(),
      coupon: f.coupon.trim() || null,
      shop_name: f.source === "ml" ? "Mercado Livre" : "Shopee",
      score: 50,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Oferta adicionada em Novas.");
    setF({ title: "", image: "", original: "", price: "", link: "", coupon: "", source: f.source });
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["offers"] });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus /> Adicionar oferta
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar oferta manualmente</DialogTitle>
          <DialogDescription>Cole o link de afiliado que você gerou na Shopee ou no Mercado Livre.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="m-title">Nome do produto</Label>
            <Input id="m-title" required value={f.title} onChange={set("title")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="m-orig">Preço antes (R$)</Label>
              <Input id="m-orig" inputMode="decimal" placeholder="199,90" value={f.original} onChange={set("original")} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="m-price">Preço agora (R$)</Label>
              <Input id="m-price" inputMode="decimal" required placeholder="89,90" value={f.price} onChange={set("price")} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="m-link">Link de afiliado</Label>
            <Input id="m-link" type="url" required placeholder="https://s.shopee.com.br/…" value={f.link} onChange={set("link")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="m-img">Link da foto do produto</Label>
            <Input id="m-img" type="url" placeholder="https://…jpg" value={f.image} onChange={set("image")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="m-coupon">Cupom</Label>
              <Input id="m-coupon" value={f.coupon} onChange={set("coupon")} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="m-src">Loja</Label>
              <select
                id="m-src"
                value={f.source}
                onChange={set("source")}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="shopee">Shopee</option>
                <option value="ml">Mercado Livre</option>
              </select>
            </div>
          </div>
          <Button type="submit" variant="hero" disabled={busy}>
            Adicionar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
