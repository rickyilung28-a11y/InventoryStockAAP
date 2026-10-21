import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useInventory } from '../context/InventoryContext';
import { ActivityLogCategory } from '../types/inventory';
import {
  Activity,
  Search,
  ShieldCheck,
  UserCog,
  Boxes,
  Database,
  Clock,
  FileCheck2,
  Filter,
  FileSpreadsheet,
} from 'lucide-react';

export const SystemActivityLogView: React.FC = () => {
  const { activityLogs } = useInventory();

  const [selectedCategory, setSelectedCategory] = useState<'ALL' | ActivityLogCategory>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'admin' | 'kepala_gudang' | 'user'>('ALL');

  const filteredLogs = useMemo(() => {
    return activityLogs.filter((log) => {
      if (selectedCategory !== 'ALL' && log.category !== selectedCategory) return false;
      if (roleFilter !== 'ALL' && log.actorRole !== roleFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          log.title.toLowerCase().includes(q) ||
          log.description.toLowerCase().includes(q) ||
          log.actorName.toLowerCase().includes(q) ||
          (log.actorUsername && log.actorUsername.toLowerCase().includes(q)) ||
          (log.referenceNumber && log.referenceNumber.toLowerCase().includes(q)) ||
          log.action.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [activityLogs, selectedCategory, roleFilter, searchQuery]);

  // Summary metrics
  const counts = useMemo(() => {
    return {
      total: activityLogs.length,
      stock: activityLogs.filter((l) => l.category === 'STOCK_ADJUSTMENT').length,
      approval: activityLogs.filter((l) => l.category === 'APPROVAL_WORKFLOW').length,
      user: activityLogs.filter((l) => l.category === 'USER_CHANGE').length,
      master: activityLogs.filter((l) => l.category === 'MASTER_DATA').length,
    };
  }, [activityLogs]);

  const formatDateTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(d);
    } catch {
      return iso;
    }
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const headers = [
      'No',
      'Waktu Kejadian',
      'Kategori',
      'Kode Aksi',
      'Judul Aktivitas',
      'No. Referensi',
      'Pelaku (Actor)',
      'Username',
      'Role',
      'Rincian Jejak Audit',
    ];
    const rows = filteredLogs.map((l, idx) => [
      idx + 1,
      formatDateTime(l.timestamp),
      l.category,
      l.action,
      l.title,
      l.referenceNumber || '-',
      l.actorName,
      l.actorUsername || '-',
      l.actorRole.toUpperCase(),
      l.description,
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = [
      { wch: 5 },
      { wch: 22 },
      { wch: 20 },
      { wch: 24 },
      { wch: 34 },
      { wch: 18 },
      { wch: 22 },
      { wch: 15 },
      { wch: 16 },
      { wch: 65 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'System Activity Log');
    XLSX.writeFile(wb, `System_Activity_Log_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const getCategoryBadge = (cat: ActivityLogCategory) => {
    switch (cat) {
      case 'STOCK_ADJUSTMENT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
            <Boxes className="w-3 h-3 text-emerald-700" />
            <span>Penyesuaian Stok</span>
          </span>
        );
      case 'APPROVAL_WORKFLOW':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
            <FileCheck2 className="w-3 h-3 text-amber-700" />
            <span>Riwayat Approval (ACC)</span>
          </span>
        );
      case 'USER_CHANGE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-blue-100 text-blue-900 border border-blue-300">
            <UserCog className="w-3 h-3 text-blue-700" />
            <span>Perubahan Akun User</span>
          </span>
        );
      case 'MASTER_DATA':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-purple-100 text-purple-900 border border-purple-300">
            <Database className="w-3 h-3 text-purple-700" />
            <span>Master Cost Center / GL</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-slate-900 text-emerald-400 flex items-center justify-center shrink-0 shadow-xs">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-0.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>System Activity Log &amp; Audit Traceability</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Log Aktivitas Sistem &amp; Jejak Audit Terpadu
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl">
                Rekam jejak historis seluruh tindakan utama di sistem: penyesuaian stok fisik (LPB &amp; SIV), perubahan akun pengguna, pembaruan Cost Center/GL, serta riwayat persetujuan (ACC) dokumen.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors shadow-2xs"
              title="Unduh Log Aktivitas Sistem ke file Microsoft Excel (.xlsx) untuk keperluan audit"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Unduh Log Audit (Excel)</span>
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5 pt-5 border-t border-slate-100">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`p-3 rounded-xl border text-left transition-all ${
              selectedCategory === 'ALL'
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <div className="text-[11px] font-medium opacity-80">Total Aktivitas</div>
            <div className="text-xl font-black font-mono mt-0.5 tabular-nums">{counts.total}</div>
          </button>

          <button
            onClick={() => setSelectedCategory('STOCK_ADJUSTMENT')}
            className={`p-3 rounded-xl border text-left transition-all ${
              selectedCategory === 'STOCK_ADJUSTMENT'
                ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                : 'bg-emerald-50/70 text-emerald-950 border-emerald-200 hover:bg-emerald-100/70'
            }`}
          >
            <div className="text-[11px] font-semibold opacity-85 flex items-center gap-1">
              <Boxes className="w-3.5 h-3.5" />
              <span>Penyesuaian Stok</span>
            </div>
            <div className="text-xl font-black font-mono mt-0.5 tabular-nums">{counts.stock}</div>
          </button>

          <button
            onClick={() => setSelectedCategory('APPROVAL_WORKFLOW')}
            className={`p-3 rounded-xl border text-left transition-all ${
              selectedCategory === 'APPROVAL_WORKFLOW'
                ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                : 'bg-amber-50/70 text-amber-950 border-amber-200 hover:bg-amber-100/70'
            }`}
          >
            <div className="text-[11px] font-semibold opacity-85 flex items-center gap-1">
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Riwayat Approval</span>
            </div>
            <div className="text-xl font-black font-mono mt-0.5 tabular-nums">{counts.approval}</div>
          </button>

          <button
            onClick={() => setSelectedCategory('USER_CHANGE')}
            className={`p-3 rounded-xl border text-left transition-all ${
              selectedCategory === 'USER_CHANGE'
                ? 'bg-blue-700 text-white border-blue-700 shadow-xs'
                : 'bg-blue-50/70 text-blue-950 border-blue-200 hover:bg-blue-100/70'
            }`}
          >
            <div className="text-[11px] font-semibold opacity-85 flex items-center gap-1">
              <UserCog className="w-3.5 h-3.5" />
              <span>Perubahan User</span>
            </div>
            <div className="text-xl font-black font-mono mt-0.5 tabular-nums">{counts.user}</div>
          </button>

          <button
            onClick={() => setSelectedCategory('MASTER_DATA')}
            className={`p-3 rounded-xl border text-left transition-all ${
              selectedCategory === 'MASTER_DATA'
                ? 'bg-purple-700 text-white border-purple-700 shadow-xs'
                : 'bg-purple-50/70 text-purple-950 border-purple-200 hover:bg-purple-100/70'
            }`}
          >
            <div className="text-[11px] font-semibold opacity-85 flex items-center gap-1">
              <Database className="w-3.5 h-3.5" />
              <span>Cost Center / GL</span>
            </div>
            <div className="text-xl font-black font-mono mt-0.5 tabular-nums">{counts.master}</div>
          </button>
        </div>

        {/* Filter Bar */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-slate-600 font-medium">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Peran Pelaku:</span>
            </div>
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
              {(['ALL', 'admin', 'kepala_gudang', 'user'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    roleFilter === r
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {r === 'ALL'
                    ? 'Semua Role'
                    : r === 'admin'
                    ? 'Admin Gudang'
                    : r === 'kepala_gudang'
                    ? 'Kepala Gudang'
                    : 'Staf / Pemohon'}
                </button>
              ))}
            </div>
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari aktivitas, nomor dokumen, nama user..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-slate-900"
            />
          </div>
        </div>
      </div>

      {/* Activity Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase text-[11px] tracking-wider">
              <tr>
                <th className="px-4 py-3 w-44">Waktu Kejadian</th>
                <th className="px-4 py-3 w-44">Kategori Audit</th>
                <th className="px-4 py-3 w-36">No. Referensi</th>
                <th className="px-4 py-3">Rincian Aktivitas &amp; Perubahan</th>
                <th className="px-4 py-3 w-48">Pelaku (Actor)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                    Tidak ada catatan aktivitas yang cocok dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors align-top">
                    <td className="px-4 py-3.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{formatDateTime(log.timestamp)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {getCategoryBadge(log.category)}
                    </td>
                    <td className="px-4 py-3.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {log.referenceNumber ? (
                        <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px]">
                          {log.referenceNumber}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-900 text-xs">{log.title}</div>
                      <p className="text-slate-600 text-[11.5px] mt-0.5 leading-relaxed">
                        {log.description}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] text-white shrink-0 ${
                            log.actorRole === 'admin' ? 'bg-emerald-600' : 'bg-amber-600'
                          }`}
                        >
                          {log.actorName.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 leading-tight">
                            {log.actorName}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            @{log.actorUsername || 'user'} &middot;{' '}
                            <span
                              className={
                                log.actorRole === 'admin'
                                  ? 'text-emerald-700 font-bold'
                                  : 'text-amber-700 font-bold'
                              }
                            >
                              {log.actorRole.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
