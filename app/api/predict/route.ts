import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import {
  classifyWithDatasetModel,
  parseDatasetModel,
  type DatasetMaturityModel,
} from "@/lib/predict";
import type { MaturityLabel } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let datasetModelPromise: Promise<DatasetMaturityModel> | undefined;

function loadDatasetModel(): Promise<DatasetMaturityModel> {
  if (!datasetModelPromise) {
    datasetModelPromise = readFile(
      join(process.cwd(), "lib", "model-kematangan.json"),
      "utf8",
    )
      .then((contents) => {
        const model = parseDatasetModel(JSON.parse(contents));
        if (!model) {
          throw new Error("Format lib/model-kematangan.json tidak valid.");
        }
        return model;
      })
      .catch((error: unknown) => {
        datasetModelPromise = undefined;
        throw error;
      });
  }
  return datasetModelPromise;
}

function isPredictionInput(
  value: unknown,
): value is { temp: number; hum: number } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const input = value as Record<string, unknown>;
  return (
    typeof input.temp === "number" &&
    Number.isFinite(input.temp) &&
    input.temp >= -20 &&
    input.temp <= 80 &&
    typeof input.hum === "number" &&
    Number.isFinite(input.hum) &&
    input.hum >= 0 &&
    input.hum <= 100
  );
}

function getRecommendation(label: MaturityLabel): string {
  const advice: Record<MaturityLabel, string> = {
    "Belum Matang":
      "Model melihat pola yang lebih mirip contoh berlabel “Belum Matang”. Lanjutkan peraman dalam wadah bersih dan tertutup. Periksa aroma, tekstur, dan warna secara berkala; model ini tidak bisa menghitung berapa jam lagi tape akan matang.",
    "Hampir Matang":
      "Model melihat pola yang mendekati contoh “Hampir Matang”. Periksa apakah aroma dan teksturnya sudah sesuai dengan tape yang biasa kamu buat. Jika belum, lanjutkan peraman dan pantau lagi; jangan mengambil keputusan hanya dari angka sensor.",
    Matang:
      "Model melihat pola yang mirip contoh “Matang”. Cocokkan dengan aroma dan tekstur tape. Jika keduanya sesuai dan tidak ada tanda mencurigakan, hentikan peraman lalu simpan tertutup di kulkas.",
    "Overfermentasi / Busuk":
      "Model melihat pola yang mirip contoh “Overfermentasi / Busuk”. Jangan dicicipi untuk menguji. Jika ada jamur, lendir, atau bau menyimpang, buang tape; hasil model tidak bisa memastikan keamanan pangan.",
  };
  return advice[label];
}

function getRangeWarning(
  model: DatasetMaturityModel,
  temp: number,
  hum: number,
): string | null {
  const [minimumTemp, minimumHumidity] = model.normalization.min;
  const [maximumTemp, maximumHumidity] = model.normalization.max;
  const outside: string[] = [];

  if (temp < minimumTemp || temp > maximumTemp) {
    outside.push(
      `suhu ${temp.toFixed(1)} °C (rentang data latih ${minimumTemp.toFixed(1)}–${maximumTemp.toFixed(1)} °C)`,
    );
  }
  if (hum < minimumHumidity || hum > maximumHumidity) {
    outside.push(
      `kelembapan udara ${hum.toFixed(1)}% (rentang data latih ${minimumHumidity.toFixed(1)}–${maximumHumidity.toFixed(1)}%)`,
    );
  }

  return outside.length
    ? `Pembacaan ${outside.join(" dan ")} berada di luar rentang data latih. Anggap hasil ini kurang meyakinkan.`
    : null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Terjadi kesalahan saat memuat model.";
}

export async function GET() {
  try {
    return NextResponse.json(await loadDatasetModel());
  } catch (error) {
    const message = errorMessage(error);
    console.error("Gagal membaca model kematangan:", message);
    return NextResponse.json(
      { error: `Model kematangan tidak tersedia: ${message}` },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Body harus berupa JSON yang valid." },
      { status: 400 },
    );
  }

  if (!isPredictionInput(input)) {
    return NextResponse.json(
      { error: "Suhu dan kelembapan harus berupa angka yang valid." },
      { status: 400 },
    );
  }

  try {
    const model = await loadDatasetModel();
    const result = classifyWithDatasetModel(model, input.temp, input.hum);
    const rangeWarning = getRangeWarning(model, input.temp, input.hum);
    return NextResponse.json({
      ...result,
      explanation: `Sensor membaca suhu ${input.temp.toFixed(1)} °C dan kelembapan udara ${input.hum.toFixed(1)}%. Model membandingkan dua angka ini dengan dataset; ${result.winningVotes} dari ${result.neighborCount} contoh terdekat berlabel “${result.label}”. Gas dan kelembapan tape tidak dipakai untuk menentukan label AI.`,
      rangeWarning,
      recommendation: getRecommendation(result.label),
      validationAccuracy: model.metadata.accuracy,
      testSampleCount: model.metadata.testSampleCount,
    });
  } catch (error) {
    const message = errorMessage(error);
    console.error("Gagal memprediksi kematangan tape:", message);
    return NextResponse.json(
      { error: `Prediksi model gagal: ${message}` },
      { status: 500 },
    );
  }
}
