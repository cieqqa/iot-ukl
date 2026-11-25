import { CONFIG, STAGES } from "@/lib/config";
import { formatDate, formatDuration } from "@/lib/format";
import type { PredictionModelInfo, PredictionResult } from "@/lib/types";

type PredictionProps = {
  prediction: PredictionResult | null;
  mounted: boolean;
  demo: boolean;
  modelInfo: PredictionModelInfo;
  onToggleDemo: () => void;
  onStartBatch: () => void;
};

export default function Prediction({
  prediction,
  mounted,
  demo,
  modelInfo,
  onToggleDemo,
  onStartBatch,
}: PredictionProps) {
  const progress = prediction?.progress ?? 0;
  const percent = Math.round(progress * 100);
  const currentStage = prediction ? STAGES[prediction.stageIndex] : null;
  const estimate =
    !mounted || !prediction
      ? "–"
      : prediction.remainingHours === 0
        ? "Sudah matang 🎉"
        : `± ${formatDuration(prediction.remainingHours)} lagi`;

  return (
    <section className="sec" id="prediksi">
      <div className="sec-h">
        <h2>Prediksi matang</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn ghost" onClick={onToggleDemo} type="button">
            {demo ? "Matikan demo" : "Mode demo"}
          </button>
          <button className="btn" onClick={onStartBatch} type="button">
            + Mulai batch baru
          </button>
        </div>
      </div>
      <div className="pred">
        <div className="ringcard">
          <h3>
            {prediction?.overripe
              ? "Lewat matang"
              : currentStage?.name ?? "–"}
          </h3>
          <div className="ring">
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <circle className="tr" cx="60" cy="60" r="50" />
              <circle
                className="fg"
                cx="60"
                cy="60"
                r="50"
                strokeDasharray="314.16"
                strokeDashoffset={314.16 * (1 - progress)}
              />
            </svg>
            <div className="mid">
              <b>{percent}%</b>
              <span>tingkat kematangan</span>
            </div>
          </div>
          <p>
            {prediction?.overripe
              ? "Kadar gas sangat tinggi"
              : currentStage?.description ?? "Menunggu data…"}
          </p>
        </div>
        <div className="predinfo">
          <p className="eta">
            <small>Estimasi matang</small>
            <span>{estimate}</span>
          </p>
          <div className="when">
            {!mounted || !prediction
              ? "–"
              : prediction.remainingHours === 0
                ? "Siap disajikan sekarang."
                : `Perkiraan siap: ${formatDate(prediction.eta)}`}
          </div>
          <div className="tl">
            <div className="fill" style={{ width: `${percent}%` }} />
            <div className="me" style={{ left: `${Math.max(2, Math.min(98, percent))}%` }}>
              🍚
            </div>
            {STAGES.slice(1).map((stage) => (
              <div
                className="mk"
                key={stage.name}
                style={{ left: `${stage.from * 100}%` }}
              >
                <span>{stage.name}</span>
              </div>
            ))}
          </div>
          <div className="facts">
            <div className="fact">
              <small>Sudah berjalan</small>
              <b>
                {mounted && prediction
                  ? formatDuration(prediction.elapsed)
                  : "–"}
              </b>
            </div>
            <div className="fact">
              <small>Mulai batch</small>
              <b>
                {mounted && prediction ? formatDate(prediction.start) : "–"}
              </b>
            </div>
            <div className="fact">
              <small>Target total</small>
              <b>{CONFIG.targetHours} jam</b>
            </div>
          </div>
          <ul className="notes">
            {prediction?.notes.map((note) => <li key={note}>{note}</li>)}
          </ul>
          <div className="model">
            {modelInfo.status === "ready" ? (
              <>
                Klasifikasi tahap memakai KNN dari {modelInfo.trainingSampleCount}{" "}
                data latih (dari {modelInfo.sampleCount} baris dataset), dengan
                akurasi uji {(modelInfo.accuracy * 100).toFixed(1)}% pada{" "}
                {modelInfo.testSampleCount} baris. Galat rata-rata waktu tidak
                dapat dihitung karena dataset tidak mencatat durasi; estimasi
                jam masih memakai aturan awal {CONFIG.targetHours} jam, bukan
                hasil model. Slider gas hanya berlaku untuk fallback lama.
              </>
            ) : modelInfo.status === "fallback" ? (
              <>
                {modelInfo.message} Prediksi memakai aturan sederhana lama
                (waktu berjalan + kadar gas alkohol).
              </>
            ) : (
              <>
                Model dataset sedang dimuat; sementara prediksi memakai aturan
                sederhana lama (waktu berjalan + kadar gas alkohol).
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
