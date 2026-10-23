import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  StockItem,
  LPBDocument,
  IssueVoucherDocument,
  StockMovement,
  UserAccount,
  getEffectivePermissions,
  getRoleLabel,
} from '../types/inventory';
import { useInventory } from '../context/InventoryContext';
import {
  Boxes,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  Printer,
  UserCheck,
  CheckCircle2,
  ChevronRight,
  Shield,
  Layers,
  Users,
  Eye,
  TrendingDown,
  ShieldCheck,
  ShieldAlert,
  Search,
  MapPin,
  Filter,
  BellRing,
  ShoppingCart,
} from 'lucide-react';
import { AnnouncementSlider } from '../components/AnnouncementSlider';

interface DashboardViewProps {
  currentUser: UserAccount;
  stockItems: StockItem[];
  lpbDocuments: LPBDocument[];
  issueVouchers: IssueVoucherDocument[];
  stockMovements: StockMovement[];
  onOpenCreateLPB: () => void;
  onOpenCreateVoucher: () => void;
  onOpenApproval: (voucher: IssueVoucherDocument) => void;
  onPrintDocument: (type: 'LPB' | 'NPB', doc: LPBDocument | IssueVoucherDocument) => void;
  onNavigateTab: (tab: string) => void;
}

type StockHealthFilter = 'ALL' | 'SAFE' | 'WARNING' | 'CRITICAL';

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentUser,
  stockItems,
  lpbDocuments,
  issueVouchers,
  stockMovements,
  onOpenCreateLPB,
  onOpenCreateVoucher,
  onOpenApproval,
  onPrintDocument,
  onNavigateTab,
}) => {
  const perms = getEffectivePermissions(currentUser);
  const isAdmin = perms.canValidateSIV || perms.canCreateLPB;
  const isKepalaGudang = perms.canApproveSIVStockDeduction || perms.canApproveLPBStockAddition;
  const isWarehouseOfficer = isAdmin || isKepalaGudang;
  const isRequesterUser = !perms.canViewAllSIV;
  const isViewerOnly =
    currentUser.role === 'viewer' &&
    !perms.canCreateSIV &&
    !perms.canCreateLPB &&
    !perms.canValidateSIV;

  // State untuk Filter Status Stok di Dashboard (Aman, Menipis, Kritis)
  const [stockHealthFilter, setStockHealthFilter] = useState<StockHealthFilter>('ALL');
  const [stockSearchQuery, setStockSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // User tanpa canViewAllSIV hanya dapat melihat SIV yang diterbitkan oleh dirinya sendiri
  const visibleVouchers = isRequesterUser
    ? issueVouchers.filter(
        (v) =>
          v.userId === currentUser.id ||
          v.requestedBy.trim().toLowerCase() === currentUser.name.trim().toLowerCase()
      )
    : issueVouchers;

  // Evaluasi kategori kesehatan stok untuk setiap barang:
  // - CRITICAL (Stok Kritis / Melampaui Stock Minimal): currentStock <= minStock
  // - WARNING (Stok Menipis / Mendekati Stock Minimal): currentStock > minStock && currentStock <= minStock + buffer
  // - SAFE (Stok Aman / Jauh dari Stock Minimal): currentStock > minStock + buffer
  const evaluatedStockItems = useMemo(() => {
    return stockItems.map((item) => {
      const buffer = Math.max(3, Math.round(item.minStock * 0.35));
      const warningThreshold = item.minStock + buffer;
      const isCritical = item.currentStock <= item.minStock;
      const isWarning = !isCritical && item.currentStock <= warningThreshold;
      const isSafe = !isCritical && !isWarning;
      const diffFromMin = item.currentStock - item.minStock;
      const availableStock = Math.max(0, item.currentStock - item.allocatedStock);

      const healthStatus: 'SAFE' | 'WARNING' | 'CRITICAL' = isCritical
        ? 'CRITICAL'
        : isWarning
        ? 'WARNING'
        : 'SAFE';

      return {
        ...item,
        buffer,
        warningThreshold,
        isCritical,
        isWarning,
        isSafe,
        diffFromMin,
        availableStock,
        healthStatus,
      };
    });
  }, [stockItems]);

  const safeStockItems = useMemo(
    () => evaluatedStockItems.filter((i) => i.isSafe),
    [evaluatedStockItems]
  );
  const warningStockItems = useMemo(
    () => evaluatedStockItems.filter((i) => i.isWarning),
    [evaluatedStockItems]
  );
  const criticalStockItems = useMemo(
    () => evaluatedStockItems.filter((i) => i.isCritical),
    [evaluatedStockItems]
  );

  const { showCustomToast } = useInventory();
  const stockHealthPanelRef = useRef<HTMLDivElement | null>(null);
  const lastAlertSignatureRef = useRef<string>('');

  const triggerMinStockReminderToast = useCallback(() => {
    const criticalCount = criticalStockItems.length;
    const warningCount = warningStockItems.length;
    if (criticalCount === 0 && warningCount === 0) return;

    const combinedPreview = [
      ...criticalStockItems.map((item) => ({
        sku: item.sku,
        name: item.name,
        currentStock: item.currentStock,
        minStock: item.minStock,
        unit: item.unit,
        status: 'CRITICAL' as const,
      })),
      ...warningStockItems.map((item) => ({
        sku: item.sku,
        name: item.name,
        currentStock: item.currentStock,
        minStock: item.minStock,
        unit: item.unit,
        status: 'WARNING' as const,
      })),
    ];

    const title =
      criticalCount > 0 && warningCount > 0
        ? `Pengingat Otomatis: ${criticalCount} Stok Kritis & ${warningCount} Mendekati Min Stock!`
        : criticalCount > 0
        ? `Pengingat Otomatis: ${criticalCount} Barang di Bawah Batas Minimum (Min Stock)!`
        : `Pengingat Otomatis: ${warningCount} Barang Mendekati Batas Minimum (Min Stock)!`;

    const message =
      criticalCount > 0
        ? `Perhatian Admin Store: Terdapat ${criticalCount} barang yang sudah berada pada atau di bawah batas minimum${
            warningCount > 0 ? ` serta ${warningCount} barang mendekati batas minimum` : ''
          }. Segera ajukan pemesanan baru (Purchase Order / Reorder) agar operasional tidak terhambat.`
        : `Perhatian Admin Store: Terdapat ${warningCount} barang yang stok fisiknya sudah menipis mendekati batas minimum (Min Stock). Segera siapkan pengajuan pemesanan baru.`;

    showCustomToast({
      type: criticalCount > 0 ? 'error' : 'warning',
      title,
      message,
      itemsPreview: combinedPreview,
      actionLabel:
        criticalCount > 0
          ? `Cek ${criticalCount} Stok Kritis (Order Baru)`
          : `Cek ${warningCount} Stok Menipis (Order Baru)`,
      onAction: () => {
        setStockHealthFilter(criticalCount > 0 ? 'CRITICAL' : 'WARNING');
        stockHealthPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
      secondaryActionLabel: perms.canCreateLPB ? 'Input Penerimaan (LPB)' : 'Kelola Min Stock',
      onSecondaryAction: () => {
        if (perms.canCreateLPB) {
          onOpenCreateLPB();
        } else {
          onNavigateTab('min-stock');
        }
      },
      durationMs: 14000,
    });
  }, [
    criticalStockItems,
    warningStockItems,
    showCustomToast,
    perms.canCreateLPB,
    onOpenCreateLPB,
    onNavigateTab,
  ]);

  // Sistem Pengingat Otomatis (Toast Notification) saat membuka Dashboard atau saat stok turun mendekati / di bawah Min Stock
  useEffect(() => {
    const criticalCount = criticalStockItems.length;
    const warningCount = warningStockItems.length;
    if (criticalCount === 0 && warningCount === 0) {
      lastAlertSignatureRef.current = '';
      return;
    }

    const currentSignature = `${currentUser.id}::${criticalStockItems
      .map((i) => `${i.id}:${i.currentStock}:${i.minStock}`)
      .join(',')}||${warningStockItems
      .map((i) => `${i.id}:${i.currentStock}:${i.minStock}`)
      .join(',')}`;

    if (lastAlertSignatureRef.current === currentSignature) return;
    lastAlertSignatureRef.current = currentSignature;

    const timer = setTimeout(() => {
      triggerMinStockReminderToast();
    }, 550);

    return () => clearTimeout(timer);
  }, [criticalStockItems, warningStockItems, currentUser.id, triggerMinStockReminderToast]);

  const categories = useMemo(() => {
    const set = new Set(stockItems.map((i) => i.category));
    return ['ALL', ...Array.from(set)];
  }, [stockItems]);

  const filteredDashboardStock = useMemo(() => {
    return evaluatedStockItems.filter((item) => {
      if (stockHealthFilter === 'SAFE' && !item.isSafe) return false;
      if (stockHealthFilter === 'WARNING' && !item.isWarning) return false;
      if (stockHealthFilter === 'CRITICAL' && !item.isCritical) return false;

      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return false;

      if (stockSearchQuery.trim()) {
        const q = stockSearchQuery.toLowerCase();
        return (
          item.sku.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          (item.location && item.location.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [evaluatedStockItems, stockHealthFilter, selectedCategory, stockSearchQuery]);

  // Metrics
  const totalSKU = stockItems.length;
  const pendingVouchers = visibleVouchers.filter(
    (v) => v.status === 'PENDING' || v.status === 'APPROVED'
  );
  const completedVouchers = visibleVouchers.filter((v) => v.status === 'HANDOVER_COMPLETED');
  const totalPhysicalStock = stockItems.reduce((acc, i) => acc + i.currentStock, 0);

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

  return (
    <div className="space-y-6">
      {/* Welcome & Role Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              <span>Gudang Manufaktur &amp; Distribusi</span>
              <span aria-hidden="true">·</span>
              <span
                className={
                  currentUser.role === 'superuser'
                    ? 'text-purple-700 font-bold'
                    : currentUser.role === 'kepala_gudang'
                    ? 'text-blue-700 font-bold'
                    : currentUser.role === 'admin'
                    ? 'text-emerald-700 font-bold'
                    : currentUser.role === 'user'
                    ? 'text-amber-700 font-bold'
                    : 'text-slate-600 font-bold'
                }
              >
                {getRoleLabel(currentUser.role)} ({currentUser.department})
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Selamat datang, {currentUser.name}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl">
              {currentUser.role === 'superuser'
                ? 'Level 0 Super User: Anda memiliki akses penuh ke seluruh modul sistem, persetujuan LPB/SIV/Stok Minimal, log audit, serta pengelolaan seluruh akun dan hak akses.'
                : currentUser.role === 'kepala_gudang'
                ? 'Level 1 Kepala Gudang: Wewenang ACC SIV & pengurangan stok, ACC LPB & penambahan stok, ACC & perubahan stok minimal di sistem, tambah Cost Center/GL, mutasi barang, serta kelola user & hak akses level di bawahnya.'
                : currentUser.role === 'admin'
                ? 'Level 2 Admin Gudang: Wewenang melihat & ACC/validasi SIV, input LPB, tambah barang baru & Cost Center/GL, verifikasi pengajuan stok minimal, mutasi barang, serta kelola user & hak akses level di bawahnya (Pemohon & View).'
                : isViewerOnly
                ? 'Level 4 View: Akun Anda berstatus Read-Only dan hanya dapat melihat posisi stok gudang tanpa akses penerbitan SIV atau perubahan data.'
                : `Level 3 Pemohon: Anda dapat menerbitkan SIV, melihat stok, melihat riwayat SIV milik Anda (${currentUser.name}), serta membantu Departemen Store melakukan Stock Opname (setelah Stock Opname dimulai & stok akhir ter-lock).`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {perms.canManageLowerUsers && (
              <button
                onClick={() => onNavigateTab('users')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors shadow-2xs"
              >
                <Users className="w-4 h-4 text-emerald-600" />
                Kelola User &amp; Hak Akses
              </button>
            )}

            {(perms.canPerformStockOpname || currentUser.role === 'user') && (
              <button
                onClick={() => onNavigateTab('opname')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 hover:text-slate-950 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition-colors shadow-2xs"
              >
                <Shield className="w-4 h-4 text-amber-700" />
                Stock Opname Store
              </button>
            )}

            {perms.canCreateLPB && (
              <button
                onClick={onOpenCreateLPB}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs"
              >
                <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
                Input SJ Supplier (LPB)
              </button>
            )}

            {perms.canCreateSIV ? (
              <button
                onClick={onOpenCreateVoucher}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-lg transition-colors shadow-xs"
              >
                <ArrowUpRight className="w-4 h-4" />
                Buat Nota Pengambilan (SIV)
              </button>
            ) : (
              <button
                onClick={() => onNavigateTab('items')}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs"
              >
                <Eye className="w-4 h-4 text-emerald-400" />
                Lihat Katalog Master Stok
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Announcement & SOP Carousel Slider */}
      <AnnouncementSlider
        isAdmin={isWarehouseOfficer}
        onOpenCreateLPB={onOpenCreateLPB}
        onOpenCreateVoucher={onOpenCreateVoucher}
        onNavigateTab={onNavigateTab}
        pendingCount={pendingVouchers.length}
        lowStockCount={criticalStockItems.length}
      />

      {/* =================================================================== */}
      {/* PANEL DASHBOARD FILTER STATUS STOK: AMAN, MENIPIS & KRITIS          */}
      {/* =================================================================== */}
      <div
        ref={stockHealthPanelRef}
        id="dashboard-stock-health-panel"
        className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs space-y-5"
      >
        {/* Banner Pengingat Otomatis Pemesanan Baru (Muncul jika ada barang mendekati atau di bawah Min Stock) */}
        {(criticalStockItems.length > 0 || warningStockItems.length > 0) && (
          <div
            className={`rounded-xl border p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 ${
              criticalStockItems.length > 0
                ? 'bg-red-50 border-red-200 text-red-950'
                : 'bg-amber-50 border-amber-200 text-amber-950'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                  criticalStockItems.length > 0
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'bg-amber-500 text-slate-950 shadow-xs'
                }`}
              >
                <BellRing className="w-5 h-5 animate-bounce" />
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${
                      criticalStockItems.length > 0
                        ? 'bg-red-600 text-white'
                        : 'bg-amber-500 text-slate-950'
                    }`}
                  >
                    Pengingat Otomatis Reorder Store
                  </span>
                  <h3 className="font-bold text-sm">
                    {criticalStockItems.length > 0 && warningStockItems.length > 0
                      ? `${criticalStockItems.length} Barang di Bawah Min Stock & ${warningStockItems.length} Barang Mendekati Min Stock`
                      : criticalStockItems.length > 0
                      ? `${criticalStockItems.length} Barang Berada pada / di Bawah Batas Minimum (Min Stock)`
                      : `${warningStockItems.length} Barang Mendekati Batas Minimum (Min Stock)`}
                  </h3>
                </div>
                <p className="text-xs opacity-90 leading-relaxed">
                  Admin Store disarankan untuk segera mengajukan <strong>pemesanan baru (Purchase Order / Reorder)</strong> pada item berikut:{' '}
                  <span className="font-mono font-bold">
                    {[...criticalStockItems, ...warningStockItems]
                      .slice(0, 4)
                      .map((i) => `${i.name} (${i.currentStock}/${i.minStock} ${i.unit})`)
                      .join(', ')}
                    {criticalStockItems.length + warningStockItems.length > 4
                      ? ` +${criticalStockItems.length + warningStockItems.length - 4} lainnya`
                      : ''}
                  </span>
                  .
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() =>
                  setStockHealthFilter(criticalStockItems.length > 0 ? 'CRITICAL' : 'WARNING')
                }
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors shadow-2xs cursor-pointer ${
                  criticalStockItems.length > 0
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                }`}
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Filter Barang Perlu Dipesan</span>
              </button>

              <button
                type="button"
                onClick={triggerMinStockReminderToast}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 transition-colors cursor-pointer"
                title="Tampilkan kembali notifikasi popup pengingat stok minimum"
              >
                <BellRing className="w-3.5 h-3.5 text-amber-600" />
                <span>Tampilkan Toast Pengingat</span>
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700 mb-0.5">
              <Boxes className="w-4 h-4 text-emerald-600" />
              <span>Monitor &amp; Filter Kesehatan Stok Gudang Real-Time</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Filter Stok Aman, Stok Menipis &amp; Stok Kritis terhadap Batas Stok Minimal
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Klik salah satu kartu status di bawah untuk memfilter daftar barang berdasarkan posisinya terhadap batas stok minimal (Safety Stock).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {(criticalStockItems.length > 0 || warningStockItems.length > 0) && (
              <button
                type="button"
                onClick={triggerMinStockReminderToast}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition-colors cursor-pointer"
              >
                <BellRing className="w-3.5 h-3.5 text-amber-700" />
                <span>Cek Toast Pengingat ({criticalStockItems.length + warningStockItems.length})</span>
              </button>
            )}
            {(perms.canProposeMinStock ||
              perms.canVerifyMinStock ||
              perms.canApproveMinStockSystem) && (
              <button
                type="button"
                onClick={() => onNavigateTab('min-stock')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                <span>Kelola Stok Minimal</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigateTab('items')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <span>Buka Master Stok</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 4 Interactive Filter Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 0: Semua Stok */}
          <button
            type="button"
            onClick={() => setStockHealthFilter('ALL')}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              stockHealthFilter === 'ALL'
                ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/20'
                : 'bg-slate-50/70 hover:bg-slate-100 text-slate-900 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span
                className={`text-[11px] font-bold uppercase tracking-wider ${
                  stockHealthFilter === 'ALL' ? 'text-slate-300' : 'text-slate-500'
                }`}
              >
                Semua Katalog Barang
              </span>
              <Boxes
                className={`w-5 h-5 ${
                  stockHealthFilter === 'ALL' ? 'text-emerald-400' : 'text-slate-400'
                }`}
              />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono tabular-nums">{totalSKU}</span>
              <span
                className={`text-xs font-medium ${
                  stockHealthFilter === 'ALL' ? 'text-slate-300' : 'text-slate-500'
                }`}
              >
                Material Code ({totalPhysicalStock.toLocaleString('id-ID')} unit)
              </span>
            </div>
            <div
              className={`mt-2 text-[11px] font-medium ${
                stockHealthFilter === 'ALL' ? 'text-emerald-300' : 'text-slate-500'
              }`}
            >
              Menampilkan seluruh posisi stok
            </div>
          </button>

          {/* Card 1: STOK AMAN (Jauh dari Stock Minimal) */}
          <button
            type="button"
            onClick={() =>
              setStockHealthFilter(stockHealthFilter === 'SAFE' ? 'ALL' : 'SAFE')
            }
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              stockHealthFilter === 'SAFE'
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-600/30'
                : 'bg-emerald-50/60 hover:bg-emerald-100/70 text-emerald-950 border-emerald-200'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span
                className={`text-[11px] font-bold uppercase tracking-wider ${
                  stockHealthFilter === 'SAFE' ? 'text-emerald-100' : 'text-emerald-800'
                }`}
              >
                Stok Aman
              </span>
              <ShieldCheck
                className={`w-5 h-5 ${
                  stockHealthFilter === 'SAFE' ? 'text-white' : 'text-emerald-600'
                }`}
              />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono tabular-nums">
                {safeStockItems.length}
              </span>
              <span
                className={`text-xs font-semibold ${
                  stockHealthFilter === 'SAFE' ? 'text-emerald-100' : 'text-emerald-800'
                }`}
              >
                Barang Aman
              </span>
            </div>
            <div
              className={`mt-2 text-[11px] font-medium ${
                stockHealthFilter === 'SAFE' ? 'text-emerald-50' : 'text-emerald-700'
              }`}
            >
              Jauh di atas batas stock minimal
            </div>
          </button>

          {/* Card 2: STOK MENIPIS (Mendekati Stock Minimal) */}
          <button
            type="button"
            onClick={() =>
              setStockHealthFilter(stockHealthFilter === 'WARNING' ? 'ALL' : 'WARNING')
            }
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              stockHealthFilter === 'WARNING'
                ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-md ring-2 ring-amber-500/30'
                : 'bg-amber-50/70 hover:bg-amber-100/80 text-amber-950 border-amber-300'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span
                className={`text-[11px] font-bold uppercase tracking-wider ${
                  stockHealthFilter === 'WARNING' ? 'text-slate-900' : 'text-amber-800'
                }`}
              >
                Stok Menipis
              </span>
              <TrendingDown
                className={`w-5 h-5 ${
                  stockHealthFilter === 'WARNING' ? 'text-slate-950' : 'text-amber-600'
                }`}
              />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono tabular-nums">
                {warningStockItems.length}
              </span>
              <span
                className={`text-xs font-semibold ${
                  stockHealthFilter === 'WARNING' ? 'text-slate-900' : 'text-amber-800'
                }`}
              >
                Barang Menipis
              </span>
            </div>
            <div
              className={`mt-2 text-[11px] font-medium ${
                stockHealthFilter === 'WARNING' ? 'text-slate-900' : 'text-amber-800'
              }`}
            >
              Mendekati batas stock minimal
            </div>
          </button>

          {/* Card 3: STOK KRITIS (Melampaui Stock Minimal) */}
          <button
            type="button"
            onClick={() =>
              setStockHealthFilter(stockHealthFilter === 'CRITICAL' ? 'ALL' : 'CRITICAL')
            }
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              stockHealthFilter === 'CRITICAL'
                ? 'bg-red-600 text-white border-red-700 shadow-md ring-2 ring-red-600/30'
                : 'bg-red-50/70 hover:bg-red-100/80 text-red-950 border-red-300'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span
                className={`text-[11px] font-bold uppercase tracking-wider ${
                  stockHealthFilter === 'CRITICAL' ? 'text-red-100' : 'text-red-800'
                }`}
              >
                Stok Kritis
              </span>
              <AlertTriangle
                className={`w-5 h-5 ${
                  stockHealthFilter === 'CRITICAL' ? 'text-white' : 'text-red-600'
                }`}
              />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono tabular-nums">
                {criticalStockItems.length}
              </span>
              <span
                className={`text-xs font-semibold ${
                  stockHealthFilter === 'CRITICAL' ? 'text-red-100' : 'text-red-800'
                }`}
              >
                Barang Kritis (&le; Min)
              </span>
            </div>
            <div
              className={`mt-2 text-[11px] font-medium ${
                stockHealthFilter === 'CRITICAL' ? 'text-red-50' : 'text-red-700'
              }`}
            >
              Melampaui / di bawah stock minimal
            </div>
          </button>
        </div>

        {/* Filter Bar: Pill Tabs + Category Dropdown + Search */}
        <div className="pt-2 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setStockHealthFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                stockHealthFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua ({evaluatedStockItems.length})
            </button>
            <button
              type="button"
              onClick={() => setStockHealthFilter('SAFE')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                stockHealthFilter === 'SAFE'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-emerald-800 hover:bg-emerald-50'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Stok Aman — Jauh dari Minimal ({safeStockItems.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setStockHealthFilter('WARNING')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                stockHealthFilter === 'WARNING'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-2xs'
                  : 'text-amber-800 hover:bg-amber-50'
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5" />
              <span>Stok Menipis — Mendekati Minimal ({warningStockItems.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setStockHealthFilter('CRITICAL')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                stockHealthFilter === 'CRITICAL'
                  ? 'bg-red-600 text-white shadow-2xs'
                  : 'text-red-700 hover:bg-red-50'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Stok Kritis — Melampaui Minimal ({criticalStockItems.length})</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-slate-900"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === 'ALL' ? 'Semua Kategori' : cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative min-w-[220px] flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={stockSearchQuery}
                onChange={(e) => setStockSearchQuery(e.target.value)}
                placeholder="Cari Material Code, nama barang, rak..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Tabel Daftar Barang Sesuai Filter Status Stok */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto max-h-[420px]">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase text-[10.5px] sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3">Material Code &amp; Nama Barang</th>
                  <th className="px-3 py-3">Kategori &amp; Lokasi Rak</th>
                  <th className="px-3 py-3 text-right">Stok Fisik Saat Ini</th>
                  <th className="px-3 py-3 text-right">Batas Stok Minimal</th>
                  <th className="px-3 py-3 text-right">Selisih terhadap Minimal</th>
                  <th className="px-4 py-3 text-center">Status Kesehatan Stok</th>
                  <th className="px-3 py-3 text-center">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDashboardStock.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-400 font-medium">
                      Tidak ada barang pada kategori status stok ini.
                    </td>
                  </tr>
                ) : (
                  filteredDashboardStock.map((item) => (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        item.isCritical
                          ? 'bg-red-50/40 hover:bg-red-50/70'
                          : item.isWarning
                          ? 'bg-amber-50/30 hover:bg-amber-50/60'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{item.name}</div>
                        <div className="font-mono text-[11px] font-semibold text-slate-500 mt-0.5">
                          {item.sku}
                        </div>
                      </td>

                      <td className="px-3 py-3 text-slate-600">
                        <div className="font-medium text-slate-800">{item.category}</div>
                        <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{item.location}</span>
                        </div>
                      </td>

                      <td className="px-3 py-3 text-right font-mono font-black text-sm tabular-nums">
                        <span
                          className={
                            item.isCritical
                              ? 'text-red-700'
                              : item.isWarning
                              ? 'text-amber-700'
                              : 'text-emerald-700'
                          }
                        >
                          {item.currentStock.toLocaleString('id-ID')} {item.unit}
                        </span>
                      </td>

                      <td className="px-3 py-3 text-right font-mono font-bold text-slate-800 tabular-nums">
                        {item.minStock.toLocaleString('id-ID')} {item.unit}
                      </td>

                      <td className="px-3 py-3 text-right font-mono font-bold tabular-nums whitespace-nowrap">
                        {item.diffFromMin < 0 ? (
                          <span className="text-red-600">
                            Kurang {Math.abs(item.diffFromMin)} {item.unit} (Di Bawah Min)
                          </span>
                        ) : item.diffFromMin === 0 ? (
                          <span className="text-red-600">Tepat di Batas Minimal (0)</span>
                        ) : item.isWarning ? (
                          <span className="text-amber-700">
                            +{item.diffFromMin} {item.unit} (Mendekati Min)
                          </span>
                        ) : (
                          <span className="text-emerald-700">
                            +{item.diffFromMin} {item.unit} (Jauh di Atas Min)
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {item.isCritical ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-black bg-red-100 text-red-800 border border-red-300">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                            <span>STOK KRITIS (MELAMPAUI MINIMAL)</span>
                          </span>
                        ) : item.isWarning ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            <TrendingDown className="w-3.5 h-3.5 text-amber-700" />
                            <span>STOK MENIPIS (MENDEKATI MINIMAL)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>STOK AMAN (JAUH DARI MINIMAL)</span>
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {perms.canCreateLPB && (item.isCritical || item.isWarning) && (
                            <button
                              type="button"
                              onClick={onOpenCreateLPB}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition-colors cursor-pointer"
                              title="Input Penerimaan Barang (LPB) untuk menambah stok"
                            >
                              + Restock LPB
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onNavigateTab('items')}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            Detail
                          </button>
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

      {/* KPI Operational Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Stok Aman (Jauh dari Min)</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-emerald-600 tabular-nums">
              {safeStockItems.length}
            </span>
            <span className="text-xs text-slate-500">dari {totalSKU} Material Code</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Stok berada jauh di atas batas minimal
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Stok Menipis (Mendekati Min)</span>
            <TrendingDown className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-amber-600 tabular-nums">
              {warningStockItems.length}
            </span>
            <span className="text-xs text-amber-700 font-medium">Material Code Menipis</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Perlu persiapan pengadaan ulang
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Stok Kritis (&le; Batas Min)</span>
            <AlertTriangle
              className={`w-4 h-4 ${
                criticalStockItems.length > 0 ? 'text-red-500' : 'text-slate-400'
              }`}
            />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold font-mono tabular-nums ${
                criticalStockItems.length > 0 ? 'text-red-600' : 'text-slate-900'
              }`}
            >
              {criticalStockItems.length}
            </span>
            <span className="text-xs text-red-700 font-medium">Material Code Kritis</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Melampaui batas minimal sistem
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>{isRequesterUser ? 'SIV Anda Dalam Proses' : 'Antrean Nota SIV Aktif'}</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-blue-600 tabular-nums">
              {pendingVouchers.length}
            </span>
            <span className="text-xs text-blue-700 font-medium">
              Nota ({completedVouchers.length} Selesai)
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {pendingVouchers.length > 0 ? 'Menunggu ACC / Verifikasi' : 'Semua permohonan tuntas'}
          </div>
        </div>
      </div>

      {/* Main Grid: Pending Approvals & Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Urgent Pending Approvals (2 cols on lg) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-bold text-slate-900">
                {isRequesterUser
                  ? `Antrean Nota SIV Milik Anda (${pendingVouchers.length})`
                  : `Antrean Validasi Admin & Verifikasi Kepala Gudang (${pendingVouchers.length})`}
              </h2>
            </div>
            {(perms.canCreateSIV || perms.canViewAllSIV) && (
              <button
                onClick={() => onNavigateTab('vouchers')}
                className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1"
              >
                Lihat Semua <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            {pendingVouchers.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                Tidak ada nota yang menunggu validasi atau verifikasi saat ini.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {pendingVouchers.map((voucher) => {
                  const isWaitingHeadVerify = voucher.status === 'APPROVED';
                  return (
                    <div key={voucher.id} className="p-4 hover:bg-slate-50/60 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-mono font-bold text-slate-900">
                              {voucher.voucherNumber}
                            </span>
                            <span className="text-slate-300">·</span>
                            <span className="text-slate-600 font-medium">{voucher.department}</span>
                            <span className="text-slate-300">·</span>
                            <span className="text-slate-500">{formatDate(voucher.requestDate)}</span>
                          </div>

                          <p className="text-xs font-medium text-slate-800 mt-1">
                            {voucher.purpose}
                          </p>

                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                            <span>
                              Pemohon: <strong>{voucher.requestedBy}</strong>
                            </span>
                            <span>·</span>
                            <span>
                              Total:{' '}
                              <strong>
                                {voucher.items.reduce((a, b) => a + b.requestedQty, 0)} unit
                              </strong>{' '}
                              ({voucher.items.length} macam barang)
                            </span>
                            <span>·</span>
                            {isWaitingHeadVerify ? (
                              <span className="text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded font-semibold border border-blue-200">
                                Terkunci (Di-ACC Admin) &middot; Menunggu Verifikasi Kepala Gudang
                              </span>
                            ) : (
                              <span className="text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded font-medium border border-amber-200">
                                Menunggu ACC &amp; Validasi Barang (Admin Gudang)
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => onPrintDocument('NPB', voucher)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                            title="Pratinjau / Cetak Nota"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Cetak</span>
                          </button>

                          {(!isWaitingHeadVerify && perms.canValidateSIV) ||
                          (isWaitingHeadVerify && perms.canApproveSIVStockDeduction) ? (
                            <button
                              onClick={() => onOpenApproval(voucher)}
                              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white rounded-lg transition-colors shadow-2xs ${
                                isWaitingHeadVerify
                                  ? 'bg-emerald-600 hover:bg-emerald-500'
                                  : 'bg-blue-600 hover:bg-blue-500'
                              }`}
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>
                                {isWaitingHeadVerify
                                  ? 'Approve Pengurangan Stock'
                                  : 'ACC & Scan Barang'}
                              </span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-amber-700 font-medium px-2 py-1 bg-amber-50 rounded border border-amber-200">
                              {isWaitingHeadVerify
                                ? 'Terkunci · Menunggu Approve Ka. Gudang'
                                : 'Menunggu ACC & Scan Admin Gudang'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Stock In / LPB */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                <h2 className="text-sm font-bold text-slate-900">
                  Penerimaan Barang Terkini (LPB Supplier)
                </h2>
              </div>
              {(perms.canCreateLPB || perms.canApproveLPBStockAddition) && (
                <button
                  onClick={() => onNavigateTab('lpb')}
                  className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1"
                >
                  Lihat Semua <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="divide-y divide-slate-100">
                {lpbDocuments.slice(0, 3).map((lpb) => {
                  const isPendingLpb = lpb.status === 'PENDING_APPROVAL';
                  return (
                    <div
                      key={lpb.id}
                      className="p-3.5 flex items-center justify-between hover:bg-slate-50/50 gap-2"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-mono font-bold text-slate-900">
                            {lpb.lpbNumber}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="text-slate-500 font-mono">SJ: {lpb.sjNumber}</span>
                          {isPendingLpb ? (
                            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px] border border-amber-300">
                              Di-Scan Admin · Menunggu Approve Penambahan Stock (Ka. Gudang)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px] border border-emerald-300">
                              Approved Ka. Gudang (Stok Bertambah)
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-800 font-medium mt-0.5">
                          {lpb.supplierName}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Diterima {formatDate(lpb.receivedDate)} · {lpb.items.length} item barang
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isPendingLpb && perms.canApproveLPBStockAddition && (
                          <button
                            onClick={() => onNavigateTab('lpb')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors"
                          >
                            Approve Penambahan Stock
                          </button>
                        )}
                        <button
                          onClick={() => onPrintDocument('LPB', lpb)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Cetak LPB
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Ringkasan Cepat Stok Kritis & Menipis + Aktivitas Mutasi */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <h2 className="text-sm font-bold text-slate-900">
                Prioritas Restock (Kritis &amp; Menipis)
              </h2>
            </div>
            <button
              onClick={() => setStockHealthFilter('CRITICAL')}
              className="text-xs text-red-700 hover:text-red-900 font-semibold cursor-pointer"
            >
              Filter Kritis &uarr;
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
            {criticalStockItems.length === 0 && warningStockItems.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center">
                Semua stok barang berada jauh di atas batas minimal (Stok Aman).
              </p>
            ) : (
              <>
                {criticalStockItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-red-50/60 rounded-lg border border-red-200 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="inline-block text-[9.5px] font-black uppercase px-1.5 py-0.2 rounded bg-red-600 text-white mb-1">
                          KRITIS &bull; MELAMPAUI MINIMAL
                        </span>
                        <span className="font-bold text-slate-900 block">{item.name}</span>
                        <span className="text-[11px] font-mono text-slate-500">
                          {item.sku} · {item.location}
                        </span>
                      </div>
                      <span className="text-xs font-black text-red-600 font-mono tabular-nums">
                        {item.currentStock} {item.unit}
                      </span>
                    </div>
                    <div className="mt-2 text-[11px] text-red-800 flex justify-between items-center">
                      <span>
                        Batas Min: <strong>{item.minStock} {item.unit}</strong>
                      </span>
                      {perms.canCreateLPB && (
                        <button
                          onClick={onOpenCreateLPB}
                          className="font-bold underline hover:text-red-950 cursor-pointer"
                        >
                          + Tambah via LPB
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {warningStockItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-amber-50/60 rounded-lg border border-amber-200 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="inline-block text-[9.5px] font-bold uppercase px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 mb-1">
                          MENIPIS &bull; MENDEKATI MINIMAL
                        </span>
                        <span className="font-bold text-slate-900 block">{item.name}</span>
                        <span className="text-[11px] font-mono text-slate-500">
                          {item.sku} · {item.location}
                        </span>
                      </div>
                      <span className="text-xs font-black text-amber-700 font-mono tabular-nums">
                        {item.currentStock} {item.unit}
                      </span>
                    </div>
                    <div className="mt-2 text-[11px] text-amber-900 flex justify-between items-center">
                      <span>
                        Batas Min: <strong>{item.minStock} {item.unit}</strong> (Sisa +{item.diffFromMin})
                      </span>
                      {perms.canCreateLPB && (
                        <button
                          onClick={onOpenCreateLPB}
                          className="font-bold underline hover:text-amber-950 cursor-pointer"
                        >
                          + Tambah via LPB
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Quick Ledger Movements */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-slate-500" />
              Aktivitas Mutasi Terakhir
            </h3>

            <div className="space-y-3">
              {stockMovements.slice(0, 4).map((mov) => {
                const isIncoming = mov.type === 'IN';
                return (
                  <div
                    key={mov.id}
                    className="text-xs border-b border-slate-100 pb-2.5 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-900 truncate max-w-[170px]">
                        {mov.itemName}
                      </span>
                      <span
                        className={`font-mono font-bold tabular-nums ${
                          isIncoming ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {isIncoming ? '+' : '-'}
                        {mov.quantity}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 flex items-center justify-between">
                      <span className="font-mono">{mov.referenceNumber}</span>
                      <span>Saldo: {mov.balanceAfter}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
