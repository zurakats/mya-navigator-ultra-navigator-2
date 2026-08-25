import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Mail, Loader2, LogOut } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [user, setUser] = useState(null);
  
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${API_URL}/api/auth/me`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.authenticated) {
          setUser(data.user);
        }
      })
      .catch(err => console.error(err));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const url = isLogin ? '/api/auth/login' : '/api/auth/register';
      const body = isLogin ? { username, password } : { username, password, name };
      
      const res = await fetch(`${API_URL}${url}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || 'Terjadi kesalahan');
      } else {
        if (!isLogin) {
          setIsLogin(true);
          setError('');
          setToastMsg('Pendaftaran berhasil! Silakan masuk.');
          setTimeout(() => setToastMsg(''), 3000);
        } else {
          setToastMsg('Berhasil masuk! Mengalihkan...');
          setTimeout(() => {
            setUser(data.user);
            navigate('/');
          }, 1500);
        }
      }
    } catch (err) {
      setError('Gagal terhubung ke server');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await fetch(`${API_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' });
      setUser(null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (user) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-slate-50">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 w-full max-w-md text-center">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
            <User size={40} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-1">Halo, {user.name}!</h2>
          <p className="text-slate-500 mb-8">@{user.username}</p>
          
          <button 
            onClick={handleLogout}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 py-3 rounded-2xl font-bold hover:bg-red-100 transition-colors"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <LogOut size={20} />}
            Keluar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-slate-50">
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 w-full max-w-md">
        <div className="text-center mb-8">
          
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
            <User size={32} />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-800">{isLogin ? 'Masuk' : 'Daftar Akun'}</h1>
          <p className="text-slate-500 text-sm mt-2">
            {isLogin ? 'Masuk untuk mengakses rute favoritmu' : 'Buat akun untuk menyimpan rute favorit'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm font-semibold p-3 rounded-xl mb-6 border border-red-100 text-center">
            {error}
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

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {!isLogin && (
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <User size={18} />
              </div>
              <input
                type="text"
                placeholder="Nama Lengkap"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all text-sm font-semibold text-slate-700"
              />
            </div>
          )}
          
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <Mail size={18} />
            </div>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all text-sm font-semibold text-slate-700"
            />
          </div>

          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <Lock size={18} />
            </div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all text-sm font-semibold text-slate-700"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-2xl transition-colors mt-2 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : (isLogin ? 'Masuk' : 'Daftar')}
          </button>
        </form>

        <div className="mt-8 text-center text-sm font-medium text-slate-500">
          {isLogin ? "Belum punya akun? " : "Sudah punya akun? "}
          <button 
            type="button"
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="text-blue-600 font-bold hover:underline"
          >
            {isLogin ? 'Daftar sekarang' : 'Masuk di sini'}
          </button>
        </div>
      </div>
    </div>
  );
}
