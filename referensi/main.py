# IoT Monitor UMKM - MicroPython (ESP32)
# Pengiriman data ke website Food Spoilage via Next.js API

from machine import Pin, ADC, I2C
import dht
import network
import time
import json
import gc

import config
from i2c_lcd import I2cLcd

try:
    import urequests as requests
except ImportError:
    import requests


# ====== SENSOR ======
sensor_dht = dht.DHT11(Pin(4))

adc_gas = ADC(Pin(32))
adc_gas.atten(ADC.ATTN_11DB)

adc_soil = ADC(Pin(35))
adc_soil.atten(ADC.ATTN_11DB)

SOIL_OK = True


# ====== LAMPU INDIKATOR ======
led_red = Pin(27, Pin.OUT)
led_yellow = Pin(14, Pin.OUT)
led_green = Pin(13, Pin.OUT)


def set_lamp(status):
    led_red.value(1 if status == "BAHAYA" else 0)
    led_yellow.value(1 if status == "WASPADA" else 0)
    led_green.value(1 if status == "AMAN" else 0)


# ====== LCD I2C ======
i2c = I2C(
    0,
    scl=Pin(22),
    sda=Pin(21),
    freq=100000
)

lcd = I2cLcd(i2c, config.LCD_I2C_ADDR, 2, 16)


def lcd_show(line1, line2=""):
    lcd.clear()
    lcd.move_to(0, 0)
    lcd.putstr(str(line1)[:16])
    lcd.move_to(0, 1)
    lcd.putstr(str(line2)[:16])


# ====== PEMBACAAN SENSOR ======
def read_adc(adc):
    return adc.read_u16() >> 4


def soil_percent():
    global SOIL_OK

    if not SOIL_OK:
        return 0

    try:
        raw = read_adc(adc_soil)

        pct = (
            (raw - config.SOIL_DRY) * 100
            // (config.SOIL_WET - config.SOIL_DRY)
        )

        return max(0, min(100, pct))

    except Exception as e:
        print("Soil bermasalah:", e)
        SOIL_OK = False
        return 0


# ====== PENENTUAN STATUS ======
def hitung_status(temp, gas):
    if gas >= config.GAS_LIMIT or temp >= config.TEMP_LIMIT:
        return "BAHAYA"

    if gas >= config.GAS_WARN or temp >= config.TEMP_WARN:
        return "WASPADA"

    return "AMAN"


# ====== KONEKSI WIFI ======
def connect_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)

    if not wlan.isconnected():
        lcd_show("Connect WiFi...")

        wlan.connect(config.WIFI_SSID, config.WIFI_PASS)

        start = time.time()

        while (
            not wlan.isconnected()
            and time.time() - start < 20
        ):
            time.sleep(0.5)

    if wlan.isconnected():
        ip = wlan.ifconfig()[0]

        print("WiFi OK, IP ESP32:", ip)
        lcd_show("WiFi OK", ip)

    else:
        print("WiFi GAGAL")
        lcd_show("WiFi GAGAL", "Cek WiFi")

    time.sleep(2)
    return wlan


# ====== KIRIM DATA KE WEBSITE ======
def send_data(wlan, temp, hum, gas, soil, status):
    if not wlan.isconnected():
        print("WiFi putus, mencoba koneksi ulang...")

        try:
            wlan.connect(config.WIFI_SSID, config.WIFI_PASS)
        except Exception as e:
            print("Gagal koneksi ulang:", e)

        return

    # Nama field harus sesuai app/api/sensor/route.ts
    payload = {
        "temperature": temp,
        "humidity": hum,
        "mq_value": gas,
        "moisture": soil
    }

    response = None

    try:
        gc.collect()

        body = json.dumps(payload)

        response = requests.post(
            config.API_URL,
            data=body,
            headers={
                "Content-Type": "application/json"
            }
        )

        print(
            "Website:",
            response.status_code,
            response.text
        )

        if response.status_code == 200:
            try:
                result = response.json()

                if result.get("success"):
                    print("Data berhasil disimpan ke website.")
                else:
                    print("API menerima request, tetapi melaporkan kegagalan.")

            except Exception:
                print("Respons diterima, tetapi bukan JSON yang valid.")

        else:
            print("Pengiriman gagal. Periksa API dan database.")

    except Exception as e:
        print("Gagal mengirim ke website:", e)

    finally:
        if response is not None:
            try:
                response.close()
            except Exception:
                pass

        gc.collect()


# ====== PROGRAM UTAMA ======
lcd_show("FOOD SPOILAGE", "Memulai...")
time.sleep(2)

wlan = connect_wifi()

temp, hum = 0, 0
counter = 0

send_every = max(
    1,
    config.SEND_EVERY_SEC // config.READ_EVERY_SEC
)

while True:
    try:
        sensor_dht.measure()
        temp = sensor_dht.temperature()
        hum = sensor_dht.humidity()

    except OSError as e:
        print("DHT11 gagal dibaca:", e)

    gas = read_adc(adc_gas)
    soil = soil_percent()

    status = hitung_status(temp, gas)

    set_lamp(status)

    lcd_show(
        "T:{}C H:{}%".format(temp, hum),
        "G:{} S:{}% {}".format(gas, soil, status)
    )

    print(
        "Suhu:", temp,
        "Lembap:", hum,
        "Gas:", gas,
        "Tanah:", soil,
        "%", status
    )

    counter += 1

    if counter >= send_every:
        counter = 0
        send_data(wlan, temp, hum, gas, soil, status)

    time.sleep(config.READ_EVERY_SEC)