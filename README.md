# Peram

Peram adalah pemantau fermentasi tape berbasis Next.js 15, TypeScript, KNN, dan
Supabase. ESP32 mengirim pembacaan sensor melalui HTTPS/HTTP ke aplikasi
Next.js; Next.js menyimpan data ke Supabase dan menghasilkan prediksi dari
dataset tape. Dashboard dapat dihosting publik dan digunakan oleh banyak
perangkat/browser.

## Persiapan Supabase

1. Buka proyek Supabase dan jalankan isi [`supabase.sql`](./supabase.sql) di
   **SQL Editor**.
2. Salin `.env.local.example` menjadi `.env.local`.
3. Isi `.env.local` dengan URL proyek dan **service role key** dari pengaturan
   API Supabase:

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
memanggil API sensor, buka `http://localhost:3000/?demo`.

Untuk menjalankan build produksi secara lokal:

```powershell
npm run build
npm run start -- -H 0.0.0.0
```

## Prediksi AI kematangan tape

Dashboard memakai klasifikasi K-nearest neighbors (KNN) dari
`dataset_kematangan_tape_1000.csv`. Model mencocokkan suhu, kelembapan, dan gas
alkohol dengan data berlabel untuk menampilkan tahap kematangan dan rekomendasi
tindakan. Berkas dataset disertakan pada route `/api/predict` saat build.

Dataset tidak mencatat durasi hingga matang dan berisi fitur pH serta MQ-135
yang tidak tersedia dari sensor website. Karena itu, estimasi waktu bukan hasil
pelatihan model: aplikasi menggabungkan tahap KNN dengan target awal 72 jam.
Nilai gas sensor ESP32 adalah ADC, sedangkan dataset menyebut ppm; aplikasi
memetakan rentang ADC secara perkiraan, bukan mengklaim konversi terkalibrasi.
Kalibrasikan sensor dan validasi hasil terhadap batch nyata sebelum menjadikan
prediksi sebagai acuan produksi. Rekomendasi AI bukan jaminan keamanan pangan.

Alur model saat ini:

1. ESP32 mengirim suhu, kelembapan udara, gas alkohol, dan kelembapan tape.
2. API menyimpan pembacaan baru ke tabel `sensor_readings` di Supabase.
3. Dashboard mengambil pembacaan terbaru dari database.
4. API `/api/predict` membandingkannya dengan 1.000 sampel berlabel pada
   `dataset_kematangan_tape_1000.csv` menggunakan KNN.
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

Supabase sudah menyimpan data di cloud. Jalankan `supabase.sql` pada SQL Editor
proyek Supabase setelah membuat proyek. Skema membuat `sensor_readings` untuk
data IoT dan `prediction_logs` untuk riwayat prediksi bila ingin menambah
pencatatan tersebut pada integrasi aplikasi.

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

Karena deploy Next.js serverless membutuhkan dataset pada bundle, route
`/api/predict` sudah dikonfigurasi agar `dataset_kematangan_tape_1000.csv`
diikutsertakan pada build melalui `next.config.ts`.

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
curl.exe --% -X POST http://localhost:3000/api/sensor -H "Content-Type: application/json" -d "{\"temperature\":29.5,\"humidity\":78,\"mq_value\":1500,\"moisture\":40}"
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

- Durasi target fermentasi `72 jam` dan kisaran suhu ideal `28–32 °C` ada di
  `lib/config.ts`.
- Batas gas matang `2000` dan lewat matang `3200` adalah nilai awal; ubah melalui
  slider di dashboard. Nilai tersimpan di browser.
- Nomor pin sensor serta `SOIL_DRY` dan `SOIL_WET` berasal dari konfigurasi
  ESP32 (`config.py`/rangkaian). Sesuaikan berdasarkan pin yang benar dan
  pengukuran sensor kering/basah milik Anda; `main.py` tidak diubah.
