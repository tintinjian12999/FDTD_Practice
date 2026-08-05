import { existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = resolve(webRoot, "..");
const environment = { ...process.env };

if (process.platform === "win32" && environment.CONDA_PREFIX) {
  const condaNode = join(environment.CONDA_PREFIX, "node.exe");
  if (existsSync(condaNode)) environment.NODE_JS = condaNode;
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env: environment,
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (process.platform === "win32" && environment.CONDA_PREFIX) {
  const libraryRoot = join(environment.CONDA_PREFIX, "Library");
  const emscriptenDirectory = readdirSync(join(libraryRoot, "lib"))
    .find((entry) => entry.startsWith("emscripten-"));
  if (!emscriptenDirectory) throw new Error("Cannot locate Emscripten in the active Conda environment");
  run(join(environment.CONDA_PREFIX, "python.exe"), [
    join(libraryRoot, "lib", emscriptenDirectory, "emcmake.py"),
    join(libraryRoot, "bin", "cmake.exe"),
    "--preset",
    "wasm",
    "--fresh",
  ]);
  run(join(libraryRoot, "bin", "cmake.exe"), ["--build", "--preset", "wasm"]);
} else {
  run("emcmake", ["cmake", "--preset", "wasm", "--fresh"]);
  run("cmake", ["--build", "--preset", "wasm"]);
}
