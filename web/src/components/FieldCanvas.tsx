import { useEffect, useRef } from "react";
import {
  decomposeTravelingFields,
  normalizeMagneticField,
  resolveVerticalLimit,
  type MagneticNormalization,
  type VerticalScaleMode,
} from "../simulation/fieldMath";
import type { SimulationConfig, SimulationSnapshot } from "../simulation/types";

export type FieldTraceMode = "fields" | "directional";

interface FieldCanvasProps {
  config: SimulationConfig;
  snapshot: SimulationSnapshot | null;
  history: Float64Array[];
  waterfall: boolean;
  traceMode: FieldTraceMode;
  magneticNormalization: MagneticNormalization;
  verticalScaleMode: VerticalScaleMode;
  fixedVerticalLimit: number;
}

function drawLine(
  context: CanvasRenderingContext2D,
  field: Float64Array,
  width: number,
  center: number,
  scale: number,
  color: string,
  dash: number[] = [],
): void {
  context.beginPath();
  for (let index = 0; index < field.length; index += 1) {
    const x = (index / Math.max(1, field.length - 1)) * width;
    const y = center - field[index] * scale;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.setLineDash(dash);
  context.stroke();
  context.setLineDash([]);
}

function drawVerticalScale(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  limit: number,
  mode: VerticalScaleMode,
): void {
  const center = height / 2;
  const verticalSpan = height * 0.38;
  context.fillStyle = "rgba(181, 209, 201, 0.68)";
  context.font = "10px ui-monospace, monospace";
  context.textAlign = "right";
  context.fillText(`+${limit.toFixed(2)}`, width - 8, center - verticalSpan - 5);
  context.fillText("0", width - 8, center - 5);
  context.fillText(`-${limit.toFixed(2)} · ${mode}`, width - 8, center + verticalSpan + 12);
  context.textAlign = "left";
}

export function FieldCanvas({
  config,
  snapshot,
  history,
  waterfall,
  traceMode,
  magneticNormalization,
  verticalScaleMode,
  fixedVerticalLimit,
}: FieldCanvasProps) {
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
          let traces: Float64Array[];
          if (traceMode === "fields") {
            traces = [
              snapshot.electric,
              normalizeMagneticField(
                snapshot.magnetic,
                config.materials,
                magneticNormalization,
              ),
            ];
          } else {
            const { rightGoing, leftGoing } = decomposeTravelingFields(
                snapshot.electric,
                snapshot.magnetic,
                config.materials,
            );
            traces = [rightGoing, leftGoing];
          }
          const limit = resolveVerticalLimit(
            traces,
            verticalScaleMode,
            fixedVerticalLimit,
          );
          const scale = (height * 0.38) / limit;
          if (traceMode === "fields") {
            drawLine(context, traces[1], width, center, scale, "#ffad5c");
            drawLine(context, snapshot.electric, width, center, scale, "#36e0c0");
          } else {
            drawLine(context, traces[0], width, center, scale, "#36e0c0");
            drawLine(context, traces[1], width, center, scale, "#ff728f", [7, 4]);
          }
          drawVerticalScale(context, width, height, limit, verticalScaleMode);
        } else {
          drawVerticalScale(
            context,
            width,
            height,
            resolveVerticalLimit([], verticalScaleMode, fixedVerticalLimit),
            verticalScaleMode,
          );
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
  }, [
    config,
    fixedVerticalLimit,
    history,
    magneticNormalization,
    snapshot,
    traceMode,
    verticalScaleMode,
    waterfall,
  ]);

  return <canvas ref={canvasRef} className="field-canvas" aria-label="FDTD electric and magnetic field animation" />;
}
