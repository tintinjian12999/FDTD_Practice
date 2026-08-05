/// <reference lib="webworker" />

import type { SimulationConfig, SimulationSnapshot } from "./types";

interface FDTDModule {
  HEAPF64: Float64Array;
  HEAPU8: Uint8Array;
  _ufdtd_wasm_create_normalized(grid: number, steps: number, courant: number): number;
  _ufdtd_wasm_create_si(grid: number, steps: number, dx: number, dt: number): number;
  _ufdtd_wasm_set_point_excitation(session: number, injection: number, index: number, delay: number, width: number, amplitude: number): number;
  _ufdtd_wasm_set_tfsf_excitation(session: number, direction: number, seam: number, delay: number, width: number, amplitude: number): number;
  _ufdtd_wasm_add_material(session: number, start: number, end: number, epsilonR: number, muR: number, sigmaE: number, sigmaM: number): number;
  _ufdtd_wasm_set_termination(session: number, side: number, type: number, thickness: number, order: number, reflection: number): number;
  _ufdtd_wasm_set_safety(session: number, allowUnstable: number, maximumField: number): number;
  _ufdtd_wasm_start(session: number): number;
  _ufdtd_wasm_step(session: number): number;
  _ufdtd_wasm_advance_phase(session: number): number;
  _ufdtd_wasm_electric(session: number): number;
  _ufdtd_wasm_magnetic(session: number): number;
  _ufdtd_wasm_current_step(session: number): number;
  _ufdtd_wasm_phase(session: number): number;
  _ufdtd_wasm_error(session: number): number;
  _ufdtd_wasm_destroy(session: number): void;
}

type ModuleFactory = (options?: Record<string, unknown>) => Promise<FDTDModule>;
type WorkerRequest =
  | { id: number; type: "reset"; config: SimulationConfig }
  | { id: number; type: "step"; count: number }
  | { id: number; type: "phase" }
  | { id: number; type: "snapshot" };

let modulePromise: Promise<FDTDModule> | undefined;
let session = 0;
let activeConfig: SimulationConfig | undefined;

const terminationCode = { pmc: 0, mur1: 1, matched: 2 } as const;

async function loadModule(): Promise<FDTDModule> {
  if (!modulePromise) {
    const moduleUrl = new URL(
      `${import.meta.env.BASE_URL}wasm/fdtd1d.js`,
      self.location.origin,
    ).href;
    modulePromise = import(/* @vite-ignore */ moduleUrl).then(async (loaded) => {
      const factory = loaded.default as ModuleFactory;
      return factory();
    });
  }
  return modulePromise;
}

function readCString(module: FDTDModule, pointer: number): string {
  if (!pointer) return "Unknown WebAssembly error";
  let end = pointer;
  while (module.HEAPU8[end] !== 0) end += 1;
  return new TextDecoder().decode(module.HEAPU8.subarray(pointer, end));
}

function assertStatus(module: FDTDModule, status: number): void {
  if (status !== 0) {
    throw new Error(readCString(module, module._ufdtd_wasm_error(session)));
  }
}

async function reset(config: SimulationConfig): Promise<SimulationSnapshot> {
  const module = await loadModule();
  if (session) module._ufdtd_wasm_destroy(session);
  session = config.scale === "si"
    ? module._ufdtd_wasm_create_si(config.gridSize, config.timeSteps, config.dx, config.dt)
    : module._ufdtd_wasm_create_normalized(config.gridSize, config.timeSteps, config.courant);
  if (!session) throw new Error("WebAssembly session allocation failed");

  if (config.source === "tfsf") {
    assertStatus(module, module._ufdtd_wasm_set_tfsf_excitation(
      session,
      config.direction === "right" ? 0 : 1,
      config.sourceIndex,
      config.delay,
      config.width,
      config.amplitude,
    ));
  } else {
    assertStatus(module, module._ufdtd_wasm_set_point_excitation(
      session,
      config.source === "hard" ? 0 : 1,
      config.sourceIndex,
      config.delay,
      config.width,
      config.amplitude,
    ));
  }
  for (const material of config.materials) {
    assertStatus(module, module._ufdtd_wasm_add_material(
      session,
      material.start,
      material.end,
      material.epsilonR,
      material.muR,
      material.sigmaE,
      material.sigmaM,
    ));
  }
  for (const [side, termination] of [config.leftTermination, config.rightTermination].entries()) {
    assertStatus(module, module._ufdtd_wasm_set_termination(
      session,
      side,
      terminationCode[termination],
      config.matchedThickness,
      config.gradingOrder,
      config.targetReflection,
    ));
  }
  assertStatus(module, module._ufdtd_wasm_set_safety(
    session,
    config.allowUnstable ? 1 : 0,
    config.maximumField,
  ));
  assertStatus(module, module._ufdtd_wasm_start(session));
  activeConfig = config;
  return takeSnapshot(module, 0);
}

function takeSnapshot(module: FDTDModule, status: number): SimulationSnapshot {
  if (!session || !activeConfig) throw new Error("Simulation is not initialized");
  const length = activeConfig.gridSize;
  const electricPointer = module._ufdtd_wasm_electric(session) / 8;
  const magneticPointer = module._ufdtd_wasm_magnetic(session) / 8;
  return {
    electric: module.HEAPF64.slice(electricPointer, electricPointer + length),
    magnetic: module.HEAPF64.slice(magneticPointer, magneticPointer + length),
    step: module._ufdtd_wasm_current_step(session),
    phase: module._ufdtd_wasm_phase(session),
    status,
  };
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  try {
    const module = await loadModule();
    let snapshot: SimulationSnapshot;
    if (request.type === "reset") {
      snapshot = await reset(request.config);
    } else {
      if (!session) throw new Error("Simulation is not initialized");
      let status = 0;
      if (request.type === "step") {
        for (let count = 0; count < request.count && status === 0; count += 1) {
          status = module._ufdtd_wasm_step(session);
        }
      } else if (request.type === "phase") {
        status = module._ufdtd_wasm_advance_phase(session);
      }
      snapshot = takeSnapshot(module, status);
    }
    self.postMessage(
      { id: request.id, snapshot },
      { transfer: [snapshot.electric.buffer, snapshot.magnetic.buffer] },
    );
  } catch (error) {
    self.postMessage({
      id: request.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export {};
