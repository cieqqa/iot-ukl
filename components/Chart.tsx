"use client";

import { useEffect, useRef } from "react";
import { CONFIG, SERIES } from "@/lib/config";
import type { SensorKey, SensorSample } from "@/lib/types";

type ChartProps = {
  readings: SensorSample[];
  series: SensorKey;
  ripeThreshold: number;
  overripeThreshold: number;
};

export default function Chart({
  readings,
  series,
  ripeThreshold,
  overripeThreshold,
}: ChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const pixelRatio = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;

      canvas.width = width * pixelRatio;
      canvas.height = height * pixelRatio;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.scale(pixelRatio, pixelRatio);

      const points = readings.map((reading) => reading[series]);
      const left = 42;
      const right = 8;
      const top = 10;
      const bottom = 34;
      context.font = "11px Onest,system-ui";
      context.fillStyle = "#75736b";
      context.strokeStyle = "#e4ddd0";
      context.lineWidth = 1;

      if (points.length < 2) {
        context.fillText("Mengumpulkan data…", left, height / 2);
        return;
      }

      let minimum = Math.min(...points);
      let maximum = Math.max(...points);
      if (series === "gas") {
        minimum = Math.min(minimum, ripeThreshold);
        maximum = Math.max(maximum, ripeThreshold);
      }
      if (minimum === maximum) {
        minimum -= 1;
        maximum += 1;
      }
      const padding = (maximum - minimum) * 0.1;
      minimum -= padding;
      maximum += padding;

      for (let index = 0; index <= 4; index += 1) {
        const y = top + ((height - top - bottom) * index) / 4;
        context.beginPath();
        context.moveTo(left, y);
        context.lineTo(width - right, y);
        context.stroke();
        context.fillText(
          (maximum - ((maximum - minimum) * index) / 4).toFixed(
            series === "temp" ? 1 : 0,
          ),
          4,
          y + 4,
        );
      }

      const xPosition = (index: number) =>
        left +
        ((width - left - right) * index) / (CONFIG.maxPoints - 1);
      const yPosition = (value: number) =>
        top +
        (height - top - bottom) * (1 - (value - minimum) / (maximum - minimum));

      if (series === "gas") {
        const thresholds = [
          { value: ripeThreshold, color: "#16a34a", label: "matang" },
          {
            value: overripeThreshold,
            color: "#e5484d",
            label: "lewat matang",
          },
        ];
        thresholds.forEach(({ value, color, label }) => {
          if (value <= minimum || value >= maximum) return;
          context.strokeStyle = color;
          context.setLineDash([5, 4]);
          context.beginPath();
          context.moveTo(left, yPosition(value));
          context.lineTo(width - right, yPosition(value));
          context.stroke();
          context.setLineDash([]);
          context.fillStyle = color;
          context.fillText(label, width - right - 70, yPosition(value) - 4);
        });
      }

      if (series === "temp") {
        const upper = yPosition(Math.min(CONFIG.idealTemperature[1], maximum));
        const lower = yPosition(Math.max(CONFIG.idealTemperature[0], minimum));
        context.fillStyle = "rgba(236,201,127,.4)";
        context.fillRect(left, upper, width - left - right, Math.max(0, lower - upper));
      }

      const offset = CONFIG.maxPoints - points.length;
      context.strokeStyle = "#52806d";
      context.lineWidth = 3;
      context.lineJoin = "round";
      context.beginPath();
      points.forEach((value, index) => {
        const x = xPosition(index + offset);
        const y = yPosition(value);
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.stroke();
      const formatTime = (timestamp: number) =>
        new Date(timestamp)
          .toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          })
          .replace(/\./g, ":");
      context.fillStyle = "#75736b";
      context.textAlign = "left";
      context.fillText(formatTime(readings[0].ts), left, height - 6);
      context.textAlign = "right";
      context.fillText(
        formatTime(readings[readings.length - 1].ts),
        width - right,
        height - 6,
      );
      context.textAlign = "left";
    };

    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [overripeThreshold, readings, ripeThreshold, series]);

  return <canvas ref={canvasRef} aria-label={`Grafik ${SERIES[series]}`} />;
}
