import { useEffect } from "react";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import type { Itinerary } from "../types";

type Point = { lat: number; lng: number; label: string };

function collectPoints(itinerary?: Itinerary | null): Point[] {
  if (!itinerary) return [];
  const points: Point[] = [];
  const seen = new Set<string>();

  for (const segment of itinerary.segments) {
    const candidates = [
      { lat: segment.start_lat, lng: segment.start_lng, label: segment.location_start || segment.name },
      { lat: segment.end_lat, lng: segment.end_lng, label: segment.location_end || segment.name },
    ];
    for (const item of candidates) {
      if (item.lat == null || item.lng == null) continue;
      const key = `${item.lat.toFixed(3)},${item.lng.toFixed(3)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      points.push({ lat: item.lat, lng: item.lng, label: item.label || "Stop" });
    }
  }
  return points;
}

function MapSync({ points }: { points: Point[] }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    if (points.length > 1) {
      map.fitBounds(
        points.map((point) => [point.lat, point.lng] as [number, number]),
        { padding: [28, 28] },
      );
    } else if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 8);
    }
  }, [map, points]);
  return null;
}

export default function TripMap({ itinerary, height = 420 }: { itinerary?: Itinerary | null; height?: number }) {
  const points = collectPoints(itinerary);
  const center: [number, number] = points.length ? [points[0].lat, points[0].lng] : [20.5937, 78.9629];
  const line = points.map((p) => [p.lat, p.lng] as [number, number]);

  return (
    <div className="overflow-hidden rounded-lg border border-border" style={{ height }}>
      <MapContainer center={center} zoom={points.length > 1 ? 5 : 4} className="h-full w-full" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapSync points={points} />
        {line.length > 1 && <Polyline positions={line} pathOptions={{ color: "#3b82f6", weight: 3 }} />}
        {points.map((point) => (
          <CircleMarker
            key={`${point.lat}-${point.lng}-${point.label}`}
            center={[point.lat, point.lng]}
            radius={9}
            pathOptions={{ color: "#60a5fa", fillColor: "#3b82f6", fillOpacity: 0.9 }}
          >
            <Popup>{point.label}</Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
