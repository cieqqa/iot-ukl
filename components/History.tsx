import { SENSOR_SERIES, SERIES } from "@/lib/config";
import { formatDateTime, formatTime } from "@/lib/format";
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
  const recentReadings = [...readings].slice(-20).reverse();

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
      <div className="sensor-updates">
        <div className="updates-heading">
          <h3>Pembaruan data sensor</h3>
          <span>20 pembacaan terbaru</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Tanggal &amp; waktu</th>
                <th scope="col">Suhu</th>
                <th scope="col">Kelembapan udara</th>
                <th scope="col">Gas (ADC)</th>
                <th scope="col">Kelembapan tape</th>
              </tr>
            </thead>
            <tbody>
              {recentReadings.length === 0 ? (
                <tr>
                  <td className="table-empty" colSpan={5}>
                    Belum ada pembacaan sensor.
                  </td>
                </tr>
              ) : (
                recentReadings.map((reading) => (
                  <tr key={reading.ts}>
                    <td>{formatDateTime(reading.ts)}</td>
                    <td>{reading.temp.toFixed(1)} °C</td>
                    <td>{Math.round(reading.hum)}%</td>
                    <td>{Math.round(reading.gas)} ADC</td>
                    <td>{Math.round(reading.soil)}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
