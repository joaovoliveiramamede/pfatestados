import { criarCasos } from "./application/casos-de-uso";
import { ambiente } from "./infrastructure/ambiente";
import { links } from "./infrastructure/links";
import { renderizarQr } from "./infrastructure/qr-card";
import { repositorioHttp } from "./infrastructure/repositorio-http";
import { criarRepositorioS3 } from "./infrastructure/repositorio-s3";
import { sessaoWeb } from "./infrastructure/sessao-web";

export { renderizarQr };

export const configuracao = {
  clinica: ambiente.clinica,
  codigoMedico: ambiente.codigoMedico,
};

const repositorio = ambiente.s3 ? criarRepositorioS3(ambiente.s3) : repositorioHttp;
export const casos = criarCasos(repositorio, links, sessaoWeb, ambiente.codigoMedico);
