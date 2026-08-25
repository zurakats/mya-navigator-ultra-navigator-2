import { useState, useEffect } from 'react';
import { BusFront, ChevronRight, Search } from 'lucide-react';
import { Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function RoutesPage() {
  const [routes, setRoutes] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/routes`)
      .then(res => res.json())
      .then(data => {
        setRoutes(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const filteredRoutes = routes.filter(r => 
    (r.route_short_name && r.route_short_name.toLowerCase().includes(search.toLowerCase())) ||
    (r.route_long_name && r.route_long_name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="h-full w-full overflow-y-auto bg-slate-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Transjakarta Routes</h1>
        <p className="text-slate-500 mb-8">Browse all available corridors and feeder routes.</p>
        
        <div className="relative mb-8">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            <Search size={20} />
          </div>
          <input 
            type="text" 
            placeholder="Search routes..." 
            className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm font-medium"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="font-medium animate-pulse">Loading routes...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRoutes.map(route => (
              <Link to={`/?routeId=${encodeURIComponent(route.id)}`} key={route.id}>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all group cursor-pointer flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white shadow-inner"
                      style={{ backgroundColor: route.route_color ? `#${route.route_color}` : '#00529b' }}
                    >
                      {route.route_short_name || <BusFront size={20} />}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 line-clamp-1">{route.route_long_name}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-xs text-slate-500 font-medium">Route ID: {route.id}</p>
                        {route.fare_rules && route.fare_rules.length > 0 && (
                          <p className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                            Rp {route.fare_rules[0].fare_attribute.price.toLocaleString('id-ID')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-slate-400 group-hover:text-blue-500 transition-colors group-hover:translate-x-1 duration-300">
                    <ChevronRight size={20} />
                  </div>
                </div>
              </Link>
            ))}
            
            {filteredRoutes.length === 0 && (
              <div className="col-span-1 md:col-span-2 text-center py-12 text-slate-500">
                No routes found matching your search.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
