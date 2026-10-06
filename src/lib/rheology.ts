// Client-side physics & rheology engine for NZ BioPave.

export type BinderId = "virgin" | "lignin" | "biooil" | "wco";

export interface BinderParams {
  id: BinderId;
  label: string;
  short: string;
  G0: number; // glassy modulus, kPa
  fc: number; // crossover frequency, Hz
  a: number; // master-curve shape exponent
  C1: number; // WLF constant
  C2: number; // WLF constant
  J0: number; // MSCR compliance coefficient, 1/kPa
  R0: number; // reference % recovery at 25°C
  heal: number; // relative self-healing capacity
}

export const BINDERS: Record<BinderId, BinderParams> = {
  virgin: { id: "virgin", label: "Virgin Bitumen (Pen 80/100 - NZ Reference)", short: "Pen 80/100", G0: 1e6, fc: 10, a: 0.9, C1: 19, C2: 92, J0: 0.13, R0: 38, heal: 1.0 },
  lignin: { id: "lignin", label: "Kraft Lignin-Modified Bitumen (15% replacement)", short: "Lignin 15%", G0: 1.15e6, fc: 9, a: 0.88, C1: 19.5, C2: 94, J0: 0.11, R0: 42, heal: 0.85 },
  biooil: { id: "biooil", label: "Wood Pyrolysis Bio-Oil Fluxed Binder (5%)", short: "Bio-Oil 5%", G0: 0.85e6, fc: 13, a: 0.92, C1: 18.2, C2: 90, J0: 0.17, R0: 30, heal: 1.25 },
  wco: { id: "wco", label: "Waste Cooking Oil (WCO) Rejuvenated Binder (8%)", short: "WCO 8%", G0: 0.75e6, fc: 15, a: 0.94, C1: 17.8, C2: 88, J0: 0.21, R0: 24, heal: 1.4 },
};

export const TIRE_CONTACT_M = 0.22;
export const T_REF = 25;

export function loadingFrequency(speedKmh: number) {
  const v = Math.max(speedKmh, 0) / 3.6;
  if (v <= 0) return { tPulse: Infinity, freq: 0.01 };
  const tPulse = TIRE_CONTACT_M / v;
  return { tPulse, freq: Math.max(1 / (2 * tPulse), 0.01) };
}

export function pavementTemps(tAir: number, rSolar: number, windKmh: number) {
  const surface = tAir + 0.028 * rSolar - 0.15 * windKmh;
  return { surface, depth20: surface * 0.92 };
}

export function shiftFactor(T: number, b: BinderParams) {
  const dT = T - T_REF;
  return Math.pow(10, (-b.C1 * dT) / (b.C2 + dT));
}

export function gStar(freq: number, T: number, b: BinderParams) {
  const fr = freq * shiftFactor(T, b);
  const G = b.G0 / (1 + Math.pow(fr / b.fc, -b.a));
  const delta = 35 + 55 / (1 + Math.pow(fr / b.fc, 0.25));
  return { G, delta };
}

export function jnr(freq: number, T: number, b: BinderParams) {
  return (b.J0 * Math.exp(0.08 * (T - 25))) / Math.pow(Math.max(freq, 0.01), 0.35);
}

export function recovery(T: number, b: BinderParams) {
  return Math.max(0, Math.min(100, b.R0 * Math.exp(-0.03 * (T - 25))));
}

export type RiskLevel = "normal" | "moderate" | "critical";

export function rri(hvRatio: number, esa: number, G: number, deltaDeg: number) {
  const val = (hvRatio * esa) / (G / Math.sin((deltaDeg * Math.PI) / 180));
  const level: RiskLevel = val < 1 ? "normal" : val <= 2.5 ? "moderate" : "critical";
  return { value: val, level };
}

export function fatigueIndex(G: number, deltaDeg: number) {
  const gs = G * Math.sin((deltaDeg * Math.PI) / 180);
  return Math.max(0, Math.min(100, (Math.log10(Math.max(gs, 1)) / Math.log10(5000)) * 100));
}

export function healingIndex(freq: number, T: number, b: BinderParams) {
  const tTerm = 1 / (1 + Math.exp(-(T - 30) / 8));
  const fTerm = 1 / (1 + freq / 2);
  return Math.max(0, Math.min(100, 100 * b.heal * (0.6 * tTerm + 0.4 * fTerm) / 1.4));
}

export function masterCurve(T: number, b: BinderParams, ref: BinderParams) {
  const pts = [];
  for (let e = -2; e <= 2.01; e += 0.1) {
    const f = Math.pow(10, e);
    pts.push({ f, bio: gStar(f, T, b).G, ref: gStar(f, T, ref).G });
  }
  return pts;
}
