#!/usr/bin/env node
// Assemble le site publié : site/ + data/ (sans le suivi interne des annonces) → _site/
import { cp, rm, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "_site");

await rm(OUT, { recursive: true, force: true });
await mkdir(path.join(OUT, "data"), { recursive: true });
await cp(path.join(ROOT, "site"), OUT, { recursive: true });
for (const f of ["references.json", "market.json", "history.json"]) {
  await cp(path.join(ROOT, "data", f), path.join(OUT, "data", f)).catch(() => {});
}
await cp(path.join(ROOT, "site", "index.html"), path.join(OUT, "404.html"));
console.log("Site assemblé dans _site/");
