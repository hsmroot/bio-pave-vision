export interface Segment {
  id: string;
  name: string;
  highway: string;
  lat: number;
  lon: number;
  esa: number; // ESA factor per heavy vehicle
  baseSpeed: number;
  baseHcv: number;
  path: [number, number][];
}

export const SEGMENTS: Segment[] = [
  { id: "akl", name: "Auckland Central", highway: "SH1 Northern Motorway", lat: -36.85, lon: 174.76, esa: 9, baseSpeed: 70, baseHcv: 12,
    path: [[-36.78, 174.74], [-36.81, 174.75], [-36.84, 174.755], [-36.87, 174.77], [-36.9, 174.79]] },
  { id: "bombay", name: "Bombay Hills", highway: "SH1 Bombay Hills", lat: -37.18, lon: 175.0, esa: 12, baseSpeed: 90, baseHcv: 22,
    path: [[-37.12, 174.95], [-37.15, 174.98], [-37.18, 175.0], [-37.22, 175.02], [-37.26, 175.05]] },
  { id: "kaimai", name: "Kaimai Range", highway: "SH29 Kaimai", lat: -37.75, lon: 175.95, esa: 14, baseSpeed: 75, baseHcv: 28,
    path: [[-37.78, 175.82], [-37.77, 175.87], [-37.75, 175.92], [-37.73, 175.97], [-37.71, 176.03]] },
  { id: "wlg", name: "Wellington Urban Motorway", highway: "SH1 Wellington", lat: -41.28, lon: 174.77, esa: 8, baseSpeed: 65, baseHcv: 9,
    path: [[-41.24, 174.81], [-41.26, 174.79], [-41.28, 174.775], [-41.295, 174.77]] },
  { id: "tga", name: "Tauranga Port Corridor", highway: "SH2 Tauranga", lat: -37.66, lon: 176.17, esa: 15, baseSpeed: 55, baseHcv: 35,
    path: [[-37.62, 176.1], [-37.64, 176.14], [-37.66, 176.17], [-37.67, 176.2]] },
  { id: "chc", name: "Christchurch Brougham St", highway: "SH76 Brougham St", lat: -43.55, lon: 172.64, esa: 11, baseSpeed: 50, baseHcv: 18,
    path: [[-43.548, 172.6], [-43.55, 172.62], [-43.551, 172.64], [-43.552, 172.66], [-43.553, 172.68]] },
];

export type TrafficMode = "live" | "peak" | "free";

export function simulateTraffic(seg: Segment, mode: TrafficMode, t: number) {
  if (mode === "peak") return { speed: Math.round(18 + 8 * Math.sin(t / 7)), hcv: 35 };
  if (mode === "free") return { speed: Math.min(110, seg.baseSpeed + 25), hcv: Math.max(5, seg.baseHcv - 6) };
  const wobble = Math.sin(t / 5) * 10 + Math.sin(t / 2.3) * 4;
  return { speed: Math.max(5, Math.round(seg.baseSpeed + wobble)), hcv: seg.baseHcv };
}

export interface Weather {
  tAir: number;
  rh: number;
  solar: number;
  wind: number;
  source: "live" | "fallback";
}

export async function fetchWeather(lat: number, lon: number): Promise<Weather> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,direct_radiation,diffuse_radiation,shortwave_radiation,wind_speed_10m&timezone=Pacific/Auckland`;
    const r = await fetch(url);
    if (!r.ok) throw new Error("bad");
    const j = await r.json();
    const c = j.current;
    return { tAir: c.temperature_2m, rh: c.relative_humidity_2m, solar: c.shortwave_radiation, wind: c.wind_speed_10m, source: "live" };
  } catch {
    return { tAir: 22, rh: 60, solar: 650, wind: 12, source: "fallback" };
  }
}
