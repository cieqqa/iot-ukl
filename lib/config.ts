import type { SensorDefinition, SensorKey } from "@/lib/types";

export const CONFIG = {
  pollIntervalMs: 5_000,
  maxPoints: 90,
  apiHistoryLimit: 500,
  summaryWindowMs: 10 * 60_000,
  gasMax: 4_095,
  staleSeconds: 40,
  // Dataset contains no elapsed-time labels; retained only for the legacy ETA.
  targetHours: 72,
  // Min/max temperature among rows labeled "Matang" in the source dataset.
  idealTemperature: [28.04, 31.98] as const,
  // Legacy fallback defaults only; dataset gas is ppm, not ESP32 ADC.
  gasRipeDefault: 2_000,
  gasOverripeDefault: 3_200,
  demoStepMinutes: 10,
};

export const STAGES = [
  {
    name: "Awal",
    description: "Ragi baru bekerja, belum terasa.",
    icon: "🌾",
    from: 0,
  },
  {
    name: "Sedang jadi",
    description: "Mulai berair, aroma manis dan asam muncul.",
    icon: "🫧",
    from: 0.2,
  },
  {
    name: "Hampir matang",
    description: "Teksturnya lembut, aroma alkohol kuat.",
    icon: "🍶",
    from: 0.55,
  },
  {
    name: "Matang",
    description: "Siap disajikan. Segera simpan di kulkas.",
    icon: "😋",
    from: 0.85,
  },
] as const;

export const SENSORS: readonly SensorDefinition[] = [
  {
    key: "temp",
    title: "Suhu",
    unit: "°C",
    icon: "🌡️",
    background: "linear-gradient(135deg,#f7dcc4,#eeb48a)",
    source: "DHT11",
  },
  {
    key: "hum",
    title: "Kelembapan udara",
    unit: "%",
    icon: "💧",
    background: "linear-gradient(135deg,#d6e6ea,#9cc3cc)",
    source: "DHT11",
  },
  {
    key: "gas",
    title: "Gas alkohol",
    unit: "ADC",
    icon: "🫧",
    background: "linear-gradient(135deg,#e4dcef,#bda9d6)",
    source: "MQ",
  },
  {
    key: "soil",
    title: "Kelembapan tape",
    unit: "%",
    icon: "🍚",
    background: "linear-gradient(135deg,#e3ead0,#b9cf8f)",
    source: "Soil moisture",
  },
];

export const SERIES: Record<SensorKey, string> = {
  temp: "Suhu (°C)",
  hum: "Kelembapan udara (%)",
  gas: "Gas alkohol (ADC)",
  soil: "Kelembapan tape (%)",
};

export const SENSOR_SERIES: readonly SensorKey[] = [
  "temp",
  "hum",
  "gas",
  "soil",
];
