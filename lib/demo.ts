import { CONFIG } from "@/lib/config";
import type { SensorSample } from "@/lib/types";

function fakeReading(hours: number, jitter = true) {
  const noise = () => (jitter ? Math.random() : 0.5);

  return {
    temp: Number((29.5 + Math.sin(hours / 5) * 1.6 + noise() * 0.4).toFixed(1)),
    hum: Math.round(76 + Math.sin(hours / 7) * 6 + noise() * 2),
    gas: Math.round(450 + 2_300 * (1 - Math.exp(-hours / 34)) + noise() * 50),
    soil: Math.round(Math.min(78, 28 + hours * 0.7 + noise() * 1.5)),
  };
}

export function createDemoReading(timestamp: number, start: number): SensorSample {
  const elapsedHours = (timestamp - start) / 3_600_000;
  return { ...fakeReading(elapsedHours), ts: timestamp };
}

export function createDemoHistory(
  now: number,
  start: number,
): SensorSample[] {
  return Array.from({ length: CONFIG.maxPoints }, (_, index) => {
    const timestamp =
      now - (CONFIG.maxPoints - index - 1) * CONFIG.demoStepMinutes * 60_000;
    return createDemoReading(timestamp, start);
  });
}
