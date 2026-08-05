import { existsSync } from "node:fs";
import { resolve } from "node:path";

for (const filename of ["fdtd1d.js", "fdtd1d.wasm"]) {
  const path = resolve("public", "wasm", filename);
  if (!existsSync(path)) {
    throw new Error(`Missing ${path}. Run npm run build:wasm first.`);
  }
}
