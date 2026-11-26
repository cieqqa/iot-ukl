"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AiAdvisor from "@/components/AiAdvisor";
import Hero from "@/components/Hero";
import History from "@/components/History";
import Navbar from "@/components/Navbar";
import Prediction from "@/components/Prediction";
import SensorCards from "@/components/SensorCards";
import Stages from "@/components/Stages";
import { CONFIG } from "@/lib/config";
import { createDemoHistory, createDemoReading } from "@/lib/demo";
import { formatDuration } from "@/lib/format";
import { activateDatasetModel, predict } from "@/lib/predict";
import type {
  ConnectionStatus,
  EventLog,
  MaturityLabel,
  SensorKey,
  SensorRow,
  SensorSample,
  TapeModelResult,
  PredictionModelInfo,
} from "@/lib/types";

const BATCH_STORAGE_KEY = "peram-start";
const THRESHOLD_STORAGE_KEY = "peram-th";
const HOUR_MS = 3_600_000;

function parseSensorRows(value: unknown): SensorRow[] {
  if (!Array.isArray(value)) {
    throw new Error("Format riwayat sensor dari server tidak valid.");
  }

  return value.map((row: unknown) => {
    if (typeof row !== "object" || row === null) {
      throw new Error("Ada baris sensor yang formatnya tidak valid.");
    }

    const record = row as Record<string, unknown>;
    const temp = record.temp;
    const hum = record.hum;
    const gas = record.gas;
    const soil = record.soil;
    if (
      typeof record.created_at !== "string" ||
      !Number.isFinite(Date.parse(record.created_at)) ||
      typeof temp !== "number" ||
      !Number.isFinite(temp) ||
      typeof hum !== "number" ||
      !Number.isFinite(hum) ||
      typeof gas !== "number" ||
      !Number.isFinite(gas) ||
      typeof soil !== "number" ||
      !Number.isFinite(soil)
    ) {
      throw new Error("Ada baris sensor dengan waktu atau angka yang tidak valid.");
    }

    return {
      created_at: record.created_at,
      temp,
      hum,
      gas,
      soil,
    };
  });
}

function getApiErrorMessage(value: unknown): string | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const error = (value as Record<string, unknown>).error;
  return typeof error === "string" && error.trim() ? error : null;
}

function asSamples(rows: SensorRow[]): SensorSample[] {
  return rows.map((row) => ({
    temp: row.temp,
    hum: row.hum,
    gas: row.gas,
    soil: row.soil,
    ts: Date.parse(row.created_at),
  }));
}

function parseTapeModelResult(value: unknown): TapeModelResult {
  if (typeof value !== "object" || value === null) {
    throw new Error("Format hasil prediksi AI tidak valid.");
  }

  const result = value as Record<string, unknown>;
  const labels: MaturityLabel[] = [
    "Belum Matang",
    "Hampir Matang",
    "Matang",
    "Overfermentasi / Busuk",
  ];
  if (
    typeof result.label !== "string" ||
    !labels.includes(result.label as MaturityLabel) ||
    typeof result.confidence !== "number" ||
    !Number.isFinite(result.confidence) ||
    result.confidence < 0 ||
    result.confidence > 1 ||
    typeof result.recommendation !== "string" ||
    typeof result.sampleCount !== "number" ||
    !Number.isInteger(result.sampleCount) ||
    result.sampleCount < 1
  ) {
    throw new Error("Hasil prediksi AI berisi data yang tidak valid.");
  }

  return {
    label: result.label as MaturityLabel,
    confidence: result.confidence,
    recommendation: result.recommendation,
    sampleCount: result.sampleCount,
  };
}

function readStoredBatchStart(): number | null {
  const value = localStorage.getItem(BATCH_STORAGE_KEY);
  if (value === null) return null;

  const storedStart = Number(value);
  if (!Number.isFinite(storedStart) || storedStart <= 0) {
    throw new Error("Waktu batch tersimpan bukan angka yang valid.");
  }
  return storedStart;
}

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  const [demo, setDemo] = useState(false);
  const [readings, setReadings] = useState<SensorSample[]>([]);
  const [connection, setConnection] =
    useState<ConnectionStatus>("connecting");
  const [connectionText, setConnectionText] = useState("Menghubungkan…");
  const [series, setSeries] = useState<SensorKey>("gas");
  const [batchStart, setBatchStart] = useState<number | null>(null);
  const [ripeThreshold, setRipeThreshold] = useState(CONFIG.gasRipeDefault);
  const [overripeThreshold, setOverripeThreshold] = useState(
    CONFIG.gasOverripeDefault,
  );
  const [predictionModel, setPredictionModel] =
    useState<PredictionModelInfo>({ status: "loading" });
  const [now, setNow] = useState<number | null>(null);
  const [classifiedReading, setClassifiedReading] = useState<{
    ts: number;
    result: TapeModelResult;
  } | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [events, setEvents] = useState<EventLog[]>([]);
  const eventId = useRef(0);
  const previousStage = useRef<number | null>(null);
  const previousOverripe = useRef(false);
  const storageWarningShown = useRef(false);
  const latest = readings.at(-1) ?? null;

  const addLog = useCallback(
    (text: string, tone?: EventLog["tone"]) => {
      const timestamp = now ?? Date.now();
      eventId.current += 1;
      const event: EventLog = {
        id: eventId.current,
        timestamp,
        text,
        tone,
      };
      setEvents((current) => [event, ...current].slice(0, 30));
    },
    [now],
  );

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const response = await fetch("/api/predict", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Server model merespons dengan status ${response.status}.`);
        }

        const status = activateDatasetModel(await response.json());
        if (!status) {
          throw new Error("Berkas model kematangan tidak valid.");
        }
        if (active) setPredictionModel(status);
      } catch (error) {
        if (!active) return;
        const message =
          error instanceof Error ? error.message : "Model kematangan gagal dimuat.";
        console.error("Gagal memuat model kematangan:", message);
        activateDatasetModel(null);
        setPredictionModel({
          status: "fallback",
          message: "Model dataset tidak tersedia atau tidak valid.",
        });
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setMounted(true);
    setNow(Date.now());

    const demoFromUrl = new URLSearchParams(window.location.search).has("demo");
    setDemo(demoFromUrl);

    try {
      const storedThresholds = localStorage.getItem(THRESHOLD_STORAGE_KEY);
      if (storedThresholds) {
        const parsed: unknown = JSON.parse(storedThresholds);
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          !Array.isArray(parsed)
        ) {
          const stored = parsed as Record<string, unknown>;
          const ripe = stored.gasMatang;
          const overripe = stored.gasLewat;
          if (
            typeof ripe === "number" &&
            Number.isFinite(ripe) &&
            typeof overripe === "number" &&
            Number.isFinite(overripe) &&
            ripe >= 300 &&
            ripe <= 3_500 &&
            overripe >= 500 &&
            overripe <= 4_000 &&
            ripe < overripe
          ) {
            setRipeThreshold(ripe);
            setOverripeThreshold(overripe);
          } else {
            throw new Error("Batas gas tersimpan tidak valid.");
          }
        } else {
          throw new Error("Format batas gas tersimpan tidak valid.");
        }
      }
    } catch (error) {
      console.error("Gagal membaca batas gas dari penyimpanan browser:", error);
      eventId.current += 1;
      setEvents([
        {
          id: eventId.current,
          timestamp: Date.now(),
          text: "Batas gas tidak dapat dibaca dari penyimpanan browser.",
          tone: "warn",
        },
      ]);
    }

    try {
      setBatchStart(readStoredBatchStart());
    } catch (error) {
      console.error("Gagal membaca waktu batch dari penyimpanan browser:", error);
      eventId.current += 1;
      setEvents((current) => [
        {
          id: eventId.current,
          timestamp: Date.now(),
          text: "Waktu batch tidak dapat dibaca dari penyimpanan browser.",
          tone: "warn",
        },
        ...current,
      ]);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;

    if (demo) {
      const demoNow = Date.now();
      const demoStart = demoNow - 20 * HOUR_MS;
      let virtualOffset = 0;

      setNow(demoNow);
      setBatchStart(demoStart);
      setReadings(createDemoHistory(demoNow, demoStart));
      setConnection("demo");
      setConnectionText("Mode demo");

      const timer = window.setInterval(() => {
        virtualOffset += CONFIG.demoStepMinutes * 60_000;
        const timestamp = Date.now() + virtualOffset;
        setNow(timestamp);
        setReadings((current) =>
          [
            ...current,
            createDemoReading(timestamp, demoStart),
          ].slice(-CONFIG.maxPoints),
        );
        setConnection("demo");
        setConnectionText("Mode demo");
      }, CONFIG.pollIntervalMs);

      return () => window.clearInterval(timer);
    }

    let polling = false;
    let timer: number | undefined;

    const poll = async () => {
      if (polling) return;
      polling = true;
      setNow(Date.now());

      try {
        const response = await fetch(
          `/api/sensor?limit=${CONFIG.maxPoints}`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          const errorMessage = getApiErrorMessage(await response.json());
          throw new Error(
            errorMessage ?? `Server merespons dengan status ${response.status}.`,
          );
        }

        const rows = parseSensorRows(await response.json());
        const samples = asSamples(rows);
        setReadings(samples);

        if (samples.length === 0) {
          setConnection("offline");
          setConnectionText("Belum ada data masuk");
          return;
        }

        const latest = samples[samples.length - 1];
        const ageSeconds = Math.round((Date.now() - latest.ts) / 1_000);
        if (ageSeconds > CONFIG.staleSeconds) {
          setConnection("offline");
          setConnectionText(`ESP berhenti kirim (${ageSeconds} dtk)`);
        } else {
          setConnection("online");
          setConnectionText("ESP mengirim data");
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Gagal mengambil data sensor.";
        setConnection("offline");
        setConnectionText(message);
        if (
          message.startsWith("SUPABASE_URL") ||
          message.startsWith("Konfigurasi Supabase")
        ) {
          if (timer !== undefined) window.clearInterval(timer);
        }
      } finally {
        polling = false;
      }
    };

    void poll();
    timer = window.setInterval(
      () => void poll(),
      CONFIG.pollIntervalMs,
    );
    return () => {
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, [demo, mounted]);

  useEffect(() => {
    if (!latest) {
      setModelLoading(false);
      setModelError(null);
      return;
    }

    const controller = new AbortController();
    const reading = latest;
    setModelLoading(true);
    setModelError(null);

    void (async () => {
      try {
        const response = await fetch("/api/predict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            temp: reading.temp,
            hum: reading.hum,
          }),
          signal: controller.signal,
        });
        const body: unknown = await response.json();

        if (!response.ok) {
          const message =
            typeof body === "object" &&
            body !== null &&
            "error" in body &&
            typeof body.error === "string"
              ? body.error
              : `Server prediksi merespons dengan status ${response.status}.`;
          throw new Error(message);
        }

        setClassifiedReading({
          ts: reading.ts,
          result: parseTapeModelResult(body),
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        const message =
          error instanceof Error ? error.message : "Prediksi AI gagal.";
        console.error("Gagal meminta prediksi kematangan tape:", message);
        setModelError(message);
      } finally {
        if (!controller.signal.aborted) setModelLoading(false);
      }
    })();

    return () => controller.abort();
  }, [latest?.hum, latest?.temp, latest?.ts]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(
        THRESHOLD_STORAGE_KEY,
        JSON.stringify({
          gasMatang: ripeThreshold,
          gasLewat: overripeThreshold,
        }),
      );
    } catch (error) {
      console.error("Gagal menyimpan batas gas:", error);
      if (!storageWarningShown.current) {
        storageWarningShown.current = true;
        addLog("Batas gas tidak dapat disimpan di browser.", "warn");
      }
    }
  }, [addLog, mounted, overripeThreshold, ripeThreshold]);

  const currentModel =
    latest && classifiedReading?.ts === latest.ts
      ? classifiedReading.result
      : null;
  const prediction = useMemo(() => {
    if (!latest) return null;
    return predict({
      reading: latest,
      batchStart,
      firstReadingAt: readings[0]?.ts ?? null,
      now: now ?? Date.now(),
      gasRipeThreshold: ripeThreshold,
      gasOverripeThreshold: overripeThreshold,
    });
  }, [
    batchStart,
    latest,
    now,
    overripeThreshold,
    predictionModel,
    readings,
    ripeThreshold,
  ]);

  useEffect(() => {
    if (!prediction) return;

    if (previousStage.current !== prediction.stageIndex) {
      const stage = prediction.stageIndex;
      addLog(
        `Tahap: ${["Awal", "Sedang jadi", "Hampir matang", "Matang"][stage]}`,
        stage === 3 ? "ok" : undefined,
      );
      previousStage.current = stage;
    }

    if (prediction.overripe !== previousOverripe.current) {
      if (prediction.overripe) {
        addLog(
          predictionModel.status === "ready"
            ? "Model dataset mengklasifikasikan tape lewat matang"
            : "Gas sangat tinggi, tape mulai lewat matang",
          "bad",
        );
      }
      previousOverripe.current = prediction.overripe;
    }
  }, [addLog, prediction, predictionModel.status]);

  function startNewBatch() {
    if (!window.confirm("Mulai batch tape baru sekarang? Hitungan waktu akan diulang dari nol.")) {
      return;
    }

    const timestamp = now ?? Date.now();
    setBatchStart(timestamp);
    previousStage.current = null;
    previousOverripe.current = false;
    if (!demo) {
      try {
        localStorage.setItem(BATCH_STORAGE_KEY, String(timestamp));
      } catch (error) {
        console.error("Gagal menyimpan waktu batch baru:", error);
        addLog("Waktu batch baru tidak dapat disimpan di browser.", "warn");
      }
    }
    addLog("Batch baru dimulai", "ok");
  }

  function toggleDemo() {
    const nextDemo = !demo;
    setDemo(nextDemo);
    setReadings([]);
    setNow(Date.now());
    setConnection(nextDemo ? "demo" : "connecting");
    setConnectionText(nextDemo ? "Mode demo" : "Menghubungkan…");
    previousStage.current = null;
    previousOverripe.current = false;

    if (!nextDemo) {
      try {
        setBatchStart(readStoredBatchStart());
      } catch (error) {
        console.error("Gagal membaca waktu batch:", error);
        addLog("Waktu batch tidak dapat dibaca dari penyimpanan browser.", "warn");
      }
    }
  }

  function changeRipeThreshold(value: number) {
    setRipeThreshold(Math.min(value, overripeThreshold - 50));
  }

  function changeOverripeThreshold(value: number) {
    setOverripeThreshold(Math.max(value, ripeThreshold + 50));
  }

  const estimate =
    mounted && prediction
      ? prediction.remainingHours === 0
        ? "Sudah matang"
        : formatDuration(prediction.remainingHours)
      : "–";

  return (
    <div className="sheet">
      <Navbar connection={connection} connectionText={connectionText} />
      <Hero estimate={estimate} />
      <Stages activeStage={prediction?.stageIndex ?? -1} />
      <SensorCards
        readings={readings}
        onSelectSeries={setSeries}
        ripeThreshold={ripeThreshold}
        overripeThreshold={overripeThreshold}
      />
      <Prediction
        prediction={prediction}
        mounted={mounted}
        demo={demo}
        modelInfo={predictionModel}
        onToggleDemo={toggleDemo}
        onStartBatch={startNewBatch}
      />
      <AiAdvisor
        result={currentModel}
        error={modelError}
        loading={modelLoading}
      />
      <History
        readings={readings}
        series={series}
        onSelectSeries={setSeries}
        events={events}
        ripeThreshold={ripeThreshold}
        overripeThreshold={overripeThreshold}
        onRipeThresholdChange={changeRipeThreshold}
        onOverripeThresholdChange={changeOverripeThreshold}
        mounted={mounted}
      />
      <footer>
        <span>Peram · ESP32 → Next.js → Supabase</span>
        <span>Data diperbarui tiap 5 detik</span>
      </footer>
    </div>
  );
}
