// Pure offer evaluation: filters + "real discount" check against price history + 0–100 score.

export type OfferFilters = {
  minDiscount: number;
  minSales: number;
  minRating: number;
  minPrice: number;
  maxPrice: number;
};

export type OfferCandidate = {
  price: number;
  discountPct: number;
  sales: number | null;
  rating: number | null;
  commissionRate: number | null; // fraction, e.g. 0.08 = 8%
};

export type PriceFlag = "lowest" | "not_below_normal" | null;

export type OfferEvaluation = {
  passes: boolean;
  reasons: string[];
  score: number;
  priceFlag: PriceFlag;
};

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Minimum history points before we trust the "normal price" comparison. */
export const MIN_HISTORY_POINTS = 3;

export function priceFlagFor(price: number, history: number[]): PriceFlag {
  if (history.length < MIN_HISTORY_POINTS) return null;
  const normal = median(history)!;
  if (price >= normal * 0.97) return "not_below_normal";
  if (price <= Math.min(...history)) return "lowest";
  return null;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function evaluateOffer(
  c: OfferCandidate,
  f: OfferFilters,
  history: number[] = [],
): OfferEvaluation {
  const reasons: string[] = [];
  if (c.discountPct < f.minDiscount) reasons.push(`desconto abaixo de ${f.minDiscount}%`);
  if ((c.sales ?? 0) < f.minSales) reasons.push(`menos de ${f.minSales} vendas`);
  if (c.rating != null && c.rating > 0 && c.rating < f.minRating)
    reasons.push(`nota abaixo de ${f.minRating}`);
  if (c.price < f.minPrice || c.price > f.maxPrice)
    reasons.push(`preço fora da faixa R$ ${f.minPrice}–${f.maxPrice}`);

  const priceFlag = priceFlagFor(c.price, history);
  if (priceFlag === "not_below_normal") reasons.push("preço não está abaixo do normal (promoção falsa)");

  const discountPart = clamp01(Math.min(c.discountPct, 70) / 70) * 40;
  const salesPart = clamp01(Math.log10((c.sales ?? 0) + 1) / 4) * 25;
  const ratingPart = c.rating != null && c.rating > 0 ? clamp01(c.rating - 4) * 15 : 7;
  const commissionPart = clamp01((c.commissionRate ?? 0) / 0.15) * 10;
  const lowestBonus = priceFlag === "lowest" ? 10 : 0;
  const score = Math.round((discountPart + salesPart + ratingPart + commissionPart + lowestBonus) * 10) / 10;

  return { passes: reasons.length === 0, reasons, score: Math.min(100, score), priceFlag };
}
