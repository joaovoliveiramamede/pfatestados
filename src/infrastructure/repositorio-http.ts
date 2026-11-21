import type { RepositorioEntrega } from "../application/repositorio-entrega";
import type { NovaEntrega, Registro } from "../domain/tipos";

async function lerJson(resposta: Response) {
  const texto = await resposta.text();
  try {
    return JSON.parse(texto) as unknown;
  } catch {
    throw new Error("Não foi possível gerar o QR Code. Rode o site com npm start e use esse endereço local.");
  }
}

async function lerErro(resposta: Response) {
  const dados = await lerJson(resposta).catch(() => null);
  if (dados && typeof dados === "object" && "erro" in dados && typeof dados.erro === "string") return dados.erro;
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
    if (!resposta.ok) throw new Error(await lerErro(resposta));
    return (await lerJson(resposta)) as Registro;
  },
  async excluir(id: string, codigoMedico: string) {
    const resposta = await fetch(`/api/entregas/${id}`, {
      method: "DELETE",
      headers: { "X-Codigo-Medico": codigoMedico },
    });
    if (!resposta.ok) throw new Error(await lerErro(resposta));
  },
};
