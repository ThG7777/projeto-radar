import { formatBRL, formatSales } from "./format";

export type CaptionInput = {
  headline: string;
  title: string;
  price: number;
  originalPrice: number | null;
  discountPct: number;
  coupon: string | null;
  rating: number | null;
  sales: number | null;
  url: string;
  brand: string;
};

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Telegram HTML caption. Prices and link are always filled from data, never by the AI. */
export function buildCaption(i: CaptionInput): string {
  const lines: string[] = [];
  lines.push(`🔥 <b>${escapeHtml(i.headline)}</b>`, "");
  lines.push(escapeHtml(i.title), "");
  const priceLine =
    i.originalPrice && i.originalPrice > i.price
      ? `<s>${formatBRL(i.originalPrice)}</s> ➜ <b>${formatBRL(i.price)}</b>${i.discountPct > 0 ? ` (${i.discountPct}% OFF)` : ""}`
      : `💰 <b>${formatBRL(i.price)}</b>`;
  lines.push(priceLine);
  if (i.coupon) lines.push(`🎟️ Cupom: <code>${escapeHtml(i.coupon)}</code>`);
  const social: string[] = [];
  if (i.rating && i.rating > 0) social.push(`⭐ ${i.rating.toFixed(1).replace(".", ",")}`);
  if (i.sales && i.sales > 0) social.push(`${formatSales(i.sales)} vendidos`);
  if (social.length) lines.push(social.join(" · "));
  lines.push("", `🛒 <a href="${escapeHtml(i.url)}">Comprar agora</a>`);
  lines.push("", `<i>${escapeHtml(i.brand)} · link de afiliado</i>`);
  return lines.join("\n");
}
