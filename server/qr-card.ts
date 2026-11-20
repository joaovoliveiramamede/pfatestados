import fs from "fs";
import QRCode from "qrcode";
import { createCanvas, GlobalFonts, loadImage, type SKRSContext2D } from "@napi-rs/canvas";

const INSTRUCTION = "Aponte a câmera para baixar o atestado";
const CARD_WIDTH = 880;
const QR_SIZE = 680;

let fontFamily = "sans-serif";

function registerFont() {
  const candidates = [
    "C:\\Windows\\Fonts\\segoeui.ttf",
    "C:\\Windows\\Fonts\\arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    GlobalFonts.registerFromPath(file, "AtestaCard");
    fontFamily = "AtestaCard";
    return;
  }
}

registerFont();

function wrapText(ctx: SKRSContext2D, text: string, maxWidth: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines.slice(0, 2).map((line, index, all) => {
    if (index < all.length - 1 || ctx.measureText(line).width <= maxWidth) return line;
    let cropped = line;
    while (cropped.length > 1 && ctx.measureText(`${cropped}…`).width > maxWidth) {
      cropped = cropped.slice(0, -1);
    }
    return `${cropped}…`;
  });
}

function roundRect(ctx: SKRSContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

export async function renderQrCard(input: { url: string; paciente: string; codigo: string }) {
  const qr = await QRCode.toBuffer(input.url, {
    width: QR_SIZE,
    margin: 2,
    errorCorrectionLevel: "Q",
    color: { dark: "#12312e", light: "#ffffff" },
  });

  const measure = createCanvas(CARD_WIDTH, 200).getContext("2d");
  measure.font = `600 36px ${fontFamily}`;
  const nameLines = wrapText(measure, input.paciente, CARD_WIDTH - 120);
  const header = 84;
  const footer = 36 + nameLines.length * 46 + 42 + 36 + 48;
  const height = header + QR_SIZE + footer;

  const canvas = createCanvas(CARD_WIDTH, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f4f1ea";
  ctx.fillRect(0, 0, CARD_WIDTH, height);
  roundRect(ctx, 16, 16, CARD_WIDTH - 32, height - 32, 28);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  ctx.fillStyle = "#0e6b64";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 28px ${fontFamily}`;
  ctx.fillText("Atesta", CARD_WIDTH / 2, 52);

  const image = await loadImage(qr);
  const qrX = (CARD_WIDTH - QR_SIZE) / 2;
  ctx.drawImage(image, qrX, header, QR_SIZE, QR_SIZE);

  const footerTop = header + QR_SIZE + 8;
  ctx.strokeStyle = "#e4ddd2";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(72, footerTop);
  ctx.lineTo(CARD_WIDTH - 72, footerTop);
  ctx.stroke();

  let y = footerTop + 42;
  ctx.fillStyle = "#1a2423";
  ctx.font = `600 36px ${fontFamily}`;
  for (const line of nameLines) {
    ctx.fillText(line, CARD_WIDTH / 2, y);
    y += 46;
  }

  ctx.fillStyle = "#0e6b64";
  ctx.font = `700 30px ${fontFamily}`;
  ctx.fillText(input.codigo, CARD_WIDTH / 2, y + 8);
  y += 46;

  ctx.fillStyle = "#5c6b68";
  ctx.font = `400 22px ${fontFamily}`;
  ctx.fillText(INSTRUCTION, CARD_WIDTH / 2, y + 4);

  return canvas.toBuffer("image/png");
}
