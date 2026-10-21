import React, { useState } from 'react';
import { StockItem, IssueVoucherDocument } from '../types/inventory';
import { useInventory } from '../context/InventoryContext';
import { ItemPickerModal } from './ItemPickerModal';
import {
  Plus,
  Trash2,
  FileText,
  X,
  AlertTriangle,
  Clock,
  Layers,
  MapPin,
  RefreshCw,
  Minus,
  Sliders,
  Building2,
  BookOpen,
} from 'lucide-react';

interface CreateIssueVoucherModalProps {
  stockItems: StockItem[];
  currentUser: { name: string; department: string };
  onClose: () => void;
  onSubmit: (data: {
    purpose: string;
    notes?: string;
    department?: string;
    items: { itemId: string; requestedQty: number; costCenter?: string; glAcc?: string }[];
  }) => { success: boolean; voucher?: IssueVoucherDocument; error?: string };
  onSuccessPrint: (doc: IssueVoucherDocument) => void;
}

export const CreateIssueVoucherModal: React.FC<CreateIssueVoucherModalProps> = ({
  stockItems,
  currentUser,
  onClose,
  onSubmit,
  onSuccessPrint,
}) => {
  const { costCenters, glAccounts } = useInventory();
  const [department, setDepartment] = useState(currentUser.department);
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');

  // Default Cost Center & GL Acc for new rows
  const [defaultCostCenter, setDefaultCostCenter] = useState('60');
  const [defaultGlAcc, setDefaultGlAcc] = useState('51010');

  // Items in voucher
  const [items, setItems] = useState<Array<{
    itemId: string;
    requestedQty: number;
    costCenter: string;
    glAcc: string;
  }>>([
    {
      itemId: stockItems[0]?.id || '',
      requestedQty: 1,
      costCenter: '60',
      glAcc: '51010',
    },
  ]);

  const [errorMsg, setErrorMsg] = useState('');

  // Item Picker Modal State
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);

  // 1. TAMBAH ITEM (Add item to voucher)
  const handleOpenPickerForAdd = () => {
    setReplacingIndex(null);
    setIsPickerOpen(true);
  };

  const handleOpenPickerForReplace = (index: number) => {
    setReplacingIndex(index);
    setIsPickerOpen(true);
  };

  const handleSelectItemFromPicker = (selectedItem: StockItem, requestedQty: number) => {
    if (replacingIndex !== null) {
      // Edit / Replace existing line
      setItems((prev) =>
        prev.map((it, idx) =>
          idx === replacingIndex ? { ...it, itemId: selectedItem.id, requestedQty } : it
        )
      );
    } else {
      // Add new item (if already exists, add quantity)
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
          {
            itemId: selectedItem.id,
            requestedQty,
            costCenter: defaultCostCenter,
            glAcc: defaultGlAcc,
          },
        ]);
      }
    }
  };

  const handleCostCenterChange = (index: number, costCenter: string) => {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, costCenter } : it))
    );
  };

  const handleGlAccChange = (index: number, glAcc: string) => {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, glAcc } : it))
    );
  };

  // 2. HAPUS ITEM (Delete item from voucher)
  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      setErrorMsg('Minimal satu item barang harus ada di dalam nota.');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // 3. EDIT ITEM (Update requested quantity)
  const handleQtyChange = (index: number, newQty: number, maxAvailable: number) => {
    const qty = Math.max(1, Math.min(newQty, Math.max(1, maxAvailable)));
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, requestedQty: qty } : item))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!purpose.trim()) {
      setErrorMsg('Tujuan atau keperluan pengambilan barang wajib diisi.');
      return;
    }

    if (items.length === 0) {
      setErrorMsg('Pilih minimal satu item barang.');
      return;
    }

    // Validate quantities against available stock
    for (const row of items) {
      const stock = stockItems.find((s) => s.id === row.itemId);
      if (!stock) {
        setErrorMsg('Salah satu item barang tidak valid.');
        return;
      }
      const available = stock.currentStock - stock.allocatedStock;
      if (row.requestedQty <= 0) {
        setErrorMsg(`Jumlah untuk "${stock.name}" harus lebih dari 0.`);
        return;
      }
      if (row.requestedQty > available) {
        setErrorMsg(
          `Jumlah permintaan untuk "${stock.name}" (${row.requestedQty}) melebihi stok yang siap diambil (${available} ${stock.unit}).`
        );
        return;
      }
    }

    const result = onSubmit({
      purpose: purpose.trim(),
      notes: notes.trim() || undefined,
      department: department.trim(),
      items: items.map((i) => ({
        itemId: i.itemId,
        requestedQty: Number(i.requestedQty),
        costCenter: i.costCenter || defaultCostCenter,
        glAcc: i.glAcc || defaultGlAcc,
      })),
    });

    if (result.success && result.voucher) {
      onClose();
      onSuccessPrint(result.voucher);
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
          <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-2.5">
              <FileText className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <h2 className="text-sm sm:text-base font-semibold">Buat Nota Pengambilan Barang (SIV)</h2>
                <p className="text-[11px] sm:text-xs text-slate-300">
                  Store Issue Voucher &middot; Permintaan Pengeluaran Stok Gudang
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
            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* User & Request Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Nama Pemohon (User)</label>
                <input
                  type="text"
                  disabled
                  value={currentUser.name}
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-slate-700 cursor-not-allowed font-medium"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Departemen / Unit Kerja <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="Misal: Dept. Produksi Line 1 / Maintenance"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-medium text-slate-700 mb-1">
                  Keperluan / Tujuan Pemakaian <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="Misal: Penggantian bearing pompa sirkulasi pendingin mesin no. 4"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-medium text-slate-700 mb-1">
                  Catatan Tambahan untuk Petugas Gudang (Opsional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Misal: Mohon disiapkan sebelum shift pagi berakhir"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Items Management Section */}
            <div className="pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Daftar Item Barang ({items.length} Macam &middot; {totalQuantity} Total Unit)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Pilih Cost Center & GL Account dan sesuaikan kuantiti per barang.
                  </p>
                </div>

                {/* Tombol TAMBAH ITEM via Katalog */}
                <button
                  type="button"
                  onClick={handleOpenPickerForAdd}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs shrink-0 self-start sm:self-auto"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-400" />
                  <span>+ Tambah Barang dari Katalog</span>
                </button>
              </div>

              {/* Default Cost Center & GL Account Selector for the Voucher */}
              <div className="mb-3 p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Cost Center (Pusat Biaya)</span>
                  </label>
                  <select
                    value={defaultCostCenter}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDefaultCostCenter(val);
                      setItems((prev) => prev.map((it) => ({ ...it, costCenter: val })));
                    }}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-800 text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                  >
                    {costCenters.map((cc) => (
                      <option key={cc.code} value={cc.code}>
                        {cc.code} - {cc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                    <span>GL Account (Nomor Perkiraan Akuntansi)</span>
                  </label>
                  <select
                    value={defaultGlAcc}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDefaultGlAcc(val);
                      setItems((prev) => prev.map((it) => ({ ...it, glAcc: val })));
                    }}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-800 text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                  >
                    {glAccounts.map((gl) => (
                      <option key={gl.code} value={gl.code}>
                        {gl.code} - {gl.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Items List - Mobile Responsive Card & Table */}
              <div className="space-y-2.5">
                {items.map((row, idx) => {
                  const selected = stockItems.find((s) => s.id === row.itemId);
                  const available = selected ? selected.currentStock - selected.allocatedStock : 0;
                  const isOver = row.requestedQty > available;

                  return (
                    <div
                      key={idx}
                      className="p-3 sm:p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-2xs space-y-2.5"
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

                        {/* Actions: Replace & Delete */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenPickerForReplace(idx)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                            title="Ganti dengan barang lain"
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
                      </div>

                      {/* Quantity Input & Stepper */}
                      <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-50 p-2.5 rounded-lg text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-700">Jumlah Permintaan:</span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            (Maks. {available} {selected?.unit})
                          </span>
                        </div>

                        {/* Stepper + Available Stock */}
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
                              className={`w-12 py-1 text-center font-mono font-bold text-xs focus:outline-hidden ${
                                isOver ? 'text-red-600 bg-red-50' : 'text-slate-900'
                              }`}
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
                      </div>

                      {/* Cost Center & GL Account Row Selector */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">
                            Cost Center (Item #{idx + 1})
                          </label>
                          <select
                            value={row.costCenter || defaultCostCenter}
                            onChange={(e) => handleCostCenterChange(idx, e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                          >
                            {costCenters.map((cc) => (
                              <option key={cc.code} value={cc.code}>
                                {cc.code} - {cc.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">
                            GL Account (Item #{idx + 1})
                          </label>
                          <select
                            value={row.glAcc || defaultGlAcc}
                            onChange={(e) => handleGlAccChange(idx, e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
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

            {/* Workflow Notice */}
            <div className="p-3 bg-amber-50/80 rounded-lg border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <strong className="block text-amber-800">
                  Ketentuan Penguncian Dokumen
                </strong>
                <p className="text-[11px] text-amber-900 leading-relaxed">
                  Setelah terbit, nota berstatus <em>PENDING</em> dan stok belum berkurang. 
                  <strong className="text-amber-950 font-bold"> Begitu di-approve/ACC oleh Admin Gudang, sistem tambah, edit, dan hapus item akan otomatis dinonaktifkan permanen</strong>.
                </p>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs"
              >
                <FileText className="w-4 h-4 text-amber-400" />
                Terbitkan Nota Pengambilan
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Item Picker Modal for searching & adding warehouse items */}
      <ItemPickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        stockItems={stockItems}
        selectedItemIds={items.map((i) => i.itemId)}
        onSelectItem={handleSelectItemFromPicker}
        title={replacingIndex !== null ? 'Ganti Item Barang' : 'Pilih Item Barang untuk Nota'}
        replaceModeIndex={replacingIndex}
      />
    </>
  );
};
