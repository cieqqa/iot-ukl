export type SensorKey = "temp" | "hum" | "gas" | "soil";

export type SensorValues = Record<SensorKey, number>;

export type SensorRow = SensorValues & {
  created_at: string;
};

export type SensorSample = SensorValues & {
  ts: number;
};

export type MaturityLabel =
  | "Belum Matang"
  | "Hampir Matang"
  | "Matang"
  | "Overfermentasi / Busuk";

export type TapeModelResult = {
  label: MaturityLabel;
  confidence: number;
  recommendation: string;
  sampleCount: number;
};

export type PredictionModelInfo =
  | { status: "loading" }
  | {
      status: "ready";
      sampleCount: number;
      trainingSampleCount: number;
      testSampleCount: number;
      accuracy: number;
      maeRemainingHours: null;
      trainedAt: string;
    }
  | { status: "fallback"; message: string };

export type ConnectionStatus = "connecting" | "online" | "demo" | "offline";

export type EventLog = {
  id: number;
  timestamp: number;
  text: string;
  tone?: "ok" | "warn" | "bad";
};

export type PredictionResult = {
  start: number;
  elapsed: number;
  progress: number;
  remainingHours: number;
  eta: number;
  stageIndex: number;
  overripe: boolean;
  notes: string[];
};

export type SensorDefinition = {
  key: SensorKey;
  title: string;
  unit: string;
  icon: string;
  background: string;
  source: string;
};
