import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Segment } from "@/lib/corridors";
import { SEGMENTS } from "@/lib/corridors";

const RISK_VAR: Record<string, string> = { normal: "--success", moderate: "--warning", critical: "--destructive" };

export default function CorridorMap({ segment, level, onSelect }: { segment: Segment; level: string; onSelect: (id: string) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !el.current || mapRef.current) return;
      const map = L.map(el.current, { zoomControl: true }).setView([segment.lat, segment.lon], 12);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: "&copy; OpenStreetMap &copy; CARTO",
      }).addTo(map);
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
      draw(L);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function draw(L: any) {
    const map = mapRef.current;
    if (!map) return;
    const css = getComputedStyle(document.documentElement);
    const color = css.getPropertyValue(RISK_VAR[level] ?? "--success").trim() || "teal";
    const muted = css.getPropertyValue("--muted-foreground").trim();
    layerRef.current.clearLayers();
    SEGMENTS.forEach((s) => {
      const active = s.id === segment.id;
      L.polyline(s.path, { color: active ? color : muted, weight: active ? 8 : 4, opacity: active ? 0.95 : 0.5 })
        .on("click", () => onSelect(s.id))
        .bindTooltip(`${s.name} · ${s.highway}`)
        .addTo(layerRef.current);
    });
    map.flyTo([segment.lat, segment.lon], 12, { duration: 0.8 });
  }

  useEffect(() => {
    import("leaflet").then((L) => draw(L));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment.id, level]);

  return <div ref={el} className="h-full w-full rounded-lg" />;
}
