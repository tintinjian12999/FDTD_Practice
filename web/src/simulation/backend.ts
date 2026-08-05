import SimulationWorker from "./fdtd.worker?worker";
import type { SimulationConfig, SimulationSnapshot } from "./types";

interface WorkerResponse {
  id: number;
  snapshot?: SimulationSnapshot;
  error?: string;
}

export class SimulationBackend {
  private readonly worker = new SimulationWorker();
  private nextId = 1;
  private readonly pending = new Map<
    number,
    { resolve: (snapshot: SimulationSnapshot) => void; reject: (error: Error) => void }
  >();

  constructor() {
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      const request = this.pending.get(response.id);
      if (!request) return;
      this.pending.delete(response.id);
      if (response.error) request.reject(new Error(response.error));
      else if (response.snapshot) request.resolve(response.snapshot);
    };
    this.worker.onerror = (event) => {
      const error = new Error(event.message || "Simulation worker failed");
      for (const request of this.pending.values()) request.reject(error);
      this.pending.clear();
    };
  }

  reset(config: SimulationConfig): Promise<SimulationSnapshot> {
    return this.send({ type: "reset", config });
  }

  step(count = 1): Promise<SimulationSnapshot> {
    return this.send({ type: "step", count });
  }

  phase(): Promise<SimulationSnapshot> {
    return this.send({ type: "phase" });
  }

  dispose(): void {
    this.worker.terminate();
    for (const request of this.pending.values()) {
      request.reject(new Error("Simulation worker was terminated"));
    }
    this.pending.clear();
  }

  private send(message: Record<string, unknown>): Promise<SimulationSnapshot> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, ...message });
    });
  }
}
