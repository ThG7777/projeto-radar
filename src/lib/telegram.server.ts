const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

export async function telegramCall<T = unknown>(method: string, body: Record<string, unknown>): Promise<T> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const telegramKey = process.env["TELEGRAM_API_KEY"];
  if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");
  if (!telegramKey) throw new Error("O Telegram não está conectado a este projeto.");

  const res = await fetch(`${GATEWAY_URL}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": telegramKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: { ok?: boolean; result?: T; description?: string } = {};
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON */
  }
  if (!res.ok || !json.ok) {
    console.error(`Telegram ${method} failed [${res.status}]: ${text}`);
    throw new Error(json.description ? `Telegram: ${json.description}` : `Telegram respondeu ${res.status}`);
  }
  return json.result as T;
}
