"use client";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

interface MarkerData {
  city: string; state: string;
  coords: [number, number];
  churches_count: number; lgs_count: number; members_count: number;
  church_names: string[];
}

export default function ExpansionMapLeaflet({ markers }: { markers: MarkerData[] }) {
  // Centro do Brasil
  const center: [number, number] = [-14.2, -51.9];

  // Calcula raio do marcador baseado em membros (min 6px, max 30px)
  const maxMembers = Math.max(1, ...markers.map(m => m.members_count));
  const radius = (count: number) => {
    if (count === 0) return 6;
    return 6 + ((count / maxMembers) * 24);
  };

  return (
    <div className="h-[500px] w-full overflow-hidden rounded-md border">
      <MapContainer center={center} zoom={4} scrollWheelZoom={true} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map((m, idx) => (
          <CircleMarker
            key={`${m.city}-${m.state}-${idx}`}
            center={m.coords}
            radius={radius(m.members_count)}
            pathOptions={{
              color: "#C9A227",
              fillColor: "#C9A227",
              fillOpacity: 0.6,
              weight: 2,
            }}>
            <Popup>
              <div style={{ minWidth: 180 }}>
                <b style={{ color: "#0E2A47", fontSize: 14 }}>{m.city}, {m.state}</b>
                <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none", fontSize: 12, lineHeight: 1.6 }}>
                  <li>🏢 <b>{m.churches_count}</b> comunidade{m.churches_count !== 1 ? "s" : ""}</li>
                  <li>❤️ <b>{m.lgs_count}</b> Life Group{m.lgs_count !== 1 ? "s" : ""}</li>
                  <li>👥 <b>{m.members_count}</b> membro{m.members_count !== 1 ? "s" : ""} ativo{m.members_count !== 1 ? "s" : ""}</li>
                </ul>
                {m.church_names.length > 0 && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #eee", fontSize: 11, color: "#666" }}>
                    {m.church_names.slice(0, 3).join(", ")}{m.church_names.length > 3 ? ` +${m.church_names.length - 3}` : ""}
                  </div>
                )}
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
