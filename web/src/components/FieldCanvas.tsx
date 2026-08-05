import { useEffect, useRef } from "react";
import type { SimulationConfig, SimulationSnapshot } from "../simulation/types";

interface FieldCanvasProps {
  config: SimulationConfig;
  snapshot: SimulationSnapshot | null;
  history: Float64Array[];
  waterfall: boolean;
}

const ETA0 = 376.730313668;

function fieldMaximum(snapshot: SimulationSnapshot): number {
  let maximum = 1e-6;
  for (let index = 0; index < snapshot.electric.length; index += 1) {
    maximum = Math.max(
      maximum,
      Math.abs(snapshot.electric[index]),
      Math.abs(snapshot.magnetic[index] * ETA0),
    );
  }
  return maximum;
}

function drawLine(
  context: CanvasRenderingContext2D,
  field: Float64Array,
  width: number,
  center: number,
  scale: number,
  color: string,
  multiplier = 1,
): void {
  context.beginPath();
  for (let index = 0; index < field.length; index += 1) {
    const x = (index / Math.max(1, field.length - 1)) * width;
    const y = center - field[index] * multiplier * scale;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.stroke();
}

export function FieldCanvas({ config, snapshot, history, waterfall }: FieldCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const render = () => {
      const bounds = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(bounds.width * ratio));
      canvas.height = Math.max(1, Math.floor(bounds.height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const width = bounds.width;
      const height = bounds.height;
      context.clearRect(0, 0, width, height);
      context.fillStyle = "#06100f";
      context.fillRect(0, 0, width, height);

      if (waterfall) {
        const rows = Math.max(1, history.length);
        const rowHeight = height / rows;
        history.forEach((field, row) => {
          const maximum = Math.max(0.25, ...field.map((value) => Math.abs(value)));
          field.forEach((value, index) => {
            const intensity = Math.min(1, Math.abs(value) / maximum);
            context.fillStyle = value >= 0
              ? `rgba(51, 214, 190, ${0.08 + intensity * 0.92})`
              : `rgba(255, 114, 88, ${0.08 + intensity * 0.92})`;
            context.fillRect(
              (index / field.length) * width,
              row * rowHeight,
              width / field.length + 1,
              rowHeight + 1,
            );
          });
        });
      } else {
        context.strokeStyle = "rgba(181, 209, 201, 0.10)";
        context.lineWidth = 1;
        for (let line = 1; line < 6; line += 1) {
          const y = (line / 6) * height;
          context.beginPath();
          context.moveTo(0, y);
          context.lineTo(width, y);
          context.stroke();
        }

        for (const material of config.materials) {
          const start = (material.start / config.gridSize) * width;
          const end = (material.end / config.gridSize) * width;
          context.fillStyle = material.sigmaE > 0
            ? "rgba(255, 167, 74, 0.12)"
            : "rgba(124, 111, 255, 0.13)";
          context.fillRect(start, 0, end - start, height);
        }
        if (config.leftTermination === "matched") {
          context.fillStyle = "rgba(255, 167, 74, 0.10)";
          context.fillRect(0, 0, (config.matchedThickness / config.gridSize) * width, height);
        }
        if (config.rightTermination === "matched") {
          context.fillStyle = "rgba(255, 167, 74, 0.10)";
          const layerWidth = (config.matchedThickness / config.gridSize) * width;
          context.fillRect(width - layerWidth, 0, layerWidth, height);
        }

        const center = height / 2;
        context.strokeStyle = "rgba(181, 209, 201, 0.28)";
        context.beginPath();
        context.moveTo(0, center);
        context.lineTo(width, center);
        context.stroke();
        if (snapshot) {
          const maximum = fieldMaximum(snapshot);
          const scale = (height * 0.38) / maximum;
          drawLine(context, snapshot.magnetic, width, center, scale, "#ffad5c", ETA0);
          drawLine(context, snapshot.electric, width, center, scale, "#36e0c0");
        }
      }

      const sourceX = (config.sourceIndex / config.gridSize) * width;
      context.strokeStyle = "#f1d06a";
      context.setLineDash([5, 4]);
      context.beginPath();
      context.moveTo(sourceX, 0);
      context.lineTo(sourceX, height);
      context.stroke();
      context.setLineDash([]);
      context.fillStyle = "#f1d06a";
      context.font = "11px ui-monospace, monospace";
      context.fillText(config.source === "tfsf" ? "TFSF seam" : "source", sourceX + 6, 16);
    };

    render();
    const observer = new ResizeObserver(render);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [config, history, snapshot, waterfall]);

  return <canvas ref={canvasRef} className="field-canvas" aria-label="FDTD electric and magnetic field animation" />;
}
