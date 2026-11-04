import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractRefs, BRANDS, run } from "../scripts/discover-references.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const quiet = { log() {}, warn() {} };
const def = (b) => BRANDS.find((x) => x.brand === b);

test("liste maîtresse : extraction des références dans les titres", () => {
  assert.deepEqual(extractRefs("Tudor Black Bay 58 M79030N-0001 full set 2021", def("Tudor")), ["79030N"]);
  assert.deepEqual(extractRefs("Tudor M7939A1A0NU-0001", def("Tudor")), ["7939A1A0NU"]);
  assert.deepEqual(extractRefs("Seiko Alpinist SPB121J1", def("Seiko")), ["SPB121"]);
  assert.deepEqual(extractRefs("Seiko 5 SRPD55K1", def("Seiko")), ["SRPD55"]);
  assert.deepEqual(extractRefs("IWC Mark XX IW328201", def("IWC")), ["IW328201"]);
});

test("liste maîtresse : classement par annonces distinctes, références déjà suivies repérées", async () => {
  const out = path.join(await mkdtemp(path.join(tmpdir(), "lm-")), "lm.json");
  const r = await run({ mockDir: path.join(ROOT, "test", "fixtures", "discovery"), now: new Date("2026-11-04T20:00:00Z"), log: quiet, out });
  const saved = JSON.parse(await readFile(out, "utf8"));
  assert.deepEqual(saved.candidates.map((c) => [c.brand, c.ref, c.listings, c.tracked]), [
    ["Tudor", "79030N", 3, "tudor-79030n"], ["Tudor", "79950", 3, null], ["Seiko", "SPB121", 3, null], ["Seiko", "SRPD55", 3, null],
  ]);
  assert.equal(saved.coverage.tracked, 1);
  assert.equal(JSON.stringify(saved).includes("full set"), false);   // aucun titre d'annonce conservé
  assert.equal(r.scanned.Tudor, 8);
});
