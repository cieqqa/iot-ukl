import { SENSOR_SERIES, SERIES } from "@/lib/config";
import { formatTime } from "@/lib/format";
import type { EventLog, SensorKey, SensorSample } from "@/lib/types";
import Chart from "@/components/Chart";

type HistoryProps = {
  readings: SensorSample[];
  series: SensorKey;
  onSelectSeries: (series: SensorKey) => void;
  events: EventLog[];
  ripeThreshold: number;
  overripeThreshold: number;
  onRipeThresholdChange: (value: number) => void;
  onOverripeThresholdChange: (value: number) => void;
  mounted: boolean;
};

export default function History({
  readings,
  series,
  onSelectSeries,
  events,
  ripeThreshold,
  overripeThreshold,
  onRipeThresholdChange,
  onOverripeThresholdChange,
  mounted,
}: HistoryProps) {
  return (
    <section className="sec" id="riwayat">
      <div className="sec-h">
        <h2>Riwayat &amp; catatan</h2>
      </div>
      <div className="two">
        <div className="card">
          <div className="tabs" role="tablist" aria-label="Pilih grafik sensor">
            {SENSOR_SERIES.map((key) => (
              <button
                className={`tab ${key === series ? "on" : ""}`}
                key={key}
                onClick={() => onSelectSeries(key)}
                type="button"
                role="tab"
                aria-selected={key === series}
              >
                {SERIES[key].replace(/ \(.*\)/, "")}
              </button>
            ))}
          </div>
          <Chart
            readings={readings}
            series={series}
            ripeThreshold={ripeThreshold}
            overripeThreshold={overripeThreshold}
          />
        </div>
        <div className="card">
          <h3>Log kejadian</h3>
          <ul id="log">
            {events.length === 0 ? (
              <li className="empty">Belum ada kejadian.</li>
            ) : (
              events.map((event) => (
                <li key={event.id}>
                  <time>{mounted ? formatTime(event.timestamp) : "–"}</time>
                  <span>
                    {event.tone ? (
                      <span className={`chip ${event.tone}`}>{event.text}</span>
                    ) : (
                      event.text
                    )}
                  </span>
                </li>
              ))
            )}
          </ul>
          <h3 style={{ marginTop: 18 }}>Batas gas alkohol</h3>
          <div className="set">
            <div>
              <label htmlFor="gasRipe">
                <span>Dianggap matang</span>
                <b>{ripeThreshold}</b>
              </label>
              <input
                id="gasRipe"
                type="range"
                min="300"
                max="3500"
                step="50"
                value={ripeThreshold}
                onChange={(event) =>
                  onRipeThresholdChange(Number(event.currentTarget.value))
                }
              />
            </div>
            <div>
              <label htmlFor="gasOverripe">
                <span>Terlalu matang (asam)</span>
                <b>{overripeThreshold}</b>
              </label>
              <input
                id="gasOverripe"
                type="range"
                min="500"
                max="4000"
                step="50"
                value={overripeThreshold}
                onChange={(event) =>
                  onOverripeThresholdChange(Number(event.currentTarget.value))
                }
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
