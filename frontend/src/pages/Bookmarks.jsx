import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Bookmark, MapPin, Trash2, Loader2, Edit2, CheckCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function Bookmarks() {
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(null);
  const navigate = useNavigate();
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [editingBookmarkId, setEditingBookmarkId] = useState(null);
  const [editDescription, setEditDescription] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);

  useEffect(() => {
    fetch(`${API_URL}/api/auth/me`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (!data.authenticated) {
          setAuthenticated(false);
          setLoading(false);
        } else {
          setAuthenticated(true);
          fetchBookmarks();
        }
      })
      .catch(err => console.error(err));
  }, []);

  const fetchBookmarks = async () => {
    try {
      const res = await fetch(`${API_URL}/api/bookmarks`, { credentials: 'include' });
      const data = await res.json();
      if (data.bookmarks) {
        setBookmarks(data.bookmarks);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const initiateDelete = (id, e) => {
    e.stopPropagation();
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      const res = await fetch(`${API_URL}/api/bookmarks/${deleteConfirmId}`, { 
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        setBookmarks(bookmarks.filter(b => b.id !== deleteConfirmId));
        setToastMsg('Bookmark berhasil dihapus!');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const initiateEdit = (b, e) => {
    e.stopPropagation();
    setEditingBookmarkId(b.id);
    setEditDescription(b.description);
  };

  const confirmEdit = async () => {
    if (!editingBookmarkId) return;
    try {
      const res = await fetch(`${API_URL}/api/bookmarks/${editingBookmarkId}`, { 
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: editDescription }),
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setBookmarks(bookmarks.map(b => b.id === editingBookmarkId ? data.bookmark : b));
        setToastMsg('Nama rute berhasil disimpan!');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setEditingBookmarkId(null);
    }
  };

  const handleBookmarkClick = (b) => {
    const params = new URLSearchParams({
      startLat: b.startLat.toString(),
      startLon: b.startLon.toString(),
      startName: b.startName,
      destLat: b.destLat.toString(),
      destLon: b.destLon.toString(),
      destName: b.destName,
    });
    if (b.time) params.append('time', b.time);
    if (b.vehicle) params.append('vehicle', b.vehicle);
    
    navigate(`/?${params.toString()}`);
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-blue-500" size={40} />
      </div>
    );
  }

  if (authenticated === false) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-slate-50">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 w-full max-w-md text-center">
          <Bookmark size={48} className="mx-auto text-slate-300 mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Belum Masuk</h2>
          <p className="text-slate-500 mb-6">Silakan masuk ke akun Anda untuk menyimpan dan melihat rute favorit.</p>
          <Link to="/login" className="inline-block w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-2xl transition-colors">
            Masuk / Daftar
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-slate-50 overflow-y-auto">
      {toastMsg && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[9999] bg-emerald-100 text-emerald-800 px-6 py-3 rounded-full shadow-2xl border border-emerald-200 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <div className="bg-emerald-500 rounded-full p-1 text-white">
            <CheckCircle size={16} strokeWidth={3} />
          </div>
          <span className="font-bold text-sm pr-2">{toastMsg}</span>
        </div>
      )}

      <div className="max-w-4xl w-full mx-auto p-6 md:p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
            <Bookmark size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800">Bookmarks Rute</h1>
            <p className="text-sm font-semibold text-slate-500">Rute favorit yang Anda simpan</p>
          </div>
        </div>

        {bookmarks.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center shadow-sm border border-slate-200">
            <MapPin size={48} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-bold text-slate-700 mb-2">Belum Ada Bookmark</h3>
            <p className="text-slate-500 max-w-sm mx-auto">Anda belum menyimpan rute apa pun. Cari rute di halaman Map lalu tekan ikon Bintang untuk menyimpannya ke sini.</p>
            <Link to="/" className="inline-block mt-6 px-6 py-2.5 bg-blue-50 text-blue-600 font-bold rounded-xl hover:bg-blue-100 transition-colors">
              Cari Rute Sekarang
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {bookmarks.map(b => (
              <div 
                key={b.id} 
                onClick={() => handleBookmarkClick(b)}
                className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-bold text-lg text-slate-800 group-hover:text-blue-600 transition-colors flex-1 pr-4">{b.description}</h3>
                  <div className="flex gap-1 shrink-0">
                    <button 
                      onClick={(e) => initiateEdit(b, e)}
                      className="text-slate-300 hover:text-blue-500 hover:bg-blue-50 p-2 rounded-full transition-colors shrink-0"
                      title="Edit nama bookmark"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={(e) => initiateDelete(b.id, e)}
                      className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors shrink-0"
                      title="Hapus bookmark"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-3 relative">
                  <div className="absolute left-[9px] top-[14px] bottom-[14px] w-0.5 bg-slate-200 z-0"></div>
                  
                  <div className="flex items-center gap-3 relative z-10">
                    <div className="w-5 h-5 rounded-full bg-blue-500 ring-4 ring-white flex-shrink-0"></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">{b.startName}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 relative z-10">
                    <div className="w-5 h-5 rounded-full border-4 border-red-500 bg-white ring-4 ring-white flex-shrink-0"></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">{b.destName}</p>
                    </div>
                  </div>
                </div>

                {b.time && (
                  <div className="mt-4 pt-4 border-t border-slate-100 flex gap-3 text-xs font-bold text-slate-500">
                    <span className="bg-slate-100 px-2.5 py-1 rounded-lg">Pkl {b.time}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {deleteConfirmId && (
        <div className="fixed inset-0 z-[2000] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Hapus Bookmark?</h3>
            <p className="text-sm text-slate-500 mb-6">Apakah Anda yakin ingin menghapus rute ini dari daftar bookmarks? Tindakan ini tidak dapat dibatalkan.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setDeleteConfirmId(null)} 
                className="flex-1 py-3 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button 
                onClick={confirmDelete} 
                className="flex-1 py-3 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors cursor-pointer"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {editingBookmarkId && (
        <div className="fixed inset-0 z-[2000] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-500">
              <Edit2 size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Edit Bookmark</h3>
            <div className="mb-6">
              <input 
                type="text" 
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                placeholder="Nama bookmark..."
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setEditingBookmarkId(null)} 
                className="flex-1 py-3 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button 
                onClick={confirmEdit} 
                className="flex-1 py-3 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!editDescription.trim()}
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
