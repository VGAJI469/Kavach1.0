import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';

// ── Custom pulsing icon for current location ────────────────────────────────
const pulsingIcon = L.divIcon({
    className: 'driver-pulse-marker',
    html: `
    <div class="pulse-dot"></div>
    <div class="pulse-ring"></div>
  `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
});

const cityIcon = (color) =>
    L.divIcon({
        className: 'city-marker',
        html: `<div style="
      width:12px;height:12px;border-radius:50%;
      background:${color};border:2px solid #fff;
      box-shadow:0 2px 6px rgba(0,0,0,0.3);
    "></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
    });

// ── City risk zones ─────────────────────────────────────────────────────────
const RISK_ZONES = [
    { name: 'Chennai', lat: 13.0827, lng: 80.2707, risk: 'high', color: '#ef4444', radius: 15000 },
    { name: 'Mumbai', lat: 19.076, lng: 72.8777, risk: 'high', color: '#ef4444', radius: 18000 },
    { name: 'Kolkata', lat: 22.5726, lng: 88.3639, risk: 'medium', color: '#f59e0b', radius: 14000 },
    { name: 'Delhi', lat: 28.6139, lng: 77.209, risk: 'medium', color: '#f59e0b', radius: 16000 },
    { name: 'Hyderabad', lat: 17.385, lng: 78.4867, risk: 'medium', color: '#f59e0b', radius: 13000 },
    { name: 'Pune', lat: 18.5204, lng: 73.8567, risk: 'low', color: '#22c55e', radius: 12000 },
    { name: 'Bengaluru', lat: 12.9716, lng: 77.5946, risk: 'low', color: '#22c55e', radius: 14000 },
];

// ── Auto-center map on driver location ──────────────────────────────────────
function FlyToLocation({ position }) {
    const map = useMap();
    useEffect(() => {
        if (position) {
            map.flyTo(position, 14, { duration: 1.5 });
        }
    }, [position, map]);
    return null;
}

// ── Main component ──────────────────────────────────────────────────────────
export default function DriverMap() {
    const [driverPos, setDriverPos] = useState(null);
    const [error, setError] = useState(() =>
        typeof navigator !== 'undefined' && !navigator.geolocation
            ? 'Geolocation not supported by your browser'
            : null
    );
    const [watching, setWatching] = useState(false);
    const watchId = useRef(null);

    // Default center: India
    const defaultCenter = [20.5937, 78.9629];
    const defaultZoom = 5;

    useEffect(() => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            return;
        }

        // Watch position for live updates
        watchId.current = navigator.geolocation.watchPosition(
            (pos) => {
                setDriverPos([pos.coords.latitude, pos.coords.longitude]);
                setWatching(true);
                setError(null);
            },
            (err) => {
                console.warn('[DriverMap] Geolocation error:', err.message);
                setError('Location access denied — showing default view');
                setWatching(false);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 5000,
            },
        );

        return () => {
            if (watchId.current !== null) {
                navigator.geolocation.clearWatch(watchId.current);
            }
        };
    }, []);

    return (
        <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: '20px' }}>
            {/* Header */}
            <div
                style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                <div>
                    <h3
                        style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: '16px',
                            fontWeight: 700,
                            margin: 0,
                        }}
                    >
                        📍 Live Location
                    </h3>
                    <p className="text-muted" style={{ fontSize: '12px', margin: '2px 0 0' }}>
                        {watching ? 'Tracking your location' : error || 'Requesting permission...'}
                    </p>
                </div>

                {watching && (
                    <span
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            borderRadius: '20px',
                            background: '#22c55e15',
                            color: '#22c55e',
                            fontSize: '12px',
                            fontWeight: 600,
                        }}
                    >
                        <span
                            style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: '#22c55e',
                                animation: 'pulse-glow 2s infinite',
                            }}
                        />
                        Live
                    </span>
                )}
            </div>

            {/* Map */}
            <div style={{ height: '320px' }}>
                <MapContainer
                    center={driverPos || defaultCenter}
                    zoom={driverPos ? 14 : defaultZoom}
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={false}
                    attributionControl={false}
                >
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; OpenStreetMap'
                    />

                    {driverPos && <FlyToLocation position={driverPos} />}

                    {/* Driver marker */}
                    {driverPos && (
                        <Marker position={driverPos} icon={pulsingIcon}>
                            <Popup>
                                <strong>You are here</strong>
                                <br />
                                <span style={{ fontSize: '12px', color: '#666' }}>
                                    {driverPos[0].toFixed(4)}, {driverPos[1].toFixed(4)}
                                </span>
                            </Popup>
                        </Marker>
                    )}

                    {/* City risk zone overlays */}
                    {RISK_ZONES.map((zone) => (
                        <Circle
                            key={zone.name}
                            center={[zone.lat, zone.lng]}
                            radius={zone.radius}
                            pathOptions={{
                                fillColor: zone.color,
                                fillOpacity: 0.08,
                                color: zone.color,
                                weight: 1.5,
                                opacity: 0.4,
                            }}
                        />
                    ))}

                    {/* City markers */}
                    {RISK_ZONES.map((zone) => (
                        <Marker
                            key={`marker-${zone.name}`}
                            position={[zone.lat, zone.lng]}
                            icon={cityIcon(zone.color)}
                        >
                            <Popup>
                                <strong>{zone.name}</strong>
                                <br />
                                Risk: <span style={{ color: zone.color, fontWeight: 600 }}>{zone.risk}</span>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>
            </div>

            {/* Legend */}
            <div
                style={{
                    padding: '10px 20px',
                    display: 'flex',
                    gap: '16px',
                    justifyContent: 'center',
                    borderTop: '1px solid var(--border)',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                }}
            >
                {[
                    { label: 'High Risk', color: '#ef4444' },
                    { label: 'Medium', color: '#f59e0b' },
                    { label: 'Low', color: '#22c55e' },
                ].map((l) => (
                    <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: l.color }} />
                        {l.label}
                    </span>
                ))}
            </div>
        </div>
    );
}
