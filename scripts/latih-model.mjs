import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATASET_PATH = join(ROOT, "dataset_kematangan_tape_1000.csv");
const MODEL_PATH = join(ROOT, "lib", "model-kematangan.json");
const LABELS = [
  "Belum Matang",
  "Hampir Matang",
  "Matang",
  "Overfermentasi / Busuk",
];
const K_NEIGHBORS = 11;
const TEST_RATIO = 0.2;

function parseCsvRow(line) {
  return line.split(",").map((value) => value.trim());
}

function shuffle(items, random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function readDataset(contents) {
  const lines = contents.replace(/^\uFEFF/, "").trimEnd().split(/\r?\n/);
  const headers = parseCsvRow(lines.shift() ?? "");
  const expectedHeaders = [
    "No",
    "Suhu (°C)",
    "Kelembapan (%)",
    "Gas_MQ3_Alkohol (ppm)",
    "Gas_MQ135_Udara (ppm)",
    "pH_Estimasi",
    "Kematangan",
  ];
  if (headers.join("|") !== expectedHeaders.join("|")) {
    throw new Error(`Kolom dataset tidak sesuai: ${headers.join(", ")}`);
  }

  const seenIds = new Set();
  return lines.map((line, index) => {
    const columns = parseCsvRow(line);
    const values = columns.slice(0, 6).map(Number);
    const sourceNo = values[0];
    const temp = values[1];
    const hum = values[2];
    const label = columns[6];
    if (
      columns.length !== expectedHeaders.length ||
      columns.some((value) => value === "") ||
      !values.every(Number.isFinite) ||
      !Number.isInteger(sourceNo) ||
      seenIds.has(sourceNo) ||
      !LABELS.includes(label)
    ) {
      throw new Error(`Baris ${index + 2} dataset tidak valid.`);
    }
    seenIds.add(sourceNo);
    return { sourceNo, temp, hum, label };
  });
}

function getNormalization(samples) {
  const features = ["temp", "hum"];
  const mean = features.map(
    (feature) =>
      samples.reduce((sum, sample) => sum + sample[feature], 0) /
      samples.length,
  );
  const std = features.map((feature, index) => {
    const variance =
      samples.reduce(
        (sum, sample) => sum + (sample[feature] - mean[index]) ** 2,
        0,
      ) / samples.length;
    return Math.sqrt(variance) || 1;
  });
  const min = features.map((feature) =>
    Math.min(...samples.map((sample) => sample[feature])),
  );
  const max = features.map((feature) =>
    Math.max(...samples.map((sample) => sample[feature])),
  );

  return { mean, std, min, max };
}

function classify(samples, normalization, temp, hum) {
  const neighbors = samples
    .map((sample) => ({
      sourceNo: sample.sourceNo,
      label: sample.label,
      distance: Math.hypot(
        (sample.temp - temp) / normalization.std[0],
        (sample.hum - hum) / normalization.std[1],
      ),
    }))
    .sort(
      (left, right) =>
        left.distance - right.distance ||
        LABELS.indexOf(left.label) - LABELS.indexOf(right.label) ||
        left.temp - right.temp ||
        left.hum - right.hum,
    )
    .slice(0, Math.min(K_NEIGHBORS, samples.length));
  const votes = new Map(
    LABELS.map((label) => [label, { count: 0, distance: 0 }]),
  );
  for (const neighbor of neighbors) {
    const vote = votes.get(neighbor.label);
    vote.count += 1;
    vote.distance += neighbor.distance;
  }
  return [...votes.entries()]
    .sort(
      (left, right) =>
        right[1].count - left[1].count ||
        left[1].distance - right[1].distance ||
        LABELS.indexOf(left[0]) - LABELS.indexOf(right[0]),
    )[0][0];
}

const contents = await readFile(DATASET_PATH, "utf8");
const dataset = readDataset(contents);
if (dataset.length < 2) {
  throw new Error("Dataset harus memiliki setidaknya dua baris.");
}

const random = seededRandom(20261124);
const trainingSamples = [];
const testSamples = [];
for (const label of LABELS) {
  const group = shuffle(
    dataset.filter((sample) => sample.label === label),
    random,
  );
  const testCount = Math.max(1, Math.round(group.length * TEST_RATIO));
  testSamples.push(...group.slice(0, testCount));
  trainingSamples.push(...group.slice(testCount));
}
trainingSamples.sort(
  (left, right) =>
    left.temp - right.temp ||
    left.hum - right.hum ||
    LABELS.indexOf(left.label) - LABELS.indexOf(right.label),
);
testSamples.sort((left, right) => left.sourceNo - right.sourceNo);

const normalization = getNormalization(trainingSamples);
const confusion = Object.fromEntries(
  LABELS.map((actual) => [actual, Object.fromEntries(LABELS.map((label) => [label, 0]))]),
);
const results = testSamples.map((sample) => {
  const predicted = classify(
    trainingSamples,
    normalization,
    sample.temp,
    sample.hum,
  );
  confusion[sample.label][predicted] += 1;
  return { ...sample, predicted };
});
const correct = results.filter((result) => result.predicted === result.label).length;
const accuracy = correct / results.length;
const examples = LABELS.map((label) =>
  results.find((result) => result.label === label),
).filter(Boolean);

const model = {
  version: 1,
  method: "standardized-knn",
  k: K_NEIGHBORS,
  features: ["temp", "hum"],
  normalization,
  trainingSamples: trainingSamples.map(({ temp, hum, label }) => ({
    temp,
    hum,
    label,
  })),
  metadata: {
    trainedAt: new Date().toISOString(),
    sampleCount: dataset.length,
    trainingSampleCount: trainingSamples.length,
    testSampleCount: testSamples.length,
    accuracy,
    maeRemainingHours: null,
    split: "stratified random by label; no batch column is present",
    seed: 20261124,
    classCounts: Object.fromEntries(
      LABELS.map((label) => [
        label,
        dataset.filter((sample) => sample.label === label).length,
      ]),
    ),
    confusionMatrix: confusion,
    examples: examples.map((sample) => ({
      sourceNo: sample.sourceNo,
      temp: sample.temp,
      hum: sample.hum,
      actual: sample.label,
      predicted: sample.predicted,
    })),
  },
};

await writeFile(MODEL_PATH, `${JSON.stringify(model, null, 2)}\n`, "utf8");
console.log(`Dataset: ${dataset.length} baris`);
console.log(
  `Latih/uji: ${trainingSamples.length}/${testSamples.length}; akurasi status: ${(accuracy * 100).toFixed(2)}%; MAE jam: tidak tersedia`,
);
console.table(
  examples.map(({ sourceNo, temp, hum, label, predicted }) => ({
    No: sourceNo,
    Suhu: temp,
    Kelembapan: hum,
    Asli: label,
    Prediksi: predicted,
  })),
);
console.log(`Model ditulis ke ${MODEL_PATH}`);
