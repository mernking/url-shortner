import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

function MapComponent({ logs }) {
  const geoLogs = logs.filter((log) => log.country && log.city);

  // Group logs by location for better visualization
  const locationGroups = geoLogs.reduce((acc, log) => {
    const key = `${log.country}-${log.city}`;
    if (!acc[key]) {
      acc[key] = {
        country: log.country,
        city: log.city,
        count: 0,
        lat: log.latitude || 0,
        lng: log.longitude || 0,
        logs: [],
      };
    }
    acc[key].count += 1;
    acc[key].logs.push(log);
    // Use stored coordinates first, fallback to approximate
    if (acc[key].lat === 0 && acc[key].lng === 0) {
      const coords = getApproximateCoords(log.country, log.city);
      acc[key].lat = coords.lat;
      acc[key].lng = coords.lng;
    }
    return acc;
  }, {});

  const locations = Object.values(locationGroups);

  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {locations.map((location, index) => (
        <Marker key={index} position={[location.lat, location.lng]}>
          <Popup>
            <div>
              <h4>
                {location.city}, {location.country}
              </h4>
              <p>Requests: {location.count}</p>
              <p>Latest: {new Date(location.logs[0].time).toLocaleString()}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

// Helper function to get approximate coordinates
function getApproximateCoords(country, city) {
  // This is a very basic implementation
  // In production, use a proper geocoding service
  const coords = {
    "Nigeria-Lagos": { lat: 6.5244, lng: 3.3792 },
    "Nigeria-Abuja": { lat: 9.0765, lng: 7.3986 },
    "United States-New York": { lat: 40.7128, lng: -74.006 },
    "United Kingdom-London": { lat: 51.5074, lng: -0.1278 },
    "Germany-Berlin": { lat: 52.52, lng: 13.405 },
    "France-Paris": { lat: 48.8566, lng: 2.3522 },
    "Japan-Tokyo": { lat: 35.6762, lng: 139.6503 },
    "Australia-Sydney": { lat: -33.8688, lng: 151.2093 },
    "Canada-Toronto": { lat: 43.6532, lng: -79.3832 },
    "Brazil-São Paulo": { lat: -23.5505, lng: -46.6333 },
  };

  const key = `${country}-${city}`;
  return (
    coords[key] || {
      lat: Math.random() * 180 - 90,
      lng: Math.random() * 360 - 180,
    }
  );
}

export default MapComponent;
