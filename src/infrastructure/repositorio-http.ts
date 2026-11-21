import type { RepositorioEntrega } from "../application/repositorio-entrega";
import type { NovaEntrega, Registro } from "../domain/tipos";

const AVISO_PUBLICADO =
  "Neste site publicado não dá para incluir um PDF novo. Os atestados da lista usam Ver QR. Para um atestado novo, gere no computador com npm start, faça o build e envie a pasta dist outra vez.";

function ehHtml(texto: string, tipo: string | null) {
  return (tipo || "").includes("text/html") || texto.trimStart().startsWith("<");
}

function mensagemErro(texto: string) {
  try {
    const dados = JSON.parse(texto) as { erro?: unknown };
    if (dados && typeof dados.erro === "string") return dados.erro;
  } catch {
    return AVISO_PUBLICADO;
  }
  return "Não foi possível gravar o PDF na pasta uploads. Use o site local e publique de novo.";
}

export const repositorioHttp: RepositorioEntrega = {
  async listar() {
    const resposta = await fetch("/uploads/registros.json", { cache: "no-store" });
    if (!resposta.ok) throw new Error("Não foi possível carregar os atestados.");
    let dados: unknown;
    try {
      dados = JSON.parse(await resposta.text());
    } catch {
      throw new Error("Não foi possível carregar os atestados.");
    }
    if (!Array.isArray(dados)) throw new Error("Não foi possível carregar os atestados.");
    return dados as Registro[];
  },
  async criar(entrega: NovaEntrega, codigoMedico: string) {
    const body = new FormData();
    body.set("paciente", entrega.paciente);
    body.set("observacao", entrega.observacao);
    entrega.arquivos.forEach((arquivo) => body.append("arquivos", arquivo, arquivo.name));
    const resposta = await fetch("/api/entregas", {
      method: "POST",
      headers: { "X-Codigo-Medico": codigoMedico },
      body,
    });
    const texto = await resposta.text();
    if (!resposta.ok || ehHtml(texto, resposta.headers.get("content-type"))) throw new Error(mensagemErro(texto));
    try {
      return JSON.parse(texto) as Registro;
    } catch {
      throw new Error(AVISO_PUBLICADO);
    }
  },
  async excluir(id: string, codigoMedico: string) {
    const resposta = await fetch(`/api/entregas/${id}`, {
      method: "DELETE",
      headers: { "X-Codigo-Medico": codigoMedico },
    });
    const texto = await resposta.text();
    if (!resposta.ok || ehHtml(texto, resposta.headers.get("content-type"))) throw new Error(mensagemErro(texto));
  },
};
