export type SensorKey = "temp" | "hum" | "gas" | "soil";

export type SensorValues = Record<SensorKey, number>;

export type SensorRow = SensorValues & {
  created_at: string;
};

export type SensorSample = SensorValues & {
  ts: number;
};

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
