import { Search, Navigation, MapPin, X, Loader2, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function SearchBox({ onSearch, onPickMap, mapPickData }) {
  const [startQuery, setStartQuery] = useState('');
  const [destQuery, setDestQuery] = useState('');
  const [startResults, setStartResults] = useState([]);
  const [destResults, setDestResults] = useState([]);
  const [startStop, setStartStop] = useState(null);
  const [destStop, setDestStop] = useState(null);
  const [timeStr, setTimeStr] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });

  const [filterGroups, setFilterGroups] = useState([1, 2, 3]);
  const [filterTransit, setFilterTransit] = useState('all');
  const [filterWalkDist, setFilterWalkDist] = useState(-1);

  const [activeInput, setActiveInput] = useState(null);
  const [isLoadingStart, setIsLoadingStart] = useState(false);
  const [isLoadingDest, setIsLoadingDest] = useState(false);
  
  const [isExpanded, setIsExpanded] = useState(true);

  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setActiveInput(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (mapPickData) {
      if (mapPickData.type === 'start') {
        setStartStop(mapPickData.loc);
        setStartQuery(mapPickData.loc.stop_name);
        setStartResults([]);
      } else if (mapPickData.type === 'dest') {
        setDestStop(mapPickData.loc);
        setDestQuery(mapPickData.loc.stop_name);
        setDestResults([]);
      }
    }
  }, [mapPickData]);

  useEffect(() => {
    if (startQuery.length < 2 || startStop?.stop_name === startQuery) {
      setStartResults([]);
      setIsLoadingStart(false);
      return;
    }
    setIsLoadingStart(true);
    const timer = setTimeout(() => {
      Promise.all([
        fetch(`${API_URL}/api/stops/search?q=${encodeURIComponent(startQuery)}`).then(res => res.json()).catch(() => []),
        fetch(`${API_URL}/api/geocode?q=${encodeURIComponent(startQuery)}`).then(res => res.json()).catch(() => [])
      ]).then(([stopsData, placesData]) => {
        const stops = (Array.isArray(stopsData) ? stopsData : []).map(s => ({ ...s, type: 'stop' }));
        const places = (Array.isArray(placesData) ? placesData : []).map(p => ({
          id: `place_${p.place_id}`,
          stop_name: p.name || p.display_name.split(',')[0],
          full_name: p.display_name,
          stop_lat: parseFloat(p.lat),
          stop_lon: parseFloat(p.lon),
          type: 'place'
        }));
        setStartResults([...stops, ...places]);
        setIsLoadingStart(false);
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [startQuery, startStop]);

  useEffect(() => {
    if (destQuery.length < 2 || destStop?.stop_name === destQuery) {
      setDestResults([]);
      setIsLoadingDest(false);
      return;
    }
    setIsLoadingDest(true);
    const timer = setTimeout(() => {
      Promise.all([
        fetch(`${API_URL}/api/stops/search?q=${encodeURIComponent(destQuery)}`).then(res => res.json()).catch(() => []),
        fetch(`${API_URL}/api/geocode?q=${encodeURIComponent(destQuery)}`).then(res => res.json()).catch(() => [])
      ]).then(([stopsData, placesData]) => {
        const stops = (Array.isArray(stopsData) ? stopsData : []).map(s => ({ ...s, type: 'stop' }));
        const places = (Array.isArray(placesData) ? placesData : []).map(p => ({
          id: `place_${p.place_id}`,
          stop_name: p.name || p.display_name.split(',')[0],
          full_name: p.display_name,
          stop_lat: parseFloat(p.lat),
          stop_lon: parseFloat(p.lon),
          type: 'place'
        }));
        setDestResults([...stops, ...places]);
        setIsLoadingDest(false);
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [destQuery, destStop]);

  const handleSelect = (type, stop) => {
    if (type === 'start') {
      setStartStop(stop);
      setStartQuery(stop.stop_name);
      setStartResults([]);
    } else {
      setDestStop(stop);
      setDestQuery(stop.stop_name);
      setDestResults([]);
    }
    setActiveInput(null);
  };

  const handleSwap = () => {
    const tempQuery = startQuery;
    const tempStop = startStop;

    setStartQuery(destQuery);
    setStartStop(destStop);
    setStartResults([]);

    setDestQuery(tempQuery);
    setDestStop(tempStop);
    setDestResults([]);
  };

  return (
    <div ref={containerRef} className="absolute top-4 left-4 md:left-8 z-[1000] w-[calc(100%-2rem)] md:w-[420px] bg-white/90 backdrop-blur-2xl p-5 rounded-3xl shadow-2xl border border-white/60 shadow-slate-300/60 transition-all">
      
      
      <div className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100 mb-5' : 'grid-rows-[0fr] opacity-0 mb-0'}`}>
        <div className="overflow-hidden flex items-center gap-3">
          <div>
            <img src="/icons/logo-light.png" alt="Transjakarta App" className="h-10 w-auto object-contain cursor-pointer" />
            <p className="text-xs font-semibold text-slate-500">Navigasi Rute Untuk TransJakarta</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col relative">
        
        <div className={`transition-[height,margin,opacity] duration-300 ease-in-out relative ${isExpanded ? 'h-[52px] mb-4 opacity-100' : 'h-0 mb-0 opacity-0 overflow-hidden pointer-events-none'}`}>
          <div className={`absolute w-full h-[52px] group ${activeInput === 'start' ? 'z-50' : 'z-10'}`}>
            <div className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-blue-500 ring-4 ring-white shadow-sm z-10"></div>
            <input
              type="text"
              placeholder="Halte keberangkatan..."
              className="w-full pl-12 pr-12 py-3.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all text-sm font-semibold text-slate-700 placeholder:text-slate-400 placeholder:font-medium"
              value={startQuery}
              onChange={(e) => {
                setStartQuery(e.target.value);
                if (startStop && e.target.value !== startStop.stop_name) setStartStop(null);
              }}
              onFocus={() => setActiveInput('start')}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {isLoadingStart && <Loader2 size={16} className="text-slate-400 animate-spin" />}
              {startQuery && (
                <button onClick={() => { setStartQuery(''); setStartStop(null); }} className="text-slate-400 hover:text-slate-600 bg-slate-200/50 hover:bg-slate-200 p-1 rounded-full transition-colors" title="Hapus">
                  <X size={14} />
                </button>
              )}
              {onPickMap && (
                <button onClick={() => onPickMap('start')} className="text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 p-1.5 rounded-full transition-colors ml-1" title="Pilih di Peta">
                  <Navigation size={16} />
                </button>
              )}
            </div>

            {activeInput === 'start' && startResults.length > 0 && (
              <div className="absolute w-full mt-2 bg-white/95 backdrop-blur-xl border border-slate-100 rounded-2xl shadow-2xl overflow-hidden z-[100] max-h-60 overflow-y-auto custom-scrollbar">
                {startResults.map(stop => (
                  <button
                    key={stop.id}
                    className="w-full text-left px-5 py-3 text-sm text-slate-700 hover:bg-blue-50/80 transition-colors flex items-center gap-3 border-b border-slate-50 last:border-0"
                    onClick={() => handleSelect('start', stop)}
                  >
                    {stop.type === 'place' ? (
                      <MapPin size={18} className="text-emerald-500 flex-shrink-0" />
                    ) : (
                      <div className="w-5 h-5 rounded flex items-center justify-center bg-blue-100 text-blue-600 flex-shrink-0">H</div>
                    )}
                    <div className="truncate">
                      <div className="font-bold truncate">{stop.stop_name}</div>
                      <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider truncate">
                        {stop.type === 'place' ? stop.full_name : stop.id}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        
        <div className={`absolute left-[19px] top-[26px] bottom-[26px] w-0.5 bg-slate-200 z-0 rounded-full transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}></div>
        <button
          onClick={handleSwap}
          className={`absolute right-4 top-[60px] -translate-y-1/2 z-20 bg-white border border-slate-200 p-1.5 rounded-full shadow-sm text-slate-400 hover:text-blue-500 hover:border-blue-200 hover:bg-blue-50 transition-all active:scale-95 cursor-pointer ${isExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          title="Tukar arah"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 10v12" />
            <path d="M11 18l-4 4-4-4" />
            <path d="M17 14V2" />
            <path d="M21 6l-4-4-4 4" />
          </svg>
        </button>

        
        <div className={`relative h-[52px] group ${activeInput === 'dest' ? 'z-50' : 'z-10'}`}>
          <div className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-4 border-red-500 bg-white ring-4 ring-white shadow-sm z-10"></div>
          <input
            type="text"
            placeholder="Halte tujuan..."
            className="w-full pl-12 pr-10 py-3.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 transition-all text-sm font-semibold text-slate-700 placeholder:text-slate-400 placeholder:font-medium"
            value={destQuery}
            onChange={(e) => {
              setDestQuery(e.target.value);
              if (destStop && e.target.value !== destStop.stop_name) setDestStop(null);
            }}
            onFocus={() => {
              setActiveInput('dest');
              if (!isExpanded) setIsExpanded(true);
            }}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {isLoadingDest && <Loader2 size={16} className="text-slate-400 animate-spin" />}
            {destQuery && (
              <button onClick={() => { setDestQuery(''); setDestStop(null); }} className="text-slate-400 hover:text-slate-600 bg-slate-200/50 hover:bg-slate-200 p-1 rounded-full transition-colors" title="Hapus">
                <X size={14} />
              </button>
            )}
            {onPickMap && (
              <button onClick={() => onPickMap('dest')} className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-1.5 rounded-full transition-colors ml-1" title="Pilih di Peta">
                <Navigation size={16} />
              </button>
            )}
          </div>

          {activeInput === 'dest' && destResults.length > 0 && (
            <div className="absolute w-full mt-2 bg-white/95 backdrop-blur-xl border border-slate-100 rounded-2xl shadow-2xl overflow-hidden z-50 max-h-60 overflow-y-auto custom-scrollbar">
              {destResults.map(stop => (
                <button
                  key={stop.id}
                  className="w-full text-left px-5 py-3 text-sm text-slate-700 hover:bg-red-50/80 transition-colors flex items-center gap-3 border-b border-slate-50 last:border-0"
                  onClick={() => handleSelect('dest', stop)}
                >
                  {stop.type === 'place' ? (
                    <MapPin size={18} className="text-emerald-500 flex-shrink-0" />
                  ) : (
                    <div className="w-5 h-5 rounded flex items-center justify-center bg-red-100 text-red-600 flex-shrink-0">H</div>
                  )}
                  <div className="truncate">
                    <div className="font-bold truncate">{stop.stop_name}</div>
                    <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider truncate">
                      {stop.type === 'place' ? stop.full_name : stop.id}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      
      <div className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100 mt-2' : 'grid-rows-[0fr] opacity-0 mt-0'}`}>
        <div className="overflow-hidden flex flex-col">
          <div className="flex gap-3 pt-2">
            <div className="relative flex-1">
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <Clock size={18} className="text-slate-400" />
              </div>
              <input
                type="time"
                value={timeStr}
                onChange={(e) => setTimeStr(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all font-bold text-slate-700 text-[15px] shadow-sm hover:border-slate-300"
                placeholder="Berangkat kapan?"
              />
            </div>

            <button
              onClick={() => {
                if (startStop && destStop) {
                  onSearch(startStop, destStop, timeStr, filterGroups, filterTransit, filterWalkDist);
                  setActiveInput(null);
                }
              }}
              disabled={!startStop || !destStop}
              className="flex-1 flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-3.5 rounded-2xl font-bold shadow-[0_8px_20px_-8px_rgba(15,23,42,0.5)] disabled:shadow-none transition-all active:scale-[0.98] cursor-pointer"
            >
              <Search size={18} />
              <span>Cari Rute</span>
            </button>
          </div>

          <div className="border-t border-slate-100 pt-4 mt-5">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Filter Tipe Kendaraan</div>
            <div className="flex flex-col gap-2 mb-5">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${filterGroups.includes(1) ? 'bg-slate-900 border-slate-900' : 'border-slate-300 group-hover:border-slate-500'}`}>
                  {filterGroups.includes(1) && <span className="text-white text-xs">✓</span>}
                </div>
                <input type="checkbox" className="hidden" checked={filterGroups.includes(1)} onChange={(e) => setFilterGroups(prev => e.target.checked ? [...prev, 1] : prev.filter(g => g !== 1))} />
                <span className="text-sm font-semibold text-slate-700">BRT & Angkutan Integrasi</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${filterGroups.includes(2) ? 'bg-slate-900 border-slate-900' : 'border-slate-300 group-hover:border-slate-500'}`}>
                  {filterGroups.includes(2) && <span className="text-white text-xs">✓</span>}
                </div>
                <input type="checkbox" className="hidden" checked={filterGroups.includes(2)} onChange={(e) => setFilterGroups(prev => e.target.checked ? [...prev, 2] : prev.filter(g => g !== 2))} />
                <span className="text-sm font-semibold text-slate-700">Royaltrans</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${filterGroups.includes(3) ? 'bg-slate-900 border-slate-900' : 'border-slate-300 group-hover:border-slate-500'}`}>
                  {filterGroups.includes(3) && <span className="text-white text-xs">✓</span>}
                </div>
                <input type="checkbox" className="hidden" checked={filterGroups.includes(3)} onChange={(e) => setFilterGroups(prev => e.target.checked ? [...prev, 3] : prev.filter(g => g !== 3))} />
                <span className="text-sm font-semibold text-slate-700">Mikrotrans (Jaklingko)</span>
              </label>
            </div>

            <div className="flex gap-4 mb-2">
              <div className="flex-1">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Tipe Transit</div>
                <div className="relative">
                  <select
                    value={filterTransit}
                    onChange={(e) => setFilterTransit(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-700 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all cursor-pointer appearance-none pr-8"
                  >
                    <option value="all">Semua Tipe</option>
                    <option value="direct">Tanpa Transit (Direct)</option>
                    <option value="transit">Dengan Transit</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <ChevronDown size={16} />
                  </div>
                </div>
              </div>

              <div className="flex-1">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Batas Jalan Kaki</div>
                <div className="relative">
                  <select
                    value={filterWalkDist}
                    onChange={(e) => setFilterWalkDist(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-700 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all cursor-pointer appearance-none pr-8"
                  >
                    <option value={-1}>Cari Terdekat (Default)</option>
                    <option value={100}>&lt; 100 meter</option>
                    <option value={200}>&lt; 200 meter</option>
                    <option value={500}>&lt; 500 meter</option>
                    <option value={1000}>&lt; 1 km</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <ChevronDown size={16} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-center mt-3 pt-3 border-t border-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
        title={isExpanded ? "Tutup panel" : "Buka panel"}
      >
        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

    </div>
  );
}
