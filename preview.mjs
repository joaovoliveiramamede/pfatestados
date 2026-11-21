import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
function appConfig(dir) {
  const env = { DOCTOR_CODE: "MEDICO-2026", CLINIC_NAME: "Atesta" };
  const file = path.join(dir, ".env");
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index === -1) continue;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
      if (key && value) env[key] = value;
    }
  }
  return {
    codigoMedico: env.DOCTOR_CODE,
    clinica: env.CLINIC_NAME,
  };
}

const root = path.resolve(import.meta.dirname);
const dist = path.join(root, "dist");
const uploads = path.join(root, "uploads");
const registrosPath = path.join(uploads, "registros.json");
const port = Number(process.env.PORT) || 4173;
const config = appConfig(root);
const tipos = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".pdf": "application/pdf",
  ".json": "application/json; charset=utf-8",
};

fs.mkdirSync(uploads, { recursive: true });
if (!fs.existsSync(registrosPath)) fs.writeFileSync(registrosPath, "[]\n", "utf8");

function mesmoTexto(esquerda, direita) {
  const a = Buffer.from(String(esquerda).trim().toLocaleUpperCase("pt-BR"));
  const b = Buffer.from(String(direita).trim().toLocaleUpperCase("pt-BR"));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function autorizado(req) {
  return mesmoTexto(req.headers["x-codigo-medico"] || "", config.codigoMedico);
}

function lerCorpo(req, limite) {
  return new Promise((resolve, reject) => {
    const partes = [];
    let tamanho = 0;
    req.on("data", (parte) => {
      tamanho += parte.length;
      if (tamanho > limite) {
        reject(Object.assign(new Error("O envio passou do limite de 8 MB por PDF."), { status: 413 }));
        req.destroy();
        return;
      }
      partes.push(parte);
    });
    req.on("end", () => resolve(Buffer.concat(partes)));
    req.on("error", reject);
  });
}

function responder(res, status, corpo) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(corpo));
}

function lerRegistros() {
  const dados = JSON.parse(fs.readFileSync(registrosPath, "utf8"));
  if (!Array.isArray(dados)) throw Object.assign(new Error("Não foi possível ler os atestados."), { status: 500 });
  return dados;
}

function gravarRegistros(registros) {
  const temporario = `${registrosPath}.tmp`;
  fs.writeFileSync(temporario, `${JSON.stringify(registros, null, 2)}\n`, "utf8");
  fs.renameSync(temporario, registrosPath);
}

function ehPdf(buffer) {
  const limite = Math.min(buffer.length, 1024);
  return buffer.subarray(0, limite).includes(Buffer.from("%PDF-"));
}

function nomePdf(nome) {
  const base = path.basename(String(nome || "atestado.pdf")).replace(/[/\\?%*:|"<>]/g, "").trim();
  const comExtensao = base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
  return comExtensao.slice(0, 120) || "atestado.pdf";
}

function criarCodigo(usados) {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let tentativa = 0; tentativa < 20; tentativa += 1) {
    const bytes = crypto.randomBytes(8);
    const codigo = Array.from(bytes, (byte) => alfabeto[byte % alfabeto.length]).join("");
    if (!usados.has(codigo)) return codigo;
  }
  throw Object.assign(new Error("Não foi possível gerar um código agora."), { status: 500 });
}

function partesMultipart(buffer, tipo) {
  const encontrado = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(String(tipo || ""));
  if (!encontrado) throw Object.assign(new Error("Envio inválido."), { status: 400 });
  const boundary = (encontrado[1] || encontrado[2]).trim();
  const delim = Buffer.from(`--${boundary}`);
  const partes = [];
  let cursor = buffer.indexOf(delim);
  if (cursor < 0) throw Object.assign(new Error("Envio inválido."), { status: 400 });
  cursor += delim.length;
  while (cursor < buffer.length) {
    if (buffer[cursor] === 45 && buffer[cursor + 1] === 45) break;
    if (buffer[cursor] === 13 && buffer[cursor + 1] === 10) cursor += 2;
    else if (buffer[cursor] === 10) cursor += 1;
    const fimCabecalho = buffer.indexOf(Buffer.from("\r\n\r\n"), cursor);
    if (fimCabecalho < 0) break;
    const cabecalho = buffer.subarray(cursor, fimCabecalho).toString("latin1");
    const corpoInicio = fimCabecalho + 4;
    const proximo = buffer.indexOf(Buffer.from(`\r\n${delim}`), corpoInicio);
    if (proximo < 0) break;
    partes.push({ cabecalho, conteudo: buffer.subarray(corpoInicio, proximo) });
    cursor = proximo + 2 + delim.length;
  }
  return partes;
}

function campo(cabecalho, nome) {
  const estrela = cabecalho.match(new RegExp(`${nome}\\*=UTF-8''([^;\\r\\n]+)`, "i"));
  if (estrela) return decodeURIComponent(estrela[1]);
  const simples = cabecalho.match(new RegExp(`${nome}="([^"]*)"`, "i"));
  return simples ? simples[1] : "";
}

function criarEntrega(partes) {
  const textos = new Map();
  const arquivos = [];
  for (const parte of partes) {
    const nome = campo(parte.cabecalho, "name");
    if (nome === "arquivos") {
      arquivos.push({ nome: campo(parte.cabecalho, "filename") || "atestado.pdf", conteudo: parte.conteudo });
      continue;
    }
    textos.set(nome, parte.conteudo.toString("utf8"));
  }

  const paciente = String(textos.get("paciente") || "").trim().replace(/\s+/g, " ");
  const observacao = String(textos.get("observacao") || "").trim().replace(/\s+/g, " ");
  if (paciente.length < 2 || paciente.length > 80) {
    throw Object.assign(new Error("Informe o nome do paciente com 2 a 80 caracteres."), { status: 400 });
  }
  if (observacao.length > 240) {
    throw Object.assign(new Error("A observação pode ter no máximo 240 caracteres."), { status: 400 });
  }
  if (arquivos.length < 1 || arquivos.length > 5) {
    throw Object.assign(new Error("Envie de 1 a 5 PDFs."), { status: 400 });
  }

  const registros = lerRegistros();
  const codigo = criarCodigo(new Set(registros.map((item) => item.codigo)));
  const id = crypto.randomBytes(8).toString("hex");
  const pasta = path.join(uploads, codigo);
  fs.mkdirSync(pasta, { recursive: true });
  const salvos = [];

  try {
    for (const arquivo of arquivos) {
      if (!arquivo.conteudo.length || arquivo.conteudo.length > 8 * 1024 * 1024 || !ehPdf(arquivo.conteudo)) {
        throw Object.assign(new Error(`"${nomePdf(arquivo.nome)}" não é um PDF válido.`), { status: 400 });
      }
      const arquivoId = crypto.randomBytes(8).toString("hex");
      fs.writeFileSync(path.join(pasta, `${arquivoId}.pdf`), arquivo.conteudo);
      salvos.push({
        id: arquivoId,
        nome: nomePdf(arquivo.nome),
        tamanho: arquivo.conteudo.length,
        caminho: `uploads/${codigo}/${arquivoId}.pdf`,
      });
    }
  } catch (error) {
    fs.rmSync(pasta, { recursive: true, force: true });
    throw error;
  }

  const registro = { id, codigo, paciente, observacao, criadoEm: new Date().toISOString(), arquivos: salvos };
  registros.push(registro);
  gravarRegistros(registros);
  return registro;
}

function excluirEntrega(id) {
  if (!/^[a-f0-9]{16}$/.test(id)) throw Object.assign(new Error("Entrega não encontrada."), { status: 404 });
  const registros = lerRegistros();
  const registro = registros.find((item) => item.id === id);
  if (!registro) throw Object.assign(new Error("Entrega não encontrada."), { status: 404 });
  fs.rmSync(path.join(uploads, registro.codigo), { recursive: true, force: true });
  gravarRegistros(registros.filter((item) => item.id !== id));
}

function nomeOriginal(caminhoUrl) {
  for (const registro of lerRegistros()) {
    const arquivo = registro.arquivos.find((item) => `/${item.caminho}` === caminhoUrl);
    if (arquivo) return arquivo.nome;
  }
  return "atestado.pdf";
}

function disposicao(nome) {
  const ascii = nome.replace(/[^\w.\- ]+/g, "_") || "atestado.pdf";
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nome)}`;
}

function arquivoUpload(pathname) {
  if (pathname === "/uploads/registros.json") return registrosPath;
  const relativo = pathname.replace(/^\/uploads\//, "");
  if (!/^[A-Z0-9]{8}\/[a-f0-9]{16}\.pdf$/.test(relativo)) return null;
  const arquivo = path.resolve(uploads, ...relativo.split("/"));
  const base = path.resolve(uploads);
  if (arquivo !== base && !arquivo.startsWith(`${base}${path.sep}`)) return null;
  return arquivo;
}

function arquivoDist(pathname) {
  const pedido = pathname === "/" ? "/index.html" : pathname;
  const arquivo = path.resolve(dist, `.${pedido}`);
  const base = path.resolve(dist);
  if (arquivo !== base && !arquivo.startsWith(`${base}${path.sep}`)) return null;
  return arquivo;
}

function intervalo(range, tamanho) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) return null;
  let inicio = match[1] ? Number(match[1]) : NaN;
  let fim = match[2] ? Number(match[2]) : tamanho - 1;
  if (match[1] === "") {
    const quantidade = Number(match[2]);
    inicio = Math.max(tamanho - quantidade, 0);
    fim = tamanho - 1;
  }
  if (!Number.isInteger(inicio) || !Number.isInteger(fim) || inicio < 0 || inicio >= tamanho || fim < inicio) return null;
  return { inicio, fim: Math.min(fim, tamanho - 1) };
}

function enviarArquivo(req, res, arquivo) {
  if (!arquivo || !fs.existsSync(arquivo) || !fs.statSync(arquivo).isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Não encontrado.");
    return;
  }
  const stat = fs.statSync(arquivo);
  const extensao = path.extname(arquivo);
  const url = new URL(req.url || "/", "http://127.0.0.1");
  const headers = {
    "Content-Type": tipos[extensao] || "application/octet-stream",
    "Accept-Ranges": "bytes",
  };
  if (extensao === ".json" || extensao === ".html") headers["Cache-Control"] = "no-store";
  if (extensao === ".pdf") {
    headers["X-Content-Type-Options"] = "nosniff";
    if (url.searchParams.get("baixar") === "1") headers["Content-Disposition"] = disposicao(nomeOriginal(url.pathname));
  }

  const faixa = req.headers.range ? intervalo(req.headers.range, stat.size) : null;
  if (req.headers.range && !faixa) {
    res.writeHead(416, { "Content-Range": `bytes */${stat.size}` }).end();
    return;
  }
  if (faixa) {
    headers["Content-Range"] = `bytes ${faixa.inicio}-${faixa.fim}/${stat.size}`;
    headers["Content-Length"] = faixa.fim - faixa.inicio + 1;
    res.writeHead(206, headers);
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(arquivo, { start: faixa.inicio, end: faixa.fim }).pipe(res);
    return;
  }

  headers["Content-Length"] = stat.size;
  res.writeHead(200, headers);
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(arquivo).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const pathname = decodeURIComponent(url.pathname);

    if (req.method === "POST" && pathname === "/api/entregas") {
      if (!autorizado(req)) return responder(res, 401, { erro: "Código do médico inválido." });
      const bruto = await lerCorpo(req, 46 * 1024 * 1024);
      const partes = partesMultipart(bruto, req.headers["content-type"]);
      return responder(res, 201, criarEntrega(partes));
    }

    if (req.method === "DELETE" && pathname.startsWith("/api/entregas/")) {
      if (!autorizado(req)) return responder(res, 401, { erro: "Código do médico inválido." });
      excluirEntrega(pathname.slice("/api/entregas/".length));
      return responder(res, 200, { ok: true });
    }

    if (req.method !== "GET" && req.method !== "HEAD") return responder(res, 404, { erro: "Rota não encontrada." });
    if (pathname.startsWith("/uploads/")) return enviarArquivo(req, res, arquivoUpload(pathname));
    return enviarArquivo(req, res, arquivoDist(pathname));
  } catch (error) {
    if (res.headersSent) return;
    const status = error.status || 500;
    const mensagem = status === 500 ? "Não foi possível concluir essa ação." : error.message;
    if (status === 500) console.error(error);
    responder(res, status, { erro: mensagem });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Atesta em http://127.0.0.1:${port}/`);
  console.log(`PDFs em ${uploads}`);
});
