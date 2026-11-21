import { autorizacaoS3, dataAmz, sha256Hex } from "./src/infrastructure/s3.ts";

const html = await (await fetch("https://d31hditc5ltsvg.cloudfront.net/?v=6")).text();
const src = html.match(/src="([^"]+)"/)[1];
const js = await (await fetch("https://d31hditc5ltsvg.cloudfront.net/" + src)).text();
const campo = (nome) => js.match(new RegExp(nome + ':"((?:\\\\.|[^"\\\\])*)"'))[1];
const bucket = campo("bucket");
const region = campo("region");
const accessKeyId = campo("accessKeyId");
const secretAccessKey = campo("secretAccessKey");
const host = `${bucket}.s3.${region}.amazonaws.com`;

async function pedir(method, chave, body, contentType, cacheControl) {
  const payload = body ?? new Uint8Array();
  const payloadHash = body ? await sha256Hex(payload) : "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
  const extras = {};
  if (contentType) extras["content-type"] = contentType;
  if (cacheControl) extras["cache-control"] = cacheControl;
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
    headers: extras,
  });
  const headers = { Authorization: authorization, "x-amz-date": amzDate, "x-amz-content-sha256": payloadHash };
  if (contentType) headers["Content-Type"] = contentType;
  if (cacheControl) headers["Cache-Control"] = cacheControl;
  const resposta = await fetch(`https://${host}/${chave}`, { method, headers, body: method === "GET" || method === "DELETE" ? undefined : payload });
  const texto = await resposta.text();
  const codigo = texto.match(/<Code>([^<]+)<\/Code>/)?.[1] || "";
  return { status: resposta.status, codigo, texto };
}

const registros = JSON.parse((await pedir("GET", "uploads/registros.json")).texto);
const teste = registros.filter((item) => item.paciente === "Paciente S3");
console.log("teste", teste.map((item) => item.codigo).join(","));
for (const item of teste) {
  for (const arquivo of item.arquivos) {
    const apagado = await pedir("DELETE", arquivo.caminho);
    console.log("del", arquivo.caminho, apagado.status);
  }
  const json = await pedir("DELETE", `uploads/${item.codigo}/entrega.json`);
  console.log("del entrega", json.status);
}
const restantes = registros.filter((item) => item.paciente !== "Paciente S3");
const gravado = await pedir("PUT", "uploads/registros.json", new TextEncoder().encode(`${JSON.stringify(restantes, null, 2)}\n`), "application/json; charset=utf-8", "max-age=0, no-cache");
console.log("registros", gravado.status, gravado.codigo);

const raiz = await fetch("https://d31hditc5ltsvg.cloudfront.net/");
console.log("cache", raiz.headers.get("x-cache"), "age", raiz.headers.get("age"), "script", (await raiz.text()).match(/src="([^"]+)"/)?.[1]);

const index = await pedir("GET", "index.html");
console.log("s3index", index.status, index.texto.match(/src="([^"]+)"/)?.[1]);
const novoIndex = await pedir("PUT", "index.html", new TextEncoder().encode(index.texto), "text/html; charset=utf-8", "max-age=0, no-cache");
console.log("indexAtualizado", novoIndex.status, novoIndex.codigo);
