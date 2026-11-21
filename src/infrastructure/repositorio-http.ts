import type { RepositorioEntrega } from "../application/repositorio-entrega";
import type { NovaEntrega, Registro } from "../domain/tipos";

async function lerErro(resposta: Response) {
  const dados = await resposta.json().catch(() => null);
  if (dados && typeof dados === "object" && "erro" in dados && typeof dados.erro === "string") return dados.erro;
  return "Não foi possível gravar o PDF na pasta uploads. Use o site local e publique de novo.";
}

export const repositorioHttp: RepositorioEntrega = {
  async listar() {
    const resposta = await fetch("/uploads/registros.json", { cache: "no-store" });
    if (!resposta.ok) throw new Error("Não foi possível carregar os atestados.");
    const dados: unknown = await resposta.json();
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
    return (await resposta.json()) as Registro;
  },
  async excluir(id: string, codigoMedico: string) {
    const resposta = await fetch(`/api/entregas/${id}`, {
      method: "DELETE",
      headers: { "X-Codigo-Medico": codigoMedico },
    });
    if (!resposta.ok) throw new Error(await lerErro(resposta));
  },
};
