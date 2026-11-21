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

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function criarId() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function criarCodigo(usados: Set<string>) {
  const bytes = new Uint8Array(8);
  for (let tentativa = 0; tentativa < 20; tentativa += 1) {
    crypto.getRandomValues(bytes);
    const codigo = Array.from(bytes, (byte) => ALFABETO[byte % ALFABETO.length]).join("");
    if (!usados.has(codigo)) return codigo;
  }
  throw new Error("Não foi possível gerar um código agora.");
}
