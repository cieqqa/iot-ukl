import { CONFIG, SENSORS } from "@/lib/config";
import { formatDateTime } from "@/lib/format";
import type { SensorKey, SensorSample } from "@/lib/types";

type SensorCardsProps = {
  readings: SensorSample[];
  summaryReadings: SensorSample[];
  lastUpdatedAt: number | null;
  onSelectSeries: (key: SensorKey) => void;
};

function sensorStatus(
  key: SensorKey,
  value: number,
): { label: string; tone: string } {
  if (key === "temp") {
    if (value < CONFIG.idealTemperature[0]) {
      return { label: "#di bawah acuan", tone: "warn" };
    }
    if (value > CONFIG.idealTemperature[1]) {
      return { label: "#di atas acuan", tone: "bad" };
    }
    return { label: "#dalam rentang acuan", tone: "ok" };
  }

  if (key === "hum") {
    if (value < 55) return { label: "#kering", tone: "warn" };
    if (value > 92) return { label: "#sangat lembap", tone: "warn" };
    return { label: "#normal", tone: "ok" };
  }

  if (key === "gas") {
    return { label: "", tone: "" };
  }

  return value < 30
    ? { label: "#masih padat", tone: "" }
    : { label: "#mulai berair", tone: "ok" };
}

function gasStatus(
  value: number,
  ripeThreshold: number,
  overripeThreshold: number,
): { label: string; tone: string } {
  if (value >= overripeThreshold) {
    return { label: "#lewat matang", tone: "bad" };
  }
  if (value >= ripeThreshold) {
    return { label: "#matang", tone: "ok" };
  }
  if (value >= ripeThreshold * 0.4) {
    return { label: "#naik", tone: "warn" };
  }
  return { label: "#masih awal", tone: "" };
}

function sparkline(readings: SensorSample[], key: SensorKey) {
  const points = readings.slice(-30).map((reading) => reading[key]);
  if (points.length < 2) {
    return null;
  }

  const minimum = Math.min(...points);
  const range = Math.max(...points) - minimum || 1;
  const polyline = points
    .map(
      (value, index) =>
        `${((index / (points.length - 1)) * 100).toFixed(1)},${(
          48 -
          ((value - minimum) / range) * 38
        ).toFixed(1)}`,
    )
    .join(" ");

  return (
    <svg
      className="sp"
      viewBox="0 0 100 56"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={polyline}
        fill="none"
        stroke="rgba(18,21,26,.55)"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function SensorCards({
  readings,
  summaryReadings,
  lastUpdatedAt,
  onSelectSeries,
  ripeThreshold,
  overripeThreshold,
}: SensorCardsProps & {
  ripeThreshold: number;
  overripeThreshold: number;
}) {
  const latest = readings.at(-1);

  return (
    <section className="sec" id="pantau">
      <div className="sec-h">
        <h2>Pantauan langsung</h2>
        <div className="sync-meta">
          <span>
            Sinkronisasi dashboard:{" "}
            {lastUpdatedAt !== null ? formatDateTime(lastUpdatedAt) : "belum ada"}
          </span>
          <span>
            Sensor terakhir masuk:{" "}
            {latest ? formatDateTime(latest.ts) : "belum ada"}
          </span>
        </div>
      </div>
      <div className="summary-ten-minute">
        <div className="summary-head">
          <h3>Ringkasan 10 menit terakhir</h3>
          <span>{summaryReadings.length} pembacaan sensor</span>
        </div>
        {summaryReadings.length === 0 ? (
          <p className="summary-empty">
            Belum ada data sensor dalam 10 menit terakhir.
          </p>
        ) : (
          <div className="summary-grid">
            {SENSORS.map((sensor) => {
              const values = summaryReadings.map(
                (reading) => reading[sensor.key],
              );
              const average =
                values.reduce((total, value) => total + value, 0) /
                values.length;
              const formatValue = (value: number) =>
                sensor.key === "temp"
                  ? value.toFixed(1)
                  : String(Math.round(value));

              return (
                <div className="summary-item" key={sensor.key}>
                  <small>{sensor.title}</small>
                  <b>
                    {formatValue(average)} {sensor.unit}
                  </b>
                  <span>
                    Min {formatValue(Math.min(...values))} · Maks{" "}
                    {formatValue(Math.max(...values))}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="sens">
        {SENSORS.map((sensor) => {
          const values = readings.map((reading) => reading[sensor.key]);
          const value = latest?.[sensor.key];
          const status =
            sensor.key === "gas" && value !== undefined
              ? gasStatus(value, ripeThreshold, overripeThreshold)
              : value === undefined
                ? { label: "", tone: "" }
                : sensorStatus(sensor.key, value);
          const displayValue =
            value === undefined
              ? "–"
              : sensor.key === "temp"
                ? value.toFixed(1)
                : String(Math.round(value));

          return (
            <article className="sc" key={sensor.key}>
              <div className="top" style={{ background: sensor.background }}>
                <div className="chips">
                  {status.label && (
                    <span className={`chip ${status.tone}`}>{status.label}</span>
                  )}
                </div>
                <span className="big">{sensor.icon}</span>
                {sparkline(readings, sensor.key)}
              </div>
              <div className="body">
                <small>
                  {sensor.title} · {sensor.source}
                </small>
                <div className="val">
                  {displayValue}
                  <span>{sensor.unit}</span>
                </div>
                <div className="mm">
                  <div>
                    Terendah
                    <b>{values.length ? Math.min(...values) : "–"}</b>
                  </div>
                  <div>
                    Tertinggi
                    <b>{values.length ? Math.max(...values) : "–"}</b>
                  </div>
                </div>
              </div>
              <div className="foot">
                <span>{values.length} data</span>
                <button
                  className="btn"
                  onClick={() => onSelectSeries(sensor.key)}
                  type="button"
                >
                  Lihat grafik <span>↗</span>
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
