import fs from "node:fs";

const html = await (await fetch("https://d31hditc5ltsvg.cloudfront.net/?v=6")).text();
const src = html.match(/src="([^"]+)"/)[1];
const js = await (await fetch("https://d31hditc5ltsvg.cloudfront.net/" + src)).text();
const campo = (nome) => js.match(new RegExp(nome + ':"((?:\\\\.|[^"\\\\])*)"'))[1];
const linhas = [
  "DOCTOR_CODE=MEDICO-2026",
  "CLINIC_NAME=Atesta",
  `S3_BUCKET=${campo("bucket")}`,
  `S3_REGION=${campo("region")}`,
  `S3_ACCESS_KEY_ID=${campo("accessKeyId")}`,
  `S3_SECRET_ACCESS_KEY=${campo("secretAccessKey")}`,
  "",
];
fs.writeFileSync(".env", linhas.join("\n"), "utf8");
console.log("env atualizado", campo("bucket"), campo("region"));
