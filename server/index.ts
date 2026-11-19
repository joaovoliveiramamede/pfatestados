import crypto from "crypto";
import fs from "fs";
import http from "http";
import path from "path";
import express, { type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import QRCode from "qrcode";
import { createServer as createViteServer } from "vite";

const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.resolve(__dirname, "..");
const DATA_FILE = path.join(ROOT, "data", "entregas.json");
const UPLOADS_DIR = path.join(ROOT, "uploads");
const INCOMING_DIR = path.join(UPLOADS_DIR, "_incoming");

const ADMIN_USER = "admin";
const ADMIN_PASSWORD = "atesta123";
const sessions = new Set<string>();
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

type Arquivo = { id: string; nome: string; tamanho: number };
type Entrega = {
  id: string;
  codigo: string;
  paciente: string;
  observacao: string;
  criadoEm: string;
  arquivos: Arquivo[];
};

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

fs.mkdirSync(INCOMING_DIR, { recursive: true });
fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]\n", "utf8");

function loadEntregas(): Entrega[] {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    if (!Array.isArray(parsed)) return [];
    return parsed as Entrega[];
  } catch {
    throw new HttpError(500, "Não foi possível ler os atestados salvos.");
  }
}

function saveEntregas(entregas: Entrega[]) {
  fs.writeFileSync(DATA_FILE, `${JSON.stringify(entregas, null, 2)}\n`, "utf8");
}

function parseCookies(req: Request) {
  const header = req.headers.cookie || "";
  const cookies: Record<string, string> = {};
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    if (!key) continue;
    cookies[key] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return cookies;
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = parseCookies(req).atesta_session;
  if (!token || !sessions.has(token)) {
    res.status(401).json({ erro: "Faça login para continuar." });
    return;
  }
  next();
}

function setSessionCookie(res: Response, token: string) {
  res.setHeader(
    "Set-Cookie",
    `atesta_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200`,
  );
}

function clearSessionCookie(res: Response) {
  res.setHeader("Set-Cookie", "atesta_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
}

function isHexId(value: string) {
  return /^[a-f0-9]{16}$/.test(value);
}

function normalizeCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function formatCode(code: string) {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

function createCode(existing: Entrega[]) {
  const used = new Set(existing.map((item) => item.codigo));
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const bytes = crypto.randomBytes(8);
    const code = Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
    if (!used.has(code)) return code;
  }
  throw new HttpError(500, "Não foi possível gerar um código agora.");
}

function publicOrigin(req: Request) {
  const proto = req.get("x-forwarded-proto") || req.protocol;
  const host = req.get("x-forwarded-host") || req.get("host");
  return `${proto}://${host}`;
}

function linkFor(req: Request, codigo: string) {
  return `${publicOrigin(req)}/acesso/${codigo}`;
}

function originalName(file: Express.Multer.File) {
  const raw = file.originalname || "atestado.pdf";
  const utf8 = Buffer.from(raw, "latin1").toString("utf8");
  const chosen = utf8.includes("\uFFFD") ? raw : utf8;
  const base = path.win32.basename(path.posix.basename(chosen)).replace(/[\r\n"]/g, "").trim();
  return base || "atestado.pdf";
}

function isPdfFile(filePath: string) {
  let fd: number | undefined;
  try {
    fd = fs.openSync(filePath, "r");
    const header = Buffer.alloc(5);
    const read = fs.readSync(fd, header, 0, 5, 0);
    return read === 5 && header.toString("utf8") === "%PDF-";
  } catch {
    return false;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

function removeUploaded(files: Express.Multer.File[]) {
  for (const file of files) fs.rmSync(file.path, { force: true });
}

function assertInsideUploads(filePath: string) {
  const resolved = path.resolve(filePath);
  const relative = path.relative(path.resolve(UPLOADS_DIR), resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new HttpError(404, "O PDF não está mais disponível.");
  }
  return resolved;
}

function toPublic(req: Request, entrega: Entrega) {
  return {
    id: entrega.id,
    codigo: entrega.codigo,
    codigoFormatado: formatCode(entrega.codigo),
    paciente: entrega.paciente,
    observacao: entrega.observacao,
    criadoEm: entrega.criadoEm,
    link: linkFor(req, entrega.codigo),
    arquivos: entrega.arquivos.map((arquivo) => ({
      id: arquivo.id,
      nome: arquivo.nome,
      tamanho: arquivo.tamanho,
    })),
  };
}

function contentDisposition(name: string, inline: boolean) {
  const cleaned = name.replace(/[\r\n"]/g, "") || "atestado.pdf";
  const ascii = cleaned.replace(/[^\w.\- ]+/g, "_");
  const type = inline ? "inline" : "attachment";
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(cleaned)}`;
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(INCOMING_DIR, { recursive: true });
      cb(null, INCOMING_DIR);
    },
    filename: (_req, _file, cb) => {
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.pdf`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    const name = (file.originalname || "").toLowerCase();
    const mimeOk = file.mimetype === "application/pdf" || file.mimetype === "application/octet-stream";
    if (!name.endsWith(".pdf") || !mimeOk) {
      cb(new HttpError(400, "Envie apenas arquivos PDF."));
      return;
    }
    cb(null, true);
  },
});

function blockPrivateFiles(req: Request, res: Response, next: NextFunction) {
  let url = req.originalUrl;
  try {
    url = decodeURIComponent(req.originalUrl);
  } catch {
    url = req.originalUrl;
  }
  const lower = url.toLowerCase();
  const blocked =
    ["/data", "/uploads", "/server", "/package.json", "/tsconfig"].some((prefix) => lower.startsWith(prefix)) ||
    lower.includes("/uploads/") ||
    lower.includes("/data/") ||
    lower.includes("entregas.json");
  if (blocked) {
    res.status(404).type("text/plain").send("Não encontrado.");
    return;
  }
  next();
}

function filesOf(req: Request) {
  return Array.isArray(req.files) ? req.files : [];
}

const api = express.Router();
api.use(express.json({ limit: "32kb" }));

api.post("/admin/login", (req, res) => {
  const usuario = String(req.body?.usuario || "").trim();
  const senha = String(req.body?.senha || "");
  if (!safeEqual(usuario, ADMIN_USER) || !safeEqual(senha, ADMIN_PASSWORD)) {
    res.status(401).json({ erro: "Usuário ou senha incorretos." });
    return;
  }
  const token = crypto.randomBytes(24).toString("hex");
  sessions.add(token);
  setSessionCookie(res, token);
  res.json({ ok: true, usuario: ADMIN_USER });
});

api.post("/admin/logout", (req, res) => {
  const token = parseCookies(req).atesta_session;
  if (token) sessions.delete(token);
  clearSessionCookie(res);
  res.json({ ok: true });
});

api.get("/admin/me", requireAdmin, (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ ok: true, usuario: ADMIN_USER });
});

api.get("/admin/entregas", requireAdmin, (req, res, next) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    const entregas = loadEntregas().sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
    res.json({ entregas: entregas.map((item) => toPublic(req, item)) });
  } catch (error) {
    next(error);
  }
});

api.post("/admin/entregas", requireAdmin, (req, res, next) => {
  upload.array("arquivos", 5)(req, res, (uploadError) => {
    if (uploadError) {
      next(uploadError);
      return;
    }
    const files = filesOf(req);
    let dir = "";
    try {
      const paciente = String(req.body?.paciente || "").trim().replace(/\s+/g, " ");
      const observacao = String(req.body?.observacao || "").trim().replace(/\s+/g, " ");
      if (paciente.length < 2 || paciente.length > 80) {
        throw new HttpError(400, "Informe o nome do paciente com 2 a 80 caracteres.");
      }
      if (observacao.length > 240) {
        throw new HttpError(400, "A observação pode ter no máximo 240 caracteres.");
      }
      if (!files.length) throw new HttpError(400, "Anexe pelo menos um PDF.");

      for (const file of files) {
        if (!isPdfFile(file.path)) {
          throw new HttpError(400, `"${originalName(file)}" não é um PDF válido.`);
        }
      }

      const entregas = loadEntregas();
      const id = crypto.randomBytes(8).toString("hex");
      const codigo = createCode(entregas);
      dir = path.join(UPLOADS_DIR, id);
      fs.mkdirSync(dir, { recursive: true });

      const arquivos: Arquivo[] = [];
      for (const file of files) {
        const arquivoId = crypto.randomBytes(8).toString("hex");
        fs.copyFileSync(file.path, path.join(dir, `${arquivoId}.pdf`));
        fs.rmSync(file.path, { force: true });
        arquivos.push({ id: arquivoId, nome: originalName(file), tamanho: file.size });
      }

      const entrega: Entrega = {
        id,
        codigo,
        paciente,
        observacao,
        criadoEm: new Date().toISOString(),
        arquivos,
      };
      entregas.push(entrega);
      saveEntregas(entregas);
      dir = "";
      res.status(201).json({ entrega: toPublic(req, entrega) });
    } catch (error) {
      if (dir) fs.rmSync(dir, { recursive: true, force: true });
      removeUploaded(files);
      next(error);
    }
  });
});

api.delete("/admin/entregas/:id", requireAdmin, (req, res, next) => {
  try {
    const id = req.params.id;
    if (!isHexId(id)) throw new HttpError(404, "Entrega não encontrada.");
    const entregas = loadEntregas();
    const entrega = entregas.find((item) => item.id === id);
    if (!entrega || !isHexId(entrega.id)) throw new HttpError(404, "Entrega não encontrada.");
    fs.rmSync(path.join(UPLOADS_DIR, entrega.id), { recursive: true, force: true });
    saveEntregas(entregas.filter((item) => item.id !== id));
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

api.get("/admin/entregas/:id/qr.png", requireAdmin, async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!isHexId(id)) throw new HttpError(404, "Entrega não encontrada.");
    const entrega = loadEntregas().find((item) => item.id === id);
    if (!entrega) throw new HttpError(404, "Entrega não encontrada.");
    const png = await QRCode.toBuffer(linkFor(req, entrega.codigo), {
      width: 640,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0a4f4a", light: "#ffffff" },
    });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(png);
  } catch (error) {
    next(error);
  }
});

api.get("/acesso/:codigo", (req, res, next) => {
  try {
    const codigo = normalizeCode(req.params.codigo);
    if (codigo.length !== 8) throw new HttpError(404, "Não encontramos atestados para esse código.");
    const entrega = loadEntregas().find((item) => item.codigo === codigo);
    if (!entrega) throw new HttpError(404, "Não encontramos atestados para esse código.");
    res.setHeader("Cache-Control", "no-store");
    res.json({ entrega: toPublic(req, entrega) });
  } catch (error) {
    next(error);
  }
});

api.get("/acesso/:codigo/arquivos/:arquivoId", (req, res, next) => {
  try {
    const codigo = normalizeCode(req.params.codigo);
    const arquivoId = req.params.arquivoId;
    if (codigo.length !== 8 || !isHexId(arquivoId)) {
      throw new HttpError(404, "Atestado não encontrado.");
    }
    const entrega = loadEntregas().find((item) => item.codigo === codigo);
    const arquivo = entrega?.arquivos.find((item) => item.id === arquivoId);
    if (!entrega || !arquivo || !isHexId(entrega.id)) {
      throw new HttpError(404, "Atestado não encontrado.");
    }
    const filePath = assertInsideUploads(path.join(UPLOADS_DIR, entrega.id, `${arquivo.id}.pdf`));
    if (!fs.existsSync(filePath)) throw new HttpError(404, "O PDF não está mais disponível.");
    const inline = req.query.ver === "1";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", contentDisposition(arquivo.nome, inline));
    res.setHeader("Cache-Control", "private, no-store");
    res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
});

api.use((_req, res) => {
  res.status(404).json({ erro: "Rota não encontrada." });
});

api.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ erro: "Cada PDF pode ter no máximo 8 MB." });
      return;
    }
    if (error.code === "LIMIT_FILE_COUNT" || error.code === "LIMIT_UNEXPECTED_FILE") {
      res.status(400).json({ erro: "Envie no máximo 5 PDFs por vez." });
      return;
    }
  }
  const status = error instanceof HttpError ? error.status : 500;
  const message = status === 500 ? "Não foi possível concluir essa ação." : error instanceof Error ? error.message : "Não foi possível concluir essa ação.";
  if (status === 500) console.error(error);
  res.status(status).json({ erro: message });
});

async function main() {
  const app = express();
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  });
  app.use("/api", api);
  app.use(blockPrivateFiles);

  const httpServer = http.createServer(app);
  const vite = await createViteServer({
    root: ROOT,
    appType: "spa",
    server: {
      middlewareMode: true,
      hmr: { server: httpServer },
      watch: { ignored: ["**/uploads/**", "**/data/**"] },
    },
  });
  app.use(vite.middlewares);

  httpServer.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      console.error(`A porta ${PORT} já está em uso.`);
      process.exit(1);
    }
    console.error(error);
    process.exit(1);
  });

  httpServer.listen(PORT, () => {
    console.log(`Atesta rodando em http://localhost:${PORT}`);
    console.log("Admin de demonstração: usuário admin · senha atesta123");
    console.log(`PDFs salvos em ${UPLOADS_DIR}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
