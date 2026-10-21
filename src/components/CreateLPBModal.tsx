import React, { useState, useRef } from 'react';
import { StockItem, LPBDocument } from '../types/inventory';
import { useInventory } from '../context/InventoryContext';
import { ItemPickerModal } from './ItemPickerModal';
import {
  Plus,
  Trash2,
  FileCheck,
  X,
  AlertTriangle,
  Truck,
  Layers,
  ScanBarcode,
  CheckCircle2,
  Sparkles,
  QrCode,
  ShieldCheck,
} from 'lucide-react';

interface CreateLPBModalProps {
  stockItems: StockItem[];
  onClose: () => void;
  onSubmit: (data: {
    sjNumber: string;
    sjDate: string;
    supplierName: string;
    receivedDate: string;
    poNumber?: string;
    driverName?: string;
    vehiclePlate?: string;
    usagePurpose?: string;
    storageLocation?: string;
    notes?: string;
    items: {
      itemId: string;
      quantity: number;
      batchNo?: string;
      condition: 'Baik' | 'Kurang' | 'Rusak';
      notes?: string;
      storageLocation?: string;
      barcodeValidated?: boolean;
      barcodeScannedAt?: string;
    }[];
  }) => LPBDocument;
  onSuccessPrint: (doc: LPBDocument) => void;
}

export const CreateLPBModal: React.FC<CreateLPBModalProps> = ({
  stockItems,
  onClose,
  onSubmit,
  onSuccessPrint,
}) => {
  const { storageLocations, currentUser } = useInventory();
  const today = new Date().toISOString().split('T')[0];

  const [sjNumber, setSjNumber] = useState('');
  const [sjDate, setSjDate] = useState(today);
  const [supplierName, setSupplierName] = useState('');
  const [receivedDate, setReceivedDate] = useState(today);
  const [poNumber, setPoNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [usagePurpose, setUsagePurpose] = useState('Persediaan Gudang & Produksi');
  const [notes, setNotes] = useState('');

  // Barcode scan validation state for Admin Gudang
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanFeedback, setScanFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<
    Array<{
      itemId: string;
      quantity: number;
      batchNo: string;
      condition: 'Baik' | 'Kurang' | 'Rusak';
      notes: string;
      storageLocation: string;
      barcodeValidated: boolean;
      barcodeScannedAt?: string;
    }>
  >([
    {
      itemId: stockItems[0]?.id || '',
      quantity: 10,
      batchNo: '',
      condition: 'Baik',
      notes: '',
      storageLocation: stockItems[0]?.location || storageLocations[0]?.code || 'Rak A-01',
      barcodeValidated: false,
    },
  ]);

  const [errorMsg, setErrorMsg] = useState('');
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const handleAddItemRow = () => {
    const firstItem = stockItems[0];
    setItems((prev) => [
      ...prev,
      {
        itemId: firstItem?.id || '',
        quantity: 1,
        batchNo: '',
        condition: 'Baik',
        notes: '',
        storageLocation: firstItem?.location || storageLocations[0]?.code || 'Rak A-01',
        barcodeValidated: false,
      },
    ]);
  };

  const handleSelectFromPicker = (selectedItem: StockItem, qty: number) => {
    const existing = items.findIndex((i) => i.itemId === selectedItem.id);
    if (existing >= 0) {
      setItems((prev) =>
        prev.map((it, idx) =>
          idx === existing ? { ...it, quantity: it.quantity + qty } : it
        )
      );
    } else {
      setItems((prev) => [
        ...prev,
        {
          itemId: selectedItem.id,
          quantity: qty,
          batchNo: '',
          condition: 'Baik',
          notes: '',
          storageLocation: selectedItem.location || storageLocations[0]?.code || 'Rak A-01',
          barcodeValidated: false,
        },
      ]);
    }
  };

  const handleRemoveItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: unknown) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        if (field === 'itemId') {
          const matched = stockItems.find((s) => s.id === value);
          return {
            ...item,
            itemId: value as string,
            storageLocation: matched?.location || item.storageLocation,
            barcodeValidated: false,
            barcodeScannedAt: undefined,
          };
        }
        return { ...item, [field]: value };
      })
    );
  };

  // Scan Barcode untuk Validasi Barang Masuk oleh Admin Gudang
  const processBarcodeScan = (rawCode: string) => {
    const code = rawCode.trim().toUpperCase();
    if (!code) return;
    setErrorMsg('');

    const matchedStock = stockItems.find(
      (s) =>
        s.sku.toUpperCase() === code ||
        s.id.toUpperCase() === code ||
        s.name.toUpperCase().includes(code)
    );

    if (!matchedStock) {
      setScanFeedback({
        type: 'error',
        text: `Kode Barcode "${rawCode}" tidak ditemukan di Katalog Master Barang!`,
      });
      return;
    }

    const nowIso = new Date().toISOString();
    const rowIdx = items.findIndex((it) => it.itemId === matchedStock.id);

    if (rowIdx >= 0) {
      setItems((prev) =>
        prev.map((row, i) =>
          i === rowIdx
            ? { ...row, barcodeValidated: true, barcodeScannedAt: nowIso }
            : row
        )
      );
      setScanFeedback({
        type: 'success',
        text: `Barcode [${matchedStock.sku}] — "${matchedStock.name}" berhasil Tervalidasi oleh Admin Gudang!`,
      });
    } else {
      setItems((prev) => [
        ...prev,
        {
          itemId: matchedStock.id,
          quantity: 1,
          batchNo: '',
          condition: 'Baik',
          notes: 'Ditambahkan & divalidasi via Scan Barcode',
          storageLocation: matchedStock.location || 'Rak A-01',
          barcodeValidated: true,
          barcodeScannedAt: nowIso,
        },
      ]);
      setScanFeedback({
        type: 'success',
        text: `Barcode [${matchedStock.sku}] — "${matchedStock.name}" otomatis ditambahkan ke daftar LPB & Tervalidasi!`,
      });
    }

    setBarcodeInput('');
  };

  const handleScanAllBarcodes = () => {
    const nowIso = new Date().toISOString();
    setItems((prev) =>
      prev.map((row) => ({
        ...row,
        barcodeValidated: true,
        barcodeScannedAt: row.barcodeScannedAt || nowIso,
      }))
    );
    setScanFeedback({
      type: 'success',
      text: 'Seluruh item barang masuk pada LPB ini telah divalidasi scan barcode oleh Admin Gudang.',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (currentUser?.role !== 'admin') {
      setErrorMsg(
        'Hanya User Admin Gudang yang berwenang melakukan ACC & validasi/scan barang masuk LPB.'
      );
      return;
    }

    if (!sjNumber.trim()) {
      setErrorMsg('Nomor Surat Jalan (SJ) Supplier wajib diisi.');
      return;
    }
    if (!supplierName.trim()) {
      setErrorMsg('Nama Supplier / Vendor wajib diisi.');
      return;
    }
    if (items.length === 0) {
      setErrorMsg('Minimal satu barang harus dicantumkan.');
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const itm = items[i];
      const stockObj = stockItems.find((s) => s.id === itm.itemId);
      if (!itm.itemId) {
        setErrorMsg(`Pilih barang pada baris ke-${i + 1}.`);
        return;
      }
      if (Number(itm.quantity) <= 0) {
        setErrorMsg(`Jumlah diterima pada baris ke-${i + 1} harus lebih dari 0.`);
        return;
      }
      if (!itm.barcodeValidated) {
        setErrorMsg(
          `Barang "${stockObj?.name || 'Baris ' + (i + 1)}" (${stockObj?.sku || ''}) belum divalidasi Scan Barcode! Silakan klik "Scan Barcode" atau "Simulasi Scan Semua Barcode" terlebih dahulu.`
        );
        return;
      }
    }

    const createdDoc = onSubmit({
      sjNumber: sjNumber.trim(),
      sjDate,
      supplierName: supplierName.trim(),
      receivedDate,
      poNumber: poNumber.trim(),
      driverName: driverName.trim(),
      vehiclePlate: vehiclePlate.trim(),
      usagePurpose: usagePurpose.trim(),
      storageLocation: items[0]?.storageLocation || 'Rak A-01',
      notes: notes.trim(),
      items: items.map((i) => ({
        itemId: i.itemId,
        quantity: Number(i.quantity),
        batchNo: i.batchNo.trim(),
        condition: i.condition,
        notes: i.notes.trim(),
        storageLocation: i.storageLocation || 'Rak A-01',
        barcodeValidated: i.barcodeValidated,
        barcodeScannedAt: i.barcodeScannedAt || new Date().toISOString(),
      })),
    });

    onClose();
    onSuccessPrint(createdDoc);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4 max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <Truck className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold">
                  Tahap 1 (Admin Gudang): Input SJ Supplier, ACC &amp; Validasi/Scan Barang Masuk
                </h2>
                <span className="px-2 py-0.5 rounded bg-blue-600 text-white text-[10px] font-mono font-bold uppercase">
                  VALIDASI ADMIN GUDANG
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-300">
                User Admin melakukan ACC &amp; validasi/scan barang masuk (stok belum bertambah). Penambahan stock akan di-approve oleh User Kepala Gudang.
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

          {/* SJ & Supplier Information */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                No. Surat Jalan (SJ) Supplier <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={sjNumber}
                onChange={(e) => setSjNumber(e.target.value)}
                placeholder="Misal: SJ/2026/X/1092"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Tanggal SJ Supplier <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={sjDate}
                onChange={(e) => setSjDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Tanggal Diterima Gudang <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-medium text-slate-700 mb-1">
                Nama Supplier / Vendor <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Misal: PT Schneider Electric / PT Krakatau Steel / Distributor Resmi"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">No. Purchase Order (PO)</label>
              <input
                type="text"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                placeholder="Misal: PO-WHS-2026-1088"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Nama Pengemudi / Ekspedisi</label>
              <input
                type="text"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="Misal: Agus Setiawan (Kargo)"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Plat Nomor Kendaraan</label>
              <input
                type="text"
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value)}
                placeholder="Misal: B 9241 UZX"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden font-mono uppercase"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Catatan Dokumen / Kondisi Kemasan</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Misal: Segel palet utuh, dokumen lengkap"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Scanner Barcode Validasi Barang Masuk oleh Admin Gudang */}
          <div className="bg-blue-950 text-white rounded-xl p-3.5 border border-blue-800 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-blue-400 shrink-0" />
                <div>
                  <h3 className="text-xs font-bold text-white">
                    Validasi Scan Barcode Barang Masuk (Oleh User Admin Gudang)
                  </h3>
                  <p className="text-[11px] text-blue-200">
                    Scan barcode barang yang diterima atau klik tombol <strong>Scan Barcode</strong> pada baris tabel di bawah.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleScanAllBarcodes}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-800 hover:bg-blue-700 text-blue-100 rounded-lg text-xs font-semibold border border-blue-600 transition-colors shrink-0 self-start sm:self-auto"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Simulasi Scan Semua Barcode</span>
              </button>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <ScanBarcode className="w-4 h-4 text-blue-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      processBarcodeScan(barcodeInput);
                    }
                  }}
                  placeholder="Scan barcode atau ketik Kode SKU (contoh: SKU-SPR-001) lalu tekan Enter..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-blue-700 rounded-lg text-xs text-white placeholder-slate-400 font-mono focus:ring-2 focus:ring-blue-400 focus:outline-hidden"
                />
              </div>
              <button
                type="button"
                onClick={() => processBarcodeScan(barcodeInput)}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors shrink-0"
              >
                Scan / Validasi
              </button>
            </div>

            {scanFeedback && (
              <div
                className={`p-2 rounded-lg text-xs flex items-center gap-2 font-medium ${
                  scanFeedback.type === 'success'
                    ? 'bg-emerald-900/80 text-emerald-100 border border-emerald-600'
                    : 'bg-red-900/80 text-red-100 border border-red-600'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{scanFeedback.text}</span>
              </div>
            )}
          </div>

          {/* Items Section */}
          <div className="pt-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Item Barang Masuk &amp; Status Scan ({items.length} Barang)
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPickerOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-2xs"
                >
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  + Pilih dari Katalog
                </button>
                <button
                  type="button"
                  onClick={handleAddItemRow}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah Baris
                </button>
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2.5">Pilih Barang Master</th>
                    <th className="px-3 py-2.5 text-center">Validasi Barcode (Admin)</th>
                    <th className="px-3 py-2.5 text-right w-24">Jumlah Qty</th>
                    <th className="px-3 py-2.5 text-center w-24">Kondisi</th>
                    <th className="px-3 py-2.5 w-32">Lot / Batch</th>
                    <th className="px-3 py-2.5 w-10 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((row, idx) => {
                    const selectedItem = stockItems.find((s) => s.id === row.itemId);
                    return (
                      <tr
                        key={idx}
                        className={row.barcodeValidated ? 'bg-emerald-50/30' : 'hover:bg-slate-50/50'}
                      >
                        <td className="px-3 py-2">
                          <select
                            value={row.itemId}
                            onChange={(e) => handleItemChange(idx, 'itemId', e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden bg-white"
                          >
                            {stockItems.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.sku} - {s.name} (Stok Saat Ini: {s.currentStock} {s.unit})
                              </option>
                            ))}
                          </select>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Lokasi: {selectedItem?.location || '-'} | Satuan: {selectedItem?.unit || 'Pcs'}
                          </div>
                        </td>

                        <td className="px-3 py-2 text-center">
                          {row.barcodeValidated ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[11px] border border-emerald-300">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Barcode Tervalidasi
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                selectedItem && processBarcodeScan(selectedItem.sku)
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[11px] font-semibold shadow-2xs transition-colors"
                            >
                              <ScanBarcode className="w-3.5 h-3.5" />
                              <span>Scan Barcode</span>
                            </button>
                          )}
                        </td>

                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min="1"
                            value={row.quantity}
                            onChange={(e) =>
                              handleItemChange(idx, 'quantity', parseInt(e.target.value) || 0)
                            }
                            className="w-20 px-2 py-1.5 border border-slate-300 rounded text-right font-mono font-semibold focus:ring-1 focus:ring-slate-900 focus:outline-hidden text-xs bg-white"
                          />
                        </td>

                        <td className="px-3 py-2 text-center">
                          <select
                            value={row.condition}
                            onChange={(e) => handleItemChange(idx, 'condition', e.target.value)}
                            className="px-2 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden bg-white"
                          >
                            <option value="Baik">Baik</option>
                            <option value="Kurang">Kurang</option>
                            <option value="Rusak">Rusak</option>
                          </select>
                        </td>

                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={row.batchNo}
                            onChange={(e) => handleItemChange(idx, 'batchNo', e.target.value)}
                            placeholder="No. Lot/Batch"
                            className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden font-mono bg-white"
                          />
                        </td>

                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            disabled={items.length <= 1}
                            onClick={() => handleRemoveItemRow(idx)}
                            className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                            title="Hapus baris"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notice */}
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-xs text-blue-950 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
            <div>
              <strong>Prosedur Pemisahan Wewenang Penambahan Stock (LPB):</strong>
              <ul className="list-disc list-inside mt-0.5 space-y-0.5 text-[11px] text-blue-900">
                <li>
                  <strong>User Admin Gudang:</strong> Hanya melakukan ACC &amp; validasi barang / scan barcode penerimaan SJ Supplier. Saat disimpan, <strong>stok fisik gudang belum bertambah</strong>.
                </li>
                <li>
                  <strong>User Kepala Gudang:</strong> Melakukan <strong>Approve Penambahan Stock</strong> pada dokumen LPB ini sehingga saldo stok fisik di sistem otomatis bertambah dan tercatat di Kartu Stok.
                </li>
              </ul>
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
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors shadow-xs"
            >
              <FileCheck className="w-4 h-4 text-white" />
              ACC &amp; Validasi Barang Masuk LPB (Admin Gudang)
            </button>
          </div>
        </form>
      </div>

      <ItemPickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        stockItems={stockItems}
        selectedItemIds={items.map((i) => i.itemId)}
        onSelectItem={handleSelectFromPicker}
        title="Pilih Barang dari Master untuk Penerimaan SJ"
        subtitle="Pilih item dari master stok untuk ditambahkan ke daftar penerimaan LPB."
      />
    </div>
  );
};
