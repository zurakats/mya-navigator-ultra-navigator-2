import React, { useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { Map, Navigation2, Route, Bookmark, User } from 'lucide-react';

export default function Layout() {
  const [session, setSession] = useState(false);

  return (
    <div className="antialiased text-slate-900 h-screen w-screen overflow-hidden flex flex-col md:flex-row bg-slate-50">
      
      <nav className="w-full md:w-20 bg-white border-r md:h-full border-slate-200 flex md:flex-col items-center justify-between md:justify-start py-4 px-6 md:px-0 z-[1000] shadow-md md:shadow-none absolute md:relative bottom-0 md:bottom-auto">
        <div className="flex md:flex-col gap-8 w-full justify-around md:justify-start md:mt-8">
          <Link to="/" className="flex flex-col items-center text-slate-500 hover:text-blue-600 transition-colors">
            <Map size={24} />
            <span className="text-[10px] mt-1 font-medium">Map</span>
          </Link>
          <Link to="/routes" className="flex flex-col items-center text-slate-500 hover:text-blue-600 transition-colors">
            <Route size={24} />
            <span className="text-[10px] mt-1 font-medium">Routes</span>
          </Link>
          <Link to="/bookmarks" className="flex flex-col items-center text-slate-500 hover:text-blue-600 transition-colors">
            <Bookmark size={24} />
            <span className="text-[10px] mt-1 font-medium">Bookmarks</span>
          </Link>
          <Link to="/login" className="flex flex-col items-center text-slate-500 hover:text-blue-600 transition-colors md:mt-auto md:mb-8">
            <User size={24} />
            <span className="text-[10px] mt-1 font-medium">Profile</span>
          </Link>
        </div>
      </nav>
      
      
      <main className="flex-1 relative h-full w-full">
        <Outlet />
      </main>
    </div>
  );
}
