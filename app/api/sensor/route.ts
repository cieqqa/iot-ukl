import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type SensorPayload = {
  temperature: number;
  humidity: number;
  mq_value: number;
  moisture: number;
};

let supabaseClient: SupabaseClient | undefined;

function getSupabaseClient():
  | { client: SupabaseClient; error?: never }
  | { client?: never; error: string } {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return {
      error:
        "Konfigurasi Supabase belum lengkap. Isi SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di .env.local.",
    };
  }

  if (!supabaseClient) {
    try {
      supabaseClient = createClient(url, serviceRoleKey);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Periksa kembali URL dan service role key Supabase.";
      console.error("Konfigurasi Supabase tidak valid:", message);
      return { error: `Konfigurasi Supabase tidak valid: ${message}` };
    }
  }

  return { client: supabaseClient };
}

function isSensorPayload(value: unknown): value is SensorPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const payload = value as Record<string, unknown>;
  return (
    typeof payload.temperature === "number" &&
    Number.isFinite(payload.temperature) &&
    typeof payload.humidity === "number" &&
    Number.isFinite(payload.humidity) &&
    typeof payload.mq_value === "number" &&
    Number.isFinite(payload.mq_value) &&
    typeof payload.moisture === "number" &&
    Number.isFinite(payload.moisture)
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Terjadi kesalahan saat menghubungi Supabase.";
}

export async function POST(request: Request) {
  const configuredApiKey = process.env.IOT_API_KEY;
  if (configuredApiKey) {
    const suppliedApiKey =
      request.headers.get("x-api-key") ??
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (suppliedApiKey !== configuredApiKey) {
      return NextResponse.json(
        { success: false, error: "API key perangkat tidak valid." },
        { status: 401 },
      );
    }
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Body harus berupa JSON yang valid." },
      { status: 400 },
    );
  }

  if (!isSensorPayload(payload)) {
    return NextResponse.json(
      {
        success: false,
        error: "temperature, humidity, mq_value, dan moisture harus berupa angka yang valid.",
      },
      { status: 400 },
    );
  }

  const result = getSupabaseClient();
  if (!result.client) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 500 },
    );
  }

  try {
    const { error } = await result.client.from("sensor_readings").insert({
      temp: payload.temperature,
      hum: payload.humidity,
      gas: payload.mq_value,
      soil: payload.moisture,
    });

    if (error) {
      console.error("Gagal menyimpan pembacaan sensor ke Supabase:", error.message);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 502 },
      );
    }
  } catch (error) {
    const message = errorMessage(error);
    console.error("Gagal menghubungi Supabase saat menyimpan sensor:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 502 },
    );
  }

  return NextResponse.json({ success: true });
}

export async function GET(request: Request) {
  const requestedLimit = new URL(request.url).searchParams.get("limit");
  const parsedLimit = requestedLimit === null ? 90 : Number(requestedLimit);

  if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
    return NextResponse.json(
      { success: false, error: "Parameter limit harus berupa bilangan bulat positif." },
      { status: 400 },
    );
  }

  const limit = Math.min(parsedLimit, 500);
  const result = getSupabaseClient();
  if (!result.client) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 500 },
    );
  }

  try {
    const { data, error } = await result.client
      .from("sensor_readings")
      .select("created_at, temp, hum, gas, soil")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Gagal mengambil riwayat sensor dari Supabase:", error.message);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 502 },
      );
    }

    return NextResponse.json((data ?? []).reverse());
  } catch (error) {
    const message = errorMessage(error);
    console.error("Gagal menghubungi Supabase saat membaca riwayat sensor:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 502 },
    );
  }
}
