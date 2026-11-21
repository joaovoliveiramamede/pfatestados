import { criarCodigo, criarId } from "../domain/codigo";
import type { NovaEntrega, Registro } from "../domain/tipos";
import type { ConfigS3 } from "./ambiente";
import type { RepositorioEntrega } from "../application/repositorio-entrega";
import { autorizacaoS3, caminhoS3, dataAmz, sha256Hex } from "./s3";

const encoder = new TextEncoder();
const HASH_VAZIO = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

function nomePdf(nome: string) {
  const base = nome.split(/[/\\]/).pop()?.replace(/[?%*:|"<>]/g, "").trim() || "atestado.pdf";
  const comExtensao = base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
  return comExtensao.slice(0, 120) || "atestado.pdf";
}

function mensagemS3(codigo: string) {
  if (codigo === "AccessDenied") return "O S3 recusou a gravação. A chave precisa poder gravar a pasta uploads.";
  if (codigo === "InvalidAccessKeyId") return "A chave de acesso do S3 não foi reconhecida.";
  if (codigo === "SignatureDoesNotMatch") return "A assinatura do S3 não confere. Confira a região e a chave secreta.";
  if (codigo === "NoSuchBucket") return "O bucket informado não existe.";
  if (codigo === "PermanentRedirect" || codigo === "AuthorizationHeaderMalformed") return "A região do bucket está incorreta.";
  return codigo ? `Não foi possível gravar no S3 (${codigo}).` : "Não foi possível gravar no S3.";
}

async function lerCodigo(resposta: Response) {
  const texto = await resposta.text();
  const codigo = texto.match(/<Code>([^<]+)<\/Code>/)?.[1] || "";
  return mensagemS3(codigo);
}

export function criarRepositorioS3(config: ConfigS3): RepositorioEntrega {
  const host = `${config.bucket}.s3.${config.region}.amazonaws.com`;

  async function pedir(method: "GET" | "PUT" | "DELETE", chave: string, body?: Uint8Array, contentType?: string, cacheControl?: string) {
    const payload = body ?? new Uint8Array();
    const payloadHash = body ? await sha256Hex(payload) : HASH_VAZIO;
    const extras: Record<string, string> = {};
    if (contentType) extras["content-type"] = contentType;
    if (cacheControl) extras["cache-control"] = cacheControl;
    const amzDate = dataAmz();
    const authorization = await autorizacaoS3({
      method,
      host,
      path: `/${caminhoS3(chave)}`,
      region: config.region,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      payloadHash,
      amzDate,
      headers: extras,
    });
    const headers: Record<string, string> = {
      Authorization: authorization,
      "x-amz-date": amzDate,
      "x-amz-content-sha256": payloadHash,
    };
    if (contentType) headers["Content-Type"] = contentType;
    if (cacheControl) headers["Cache-Control"] = cacheControl;
    const corpo = body ? new Uint8Array(body.byteLength) : undefined;
    corpo?.set(body as Uint8Array);
    let resposta: Response;
    try {
      resposta = await fetch(`https://${host}/${caminhoS3(chave)}`, {
        method,
        headers,
        body: corpo?.buffer,
      });
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error(`O navegador bloqueou o envio. No bucket, libere o CORS para ${window.location.origin}.`);
      }
      throw error;
    }
    if (!resposta.ok && !(method === "GET" && resposta.status === 404)) throw new Error(await lerCodigo(resposta));
    return resposta;
  }

  async function lerRegistros() {
    const resposta = await pedir("GET", "uploads/registros.json");
    if (resposta.status === 404) return [] as Registro[];
    const dados = JSON.parse(await resposta.text()) as unknown;
    if (!Array.isArray(dados)) throw new Error("Não foi possível ler os atestados.");
    return dados as Registro[];
  }

  async function gravarRegistros(registros: Registro[]) {
    await pedir("PUT", "uploads/registros.json", encoder.encode(`${JSON.stringify(registros, null, 2)}\n`), "application/json; charset=utf-8", "max-age=0, no-cache");
  }

  async function listarPublico() {
    const resposta = await fetch("/uploads/registros.json", { cache: "no-store" });
    if (!resposta.ok) return [] as Registro[];
    const texto = await resposta.text();
    if (texto.trimStart().startsWith("<")) return [] as Registro[];
    const dados = JSON.parse(texto) as unknown;
    return Array.isArray(dados) ? (dados as Registro[]) : [];
  }

  const repositorio: RepositorioEntrega = {
    async listar() {
      try {
        return await lerRegistros();
      } catch {
        return listarPublico();
      }
    },
    async obter(codigo: string) {
      const publico = await fetch(`/uploads/${codigo}/entrega.json`, { cache: "no-store" }).catch(() => null);
      if (publico?.ok) {
        const texto = await publico.text();
        if (!texto.trimStart().startsWith("<")) {
          try {
            const dados = JSON.parse(texto) as Registro;
            if (dados?.codigo === codigo) return dados;
          } catch {
            /* tenta o arquivo direto no bucket */
          }
        }
      }
      try {
        const resposta = await pedir("GET", `uploads/${codigo}/entrega.json`);
        if (resposta.status !== 404) {
          const dados = JSON.parse(await resposta.text()) as Registro;
          if (dados?.codigo === codigo) return dados;
        }
      } catch {
        /* a lista segue como reserva */
      }
      const registros = await repositorio.listar();
      return registros.find((item) => item.codigo === codigo) ?? null;
    },
    async criar(entrega: NovaEntrega) {
      const registros = await lerRegistros().catch(() => listarPublico());
      const codigo = criarCodigo(new Set(registros.map((item) => item.codigo)));
      const id = criarId();
      const salvos = [];
      const enviados: string[] = [];
      try {
        for (const arquivo of entrega.arquivos) {
          const arquivoId = criarId();
          const chave = `uploads/${codigo}/${arquivoId}.pdf`;
          const bytes = new Uint8Array(await arquivo.arrayBuffer());
          await pedir("PUT", chave, bytes, "application/pdf", "public, max-age=31536000");
          enviados.push(chave);
          salvos.push({ id: arquivoId, nome: nomePdf(arquivo.name), tamanho: arquivo.size, caminho: chave });
        }
        const registro: Registro = {
          id,
          codigo,
          paciente: entrega.paciente,
          observacao: entrega.observacao,
          criadoEm: new Date().toISOString(),
          arquivos: salvos,
        };
        const entregaChave = `uploads/${codigo}/entrega.json`;
        await pedir("PUT", entregaChave, encoder.encode(JSON.stringify(registro)), "application/json; charset=utf-8", "public, max-age=86400");
        enviados.push(entregaChave);
        registros.push(registro);
        await gravarRegistros(registros);
        return registro;
      } catch (error) {
        await Promise.all(enviados.map((chave) => pedir("DELETE", chave).catch(() => undefined)));
        throw error;
      }
    },
    async excluir(id: string) {
      const registros = await lerRegistros();
      const registro = registros.find((item) => item.id === id);
      if (!registro) throw new Error("Entrega não encontrada.");
      await Promise.all([
        ...registro.arquivos.map((arquivo) => pedir("DELETE", arquivo.caminho)),
        pedir("DELETE", `uploads/${registro.codigo}/entrega.json`).catch(() => undefined),
      ]);
      await gravarRegistros(registros.filter((item) => item.id !== id));
    },
  };

  return repositorio;
}
