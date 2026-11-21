import type { SessaoMedico } from "../application/casos-de-uso";

const CHAVE = "atesta.medico";

export const sessaoWeb: SessaoMedico = {
  ativa() {
    return sessionStorage.getItem(CHAVE) === "1";
  },
  abrir() {
    sessionStorage.setItem(CHAVE, "1");
  },
  encerrar() {
    sessionStorage.removeItem(CHAVE);
  },
};
