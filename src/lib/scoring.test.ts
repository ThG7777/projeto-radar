import { describe, expect, it } from "vitest";
import { evaluateOffer, priceFlagFor, type OfferFilters } from "./scoring";

const filters: OfferFilters = { minDiscount: 20, minSales: 100, minRating: 4.5, minPrice: 15, maxPrice: 500 };
const good = { price: 89.9, discountPct: 45, sales: 2300, rating: 4.8, commissionRate: 0.08 };

describe("evaluateOffer", () => {
  it("accepts a product with good discount and good sales", () => {
    expect(evaluateOffer(good, filters).passes).toBe(true);
  });

  it("rejects a discount below the minimum", () => {
    expect(evaluateOffer({ ...good, discountPct: 10 }, filters).passes).toBe(false);
  });

  it("rejects products with too few sales", () => {
    expect(evaluateOffer({ ...good, sales: 40 }, filters).passes).toBe(false);
  });

  it("rejects a 'promotion' whose price is not below its usual price", () => {
    const history = [89.9, 92, 90.5, 88];
    const r = evaluateOffer(good, filters, history);
    expect(r.priceFlag).toBe("not_below_normal");
    expect(r.passes).toBe(false);
  });

  it("gives a bonus when the price is the lowest seen", () => {
    const history = [149.9, 139.9, 145];
    const withLowest = evaluateOffer(good, filters, history);
    expect(withLowest.priceFlag).toBe("lowest");
    expect(withLowest.score).toBeGreaterThan(evaluateOffer(good, filters).score);
  });

  it("ignores history until there are at least 3 price points", () => {
    expect(priceFlagFor(100, [100, 100])).toBeNull();
  });
});
