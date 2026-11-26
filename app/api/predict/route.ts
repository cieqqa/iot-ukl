import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { CONFIG } from "@/lib/config";
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

function getRecommendation(label: MaturityLabel, temperature: number): string {
  const [minimum, maximum] = CONFIG.idealTemperature;
  const temperatureAdvice =
    temperature < minimum
      ? `Suhu di bawah rentang data tape matang (${minimum}–${maximum} °C).`
      : temperature > maximum
        ? `Suhu di atas rentang data tape matang (${minimum}–${maximum} °C).`
        : "";
  const advice: Record<MaturityLabel, string> = {
    "Belum Matang":
      "Lanjutkan fermentasi dalam wadah bersih dan tertutup. Periksa kembali kondisi tape secara berkala.",
    "Hampir Matang":
      "Periksa aroma dan tekstur tanpa mencicipi bila ada tanda mencurigakan. Pantau kembali secara berkala.",
    Matang:
      "Hentikan fermentasi dan simpan dalam wadah bersih tertutup di kulkas agar fermentasi melambat.",
    "Overfermentasi / Busuk":
      "Jangan dicicipi untuk menguji. Jika ada jamur, lendir, atau bau busuk/menyimpang, buang tape; model tidak memastikan keamanan pangan.",
  };
  return [advice[label], temperatureAdvice].filter(Boolean).join(" ");
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
    return NextResponse.json({
      ...result,
      recommendation: getRecommendation(result.label, input.temp),
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
