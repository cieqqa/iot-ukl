import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import type { MaturityLabel } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TrainingSample = {
  features: [number, number, number];
  label: MaturityLabel;
};

const LABELS: readonly MaturityLabel[] = [
  "Belum Matang",
  "Hampir Matang",
  "Matang",
  "Overfermentasi / Busuk",
];
const K_NEIGHBORS = 11;
let trainingDataPromise: Promise<TrainingSample[]> | undefined;

function isMaturityLabel(value: string): value is MaturityLabel {
  return LABELS.includes(value as MaturityLabel);
}

async function loadTrainingData(): Promise<TrainingSample[]> {
  if (!trainingDataPromise) {
    trainingDataPromise = readFile(
      join(process.cwd(), "dataset_kematangan_tape_1000.csv"),
      "utf8",
    )
      .then((contents) => {
        const lines = contents.replace(/^\uFEFF/, "").split(/\r?\n/);
        const samples: TrainingSample[] = [];

        for (const [index, line] of lines.slice(1).entries()) {
          if (!line.trim()) continue;
          const columns = line.split(",");
          const temperature = Number(columns[1]);
          const humidity = Number(columns[2]);
          const alcoholGas = Number(columns[3]);
          const label = columns[6]?.trim();

          if (
            !Number.isFinite(temperature) ||
            !Number.isFinite(humidity) ||
            !Number.isFinite(alcoholGas) ||
            !label ||
            !isMaturityLabel(label)
          ) {
            throw new Error(
              `Baris ${index + 2} dataset kematangan tape tidak valid.`,
            );
          }

          samples.push({
            features: [temperature, humidity, alcoholGas],
            label,
          });
        }

        if (samples.length === 0) {
          throw new Error("Dataset kematangan tape tidak memiliki data.");
        }
        return samples;
      })
      .catch((error: unknown) => {
        trainingDataPromise = undefined;
        throw error;
      });
  }

  return trainingDataPromise;
}

function getRecommendation(label: MaturityLabel, temperature: number): string {
  const temperatureAdvice =
    temperature < 28
      ? "Suhu di bawah kisaran acuan 28–32 °C; hangatkan lingkungan secara bertahap."
      : temperature > 32
        ? "Suhu di atas kisaran acuan 28–32 °C; pindahkan ke tempat lebih sejuk."
        : "";
  const advice: Record<MaturityLabel, string> = {
    "Belum Matang":
      "Lanjutkan fermentasi dalam wadah bersih dan tertutup. Jaga suhu stabil, lalu periksa kembali sekitar 6 jam lagi.",
    "Hampir Matang":
      "Periksa aroma dan tekstur tanpa mencicipi bila ada tanda mencurigakan. Pantau kembali setiap 2–4 jam.",
    Matang:
      "Hentikan fermentasi dan simpan dalam wadah bersih tertutup di kulkas agar fermentasi melambat.",
    "Overfermentasi / Busuk":
      "Jangan dicicipi untuk menguji. Jika ada jamur, lendir, atau bau busuk/menyimpang, buang tape; model tidak dapat memastikan keamanan pangan.",
  };
  return [advice[label], temperatureAdvice].filter(Boolean).join(" ");
}

function isPredictionInput(
  value: unknown,
): value is { temp: number; hum: number; gas: number } {
  if (typeof value !== "object" || value === null) return false;
  const input = value as Record<string, unknown>;
  return (
    typeof input.temp === "number" &&
    Number.isFinite(input.temp) &&
    input.temp >= -20 &&
    input.temp <= 80 &&
    typeof input.hum === "number" &&
    Number.isFinite(input.hum) &&
    input.hum >= 0 &&
    input.hum <= 100 &&
    typeof input.gas === "number" &&
    Number.isFinite(input.gas) &&
    input.gas >= 0 &&
    input.gas <= 4095
  );
}

function standardDeviations(samples: TrainingSample[]): [number, number, number] {
  const deviations = [0, 1, 2].map((featureIndex) => {
    const mean =
      samples.reduce(
        (sum, sample) => sum + sample.features[featureIndex],
        0,
      ) / samples.length;
    const variance =
      samples.reduce(
        (sum, sample) =>
          sum + (sample.features[featureIndex] - mean) ** 2,
        0,
      ) / samples.length;
    return Math.sqrt(variance) || 1;
  });
  return [deviations[0], deviations[1], deviations[2]];
}

export async function POST(request: Request) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Body harus berupa JSON yang valid." },
      { status: 400 },
    );
  }

  if (!isPredictionInput(input)) {
    return NextResponse.json(
      { error: "Suhu, kelembapan, atau nilai gas sensor tidak valid." },
      { status: 400 },
    );
  }

  try {
    const samples = await loadTrainingData();
    const deviations = standardDeviations(samples);
    const normalizedGas = (input.gas / 4095) * 2795.3;
    const features = [input.temp, input.hum, normalizedGas];
    const neighbors = samples
      .map((sample) => ({
        label: sample.label,
        distance: Math.sqrt(
          sample.features.reduce(
            (sum, value, index) =>
              sum + ((value - features[index]) / deviations[index]) ** 2,
            0,
          ),
        ),
      }))
      .sort((left, right) => left.distance - right.distance)
      .slice(0, Math.min(K_NEIGHBORS, samples.length));

    const votes = new Map<MaturityLabel, number>();
    let totalWeight = 0;
    for (const neighbor of neighbors) {
      const weight = 1 / (neighbor.distance + 0.15);
      votes.set(neighbor.label, (votes.get(neighbor.label) ?? 0) + weight);
      totalWeight += weight;
    }

    const [label, winningWeight] = [...votes.entries()].sort(
      (left, right) => right[1] - left[1],
    )[0];

    return NextResponse.json({
      label,
      confidence: winningWeight / totalWeight,
      recommendation: getRecommendation(label, input.temp),
      sampleCount: samples.length,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal memuat model dataset.";
    console.error("Gagal memprediksi kematangan tape:", message);
    return NextResponse.json(
      { error: `Prediksi AI gagal: ${message}` },
      { status: 500 },
    );
  }
}
