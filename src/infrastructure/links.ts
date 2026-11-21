import type { Links } from "../application/casos-de-uso";

export const links: Links = {
  linkPaciente(codigo: string) {
    const url = new URL(window.location.href);
    url.hash = `/acesso/${codigo}`;
    url.search = "";
    return url.toString();
  },
};
