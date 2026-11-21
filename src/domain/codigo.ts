export function normalizarCodigo(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

export function formatarCodigo(value: string) {
  const code = normalizarCodigo(value);
  return code.length > 4 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

export function codigosIguais(informado: string, esperado: string) {
  return informado.trim().toLocaleUpperCase("pt-BR") === esperado.trim().toLocaleUpperCase("pt-BR");
}
