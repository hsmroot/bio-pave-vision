import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Activity, CloudSun, Gauge, MapPin, RefreshCw, Thermometer, Truck, Wind, Sun, AlertTriangle } from "lucide-react";
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceDot, BarChart, Bar, Legend,
} from "recharts";
import { BINDERS, type BinderId, loadingFrequency, pavementTemps, gStar, jnr, recovery, rri, fatigueIndex, healingIndex, masterCurve } from "@/lib/rheology";
import { SEGMENTS, simulateTraffic, fetchWeather, type TrafficMode, type Weather } from "@/lib/corridors";

const CorridorMap = lazy(() => import("@/components/CorridorMap"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NZ BioPave | Traffic & Biobinder Rheology Digital Twin" },
      { name: "description", content: "Real-time traffic and microclimate digital twin comparing biobinder vs bitumen rutting risk on NZ state highways." },
      { property: "og:title", content: "NZ BioPave | Biobinder Rheology Digital Twin" },
      { property: "og:description", content: "Live rutting risk, master curves and MSCR Jnr for biobinders across NZ highway corridors." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Space+Grotesk:wght@400;500;700&display=swap" },
    ],
  }),
  component: Index,
});

const RISK = {
  normal: { label: "Normal / Resilient", cls: "text-success border-success/40 bg-success/10" },
  moderate: { label: "Moderate Distress", cls: "text-warning border-warning/40 bg-warning/10" },
  critical: { label: "Critical Rutting Alert", cls: "text-destructive border-destructive/50 bg-destructive/15 animate-pulse" },
} as const;

function NzClock() {
  const [now, setNow] = useState<string>("");
  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString("en-NZ", { timeZone: "Pacific/Auckland", hour12: false }) + " NZT");
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="font-mono text-sm text-primary">{now || "--:--:--"}</span>;
}

function Index() {
  const [segId, setSegId] = useState(SEGMENTS[0]!.id);
  const [binderId, setBinderId] = useState<BinderId>("lignin");
  const [mode, setMode] = useState<TrafficMode>("live");
  const [override, setOverride] = useState<{ speed?: number; hcv?: number }>({});
  const [tick, setTick] = useState(0);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [loading, setLoading] = useState(false);

  const seg = SEGMENTS.find((s) => s.id === segId)!;
  const binder = BINDERS[binderId];
  const ref = BINDERS.virgin;

  const refresh = useCallback(async () => {
    setLoading(true);
    setWeather(await fetchWeather(seg.lat, seg.lon));
    setLoading(false);
  }, [seg.lat, seg.lon]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 2000);
    return () => clearInterval(id);
  }, []);

  const sim = simulateTraffic(seg, mode, tick);
  const speed = override.speed ?? sim.speed;
  const hcv = override.hcv ?? sim.hcv;
  const w = weather ?? { tAir: 22, rh: 60, solar: 650, wind: 12, source: "fallback" as const };

  const calc = useMemo(() => {
    const { tPulse, freq } = loadingFrequency(speed);
    const { surface, depth20 } = pavementTemps(w.tAir, w.solar, w.wind);
    const bio = gStar(freq, depth20, binder);
    const std = gStar(freq, depth20, ref);
    const risk = rri(hcv / 100, seg.esa, bio.G, bio.delta);
    const riskRef = rri(hcv / 100, seg.esa, std.G, std.delta);
    return {
      tPulse, freq, surface, depth20, bio, std, risk, riskRef,
      jnrBio: jnr(freq, depth20, binder), jnrRef: jnr(freq, depth20, ref),
      recBio: recovery(depth20, binder), recRef: recovery(depth20, ref),
      fatigue: fatigueIndex(bio.G, bio.delta), healing: healingIndex(freq, depth20, binder),
      curve: masterCurve(depth20, binder, ref),
    };
  }, [speed, hcv, w.tAir, w.solar, w.wind, binder, ref, seg.esa]);

  const rutPct = Math.min(100, (calc.risk.value / 4) * 100);
  const strainSkew = Math.min(25, 4 + calc.jnrBio * 3);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-[1000] border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-4 px-4 py-3">
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            <h1 className="text-lg font-bold leading-tight">
              NZ BioPave <span className="font-normal text-muted-foreground">| Real-Time Highway Traffic & Biobinder Rheology Twin</span>
            </h1>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <NzClock />
            <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" /> {seg.lat.toFixed(3)}, {seg.lon.toFixed(3)}
            </span>
            <select value={binderId} onChange={(e) => setBinderId(e.target.value as BinderId)}
              className="rounded-md border border-input bg-secondary px-2 py-1.5 text-sm">
              {Object.values(BINDERS).map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
            <button onClick={refresh} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh Live Data
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1600px] gap-4 p-4 lg:grid-cols-[320px_1fr_420px]">
        {/* LEFT */}
        <section className="space-y-4">
          <div className="panel">
            <div className="panel-title"><MapPin className="h-3.5 w-3.5" /> Corridor Segment</div>
            <div className="grid grid-cols-2 gap-2">
              {SEGMENTS.map((s) => (
                <button key={s.id} onClick={() => setSegId(s.id)}
                  className={`rounded-md border px-2 py-2 text-left text-xs ${s.id === segId ? "border-primary bg-primary/15 text-primary" : "border-border hover:bg-secondary"}`}>
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-muted-foreground">{s.highway}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-title"><Truck className="h-3.5 w-3.5" /> Traffic Feed</div>
            <div className="mb-3 grid grid-cols-3 gap-1 rounded-md bg-secondary p-1 text-xs">
              {([["live", "Live mock"], ["peak", "Peak freight"], ["free", "Free-flow"]] as const).map(([m, l]) => (
                <button key={m} onClick={() => { setMode(m); setOverride({}); }}
                  className={`rounded px-1 py-1.5 ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{l}</button>
              ))}
            </div>
            <label className="text-xs text-muted-foreground">Current speed {override.speed !== undefined && <span className="text-accent">(override)</span>}</label>
            <div className="readout">{speed} <span className="text-sm text-muted-foreground">km/h</span></div>
            <input type="range" min={0} max={110} value={speed} onChange={(e) => setOverride((o) => ({ ...o, speed: +e.target.value }))} className="w-full accent-primary" />
            <label className="mt-3 block text-xs text-muted-foreground">HCV split</label>
            <div className="readout">{hcv}<span className="text-sm text-muted-foreground">%</span></div>
            <input type="range" min={5} max={40} value={hcv} onChange={(e) => setOverride((o) => ({ ...o, hcv: +e.target.value }))} className="w-full accent-accent" />
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3">
              <div><div className="text-xs text-muted-foreground">Pulse</div><div className="font-mono">{isFinite(calc.tPulse) ? (calc.tPulse * 1000).toFixed(1) : "∞"} ms</div></div>
              <div><div className="text-xs text-muted-foreground">Frequency</div><div className="font-mono">{calc.freq.toFixed(2)} Hz</div></div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-title"><CloudSun className="h-3.5 w-3.5" /> Microclimate
              <span className={`ml-auto rounded px-1.5 py-0.5 text-[10px] ${w.source === "live" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>{w.source === "live" ? "Open-Meteo" : "Offline fallback"}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div><Thermometer className="h-4 w-4 text-primary" /><div className="font-mono">{w.tAir.toFixed(1)}°C</div><div className="text-[10px] text-muted-foreground">Air</div></div>
              <div><Sun className="h-4 w-4 text-accent" /><div className="font-mono">{w.solar.toFixed(0)}</div><div className="text-[10px] text-muted-foreground">W/m²</div></div>
              <div><Wind className="h-4 w-4 text-muted-foreground" /><div className="font-mono">{w.wind.toFixed(1)}</div><div className="text-[10px] text-muted-foreground">km/h</div></div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3">
              <div><div className="text-xs text-muted-foreground">Surface</div><div className="readout text-xl">{calc.surface.toFixed(1)}°C</div></div>
              <div><div className="text-xs text-muted-foreground">20 mm depth</div><div className="readout text-xl text-accent">{calc.depth20.toFixed(1)}°C</div></div>
            </div>
          </div>
        </section>

        {/* CENTER */}
        <section className="space-y-4">
          <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${RISK[calc.risk.level].cls}`}>
            <AlertTriangle className="h-5 w-5" />
            <div className="font-semibold">{RISK[calc.risk.level].label}</div>
            <div className="ml-auto font-mono text-sm">RRI {calc.risk.value.toFixed(2)} <span className="opacity-70">· ref {calc.riskRef.value.toFixed(2)}</span></div>
          </div>
          <div className="panel h-[420px] p-1">
            <ClientOnly fallback={<div className="h-full animate-pulse rounded-lg bg-secondary" />}>
              <Suspense fallback={<div className="h-full animate-pulse rounded-lg bg-secondary" />}>
                <CorridorMap segment={seg} level={calc.risk.level} onSelect={setSegId} />
              </Suspense>
            </ClientOnly>
          </div>
          <div className="panel">
            <div className="panel-title"><Gauge className="h-3.5 w-3.5" /> Pavement Cross-Section · Shear Strain</div>
            <svg viewBox="0 0 600 220" className="w-full">
              <rect x="0" y="0" width="600" height="220" className="fill-background" />
              <g style={{ ["--skew" as string]: `${strainSkew}deg`, ["--dur" as string]: `${Math.max(0.25, 1 / Math.max(calc.freq, 0.3))}s` } as React.CSSProperties} className="animate-strain">
                <rect x="250" y="20" width="100" height="50" rx="14" className="fill-muted-foreground/60" />
              </g>
              <text x="300" y="15" textAnchor="middle" className="fill-muted-foreground font-mono text-[10px]">TYRE · {speed} km/h</text>
              <rect x="0" y="72" width="600" height="40" className="fill-foreground/20" />
              <text x="10" y="96" className="fill-foreground font-mono text-[11px]">Chip seal / AC (20 mm) · {binder.short} · {calc.depth20.toFixed(1)}°C</text>
              <g style={{ ["--skew" as string]: `${strainSkew}deg`, ["--dur" as string]: `${Math.max(0.25, 1 / Math.max(calc.freq, 0.3))}s` } as React.CSSProperties} className="animate-strain">
                <line x1="300" y1="75" x2="300" y2="110" strokeWidth="4" className={calc.risk.level === "critical" ? "stroke-destructive" : calc.risk.level === "moderate" ? "stroke-warning" : "stroke-success"} />
                <line x1="270" y1="110" x2="330" y2="110" strokeWidth="2" className="stroke-primary" />
              </g>
              <rect x="0" y="112" width="600" height="70" className="fill-muted" />
              <text x="10" y="150" className="fill-muted-foreground font-mono text-[11px]">Basecourse (unbound granular)</text>
              <rect x="0" y="182" width="600" height="38" className="fill-secondary" />
              <text x="10" y="205" className="fill-muted-foreground font-mono text-[11px]">Subgrade</text>
              <text x="590" y="96" textAnchor="end" className="fill-accent font-mono text-[11px]">Jnr {calc.jnrBio.toFixed(2)} kPa⁻¹</text>
            </svg>
          </div>
        </section>

        {/* RIGHT */}
        <section className="space-y-4">
          <div className="panel">
            <div className="panel-title">|G*| Master Curve @ {calc.depth20.toFixed(1)}°C</div>
            <div className="h-56">
              <ResponsiveContainer>
                <LineChart data={calc.curve} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" />
                  <XAxis dataKey="f" type="number" scale="log" domain={[0.01, 100]} ticks={[0.01, 0.1, 1, 10, 100]} stroke="var(--muted-foreground)" fontSize={10} />
                  <YAxis scale="log" domain={["auto", "auto"]} stroke="var(--muted-foreground)" fontSize={10} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}M` : v.toFixed(1)} allowDataOverflow />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} formatter={(v) => `${Number(v).toFixed(2)} kPa`} labelFormatter={(f) => `${Number(f).toFixed(2)} Hz`} />
                  <Line dataKey="baseline" name="Pen 80/100" stroke="var(--chart-5)" dot={false} strokeDasharray="4 3" />
                  <Line dataKey="bio" name={binder.short} stroke="var(--chart-1)" dot={false} strokeWidth={2} />
                  <ReferenceDot x={Math.min(100, calc.freq)} y={calc.bio.G} r={6} fill="var(--accent)" stroke="none" className="animate-blink" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-xs">
              <div>|G*| {calc.bio.G.toFixed(2)} kPa · δ {calc.bio.delta.toFixed(1)}°</div>
              <div className="text-muted-foreground">ref {calc.std.G.toFixed(2)} kPa · δ {calc.std.delta.toFixed(1)}°</div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">MSCR 3.2 kPa · Jnr & Recovery</div>
            <div className="h-48">
              <ResponsiveContainer>
                <BarChart data={[
                  { name: "Jnr (kPa⁻¹)", baseline: +calc.jnrRef.toFixed(2), bio: +calc.jnrBio.toFixed(2) },
                  { name: "R / 10 (%)", baseline: +(calc.recRef / 10).toFixed(2), bio: +(calc.recBio / 10).toFixed(2) },
                ]}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={10} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={10} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="baseline" name="Pen 80/100" fill="var(--chart-5)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="bio" name={binder.short} fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="panel space-y-3">
            <div className="panel-title">Damage Accumulation</div>
            {[
              { label: "Rutting Vulnerability Index", v: rutPct, c: "bg-destructive" },
              { label: "Fatigue / Micro-Cracking Index", v: calc.fatigue, c: "bg-warning" },
              { label: "Self-Healing Potential", v: calc.healing, c: "bg-success" },
            ].map((g) => (
              <div key={g.label}>
                <div className="mb-1 flex justify-between text-xs"><span>{g.label}</span><span className="font-mono">{g.v.toFixed(0)}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div className={`h-full ${g.c} transition-all duration-700`} style={{ width: `${g.v}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
