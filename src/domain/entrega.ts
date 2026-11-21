import { formatarCodigo } from "./codigo";
import type { Entrega, Registro } from "./tipos";

export function urlDoArquivo(caminho: string) {
  return `/${caminho.split("/").map((parte) => encodeURIComponent(parte)).join("/")}`;
}

export function apresentar(registro: Registro, link: string): Entrega {
  return {
    ...registro,
    codigoFormatado: formatarCodigo(registro.codigo),
    link,
    arquivos: registro.arquivos.map((arquivo) => ({
      ...arquivo,
      url: urlDoArquivo(arquivo.caminho),
    })),
  };
}
