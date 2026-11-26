import { CONFIG, STAGES } from "@/lib/config";
import type {
  MaturityLabel,
  PredictionModelInfo,
  PredictionResult,
  SensorValues,
} from "@/lib/types";

export type PredictionInput = {
  reading: SensorValues;
  batchStart: number | null;
  firstReadingAt: number | null;
  now: number;
  gasRipeThreshold: number;
  gasOverripeThreshold: number;
};

export type DatasetModelSample = {
  temp: number;
  hum: number;
  label: MaturityLabel;
};

export type DatasetMaturityModel = {
  version: 1;
  method: "standardized-knn";
  k: number;
  features: ["temp", "hum"];
  normalization: {
    mean: [number, number];
    std: [number, number];
    min: [number, number];
    max: [number, number];
  };
  trainingSamples: DatasetModelSample[];
  metadata: {
    trainedAt: string;
    sampleCount: number;
    trainingSampleCount: number;
    testSampleCount: number;
    accuracy: number;
    maeRemainingHours: null;
  };
};

const MATURITY_LABELS: readonly MaturityLabel[] = [
  "Belum Matang",
  "Hampir Matang",
  "Matang",
  "Overfermentasi / Busuk",
];

let activeDatasetModel: DatasetMaturityModel | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMaturityLabel(value: unknown): value is MaturityLabel {
  return (
    typeof value === "string" &&
    MATURITY_LABELS.includes(value as MaturityLabel)
  );
}

function numberPair(value: unknown): [number, number] | null {
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    typeof value[0] !== "number" ||
    !Number.isFinite(value[0]) ||
    typeof value[1] !== "number" ||
    !Number.isFinite(value[1])
  ) {
    return null;
  }
  return [value[0], value[1]];
}

export function parseDatasetModel(value: unknown): DatasetMaturityModel | null {
  if (!isRecord(value) || value.version !== 1 || value.method !== "standardized-knn") {
    return null;
  }

  const normalization = value.normalization;
  const metadata = value.metadata;
  if (
    !isRecord(normalization) ||
    !isRecord(metadata) ||
    value.k !== 11 ||
    !Array.isArray(value.features) ||
    value.features.length !== 2 ||
    value.features[0] !== "temp" ||
    value.features[1] !== "hum"
  ) {
    return null;
  }

  const mean = numberPair(normalization.mean);
  const std = numberPair(normalization.std);
  const min = numberPair(normalization.min);
  const max = numberPair(normalization.max);
  if (
    !mean ||
    !std ||
    !min ||
    !max ||
    std.some((item) => item <= 0) ||
    min.some((item, index) => item > max[index]) ||
    !Array.isArray(value.trainingSamples)
  ) {
    return null;
  }

  const trainingSamples: DatasetModelSample[] = [];
  for (const sample of value.trainingSamples) {
    if (
      !isRecord(sample) ||
      typeof sample.temp !== "number" ||
      !Number.isFinite(sample.temp) ||
      typeof sample.hum !== "number" ||
      !Number.isFinite(sample.hum) ||
      !isMaturityLabel(sample.label)
    ) {
      return null;
    }
    trainingSamples.push({
      temp: sample.temp,
      hum: sample.hum,
      label: sample.label,
    });
  }

  if (trainingSamples.length === 0) return null;

  if (
    typeof metadata.trainedAt !== "string" ||
    !Number.isFinite(Date.parse(metadata.trainedAt)) ||
    typeof metadata.sampleCount !== "number" ||
    !Number.isInteger(metadata.sampleCount) ||
    metadata.sampleCount < 1 ||
    typeof metadata.trainingSampleCount !== "number" ||
    !Number.isInteger(metadata.trainingSampleCount) ||
    metadata.trainingSampleCount < 1 ||
    metadata.trainingSampleCount !== trainingSamples.length ||
    typeof metadata.testSampleCount !== "number" ||
    !Number.isInteger(metadata.testSampleCount) ||
    metadata.testSampleCount < 1 ||
    metadata.sampleCount !==
      metadata.trainingSampleCount + metadata.testSampleCount ||
    typeof metadata.accuracy !== "number" ||
    !Number.isFinite(metadata.accuracy) ||
    metadata.accuracy < 0 ||
    metadata.accuracy > 1 ||
    metadata.maeRemainingHours !== null
  ) {
    return null;
  }

  return {
    version: 1,
    method: "standardized-knn",
    k: 11,
    features: ["temp", "hum"],
    normalization: { mean, std, min, max },
    trainingSamples,
    metadata: {
      trainedAt: metadata.trainedAt,
      sampleCount: metadata.sampleCount,
      trainingSampleCount: metadata.trainingSampleCount,
      testSampleCount: metadata.testSampleCount,
      accuracy: metadata.accuracy,
      maeRemainingHours: null,
    },
  };
}

export function activateDatasetModel(
  value: unknown,
): PredictionModelInfo | null {
  const model = parseDatasetModel(value);
  activeDatasetModel = model;
  if (!model) return null;

  return {
    status: "ready",
    sampleCount: model.metadata.sampleCount,
    trainingSampleCount: model.metadata.trainingSampleCount,
    testSampleCount: model.metadata.testSampleCount,
    accuracy: model.metadata.accuracy,
    maeRemainingHours: null,
    trainedAt: model.metadata.trainedAt,
  };
}

export function classifyWithDatasetModel(
  model: DatasetMaturityModel,
  temp: number,
  hum: number,
): {
  label: MaturityLabel;
  confidence: number;
  sampleCount: number;
  neighborCount: number;
  winningVotes: number;
} {
  const neighbors = model.trainingSamples
    .map((sample) => ({
      label: sample.label,
      temp: sample.temp,
      hum: sample.hum,
      distance: Math.hypot(
        (sample.temp - temp) / model.normalization.std[0],
        (sample.hum - hum) / model.normalization.std[1],
      ),
    }))
    .sort(
      (left, right) =>
        left.distance - right.distance ||
        MATURITY_LABELS.indexOf(left.label) -
          MATURITY_LABELS.indexOf(right.label) ||
        left.temp - right.temp ||
        left.hum - right.hum,
    )
    .slice(0, Math.min(model.k, model.trainingSamples.length));

  const votes = new Map<MaturityLabel, { count: number; distance: number }>();
  for (const neighbor of neighbors) {
    const vote = votes.get(neighbor.label) ?? { count: 0, distance: 0 };
    vote.count += 1;
    vote.distance += neighbor.distance;
    votes.set(neighbor.label, vote);
  }

  const [label, winner] = [...votes.entries()].sort(
    (left, right) =>
      right[1].count - left[1].count ||
      left[1].distance - right[1].distance ||
      MATURITY_LABELS.indexOf(left[0]) - MATURITY_LABELS.indexOf(right[0]),
  )[0];

  return {
    label,
    confidence: winner.count / neighbors.length,
    sampleCount: model.metadata.trainingSampleCount,
    neighborCount: neighbors.length,
    winningVotes: winner.count,
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function predictWithLegacyRules(input: PredictionInput): PredictionResult {
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
      `Suhu ${input.reading.temp.toFixed(1)} °C berada di bawah rentang acuan aplikasi (${CONFIG.idealTemperature.join("–")} °C). Jangan mengubah proses hanya berdasarkan angka ini.`,
    );
  } else if (input.reading.temp > CONFIG.idealTemperature[1]) {
    notes.push(
      `Suhu ${input.reading.temp.toFixed(1)} °C berada di atas rentang acuan aplikasi (${CONFIG.idealTemperature.join("–")} °C). Periksa kondisi tape secara langsung.`,
    );
  } else {
    notes.push(
      `Suhu ${input.reading.temp.toFixed(1)} °C berada dalam rentang acuan aplikasi; ini belum memastikan tape matang.`,
    );
  }

  if (overripe) {
    notes.push(
      "Nilai sensor gas tinggi. Periksa aroma dan kondisi tape; jangan dicicipi jika ada tanda mencurigakan.",
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

export function predict(input: PredictionInput): PredictionResult {
  if (!activeDatasetModel) {
    return predictWithLegacyRules(input);
  }

  const start = input.batchStart ?? input.firstReadingAt ?? input.now;
  const elapsed = Math.max(0, (input.now - start) / 3_600_000);
  const classification = classifyWithDatasetModel(
    activeDatasetModel,
    input.reading.temp,
    input.reading.hum,
  );
  const stageIndex =
    classification.label === "Belum Matang"
      ? 0
      : classification.label === "Hampir Matang"
        ? 2
        : 3;
  const stageStart = STAGES[stageIndex].from;
  const stageEnd = STAGES[stageIndex + 1]?.from ?? 1;
  const progress = (stageStart + stageEnd) / 2;
  const overripe = classification.label === "Overfermentasi / Busuk";
  const remainingHours =
    stageIndex === 3 ? 0 : Math.max(0, CONFIG.targetHours - elapsed);
  const notes: string[] = [];

  if (input.reading.temp < CONFIG.idealTemperature[0]) {
    notes.push(
      `Suhu ${input.reading.temp.toFixed(1)} °C berada di bawah rentang acuan aplikasi (${CONFIG.idealTemperature.join("–")} °C). Jangan mengubah proses hanya berdasarkan angka ini.`,
    );
  } else if (input.reading.temp > CONFIG.idealTemperature[1]) {
    notes.push(
      `Suhu ${input.reading.temp.toFixed(1)} °C berada di atas rentang acuan aplikasi (${CONFIG.idealTemperature.join("–")} °C). Periksa kondisi tape secara langsung.`,
    );
  } else {
    notes.push(
      `Suhu ${input.reading.temp.toFixed(1)} °C berada dalam rentang acuan aplikasi; ini belum memastikan tape matang.`,
    );
  }

  notes.push(
    `Perkiraan tahap memakai suhu dan kelembapan udara. Waktu tersisa belum diukur; aplikasi masih memakai patokan awal ${CONFIG.targetHours} jam.`,
  );
  if (overripe) {
    notes.push(
      "Pola sensor menunjukkan kemungkinan fermentasi berlebih. Jangan dicicipi jika ada jamur, lendir, atau bau menyimpang.",
    );
  }
  if (input.batchStart === null) {
    notes.push(
      "ℹ️ Waktu mulai belum diatur; estimasi waktu dihitung dari data pertama.",
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
