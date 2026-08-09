/**
 * Copies the ML evaluation artifacts into the frontend so they are bundled.
 *
 * Why this exists: `ml/artifacts/` lives outside the Next.js root, so Vercel's
 * file tracing does not include it in the serverless bundle. Reading it at
 * runtime works locally and silently returns nothing in production — which
 * showed up as an About page full of em-dashes on the live site.
 *
 * Writing a single generated module that gets imported (and therefore bundled)
 * removes the runtime filesystem dependency entirely.
 *
 * Runs automatically via the `prebuild` / `predev` npm scripts.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const artifacts = join(here, "..", "..", "ml", "artifacts");
const outDir = join(here, "..", "lib", "generated");
const outFile = join(outDir, "model-data.json");

function read(name) {
  try {
    return JSON.parse(readFileSync(join(artifacts, name), "utf-8"));
  } catch {
    return null;
  }
}

const payload = {
  metrics: read("metrics.json"),
  baseline: read("baseline_metrics.json"),
  distribution: read("class_distribution.json"),
};

const present = Object.entries(payload)
  .filter(([, v]) => v !== null)
  .map(([k]) => k);

// The generated file is committed, because deployments build from `frontend/`
// alone and `ml/artifacts/` is not in that build context. On such a build this
// script finds nothing — it must leave the committed data alone rather than
// overwrite it with nulls and blank out every number in the UI.
if (present.length === 0) {
  if (existsSync(outFile)) {
    console.log("sync-metrics: ml/artifacts not in this build context — keeping committed data");
  } else {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(outFile, JSON.stringify(payload, null, 2) + "\n", "utf-8");
    console.log(
      "sync-metrics: no artifacts found — the UI will state the model hasn't " +
        "been evaluated rather than showing invented numbers.",
    );
  }
} else {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(outFile, JSON.stringify(payload, null, 2) + "\n", "utf-8");
  const acc = payload.metrics?.evaluation?.accuracy;
  console.log(
    `sync-metrics: bundled ${present.join(", ")}` +
      (acc ? ` (test accuracy ${(acc * 100).toFixed(2)}%)` : ""),
  );
}
