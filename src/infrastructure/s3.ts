const encoder = new TextEncoder();

function hex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bytesDe(dados: Uint8Array) {
  const copia = new Uint8Array(dados.byteLength);
  copia.set(dados);
  return copia;
}

export async function sha256Hex(dados: Uint8Array) {
  const hash = await crypto.subtle.digest("SHA-256", bytesDe(dados));
  return hex(new Uint8Array(hash));
}

export function caminhoS3(chave: string) {
  return chave
    .split("/")
    .map((parte) => encodeURIComponent(parte).replace(/[!'()*]/g, (caractere) => `%${caractere.charCodeAt(0).toString(16).toUpperCase()}`))
    .join("/");
}

async function hmacSha256(chave: Uint8Array | string, dados: string) {
  const bruta = typeof chave === "string" ? encoder.encode(chave) : bytesDe(chave);
  const cryptoKey = await crypto.subtle.importKey("raw", bruta, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(dados)));
}

export async function autorizacaoS3(input: {
  method: string;
  host: string;
  path: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  payloadHash: string;
  amzDate: string;
  headers?: Record<string, string>;
}) {
  const todos: Record<string, string> = {
    host: input.host,
    "x-amz-content-sha256": input.payloadHash,
    "x-amz-date": input.amzDate,
  };
  for (const [nome, valor] of Object.entries(input.headers ?? {})) {
    todos[nome.toLowerCase()] = valor.trim().replace(/\s+/g, " ");
  }
  const nomes = Object.keys(todos).sort();
  const canonicalHeaders = nomes.map((nome) => `${nome}:${todos[nome]}\n`).join("");
  const signedHeaders = nomes.join(";");
  const canonical = [input.method.toUpperCase(), input.path, "", canonicalHeaders, signedHeaders, input.payloadHash].join("\n");
  const canonicalHash = await sha256Hex(encoder.encode(canonical));
  const data = input.amzDate.slice(0, 8);
  const escopo = `${data}/${input.region}/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${input.amzDate}\n${escopo}\n${canonicalHash}`;
  let chave = await hmacSha256(`AWS4${input.secretAccessKey}`, data);
  chave = await hmacSha256(chave, input.region);
  chave = await hmacSha256(chave, "s3");
  chave = await hmacSha256(chave, "aws4_request");
  const assinatura = hex(await hmacSha256(chave, stringToSign));
  return `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${escopo}, SignedHeaders=${signedHeaders}, Signature=${assinatura}`;
}

export function dataAmz(data = new Date()) {
  return data.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
