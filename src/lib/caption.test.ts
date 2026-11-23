import { describe, expect, it } from "vitest";
import { buildCaption } from "./caption";
import { originalFromDiscount, discountFromPrices } from "./format";

const base = {
  headline: "Achado do dia",
  title: "Air fryer 4L",
  price: 199.9,
  originalPrice: 399.9,
  discountPct: 50,
  coupon: "RADAR10",
  rating: 4.8,
  sales: 2300,
  url: "https://s.shopee.com.br/abc",
  brand: "Radar das Ofertas",
};

describe("buildCaption", () => {
  it("shows old and new price with the discount", () => {
    const c = buildCaption(base);
    expect(c).toContain("<s>R$ 399,90</s>");
    expect(c).toContain("<b>R$ 199,90</b>");
    expect(c).toContain("50% OFF");
  });

  it("includes the coupon when there is one", () => {
    expect(buildCaption(base)).toContain("<code>RADAR10</code>");
    expect(buildCaption({ ...base, coupon: null })).not.toContain("Cupom");
  });

  it("always includes the affiliate link and the affiliate disclosure", () => {
    const c = buildCaption(base);
    expect(c).toContain('href="https://s.shopee.com.br/abc"');
    expect(c).toContain("link de afiliado");
  });
});

describe("price math", () => {
  it("derives the original price from the discount", () => {
    expect(originalFromDiscount(50, 50)).toBe(100);
  });
  it("derives the discount from two prices", () => {
    expect(discountFromPrices(200, 150)).toBe(25);
  });
});
