import QRCode from "qrcode";

const FONTE = "Segoe UI, sans-serif";
const INSTRUCAO = "Aponte a câmera para baixar o atestado";

function quebrar(ctx: CanvasRenderingContext2D, texto: string, largura: number) {
  const palavras = texto.trim().split(/\s+/).filter(Boolean);
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of palavras) {
    const proxima = atual ? `${atual} ${palavra}` : palavra;
    if (ctx.measureText(proxima).width <= largura) {
      atual = proxima;
      continue;
    }
    if (atual) linhas.push(atual);
    atual = palavra;
  }
  if (atual) linhas.push(atual);
  return linhas.slice(0, 2);
}

function carregarImagem(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const imagem = new Image();
    imagem.onload = () => resolve(imagem);
    imagem.onerror = () => reject(new Error("Não foi possível montar o QR Code."));
    imagem.src = src;
  });
}

export async function renderizarQr(input: { clinica: string; url: string; paciente: string; codigo: string }) {
  const qrUrl = await QRCode.toDataURL(input.url, {
    width: 720,
    margin: 1,
    errorCorrectionLevel: "Q",
    color: { dark: "#000000", light: "#ffffff" },
  });
  const imagem = await carregarImagem(qrUrl);
  const largura = 840;
  const qr = 640;
  const medida = document.createElement("canvas").getContext("2d");
  if (!medida) throw new Error("Não foi possível gerar a imagem.");
  medida.font = `600 34px ${FONTE}`;
  const linhasNome = quebrar(medida, input.paciente, largura - 120);
  const altura = 92 + qr + 36 + linhasNome.length * 44 + 92;
  const tela = document.createElement("canvas");
  tela.width = largura;
  tela.height = altura;
  const ctx = tela.getContext("2d");
  if (!ctx) throw new Error("Não foi possível gerar a imagem.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, largura, altura);
  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 26px ${FONTE}`;
  ctx.fillText(input.clinica, largura / 2, 48);
  ctx.drawImage(imagem, (largura - qr) / 2, 84, qr, qr);

  let y = 84 + qr + 36;
  ctx.font = `600 34px ${FONTE}`;
  for (const linha of linhasNome) {
    ctx.fillText(linha, largura / 2, y);
    y += 44;
  }
  ctx.font = `700 28px ${FONTE}`;
  ctx.fillText(input.codigo, largura / 2, y + 8);
  ctx.font = `400 22px ${FONTE}`;
  ctx.fillText(INSTRUCAO, largura / 2, y + 48);

  const blob = await new Promise<Blob>((resolve, reject) => {
    tela.toBlob((resultado) => (resultado ? resolve(resultado) : reject(new Error("Não foi possível gerar a imagem."))), "image/png");
  });
  return blob;
}
