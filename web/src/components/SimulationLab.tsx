import {
  Activity,
  AlertTriangle,
  Pause,
  Play,
  RefreshCw,
  ScanLine,
  StepForward,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SimulationBackend } from "../simulation/backend";
import {
  defaultSimulationConfig,
  type SimulationConfig,
  type SimulationSnapshot,
  type Termination,
} from "../simulation/types";
import { FieldCanvas } from "./FieldCanvas";

const ETA0 = 376.730313668;
const phaseNames = ["Update H", "Update E", "Apply excitation", "Apply termination"];

function cloneConfig(config: SimulationConfig): SimulationConfig {
  return { ...config, materials: config.materials.map((material) => ({ ...material })) };
}

function calculateEnergy(snapshot: SimulationSnapshot | null): number {
  if (!snapshot) return 0;
  let energy = 0;
  for (let index = 0; index < snapshot.electric.length; index += 1) {
    const magnetic = snapshot.magnetic[index] * ETA0;
    energy += snapshot.electric[index] ** 2 + magnetic ** 2;
  }
  return energy / snapshot.electric.length;
}

export function SimulationLab() {
  const backendRef = useRef<SimulationBackend | null>(null);
  const busyRef = useRef(false);
  const [config, setConfig] = useState(() => cloneConfig(defaultSimulationConfig));
  const [appliedConfig, setAppliedConfig] = useState(() => cloneConfig(defaultSimulationConfig));
  const [snapshot, setSnapshot] = useState<SimulationSnapshot | null>(null);
  const [history, setHistory] = useState<Float64Array[]>([]);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(3);
  const [waterfall, setWaterfall] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);

  const acceptSnapshot = useCallback((next: SimulationSnapshot, record = true) => {
    setSnapshot(next);
    if (record) {
      setHistory((current) => [...current.slice(-79), next.electric.slice()]);
    }
    if (next.status !== 0) {
      setPlaying(false);
      setError(next.status === 4 ? "已到達設定的時間步數。" : "模擬已由數值安全門檻停止。");
    }
  }, []);

  const reset = useCallback(async () => {
    setPlaying(false);
    setError("");
    setHistory([]);
    try {
      const nextConfig = cloneConfig(config);
      const next = await backendRef.current?.reset(nextConfig);
      if (next) acceptSnapshot(next, false);
      setAppliedConfig(nextConfig);
      setDirty(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }, [acceptSnapshot, config]);

  useEffect(() => {
    const backend = new SimulationBackend();
    backendRef.current = backend;
    void backend.reset(defaultSimulationConfig).then((next) => acceptSnapshot(next, false)).catch((reason) => {
      setError(reason instanceof Error ? reason.message : String(reason));
    });
    return () => {
      backend.dispose();
      backendRef.current = null;
    };
  }, [acceptSnapshot]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      if (busyRef.current) return;
      busyRef.current = true;
      void backendRef.current?.step(speed).then((next) => acceptSnapshot(next)).catch((reason) => {
        setPlaying(false);
        setError(reason instanceof Error ? reason.message : String(reason));
      }).finally(() => {
        busyRef.current = false;
      });
    }, 45);
    return () => window.clearInterval(timer);
  }, [acceptSnapshot, playing, speed]);

  const updateConfig = <Key extends keyof SimulationConfig>(key: Key, value: SimulationConfig[Key]) => {
    setConfig((current) => ({ ...current, [key]: value }));
    setDirty(true);
  };

  const applyMaterialPreset = (preset: "vacuum" | "dielectric" | "lossy") => {
    const electricLoss = preset === "lossy" ? 0.012 : 0;
    const materials = preset === "vacuum" ? [] : [{
      id: preset,
      start: Math.round(config.gridSize * 0.58),
      end: Math.round(config.gridSize * 0.82),
      epsilonR: preset === "dielectric" ? 4 : 1,
      muR: 1,
      sigmaE: electricLoss,
      sigmaM: config.scale === "si" ? electricLoss * ETA0 ** 2 : electricLoss,
    }];
    updateConfig("materials", materials);
  };

  const selectSource = (source: SimulationConfig["source"]) => {
    setConfig((current) => source === "tfsf"
      ? {
          ...current,
          source,
          courant: 1,
          dt: current.dx / 299792458,
        }
      : { ...current, source });
    setDirty(true);
  };

  const switchScale = (scale: SimulationConfig["scale"]) => {
    if (scale === config.scale) return;
    if (scale === "si") {
      const dx = 0.001;
      setConfig((current) => ({
        ...current,
        scale,
        dx,
        dt: current.courant * dx / 299792458,
        materials: [],
      }));
    } else {
      setConfig((current) => ({
        ...current,
        scale,
        courant: Math.min(1, (299792458 * current.dt) / current.dx),
        materials: [],
      }));
    }
    setDirty(true);
  };

  const updateSpatialStep = (dx: number) => {
    setConfig((current) => ({
      ...current,
      dx,
      dt: current.source === "tfsf" ? dx / 299792458 : current.dt,
    }));
    setDirty(true);
  };

  const stepOnce = async () => {
    setPlaying(false);
    if (dirty) await reset();
    try {
      const next = await backendRef.current?.step(1);
      if (next) acceptSnapshot(next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  const phaseOnce = async () => {
    setPlaying(false);
    if (dirty) await reset();
    try {
      const next = await backendRef.current?.phase();
      if (next) acceptSnapshot(next, false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  const energy = useMemo(() => calculateEnergy(snapshot), [snapshot]);
  const probeIndex = Math.min(appliedConfig.gridSize - 1, Math.round(appliedConfig.gridSize * 0.72));
  const probe = snapshot?.electric[probeIndex] ?? 0;
  const resolvedCourant = config.scale === "si" ? (299792458 * config.dt) / config.dx : config.courant;

  return (
    <section className="lab-shell" aria-labelledby="lab-title">
      <div className="lab-heading">
        <div>
          <span className="section-kicker">LIVE C / WEBASSEMBLY</span>
          <h2 id="lab-title">一維 FDTD 實驗台</h2>
        </div>
        <div className={`solver-state ${error ? "solver-state--error" : ""}`}>
          <span className="status-dot" />
          {error || (snapshot ? `step ${snapshot.step} · ${phaseNames[snapshot.phase]}` : "載入數值核心…")}
        </div>
      </div>

      <div className="lab-grid">
        <div className="scope-panel">
          <div className="scope-toolbar">
            <div className="legend"><span className="legend-e" /> Ez <span className="legend-h" /> η₀Hy</div>
            <button className={`text-button ${waterfall ? "active" : ""}`} onClick={() => setWaterfall((value) => !value)}>
              <ScanLine size={15} /> waterfall
            </button>
          </div>
          <FieldCanvas config={appliedConfig} snapshot={snapshot} history={history} waterfall={waterfall} />
          <div className="metric-row">
            <div><span>Courant</span><strong className={resolvedCourant > 1 ? "danger" : ""}>{resolvedCourant.toFixed(3)}</strong></div>
            <div><span>Energy proxy</span><strong>{energy.toExponential(3)}</strong></div>
            <div><span>Probe Ez[{probeIndex}]</span><strong>{probe.toExponential(3)}</strong></div>
          </div>
          <div className="transport-controls">
            <button className="icon-button primary" onClick={() => setPlaying((value) => !value)} disabled={Boolean(error)}>
              {playing ? <Pause size={18} /> : <Play size={18} />} {playing ? "暫停" : "播放"}
            </button>
            <button className="icon-button" onClick={() => void stepOnce()}><StepForward size={18} /> 完整步</button>
            <button className="icon-button" onClick={() => void phaseOnce()}><Activity size={18} /> 分相</button>
            <button className="icon-button" onClick={() => void reset()}><RefreshCw size={18} /> 重設{dirty ? "並套用" : ""}</button>
            <label className="speed-control">速度
              <input type="range" min="1" max="12" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} />
              <output>{speed}×</output>
            </label>
          </div>
        </div>

        <aside className="parameter-panel" aria-label="Simulation parameters">
          <div className="control-group">
            <span className="control-title">EXCITATION</span>
            <label>類型
              <select value={config.source} onChange={(event) => selectSource(event.target.value as SimulationConfig["source"])}>
                <option value="hard">Hard point source</option>
                <option value="additive">Additive point source</option>
                <option value="tfsf">TFSF plane wave</option>
              </select>
            </label>
            {config.source === "tfsf" && <label>方向
              <select value={config.direction} onChange={(event) => updateConfig("direction", event.target.value as SimulationConfig["direction"])}>
                <option value="right">right →</option><option value="left">← left</option>
              </select>
            </label>}
            <label>位置 / seam <input type="number" min="30" max={config.gridSize - 30} value={config.sourceIndex} onChange={(event) => updateConfig("sourceIndex", Number(event.target.value))} /></label>
            <div className="two-columns">
              <label>delay <input type="number" value={config.delay} onChange={(event) => updateConfig("delay", Number(event.target.value))} /></label>
              <label>width <input type="number" min="1" value={config.width} onChange={(event) => updateConfig("width", Number(event.target.value))} /></label>
            </div>
          </div>

          <div className="control-group">
            <span className="control-title">DOMAIN</span>
            <div className="segmented">
              {(["normalized", "si"] as const).map((scale) => <button key={scale} className={config.scale === scale ? "active" : ""} onClick={() => switchScale(scale)}>{scale === "normalized" ? "Normalized" : "SI"}</button>)}
            </div>
            {config.scale === "normalized" ? <label>Courant number
              <input type="number" min="0.1" max={config.allowUnstable ? "1.15" : "1"} step="0.05" value={config.courant} disabled={config.source === "tfsf"} onChange={(event) => updateConfig("courant", Number(event.target.value))} />
            </label> : <div className="two-columns">
              <label>dx (m)<input type="number" step="0.0001" value={config.dx} onChange={(event) => updateSpatialStep(Number(event.target.value))} /></label>
              <label>dt (s)<input type="number" step="1e-12" value={config.dt} disabled={config.source === "tfsf"} onChange={(event) => updateConfig("dt", Number(event.target.value))} /></label>
            </div>}
            <label className="check-row"><input type="checkbox" checked={config.allowUnstable} onChange={(event) => updateConfig("allowUnstable", event.target.checked)} />允許受控 Sc &gt; 1</label>
            {resolvedCourant > 1 && <div className="warning"><AlertTriangle size={15} /> 此設定會不穩定；核心將在場值超過 {config.maximumField.toExponential(0)} 時停止。</div>}
          </div>

          <div className="control-group">
            <span className="control-title">MATERIAL</span>
            <div className="preset-row">
              <button onClick={() => applyMaterialPreset("vacuum")}>Vacuum</button>
              <button onClick={() => applyMaterialPreset("dielectric")}>εr=4</button>
              <button onClick={() => applyMaterialPreset("lossy")}>Matched loss</button>
            </div>
          </div>

          <div className="control-group">
            <span className="control-title">TERMINATIONS</span>
            <div className="two-columns">
              {(["leftTermination", "rightTermination"] as const).map((side) => <label key={side}>{side.startsWith("left") ? "Left" : "Right"}
                <select value={config[side]} onChange={(event) => updateConfig(side, event.target.value as Termination)}>
                  <option value="pmc">PMC</option><option value="mur1">Mur1</option><option value="matched">Matched</option>
                </select>
              </label>)}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
