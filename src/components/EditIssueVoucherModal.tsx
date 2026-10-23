import React, { useState, useMemo } from 'react';
import { StockItem, IssueVoucherDocument } from '../types/inventory';
import { useInventory } from '../context/InventoryContext';
import { ItemPickerModal } from './ItemPickerModal';
import { BarcodeAddScannerPanel } from './BarcodeAddScannerPanel';
import {
  Plus,
  Trash2,
  Lock,
  X,
  AlertTriangle,
  Clock,
  MapPin,
  RefreshCw,
  Minus,
  CheckCircle2,
  ShieldAlert,
  Building2,
  BookOpen,
  Search,
  Boxes,
  ScanBarcode,
} from 'lucide-react';

interface EditIssueVoucherModalProps {
  voucher: IssueVoucherDocument | null;
  stockItems: StockItem[];
  onClose: () => void;
  onSubmit: (
    voucherId: string,
    data: {
      purpose: string;
      notes?: string;
      items: { itemId: string; requestedQty: number; costCenter?: string; glAcc?: string }[];
    }
  ) => { success: boolean; error?: string };
}

export const EditIssueVoucherModal: React.FC<EditIssueVoucherModalProps> = ({
  voucher,
  stockItems,
  onClose,
  onSubmit,
}) => {
  const { costCenters, glAccounts } = useInventory();

  if (!voucher) return null;

  // STRICT REQUIREMENT CHECK:
  // Sistem hapus edit dan tambah TIDAK AKAN AKTIF bagi user apabila sudah di-approve/acc admin
  const isApprovedAndLocked =
    voucher.status === 'APPROVED' || voucher.status === 'HANDOVER_COMPLETED';

  const [purpose, setPurpose] = useState(voucher.purpose);
  const [notes, setNotes] = useState(voucher.notes || '');
  const [items, setItems] = useState<
    Array<{
      itemId: string;
      requestedQty: number;
      costCenter?: string;
      glAcc?: string;
    }>
  >(
    voucher.items.map((i) => ({
      itemId: i.itemId,
      requestedQty: i.requestedQty,
      costCenter: i.costCenter || '60',
      glAcc: i.glAcc || '51010',
    }))
  );
  const [errorMsg, setErrorMsg] = useState('');

  // Quick Search & Add Bar State
  const [quickSearchText, setQuickSearchText] = useState('');
  const [quickSearchQty, setQuickSearchQty] = useState(1);
  const [showQuickDropdown, setShowQuickDropdown] = useState(false);
  const [showBarcodeAddScanner, setShowBarcodeAddScanner] = useState(false);

  // Item Picker Modal State
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);

  // Map of initial quantities reserved by this voucher so available calculation is accurate
  const initialAllocationsMap = useMemo(() => {
    const map: Record<string, number> = {};
    voucher.items.forEach((vi) => {
      map[vi.itemId] = (map[vi.itemId] || 0) + Number(vi.requestedQty || 0);
    });
    return map;
  }, [voucher.items]);

  const getAvailableForItem = (stock: StockItem | undefined) => {
    if (!stock) return 0;
    const initialReserved = initialAllocationsMap[stock.id] || 0;
    return Math.max(0, stock.currentStock - stock.allocatedStock + initialReserved);
  };

  const quickSearchResults = useMemo(() => {
    if (!quickSearchText.trim()) return [];
    const q = quickSearchText.toLowerCase();
    return stockItems
      .filter(
        (item) =>
          item.sku.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.location.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [stockItems, quickSearchText]);

  const addOrMergeItem = (
    selectedItem: StockItem,
    requestedQty: number,
    replaceIdx: number | null = null
  ) => {
    if (isApprovedAndLocked) return;
    const available = getAvailableForItem(selectedItem);
    if (available <= 0) {
      setErrorMsg(
        `Stok untuk "${selectedItem.name}" (${selectedItem.sku}) sedang habis.`
      );
      return;
    }

    const clampedAddQty = Math.max(1, Math.min(Number(requestedQty) || 1, available));
    setErrorMsg('');

    setItems((prev) => {
      if (replaceIdx !== null && replaceIdx >= 0 && replaceIdx < prev.length) {
        const otherIdx = prev.findIndex(
          (r, idx) => idx !== replaceIdx && r.itemId === selectedItem.id
        );
        if (otherIdx >= 0) {
          return prev
            .map((r, idx) =>
              idx === otherIdx
                ? {
                    ...r,
                    requestedQty: Math.min(available, r.requestedQty + clampedAddQty),
                  }
                : r
            )
            .filter((_, idx) => idx !== replaceIdx);
        }
        return prev.map((it, idx) =>
          idx === replaceIdx
            ? { ...it, itemId: selectedItem.id, requestedQty: clampedAddQty }
            : it
        );
      }

      const existingIdx = prev.findIndex((i) => i.itemId === selectedItem.id);
      if (existingIdx >= 0) {
        return prev.map((it, idx) =>
          idx === existingIdx
            ? {
                ...it,
                requestedQty: Math.min(available, it.requestedQty + clampedAddQty),
              }
            : it
        );
      }

      return [
        ...prev,
        {
          itemId: selectedItem.id,
          requestedQty: clampedAddQty,
          costCenter: '60',
          glAcc: '51010',
        },
      ];
    });
  };

  // 1. TAMBAH ITEM (Hanya aktif jika belum approved)
  const handleOpenPickerForAdd = () => {
    if (isApprovedAndLocked) return;
    setReplacingIndex(null);
    setIsPickerOpen(true);
  };

  // 2. GANTI ITEM (Hanya aktif jika belum approved)
  const handleOpenPickerForReplace = (index: number) => {
    if (isApprovedAndLocked) return;
    setReplacingIndex(index);
    setIsPickerOpen(true);
  };

  const handleSelectItemFromPicker = (selectedItem: StockItem, requestedQty: number) => {
    addOrMergeItem(selectedItem, requestedQty, replacingIndex);
  };

  const handleAddNextAvailableRow = () => {
    if (isApprovedAndLocked) return;
    setErrorMsg('');
    const usedIds = new Set(items.map((i) => i.itemId));
    const nextItem = stockItems.find(
      (s) => !usedIds.has(s.id) && getAvailableForItem(s) > 0
    );

    if (!nextItem) {
      setReplacingIndex(null);
      setIsPickerOpen(true);
      return;
    }

    setItems((prev) => [
      ...prev,
      {
        itemId: nextItem.id,
        requestedQty: 1,
        costCenter: '60',
        glAcc: '51010',
      },
    ]);
  };

  const handleInlineItemChange = (index: number, newItemId: string) => {
    if (isApprovedAndLocked) return;
    const targetStock = stockItems.find((s) => s.id === newItemId);
    if (!targetStock) return;
    addOrMergeItem(targetStock, 1, index);
  };

  const handleCostCenterChange = (index: number, costCenter: string) => {
    if (isApprovedAndLocked) return;
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, costCenter } : it))
    );
  };

  const handleGlAccChange = (index: number, glAcc: string) => {
    if (isApprovedAndLocked) return;
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, glAcc } : it))
    );
  };

  // 3. HAPUS ITEM (Hanya aktif jika belum approved)
  const handleRemoveItem = (index: number) => {
    if (isApprovedAndLocked) {
      setErrorMsg('Nota sudah di-approve admin! Sistem penghapusan item tidak aktif.');
      return;
    }
    setErrorMsg('');
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // 4. EDIT KUANTITI ITEM (Hanya aktif jika belum approved)
  const handleQtyChange = (index: number, newQty: number, maxAvailable: number) => {
    if (isApprovedAndLocked) return;
    const qty = Math.max(1, Math.min(newQty, Math.max(1, maxAvailable)));
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, requestedQty: qty } : item))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (isApprovedAndLocked) {
      setErrorMsg(
        'Sistem terkunci! Nota ini sudah di-approve oleh admin gudang dan barang sudah diserahkan.'
      );
      return;
    }

    if (!purpose.trim()) {
      setErrorMsg('Tujuan atau keperluan pengambilan barang wajib diisi.');
      return;
    }

    if (items.length === 0) {
      setErrorMsg('Pilih minimal satu item barang.');
      return;
    }

    const result = onSubmit(voucher.id, {
      purpose: purpose.trim(),
      notes: notes.trim() || undefined,
      items: items.map((i) => ({
        itemId: i.itemId,
        requestedQty: Number(i.requestedQty),
        costCenter: i.costCenter || '60',
        glAcc: i.glAcc || '51010',
      })),
    });

    if (result.success) {
      onClose();
    } else if (result.error) {
      setErrorMsg(result.error);
    }
  };

  const selectedQuantitiesMap = useMemo(() => {
    const map: Record<string, number> = {};
    items.forEach((i) => {
      map[i.itemId] = (map[i.itemId] || 0) + Number(i.requestedQty || 0);
    });
    return map;
  }, [items]);

  const totalQuantity = items.reduce((acc, i) => acc + Number(i.requestedQty || 0), 0);

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
        <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4 max-h-[92vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 text-white shrink-0 bg-slate-900">
            <div className="flex items-center gap-2.5">
              {isApprovedAndLocked ? (
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Lock className="w-4 h-4" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Clock className="w-4 h-4" />
                </div>
              )}
              <div>
                <h2 className="text-sm sm:text-base font-semibold flex items-center gap-2">
                  <span>Nota #{voucher.voucherNumber}</span>
                  {isApprovedAndLocked && (
                    <span className="text-[10px] bg-emerald-600 text-white font-mono px-2 py-0.5 rounded">
                      TERKUNCI ({voucher.status})
                    </span>
                  )}
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-300">
                  {isApprovedAndLocked
                    ? 'Dokumen resmi sudah disetujui admin dan barang telah diserahkan secara fisik.'
                    : 'Edit item barang, tambah baris, atau sesuaikan jumlah permintaan sebelum di-ACC.'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
            {/* Warning Banner IF APPROVED */}
            {isApprovedAndLocked ? (
              <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl flex items-start gap-3 text-xs text-emerald-900">
                <ShieldAlert className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <strong className="block text-emerald-950 font-bold text-sm">
                    Sistem Edit & Hapus Dinonaktifkan (Status: {voucher.status})
                  </strong>
                  <p className="text-emerald-800 leading-relaxed">
                    Sesuai ketentuan integritas gudang: <strong>sistem hapus, edit, dan tambah item tidak akan aktif bagi user apabila sudah di-approve/acc admin</strong>.
                    Dokumen ini hanya dapat dilihat atau dicetak ulang.
                  </p>
                  <div className="mt-2 pt-2 border-t border-emerald-200/60 font-mono text-[11px] text-emerald-800">
                    Disetujui oleh: <strong>{voucher.approvedByAdmin}</strong> &middot; Tanggal: {voucher.approvedAt || voucher.handoverAt || '-'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
                <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Nota ini masih berstatus <strong>PENDING</strong>. Anda masih bebas <strong>menambah, mengganti, mengubah kuantiti, atau menghapus item</strong> sebelum Admin Gudang memproses approval.
                </p>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Basic Info Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Pemohon (User)</label>
                <input
                  type="text"
                  disabled
                  value={voucher.requestedBy}
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-slate-700 cursor-not-allowed font-medium"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Departemen</label>
                <input
                  type="text"
                  disabled
                  value={voucher.department}
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-slate-700 cursor-not-allowed font-medium"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-medium text-slate-700 mb-1">
                  Keperluan / Tujuan Pemakaian <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={isApprovedAndLocked}
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-medium text-slate-700 mb-1">Catatan Tambahan</label>
                <input
                  type="text"
                  disabled={isApprovedAndLocked}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Item Management Section */}
            <div className="pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Daftar Item Barang ({items.length} Macam &middot; {totalQuantity} Total Unit)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {isApprovedAndLocked
                      ? 'Daftar item terkunci permanen karena nota telah disetujui.'
                      : 'Cari cepat di bawah atau pilih banyak barang sekaligus dari Katalog.'}
                  </p>
                </div>

                {/* Tombol TAMBAH ITEM (Dinonaktifkan jika approved) */}
                {!isApprovedAndLocked && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowBarcodeAddScanner((prev) => !prev)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors shadow-xs shrink-0 ${
                        showBarcodeAddScanner
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                      }`}
                    >
                      <ScanBarcode className="w-3.5 h-3.5" />
                      <span>{showBarcodeAddScanner ? 'Tutup Scan Barcode' : '+ Scan Barcode Tambah Item'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenPickerForAdd}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs shrink-0"
                    >
                      <Boxes className="w-3.5 h-3.5 text-amber-400" />
                      <span>+ Pilih dari Katalog</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleAddNextAvailableRow}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Baris</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Barcode Scanner Panel for Directly Adding Items to Pending SIV */}
              {!isApprovedAndLocked && showBarcodeAddScanner && (
                <BarcodeAddScannerPanel
                  mode="SIV"
                  stockItems={stockItems}
                  initialAllocationsMap={initialAllocationsMap}
                  selectedQuantitiesMap={selectedQuantitiesMap}
                  onBarcodeAddItem={(item, qty) => addOrMergeItem(item, qty, null)}
                  onClose={() => setShowBarcodeAddScanner(false)}
                />
              )}

              {/* Quick Search & Direct Add Bar (Only when not locked) */}
              {!isApprovedAndLocked && (
                <div className="mb-3 relative">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 bg-slate-100/80 border border-slate-200 rounded-xl">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={quickSearchText}
                        onFocus={() => setShowQuickDropdown(true)}
                        onChange={(e) => {
                          setQuickSearchText(e.target.value);
                          setShowQuickDropdown(true);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && quickSearchText.trim()) {
                            e.preventDefault();
                            const clean = quickSearchText.trim().toUpperCase();
                            const exactMatch = stockItems.find(
                              (s) => s.sku.toUpperCase() === clean
                            );
                            const target =
                              exactMatch ||
                              (quickSearchResults.length === 1 ? quickSearchResults[0] : null);
                            if (target) {
                              addOrMergeItem(target, quickSearchQty, null);
                              setQuickSearchText('');
                              setShowQuickDropdown(false);
                            }
                          }
                        }}
                        placeholder="Scan Barcode (Enter) atau cari cepat Material Code / Nama Barang untuk ditambahkan ke nota ini..."
                        className="w-full pl-9 pr-14 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                      />
                      {quickSearchText && (
                        <button
                          type="button"
                          onClick={() => {
                            setQuickSearchText('');
                            setShowQuickDropdown(false);
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 hover:text-slate-700"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-medium text-slate-600">Qty Ambil:</span>
                      <input
                        type="number"
                        min="1"
                        value={quickSearchQty}
                        onChange={(e) =>
                          setQuickSearchQty(Math.max(1, parseInt(e.target.value) || 1))
                        }
                        className="w-16 px-2 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-xs text-center"
                      />
                    </div>
                  </div>

                  {showQuickDropdown && quickSearchText.trim().length > 0 && (
                    <div className="absolute left-0 right-0 mt-1 z-30 bg-white border border-slate-300 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100">
                      {quickSearchResults.length === 0 ? (
                        <div className="p-3 text-xs text-slate-500">
                          Tidak ditemukan barang dengan kata kunci <strong>"{quickSearchText}"</strong>.
                        </div>
                      ) : (
                        quickSearchResults.map((item) => {
                          const avail = getAvailableForItem(item);
                          const alreadyInList = items.some((i) => i.itemId === item.id);
                          return (
                            <div
                              key={item.id}
                              className="px-3.5 py-2.5 hover:bg-slate-50 flex items-center justify-between gap-2 text-xs transition-colors"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                                    {item.sku}
                                  </span>
                                  <span className="font-semibold text-slate-800">{item.name}</span>
                                  {alreadyInList && (
                                    <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                                      Sudah di daftar
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  Rak: {item.location} &bull; Siap Diambil:{' '}
                                  <strong className={avail > 0 ? 'text-emerald-700' : 'text-red-600'}>
                                    {avail} {item.unit}
                                  </strong>
                                </div>
                              </div>

                              {avail <= 0 ? (
                                <span className="text-[11px] font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded border border-red-200">
                                  Stok Habis
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    addOrMergeItem(item, quickSearchQty, null);
                                    setQuickSearchText('');
                                    setShowQuickDropdown(false);
                                  }}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg text-xs shrink-0 shadow-2xs"
                                >
                                  <Plus className="w-3.5 h-3.5 text-amber-400" />
                                  <span>
                                    {alreadyInList
                                      ? `+ Tambah (${Math.min(avail, quickSearchQty)})`
                                      : `+ Masukkan (${Math.min(avail, quickSearchQty)} ${item.unit})`}
                                  </span>
                                </button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Items List Responsive Cards */}
              {items.length === 0 ? (
                <div className="p-8 border-2 border-dashed border-slate-300 rounded-xl text-center space-y-3 bg-slate-50">
                  <p className="text-xs text-slate-600 font-medium">
                    Belum ada barang di dalam Nota SIV ini.
                  </p>
                  {!isApprovedAndLocked && (
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowBarcodeAddScanner(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-xs"
                      >
                        <ScanBarcode className="w-4 h-4" />
                        + Scan Barcode Tambah Barang
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenPickerForAdd}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs"
                      >
                        <Boxes className="w-4 h-4 text-amber-400" />
                        + Pilih Barang dari Katalog
                      </button>
                      <button
                        type="button"
                        onClick={handleAddNextAvailableRow}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg"
                      >
                        <Plus className="w-4 h-4" />
                        Tambah Baris Manual
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {items.map((row, idx) => {
                    const selected = stockItems.find((s) => s.id === row.itemId);
                    const available = getAvailableForItem(selected);

                    return (
                      <div
                        key={idx}
                        className={`p-3 sm:p-3.5 rounded-xl border transition-all space-y-2.5 ${
                          isApprovedAndLocked
                            ? 'border-emerald-200 bg-emerald-50/20'
                            : 'border-slate-200 bg-white hover:border-slate-300 shadow-2xs'
                        }`}
                      >
                        {/* Item Info Header */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                          <div className="space-y-1.5 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs font-bold bg-slate-100 text-slate-900 px-2 py-0.5 rounded">
                                {selected?.sku || 'MAT?'}
                              </span>
                              <span className="text-xs text-slate-500">{selected?.category}</span>
                              <span className="text-slate-300">·</span>
                              <span className="text-xs text-slate-600 font-mono flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-slate-400" />
                                {selected?.location || '-'}
                              </span>
                            </div>

                            {isApprovedAndLocked ? (
                              <div className="font-semibold text-slate-900 text-xs sm:text-sm">
                                {selected?.name || 'Barang Tidak Dikenal'}
                              </div>
                            ) : (
                              <select
                                value={row.itemId}
                                onChange={(e) => handleInlineItemChange(idx, e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-900 text-xs focus:bg-white focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                              >
                                {stockItems.map((st) => {
                                  const stAvail = getAvailableForItem(st);
                                  const usedInOther = items.some(
                                    (o, oIdx) => oIdx !== idx && o.itemId === st.id
                                  );
                                  return (
                                    <option
                                      key={st.id}
                                      value={st.id}
                                      disabled={stAvail <= 0 && st.id !== row.itemId}
                                    >
                                      {st.sku} — {st.name} (Tersedia: {stAvail} {st.unit})
                                      {usedInOther ? ' [Sudah di daftar]' : ''}
                                      {stAvail <= 0 ? ' [Stok Habis]' : ''}
                                    </option>
                                  );
                                })}
                              </select>
                            )}
                          </div>

                          {/* Actions (Ganti & Hapus) - Disabled if Approved */}
                          {!isApprovedAndLocked && (
                            <div className="flex items-center gap-1 shrink-0 self-end sm:self-start">
                              <button
                                type="button"
                                onClick={() => handleOpenPickerForReplace(idx)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                                title="Ganti barang ini melalui Katalog"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span>Katalog</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Hapus baris barang ini"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}

                          {isApprovedAndLocked && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 px-2.5 py-1 rounded-full">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Terkunci Resmi
                            </span>
                          )}
                        </div>

                        {/* Quantity Input & Stepper Bar */}
                        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-50 p-2.5 rounded-lg text-xs">
                          {!isApprovedAndLocked ? (
                            <>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-700">Jumlah Permintaan:</span>
                                <span className="text-[11px] text-slate-500 font-mono">
                                  (Maks. {available} {selected?.unit})
                                </span>
                              </div>

                              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                                <span className="text-[11px] text-slate-500 font-mono">
                                  Stok Min:{' '}
                                  <strong className="text-slate-800">
                                    {selected?.minStock || 0} {selected?.unit}
                                  </strong>
                                </span>
                                <span className="text-slate-300">·</span>
                                <span className="text-[11px] text-slate-500 font-mono">
                                  Tersedia:{' '}
                                  <strong className="text-emerald-700">
                                    {available} {selected?.unit}
                                  </strong>
                                </span>

                                <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white shadow-2xs">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleQtyChange(idx, row.requestedQty - 1, available)
                                    }
                                    disabled={row.requestedQty <= 1}
                                    className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <input
                                    type="number"
                                    min="1"
                                    max={available}
                                    value={row.requestedQty}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value, 10);
                                      if (!isNaN(val)) {
                                        handleQtyChange(idx, val, available);
                                      }
                                    }}
                                    className="w-14 py-1 text-center font-mono font-bold text-xs focus:outline-hidden"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleQtyChange(idx, row.requestedQty + 1, available)
                                    }
                                    disabled={row.requestedQty >= available}
                                    className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="w-full flex items-center justify-between text-xs">
                              <span className="text-slate-500">Jumlah Resmi Diserahkan:</span>
                              <span className="font-mono font-bold text-sm text-slate-900">
                                {row.requestedQty} {selected?.unit}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Cost Center & GL Account Row Selector */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          <div>
                            <label className="block text-[11px] font-medium text-slate-600 mb-1 flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-emerald-600" />
                              <span>Cost Center (Pusat Biaya)</span>
                            </label>
                            <select
                              disabled={isApprovedAndLocked}
                              value={row.costCenter || '60'}
                              onChange={(e) => handleCostCenterChange(idx, e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 disabled:bg-slate-100 disabled:text-slate-500 focus:bg-white focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                            >
                              {costCenters.map((cc) => (
                                <option key={cc.code} value={cc.code}>
                                  {cc.code} - {cc.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium text-slate-600 mb-1 flex items-center gap-1">
                              <BookOpen className="w-3 h-3 text-blue-600" />
                              <span>GL Account (Nomor Perkiraan)</span>
                            </label>
                            <select
                              disabled={isApprovedAndLocked}
                              value={row.glAcc || '51010'}
                              onChange={(e) => handleGlAccChange(idx, e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 disabled:bg-slate-100 disabled:text-slate-500 focus:bg-white focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                            >
                              {glAccounts.map((gl) => (
                                <option key={gl.code} value={gl.code}>
                                  {gl.code} - {gl.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                {isApprovedAndLocked ? 'Tutup Rincian' : 'Batal'}
              </button>

              {!isApprovedAndLocked && (
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs"
                >
                  Simpan Perubahan Nota
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Item Picker Modal for adding / replacing */}
      {!isApprovedAndLocked && (
        <ItemPickerModal
          isOpen={isPickerOpen}
          onClose={() => {
            setIsPickerOpen(false);
            setReplacingIndex(null);
          }}
          mode="SIV"
          stockItems={stockItems}
          selectedItemIds={items.map((i) => i.itemId)}
          selectedQuantitiesMap={selectedQuantitiesMap}
          initialAllocationsMap={initialAllocationsMap}
          onSelectItem={handleSelectItemFromPicker}
          title={replacingIndex !== null ? 'Ganti Item Barang (SIV)' : 'Pilih Item Barang untuk Nota SIV'}
          replaceModeIndex={replacingIndex}
        />
      )}
    </>
  );
};
