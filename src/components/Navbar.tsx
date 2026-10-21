import React, { useState } from 'react';
import { UserAccount, AppNotification } from '../types/inventory';
import { useInventory } from '../context/InventoryContext';
import {
  Boxes,
  Bell,
  RotateCcw,
  UserCheck,
  ChevronDown,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  ClipboardList,
  Users,
  LogOut,
  Shield,
  Key,
  Building2,
  ShieldAlert,
  MapPin,
  Settings,
  Activity,
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  currentUser: UserAccount;
  allUsers: UserAccount[];
  onSwitchUser: (userId: string) => void;
  onLogout: () => void;
  notifications: AppNotification[];
  onOpenNotifications: () => void;
  onResetData: () => void;
  pendingApprovalsCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  currentUser,
  allUsers,
  onSwitchUser,
  onLogout,
  notifications,
  onOpenNotifications,
  onResetData,
  pendingApprovalsCount,
}) => {
  const { companyProfile, lowStockItems, nearMinStockItems, minStockProposals } = useInventory();
  const alertStockCount = lowStockItems.length + nearMinStockItems.length;
  const pendingMinStockProposals = minStockProposals.filter(
    (p) => p.status === 'PENDING' || p.status === 'VERIFIED_ADMIN'
  ).length;

  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  // Unread notifications for current user/role
  const unreadCount = notifications.filter((n) => {
    if (n.read) return false;
    if (n.targetUserId && n.targetUserId === currentUser.id) return true;
    if (n.targetRole === 'all' || n.targetRole === currentUser.role) return true;
    return false;
  }).length;

  const isAdmin = currentUser.role === 'admin';
  const isKepala = currentUser.role === 'kepala_gudang';
  const isAdminOrKepala = isAdmin || isKepala;

  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-6 h-16">
          {/* Zone 1: Brand Wordmark & Dynamic Logo */}
          <div
            onClick={() => onSelectTab('dashboard')}
            className="flex items-center gap-3 shrink-0 cursor-pointer"
          >
            {companyProfile.logoUrl ? (
              <img
                src={companyProfile.logoUrl}
                alt="Logo"
                className="w-9 h-9 object-contain rounded-lg bg-white/10 p-0.5"
              />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Boxes className="w-5 h-5" />
              </div>
            )}
            <div>
              <span className="text-base font-bold tracking-tight text-white whitespace-nowrap">
                {companyProfile.appName || 'GudangPresisi'}
              </span>
              <span className="hidden sm:inline-block text-[10px] font-mono text-emerald-400 ml-2 px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/20">
                {companyProfile.appTagline || 'SISTEM INVENTORY'}
              </span>
            </div>
          </div>

          {/* Zone 2: Navigation Links (Single-line controls) */}
          <nav className="hidden md:flex items-center gap-1 text-xs font-medium text-slate-300">
            <button
              onClick={() => onSelectTab('dashboard')}
              className={`px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                currentTab === 'dashboard'
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'hover:text-white hover:bg-slate-800/60'
              }`}
            >
              Dashboard
            </button>

            <button
              onClick={() => onSelectTab('lpb')}
              className={`px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                currentTab === 'lpb'
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
              LPB
            </button>

            <button
              onClick={() => onSelectTab('vouchers')}
              className={`px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                currentTab === 'vouchers'
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />
              Nota (SIV)
              {pendingApprovalsCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-amber-500 text-slate-950 rounded-full tabular-nums">
                  {pendingApprovalsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onSelectTab('items')}
              className={`px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                currentTab === 'items'
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              Master Stok
            </button>

            {/* TAB STOK MINIMAL & PERINGATAN */}
            <button
              onClick={() => onSelectTab('min-stock')}
              className={`px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                currentTab === 'min-stock'
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'hover:text-white hover:bg-slate-800/60'
              }`}
              title="Pantau stok yang mendekati atau melampaui batas minimal serta pengajuan perubahan batas stok"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
              <span>Stok Minimal</span>
              {alertStockCount > 0 && (
                <span className="text-[10px] font-black px-1.5 py-0.2 bg-red-600 text-white rounded-full tabular-nums animate-pulse">
                  {alertStockCount}
                </span>
              )}
              {pendingMinStockProposals > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-amber-400 text-slate-950 rounded-full tabular-nums">
                  {pendingMinStockProposals} ACC
                </span>
              )}
            </button>

            <button
              onClick={() => onSelectTab('locations')}
              className={`px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                currentTab === 'locations'
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              Lokasi Rak
            </button>

            <button
              onClick={() => onSelectTab('ledger')}
              className={`px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                currentTab === 'ledger'
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5 text-slate-400" />
              Kartu Stok
            </button>

            <button
              onClick={() => onSelectTab('activity-log')}
              className={`px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                currentTab === 'activity-log'
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'hover:text-white hover:bg-slate-800/60'
              }`}
              title="System Activity Log: Riwayat Penyesuaian Stok, Approval, dan Perubahan User"
            >
              <Activity className="w-3.5 h-3.5 text-indigo-400" />
              <span>Activity Log</span>
            </button>

            {isAdminOrKepala && (
              <>
                <button
                  onClick={() => onSelectTab('accounting')}
                  className={`px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                    currentTab === 'accounting'
                      ? 'bg-slate-800 text-white font-semibold'
                      : 'hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5 text-amber-400" />
                  Cost Center/GL
                </button>

                <button
                  onClick={() => onSelectTab('company')}
                  className={`px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                    currentTab === 'company'
                      ? 'bg-slate-800 text-white font-semibold'
                      : 'hover:text-white hover:bg-slate-800/60'
                  }`}
                  title="Edit logo, nama aplikasi, dan data profil perusahaan"
                >
                  <Settings className="w-3.5 h-3.5 text-slate-400" />
                  Profil &amp; Logo
                </button>

                <button
                  onClick={() => onSelectTab('users')}
                  className={`px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                    currentTab === 'users'
                      ? 'bg-slate-800 text-white font-semibold'
                      : 'hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-emerald-400" />
                  Pengguna
                </button>
              </>
            )}
          </nav>

          {/* Zone 3: Actions, Notification Bell, User Switcher, Logout */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Notification Bell */}
            <button
              onClick={onOpenNotifications}
              className="relative p-2 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Notifikasi Real-time"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Role & User Switcher Dropdown */}
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-lg text-xs text-left transition-colors"
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] ${
                    isKepala
                      ? 'bg-blue-600 text-white'
                      : isAdmin
                      ? 'bg-emerald-600 text-white'
                      : 'bg-amber-600 text-white'
                  }`}
                >
                  {currentUser.name.charAt(0)}
                </div>
                <div className="hidden sm:block">
                  <div className="font-semibold text-white leading-tight truncate max-w-[120px]">
                    {currentUser.name}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate max-w-[120px] font-mono">
                    @{currentUser.username}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
              </button>

              {userDropdownOpen && (
                <div className="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 mt-2 sm:w-80 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 text-slate-800 text-xs z-50 max-h-[80vh] overflow-y-auto">
                  {/* Current Active Account Header */}
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                        AKUN AKTIF
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-semibold ${
                          isKepala
                            ? 'bg-blue-100 text-blue-800'
                            : isAdmin
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {isKepala ? 'KEPALA GUDANG' : isAdmin ? 'ADMIN GUDANG' : 'PEMOHON'}
                      </span>
                    </div>
                    <div className="font-bold text-slate-900 text-sm mt-1">{currentUser.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      Username: @{currentUser.username}
                    </div>
                    <div className="text-[11px] text-slate-600 mt-0.5">{currentUser.department}</div>
                  </div>

                  {/* Admin Shortcuts */}
                  {isAdminOrKepala && (
                    <div className="p-2 border-b border-slate-100">
                      <button
                        onClick={() => {
                          onSelectTab('users');
                          setUserDropdownOpen(false);
                        }}
                        className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded flex items-center gap-2 font-medium"
                      >
                        <Users className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Buka Manajemen Pengguna</span>
                      </button>
                    </div>
                  )}

                  {/* Switch to Another Account */}
                  <div className="p-2 border-b border-slate-100">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block px-2 mb-1">
                      Beralih Akun Cepat
                    </span>
                    <div className="space-y-0.5 max-h-48 overflow-y-auto">
                      {allUsers.map((user) => {
                        const isCurrent = user.id === currentUser.id;
                        const uIsKepala = user.role === 'kepala_gudang';
                        const uIsAdmin = user.role === 'admin';

                        return (
                          <button
                            key={user.id}
                            onClick={() => {
                              onSwitchUser(user.id);
                              setUserDropdownOpen(false);
                            }}
                            className={`w-full text-left px-2.5 py-1.5 rounded flex items-center justify-between text-xs transition-colors ${
                              isCurrent ? 'bg-emerald-50 text-emerald-900 font-semibold' : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="truncate">{user.name}</span>
                                <span className="text-[10px] text-slate-400 font-mono">(@{user.username})</span>
                                <span
                                  className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                                    uIsKepala
                                      ? 'bg-blue-100 text-blue-800'
                                      : uIsAdmin
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {uIsKepala ? 'KEPALA GUDANG' : uIsAdmin ? 'ADMIN' : 'PEMOHON'}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-500 truncate">{user.department}</div>
                            </div>
                            {isCurrent && <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions: Reset & Logout */}
                  <div className="p-2 space-y-1 bg-slate-50 border-t border-slate-100">
                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        onResetData();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset Data Contoh (Demo State)
                    </button>

                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-red-600 hover:text-red-700 hover:bg-red-50 rounded font-semibold transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Keluar / Ganti Password (Logout)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Logout Button */}
            <button
              onClick={onLogout}
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
              title="Keluar dari Akun (Logout)"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Touch-Optimized Nav Bar */}
      <div className="md:hidden flex items-center justify-around border-t border-slate-800 py-1 px-1 text-[11px] bg-slate-900/95 backdrop-blur-md">
        <button
          onClick={() => onSelectTab('dashboard')}
          className={`flex-1 py-1.5 px-1 rounded-lg flex flex-col items-center justify-center transition-colors min-h-[44px] ${
            currentTab === 'dashboard' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Boxes className="w-4 h-4 mb-0.5" />
          <span className="text-[10px]">Beranda</span>
        </button>

        <button
          onClick={() => onSelectTab('lpb')}
          className={`flex-1 py-1.5 px-1 rounded-lg flex flex-col items-center justify-center transition-colors min-h-[44px] ${
            currentTab === 'lpb' ? 'bg-slate-800 text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ArrowDownLeft className="w-4 h-4 mb-0.5 text-emerald-400" />
          <span className="text-[10px]">LPB Masuk</span>
        </button>

        <button
          onClick={() => onSelectTab('vouchers')}
          className={`relative flex-1 py-1.5 px-1 rounded-lg flex flex-col items-center justify-center transition-colors min-h-[44px] ${
            currentTab === 'vouchers' ? 'bg-slate-800 text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ArrowUpRight className="w-4 h-4 mb-0.5 text-amber-400" />
          <span className="text-[10px]">Nota SIV</span>
          {pendingApprovalsCount > 0 && (
            <span className="absolute top-1 right-2 w-4 h-4 bg-amber-500 text-slate-950 text-[9px] font-bold rounded-full flex items-center justify-center">
              {pendingApprovalsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => onSelectTab('items')}
          className={`flex-1 py-1.5 px-1 rounded-lg flex flex-col items-center justify-center transition-colors min-h-[44px] ${
            currentTab === 'items' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4 mb-0.5" />
          <span className="text-[10px]">Master</span>
        </button>

        <button
          onClick={() => onSelectTab('min-stock')}
          className={`relative flex-1 py-1.5 px-1 rounded-lg flex flex-col items-center justify-center transition-colors min-h-[44px] ${
            currentTab === 'min-stock' ? 'bg-slate-800 text-red-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldAlert className="w-4 h-4 mb-0.5 text-red-400" />
          <span className="text-[10px]">Stok Min</span>
          {alertStockCount > 0 && (
            <span className="absolute top-1 right-2 w-4 h-4 bg-red-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              {alertStockCount}
            </span>
          )}
        </button>

        <button
          onClick={() => onSelectTab('ledger')}
          className={`flex-1 py-1.5 px-1 rounded-lg flex flex-col items-center justify-center transition-colors min-h-[44px] ${
            currentTab === 'ledger' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ClipboardList className="w-4 h-4 mb-0.5" />
          <span className="text-[10px]">Mutasi</span>
        </button>

        <button
          onClick={() => onSelectTab('activity-log')}
          className={`flex-1 py-1.5 px-1 rounded-lg flex flex-col items-center justify-center transition-colors min-h-[44px] ${
            currentTab === 'activity-log' ? 'bg-slate-800 text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4 mb-0.5 text-indigo-400" />
          <span className="text-[10px]">Log Audit</span>
        </button>

        {isAdmin && (
          <>
            <button
              onClick={() => onSelectTab('accounting')}
              className={`flex-1 py-1.5 px-1 rounded-lg flex flex-col items-center justify-center transition-colors min-h-[44px] ${
                currentTab === 'accounting' ? 'bg-slate-800 text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Building2 className="w-4 h-4 mb-0.5 text-amber-400" />
              <span className="text-[10px]">Cost/GL</span>
            </button>

            <button
              onClick={() => onSelectTab('users')}
              className={`flex-1 py-1.5 px-1 rounded-lg flex flex-col items-center justify-center transition-colors min-h-[44px] ${
                currentTab === 'users' ? 'bg-slate-800 text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4 mb-0.5 text-emerald-400" />
              <span className="text-[10px]">User</span>
            </button>
          </>
        )}
      </div>
    </header>
  );
};
