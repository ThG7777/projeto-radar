export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    .format(value)
    .replace(/\u00a0/g, " ");
}

export function formatSales(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return `${k >= 10 ? Math.round(k) : k.toFixed(1).replace(".", ",").replace(",0", "")} mil`;
  }
  return String(n);
}

export function originalFromDiscount(price: number, discountPct: number): number | null {
  if (!discountPct || discountPct <= 0 || discountPct >= 100) return null;
  return Math.round((price / (1 - discountPct / 100)) * 100) / 100;
}

export function discountFromPrices(original: number | null, price: number): number {
  if (!original || original <= price) return 0;
  return Math.round((1 - price / original) * 100);
}
