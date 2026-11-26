# Peram

Peram adalah pemantau fermentasi tape berbasis Next.js 15, TypeScript, KNN, dan
Supabase. ESP32 mengirim pembacaan sensor melalui HTTPS/HTTP ke aplikasi
Next.js; Next.js menyimpan data ke Supabase dan menghasilkan prediksi dari
dataset tape. Dashboard dapat dihosting publik dan digunakan oleh banyak
perangkat/browser.

## Persiapan Supabase

1. Buka proyek Supabase dan jalankan isi [`supabase.sql`](./supabase.sql) di
   **SQL Editor**.
2. Buat `.env.local` di root proyek, lalu isi URL proyek dan **service role
   key** dari pengaturan API Supabase:

   ```env
   SUPABASE_URL=https://project-id.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=service-role-key
   IOT_API_KEY=kunci-acak-unik-untuk-esp32
   ```

   Kunci service role adalah rahasia. Jangan memakai awalan `NEXT_PUBLIC_`,
   menaruh kunci di `main.py`, atau membagikan/commit berkas `.env.local`.

   `IOT_API_KEY` bersifat opsional saat pengembangan. Saat diisi, endpoint
   `POST /api/sensor` hanya menerima perangkat yang mengirim header
   `x-api-key` atau `Authorization: Bearer <IOT_API_KEY>`.

## Menjalankan di laptop

Pasang dependensi dan jalankan server yang dapat menerima koneksi dari ESP32:

```powershell
npm install
npm run dev -- -H 0.0.0.0
```

Buka dashboard di `http://localhost:3000`. Untuk melihat data contoh tanpa
memanggil API sensor, buka `http://localhost:3000/?demo` atau
`http://localhost:3000/peram?demo`.

Dalam mode normal, dashboard mengambil data sensor langsung dari API setiap
5 detik, menampilkan insight perubahan sensor 10 menit terakhir, dan mencatat
20 pembacaan terbaru beserta tanggal dan waktunya. Tombol **Lihat grafik**
memilih grafik sensor terkait dan membawamu ke bagian riwayat. Pastikan tombol
mode demo tidak aktif untuk melihat data ESP32.

Untuk menjalankan build produksi secara lokal:

```powershell
npm run build
npm run start -- -H 0.0.0.0
```

## Model kematangan berbasis dataset

Dashboard memakai K-nearest neighbors (KNN) ringan yang dijalankan di
TypeScript. Model hanya memakai suhu dan kelembapan karena keduanya tersedia
dengan unit yang sama di dataset dan ESP32. Nilai gas dari dataset adalah ppm,
sedangkan ESP32 mengirim ADC mentah; gas, soil, pH, dan MQ-135 karena itu tidak
dipakai untuk model ini.

Dataset tidak mencatat waktu mulai, waktu matang, durasi, soil, atau batch.
Model hanya mengklasifikasikan label kematangan; MAE waktu tidak dapat dihitung.
Estimasi waktu 72 jam yang masih tampil adalah aturan awal lama, bukan hasil
pelatihan. Dataset juga belum dapat menunjukkan akurasi pada batch baru, jadi
hasilnya bukan jaminan keamanan pangan.

Evaluasi internal saat ini memperoleh akurasi klasifikasi 98.5% pada 200 baris
uji yang dipisah acak per label dari dataset 1.000 baris yang sama. Karena
dataset tidak memiliki identitas batch dan data uji bukan batch baru, angka ini
tidak membuktikan tingkat akurasi untuk proses fermentasi pengguna.

### Melatih ulang model

Dataset sumber yang disertakan berada di root sebagai
`dataset_kematangan_tape_1000.csv`. Dari PowerShell, jalankan:

```powershell
cd C:\xampp\htdocs\iot-ukl
node scripts\latih-model.mjs
npx tsc --noEmit
npm run build
```

Script melakukan split stratified 80/20 per label (tidak ada kolom batch untuk
split per batch), mencetak akurasi status dan contoh uji, lalu menulis
parameter, normalisasi, evaluasi, dan sampel latih ke
`lib/model-kematangan.json`. Tidak ada dependensi baru. Jika model hilang atau
formatnya tidak valid, aplikasi kembali ke aturan lama dan menandainya di
dashboard.

### Menyiapkan impor dataset ke Supabase

`supabase.sql` menyiapkan tabel `dataset_kematangan` dengan RLS aktif dan tanpa
policy. Setelah tabel dibuat di SQL Editor dan `.env.local` diisi, impor dapat
dijalankan manual dari PowerShell:

```powershell
cd C:\xampp\htdocs\iot-ukl
node scripts\impor-dataset.mjs
```

Script memakai `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` dari `.env.local`
serta upsert berdasarkan `source_no`. Jangan commit atau membagikan berkas
secret tersebut.

Alur model saat ini:

1. ESP32 mengirim suhu, kelembapan udara, gas alkohol, dan kelembapan tape.
2. API menyimpan pembacaan baru ke tabel `sensor_readings` di Supabase.
3. Dashboard mengambil pembacaan terbaru dari database.
4. API `/api/predict` memakai model KNN pada `lib/model-kematangan.json`, yang
   dilatih dari dataset dengan fitur suhu dan kelembapan.
5. Hasil prediksi kembali ditampilkan pada dashboard sebagai tahap, kecocokan,
   dan saran.

Dataset saat ini berfungsi sebagai baseline pelatihan/model awal. Data sensor
baru yang masuk belum otomatis menjadi contoh berlabel atau melatih ulang
model. Agar model dapat ditingkatkan, batch harus diberi label kematangan
benar-benar matang melalui proses validasi manual, lalu sampel baru perlu
digabungkan ke dataset dan model di-deploy ulang. Jangan membuat label hanya
dari output prediksi model itu sendiri.

## Deploy agar dapat diakses publik

### 1. Deploy database

Jalankan `supabase.sql` pada SQL Editor proyek Supabase setelah membuat proyek.
Skema membuat `sensor_readings` untuk data IoT dan `dataset_kematangan` untuk
menyimpan dataset.

### 2. Deploy aplikasi

Opsi termudah adalah Vercel dari dashboard Vercel:

1. Push repository ke GitHub/GitLab.
2. Import repository pada Vercel.
3. Pilih framework Next.js dan pertahankan build command bawaan.
4. Tambahkan variabel environment pada Vercel:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `IOT_API_KEY`
5. Deploy, lalu catat URL publik seperti `https://peram.vercel.app`.

Route `/api/predict` membaca `lib/model-kematangan.json`; `next.config.ts`
memasukkan berkas model tersebut ke bundle serverless.

### 3. Arahkan ESP32 ke deployment

Ganti `API_URL` pada ESP32 menjadi URL publik:

```python
API_URL = "https://peram.vercel.app/api/sensor"
```

Tambahkan header API key pada request ESP32:

```python
headers = {"Content-Type": "application/json", "x-api-key": IOT_API_KEY}
```

Gunakan `IOT_API_KEY` yang sama dengan nilai environment pada Vercel. Jangan
menaruh service role key Supabase pada firmware ESP32 atau berkas browser.

Di produksi, server Next.js sebaiknya menggunakan HTTPS, dan ESP32 perlu
menyertakan sertifikat/waktu yang benar untuk validasi TLS.

## Menguji API

Sesudah `.env.local` diisi dan server berjalan, uji route POST dari PowerShell.
Opsi `--%` membantu PowerShell meneruskan tanda kutip JSON ke `curl.exe`:

```powershell
curl.exe --% -X POST http://localhost:3000/api/sensor -H "Content-Type: application/json" -H "x-api-key: kunci-acak-unik-untuk-esp32" -d "{\"temperature\":29.5,\"humidity\":78,\"mq_value\":1500,\"moisture\":40}"
```

Jika berhasil, API membalas `200` dengan:

```json
{"success":true}
```

Untuk melihat 90 pembacaan terakhir:

```powershell
curl.exe http://localhost:3000/api/sensor?limit=90
```

API mengembalikan data dari waktu paling lama ke paling baru. Jika konfigurasi
Supabase belum diisi, API membalas `500` dengan pesan yang menjelaskan variabel
yang perlu dilengkapi.

## Menghubungkan ESP32 melalui Wi-Fi

1. Pastikan laptop dan ESP32 berada di jaringan Wi-Fi yang sama.
2. Jalankan `ipconfig` di Command Prompt atau PowerShell. Catat **IPv4 Address**
   pada adaptor Wi-Fi laptop, misalnya `192.168.1.10`. Jangan gunakan `127.0.0.1`
   untuk ESP32.
3. Jika Windows Firewall meminta izin saat server dijalankan, izinkan akses
   pada jaringan **Private**. Jika perlu membuat aturan sendiri, buka
   PowerShell sebagai Administrator dan jalankan:

   ```powershell
   New-NetFirewallRule -DisplayName "Peram Next.js port 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private
   ```

4. Di `config.py` yang digunakan ESP32, isi `API_URL` dengan alamat HTTP laptop:

   ```python
   API_URL = "http://192.168.1.10:3000/api/sensor"
   ```

   Ganti `192.168.1.10` dengan IPv4 laptop. Gunakan `http://`, bukan `https://`.
   `main.py` tidak perlu diubah.
5. Nyalakan ESP32. Respons berhasil yang diharapkan adalah status `200` dan
   JSON `{"success":true}`. Jika laptop memiliki beberapa adaptor jaringan,
   pilih alamat IPv4 pada adaptor yang sama dengan Wi-Fi ESP32.

## Memastikan data masuk ke Supabase

- Buka **Table Editor** di Supabase, pilih `sensor_readings`, lalu periksa
  apakah baris baru muncul.
- Atau jalankan query berikut di **SQL Editor**:

  ```sql
  select created_at, temp, hum, gas, soil
  from public.sensor_readings
  order by created_at desc
  limit 10;
  ```

Field dari ESP32 disimpan sebagai berikut: `temperature` → `temp`,
`humidity` → `hum`, `mq_value` → `gas`, dan `moisture` → `soil`.

## Nilai awal yang perlu disesuaikan

Beberapa nilai adalah perkiraan awal, bukan hasil kalibrasi untuk semua bahan
dan alat:

- Durasi target `72 jam` hanya aturan awal lama; dataset tidak memiliki label
  waktu untuk melatih estimasi tersebut.
- Rentang suhu dashboard `28.04–31.98 °C` adalah min/maks baris berlabel
  `Matang` dalam dataset, bukan rekomendasi keamanan pangan.
- Batas gas matang `2000` dan lewat matang `3200` hanya untuk fallback lama;
  ubah melalui slider bila diperlukan. Dataset gas dalam ppm tidak setara
  dengan ADC ESP32.
- Nomor pin sensor serta `SOIL_DRY` dan `SOIL_WET` berasal dari konfigurasi
  ESP32 (`config.py`/rangkaian). Sesuaikan berdasarkan pin yang benar dan
  pengukuran sensor kering/basah milik Anda; `main.py` tidak diubah.

Saat model tersedia, tahap kematangan dihitung dari dataset suhu/kelembapan.
Jika model tidak tersedia, prediksi kembali ke aturan sederhana waktu dan gas.
