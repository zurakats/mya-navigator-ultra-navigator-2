import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, CircleMarker, useMap, useMapEvents } from 'react-leaflet';
import { Layers, MapPin, Loader2 } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const startStopIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const destStopIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      if (onMapClick) onMapClick(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

function MapFitter({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [bounds, map]);
  return null;
}

function MapFocuser({ focusedStop, markerRefs }) {
  const map = useMap();
  useEffect(() => {
    if (focusedStop) {
      map.flyTo([focusedStop.stop_lat, focusedStop.stop_lon], 16, { duration: 1.5 });
      setTimeout(() => {
        const marker = markerRefs.current[focusedStop.id];
        if (marker) {
          marker.openPopup();
        }
      }, 400);
    }
  }, [focusedStop, map, markerRefs]);
  return null;
}

const getStopIcon = (color, isBrt) => {
  const imgSrc = isBrt ? '/icons/Frame-3.png' : '/icons/Frame-6.png';
  const iconHtml = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; font-family: sans-serif; font-size: 9px; font-weight: 600; white-space: nowrap; overflow: visible; transform: translate(-50%, -100%);">
      <img src="${imgSrc}" alt="Bus Icon" style="width: 26px !important; height: auto !important; object-fit: contain; margin: 0; padding: 0; display: block; filter: drop-shadow(0px 2px 2px rgba(0,0,0,0.4));" />
    </div>
  `;

  return L.divIcon({
    className: 'custom-stop-icon',
    html: iconHtml,
    iconSize: null,
    iconAnchor: [0, 0]
  });
};

export default function TransjakartaMap({
  activeItineraryDetails = null,
  startStop = null,
  destStop = null,
  center = [-6.200000, 106.816666],
  zoom = 12,
  focusedStop = null,
  onMapClick
}) {
  const markerRefs = useRef({});
  
  let bounds = null;
  const allShapes = [];
  const allStops = [];

  if (activeItineraryDetails) {
    activeItineraryDetails.forEach(leg => {
      if (leg.type === 'transit' && leg.shapeDetails) {
        if (leg.shapeDetails.shapePoints) allShapes.push(...leg.shapeDetails.shapePoints);
        if (leg.shapeDetails.stops) allStops.push(...leg.shapeDetails.stops);
      }
    });
  }

  if (allShapes.length > 0) {
    bounds = L.latLngBounds(allShapes.map(pt => [pt.shape_pt_lat, pt.shape_pt_lon]));
  } else if (allStops.length > 0) {
    bounds = L.latLngBounds(allStops.map(s => [s.stop_lat, s.stop_lon]));
  }

  const [walkingPolylines, setWalkingPolylines] = useState([]);
  const [showAllLines, setShowAllLines] = useState(false);
  const [showAllStops, setShowAllStops] = useState(false);
  const [globalPolylines, setGlobalPolylines] = useState([]);
  const [globalStops, setGlobalStops] = useState([]);
  const [loadingLines, setLoadingLines] = useState(false);
  const [loadingStops, setLoadingStops] = useState(false);

  useEffect(() => {
    let active = true;
    if (showAllLines && globalPolylines.length === 0) {
      setLoadingLines(true);
      fetch(`${API_URL}/api/shapes/all`)
        .then(res => res.json())
        .then(data => {
           if (active && data.polylines) setGlobalPolylines(data.polylines);
        })
        .finally(() => { if (active) setLoadingLines(false); });
    }
    return () => { active = false; };
  }, [showAllLines, globalPolylines.length]);

  useEffect(() => {
    let active = true;
    if (showAllStops && globalStops.length === 0) {
      setLoadingStops(true);
      fetch(`${API_URL}/api/stops?limit=10000`)
        .then(res => res.json())
        .then(data => {
           if (active && Array.isArray(data)) setGlobalStops(data);
        })
        .finally(() => { if (active) setLoadingStops(false); });
    }
    return () => { active = false; };
  }, [showAllStops, globalStops.length]);

  useEffect(() => {
    let active = true;

    const fetchGeometries = async () => {
      const paths = [];
      
      const addPath = async (p1, p2) => {
        try {
          const url = `https://router.project-osrm.org/route/v1/foot/${p1.stop_lon},${p1.stop_lat};${p2.stop_lon},${p2.stop_lat}?geometries=geojson`;
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
              const coords = data.routes[0].geometry.coordinates;
              return coords.map((c) => [c[1], c[0]]);
            }
          }
        } catch (err) {
          console.error("OSRM geometry fetch failed:", err);
        }
        return [[p1.stop_lat, p1.stop_lon], [p2.stop_lat, p2.stop_lon]];
      };

      if (!activeItineraryDetails || activeItineraryDetails.length === 0) return;

      const firstTransit = activeItineraryDetails.find(l => l.type === 'transit');
      if (startStop && firstTransit && firstTransit.startStop) {
        paths.push(await addPath(startStop, firstTransit.startStop));
      }

      for (const leg of activeItineraryDetails) {
        if (leg.type === 'walk' && leg.startStop && leg.endStop) {
          paths.push(await addPath(leg.startStop, leg.endStop));
        }
      }

      const lastTransit = activeItineraryDetails.slice().reverse().find(l => l.type === 'transit');
      if (destStop && lastTransit && lastTransit.endStop) {
        paths.push(await addPath(lastTransit.endStop, destStop));
      }

      if (active) {
        setWalkingPolylines(paths);
      }
    };

    fetchGeometries();
    return () => { active = false; };
  }, [activeItineraryDetails, startStop, destStop]);

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        preferCanvas={true}
      >
      <MapClickHandler onMapClick={onMapClick} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />

      {activeItineraryDetails && activeItineraryDetails.map((leg, legIdx) => {
        if (leg.type === 'transit' && leg.shapeDetails?.stops) {
          const legColor = leg.route.route_color ? `#${leg.route.route_color}` : '#00529b';
          return leg.shapeDetails.stops.map((stop, stopIdx) => {
            const isBrt = stop.location_type === 1;
            return (
              <Marker
                key={`route-stop-${legIdx}-${stop.id}-${stopIdx}`}
                position={[stop.stop_lat, stop.stop_lon]}
                icon={getStopIcon(legColor, isBrt)}
                ref={(r) => { if (r) markerRefs.current[stop.id] = r; }}
              >
                <Popup>
                  <div className="flex flex-col w-60 sm:w-72">
                    <div className="h-32 w-full bg-slate-200 relative">
                      <img 
                        src={isBrt ? '/images/guide/halte-bus-transjakarta.jpg' : '/images/guide/bus-stop-transjakarta.jpg'} 
                        alt={isBrt ? 'Halte BRT' : 'Bus Stop'} 
                        className="w-full h-full object-cover" 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
                    </div>
                    <div className="p-4 bg-white">
                      <div className="font-bold text-slate-800 text-lg mb-3 leading-tight">{stop.stop_name}</div>
                      <div className="flex items-center gap-2">
                        <div className="text-[13px] font-bold text-white px-3 py-1 rounded-md shadow-sm inline-block" style={{ backgroundColor: isBrt ? legColor : '#64748b' }}>
                          {isBrt ? 'Halte BRT' : 'Bus Stop'}
                        </div>
                        <div className="text-xs text-slate-500 font-semibold bg-slate-100 px-2.5 py-1 rounded-md">ID: {stop.id}</div>
                      </div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          });
        }
        return null;
      })}

      {startStop && (
        <Marker position={[startStop.stop_lat, startStop.stop_lon]} icon={startStopIcon} zIndexOffset={1000}>
          <Popup>
            <div className="font-semibold text-green-700">Awal: {startStop.stop_name}</div>
          </Popup>
        </Marker>
      )}

      {destStop && (
        <Marker position={[destStop.stop_lat, destStop.stop_lon]} icon={destStopIcon} zIndexOffset={1000}>
          <Popup>
            <div className="font-semibold text-red-700">Tujuan: {destStop.stop_name}</div>
          </Popup>
        </Marker>
      )}

      {walkingPolylines.map((positions, idx) => (
        <Polyline 
          key={`walk-${idx}`} 
          positions={positions} 
          color="#334155" 
          weight={4} 
          dashArray="6, 8" 
          opacity={0.8} 
        />
      ))}
      
      {activeItineraryDetails && activeItineraryDetails.map((leg, legIdx) => {
        if (leg.type === 'transit' && leg.shapeDetails?.shapePoints) {
          const legColor = leg.route.route_color ? `#${leg.route.route_color}` : '#00529b';
          const positions = leg.shapeDetails.shapePoints.map((pt) => [pt.shape_pt_lat, pt.shape_pt_lon]);
          return (
            <Polyline
              key={`transit-poly-${legIdx}`}
              positions={positions}
              color={legColor}
              weight={6}
              opacity={0.8}
            />
          );
        }
        return null;
      })}

      {bounds && <MapFitter bounds={bounds} />}
      {focusedStop && <MapFocuser focusedStop={focusedStop} markerRefs={markerRefs} />}

      {showAllLines && globalPolylines.map((line, idx) => (
        <Polyline
          key={`global-poly-${idx}-${line.id}`}
          positions={line.points}
          color={line.color}
          weight={2}
          opacity={0.6}
        />
      ))}

      {showAllStops && globalStops.map((stop) => {
        const isBrt = stop.location_type === 1;
        return (
          <CircleMarker
            key={`global-stop-${stop.id}`}
            center={[stop.stop_lat, stop.stop_lon]}
            radius={4}
            ref={(r) => { if (r) markerRefs.current[stop.id] = r; }}
            pathOptions={{
              fillColor: isBrt ? '#0ea5e9' : '#64748b',
              fillOpacity: 0.8,
              color: '#ffffff',
              weight: 1,
            }}
          >
            <Popup>
              <div className="flex flex-col w-60 sm:w-72">
                <div className="h-32 w-full bg-slate-200 relative">
                  <img 
                    src={isBrt ? '/images/guide/halte-bus-transjakarta.jpg' : '/images/guide/bus-stop-transjakarta.jpg'} 
                    alt={isBrt ? 'Halte BRT' : 'Bus Stop'} 
                    className="w-full h-full object-cover" 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
                </div>
                <div className="p-4 bg-white">
                  <div className="font-bold text-slate-800 text-lg mb-3 leading-tight">{stop.stop_name}</div>
                  <div className="flex items-center gap-2">
                    <div className="text-[13px] font-bold text-white px-3 py-1 rounded-md shadow-sm inline-block" style={{ backgroundColor: isBrt ? '#0ea5e9' : '#64748b' }}>
                      {isBrt ? 'Halte BRT' : 'Bus Stop'}
                    </div>
                    <div className="text-xs text-slate-500 font-semibold bg-slate-100 px-2.5 py-1 rounded-md">ID: {stop.id}</div>
                  </div>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
    <div className="absolute bottom-24 md:bottom-6 left-6 z-[1000] flex flex-col gap-2">
      <button 
        onClick={() => setShowAllLines(!showAllLines)}
        className={`p-3 rounded-full shadow-lg border transition-all flex items-center justify-center ${showAllLines ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
        title="Toggle All Lines"
      >
        {loadingLines ? <Loader2 size={20} className="animate-spin" /> : <Layers size={20} />}
      </button>
      <button 
        onClick={() => setShowAllStops(!showAllStops)}
        className={`p-3 rounded-full shadow-lg border transition-all flex items-center justify-center ${showAllStops ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
        title="Toggle All Stops"
      >
        {loadingStops ? <Loader2 size={20} className="animate-spin" /> : <MapPin size={20} />}
      </button>
    </div>
  </div>
  );
}
