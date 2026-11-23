import { generateResponse, GatewayError } from "@lovable.dev/ai-gateway";

export type CopyResult = { headline: string; shortTitle: string };

/** Writes only the hook line and a short product title; prices/links are filled from data. */
export async function writeOfferCopy(input: {
  title: string;
  price: number;
  discountPct: number;
  shopName: string | null;
}): Promise<CopyResult> {
  try {
    const res = await generateResponse({
      model: "openai/gpt-6.1-sol",
      instructions:
        "Você é redator de um grupo brasileiro de ofertas chamado Radar das Ofertas. Escreva em português do Brasil, tom animado mas honesto, sem prometer o que não está nos dados, sem inventar preços, sem hashtags.",
      input: [
        {
          role: "user",
          content: `Produto: ${input.title}\nPreço: R$ ${input.price.toFixed(2)}\nDesconto: ${input.discountPct}%\nLoja: ${input.shopName ?? "—"}\n\nCrie:\n- headline: uma chamada curta e vendedora (máx. 45 caracteres), sem emoji.\n- shortTitle: o nome do produto limpo e curto (máx. 70 caracteres), sem códigos, sem caixa alta exagerada.`,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "offer_copy",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["headline", "shortTitle"],
            properties: { headline: { type: "string" }, shortTitle: { type: "string" } },
          },
        },
      },
    });
    let text = "";
    for (const item of res.output ?? []) {
      if (item.type === "message") {
        for (const c of item.content) if (c.type === "output_text") text += c.text;
      }
    }
    const parsed = JSON.parse(text) as CopyResult;
    return { headline: parsed.headline.trim(), shortTitle: parsed.shortTitle.trim() };
  } catch (e) {
    if (e instanceof GatewayError) {
      console.error("AI copy failed", e.code, e.httpStatus, e.message);
      throw new Error(
        e.httpStatus === 402
          ? "Sem créditos de IA no momento. Adicione créditos para gerar textos."
          : e.httpStatus === 429
            ? "Muitas gerações seguidas. Espere um pouco e tente de novo."
            : "Não consegui gerar o texto agora. Tente de novo em instantes.",
      );
    }
    throw e;
  }
}
