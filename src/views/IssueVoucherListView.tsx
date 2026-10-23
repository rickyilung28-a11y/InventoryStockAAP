import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  IssueVoucherDocument,
  UserAccount,
  getEffectivePermissions,
} from '../types/inventory';
import {
  Search,
  Printer,
  Plus,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  XCircle,
  Lock,
  Edit3,
  Trash2,
  ChevronDown,
  ChevronUp,
  UserCheck,
  Building,
  Info,
  ScanBarcode,
  Calendar,
  RotateCcw,
  FileSpreadsheet,
  ShieldCheck,
  Ban,
} from 'lucide-react';

interface IssueVoucherListViewProps {
  currentUser: UserAccount;
  issueVouchers: IssueVoucherDocument[];
  onOpenCreateVoucher: () => void;
  onOpenEditVoucher: (voucher: IssueVoucherDocument) => void;
  onOpenApproval: (voucher: IssueVoucherDocument) => void;
  onDeleteVoucher: (voucherId: string) => void;
  onPrintVoucher: (doc: IssueVoucherDocument) => void;
}

export const IssueVoucherListView: React.FC<IssueVoucherListViewProps> = ({
  currentUser,
  issueVouchers,
  onOpenCreateVoucher,
  onOpenEditVoucher,
  onOpenApproval,
  onDeleteVoucher,
  onPrintVoucher,
}) => {
  const perms = getEffectivePermissions(currentUser);
  const isAdmin = perms.canValidateSIV;
  const isKepalaGudang = perms.canApproveSIVStockDeduction;
  const isRequesterUser = !perms.canViewAllSIV;

  const [activeTab, setActiveTab] = useState<
    'ALL' | 'PENDING' | 'WAITING_HANDOVER' | 'COMPLETED' | 'REJECTED'
  >('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filter Rentang Tanggal untuk melihat SIV apa saja yang diterbitkan
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // ATURAN AKSES: User tanpa hak canViewAllSIV hanya dapat melihat SIV yang diterbitkan oleh dirinya sendiri
  const roleVisibleVouchers = useMemo(() => {
    if (isRequesterUser) {
      return issueVouchers.filter(
        (v) =>
          v.userId === currentUser.id ||
          v.requestedBy.trim().toLowerCase() === currentUser.name.trim().toLowerCase()
      );
    }
    return issueVouchers;
  }, [issueVouchers, isRequesterUser, currentUser.id, currentUser.name]);

  // Helper untuk preset rentang tanggal cepat
  const applyDatePreset = (preset: 'ALL' | 'TODAY' | 'LAST_7_DAYS' | 'THIS_MONTH') => {
    if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
      return;
    }
    const now = new Date();
    const toYMD = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    if (preset === 'TODAY') {
      const todayStr = toYMD(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'LAST_7_DAYS') {
      const past = new Date(now);
      past.setDate(now.getDate() - 7);
      setStartDate(toYMD(past));
      setEndDate(toYMD(now));
    } else if (preset === 'THIS_MONTH') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(toYMD(firstDay));
      setEndDate(toYMD(now));
    }
  };

  // Filter berdasarkan rentang tanggal penerbitan SIV
  const dateFilteredVouchers = useMemo(() => {
    return roleVisibleVouchers.filter((v) => {
      if (!startDate && !endDate) return true;
      const docDateStr = v.requestDate || v.createdAt;
      const docDate = new Date(docDateStr);
      if (isNaN(docDate.getTime())) return true;

      if (startDate) {
        const start = new Date(`${startDate}T00:00:00`);
        if (docDate < start) return false;
      }
      if (endDate) {
        const end = new Date(`${endDate}T23:59:59.999`);
        if (docDate > end) return false;
      }
      return true;
    });
  }, [roleVisibleVouchers, startDate, endDate]);

  const pendingCount = dateFilteredVouchers.filter((v) => v.status === 'PENDING').length;
  const waitingHandoverCount = dateFilteredVouchers.filter((v) => v.status === 'APPROVED').length;
  const completedCount = dateFilteredVouchers.filter(
    (v) => v.status === 'HANDOVER_COMPLETED'
  ).length;
  const rejectedCount = dateFilteredVouchers.filter((v) => v.status === 'REJECTED').length;

  const filteredVouchers = useMemo(() => {
    return dateFilteredVouchers.filter((v) => {
      // Tab filter
      if (activeTab === 'PENDING' && v.status !== 'PENDING') return false;
      if (activeTab === 'WAITING_HANDOVER' && v.status !== 'APPROVED') return false;
      if (activeTab === 'COMPLETED' && v.status !== 'HANDOVER_COMPLETED') return false;
      if (activeTab === 'REJECTED' && v.status !== 'REJECTED') return false;

      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        v.voucherNumber.toLowerCase().includes(q) ||
        v.requestedBy.toLowerCase().includes(q) ||
        v.department.toLowerCase().includes(q) ||
        v.purpose.toLowerCase().includes(q) ||
        (v.recipientName && v.recipientName.toLowerCase().includes(q)) ||
        v.items.some(
          (i) => i.sku.toLowerCase().includes(q) || i.itemName.toLowerCase().includes(q)
        )
      );
    });
  }, [dateFilteredVouchers, activeTab, searchQuery]);

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(d);
    } catch {
      return iso;
    }
  };

  const formatDateTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
    } catch {
      return iso;
    }
  };

  // Unduh Rekap SIV dalam format Excel (.xlsx)
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const headerRows = [
      ['REKAPITULASI NOTA PENGAMBILAN BARANG (STORE ISSUE VOUCHER / SIV)'],
      [
        `Periode Terbit: ${
          startDate || endDate
            ? `${startDate || 'Awal'} s/d ${endDate || 'Sekarang'}`
            : 'Semua Tanggal'
        } | Pemohon: ${isRequesterUser ? currentUser.name : 'Semua Pemohon'}`,
      ],
      [],
      [
        'No',
        'No. Nota SIV',
        'Tanggal Terbit',
        'Pemohon (Disetujui Permintaan)',
        'Departemen / Divisi',
        'Keperluan',
        'Status SIV',
        'Disetujui Kepala Gudang',
        'Waktu ACC SIV',
        'Diserahkan Admin Gudang',
        'Diterima Oleh (Penerima)',
        'Waktu Penyerahan',
        'Material Code',
        'Nama Barang',
        'Qty Diminta',
        'Qty Dikeluarkan',
        'Satuan',
        'Cost Center',
        'GL Account',
      ],
    ];

    const dataRows: (string | number)[][] = [];
    let rowIdx = 1;

    filteredVouchers.forEach((v) => {
      const statusLabel =
        v.status === 'PENDING'
          ? 'Menunggu ACC & Validasi Admin Gudang'
          : v.status === 'APPROVED'
          ? 'Di-ACC Admin Gudang (Terkunci · Menunggu Verifikasi Kepala Gudang)'
          : v.status === 'HANDOVER_COMPLETED'
          ? 'Terverifikasi Kepala Gudang (Stok Resmi Keluar)'
          : 'Ditolak';

      v.items.forEach((item) => {
        const issuedVal =
          v.status === 'HANDOVER_COMPLETED' || v.status === 'APPROVED'
            ? item.isCancelled
              ? 0
              : item.issuedQty ?? item.requestedQty
            : 0;

        dataRows.push([
          rowIdx++,
          v.voucherNumber,
          formatDate(v.requestDate),
          v.approvedByRequester || v.requestedBy,
          v.department,
          v.purpose,
          statusLabel,
          v.warehouseHeadName || v.approvedByWarehouseHead || '-',
          v.headApprovedAt ? formatDateTime(v.headApprovedAt) : '-',
          v.handoverOfficer || v.approvedByAdmin || '-',
          v.recipientName || '-',
          v.handoverAt ? formatDateTime(v.handoverAt) : '-',
          item.sku,
          item.itemName,
          item.requestedQty,
          issuedVal,
          item.unit,
          item.costCenter || v.costCenter || '-',
          item.glAccount || item.glAcc || v.glAccount || '-',
        ]);
      });
    });

    const ws = XLSX.utils.aoa_to_sheet([...headerRows, ...dataRows]);
    ws['!cols'] = [
      { wch: 5 },
      { wch: 18 },
      { wch: 15 },
      { wch: 22 },
      { wch: 22 },
      { wch: 30 },
      { wch: 28 },
      { wch: 22 },
      { wch: 18 },
      { wch: 22 },
      { wch: 22 },
      { wch: 18 },
      { wch: 16 },
      { wch: 32 },
      { wch: 12 },
      { wch: 15 },
      { wch: 10 },
      { wch: 12 },
      { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Daftar SIV');
    const suffix =
      startDate || endDate
        ? `${startDate || 'Awal'}_sd_${endDate || 'Akhir'}`
        : new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Rekap_SIV_${suffix}.xlsx`);
  };

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-700 mb-1">
              <ArrowUpRight className="w-4 h-4" />
              <span>Outbound / Nota Pengeluaran Stok</span>
              {isRequesterUser && (
                <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 normal-case font-semibold">
                  Akses Pemohon: Hanya SIV Milik {currentUser.name}
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Nota Pengambilan Barang (Store Issue Voucher / SIV)
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl">
              {isRequesterUser
                ? `Menampilkan daftar Nota Pengambilan Barang (SIV) yang diterbitkan oleh Anda (${currentUser.name}). SIV dapat diedit atau dihapus selama belum diverifikasi/di-ACC oleh Admin Gudang.`
                : 'Pemisahan Wewenang SIV: (1) Pemohon menerbitkan SIV (bisa diedit/dihapus sebelum di-ACC Admin), (2) User Admin Gudang hanya meng-ACC SIV & validasi/scan barcode barang + qty diserahkan (SIV terkunci, stok belum berubah), (3) User Kepala Gudang meng-approve pengurangan stock (otomatis memotong stock sistem).'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors shadow-2xs"
              title="Unduh daftar SIV sesuai filter rentang tanggal ke file Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Unduh Excel (.xlsx)</span>
            </button>

            <button
              onClick={onOpenCreateVoucher}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs shrink-0"
            >
              <Plus className="w-4 h-4 text-amber-400" />
              Buat Nota Pengambilan Baru
            </button>
          </div>
        </div>

        {/* Filter Rentang Tanggal Penerbitan SIV */}
        <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-amber-600" />
              <span>Filter Rentang Tanggal SIV Diterbitkan:</span>
            </span>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-300">
                <span className="text-slate-500 font-medium">Dari:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-xs font-mono text-slate-900 focus:outline-hidden"
                />
              </div>

              <span className="text-slate-400 font-bold">s/d</span>

              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-300">
                <span className="text-slate-500 font-medium">Sampai:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="text-xs font-mono text-slate-900 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => applyDatePreset('TODAY')}
                className="px-2 py-1 rounded-md bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-medium transition-colors"
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('LAST_7_DAYS')}
                className="px-2 py-1 rounded-md bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-medium transition-colors"
              >
                7 Hari Terakhir
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('THIS_MONTH')}
                className="px-2 py-1 rounded-md bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-medium transition-colors"
              >
                Bulan Ini
              </button>
              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => applyDatePreset('ALL')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[11px] font-semibold transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Tanggal</span>
                </button>
              )}
            </div>
          </div>

          <div className="text-[11px] text-slate-600 font-mono shrink-0">
            Ditemukan <strong>{filteredVouchers.length}</strong> Nota SIV
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg text-xs overflow-x-auto">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1.5 font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'ALL'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua SIV ({dateFilteredVouchers.length})
            </button>

            <button
              onClick={() => setActiveTab('PENDING')}
              className={`px-3 py-1.5 font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'PENDING'
                  ? 'bg-white text-amber-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              Menunggu ACC Admin Gudang ({pendingCount})
            </button>

            <button
              onClick={() => setActiveTab('WAITING_HANDOVER')}
              className={`px-3 py-1.5 font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'WAITING_HANDOVER'
                  ? 'bg-white text-blue-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              Terkunci · Menunggu Verifikasi Kepala Gudang ({waitingHandoverCount})
            </button>

            <button
              onClick={() => setActiveTab('COMPLETED')}
              className={`px-3 py-1.5 font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'COMPLETED'
                  ? 'bg-white text-emerald-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Terverifikasi Kepala Gudang / Selesai ({completedCount})
            </button>

            <button
              onClick={() => setActiveTab('REJECTED')}
              className={`px-3 py-1.5 font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'REJECTED'
                  ? 'bg-white text-red-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <XCircle className="w-3.5 h-3.5 text-red-500" />
              Ditolak ({rejectedCount})
            </button>
          </div>

          {/* Search Input */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari No. SIV, barang, tujuan..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-slate-900 focus:bg-white focus:outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* Rules Notice Box */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 flex items-start gap-2">
        <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Prosedur Resmi Penerbitan SIV:</strong> (1) <strong>User Pemohon</strong> menerbitkan SIV (bisa diedit atau dihapus apabila Admin Gudang belum memverifikasi/approve SIV; pemohon hanya dapat melihat SIV miliknya sendiri). (2){' '}
          <strong>User Admin Gudang</strong> meng-ACC SIV dan memvalidasi barang (scan barcode) serta qty barang yang diserahkan &mdash; <strong>SIV terkunci</strong> (user pemohon tidak bisa hapus maupun edit), <strong>tetapi stock belum berubah</strong>. (3){' '}
          <strong>User Kepala Gudang</strong> memverifikasi pengeluaran stock yang dilakukan Admin Gudang dan <strong>otomatis mempengaruhi (memotong) stock</strong>.
        </p>
      </div>

      {/* Voucher List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        {filteredVouchers.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            Tidak ada nota pengambilan barang (SIV) yang sesuai dengan filter atau rentang tanggal.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredVouchers.map((voucher) => {
              const isExpanded = expandedId === voucher.id;
              const isPending = voucher.status === 'PENDING';
              const isWaitingHeadVerify = voucher.status === 'APPROVED';
              const isCompleted = voucher.status === 'HANDOVER_COMPLETED';
              const isRejected = voucher.status === 'REJECTED';
              const isLocked = isWaitingHeadVerify || isCompleted;

              const totalRequested = voucher.items.reduce((a, b) => a + b.requestedQty, 0);
              const totalIssued = voucher.items.reduce(
                (a, b) =>
                  a +
                  (isCompleted || isWaitingHeadVerify
                    ? b.isCancelled
                      ? 0
                      : b.issuedQty ?? b.requestedQty
                    : 0),
                0
              );

              return (
                <div key={voucher.id} className="transition-colors hover:bg-slate-50/50">
                  <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Voucher Details */}
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                          {voucher.voucherNumber}
                        </span>
                        <span className="text-slate-300">·</span>

                        {isPending && (
                          <span className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            Tahap 1: Menunggu ACC &amp; Validasi Barang oleh Admin Gudang (Bisa Edit/Hapus)
                          </span>
                        )}
                        {isWaitingHeadVerify && (
                          <span className="text-xs font-semibold text-blue-700 flex items-center gap-1">
                            <Lock className="w-3.5 h-3.5" />
                            Tahap 2: Di-ACC &amp; Divalidasi Admin Gudang (SIV Terkunci · Stok Belum Berubah) &mdash; Menunggu Verifikasi Kepala Gudang
                          </span>
                        )}
                        {isCompleted && (
                          <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Tahap 3 Selesai: Pengeluaran Stock Diverifikasi Kepala Gudang (Stok Resmi Terpotong)
                          </span>
                        )}
                        {isRejected && (
                          <span className="text-xs font-semibold text-red-700 flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" />
                            Ditolak
                          </span>
                        )}
                      </div>

                      {/* Purpose */}
                      <p className="text-xs font-semibold text-slate-900">{voucher.purpose}</p>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1 text-slate-700">
                          <Building className="w-3.5 h-3.5 text-slate-400" />
                          {voucher.department} (Pemohon: {voucher.requestedBy})
                        </span>
                        <span>·</span>
                        <span>Tgl Terbit: {formatDate(voucher.requestDate)}</span>
                        <span>·</span>
                        <span className="font-mono tabular-nums">
                          Diminta: {totalRequested} unit ({voucher.items.length} item)
                          {(isWaitingHeadVerify || isCompleted) &&
                            ` | Diserahkan: ${totalIssued} unit`}
                        </span>

                        {voucher.handoverAt && (
                          <>
                            <span>·</span>
                            <span className="text-blue-700 font-medium">
                              ACC &amp; Validasi Admin: {voucher.handoverOfficer || voucher.approvedByAdmin} &rarr; Penerima:{' '}
                              {voucher.recipientName} ({formatDateTime(voucher.handoverAt)})
                            </span>
                          </>
                        )}

                        {isCompleted && (voucher.warehouseHeadName || voucher.approvedByWarehouseHead) && (
                          <>
                            <span>·</span>
                            <span className="text-emerald-700 font-medium">
                              Verifikasi Kepala Gudang: {voucher.warehouseHeadName || voucher.approvedByWarehouseHead} (
                              {voucher.headApprovedAt ? formatDateTime(voucher.headApprovedAt) : 'Terverifikasi'})
                            </span>
                          </>
                        )}
                      </div>

                      {isRejected && voucher.rejectionReason && (
                        <div className="text-xs text-red-700 bg-red-50 p-2 rounded border border-red-200">
                          <strong>Alasan Ditolak:</strong> {voucher.rejectionReason}
                        </div>
                      )}
                    </div>

                    {/* Actions Group */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {/* Print & PDF Button */}
                      <button
                        onClick={() => onPrintVoucher(voucher)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:border-slate-400 transition-colors shadow-2xs"
                        title="Cetak atau Unduh Dokumen Nota Pengambilan Barang (PDF)"
                      >
                        <Printer className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Cetak / Unduh PDF</span>
                      </button>

                      {/* Tahap 2: User Admin Gudang HANYA meng-ACC SIV & Validasi/Scan Barang */}
                      {isAdmin && isPending && (
                        <button
                          onClick={() => onOpenApproval(voucher)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors shadow-2xs"
                        >
                          <ScanBarcode className="w-3.5 h-3.5" />
                          <span>ACC SIV &amp; Validasi/Scan Barang (Admin Gudang)</span>
                        </button>
                      )}

                      {isKepalaGudang && isPending && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          <span>Menunggu ACC &amp; Scan Barang (Admin Gudang)</span>
                        </span>
                      )}

                      {/* Tahap 3: User Kepala Gudang Approve Pengurangan Stock */}
                      {isKepalaGudang && isWaitingHeadVerify && (
                        <button
                          onClick={() => onOpenApproval(voucher)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors shadow-2xs"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Approve Pengurangan Stock (Kepala Gudang)</span>
                        </button>
                      )}

                      {isAdmin && isWaitingHeadVerify && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-200 rounded-lg">
                          <Lock className="w-3.5 h-3.5 text-blue-600" />
                          <span>Telah Di-ACC &amp; Scan · Menunggu Approve Pengurangan Stock (Kepala Gudang)</span>
                        </span>
                      )}

                      {/* Edit Button */}
                      {isLocked ? (
                        <button
                          onClick={() => onOpenEditVoucher(voucher)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition-colors"
                          title="SIV telah di-ACC Admin Gudang dan terkunci (hanya baca)"
                        >
                          <Lock className="w-3.5 h-3.5 text-slate-500" />
                          <span>Terkunci</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => onOpenEditVoucher(voucher)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
                          title="Edit item, tambah barang, atau hapus barang pada nota (sebelum di-ACC Admin Gudang)"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                          <span>Edit Item</span>
                        </button>
                      )}

                      {/* Delete Button */}
                      {isLocked ? (
                        <button
                          disabled
                          className="p-1.5 text-slate-300 bg-slate-100 rounded-lg cursor-not-allowed border border-slate-200"
                          title="SIV sudah di-ACC Admin Gudang & terkunci. User pemohon tidak dapat menghapus!"
                        >
                          <Lock className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            if (
                              window.confirm(
                                `Batalkan dan hapus nota #${voucher.voucherNumber}?`
                              )
                            ) {
                              onDeleteVoucher(voucher.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors border border-transparent hover:border-red-200"
                          title="Hapus / Batalkan Nota (sebelum di-ACC Admin Gudang)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}

                      {/* Expand / Details */}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : voucher.id)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                        title={isExpanded ? 'Tutup rincian' : 'Lihat rincian item'}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Item Details */}
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-1 bg-slate-50/70 border-t border-slate-100">
                      <div className="border border-slate-200 rounded-lg overflow-x-auto bg-white">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                            <tr>
                              <th className="px-3 py-2 text-center w-10">No</th>
                              <th className="px-3 py-2">Material Code</th>
                              <th className="px-3 py-2">Nama Barang</th>
                              <th className="px-3 py-2 text-right">Qty Diminta</th>
                              <th className="px-3 py-2 text-right">Qty Diserahkan (Validasi Admin)</th>
                              <th className="px-3 py-2 text-center">Validasi Barcode &amp; Status Stok</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {voucher.items.map((item, idx) => {
                              const actualQty =
                                isCompleted || isWaitingHeadVerify
                                  ? item.isCancelled
                                    ? 0
                                    : item.issuedQty ?? item.requestedQty
                                  : 0;
                              const isCancelledItem =
                                (isCompleted || isWaitingHeadVerify) &&
                                (item.isCancelled || actualQty === 0);

                              return (
                                <tr
                                  key={idx}
                                  className={isCancelledItem ? 'bg-red-50/40 text-slate-400' : ''}
                                >
                                  <td className="px-3 py-2 text-center tabular-nums text-slate-500">
                                    {idx + 1}
                                  </td>
                                  <td className="px-3 py-2 font-mono text-slate-700">{item.sku}</td>
                                  <td className="px-3 py-2 font-medium text-slate-900">
                                    <span className={isCancelledItem ? 'line-through text-slate-400' : ''}>
                                      {item.itemName}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono font-medium text-slate-900 tabular-nums">
                                    {item.requestedQty} {item.unit}
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono font-bold tabular-nums">
                                    {isCompleted || isWaitingHeadVerify ? (
                                      isCancelledItem ? (
                                        <span className="text-red-600">0 {item.unit} (Batal Keluar)</span>
                                      ) : isCompleted ? (
                                        <span className="text-emerald-700">
                                          -{actualQty} {item.unit} (Stok Terpotong)
                                        </span>
                                      ) : (
                                        <span className="text-blue-700">
                                          {actualQty} {item.unit} (Stok Belum Berubah)
                                        </span>
                                      )
                                    ) : (
                                      <span className="text-slate-400">0 (Belum Divalidasi Admin)</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    {isCompleted ? (
                                      isCancelledItem ? (
                                        <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                                          <Ban className="w-3 h-3" />
                                          Tidak Jadi Dikeluarkan (Tidak Masuk PDF)
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                                          <CheckCircle2 className="w-3 h-3" />
                                          Terverifikasi Kepala Gudang &amp; Stok Dipotong
                                        </span>
                                      )
                                    ) : isWaitingHeadVerify ? (
                                      isCancelledItem ? (
                                        <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                                          <Ban className="w-3 h-3" />
                                          Tidak Jadi Dikeluarkan (Qty 0)
                                        </span>
                                      ) : (
                                        <span className="text-blue-700 font-semibold">
                                          Barcode Tervalidasi Admin &middot; Menunggu Verifikasi Kepala Gudang
                                        </span>
                                      )
                                    ) : (
                                      <span className="text-amber-700 font-medium">
                                        Menunggu ACC &amp; Scan Barcode Admin Gudang
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Signature & Audit Summary Box */}
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs bg-white p-3 rounded-lg border border-slate-200">
                        <div>
                          <span className="text-slate-500 block text-[10.5px]">
                            Permintaan - Diterima Oleh (Penerima):
                          </span>
                          <span className="font-semibold text-slate-900">
                            {voucher.recipientName || '(Diinput saat penyerahan)'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10.5px]">
                            Permintaan - Disetujui (Penerbit SIV):
                          </span>
                          <span className="font-semibold text-slate-900">
                            {voucher.approvedByRequester || voucher.requestedBy}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10.5px]">
                            Penyerahan - Diserahkan (User ACC SIV):
                          </span>
                          <span className="font-semibold text-slate-900">
                            {voucher.handoverOfficer || voucher.approvedByAdmin || '-'}
                          </span>
                          {voucher.handoverAt && (
                            <span className="block text-[10px] font-mono text-emerald-700">
                              TTD Digital: {formatDateTime(voucher.handoverAt)}
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10.5px]">
                            Penyerahan - Disetujui (Kepala Gudang):
                          </span>
                          <span className="font-semibold text-slate-900">
                            {voucher.warehouseHeadName || '-'}
                          </span>
                          {voucher.headApprovedAt && (
                            <span className="block text-[10px] font-mono text-blue-700">
                              TTD Digital: {formatDateTime(voucher.headApprovedAt)}
                            </span>
                          )}
                        </div>
                      </div>

                      {voucher.notes && (
                        <p className="mt-2 text-xs text-slate-600">
                          <strong>Catatan Tambahan:</strong> {voucher.notes}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
