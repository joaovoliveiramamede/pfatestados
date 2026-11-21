const CABECALHO = [0x25, 0x50, 0x44, 0x46, 0x2d];

export function temCabecalhoPdf(bytes: Uint8Array) {
  const limite = Math.min(bytes.length, 1024);
  for (let inicio = 0; inicio <= limite - CABECALHO.length; inicio += 1) {
    let encontrou = true;
    for (let indice = 0; indice < CABECALHO.length; indice += 1) {
      if (bytes[inicio + indice] !== CABECALHO[indice]) {
        encontrou = false;
        break;
      }
    }
    if (encontrou) return true;
  }
  return false;
}
