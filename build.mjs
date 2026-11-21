import * as esbuild from "esbuild";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
function appConfig(dir) {
  const env = { DOCTOR_CODE: "MEDICO-2026", CLINIC_NAME: "Atesta" };
  const file = path.join(dir, ".env");
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index === -1) continue;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
      if (key && value) env[key] = value;
    }
  }
  return {
    codigoMedico: env.DOCTOR_CODE,
    clinica: env.CLINIC_NAME,
  };
}

const root = path.resolve(import.meta.dirname);
const dist = path.join(root, "dist");
const config = appConfig(root);
const clinicaHtml = config.clinica.replace(/[&<>"]/g, (caractere) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[caractere]);

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
fs.cpSync(path.join(root, "uploads"), path.join(dist, "uploads"), { recursive: true });

await esbuild.build({
  absWorkingDir: root,
  entryPoints: ["src/main.tsx"],
  bundle: true,
  outfile: "dist/app.js",
  format: "iife",
  platform: "browser",
  target: ["es2022"],
  jsx: "automatic",
  minify: true,
  legalComments: "none",
  define: {
    "process.env.NODE_ENV": '"production"',
    __ATTESTA_CONFIG__: JSON.stringify(config),
  },
  plugins: [
    {
      name: "inline-css",
      setup(build) {
        build.onLoad({ filter: /\.css$/ }, async (args) => {
          const css = await fs.promises.readFile(args.path, "utf8");
          return {
            contents: `const style = document.createElement("style"); style.textContent = ${JSON.stringify(css)}; document.head.append(style);`,
            loader: "js",
          };
        });
      },
    },
  ],
});

const source = fs.readFileSync(path.join(dist, "app.js"));
const hash = crypto.createHash("sha256").update(source).digest("hex").slice(0, 8);
const script = `app.${hash}.js`;
fs.renameSync(path.join(dist, "app.js"), path.join(dist, script));
fs.copyFileSync(path.join(root, "public", "favicon.svg"), path.join(dist, "favicon.svg"));
fs.writeFileSync(
  path.join(dist, "index.html"),
  `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#0e6b64" />
    <meta name="robots" content="noindex" />
    <title>${clinicaHtml}</title>
    <link rel="icon" href="favicon.svg" type="image/svg+xml" />
  </head>
  <body>
    <div id="root"></div>
    <script src="${script}"></script>
  </body>
</html>
`,
  "utf8",
);

console.log(`Build em dist/ (${script})`);
