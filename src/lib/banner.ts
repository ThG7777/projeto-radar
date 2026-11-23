// Browser-only banner renderer (1080x1080 PNG). Colors come from the CSS design tokens.
import { formatBRL } from "./format";

export type BannerInput = {
  imageDataUrl: string | null;
  title: string;
  price: number;
  originalPrice: number | null;
  discountPct: number;
  coupon: string | null;
  brand: string;
};

const SIZE = 1080;

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#000";
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Falha ao carregar a imagem do produto"));
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines) break;
    } else line = test;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    let last = lines[maxLines - 1]!;
    while (ctx.measureText(`${last}…`).width > maxWidth && last.length > 0) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last.trimEnd()}…`;
  }
  return lines;
}

export async function renderBanner(input: BannerInput): Promise<HTMLCanvasElement> {
  const display = '"Bricolage Grotesque", sans-serif';
  const body = '"Figtree", sans-serif';
  await Promise.all([
    document.fonts.load(`800 96px ${display}`),
    document.fonts.load(`700 40px ${body}`),
    document.fonts.load(`500 32px ${body}`),
  ]).catch(() => undefined);

  const c = {
    bg: token("--background"),
    card: token("--card"),
    fg: token("--foreground"),
    muted: token("--muted-foreground"),
    primary: token("--primary"),
    primaryFg: token("--primary-foreground"),
    deal: token("--deal"),
    dealFg: token("--deal-foreground"),
    paper: token("--paper"),
    border: token("--border"),
  };

  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;

  // Background + radar rings
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = c.primary;
  ctx.lineWidth = 3;
  for (const r of [180, 320, 460, 600]) {
    ctx.beginPath();
    ctx.arc(SIZE - 40, 40, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // Header: brand
  ctx.fillStyle = c.primary;
  ctx.beginPath();
  ctx.arc(76, 78, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `800 40px ${display}`;
  ctx.fillStyle = c.fg;
  ctx.textBaseline = "middle";
  ctx.fillText(input.brand.toUpperCase(), 106, 80);

  // Product card
  const cardX = 60, cardY = 140, cardW = SIZE - 120, cardH = 520;
  roundRect(ctx, cardX, cardY, cardW, cardH, 36);
  ctx.fillStyle = c.paper;
  ctx.fill();
  if (input.imageDataUrl) {
    try {
      const img = await loadImage(input.imageDataUrl);
      const pad = 36;
      const maxW = cardW - pad * 2, maxH = cardH - pad * 2;
      const scale = Math.min(maxW / img.width, maxH / img.height);
      const w = img.width * scale, h = img.height * scale;
      ctx.save();
      roundRect(ctx, cardX, cardY, cardW, cardH, 36);
      ctx.clip();
      ctx.drawImage(img, cardX + (cardW - w) / 2, cardY + (cardH - h) / 2, w, h);
      ctx.restore();
    } catch {
      /* keep empty card */
    }
  }

  // Discount badge
  if (input.discountPct > 0) {
    const bx = cardX + cardW - 110, by = cardY + 20;
    ctx.save();
    ctx.translate(bx, by + 90);
    ctx.rotate(-0.12);
    ctx.fillStyle = c.deal;
    ctx.beginPath();
    ctx.arc(0, 0, 105, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.dealFg;
    ctx.textAlign = "center";
    ctx.font = `800 70px ${display}`;
    ctx.fillText(`-${input.discountPct}%`, 0, -4);
    ctx.font = `700 26px ${body}`;
    ctx.fillText("OFF", 0, 50);
    ctx.restore();
  }

  // Title
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = c.fg;
  ctx.font = `700 44px ${body}`;
  const lines = wrapLines(ctx, input.title, SIZE - 120, 2);
  lines.forEach((l, i) => ctx.fillText(l, 60, 730 + i * 54));

  // Prices
  const priceY = 730 + lines.length * 54 + 90;
  if (input.originalPrice && input.originalPrice > input.price) {
    ctx.font = `500 36px ${body}`;
    ctx.fillStyle = c.muted;
    const old = `de ${formatBRL(input.originalPrice)}`;
    ctx.fillText(old, 60, priceY - 72);
    const w = ctx.measureText(old).width;
    ctx.strokeStyle = c.deal;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(60 + 44, priceY - 84);
    ctx.lineTo(60 + w, priceY - 84);
    ctx.stroke();
  }
  ctx.font = `800 112px ${display}`;
  ctx.fillStyle = c.primary;
  ctx.fillText(formatBRL(input.price), 52, priceY + 20);

  // Coupon pill
  if (input.coupon) {
    ctx.font = `700 34px ${body}`;
    const text = `CUPOM: ${input.coupon.toUpperCase()}`;
    const tw = ctx.measureText(text).width;
    const px = SIZE - 60 - tw - 56, py = SIZE - 120;
    roundRect(ctx, px, py, tw + 56, 72, 36);
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = c.primary;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = c.primary;
    ctx.textBaseline = "middle";
    ctx.fillText(text, px + 28, py + 38);
  }

  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao gerar a imagem"))), "image/png"),
  );
}
