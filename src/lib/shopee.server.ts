import { createHash } from "crypto";

const ENDPOINT = "https://open-api.affiliate.shopee.com.br/graphql";

export class ShopeeNotConfiguredError extends Error {
  constructor() {
    super("Shopee ainda não está configurada (falta App ID e Secret da API de afiliados).");
  }
}

export function shopeeConfigured(): boolean {
  return Boolean(process.env["SHOPEE_APP_ID"] && process.env["SHOPEE_APP_SECRET"]);
}

async function shopeeGraphQL<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const appId = process.env["SHOPEE_APP_ID"];
  const secret = process.env["SHOPEE_APP_SECRET"];
  if (!appId || !secret) throw new ShopeeNotConfiguredError();

  const body = JSON.stringify({ query, variables });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHash("sha256").update(`${appId}${timestamp}${body}${secret}`).digest("hex");

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`,
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Shopee request failed [${res.status}]: ${text}`);
    throw new Error(`Shopee respondeu ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = JSON.parse(text) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) {
    console.error("Shopee GraphQL errors:", text);
    throw new Error(`Shopee: ${json.errors[0]!.message}`);
  }
  return json.data as T;
}

export type ShopeeNode = {
  itemId: number | string;
  productName: string;
  imageUrl: string | null;
  priceMin: string | null;
  priceMax: string | null;
  priceDiscountRate: number | null;
  sales: number | null;
  ratingStar: string | null;
  commissionRate: string | null;
  shopName: string | null;
  productLink: string | null;
  offerLink: string | null;
};

const PRODUCT_QUERY = `query Offers($keyword: String, $page: Int, $limit: Int, $sortType: Int) {
  productOfferV2(keyword: $keyword, sortType: $sortType, page: $page, limit: $limit) {
    nodes {
      itemId productName imageUrl priceMin priceMax priceDiscountRate sales
      ratingStar commissionRate shopName productLink offerLink
    }
    pageInfo { page limit hasNextPage }
  }
}`;

/** sortType 2 = most sold first. */
export async function searchShopeeOffers(keyword: string, limit = 50): Promise<ShopeeNode[]> {
  const data = await shopeeGraphQL<{ productOfferV2: { nodes: ShopeeNode[] } }>(PRODUCT_QUERY, {
    keyword,
    page: 1,
    limit,
    sortType: 2,
  });
  return data.productOfferV2?.nodes ?? [];
}
