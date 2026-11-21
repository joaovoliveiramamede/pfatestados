export const LIMITE_ARQUIVOS = 5;
export const LIMITE_BYTES = 8 * 1024 * 1024;

export function validarPaciente(valor: string) {
  const paciente = valor.trim().replace(/\s+/g, " ");
  if (paciente.length < 2 || paciente.length > 80) {
    throw new Error("Informe o nome do paciente com 2 a 80 caracteres.");
  }
  return paciente;
}

export function validarObservacao(valor: string) {
  const observacao = valor.trim().replace(/\s+/g, " ");
  if (observacao.length > 240) {
    throw new Error("A observação pode ter no máximo 240 caracteres.");
  }
  return observacao;
}

export function validarQuantidade(quantidade: number) {
  if (quantidade < 1) throw new Error("Anexe pelo menos um PDF.");
  if (quantidade > LIMITE_ARQUIVOS) throw new Error("Envie no máximo 5 PDFs por vez.");
}
