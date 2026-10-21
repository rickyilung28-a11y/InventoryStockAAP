import React, { useState } from 'react';
import { StockItem, IssueVoucherDocument } from '../types/inventory';
import { useInventory } from '../context/InventoryContext';
import { ItemPickerModal } from './ItemPickerModal';
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
  Sliders,
  Building2,
  BookOpen,
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
  if (!voucher) return null;

  const { costCenters, glAccounts } = useInventory();

  // STRICT REQUIREMENT CHECK:
  // Sistem hapus edit dan tambah TIDAK AKAN AKTIF bagi user apabila sudah di-approve/acc admin
  const isApprovedAndLocked = voucher.status === 'APPROVED';

  const [purpose, setPurpose] = useState(voucher.purpose);
  const [notes, setNotes] = useState(voucher.notes || '');
  const [items, setItems] = useState<Array<{
    itemId: string;
    requestedQty: number;
    costCenter?: string;
    glAcc?: string;
  }>>(
    voucher.items.map((i) => ({
      itemId: i.itemId,
      requestedQty: i.requestedQty,
      costCenter: i.costCenter || '60',
      glAcc: i.glAcc || '51010',
    }))
  );
  const [errorMsg, setErrorMsg] = useState('');

  // Item Picker Modal State
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);

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
    if (isApprovedAndLocked) return;

    if (replacingIndex !== null) {
      setItems((prev) =>
        prev.map((it, idx) =>
          idx === replacingIndex ? { ...it, itemId: selectedItem.id, requestedQty } : it
        )
      );
    } else {
      const existingIdx = items.findIndex((i) => i.itemId === selectedItem.id);
      if (existingIdx >= 0) {
        setItems((prev) =>
          prev.map((it, idx) =>
            idx === existingIdx
              ? { ...it, requestedQty: it.requestedQty + requestedQty }
              : it
          )
        );
      } else {
        setItems((prev) => [
          ...prev,
          { itemId: selectedItem.id, requestedQty, costCenter: '60', glAcc: '51010' },
        ]);
      }
    }
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
    if (items.length <= 1) {
      setErrorMsg('Minimal satu item barang harus ada di dalam nota.');
      return;
    }
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

  const totalQuantity = items.reduce((acc, i) => acc + Number(i.requestedQty || 0), 0);

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
        <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4 max-h-[92vh] flex flex-col">
          {/* Header */}
          <div
            className={`flex items-center justify-between px-4 sm:px-6 py-3.5 text-white shrink-0 ${
              isApprovedAndLocked ? 'bg-slate-900' : 'bg-slate-900'
            }`}
          >
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
                      TERKUNCI (APPROVED)
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
                    Sistem Edit & Hapus Dinonaktifkan (Status: APPROVED)
                  </strong>
                  <p className="text-emerald-800 leading-relaxed">
                    Sesuai ketentuan integritas gudang: <strong>sistem hapus, edit, dan tambah item tidak akan aktif bagi user apabila sudah di-approve/acc admin</strong>.
                    Barang telah resmi diserahkan dan saldo stok fisik telah dipotong dari rak. Dokumen ini hanya dapat dilihat atau dicetak ulang.
                  </p>
                  <div className="mt-2 pt-2 border-t border-emerald-200/60 font-mono text-[11px] text-emerald-800">
                    Disetujui oleh: <strong>{voucher.approvedByAdmin}</strong> &middot; Tanggal: {voucher.approvedAt || '-'}
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
                      : 'Gunakan slider atau stepper untuk menyesuaikan kuantiti barang.'}
                  </p>
                </div>

                {/* Tombol TAMBAH ITEM (Dinonaktifkan jika approved) */}
                {!isApprovedAndLocked && (
                  <button
                    type="button"
                    onClick={handleOpenPickerForAdd}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs shrink-0 self-start sm:self-auto"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-400" />
                    <span>+ Tambah Barang dari Katalog</span>
                  </button>
                )}
              </div>

              {/* Items List Responsive Cards */}
              <div className="space-y-2.5">
                {items.map((row, idx) => {
                  const selected = stockItems.find((s) => s.id === row.itemId);
                  // Calculate available stock including current row reservation
                  const initialRequested = voucher.items.find((i) => i.itemId === row.itemId)?.requestedQty || 0;
                  const available = selected
                    ? selected.currentStock - selected.allocatedStock + initialRequested
                    : 0;

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
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold bg-slate-100 text-slate-900 px-2 py-0.5 rounded">
                              {selected?.sku || 'SKU?'}
                            </span>
                            <span className="text-xs text-slate-500">{selected?.category}</span>
                            <span className="text-slate-300">·</span>
                            <span className="text-xs text-slate-600 font-mono flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              {selected?.location || '-'}
                            </span>
                          </div>

                          <div className="font-semibold text-slate-900 text-xs sm:text-sm">
                            {selected?.name || 'Barang Tidak Dikenal'}
                          </div>
                        </div>

                        {/* Actions (Ganti & Hapus) - Disabled if Approved */}
                        {!isApprovedAndLocked && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleOpenPickerForReplace(idx)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                              title="Ganti barang ini"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span className="hidden sm:inline">Ganti</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              disabled={items.length <= 1}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-30 transition-colors"
                              title="Hapus baris barang ini"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                        {isApprovedAndLocked && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 px-2.5 py-1 rounded-full">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Telah Diserahkan Fisik
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
                                Stok Min: <strong className="text-slate-800">{selected?.minStock || 0} {selected?.unit}</strong>
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
                                  onClick={() => handleQtyChange(idx, row.requestedQty - 1, available)}
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
                                  onChange={(e) =>
                                    handleQtyChange(idx, parseInt(e.target.value) || 1, available)
                                  }
                                  className="w-12 py-1 text-center font-mono font-bold text-xs focus:outline-hidden"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleQtyChange(idx, row.requestedQty + 1, available)}
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
          onClose={() => setIsPickerOpen(false)}
          stockItems={stockItems}
          selectedItemIds={items.map((i) => i.itemId)}
          onSelectItem={handleSelectItemFromPicker}
          title={replacingIndex !== null ? 'Ganti Item Barang' : 'Pilih Item Barang untuk Nota'}
          replaceModeIndex={replacingIndex}
        />
      )}
    </>
  );
};
