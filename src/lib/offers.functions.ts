import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./admin.server";
import { searchShopeeOffers, shopeeConfigured, ShopeeNotConfiguredError } from "./shopee.server";
import { telegramCall } from "./telegram.server";
import { writeOfferCopy } from "./copywriter.server";
import { evaluateOffer } from "./scoring";
import { buildCaption } from "./caption";
import { originalFromDiscount } from "./format";

export const getIntegrationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    let bot: { name: string; username: string } | null = null;
    let telegramError: string | null = null;
    try {
      const me = await telegramCall<{ first_name: string; username: string }>("getMe", {});
      bot = { name: me.first_name, username: me.username };
    } catch (e) {
      telegramError = e instanceof Error ? e.message : String(e);
    }
    return { shopee: shopeeConfigured(), bot, telegramError };
  });

export const searchShopee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ keyword: z.string().trim().max(80).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { data: settings, error: sErr } = await supabase.from("app_settings").select("*").eq("id", 1).single();
    if (sErr || !settings) throw new Error("Configurações não encontradas.");
    const filters = {
      minDiscount: settings.min_discount,
      minSales: settings.min_sales,
      minRating: Number(settings.min_rating),
      minPrice: Number(settings.min_price),
      maxPrice: Number(settings.max_price),
    };
    const keywords = data.keyword ? [data.keyword] : settings.keywords.slice(0, 8);
    if (keywords.length === 0) throw new Error("Cadastre pelo menos uma palavra de busca nas configurações.");

    let found = 0;
    let added = 0;
    let fake = 0;
    const errors: string[] = [];

    for (const keyword of keywords) {
      let nodes;
      try {
        nodes = await searchShopeeOffers(keyword, 50);
      } catch (e) {
        if (e instanceof ShopeeNotConfiguredError) throw e;
        errors.push(`${keyword}: ${e instanceof Error ? e.message : e}`);
        continue;
      }
      found += nodes.length;
      if (nodes.length === 0) continue;

      const ids = nodes.map((n) => String(n.itemId));
      const since = new Date(Date.now() - 30 * 864e5).toISOString();
      const { data: hist } = await supabase
        .from("price_history")
        .select("external_id, price")
        .eq("source", "shopee")
        .in("external_id", ids)
        .gte("captured_at", since);
      const histMap = new Map<string, number[]>();
      for (const h of hist ?? []) {
        const arr = histMap.get(h.external_id) ?? [];
        arr.push(Number(h.price));
        histMap.set(h.external_id, arr);
      }

      const rows = [];
      for (const n of nodes) {
        const price = Number(n.priceMin ?? n.priceMax ?? 0);
        if (!price) continue;
        const discountPct = Math.round(n.priceDiscountRate ?? 0);
        const rating = n.ratingStar ? Number(n.ratingStar) : null;
        const commissionRate = n.commissionRate ? Number(n.commissionRate) : null;
        const ev = evaluateOffer(
          { price, discountPct, sales: n.sales, rating, commissionRate },
          filters,
          histMap.get(String(n.itemId)) ?? [],
        );
        if (ev.priceFlag === "not_below_normal") fake++;
        if (!ev.passes) continue;
        rows.push({
          source: "shopee",
          external_id: String(n.itemId),
          title: n.productName,
          image_url: n.imageUrl,
          price,
          original_price: originalFromDiscount(price, discountPct),
          discount_pct: discountPct,
          sales: n.sales,
          rating,
          commission_rate: commissionRate,
          shop_name: n.shopName,
          product_url: n.productLink,
          affiliate_url: n.offerLink,
          score: ev.score,
          price_flag: ev.priceFlag,
          keyword,
        });
      }

      await supabase.from("price_history").insert(
        nodes
          .filter((n) => Number(n.priceMin ?? 0) > 0)
          .map((n) => ({ source: "shopee", external_id: String(n.itemId), price: Number(n.priceMin) })),
      );

      if (rows.length) {
        const { data: existing } = await supabase
          .from("offers")
          .select("external_id")
          .eq("source", "shopee")
          .in("external_id", rows.map((r) => r.external_id));
        const existingSet = new Set((existing ?? []).map((e) => e.external_id));
        added += rows.filter((r) => !existingSet.has(r.external_id)).length;
        const { error } = await supabase.from("offers").upsert(rows, { onConflict: "source,external_id" });
        if (error) errors.push(`${keyword}: ${error.message}`);
      }
    }

    return { keywords: keywords.length, found, added, fake, errors };
  });

export const generateOfferCaption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ offerId: z.string().uuid(), coupon: z.string().max(60).nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const [{ data: offer }, { data: settings }] = await Promise.all([
      supabase.from("offers").select("*").eq("id", data.offerId).single(),
      supabase.from("app_settings").select("brand_name").eq("id", 1).single(),
    ]);
    if (!offer) throw new Error("Oferta não encontrada.");
    if (!offer.affiliate_url) throw new Error("Esta oferta não tem link de afiliado.");

    const copy = await writeOfferCopy({
      title: offer.title,
      price: Number(offer.price),
      discountPct: offer.discount_pct,
      shopName: offer.shop_name,
    });
    const caption = buildCaption({
      headline: copy.headline,
      title: copy.shortTitle,
      price: Number(offer.price),
      originalPrice: offer.original_price != null ? Number(offer.original_price) : null,
      discountPct: offer.discount_pct,
      coupon: data.coupon?.trim() || null,
      rating: offer.rating != null ? Number(offer.rating) : null,
      sales: offer.sales,
      url: offer.affiliate_url,
      brand: settings?.brand_name ?? "Radar de Ofertas",
    });
    const { error } = await supabase
      .from("offers")
      .update({ caption, coupon: data.coupon?.trim() || null })
      .eq("id", offer.id);
    if (error) throw new Error(error.message);
    return { caption, shortTitle: copy.shortTitle, headline: copy.headline };
  });

export const fetchImageDataUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ url: z.string().url().startsWith("https://") }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const res = await fetch(data.url, { redirect: "follow" });
    if (!res.ok) throw new Error(`Não consegui baixar a imagem (${res.status}).`);
    const type = res.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) throw new Error("O link não é uma imagem.");
    const buf = await res.arrayBuffer();
    if (buf.byteLength > 6 * 1024 * 1024) throw new Error("Imagem muito grande.");
    return { dataUrl: `data:${type};base64,${Buffer.from(buf).toString("base64")}` };
  });

export const postOfferToTelegram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ offerId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const [{ data: offer }, { data: dests }] = await Promise.all([
      supabase.from("offers").select("*").eq("id", data.offerId).single(),
      supabase.from("destinations").select("*").eq("platform", "telegram").eq("enabled", true),
    ]);
    if (!offer) throw new Error("Oferta não encontrada.");
    if (!offer.caption) throw new Error("Gere ou escreva o texto da oferta antes de postar.");
    if (!dests?.length) throw new Error("Nenhum grupo do Telegram ativo. Cadastre em Destinos.");

    let photo: string | null = offer.image_url;
    if (offer.banner_path) {
      const { data: signed, error } = await supabase.storage.from("banners").createSignedUrl(offer.banner_path, 900);
      if (error) throw new Error(`Banner: ${error.message}`);
      photo = signed.signedUrl;
    }

    const results: { destination: string; ok: boolean; error?: string }[] = [];
    for (const d of dests) {
      try {
        const msg = photo
          ? await telegramCall<{ message_id: number }>("sendPhoto", {
              chat_id: d.chat_id,
              photo,
              caption: offer.caption.slice(0, 1024),
              parse_mode: "HTML",
            })
          : await telegramCall<{ message_id: number }>("sendMessage", {
              chat_id: d.chat_id,
              text: offer.caption,
              parse_mode: "HTML",
            });
        await supabase.from("posts").insert({
          offer_id: offer.id,
          destination_id: d.id,
          status: "sent",
          provider_message_id: String(msg.message_id),
        });
        results.push({ destination: d.title, ok: true });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        await supabase.from("posts").insert({ offer_id: offer.id, destination_id: d.id, status: "failed", error: message });
        results.push({ destination: d.title, ok: false, error: message });
      }
    }
    if (results.some((r) => r.ok)) {
      await supabase.from("offers").update({ status: "posted", posted_at: new Date().toISOString() }).eq("id", offer.id);
    }
    return { results };
  });

type TgChat = { id: number; title?: string; username?: string; type: string };
type TgUpdate = {
  message?: { chat: TgChat };
  channel_post?: { chat: TgChat };
  my_chat_member?: { chat: TgChat; new_chat_member?: { status: string } };
};

export const detectTelegramChats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const updates = await telegramCall<TgUpdate[]>("getUpdates", {
      allowed_updates: ["message", "channel_post", "my_chat_member"],
      limit: 100,
    });
    const chats = new Map<string, { chatId: string; title: string; type: string }>();
    for (const u of updates) {
      const chat = u.my_chat_member?.chat ?? u.channel_post?.chat ?? u.message?.chat;
      if (!chat || chat.type === "private") continue;
      if (u.my_chat_member && ["left", "kicked"].includes(u.my_chat_member.new_chat_member?.status ?? "")) {
        chats.delete(String(chat.id));
        continue;
      }
      chats.set(String(chat.id), {
        chatId: String(chat.id),
        title: chat.title ?? chat.username ?? String(chat.id),
        type: chat.type,
      });
    }
    return { chats: [...chats.values()] };
  });

export const sendTelegramTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ chatId: z.string().min(1).max(100) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    await telegramCall("sendMessage", {
      chat_id: data.chatId,
      text: "📡 <b>Radar de Ofertas</b> conectado! As ofertas aprovadas vão chegar aqui.",
      parse_mode: "HTML",
    });
    return { ok: true };
  });
