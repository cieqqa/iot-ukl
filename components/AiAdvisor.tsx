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
                <small>Kecocokan tetangga</small>
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
              AI adalah tambahan dan tidak mengubah prediksi matang di atas.
              Model memakai suhu, kelembapan, dan gas alkohol. Dataset tidak
              berisi waktu matang; estimasi waktu tetap memakai aturan lama.
              Gas ADC dipetakan secara perkiraan ke rentang dataset, jadi
              kalibrasikan sensor dan validasi hasil dengan batch nyata.
              Prediksi ini bukan jaminan keamanan pangan.
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
