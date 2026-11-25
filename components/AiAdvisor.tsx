import type { TapeModelResult } from "@/lib/types";

type AiAdvisorProps = {
  result: TapeModelResult | null;
  error: string | null;
  loading: boolean;
};

export default function AiAdvisor({ result, error, loading }: AiAdvisorProps) {
  return (
    <section className="sec" id="rekomendasi-ai">
      <div className="sec-h">
        <h2>Rekomendasi AI</h2>
        <span className="hint">Fitur tambahan · klasifikasi dari dataset tape</span>
      </div>
      <div className="ai-advisor">
        {loading && <p role="status">AI sedang menganalisis data sensor…</p>}
        {error && (
          <p className="model error" role="alert">
            Prediksi AI gagal: {error}
          </p>
        )}
        {result && (
          <>
            <div className="facts">
              <div className="fact">
                <small>Tahap menurut dataset</small>
                <b>{result.label}</b>
              </div>
              <div className="fact">
                <small>Kesepakatan tetangga</small>
                <b>{Math.round(result.confidence * 100)}%</b>
              </div>
              <div className="fact">
                <small>Contoh dataset</small>
                <b>{result.sampleCount}</b>
              </div>
            </div>
            <div className="recommendation">
              <strong>Saran untuk pembuat tape</strong>
              <p>{result.recommendation}</p>
            </div>
            <p className="model">
              Kesepakatan tetangga bukan probabilitas terkalibrasi. Model hanya
              memakai suhu dan kelembapan; gas, soil, pH, dan MQ-135 tidak
              dipakai. Dataset tidak berisi durasi atau batch, jadi akurasi uji
              belum menunjukkan kinerja pada batch baru dan tidak menjamin
              keamanan pangan.
            </p>
          </>
        )}
        {!loading && !error && !result && (
          <p>Menunggu pembacaan sensor untuk menampilkan rekomendasi AI.</p>
        )}
      </div>
    </section>
  );
}
