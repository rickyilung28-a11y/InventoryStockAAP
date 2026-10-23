import React, { useState, useMemo } from 'react';
import { useInventory } from '../context/InventoryContext';
import {
  StockItem,
  MovementVelocityCategory,
  getEffectivePermissions,
  getRoleHierarchyLevel,
} from '../types/inventory';
import {
  Boxes,
  Search,
  MapPin,
  AlertTriangle,
  Plus,
  ClipboardList,
  X,
  Edit,
  Trash2,
  FileSpreadsheet,
  Barcode,
  ShieldAlert,
  TrendingDown,
  Flame,
  Activity,
  Gauge,
  Layers,
  Download,
  ScanBarcode,
  ArrowRightLeft,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { ImportStockItemsModal } from '../components/ImportStockItemsModal';
import { ThermalLabelDesignerModal } from '../components/ThermalLabelDesignerModal';
import { BarcodeScannerLookupModal } from '../components/BarcodeScannerLookupModal';
import { exportStockMasterToExcel } from '../utils/sqlAndExcelExport';

interface StockMasterViewProps {
  onViewLedgerItem: (sku: string) => void;
  onNavigateToMinStock?: () => void;
}

export const StockMasterView: React.FC<StockMasterViewProps> = ({
  onViewLedgerItem,
  onNavigateToMinStock,
}) => {
  const {
    stockItems,
    currentUser,
    storageLocations,
    minStockProposals,
    addNewStockItem,
    updateStockItem,
    deleteStockItem,
    getItemMovementAnalytics,
    isStockLockedForOpname,
    activeStockOpname,
    locationTransferRequests,
    createLocationTransferRequest,
    approveLocationTransferRequest,
    rejectLocationTransferRequest,
  } = useInventory();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedVelocity, setSelectedVelocity] = useState<'ALL' | MovementVelocityCategory>('ALL');
  const [viewMode, setViewMode] = useState<'table' | 'submaster'>('table');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isScannerLookupOpen, setIsScannerLookupOpen] = useState(false);

  // Location Transfer Request Modal State
  const [itemToTransferLoc, setItemToTransferLoc] = useState<StockItem | null>(null);
  const [transferTargetRack, setTransferTargetRack] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [transferError, setTransferError] = useState('');

  // Barcode Thermal Clabel Modal state
  const [isBarcodeThermalOpen, setIsBarcodeThermalOpen] = useState(false);
  const [itemsToPrintBarcode, setItemsToPrintBarcode] = useState<StockItem[]>([]);

  // Edit Item Modal State
  const [itemToEdit, setItemToEdit] = useState<StockItem | null>(null);
  const [editSku, setEditSku] = useState('');
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editMinStock, setEditMinStock] = useState(0);
  const [editLocation, setEditLocation] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // Delete Confirmation Modal State
  const [itemToDelete, setItemToDelete] = useState<StockItem | null>(null);
  const [deleteError, setDeleteError] = useState('');

  // Add Item Form State
  const [newSku, setNewSku] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('Sparepart Mesin');
  const [newUnit, setNewUnit] = useState('Pcs');
  const [newMinStock, setNewMinStock] = useState(5);
  const [newInitialStock, setNewInitialStock] = useState(0);
  const [newLocation, setNewLocation] = useState('Rak A-01');
  const [newDescription, setNewDescription] = useState('');

  const perms = getEffectivePermissions(currentUser);
  const isKepalaGudang = perms.canApproveMinStockSystem;
  const isAdmin = perms.canManageStockItems;
  const userLevel = currentUser ? getRoleHierarchyLevel(currentUser.role) : 99;
  const canApproveLocationTransfer =
    userLevel <= 1 ||
    currentUser?.role === 'kepala_gudang' ||
    currentUser?.role === 'superuser';

  // Unique categories
  const categories = useMemo(() => {
    const cats = Array.from(new Set(stockItems.map((i) => i.category)));
    return ['ALL', ...cats];
  }, [stockItems]);

  // Movement Velocity Summary Counts
  const velocitySummary = useMemo(() => {
    let fast = 0;
    let medium = 0;
    let low = 0;
    stockItems.forEach((item) => {
      const m = getItemMovementAnalytics(item.id);
      if (m.velocityCategory === 'FAST_MOVING') fast++;
      else if (m.velocityCategory === 'MEDIUM_MOVING') medium++;
      else low++;
    });
    return { fast, medium, low };
  }, [stockItems, getItemMovementAnalytics]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return stockItems.filter((item) => {
      const matchesCat = selectedCategory === 'ALL' || item.category === selectedCategory;
      const movement = getItemMovementAnalytics(item.id);
      const matchesVelocity =
        selectedVelocity === 'ALL' || movement.velocityCategory === selectedVelocity;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        item.sku.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);
      return matchesCat && matchesVelocity && matchesSearch;
    });
  }, [stockItems, selectedCategory, selectedVelocity, searchQuery, getItemMovementAnalytics]);

  // Grouped Sub-Master by Category
  const groupedSubMaster = useMemo(() => {
    const groups = new Map<string, StockItem[]>();
    filteredItems.forEach((item) => {
      const list = groups.get(item.category) || [];
      list.push(item);
      groups.set(item.category, list);
    });
    return Array.from(groups.entries());
  }, [filteredItems]);

  // Open Edit Modal with pre-filled values
  const handleOpenEdit = (item: StockItem) => {
    setItemToEdit(item);
    setEditSku(item.sku);
    setEditName(item.name);
    setEditCategory(item.category);
    setEditUnit(item.unit);
    setEditMinStock(item.minStock);
    setEditLocation(item.location);
    setEditDescription(item.description || '');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemToEdit || !editSku.trim() || !editName.trim()) return;

    updateStockItem(itemToEdit.id, {
      sku: editSku.trim(),
      name: editName.trim(),
      category: editCategory,
      unit: editUnit.trim(),
      minStock: Number(editMinStock),
      location: editLocation.trim(),
      description: editDescription.trim(),
    });

    setItemToEdit(null);
  };

  const handleConfirmDelete = () => {
    if (!itemToDelete) return;
    const res = deleteStockItem(itemToDelete.id);
    if (!res.success) {
      setDeleteError(res.error || 'Gagal menghapus barang.');
    } else {
      setItemToDelete(null);
      setDeleteError('');
    }
  };

  const handleCreateNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSku.trim() || !newName.trim()) return;

    addNewStockItem({
      sku: newSku.trim(),
      name: newName.trim(),
      category: newCategory,
      unit: newUnit,
      minStock: Number(newMinStock),
      currentStock: Number(newInitialStock),
      location: newLocation,
      description: newDescription,
    });

    setIsAddModalOpen(false);
    setNewSku('');
    setNewName('');
    setNewInitialStock(0);
    setNewDescription('');
  };

  // Stock alert calculations: Melampaui (<= minStock) vs Mendekati (> minStock and <= minStock + margin)
  const criticalItems = useMemo(() => {
    return stockItems.filter((item) => item.currentStock <= item.minStock);
  }, [stockItems]);

  const approachingItems = useMemo(() => {
    return stockItems.filter((item) => {
      if (item.currentStock <= item.minStock) return false;
      const buffer = Math.max(3, Math.round(item.minStock * 0.35));
      return item.currentStock <= item.minStock + buffer;
    });
  }, [stockItems]);

  const pendingMinProposalsCount = useMemo(() => {
    return minStockProposals.filter((p) => p.status === 'PENDING').length;
  }, [minStockProposals]);

  const pendingLocationTransfers = useMemo(
    () => locationTransferRequests.filter((r) => r.status === 'PENDING_KEPALA'),
    [locationTransferRequests]
  );

  const handleOpenTransferLocation = (item: StockItem) => {
    setItemToTransferLoc(item);
    const nextRack = storageLocations.find((l) => l.code !== item.location);
    setTransferTargetRack(nextRack?.code || storageLocations[0]?.code || '');
    setTransferReason('');
    setTransferError('');
  };

  const handleSubmitTransferLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemToTransferLoc) return;
    setTransferError('');
    const res = createLocationTransferRequest({
      itemId: itemToTransferLoc.id,
      toLocation: transferTargetRack,
      reason: transferReason,
    });
    if (!res.success) {
      setTransferError(res.error || 'Gagal mengajukan pindah lokasi rak.');
      return;
    }
    setItemToTransferLoc(null);
  };

  const renderVelocityBadge = (itemId: string) => {
    const m = getItemMovementAnalytics(itemId);
    if (m.velocityCategory === 'FAST_MOVING') {
      return (
        <div className="inline-flex flex-col items-center">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-orange-100 text-orange-900 border border-orange-300 whitespace-nowrap">
            <Flame className="w-3 h-3 text-orange-600" />
            <span>Fast Moving</span>
          </span>
          <span className="text-[10px] font-mono text-slate-500 mt-0.5">
            Keluar: {m.totalOutQty} ({m.outFrequency}x)
          </span>
        </div>
      );
    }
    if (m.velocityCategory === 'MEDIUM_MOVING') {
      return (
        <div className="inline-flex flex-col items-center">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-blue-100 text-blue-900 border border-blue-300 whitespace-nowrap">
            <Activity className="w-3 h-3 text-blue-600" />
            <span>Medium Moving</span>
          </span>
          <span className="text-[10px] font-mono text-slate-500 mt-0.5">
            Keluar: {m.totalOutQty} ({m.outFrequency}x)
          </span>
        </div>
      );
    }
    return (
      <div className="inline-flex flex-col items-center">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-slate-100 text-slate-700 border border-slate-300 whitespace-nowrap">
          <Gauge className="w-3 h-3 text-slate-500" />
          <span>Low Moving</span>
        </span>
        <span className="text-[10px] font-mono text-slate-400 mt-0.5">
          Keluar: {m.totalOutQty} ({m.outFrequency}x)
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Banner Lock Stock Opname */}
      {isStockLockedForOpname && activeStockOpname && (
        <div className="p-4 rounded-xl bg-amber-950 text-white border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-amber-300">
                STOK STORE SEDANG DI-LOCK — Sesi Stock Opname Aktif ({activeStockOpname.opnameNumber})
              </h3>
              <p className="text-[11px] text-slate-300">
                Dimulai oleh <strong>{activeStockOpname.startedBy}</strong>. Penambahan &amp; pengurangan stok dikunci hingga Stock Opname diselesaikan.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Banner Pengajuan Pindah Lokasi Rak Menunggu ACC Kepala Store */}
      {pendingLocationTransfers.length > 0 && (
        <div className="bg-white rounded-xl border border-indigo-200 shadow-2xs overflow-hidden">
          <div className="px-4 py-2.5 bg-indigo-950 text-white flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold">
              <ArrowRightLeft className="w-4 h-4 text-amber-400" />
              <span>
                Pengajuan Pindah Lokasi Rak Barang ({pendingLocationTransfers.length} Menunggu ACC Kepala Store)
              </span>
            </div>
          </div>
          <div className="p-3 divide-y divide-slate-100 text-xs">
            {pendingLocationTransfers.map((req) => (
              <div
                key={req.id}
                className="py-2 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <span className="font-mono font-bold text-slate-900 mr-1.5">{req.requestNumber}:</span>
                  <span className="font-bold text-indigo-700">{req.sku}</span> ({req.itemName}) &mdash; Pindah dari{' '}
                  <span className="font-mono font-bold px-1.5 py-0.5 bg-slate-100 rounded">{req.fromLocation}</span> ke{' '}
                  <span className="font-mono font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-900 rounded">
                    {req.toLocation}
                  </span>{' '}
                  <span className="text-slate-500">({req.reason} • Oleh: {req.requestedBy})</span>
                </div>
                {canApproveLocationTransfer ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => approveLocationTransferRequest(req.id)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] inline-flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>ACC Kepala Store</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => rejectLocationTransferRequest(req.id, 'Ditolak oleh Kepala Store')}
                      className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold text-[11px]"
                    >
                      Tolak
                    </button>
                  </div>
                ) : (
                  <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 shrink-0">
                    Menunggu ACC Kepala Store
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Peringatan Stock Mendekati / Melampaui Batas Minimum */}
      {(criticalItems.length > 0 || approachingItems.length > 0) && (
        <div className="bg-white rounded-xl border border-red-200 shadow-xs overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-red-600 via-red-500 to-amber-500 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-5 h-5 shrink-0 animate-bounce" />
              <div>
                <h3 className="text-xs sm:text-sm font-bold">
                  Peringatan Saldo Stok Minimum Store ({criticalItems.length} Melampaui Batas, {approachingItems.length} Mendekati Batas)
                </h3>
                <p className="text-[11px] text-red-50">
                  Segera lakukan restock (LPB) atau ajukan penyesuaian batas stok minimum untuk mencegah kehabisan suku cadang.
                </p>
              </div>
            </div>
            {onNavigateToMinStock && (
              <button
                onClick={onNavigateToMinStock}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-red-900 hover:bg-red-50 font-bold text-xs rounded-lg shadow-xs shrink-0 self-start sm:self-auto transition-colors"
              >
                <span>Buka Tabel Stock Minimal</span>
                {pendingMinProposalsCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-red-600 text-white rounded-full text-[10px]">
                    {pendingMinProposalsCount} Pending
                  </span>
                )}
              </button>
            )}
          </div>

          <div className="p-3 bg-red-50/40 grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
            {criticalItems.length > 0 && (
              <div className="p-2.5 bg-white rounded-lg border border-red-200 flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-red-100 text-red-700 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-red-900">
                    Melampaui / Di Bawah Stock Minimal ({criticalItems.length} Barang)
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {criticalItems.map((i) => (
                      <span
                        key={i.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-100 text-red-900 font-mono text-[11px] font-semibold border border-red-200"
                      >
                        {i.sku}: {i.currentStock}/{i.minStock} {i.unit}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {approachingItems.length > 0 && (
              <div className="p-2.5 bg-white rounded-lg border border-amber-200 flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                  <TrendingDown className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-amber-900">
                    Mendekati Stock Minimal ({approachingItems.length} Barang)
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {approachingItems.map((i) => (
                      <span
                        key={i.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-mono text-[11px] font-semibold border border-amber-200"
                      >
                        {i.sku}: {i.currentStock} (Min: {i.minStock} {i.unit})
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Analisa Kategori Keluar Barang (Fast Moving, Medium Moving, Low Moving) */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setSelectedVelocity('ALL')}
          className={`p-3.5 rounded-xl border text-left transition-all flex items-center justify-between ${
            selectedVelocity === 'ALL'
              ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
              : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
          }`}
        >
          <div>
            <p className={`text-[11px] font-semibold uppercase ${selectedVelocity === 'ALL' ? 'text-slate-300' : 'text-slate-500'}`}>
              Total Semua Barang
            </p>
            <p className="text-xl font-bold font-mono mt-0.5">{stockItems.length} Material Code</p>
            <p className={`text-[10.5px] mt-0.5 ${selectedVelocity === 'ALL' ? 'text-slate-300' : 'text-slate-500'}`}>
              Semua kategori pergerakan
            </p>
          </div>
          <Boxes className={`w-7 h-7 ${selectedVelocity === 'ALL' ? 'text-amber-400' : 'text-slate-400'}`} />
        </button>

        <button
          type="button"
          onClick={() => setSelectedVelocity(selectedVelocity === 'FAST_MOVING' ? 'ALL' : 'FAST_MOVING')}
          className={`p-3.5 rounded-xl border text-left transition-all flex items-center justify-between ${
            selectedVelocity === 'FAST_MOVING'
              ? 'bg-orange-600 text-white border-orange-600 shadow-sm'
              : 'bg-white text-slate-800 border-orange-200 hover:bg-orange-50/40'
          }`}
        >
          <div>
            <p className={`text-[11px] font-bold uppercase ${selectedVelocity === 'FAST_MOVING' ? 'text-orange-100' : 'text-orange-700'}`}>
              Fast Moving (Cepat)
            </p>
            <p className="text-xl font-bold font-mono mt-0.5">{velocitySummary.fast} Material Code</p>
            <p className={`text-[10.5px] mt-0.5 ${selectedVelocity === 'FAST_MOVING' ? 'text-orange-100' : 'text-slate-500'}`}>
              Tingkat keluar barang tinggi
            </p>
          </div>
          <Flame className={`w-7 h-7 ${selectedVelocity === 'FAST_MOVING' ? 'text-white' : 'text-orange-500'}`} />
        </button>

        <button
          type="button"
          onClick={() => setSelectedVelocity(selectedVelocity === 'MEDIUM_MOVING' ? 'ALL' : 'MEDIUM_MOVING')}
          className={`p-3.5 rounded-xl border text-left transition-all flex items-center justify-between ${
            selectedVelocity === 'MEDIUM_MOVING'
              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
              : 'bg-white text-slate-800 border-blue-200 hover:bg-blue-50/40'
          }`}
        >
          <div>
            <p className={`text-[11px] font-bold uppercase ${selectedVelocity === 'MEDIUM_MOVING' ? 'text-blue-100' : 'text-blue-700'}`}>
              Medium Moving (Sedang)
            </p>
            <p className="text-xl font-bold font-mono mt-0.5">{velocitySummary.medium} Material Code</p>
            <p className={`text-[10.5px] mt-0.5 ${selectedVelocity === 'MEDIUM_MOVING' ? 'text-blue-100' : 'text-slate-500'}`}>
              Pergerakan keluar moderat
            </p>
          </div>
          <Activity className={`w-7 h-7 ${selectedVelocity === 'MEDIUM_MOVING' ? 'text-white' : 'text-blue-500'}`} />
        </button>

        <button
          type="button"
          onClick={() => setSelectedVelocity(selectedVelocity === 'LOW_MOVING' ? 'ALL' : 'LOW_MOVING')}
          className={`p-3.5 rounded-xl border text-left transition-all flex items-center justify-between ${
            selectedVelocity === 'LOW_MOVING'
              ? 'bg-slate-700 text-white border-slate-700 shadow-sm'
              : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div>
            <p className={`text-[11px] font-bold uppercase ${selectedVelocity === 'LOW_MOVING' ? 'text-slate-200' : 'text-slate-600'}`}>
              Low Moving (Lambat)
            </p>
            <p className="text-xl font-bold font-mono mt-0.5">{velocitySummary.low} Material Code</p>
            <p className={`text-[10.5px] mt-0.5 ${selectedVelocity === 'LOW_MOVING' ? 'text-slate-200' : 'text-slate-500'}`}>
              Jarang keluar / slow moving
            </p>
          </div>
          <Gauge className={`w-7 h-7 ${selectedVelocity === 'LOW_MOVING' ? 'text-white' : 'text-slate-400'}`} />
        </button>
      </div>

      {/* Top Header & Actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Boxes className="w-5 h-5 text-slate-700" />
              <span>Katalog Master &amp; Sub-Master Stok Store</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Pantau stok fisik, batas stok minimum (Safety Stock), pindah lokasi rak, scan barcode barang/rak, serta export master ke Excel.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {/* Toggle Tampilan Tabel vs Sub-Master */}
            <div className="inline-flex items-center p-0.5 bg-slate-100 border border-slate-200 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-1.5 rounded-md font-semibold transition-colors ${
                  viewMode === 'table' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tabel Utama
              </button>
              <button
                type="button"
                onClick={() => setViewMode('submaster')}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md font-semibold transition-colors ${
                  viewMode === 'submaster' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Sub-Master Kategori</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsScannerLookupOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-xs"
              title="Scan Barcode Barang (Material Code) atau Barcode Lokasi Rak"
            >
              <ScanBarcode className="w-4 h-4" />
              <span>Scan Barcode Barang &amp; Rak</span>
            </button>

            <button
              type="button"
              onClick={() => exportStockMasterToExcel(stockItems, getItemMovementAnalytics)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-950 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-lg transition-colors shadow-2xs"
              title="Export Master Stok Barang & Sub-Master Kategori ke File Excel (.xlsx)"
            >
              <Download className="w-4 h-4 text-emerald-700" />
              <span>Export Master Excel (.xlsx)</span>
            </button>

            <button
              onClick={() => {
                setItemsToPrintBarcode(filteredItems.length > 0 ? filteredItems : stockItems);
                setIsBarcodeThermalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors shadow-xs"
              title="Preview & cetak stiker barcode thermal Clabel dengan template ukuran kertas"
            >
              <Barcode className="w-4 h-4 text-slate-950" />
              <span>Preview &amp; Cetak Barcode</span>
            </button>

            {isAdmin && (
              <>
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  disabled={isStockLockedForOpname}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors shadow-2xs disabled:opacity-50"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Import Excel</span>
                </button>
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs"
                >
                  <Plus className="w-4 h-4 text-emerald-400" />
                  <span>+ Tambah Barang Baru</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Category tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg text-xs overflow-x-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 font-medium rounded-md transition-colors whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat === 'ALL' ? 'Semua Kategori' : cat}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari Material Code, nama barang, lokasi rak..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-slate-900 focus:bg-white focus:outline-hidden"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                &times;
              </button>
            )}
          </div>
        </div>
      </div>

      {/* SUB-MASTER KATEGORI VIEW (Menampilkan Stock Minimum pada setiap barang di Sub-Master) */}
      {viewMode === 'submaster' && (
        <div className="space-y-4">
          {groupedSubMaster.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-xs">
              Tidak ada barang di sub-master yang cocok dengan filter.
            </div>
          ) : (
            groupedSubMaster.map(([categoryName, items]) => (
              <div
                key={categoryName}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs"
              >
                <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-amber-400" />
                    <span className="font-bold text-xs sm:text-sm">
                      Sub-Master Kategori: {categoryName}
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-200 font-mono text-[11px]">
                    {items.length} Barang
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2.5">Material Code</th>
                        <th className="px-4 py-2.5">Nama Barang Sub-Master</th>
                        <th className="px-4 py-2.5 text-center">Lokasi Rak</th>
                        <th className="px-4 py-2.5 text-right">Stok Fisik</th>
                        <th className="px-4 py-2.5 text-center bg-amber-50/80 text-amber-950 font-bold">
                          Stock Minimum (Batas Min)
                        </th>
                        <th className="px-4 py-2.5 text-center">Analisa Keluar Barang</th>
                        <th className="px-4 py-2.5 text-center">Status Stok</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((item) => {
                        const isLow = item.currentStock <= item.minStock;
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/80">
                            <td className="px-4 py-2.5 font-mono font-bold text-slate-900">
                              {item.sku}
                            </td>
                            <td className="px-4 py-2.5 font-semibold text-slate-900">
                              {item.name}
                            </td>
                            <td className="px-4 py-2.5 text-center font-mono text-slate-600">
                              {item.location}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">
                              {item.currentStock} {item.unit}
                            </td>
                            <td className="px-4 py-2.5 text-center bg-amber-50/40 font-mono font-bold text-slate-900">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-amber-100 text-amber-950 border border-amber-300">
                                Min: {item.minStock} {item.unit}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {renderVelocityBadge(item.id)}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {isLow ? (
                                <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-red-100 text-red-800 border border-red-300">
                                  &le; Stock Min
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-100 text-emerald-800">
                                  Aman
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Responsive Items Presentation (Main Table View) */}
      {viewMode === 'table' && (
        <>
          {/* 1. Desktop Tabular Grid (Hidden on Mobile) */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Material Code</th>
                    <th className="px-4 py-3">Nama Barang &amp; Sub-Master</th>
                    <th className="px-4 py-3">Kategori</th>
                    <th className="px-4 py-3 text-center">Lokasi Rak</th>
                    <th className="px-4 py-3 text-right">Stok Fisik di Rak</th>
                    <th className="px-4 py-3 text-right">Dialokasikan</th>
                    <th className="px-4 py-3 text-right">Stok Siap Diambil</th>
                    <th className="px-4 py-3 text-center bg-amber-50/70 text-amber-950">
                      Stok Minimum
                    </th>
                    <th className="px-4 py-3 text-center">Analisa Keluar Barang</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-12 text-center text-slate-400">
                        Tidak ada barang yang cocok dengan kriteria filter.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      const available = item.currentStock - item.allocatedStock;
                      const isLow = item.currentStock <= item.minStock;
                      const isOutOfStock = available <= 0;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-slate-900">
                            {item.sku}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900">{item.name}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10.5px] font-mono font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                Stok Min: {item.minStock} {item.unit}
                              </span>
                              {item.description && (
                                <span className="text-[11px] text-slate-500 truncate max-w-xs">
                                  {item.description}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{item.category}</td>
                          <td className="px-4 py-3 text-center font-mono text-slate-600">
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              {item.location}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                            {item.currentStock.toLocaleString('id-ID')} {item.unit}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-amber-700 tabular-nums">
                            {item.allocatedStock > 0 ? `${item.allocatedStock} ${item.unit}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold tabular-nums">
                            <span
                              className={
                                available > item.minStock
                                  ? 'text-emerald-700'
                                  : available > 0
                                  ? 'text-amber-700'
                                  : 'text-red-600'
                              }
                            >
                              {available.toLocaleString('id-ID')} {item.unit}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-bold text-slate-900 bg-amber-50/30 tabular-nums">
                            <span className="px-2 py-0.5 rounded bg-amber-100/80 text-amber-950 border border-amber-300/80">
                              {item.minStock} {item.unit}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {renderVelocityBadge(item.id)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {isOutOfStock ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-black bg-red-100 text-red-800 border border-red-300">
                                <AlertTriangle className="w-3 h-3 text-red-600" />
                                <span>Habis</span>
                              </span>
                            ) : isLow ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-red-100 text-red-800 border border-red-300 animate-pulse">
                                <ShieldAlert className="w-3 h-3 text-red-600" />
                                <span>&le; Batas Min</span>
                              </span>
                            ) : item.currentStock <=
                              item.minStock + Math.max(3, Math.round(item.minStock * 0.35)) ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                <TrendingDown className="w-3 h-3 text-amber-700" />
                                <span>Mendekati Min</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-100 text-emerald-800">
                                <span>Aman</span>
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => {
                                  setItemsToPrintBarcode([item]);
                                  setIsBarcodeThermalOpen(true);
                                }}
                                className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors"
                                title="Preview & Cetak Barcode Stiker Clabel"
                              >
                                <Barcode className="w-4 h-4" />
                              </button>

                              {isAdmin && (
                                <button
                                  onClick={() => handleOpenTransferLocation(item)}
                                  className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded transition-colors"
                                  title="Ajukan Pindah Lokasi Rak (Terealisasi saat di-ACC Kepala Store)"
                                >
                                  <ArrowRightLeft className="w-4 h-4" />
                                </button>
                              )}

                              <button
                                onClick={() => onViewLedgerItem(item.sku)}
                                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                                title="Kartu Stok Mutasi"
                              >
                                <ClipboardList className="w-4 h-4" />
                              </button>

                              {isAdmin && (
                                <button
                                  onClick={() => handleOpenEdit(item)}
                                  className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                                  title="Edit Data Barang & Safety Stock"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                              )}

                              {isAdmin && (
                                <button
                                  onClick={() => {
                                    setItemToDelete(item);
                                    setDeleteError('');
                                  }}
                                  className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                                  title="Hapus Material Code Barang"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. Mobile Card List (Optimized for Phones & Tablets, md:hidden) */}
          <div className="md:hidden space-y-3">
            {filteredItems.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-xs">
                Tidak ada barang yang cocok dengan filter atau pencarian.
              </div>
            ) : (
              filteredItems.map((item) => {
                const available = item.currentStock - item.allocatedStock;
                const isLow = item.currentStock <= item.minStock;
                const isOutOfStock = available <= 0;

                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-bold text-xs bg-slate-100 text-slate-900 px-2 py-0.5 rounded">
                            {item.sku}
                          </span>
                          <span className="text-[11px] text-slate-500">{item.category}</span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 mt-1">{item.name}</h3>
                        {item.description && (
                          <p className="text-xs text-slate-500 line-clamp-1">{item.description}</p>
                        )}
                      </div>

                      <div className="shrink-0 text-right space-y-1">
                        {isOutOfStock ? (
                          <span className="block text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                            Habis
                          </span>
                        ) : isLow ? (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Menipis
                          </span>
                        ) : (
                          <span className="block text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Aman
                          </span>
                        )}
                        {renderVelocityBadge(item.id)}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-2.5 rounded-lg text-center text-xs">
                      <div>
                        <div className="text-[10px] text-slate-500">Stok Fisik</div>
                        <div className="font-mono font-bold text-slate-900 mt-0.5">
                          {item.currentStock} {item.unit}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-amber-700">Dialokasikan</div>
                        <div className="font-mono font-semibold text-amber-800 mt-0.5">
                          {item.allocatedStock > 0 ? `${item.allocatedStock} ${item.unit}` : '0'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-emerald-700">Siap Diambil</div>
                        <div
                          className={`font-mono font-bold mt-0.5 ${
                            available > item.minStock
                              ? 'text-emerald-700'
                              : available > 0
                              ? 'text-amber-700'
                              : 'text-red-600'
                          }`}
                        >
                          {available} {item.unit}
                        </div>
                      </div>
                      <div className="bg-amber-50 rounded p-1 border border-amber-200">
                        <div className="text-[10px] text-amber-900 font-bold">Stok Minimum</div>
                        <div className="font-mono font-bold text-amber-950 mt-0.5">
                          {item.minStock} {item.unit}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                      <span className="text-slate-600 font-mono flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {item.location}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onViewLedgerItem(item.sku)}
                          className="px-2.5 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-[11px] font-medium flex items-center gap-1"
                        >
                          <ClipboardList className="w-3.5 h-3.5 text-slate-500" />
                          <span>Kartu Stok</span>
                        </button>

                        {isAdmin && (
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="px-2.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-[11px] font-medium flex items-center gap-1"
                          >
                            <Edit className="w-3.5 h-3.5 text-blue-600" />
                            <span>Edit</span>
                          </button>
                        )}

                        {isAdmin && (
                          <button
                            onClick={() => {
                              setItemToDelete(item);
                              setDeleteError('');
                            }}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                            title="Hapus barang"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* MODAL 1: Tambah Master Material Code Baru (Create) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Boxes className="w-5 h-5 text-emerald-400" />
                <h2 className="text-base font-semibold">Tambah Material Code Master Barang Baru</h2>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewItem} className="p-5 sm:p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Material Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newSku}
                    onChange={(e) => setNewSku(e.target.value.toUpperCase())}
                    placeholder="Contoh: BRG-007"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Kategori Barang
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden bg-white"
                  >
                    <option value="Sparepart Mesin">Sparepart Mesin</option>
                    <option value="Bahan Kimia & Pelumas">Bahan Kimia & Pelumas</option>
                    <option value="Peralatan Workshop">Peralatan Workshop</option>
                    <option value="Komponen Elektrikal">Komponen Elektrikal</option>
                    <option value="Kemasan & Logistik">Kemasan & Logistik</option>
                    <option value="Peralatan Keselamatan (APD)">Peralatan Keselamatan (APD)</option>
                    <option value="Umum & Konsumsi Gudang">Umum & Konsumsi Gudang</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Barang Lengkap <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Contoh: Seal O-Ring Viton 40mm High Temp"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Satuan Pengukuran (Unit)
                  </label>
                  <input
                    type="text"
                    required
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    placeholder="Pcs, Unit, Box, Liter..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Lokasi Rak Penyimpanan
                  </label>
                  <select
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-xs bg-white focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                  >
                    {storageLocations.map((loc) => (
                      <option key={loc.id} value={loc.code}>
                        {loc.code} - {loc.name}
                      </option>
                    ))}
                    {!storageLocations.some((l) => l.code === newLocation) && (
                      <option value={newLocation}>{newLocation} (Kustom)</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Safety Stock (Batas Min)
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newMinStock}
                    onChange={(e) => setNewMinStock(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-xs bg-white focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                  />
                  <p className="text-[10.5px] text-slate-500 mt-1">
                    Peringatan stok menipis ({newUnit})
                  </p>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Saldo Stok Awal Fisik
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    disabled={!isKepalaGudang}
                    value={isKepalaGudang ? newInitialStock : 0}
                    onChange={(e) => setNewInitialStock(isKepalaGudang ? Number(e.target.value) : 0)}
                    className={`w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden ${
                      isKepalaGudang ? 'bg-white' : 'bg-slate-100 text-slate-500 cursor-not-allowed'
                    }`}
                  />
                  <p className="text-[10.5px] text-slate-500 mt-1">
                    {isKepalaGudang
                      ? `Jumlah fisik terdaftar (${newUnit})`
                      : 'Penambahan stok harus melalui LPB & di-approve Kepala Gudang'}
                  </p>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Deskripsi / Spesifikasi Tambahan
                </label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Keterangan spesifikasi teknis atau nomor part manufaktur..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs"
                >
                  Simpan Material Code Baru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Master SKU Barang (Update) */}
      {itemToEdit && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Edit className="w-5 h-5 text-blue-400" />
                <h2 className="text-base font-semibold">
                  Edit Data Master Barang ({itemToEdit.sku})
                </h2>
              </div>
              <button
                onClick={() => setItemToEdit(null)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 sm:p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Material Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editSku}
                    onChange={(e) => setEditSku(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Kategori Barang
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden bg-white"
                  >
                    <option value="Sparepart Mesin">Sparepart Mesin</option>
                    <option value="Bahan Kimia & Pelumas">Bahan Kimia & Pelumas</option>
                    <option value="Peralatan Workshop">Peralatan Workshop</option>
                    <option value="Komponen Elektrikal">Komponen Elektrikal</option>
                    <option value="Kemasan & Logistik">Kemasan & Logistik</option>
                    <option value="Peralatan Keselamatan (APD)">Peralatan Keselamatan (APD)</option>
                    <option value="Umum & Konsumsi Gudang">Umum & Konsumsi Gudang</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Barang <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Satuan Pengukuran (Unit)
                  </label>
                  <input
                    type="text"
                    required
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Lokasi Rak Penyimpanan
                  </label>
                  <select
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-xs bg-white focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                  >
                    {storageLocations.map((loc) => (
                      <option key={loc.id} value={loc.code}>
                        {loc.code} - {loc.name}
                      </option>
                    ))}
                    {!storageLocations.some((l) => l.code === editLocation) && (
                      <option value={editLocation}>{editLocation} (Kustom)</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <label className="block font-semibold text-slate-700 mb-1">
                  Safety Stock (Batas Minimum Stok)
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={editMinStock}
                  onChange={(e) => setEditMinStock(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-xs bg-white focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
                <p className="text-[10.5px] text-slate-500 mt-1">
                  Batas ambang peringatan ketika stok barang menipis ({editUnit}).
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Deskripsi / Catatan Barang
                </label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setItemToEdit(null)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Konfirmasi Hapus Barang (Delete) */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 p-6">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-slate-900 text-center">
              Hapus Material Code Barang "{itemToDelete.name}"?
            </h3>
            <p className="text-xs text-slate-600 text-center mt-2 leading-relaxed">
              Anda akan menghapus Material Code <strong className="font-mono">{itemToDelete.sku}</strong> dari katalog master.
              {itemToDelete.currentStock > 0 && (
                <span className="block text-amber-700 font-semibold mt-1">
                  Catatan: Barang ini masih memiliki saldo fisik sebanyak {itemToDelete.currentStock} {itemToDelete.unit}.
                </span>
              )}
            </p>

            {deleteError && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors"
              >
                Batalkan
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-xs"
              >
                Ya, Hapus Barang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Import Excel Barang Master */}
      {isImportModalOpen && (
        <ImportStockItemsModal onClose={() => setIsImportModalOpen(false)} />
      )}

      {/* Modal Ajukan Pindah Lokasi Rak Barang */}
      {itemToTransferLoc && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-amber-400" />
                <div>
                  <h2 className="text-sm sm:text-base font-bold">
                    Ajukan Pindah Lokasi Rak ({itemToTransferLoc.sku})
                  </h2>
                  <p className="text-[11px] text-slate-300">
                    Perubahan lokasi akan terealisasi setelah di-ACC oleh Kepala Store
                  </p>
                </div>
              </div>
              <button
                onClick={() => setItemToTransferLoc(null)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitTransferLocation} className="p-5 sm:p-6 space-y-4 text-xs">
              {transferError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 font-medium">
                  {transferError}
                </div>
              )}

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-slate-500">Barang:</div>
                  <div className="font-bold text-slate-900">{itemToTransferLoc.name}</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-slate-500">Rak Saat Ini (Asal):</div>
                  <div className="font-mono font-bold text-slate-900">
                    {itemToTransferLoc.location}
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Pilih Lokasi Rak Tujuan Baru <span className="text-red-500">*</span>
                </label>
                <select
                  value={transferTargetRack}
                  onChange={(e) => setTransferTargetRack(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 bg-white focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                >
                  {storageLocations.map((loc) => (
                    <option
                      key={loc.id}
                      value={loc.code}
                      disabled={loc.code === itemToTransferLoc.location}
                    >
                      {loc.code} — {loc.name} ({loc.zone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Alasan Pemindahan Lokasi Rak <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="Contoh: Penataan ulang rak barang Fast Moving Store..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setItemToTransferLoc(null)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-xs"
                >
                  Ajukan ke Kepala Store
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Desainer & Cetak Barcode Stiker Thermal Clabel */}
      {isBarcodeThermalOpen && (
        <ThermalLabelDesignerModal
          items={itemsToPrintBarcode}
          initialMode="items"
          onClose={() => {
            setIsBarcodeThermalOpen(false);
            setItemsToPrintBarcode([]);
          }}
        />
      )}

      {/* Modal Scan Barcode Barang & Lokasi Rak */}
      {isScannerLookupOpen && (
        <BarcodeScannerLookupModal
          isOpen={isScannerLookupOpen}
          onClose={() => setIsScannerLookupOpen(false)}
        />
      )}
    </div>
  );
};
