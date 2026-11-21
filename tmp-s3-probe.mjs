import { autorizacaoS3, dataAmz, sha256Hex } from "./src/infrastructure/s3.ts";

const html = await (await fetch("https://d31hditc5ltsvg.cloudfront.net/?t=" + Date.now())).text();
const src = html.match(/src="([^"]+)"/)[1];
const js = await (await fetch("https://d31hditc5ltsvg.cloudfront.net/" + src)).text();
const campo = (nome) => {
  const found = js.match(new RegExp(nome + ':"((?:\\\\.|[^"\\\\])*)"'));
  return found ? found[1] : "";
};
const bucket = campo("bucket");
const region = campo("region");
const accessKeyId = campo("accessKeyId");
const secretAccessKey = campo("secretAccessKey");
const host = `${bucket}.s3.${region}.amazonaws.com`;
console.log("bucketOk", /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket));
console.log("region", region);
console.log("keyLen", accessKeyId.length, "secretLen", secretAccessKey.length);

const preflight = await fetch(`https://${host}/uploads/registros.json`, {
  method: "OPTIONS",
  headers: {
    Origin: "https://d31hditc5ltsvg.cloudfront.net",
    "Access-Control-Request-Method": "PUT",
    "Access-Control-Request-Headers": "authorization,cache-control,content-type,x-amz-content-sha256,x-amz-date",
  },
});
console.log("preflight", preflight.status);
console.log("allowOrigin", preflight.headers.get("access-control-allow-origin"));
console.log("allowMethods", preflight.headers.get("access-control-allow-methods"));
console.log("allowHeaders", preflight.headers.get("access-control-allow-headers"));

async function pedir(method, chave, body, contentType) {
  const payload = body ?? new Uint8Array();
  const payloadHash = body ? await sha256Hex(payload) : "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
  const headersExtra = {};
  if (contentType) headersExtra["content-type"] = contentType;
  const amzDate = dataAmz();
  const authorization = await autorizacaoS3({
    method,
    host,
    path: `/${chave}`,
    region,
    accessKeyId,
    secretAccessKey,
    payloadHash,
    amzDate,
    headers: headersExtra,
  });
  const headers = {
    Authorization: authorization,
    "x-amz-date": amzDate,
    "x-amz-content-sha256": payloadHash,
  };
  if (contentType) headers["Content-Type"] = contentType;
  const resposta = await fetch(`https://${host}/${chave}`, {
    method,
    headers,
    body: method === "GET" || method === "DELETE" ? undefined : payload,
  });
  const texto = await resposta.text();
  const codigo = texto.match(/<Code>([^<]+)<\/Code>/)?.[1] || "";
  console.log(method, chave, resposta.status, codigo || resposta.headers.get("x-amz-bucket-region") || "");
}

await pedir("GET", "uploads/registros.json");
await pedir("PUT", "uploads/_probe.txt", new TextEncoder().encode("ok"), "text/plain");
await pedir("DELETE", "uploads/_probe.txt");
