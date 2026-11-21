const html = await (await fetch("https://d31hditc5ltsvg.cloudfront.net/?t=" + Date.now())).text();
const src = html.match(/src="([^"]+)"/)[1];
const js = await (await fetch("https://d31hditc5ltsvg.cloudfront.net/" + src)).text();
const i = js.indexOf("function hv");
const body = js.slice(i, i + 6500);
const fs = await import("node:fs");
fs.writeFileSync("tmp-hv.txt", body.replace(/AKIA[A-Z0-9]+/g, "AKIA"));
