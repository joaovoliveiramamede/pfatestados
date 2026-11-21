import { criarCasos } from "./application/casos-de-uso";
import { ambiente } from "./infrastructure/ambiente";
import { links } from "./infrastructure/links";
import { repositorioHttp } from "./infrastructure/repositorio-http";
import { renderizarQr } from "./infrastructure/qr-card";
import { sessaoWeb } from "./infrastructure/sessao-web";

export { renderizarQr };

export const configuracao = {
  clinica: ambiente.clinica,
  codigoMedico: ambiente.codigoMedico,
};

export const casos = criarCasos(repositorioHttp, links, sessaoWeb, ambiente.codigoMedico);
