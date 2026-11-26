import { formatDateTime } from "@/lib/format";
import type { SensorKey, SensorSample } from "@/lib/types";

type SensorInsightsProps = {
  latestReading: SensorSample | null;
  summaryReadings: SensorSample[];
  lastUpdatedAt: number | null;
};

const INSIGHT_SENSORS: {
  key: SensorKey;
  label: string;
  unit: string;
  decimals: number;
}[] = [
  { key: "temp", label: "Suhu", unit: "°C", decimals: 1 },
  { key: "hum", label: "Kelembapan udara", unit: "%", decimals: 0 },
  { key: "gas", label: "Sensor gas", unit: "ADC", decimals: 0 },
  { key: "soil", label: "Kelembapan tape", unit: "%", decimals: 0 },
];

function formatValue(value: number, decimals: number): string {
  return value.toFixed(decimals);
}

function describeChange(
  readings: SensorSample[],
  key: SensorKey,
  unit: string,
  decimals: number,
): string {
  if (readings.length < 2) {
    return "Belum cukup pembacaan dalam 10 menit untuk melihat perubahannya.";
  }

  const first = readings[0][key];
  const latest = readings[readings.length - 1][key];
  const change = Number((latest - first).toFixed(decimals));

  if (change === 0) {
    return "Tidak berubah pada ketelitian tampilan selama rentang ini.";
  }

  return `Berubah ${change > 0 ? "naik" : "turun"} ${formatValue(Math.abs(change), decimals)} ${unit} sejak pembacaan awal rentang ini.`;
}

export default function SensorInsights({
  latestReading,
  summaryReadings,
  lastUpdatedAt,
}: SensorInsightsProps) {
  return (
    <section className="sec" id="insight-sensor">
      <div className="sec-h">
        <h2>Insight dari sensor</h2>
        <span className="hint">Perubahan pembacaan selama 10 menit terakhir</span>
      </div>
      <div className="sensor-insights">
        <p className="insight-sync">
          Sinkronisasi dashboard:{" "}
          {lastUpdatedAt !== null
            ? formatDateTime(lastUpdatedAt)
            : "belum ada"}{" "}
          · Sensor terakhir masuk:{" "}
          {latestReading ? formatDateTime(latestReading.ts) : "belum ada"}
        </p>
        {latestReading ? (
          <ul className="insight-list">
            {INSIGHT_SENSORS.map((sensor) => (
              <li key={sensor.key}>
                <strong>{sensor.label}:</strong>{" "}
                {formatValue(latestReading[sensor.key], sensor.decimals)}{" "}
                {sensor.unit}.{" "}
                {describeChange(
                  summaryReadings,
                  sensor.key,
                  sensor.unit,
                  sensor.decimals,
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="insight-empty">Belum ada pembacaan dari sensor.</p>
        )}
        <p className="insight-note">
          Insight ini merangkum perubahan angka sensor, bukan memastikan tape
          sudah matang. Nilai sensor gas ditampilkan sebagai angka ADC.
        </p>
      </div>
    </section>
  );
}
