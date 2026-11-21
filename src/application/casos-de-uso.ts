import { codigosIguais, normalizarCodigo } from "../domain/codigo";
import { apresentar } from "../domain/entrega";
import { temCabecalhoPdf } from "../domain/pdf";
import type { Entrega, Registro } from "../domain/tipos";
import { LIMITE_BYTES, validarObservacao, validarPaciente, validarQuantidade } from "../domain/validacao";
import type { RepositorioEntrega } from "./repositorio-entrega";

export interface Links {
  linkPaciente(codigo: string): string;
}

export interface SessaoMedico {
  ativa(): boolean;
  abrir(): void;
  encerrar(): void;
}

async function validarArquivo(arquivo: File) {
  if (arquivo.size > LIMITE_BYTES) throw new Error("Cada PDF pode ter no máximo 8 MB.");
  const bytes = new Uint8Array(await arquivo.slice(0, 1024).arrayBuffer());
  if (!temCabecalhoPdf(bytes)) throw new Error(`"${arquivo.name}" não é um PDF válido.`);
}

export function criarCasos(repositorio: RepositorioEntrega, links: Links, sessao: SessaoMedico, codigoMedico: string) {
  function publicar(registro: Registro): Entrega {
    return apresentar(registro, links.linkPaciente(registro.codigo));
  }

  return {
    sessaoAtiva: () => sessao.ativa(),
    entrar(codigo: string) {
      if (!codigosIguais(codigo, codigoMedico)) return false;
      sessao.abrir();
      return true;
    },
    sair() {
      sessao.encerrar();
    },
    async listar(): Promise<Entrega[]> {
      const registros = await repositorio.listar();
      return registros.map((registro) => publicar(registro)).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
    },
    async obter(codigo: string): Promise<Entrega | null> {
      const normalizado = normalizarCodigo(codigo);
      if (normalizado.length !== 8) return null;
      const registros = await repositorio.listar();
      const registro = registros.find((item) => item.codigo === normalizado);
      return registro ? publicar(registro) : null;
    },
    async criar(input: { paciente: string; observacao: string; arquivos: File[] }): Promise<Entrega> {
      const paciente = validarPaciente(input.paciente);
      const observacao = validarObservacao(input.observacao);
      validarQuantidade(input.arquivos.length);
      await Promise.all(input.arquivos.map((arquivo) => validarArquivo(arquivo)));
      return publicar(await repositorio.criar({ paciente, observacao, arquivos: input.arquivos }, codigoMedico));
    },
    async excluir(id: string) {
      await repositorio.excluir(id, codigoMedico);
    },
  };
}
