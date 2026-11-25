import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const DATASET_PATH = new URL("../dataset_kematangan_tape_1000.csv", import.meta.url);
const ENV_PATH = new URL("../.env.local", import.meta.url);
const TABLE = "dataset_kematangan";
const CHUNK_SIZE = 200;
const LABELS = [
  "Belum Matang",
  "Hampir Matang",
  "Matang",
  "Overfermentasi / Busuk",
];

function loadLocalEnvironment(contents) {
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const name = match[1].trim();
    const value = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
    if (!process.env[name]) process.env[name] = value;
  }
}

function parseCsvRow(line) {
  return line.split(",").map((value) => value.trim());
}

const envContents = await readFile(ENV_PATH, "utf8");
loadLocalEnvironment(envContents);
const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  throw new Error("SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY harus ada di .env.local.");
}

const contents = (await readFile(DATASET_PATH, "utf8")).replace(/^\uFEFF/, "");
const [headerLine, ...lines] = contents.trimEnd().split(/\r?\n/);
const expectedHeaders = [
  "No",
  "Suhu (°C)",
  "Kelembapan (%)",
  "Gas_MQ3_Alkohol (ppm)",
  "Gas_MQ135_Udara (ppm)",
  "pH_Estimasi",
  "Kematangan",
];
if (parseCsvRow(headerLine).join("|") !== expectedHeaders.join("|")) {
  throw new Error("Header dataset tidak sesuai dengan skema impor.");
}

const rows = lines.map((line, index) => {
  const columns = parseCsvRow(line);
  const values = columns.slice(0, 6).map(Number);
  if (
    columns.length !== expectedHeaders.length ||
    columns.some((value) => value === "") ||
    !values.every(Number.isFinite) ||
    !Number.isInteger(values[0]) ||
    !LABELS.includes(columns[6])
  ) {
    throw new Error(`Baris ${index + 2} dataset tidak valid.`);
  }
  return {
    source_no: values[0],
    suhu_c: values[1],
    kelembapan_pct: values[2],
    gas_mq3_alkohol_ppm: values[3],
    gas_mq135_udara_ppm: values[4],
    ph_estimasi: values[5],
    kematangan: columns[6],
  };
});

const supabase = createClient(url, serviceRoleKey);
for (let offset = 0; offset < rows.length; offset += CHUNK_SIZE) {
  const chunk = rows.slice(offset, offset + CHUNK_SIZE);
  const { error } = await supabase
    .from(TABLE)
    .upsert(chunk, { onConflict: "source_no" });
  if (error) {
    throw new Error(
      `Impor batch ${Math.floor(offset / CHUNK_SIZE) + 1} gagal: ${error.message}`,
    );
  }
  console.log(`Tersimpan ${Math.min(offset + chunk.length, rows.length)}/${rows.length} baris.`);
}

console.log(`Impor selesai: ${rows.length} baris ke public.${TABLE}.`);
