import { CONFIG, STAGES } from "@/lib/config";
import type { PredictionResult, SensorValues } from "@/lib/types";

export type PredictionInput = {
  reading: SensorValues;
  batchStart: number | null;
  firstReadingAt: number | null;
  now: number;
  gasRipeThreshold: number;
  gasOverripeThreshold: number;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

// Prediksi dibuat murni agar kelak mudah diganti dengan pemanggilan api/predict.
export function predict(input: PredictionInput): PredictionResult {
  const start = input.batchStart ?? input.firstReadingAt ?? input.now;
  const elapsed = Math.max(0, (input.now - start) / 3_600_000);
  const timeProgress = clamp(elapsed / CONFIG.targetHours, 0, 1);
  const gasProgress = clamp(
    input.reading.gas / input.gasRipeThreshold,
    0,
    1,
  );
  const progress = clamp(0.6 * timeProgress + 0.4 * gasProgress, 0, 1);
  const overripe = input.reading.gas >= input.gasOverripeThreshold;
  const remainingHours =
    progress >= 0.97 ? 0 : (1 - progress) * CONFIG.targetHours;
  let stageIndex = 0;

  STAGES.forEach((stage, index) => {
    if (progress >= stage.from) {
      stageIndex = index;
    }
  });

  const notes: string[] = [];
  if (input.reading.temp < CONFIG.idealTemperature[0]) {
    notes.push(
      `🥶 Suhu di bawah ideal (${CONFIG.idealTemperature.join("–")}°C), fermentasi bisa lebih lambat.`,
    );
  } else if (input.reading.temp > CONFIG.idealTemperature[1]) {
    notes.push(
      `🔥 Suhu di atas ideal (${CONFIG.idealTemperature.join("–")}°C), tape bisa cepat asam.`,
    );
  } else {
    notes.push("✅ Suhu dalam kisaran ideal.");
  }

  if (overripe) {
    notes.push(
      "⚠️ Gas alkohol sangat tinggi, tape kemungkinan sudah lewat matang dan terasa asam.",
    );
  }

  if (input.batchStart === null) {
    notes.push(
      "ℹ️ Waktu mulai belum diatur, dihitung dari data pertama. Tekan “Mulai batch baru” saat tape mulai diperam.",
    );
  }

  return {
    start,
    elapsed,
    progress,
    remainingHours,
    eta: input.now + remainingHours * 3_600_000,
    stageIndex,
    overripe,
    notes,
  };
}
