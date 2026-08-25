import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import SearchBox from '../components/SearchBox';
import { Clock, Banknote, BusFront, X, ChevronDown, ChevronUp, PersonStanding, Footprints, Star, Info, BookmarkPlus } from 'lucide-react';
import GuideModal from '../components/guide/GuideModal';

const Map = React.lazy(() => import('../components/Map'));

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function HomeContent() {
  const [searchParams] = useSearchParams();
  const initialRouteId = searchParams.get('routeId');
  const navigate = useNavigate();

  const [activeItineraryDetails, setActiveItineraryDetails] = useState(null);
  const [startStop, setStartStop] = useState(null);
  const [destStop, setDestStop] = useState(null);
  const [pickingMode, setPickingMode] = useState(null);
  const [mapPickData, setMapPickData] = useState(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isNavigating, setIsNavigating] = useState(false);
  const [focusedStop, setFocusedStop] = useState(null);

  const [itineraries, setItineraries] = useState([]);
  const [selectedItineraryIndex, setSelectedItineraryIndex] = useState(null);
  const [requestedTime, setRequestedTime] = useState('');

  const [expandedLegs, setExpandedLegs] = useState({});
  const [dirIndex, setDirIndex] = useState(0);

  const [showBookmarkModal, setShowBookmarkModal] = useState(false);
  const [bookmarkDesc, setBookmarkDesc] = useState('');
  const [selectedBookmarkItin, setSelectedBookmarkItin] = useState(null);
  const [savingBookmark, setSavingBookmark] = useState(false);

  const [showGuide, setShowGuide] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const handleOpenBookmark = (itin, e) => {
    e.stopPropagation();
    setSelectedBookmarkItin(itin);
    setShowBookmarkModal(true);
  };

  const saveBookmark = async () => {
    if (!selectedBookmarkItin || !startStop || !destStop) return;
    setSavingBookmark(true);
    try {
      const transitLeg = selectedBookmarkItin.legs.find((l) => l.type === 'transit');
      const vehicle = transitLeg ? transitLeg.route.route_short_name : 'all';
      
      const res = await fetch(`${API_URL}/api/bookmarks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          description: bookmarkDesc || 'Rute Pilihan',
          startLat: startStop.stop_lat,
          startLon: startStop.stop_lon,
          startName: startStop.stop_name,
          destLat: destStop.stop_lat,
          destLon: destStop.stop_lon,
          destName: destStop.stop_name,
          time: requestedTime || null,
          vehicle
        })
      });

      const data = await res.json();
      if (res.ok) {
        setToastMsg('Rute berhasil disimpan ke Bookmarks!');
        setTimeout(() => setToastMsg(''), 3000);
        setShowBookmarkModal(false);
        setBookmarkDesc('');
      } else {
        if (res.status === 401) {
          setErrorMsg('Silakan login terlebih dahulu untuk menyimpan bookmark.');
          setShowBookmarkModal(false);
        } else {
          setErrorMsg(data.error || 'Gagal menyimpan rute.');
        }
      }
    } catch (err) {
      setErrorMsg('Terjadi kesalahan saat menyimpan rute.');
    } finally {
      setSavingBookmark(false);
    }
  };

  const fetchRouteDetails = async (routeId, start, end, direction = 0) => {
    let url = `${API_URL}/api/route/${encodeURIComponent(routeId)}/shape?dirIndex=${direction}`;
    if (start && end) {
      url += `&startLat=${start.stop_lat}&startLon=${start.stop_lon}&endLat=${end.stop_lat}&endLon=${end.stop_lon}`;
    }
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    if (!data.shapePoints || !Array.isArray(data.shapePoints)) throw new Error('Data rute tidak lengkap (shape).');
    return data;
  };

  useEffect(() => {
    const bStartLat = searchParams.get('startLat');
    const bStartLon = searchParams.get('startLon');
    const bStartName = searchParams.get('startName');
    const bDestLat = searchParams.get('destLat');
    const bDestLon = searchParams.get('destLon');
    const bDestName = searchParams.get('destName');
    const bTime = searchParams.get('time');

    if (bStartLat && bStartLon && bStartName && bDestLat && bDestLon && bDestName) {
      const start = { id: `bookmark_start`, stop_name: bStartName, stop_lat: parseFloat(bStartLat), stop_lon: parseFloat(bStartLon), type: 'place' };
      const dest = { id: `bookmark_dest`, stop_name: bDestName, stop_lat: parseFloat(bDestLat), stop_lon: parseFloat(bDestLon), type: 'place' };
      
      setStartStop(start);
      setDestStop(dest);
      setMapPickData({ type: 'start', loc: start });
      
      setTimeout(() => {
        setMapPickData({ type: 'dest', loc: dest });
        handleSearch(start, dest, bTime || '');
      }, 100);
    }
  }, [searchParams]);

  useEffect(() => {
    if (initialRouteId) {
      setLoading(true);
      setErrorMsg('');
      setIsNavigating(false);
      setStartStop(null);
      setDestStop(null);
      setActiveItineraryDetails(null);
      setExpandedLegs({ 0: true });

      fetchRouteDetails(initialRouteId, undefined, undefined, dirIndex)
        .then(data => {
          setActiveItineraryDetails([{
            type: 'transit',
            route: { 
              route_short_name: data.routeInfo?.route_short_name || 'Rute', 
              route_color: data.routeInfo?.route_color || '00529b', 
              route_desc: data.routeInfo?.route_desc || 'Rute Pilihan',
              route_long_name: data.routeInfo?.route_long_name || 'Rute Pilihan'
            },
            shapeDetails: data,
            startStop: null,
            endStop: null
          }]);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setErrorMsg('Gagal memuat rute tersebut.');
          setLoading(false);
        });
    }
  }, [initialRouteId, dirIndex]);

  async function handleSearch(start, dest, timeStr, groups, transitType, maxWalkDist) {
    setLoading(true);
    setErrorMsg('');
    setStartStop(start);
    setDestStop(dest);
    setRequestedTime(timeStr || '');
    setExpandedLegs({ 0: true, 1: true, 2: true });
    setIsNavigating(true);

    setActiveItineraryDetails(null);
    setItineraries([]);
    setSelectedItineraryIndex(null);

    navigate('/', { replace: true });

    try {
      const timeParam = timeStr ? `&time=${encodeURIComponent(timeStr)}` : '';
      const groupsParam = groups ? `&groups=${groups.join(',')}` : '';
      const transitParam = transitType ? `&transitType=${transitType}` : '';
      const walkParam = maxWalkDist ? `&maxWalkDist=${maxWalkDist}` : '';

      const res = await fetch(`${API_URL}/api/navigate?startLat=${start.stop_lat}&startLon=${start.stop_lon}&destLat=${dest.stop_lat}&destLon=${dest.stop_lon}${timeParam}${groupsParam}${transitParam}${walkParam}`);
      const data = await res.json();

      if (data.itineraries && data.itineraries.length > 0) {
        setItineraries(data.itineraries);
      } else {
        setErrorMsg('Tidak ditemukan rute (langsung maupun transit) untuk titik halte tersebut.');
      }
    } catch (error) {
      console.error(error);
      setErrorMsg('Gagal mencari rute.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectItinerary = async (index, itins = itineraries) => {
    const itinerary = itins[index];
    if (!itinerary) return;

    setLoading(true);
    setSelectedItineraryIndex(index);

    try {
      const detailsPromises = itinerary.legs.map(async (leg, i) => {
        if (leg.type === 'transit') {
          const shapeDetails = await fetchRouteDetails(leg.route.id, leg.startStop, leg.endStop, 0);
          return { ...leg, shapeDetails, index: i };
        }
        return { ...leg, index: i };
      });
      const resolvedLegs = await Promise.all(detailsPromises);
      setActiveItineraryDetails(resolvedLegs);
    } catch (error) {
      console.error(error);
      setErrorMsg('Gagal memuat detail rute.');
    } finally {
      setLoading(false);
    }
  };

  const clearRoute = () => {
    setActiveItineraryDetails(null);
    setSelectedItineraryIndex(null);
  };

  const formatRouteDesc = (desc) => {
    if (!desc) return '';
    if (desc === 'BRT') return 'BRT - Busway';
    if (desc === 'Angkutan Umum Integrasi') return 'Non-BRT - Integrasi';
    return desc;
  };

  const calculateDuration = (startTime, endTime) => {
    const parse = (t) => {
      const [h, m, s] = t.split(':').map(Number);
      return h * 60 + m + (s ? s / 60 : 0);
    };
    let duration = parse(endTime) - parse(startTime);
    if (duration < 0) duration += 24 * 60;
    return Math.round(duration);
  };

  const handleMapClick = async (lat, lon) => {
    if (!pickingMode) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/geocode?lat=${lat}&lon=${lon}`);
      const data = await res.json();
      
      const newLoc = {
        id: `map_${lat}_${lon}`,
        stop_name: data.name || data.display_name?.split(',')[0] || 'Titik Pilihan',
        full_name: data.display_name,
        stop_lat: lat,
        stop_lon: lon,
        type: 'place'
      };

      if (pickingMode === 'start') {
        setStartStop(newLoc);
        setMapPickData({ type: 'start', loc: newLoc });
      } else {
        setDestStop(newLoc);
        setMapPickData({ type: 'dest', loc: newLoc });
      }
      setPickingMode(null);
    } catch (err) {
      console.error(err);
      setErrorMsg('Gagal mendapatkan informasi lokasi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => setErrorMsg(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg]);

  return (
    <div className="relative w-full h-full flex flex-col md:flex-row overflow-hidden">
      <div className={`transition-all duration-300 ease-in-out z-[1001] w-full md:w-auto ${(activeItineraryDetails || (isNavigating && !loading) || pickingMode) ? 'hidden md:block' : 'block'}`}>
        <SearchBox onSearch={handleSearch} onPickMap={(type) => setPickingMode(type)} mapPickData={mapPickData} />
      </div>

      {pickingMode && (
        <div className="absolute top-20 md:top-8 left-1/2 -translate-x-1/2 z-[1000] bg-slate-900/90 text-white px-6 py-3.5 rounded-full shadow-2xl backdrop-blur flex items-center gap-4 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
            </span>
            <span className="font-bold text-sm">
              Klik pada peta untuk menetapkan Titik {pickingMode === 'start' ? 'Awal' : 'Tujuan'}
            </span>
          </div>
          <button onClick={() => setPickingMode(null)} className="text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1 rounded-full text-xs font-bold transition-colors">
            Batal
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[9999] bg-red-100 text-red-800 px-6 py-3 rounded-full shadow-2xl border border-red-200 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <div className="bg-red-500 rounded-full p-1 text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </div>
          <span className="font-bold text-sm pr-2">{errorMsg}</span>
        </div>
      )}

      {toastMsg && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[9999] bg-emerald-100 text-emerald-800 px-6 py-3 rounded-full shadow-2xl border border-emerald-200 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <div className="bg-emerald-500 rounded-full p-1 text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <span className="font-bold text-sm pr-2">{toastMsg}</span>
        </div>
      )}

      {!activeItineraryDetails && isNavigating && !loading && selectedItineraryIndex === null && (
        <div className="absolute bottom-0 md:bottom-auto md:top-4 right-0 md:right-8 z-[1000] w-full md:w-96 bg-white/95 backdrop-blur-2xl rounded-t-3xl md:rounded-3xl shadow-[0_-15px_40px_-15px_rgba(0,0,0,0.2)] md:shadow-2xl border-t md:border border-white/60 overflow-hidden flex flex-col max-h-[70vh] md:max-h-[85vh] animate-in slide-in-from-bottom-full md:slide-in-from-right-10 duration-300">
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/80 sticky top-0 z-10 flex justify-between items-start">
            <div className="flex flex-col gap-3">
              <div>
                <h2 className="font-extrabold text-slate-800 text-lg tracking-tight">Rekomendasi Rute</h2>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">{itineraries.length} opsi tersedia</p>
              </div>
              {itineraries.length > 0 && (
                <button 
                  onClick={(e) => handleOpenBookmark(itineraries[0], e)}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl font-bold text-sm shadow-sm transition-colors cursor-pointer w-fit"
                  title="Simpan ke Bookmarks"
                >
                  <BookmarkPlus size={16} /> Bookmark
                </button>
              )}
            </div>
            <button onClick={() => { setItineraries([]); setIsNavigating(false); }} className="text-slate-400 hover:text-slate-700 hover:bg-slate-200 p-2 rounded-full transition-colors cursor-pointer shrink-0 mt-[-4px]">
              <X size={20} />
            </button>
          </div>

          <div className="p-4 overflow-y-auto custom-scrollbar flex flex-col gap-3 bg-slate-50/30">
            {itineraries.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center bg-white rounded-2xl border border-slate-200 border-dashed">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                </div>
                <h3 className="text-slate-700 font-bold mb-1">Rute Tidak Ditemukan</h3>
                <p className="text-slate-500 text-sm">Tidak ada rute yang sesuai dengan kriteria pencarian Anda. Coba perbesar jarak jalan kaki maksimal atau ubah opsi pencarian.</p>
              </div>
            ) : (
              itineraries.map((itin, idx) => (
              <div
                key={idx}
                onClick={() => handleSelectItinerary(idx)}
                className="group cursor-pointer bg-white border border-slate-200 hover:border-blue-400 hover:shadow-md rounded-2xl p-4 transition-all"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {itin.legs.filter((l) => l.type === 'transit').map((leg, idx, arr) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="px-2.5 py-1 bg-slate-800 text-white text-xs font-bold rounded-lg shadow-sm">
                          {leg.route.route_short_name}
                        </span>
                        {idx < arr.length - 1 && <span className="text-slate-400 font-bold text-xs">➔</span>}
                      </div>
                    ))}
                  </div>
                  <div className="text-right flex flex-col gap-1 items-end">
                    <div className="flex items-center gap-2">
                      <div className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md inline-block">
                        {Math.round(itin.score / 60)} mnt
                      </div>
                    </div>
                    {itin.totalFare !== undefined && (
                      <div className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Banknote size={12} /> Rp {itin.totalFare.toLocaleString('id-ID')}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 mt-2">
                  <div className="flex justify-between text-sm font-semibold text-slate-700">
                    <span className="truncate pr-2">{itin.legs.find((l) => l.type === 'transit')?.startStop?.stop_name}</span>
                    <span className="text-slate-500 flex-shrink-0">{itin.startTime?.slice(0, 5)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold text-slate-700">
                    <span className="truncate pr-2">{itin.legs.slice().reverse().find((l) => l.type === 'transit')?.endStop?.stop_name}</span>
                    <span className="text-slate-500 flex-shrink-0">{itin.endTime?.slice(0, 5)}</span>
                  </div>
                </div>
              </div>
            ))
            )}
          </div>
        </div>
      )}

      {activeItineraryDetails && (
        <div className="absolute bottom-0 md:bottom-auto md:top-4 right-0 md:right-8 z-[1000] w-full md:w-96 bg-white/95 backdrop-blur-2xl rounded-t-3xl md:rounded-3xl shadow-[0_-15px_40px_-15px_rgba(0,0,0,0.2)] md:shadow-2xl border-t md:border border-white/60 overflow-hidden flex flex-col max-h-[55vh] md:max-h-[85vh] animate-in slide-in-from-bottom-full md:slide-in-from-right-10 duration-300">
          <div className="px-6 pb-6 md:pt-6 border-b border-slate-100/50 bg-white/50 sticky top-0 z-10">
            <div className="w-full flex justify-center py-3 md:hidden">
              <div className="w-12 h-1.5 bg-slate-300 rounded-full"></div>
            </div>

            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center flex-wrap gap-2">
                {activeItineraryDetails.filter(l => l.type === 'transit').map((leg, i, arr) => (
                  <div key={i} className="flex items-center gap-2">
                    <div
                      className="px-3 py-1.5 rounded-xl font-bold text-white shadow-sm text-sm flex items-center gap-2"
                      style={{ backgroundColor: leg.route.route_color ? `#${leg.route.route_color}` : '#00529b' }}
                    >
                      <BusFront size={16} />
                      {leg.route.route_short_name}
                    </div>
                    {i < arr.length - 1 && <span className="font-bold text-slate-400 text-sm">➔</span>}
                  </div>
                ))}
              </div>
              <button onClick={clearRoute} className="text-slate-400 hover:text-red-500 transition-colors p-1.5 bg-slate-100 hover:bg-red-50 rounded-full cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <h2 className="font-bold text-slate-800 text-[15px] leading-snug mt-4">
              {activeItineraryDetails.filter(l => l.type === 'transit').map(l => l.route.route_long_name).join(' ➔ Transit ➔ ')}
            </h2>

            <div className="flex flex-wrap gap-2 mt-2.5">
              {activeItineraryDetails.filter(l => l.type === 'transit' && l.route.route_desc).map((leg, i) => (
                <span key={i} className="px-2.5 py-1 bg-slate-800 text-white text-[10px] font-bold rounded-md uppercase tracking-wide shadow-sm">
                  {leg.route.route_short_name}: {formatRouteDesc(leg.route.route_desc)}
                </span>
              ))}
            </div>

            {!isNavigating && activeItineraryDetails.filter(l => l.type === 'transit').length === 1 && (
              <button
                onClick={() => setDirIndex(prev => prev === 0 ? 1 : 0)}
                className="mt-4 flex items-center justify-center gap-2 w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-colors cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 10v12" />
                  <path d="M11 18l-4 4-4-4" />
                  <path d="M17 14V2" />
                  <path d="M21 6l-4-4-4 4" />
                </svg>
                Tukar Arah Rute
              </button>
            )}

            {isNavigating && itineraries[selectedItineraryIndex || 0] && (
              <div className={`mt-5 grid ${requestedTime ? 'grid-cols-3' : 'grid-cols-2'} bg-gradient-to-r from-slate-50 to-slate-100/50 py-4 px-2 rounded-2xl border border-slate-200/60 shadow-sm divide-x divide-slate-200`}>
                {requestedTime && (
                  <div className="flex flex-col items-center justify-center gap-1.5 px-2 text-center">
                    <span className="text-xs text-slate-500 font-bold tracking-wide flex items-center justify-center gap-1.5 uppercase"><Clock size={14} /> Waktu</span>
                    <div className="flex flex-col items-center">
                      <span className="font-extrabold text-slate-800 text-[15px] leading-none">{itineraries[selectedItineraryIndex || 0].startTime.slice(0, 5)}</span>
                      <span className="text-slate-400 text-xs font-black my-1">↓</span>
                      <span className="font-extrabold text-slate-800 text-[15px] leading-none">{itineraries[selectedItineraryIndex || 0].endTime.slice(0, 5)}</span>
                    </div>
                  </div>
                )}
                <div className="flex flex-col items-center justify-center gap-1.5 px-2 text-center">
                  <span className="text-xs text-slate-500 font-bold tracking-wide flex items-center justify-center gap-1.5 uppercase"><Clock size={14} /> Estimasi</span>
                  <span className="font-extrabold text-slate-800 text-[15px]">
                    {Math.round(itineraries[selectedItineraryIndex || 0].score / 60)} mnt
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center gap-1.5 px-2 text-center">
                  <span className="text-xs text-slate-500 font-bold tracking-wide flex items-center justify-center gap-1.5 uppercase"><Banknote size={14} /> Tarif</span>
                  <span className="font-extrabold text-emerald-600 text-[15px]">
                    Rp {itineraries[selectedItineraryIndex || 0].totalFare?.toLocaleString('id-ID') || '0'}
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/30">
            {activeItineraryDetails.map((leg, legIdx) => {
              if (leg.type === 'walk') {
                return (
                  <div key={`walk-${legIdx}`} className="flex flex-col items-center justify-center mb-4 -mt-2">
                    <div className="w-[2px] h-4 bg-slate-300 border-l-2 border-dashed border-slate-400 mb-1"></div>
                    <div className="flex items-center gap-1.5 bg-slate-700 text-white px-3 py-1.5 rounded-full shadow-sm z-10 border border-slate-600 max-w-[85%] text-center">
                      <Footprints size={14} className="shrink-0" />
                      <span className="text-[10px] font-bold tracking-wide uppercase leading-tight">
                        Turun di {leg.startStop?.stop_name}, lalu berpindah ke {leg.endStop?.stop_name}
                      </span>
                    </div>
                    <div className="w-[2px] h-4 bg-slate-300 border-l-2 border-dashed border-slate-400 mt-1"></div>
                  </div>
                );
              }

              if (leg.type === 'transit') {
                const isExpanded = expandedLegs[legIdx] ?? true;
                const toggleExpanded = () => setExpandedLegs(prev => ({ ...prev, [legIdx]: !isExpanded }));
                
                const nextLeg = activeItineraryDetails[legIdx + 1];
                const isDirectSameStopTransfer = nextLeg?.type === 'transit';

                return (
                  <div key={`transit-${legIdx}`} className="mb-6">
                    <button
                      onClick={toggleExpanded}
                      className="w-full flex justify-between items-center py-3 px-4 border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-6 rounded-full" style={{ backgroundColor: leg.route.route_color ? `#${leg.route.route_color}` : '#3b82f6' }}></div>
                        <h3 className="text-sm font-bold text-slate-700">
                          {leg.route.route_short_name} <span className="text-slate-400 font-medium ml-1">({leg.shapeDetails?.stops?.length || 0} pemberhentian)</span>
                        </h3>
                      </div>
                      {isExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                    </button>

                    {isExpanded && leg.shapeDetails?.stops && (
                      <div className="relative pl-7 pb-2">
                        <div className="absolute left-2.5 top-2 bottom-2 w-[3px] bg-slate-200 rounded-full"></div>

                        {(() => {
                          const stopList = leg.intermediateStops || leg.shapeDetails.stops;
                          return stopList.map((stop, idx) => {
                            if (idx === 0 && legIdx > 0) {
                              const prevLeg = activeItineraryDetails[legIdx - 1];
                              if (prevLeg && prevLeg.type === 'walk' && prevLeg.endStop?.id === stop.id) {
                              } else if (prevLeg && prevLeg.type === 'transit' && prevLeg.endStop?.id === stop.id) {
                                  return null;
                              }
                            }

                            const isHighlight = (isNavigating && startStop?.id === stop.id) || (isNavigating && destStop?.id === stop.id);
                            
                            return (
                              <div 
                                key={`stop-${legIdx}-${stop.id}-${idx}`} 
                                className="relative mb-5 last:mb-0 cursor-pointer group"
                                onClick={() => setFocusedStop(stop)}
                              >
                                <div
                                  className={`absolute -left-[25.5px] top-1 w-3.5 h-3.5 rounded-full border-2 bg-white transition-all group-hover:scale-125 ${isHighlight ? 'border-blue-500 w-[18px] h-[18px] -left-[27.5px] -top-0.5 shadow-md shadow-blue-500/30 z-10' : 'border-slate-300'}`}
                                  style={isHighlight ? { borderColor: leg.route.route_color ? `#${leg.route.route_color}` : '#3b82f6' } : {}}
                                ></div>
                                <div className="flex justify-between items-center pr-2">
                                  <p className={`text-[13px] group-hover:text-blue-600 transition-colors ${isHighlight ? 'font-bold text-slate-900' : 'font-medium text-slate-600'}`}>
                                    {stop.stop_name}
                                  </p>
                                  {stop.time && (
                                    <span className="text-xs font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shadow-sm">{stop.time}</span>
                                  )}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}

                    {isDirectSameStopTransfer && (
                      <div className="flex flex-col items-center justify-center mb-4 mt-2">
                        <div className="w-[2px] h-4 bg-slate-300 border-l-2 border-dashed border-slate-400 mb-1"></div>
                        <div className="flex items-center gap-1.5 bg-slate-700 text-white px-3 py-1.5 rounded-full shadow-sm z-10 border border-slate-600 max-w-[85%] text-center">
                          <PersonStanding size={14} className="shrink-0" />
                          <span className="text-[10px] font-bold tracking-wide uppercase leading-tight">
                            Transit di {leg.endStop?.stop_name}
                          </span>
                        </div>
                        <div className="w-[2px] h-4 bg-slate-300 border-l-2 border-dashed border-slate-400 mt-1"></div>
                      </div>
                    )}
                  </div>
                );
              }

              return null;
            })}
          </div>
        </div>
      )}

      <div className="absolute inset-0 z-0 bg-slate-100 flex items-center justify-center">
        {loading && (
          <div className="absolute z-10 flex flex-col items-center justify-center bg-white/40 backdrop-blur-sm inset-0">
            <div className="w-12 h-12 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin mb-4 shadow-sm"></div>
            <p className="font-bold text-sm text-slate-700 animate-pulse bg-white/90 px-5 py-2 rounded-xl shadow-lg">Mengkalkulasi Rute Tercepat...</p>
          </div>
        )}
        <Suspense fallback={<div>Loading Map...</div>}>
          <Map
            activeItineraryDetails={activeItineraryDetails}
            startStop={startStop}
            destStop={destStop}
            focusedStop={focusedStop}
            onMapClick={handleMapClick}
          />
        </Suspense>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        ${pickingMode ? '.leaflet-container { cursor: crosshair !important; }' : ''}
      `}} />

      {showBookmarkModal && (
        <div className="absolute inset-0 z-[2000] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-slate-800 mb-2">Simpan Bookmark</h3>
            <p className="text-sm text-slate-500 mb-4">Berikan deskripsi singkat untuk rute ini agar mudah ditemukan (mis. "Rute ke Kampus").</p>
            <input 
              type="text" 
              placeholder="Deskripsi Rute" 
              value={bookmarkDesc}
              onChange={(e) => setBookmarkDesc(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-semibold text-slate-700"
            />
            <div className="flex justify-end gap-3 mt-2">
              <button onClick={() => setShowBookmarkModal(false)} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer">Batal</button>
              <button onClick={saveBookmark} disabled={savingBookmark || !bookmarkDesc.trim()} className="px-5 py-2.5 text-sm font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer">
                {savingBookmark ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {!activeItineraryDetails && itineraries.length === 0 && !pickingMode && (
        <button 
          onClick={() => setShowGuide(true)}
          className="absolute bottom-[90px] right-6 md:bottom-8 md:right-8 z-[1000] bg-blue-600 text-white p-3.5 rounded-full shadow-lg hover:bg-blue-700 hover:scale-105 transition-all flex items-center justify-center group"
          title="Panduan Transjakarta"
        >
          <Info size={24} />
          <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out whitespace-nowrap opacity-0 group-hover:opacity-100 font-bold ml-0 group-hover:ml-2">
            Panduan Transjakarta
          </span>
        </button>
      )}

      <GuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="w-full h-full flex items-center justify-center bg-slate-50">Memuat UI Navigasi...</div>}>
      <HomeContent />
    </Suspense>
  );
}
