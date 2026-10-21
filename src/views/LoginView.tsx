import React, { useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import {
  Boxes,
  Lock,
  User,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  KeyRound,
} from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login, users } = useInventory();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!username.trim() || !password) {
      setErrorMsg('Mohon masukkan username dan password Anda.');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      const result = login(username, password);
      setIsLoading(false);
      if (!result.success && result.error) {
        setErrorMsg(result.error);
      }
    }, 250);
  };

  const handleQuickFill = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setErrorMsg('');
  };

  const activeUsers = users.filter((u) => u.isActive !== false);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-100 font-sans relative overflow-hidden">
      {/* Background Subtle Gradient & Grid Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950 -z-10" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b0a_1px,transparent_1px),linear-gradient(to_bottom,#1e293b0a_1px,transparent_1px)] bg-[size:32px_32px] -z-10" />

      {/* Main Container */}
      <div className="sm:mx-auto sm:w-full sm:max-w-lg px-4">
        {/* Brand Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mb-4 shadow-lg shadow-emerald-950/40">
            <Boxes className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            GudangPresisi
          </h1>
          <p className="text-xs uppercase tracking-widest text-emerald-400 font-mono mt-1">
            Sistem Inventaris & Logistik Gudang
          </p>
          <p className="text-xs text-slate-400 mt-2 max-w-sm mx-auto">
            Silakan masuk menggunakan akun Admin Gudang, Kepala Gudang, atau User Pemohon.
          </p>
        </div>

        {/* Card Box */}
        <div className="mt-8 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {errorMsg && (
              <div className="p-3 bg-red-950/70 border border-red-500/40 rounded-xl text-red-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
            )}

            {/* Username Input */}
            <div>
              <label className="block font-medium text-slate-300 mb-1.5">
                Username Pengguna
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  autoFocus
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder="Contoh: kepala / admin / budi / siti"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-hidden transition-colors"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block font-medium text-slate-300 mb-1.5">
                Kata Sandi (Password)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder="Masukkan password"
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-hidden transition-colors font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-colors shadow-lg shadow-emerald-900/30 disabled:opacity-50"
              >
                <span>{isLoading ? 'Memverifikasi...' : 'Masuk ke Sistem'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>

          {/* Quick Demo Helper Credentials */}
          <div className="mt-6 pt-5 border-t border-slate-800">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
              <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
              <span>Akun Demo Cepat (Klik untuk Isi Otomatis)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              {activeUsers.map((u) => {
                const isAdmin = u.role === 'admin';
                const isKepala = u.role === 'kepala_gudang';

                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleQuickFill(u.username, u.password)}
                    className={`p-2.5 bg-slate-950/90 border rounded-xl text-left transition-colors group ${
                      isKepala
                        ? 'border-blue-500/40 hover:border-blue-400 bg-blue-950/20'
                        : isAdmin
                        ? 'border-emerald-500/30 hover:border-emerald-400'
                        : 'border-slate-800 hover:border-amber-500/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`font-semibold text-white transition-colors ${
                          isKepala
                            ? 'group-hover:text-blue-400'
                            : isAdmin
                            ? 'group-hover:text-emerald-400'
                            : 'group-hover:text-amber-400'
                        }`}
                      >
                        {u.username}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                          isKepala
                            ? 'bg-blue-950 text-blue-300 border border-blue-500/40'
                            : isAdmin
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {isKepala ? 'KEPALA GUDANG' : isAdmin ? 'ADMIN GUDANG' : 'PEMOHON'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-300 font-medium truncate mt-0.5">
                      {u.name}
                    </div>
                    <div className="text-[9px] text-slate-500 truncate">
                      {u.department}
                    </div>
                    <div className="text-[9px] font-mono text-slate-500 mt-1">
                      Pass: {u.password}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-6 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Otorisasi Berjenjang: Pemohon &rarr; Admin Gudang &rarr; Kepala Gudang</span>
        </div>
      </div>
    </div>
  );
};
