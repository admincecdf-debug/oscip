"use client";
import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";

interface MarkerData {
  city: string; state: string;
  coords: [number, number];
  churches_count: number; lgs_count: number; members_count: number;
  church_names: string[]; church_ids: string[];
}
interface Props {
  markers: MarkerData[];
  onMarkerClick: (marker: MarkerData) => void;
}

export default function ExpansionMapLeafletInteractive({ markers, onMarkerClick }: Props) {
  const center: [number, number] = [-14.2, -51.9];
  const maxMembers = Math.max(1, ...markers.map(m => m.members_count));
  function radius(count: number) {
    if (count === 0) return 7;
    return 7 + ((count / maxMembers) * 26);
  }

  return (
    <div className="h-[520px] w-full overflow-hidden rounded-md border">
      <MapContainer center={center} zoom={4} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map((m, idx) => (
          <CircleMarker
            key={`${m.city}-${m.state}-${idx}`}
            center={m.coords}
            radius={radius(m.members_count)}
            pathOptions={{ color: "#C9A227", fillColor: "#C9A227", fillOpacity: 0.65, weight: 2 }}
            eventHandlers={{
              click: () => onMarkerClick(m),
              mouseover: (e) => { e.target.setStyle({ fillOpacity: 0.9, weight: 3 }); },
              mouseout:  (e) => { e.target.setStyle({ fillOpacity: 0.65, weight: 2 }); },
            }}
          >
            <Tooltip direction="top" offset={[0, -4]} opacity={0.95}>
              <div style={{ minWidth: 160 }}>
                <b style={{ color: "#0E2A47", fontSize: 13 }}>{m.city}, {m.state}</b>
                <div style={{ marginTop: 6, fontSize: 11, lineHeight: 1.7, color: "#555" }}>
                  <div>🏢 {m.churches_count} comunidade{m.churches_count !== 1 ? "s" : ""}</div>
                  <div>🔥 {m.lgs_count} Life Group{m.lgs_count !== 1 ? "s" : ""}</div>
                  <div>👥 {m.members_count} membro{m.members_count !== 1 ? "s" : ""}</div>
                </div>
                <div style={{ marginTop: 6, fontSize: 10, color: "#C9A227", fontWeight: 600 }}>
                  Clique para ver o painel completo →
                </div>
              </div>
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
