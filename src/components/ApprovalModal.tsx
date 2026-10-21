import React, { useState, useEffect, useRef } from 'react';
import { IssueVoucherDocument, StockItem, UserRole } from '../types/inventory';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  PackageCheck,
  ShieldCheck,
  ShieldAlert,
  X,
  ScanBarcode,
  QrCode,
  CheckSquare,
  Square,
  ArrowRight,
  Clock,
  Sparkles,
  FileCheck2,
  Ban,
  Lock,
} from 'lucide-react';

interface ApprovalModalProps {
  voucher: IssueVoucherDocument | null;
  stockItems: StockItem[];
  currentAdminName: string;
  currentUserRole?: UserRole;
  warehouseHeadDefaultName?: string;
  onClose: () => void;
  onApprove: (handoverData: {
    warehouseHeadName?: string;
    approverAdminName?: string;
    notes?: string;
    handoverOfficer?: string;
    recipientName?: string;
  }) => void;
  onCompleteHandover?: (handoverData: {
    handoverOfficer?: string;
    recipientName: string;
    warehouseHeadName?: string;
    notes?: string;
    validatedItems: {
      itemId: string;
      issuedQty: number;
      isCancelled: boolean;
      barcodeScanned?: boolean;
    }[];
  }) => { success: boolean; voucher?: IssueVoucherDocument; error?: string };
  onReject: (reason: string) => void;
  onSuccessPrint?: (voucher: IssueVoucherDocument) => void;
}

interface ItemHandoverState {
  itemId: string;
  sku: string;
  itemName: string;
  unit: string;
  requestedQty: number;
  issuedQty: number;
  isCancelled: boolean; // Centang barang tidak jadi dikeluarkan (qty = 0)
  barcodeValidated: boolean; // Hasil validasi scan barcode
  barcodeScannedAt?: string;
}

export const ApprovalModal: React.FC<ApprovalModalProps> = ({
  voucher,
  stockItems,
  currentAdminName,
  currentUserRole = 'admin',
  warehouseHeadDefaultName = 'Suryadi',
  onClose,
  onApprove,
  onCompleteHandover,
  onReject,
  onSuccessPrint,
}) => {
  if (!voucher) return null;

  // Prosedur Resmi SIV:
  // 1. Status 'PENDING': Tahap Validasi oleh User Admin Gudang
  //    -> Admin Gudang meng-ACC SIV, validasi scan barcode barang & isi qty barang yang diserahkan.
  //    -> SIV terkunci (pemohon tidak bisa edit/hapus), tetapi stock fisik BELUM berubah.
  // 2. Status 'APPROVED': Tahap Verifikasi Pengeluaran Stock oleh User Kepala Gudang
  //    -> Kepala Gudang memverifikasi pengeluaran stock yang dilakukan Admin Gudang dan OTOMATIS mempengaruhi stock.
  const isAdminValidationStage = voucher.status === 'PENDING';
  const isHeadVerificationStage = voucher.status === 'APPROVED';

  const canPerformAdminValidation = currentUserRole === 'admin';
  const canPerformHeadApproval = currentUserRole === 'kepala_gudang';

  // State untuk Tahap Admin Gudang (ACC SIV & Validasi Barang/Qty)
  const [recipientName, setRecipientName] = useState(
    voucher.recipientName || voucher.requestedBy || ''
  );
  const [handoverOfficer, setHandoverOfficer] = useState(
    voucher.handoverOfficer || voucher.approvedByAdmin || currentAdminName || 'Hendra Gunawan'
  );
  const [handoverNotes, setHandoverNotes] = useState(voucher.notes || '');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanFeedback, setScanFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    text: string;
  } | null>(null);

  // State untuk Tahap Kepala Gudang (Verifikasi Pengeluaran Stock & Potong Stock)
  const [warehouseHeadName, setWarehouseHeadName] = useState(
    voucher.warehouseHeadName ||
      voucher.approvedByWarehouseHead ||
      (currentUserRole === 'kepala_gudang' ? currentAdminName : warehouseHeadDefaultName) ||
      'Suryadi'
  );
  const [headVerificationNotes, setHeadVerificationNotes] = useState('');

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const [itemsState, setItemsState] = useState<ItemHandoverState[]>(() =>
    voucher.items.map((it) => ({
      itemId: it.itemId,
      sku: it.sku,
      itemName: it.itemName,
      unit: it.unit,
      requestedQty: it.requestedQty,
      issuedQty:
        it.issuedQty !== undefined
          ? it.issuedQty
          : it.approvedQty !== undefined
          ? it.approvedQty
          : it.requestedQty,
      isCancelled: it.isCancelled || false,
      barcodeValidated: it.barcodeValidated || false,
      barcodeScannedAt: it.barcodeScannedAt,
    }))
  );

  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isAdminValidationStage && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [isAdminValidationStage]);

  // Fungsi memproses hasil scan barcode (via scanner USB / ketik manual / tombol simulasi scan)
  const processBarcodeScan = (rawCode: string) => {
    const code = rawCode.trim().toUpperCase();
    if (!code) return;

    setErrorMsg('');
    const matchIdx = itemsState.findIndex(
      (i) =>
        i.sku.toUpperCase() === code ||
        i.itemId.toUpperCase() === code ||
        i.itemName.toUpperCase().includes(code)
    );

    if (matchIdx === -1) {
      setScanFeedback({
        type: 'error',
        text: `Kode Barcode "${rawCode}" tidak ditemukan dalam daftar barang Nota SIV #${voucher.voucherNumber}!`,
      });
      return;
    }

    const nowIso = new Date().toISOString();
    const target = itemsState[matchIdx];

    setItemsState((prev) =>
      prev.map((row, idx) => {
        if (idx !== matchIdx) return row;
        const restoredQty =
          row.isCancelled || row.issuedQty === 0 ? row.requestedQty : row.issuedQty;
        return {
          ...row,
          barcodeValidated: true,
          barcodeScannedAt: nowIso,
          isCancelled: false,
          issuedQty: restoredQty,
        };
      })
    );

    setScanFeedback({
      type: 'success',
      text: `Barcode [${target.sku}] — "${target.itemName}" berhasil Tervalidasi! Silakan pastikan jumlah pengeluaran (${target.requestedQty} ${target.unit}).`,
    });
    setBarcodeInput('');
  };

  const handleBarcodeFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processBarcodeScan(barcodeInput);
  };

  // Ubah Qty barang yang dikeluarkan
  // Apabila diisi 0, maka otomatis dianggap "barang tidak jadi dikeluarkan" (isCancelled = true)
  const handleIssuedQtyChange = (idx: number, rawVal: string) => {
    const parsed = Math.max(0, parseInt(rawVal || '0', 10) || 0);
    setErrorMsg('');
    setItemsState((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row;
        const isZero = parsed === 0;
        return {
          ...row,
          issuedQty: parsed,
          isCancelled: isZero,
          barcodeValidated: isZero ? true : row.barcodeValidated,
        };
      })
    );
  };

  // Centang / uncentang "Barang tidak jadi dikeluarkan" (otomatis set Qty = 0)
  const handleToggleCancelItem = (idx: number) => {
    setErrorMsg('');
    setItemsState((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row;
        const nextCancelled = !row.isCancelled;
        return {
          ...row,
          isCancelled: nextCancelled,
          issuedQty: nextCancelled ? 0 : row.requestedQty,
          barcodeValidated: nextCancelled ? true : row.barcodeValidated,
        };
      })
    );
  };

  // Validasi semua barcode sekaligus (untuk kemudahan demo / percepatan)
  const handleScanAllBarcodes = () => {
    const nowIso = new Date().toISOString();
    setItemsState((prev) =>
      prev.map((row) => ({
        ...row,
        barcodeValidated: true,
        barcodeScannedAt: row.barcodeScannedAt || nowIso,
      }))
    );
    setScanFeedback({
      type: 'success',
      text: 'Seluruh item barang pada Nota SIV ini telah berhasil divalidasi barcode.',
    });
  };

  // Tahap Admin Gudang: ACC SIV & Validasi Barang + Qty Diserahkan
  // -> SIV Terkunci, Pemohon tidak bisa edit/hapus, tetapi Stock fisik belum berubah!
  const handleConfirmAdminValidation = () => {
    setErrorMsg('');

    if (!canPerformAdminValidation) {
      setErrorMsg('Hanya User Admin Gudang yang memiliki wewenang untuk ACC SIV & Validasi/Scan Barang.');
      return;
    }

    if (!recipientName.trim()) {
      setErrorMsg('Nama Penerima barang wajib diinputkan oleh Admin Gudang.');
      return;
    }

    if (!handoverOfficer.trim()) {
      setErrorMsg('Nama User Admin Gudang yang meng-ACC SIV wajib diisi.');
      return;
    }

    // Cek apakah semua barang yang qty > 0 sudah di-scan barcode & stok fisik mencukupi
    for (const row of itemsState) {
      if (!row.isCancelled && row.issuedQty > 0) {
        if (!row.barcodeValidated) {
          setErrorMsg(
            `Barang "${row.itemName}" (${row.sku}) belum divalidasi Scan Barcode! Silakan scan barcode barang tersebut atau centang "Tidak Jadi Dikeluarkan (Qty 0)".`
          );
          return;
        }

        const stock = stockItems.find((s) => s.id === row.itemId || s.sku === row.sku);
        const currentStock = stock ? stock.currentStock : 0;
        if (row.issuedQty > currentStock) {
          setErrorMsg(
            `Jumlah pengeluaran "${row.itemName}" (${row.issuedQty} ${row.unit}) melebihi stok fisik di rak (${currentStock} ${row.unit}).`
          );
          return;
        }
      }
    }

    if (onCompleteHandover) {
      const res = onCompleteHandover({
        recipientName: recipientName.trim(),
        handoverOfficer: handoverOfficer.trim() || currentAdminName,
        warehouseHeadName: warehouseHeadName.trim() || warehouseHeadDefaultName,
        notes: handoverNotes.trim() || undefined,
        validatedItems: itemsState.map((i) => ({
          itemId: i.itemId,
          issuedQty: i.isCancelled ? 0 : i.issuedQty,
          isCancelled: i.isCancelled || i.issuedQty === 0,
          barcodeScanned: i.barcodeValidated,
        })),
      });

      if (!res.success && res.error) {
        setErrorMsg(res.error);
      } else if (res.success && res.voucher && onSuccessPrint) {
        onSuccessPrint(res.voucher);
      }
    }
  };

  // Tahap Kepala Gudang: Approve Pengurangan Stock yang sudah divalidasi/di-scan Admin Gudang
  // -> Otomatis mempengaruhi (memotong) stock pada sistem!
  const handleConfirmHeadVerification = () => {
    setErrorMsg('');
    if (!canPerformHeadApproval) {
      setErrorMsg('Hanya User Kepala Gudang yang memiliki wewenang untuk Approve Pengurangan Stock.');
      return;
    }
    if (!warehouseHeadName.trim()) {
      setErrorMsg('Nama Kepala Gudang wajib diisi untuk approve pengurangan stock.');
      return;
    }

    onApprove({
      warehouseHeadName: warehouseHeadName.trim(),
      approverAdminName: voucher.approvedByAdmin || voucher.handoverOfficer || currentAdminName,
      handoverOfficer: voucher.handoverOfficer || voucher.approvedByAdmin || currentAdminName,
      recipientName: voucher.recipientName || recipientName.trim() || voucher.requestedBy,
      notes: headVerificationNotes.trim() || undefined,
    });
  };

  const handleConfirmRejection = () => {
    if (!rejectionReason.trim()) {
      setErrorMsg('Alasan penolakan nota wajib diisi.');
      return;
    }
    onReject(rejectionReason);
  };

  const formatTimeShort = (iso?: string) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const activeItemsToExport = itemsState.filter((i) => !i.isCancelled && i.issuedQty > 0);
  const cancelledItemsCount = itemsState.filter((i) => i.isCancelled || i.issuedQty === 0).length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4 max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            {isAdminValidationStage ? (
              <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0">
                <ScanBarcode className="w-5 h-5" />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold">
                  {isAdminValidationStage
                    ? 'Tahap 2 (Admin Gudang): ACC SIV & Validasi Barang / Qty Diserahkan'
                    : 'Tahap 3 (Kepala Gudang): Verifikasi Pengeluaran Stock & Potong Stok'}
                </h2>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                    isAdminValidationStage
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-blue-600 text-white'
                  }`}
                >
                  {isAdminValidationStage
                    ? 'MENUNGGU ACC & VALIDASI ADMIN'
                    : 'TERKUNCI · MENUNGGU VERIFIKASI KEPALA GUDANG'}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-300 font-mono">
                Nota Pengambilan #{voucher.voucherNumber} &middot; Pemohon: {voucher.requestedBy} ({voucher.department})
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

        {/* Stepper Alur Tahapan SIV */}
        <div className="bg-slate-100 border-b border-slate-200 px-4 sm:px-6 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>1. Pemohon Terbit SIV ({voucher.requestedBy})</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            <div
              className={`flex items-center gap-1.5 font-semibold ${
                isHeadVerificationStage
                  ? 'text-emerald-700'
                  : 'text-blue-800 bg-blue-100 px-2 py-0.5 rounded border border-blue-200'
              }`}
            >
              {isHeadVerificationStage ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <ScanBarcode className="w-4 h-4 text-blue-600" />
              )}
              <span>2. Admin Gudang ACC &amp; Validasi Barang/Qty (SIV Terkunci, Stok Belum Berubah)</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            <div
              className={`flex items-center gap-1.5 font-semibold ${
                isHeadVerificationStage
                  ? 'text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300'
                  : 'text-slate-400'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>3. Kepala Gudang Verifikasi Pengeluaran (Otomatis Potong Stock)</span>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Information summary */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-slate-500 block">Diterbitkan Oleh (Pemohon):</span>
              <span className="font-bold text-slate-900">{voucher.requestedBy}</span>
              <span className="text-slate-500 block text-[11px]">{voucher.department}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Tanggal Permintaan:</span>
              <span className="font-semibold text-slate-900">{voucher.requestDate}</span>
              {voucher.handoverOfficer && (
                <span className="text-blue-700 block text-[11px] font-medium">
                  ACC &amp; Validasi Admin: {voucher.handoverOfficer}
                </span>
              )}
            </div>
            <div>
              <span className="text-slate-500 block">Keperluan Pemakaian:</span>
              <span className="text-slate-800 font-semibold">{voucher.purpose}</span>
              {voucher.recipientName && (
                <span className="text-emerald-700 block text-[11px] font-medium">
                  Penerima Barang: {voucher.recipientName}
                </span>
              )}
            </div>
          </div>

          {/* =================================================================== */}
          {/* TAHAP 2 (STATUS PENDING): ADMIN GUDANG ACC SIV & VALIDASI BARCODE   */}
          {/* -> SIV Terkunci, Pemohon tidak bisa edit/hapus, Stok belum berubah  */}
          {/* =================================================================== */}
          {isAdminValidationStage && !isRejecting && (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-950 flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">
                    Prosedur Tahap 2 (Admin Gudang): Meng-ACC SIV &amp; Validasi Barang/Qty Diserahkan
                  </span>
                  <span className="text-[11px] text-amber-900">
                    Setelah Admin Gudang meng-ACC SIV dan memvalidasi barang/qty ini, <strong>SIV akan langsung TERKUNCI</strong> (User Pemohon tidak bisa menghapus maupun mengedit SIV), <strong>tetapi stock sistem BELUM akan berubah</strong> sampai diverifikasi oleh User Kepala Gudang.
                  </span>
                </div>
              </div>

              {/* Scanner Input Box */}
              <div className="bg-blue-950 text-white rounded-xl p-4 border border-blue-800 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <QrCode className="w-5 h-5 text-blue-400 shrink-0" />
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-white">
                        Validasi Sistem Scan Barcode Barang &amp; Input Quantity Diserahkan
                      </h3>
                      <p className="text-[11px] text-blue-200">
                        Scan barcode fisik barang (atau klik tombol <strong>Scan Barcode</strong> pada baris tabel) lalu isi quantity barang yang dikeluarkan.
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

                <form onSubmit={handleBarcodeFormSubmit} className="flex gap-2">
                  <div className="relative flex-1">
                    <ScanBarcode className="w-4 h-4 text-blue-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      ref={barcodeInputRef}
                      type="text"
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      placeholder="Arahkan scanner barcode atau ketik Kode Material / SKU (contoh: SKU-SPR-001) lalu tekan Enter..."
                      className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-blue-700 rounded-lg text-xs text-white placeholder-slate-400 font-mono focus:ring-2 focus:ring-blue-400 focus:outline-hidden"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors shrink-0"
                  >
                    Validasi Barcode
                  </button>
                </form>

                {scanFeedback && (
                  <div
                    className={`p-2.5 rounded-lg text-xs flex items-center gap-2 font-medium ${
                      scanFeedback.type === 'success'
                        ? 'bg-emerald-900/80 text-emerald-100 border border-emerald-600'
                        : 'bg-red-900/80 text-red-100 border border-red-600'
                    }`}
                  >
                    {scanFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    )}
                    <span>{scanFeedback.text}</span>
                  </div>
                )}
              </div>

              {/* Tabel Validasi Pengeluaran Barang */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Daftar Validasi Pengeluaran Barang ({itemsState.length} Item)
                  </h3>
                  <span className="text-[11px] text-slate-600 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded font-medium">
                    Ketentuan: Hanya barang dengan <strong>Qty Pengeluaran &gt; 0</strong> yang masuk ke bukti PDF SIV
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2.5">Material Code &amp; Nama Barang</th>
                        <th className="px-2.5 py-2.5 text-center">Stok Rak</th>
                        <th className="px-2.5 py-2.5 text-center">Diminta</th>
                        <th className="px-3 py-2.5 text-center">Validasi Barcode</th>
                        <th className="px-3 py-2.5 text-center w-36">Qty Diserahkan</th>
                        <th className="px-3 py-2.5 text-center">Tidak Jadi Dikeluarkan</th>
                        <th className="px-2.5 py-2.5 text-center">Status PDF SIV</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {itemsState.map((row, idx) => {
                        const stockObj = stockItems.find(
                          (s) => s.id === row.itemId || s.sku === row.sku
                        );
                        const currentStock = stockObj ? stockObj.currentStock : 0;
                        const isZeroOrCancelled = row.isCancelled || row.issuedQty === 0;

                        return (
                          <tr
                            key={row.itemId + idx}
                            className={`transition-colors ${
                              isZeroOrCancelled
                                ? 'bg-red-50/40 text-slate-400'
                                : row.barcodeValidated
                                ? 'bg-emerald-50/30'
                                : 'hover:bg-slate-50'
                            }`}
                          >
                            {/* Material Code & Nama Barang */}
                            <td className="px-3 py-2.5">
                              <div
                                className={`font-semibold ${
                                  isZeroOrCancelled ? 'line-through text-slate-400' : 'text-slate-900'
                                }`}
                              >
                                {row.itemName}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="font-mono text-[11px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded">
                                  {row.sku}
                                </span>
                                <span className="text-[10px] font-mono text-slate-500">
                                  {stockObj?.location || '-'}
                                </span>
                              </div>
                            </td>

                            {/* Stok Rak */}
                            <td className="px-2.5 py-2.5 text-center font-mono tabular-nums text-slate-600">
                              {currentStock} {row.unit}
                            </td>

                            {/* Diminta */}
                            <td className="px-2.5 py-2.5 text-center font-mono font-bold tabular-nums text-slate-800">
                              {row.requestedQty} {row.unit}
                            </td>

                            {/* Tombol / Status Scan Barcode */}
                            <td className="px-3 py-2.5 text-center">
                              {isZeroOrCancelled ? (
                                <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                                  <Ban className="w-3.5 h-3.5" />
                                  Dibatalkan (0)
                                </span>
                              ) : row.barcodeValidated ? (
                                <div className="inline-flex flex-col items-center">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[11px] border border-emerald-300">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    Tervalidasi
                                  </span>
                                  {row.barcodeScannedAt && (
                                    <span className="text-[9.5px] font-mono text-emerald-700 mt-0.5">
                                      {formatTimeShort(row.barcodeScannedAt)}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => processBarcodeScan(row.sku)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[11px] font-semibold shadow-2xs transition-colors"
                                  title={`Klik untuk scan barcode ${row.sku}`}
                                >
                                  <ScanBarcode className="w-3.5 h-3.5" />
                                  <span>Scan Barcode</span>
                                </button>
                              )}
                            </td>

                            {/* Input Quantity Barang yang Diserahkan */}
                            <td className="px-3 py-2.5 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <input
                                  type="number"
                                  min={0}
                                  max={currentStock}
                                  value={row.isCancelled ? 0 : row.issuedQty}
                                  onChange={(e) => handleIssuedQtyChange(idx, e.target.value)}
                                  className={`w-16 px-2 py-1 text-center font-mono font-bold text-xs rounded-lg border focus:outline-hidden ${
                                    isZeroOrCancelled
                                      ? 'bg-red-50 border-red-300 text-red-700'
                                      : 'bg-white border-slate-300 text-slate-900 focus:ring-1 focus:ring-blue-600'
                                  }`}
                                />
                                <span className="text-[11px] text-slate-500">{row.unit}</span>
                              </div>
                            </td>

                            {/* Centang Barang Tidak Jadi Dikeluarkan */}
                            <td className="px-3 py-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleCancelItem(idx)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                                  isZeroOrCancelled
                                    ? 'bg-red-100 border-red-300 text-red-800'
                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                                title="Centang apabila barang tidak jadi dikeluarkan (otomatis mengisi Qty = 0)"
                              >
                                {isZeroOrCancelled ? (
                                  <CheckSquare className="w-3.5 h-3.5 text-red-600" />
                                ) : (
                                  <Square className="w-3.5 h-3.5 text-slate-400" />
                                )}
                                <span>{isZeroOrCancelled ? 'Batal Keluar (0)' : 'Tidak Jadi'}</span>
                              </button>
                            </td>

                            {/* Status Masuk Bukti PDF SIV */}
                            <td className="px-2.5 py-2.5 text-center">
                              {!isZeroOrCancelled && row.issuedQty > 0 ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                  <FileCheck2 className="w-3 h-3" />
                                  Masuk PDF
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                                  Tidak Masuk PDF
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Ringkasan Filter Bukti PDF SIV */}
                <div className="mt-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-4">
                    <span className="text-slate-700">
                      Masuk Bukti PDF SIV (Qty &gt; 0):{' '}
                      <strong className="text-emerald-700">{activeItemsToExport.length} barang</strong>
                    </span>
                    {cancelledItemsCount > 0 && (
                      <span className="text-red-700 font-medium">
                        Tidak Jadi Dikeluarkan (Qty = 0):{' '}
                        <strong>{cancelledItemsCount} barang (Tidak dicetak di PDF SIV)</strong>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Form Nama Penerima & Petugas Admin Gudang */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Nama Penerima Barang (Diinput Admin) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                      placeholder="Masukkan nama penerima fisik barang..."
                    />
                    <span className="text-[10.5px] text-slate-500 mt-0.5 block">
                      Tercetak pada kolom <strong>Diterima</strong> (Permintaan)
                    </span>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Nama Admin Gudang (User ACC SIV) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={handoverOfficer}
                      onChange={(e) => setHandoverOfficer(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                      placeholder="Contoh: Hendra Gunawan"
                    />
                    <span className="text-[10.5px] text-slate-500 mt-0.5 block">
                      Tercetak pada kolom <strong>Diserahkan</strong> + TTD Digital Penyerahan
                    </span>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Catatan Validasi / Penyerahan (Opsional)
                    </label>
                    <input
                      type="text"
                      value={handoverNotes}
                      onChange={(e) => setHandoverNotes(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                      placeholder="Contoh: Barang telah di-scan barcode & diserahkan"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* =================================================================== */}
          {/* TAHAP 3 (STATUS APPROVED): KEPALA GUDANG VERIFIKASI PENGELUARAN     */}
          {/* -> Otomatis Mempengaruhi (Memotong) Stock Fisik di Sistem           */}
          {/* =================================================================== */}
          {isHeadVerificationStage && !isRejecting && (
            <>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-950 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Tahap 3 (Kepala Gudang): Verifikasi Pengeluaran Stock dari Hasil Validasi Admin Gudang
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  Nota SIV ini telah di-ACC &amp; divalidasi oleh Admin Gudang (<strong>{voucher.handoverOfficer || voucher.approvedByAdmin || 'Admin Gudang'}</strong>) dan diserahkan kepada penerima (<strong>{voucher.recipientName || voucher.requestedBy}</strong>). SIV saat ini sudah terkunci namun <strong>stock fisik sistem belum berubah</strong>. Dengan mengklik tombol verifikasi di bawah, sistem akan <strong>otomatis memotong stock fisik gudang</strong>.
                </p>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Hasil Validasi Barang &amp; Quantity oleh Admin Gudang
                </h3>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2.5">Barang &amp; SKU</th>
                        <th className="px-3 py-2.5 text-center">Stok Rak Saat Ini</th>
                        <th className="px-3 py-2.5 text-right">Qty Diminta</th>
                        <th className="px-3 py-2.5 text-right">Qty Diserahkan (Validasi Admin)</th>
                        <th className="px-3 py-2.5 text-right">Stok Setelah Verifikasi</th>
                        <th className="px-3 py-2.5 text-center">Status Validasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {voucher.items.map((item, idx) => {
                        const currentItem = stockItems.find((s) => s.id === item.itemId || s.sku === item.sku);
                        const currentStock = currentItem ? currentItem.currentStock : 0;
                        const actualIssued = item.isCancelled
                          ? 0
                          : item.issuedQty !== undefined
                          ? item.issuedQty
                          : item.approvedQty ?? item.requestedQty;
                        const isCancelledItem = item.isCancelled || actualIssued === 0;
                        const stockAfter = Math.max(0, currentStock - actualIssued);

                        return (
                          <tr
                            key={idx}
                            className={isCancelledItem ? 'bg-red-50/40 text-slate-400' : 'hover:bg-slate-50/50'}
                          >
                            <td className="px-3 py-2.5">
                              <div className={`font-semibold ${isCancelledItem ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                                {item.itemName}
                              </div>
                              <div className="text-[11px] font-mono text-slate-500">{item.sku}</div>
                            </td>
                            <td className="px-3 py-2.5 text-center font-mono tabular-nums text-slate-700">
                              {currentStock} {item.unit}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-600">
                              {item.requestedQty} {item.unit}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-bold tabular-nums">
                              {isCancelledItem ? (
                                <span className="text-red-600">0 {item.unit} (Tidak Jadi Keluar)</span>
                              ) : (
                                <span className="text-blue-700">
                                  {actualIssued} {item.unit}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-bold tabular-nums text-emerald-700">
                              {stockAfter} {item.unit}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {isCancelledItem ? (
                                <span className="inline-flex items-center gap-1 text-[11px] text-red-600 font-semibold">
                                  <Ban className="w-3.5 h-3.5" />
                                  Batal Keluar (Tidak Masuk PDF)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  Barcode Tervalidasi
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-100">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Nama Kepala Gudang (Verifikator Pengeluaran Stock) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={warehouseHeadName}
                    onChange={(e) => setWarehouseHeadName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                    placeholder="Contoh: Suryadi"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Tercetak di kolom <strong>Disetujui (Penyerahan)</strong> + TTD Digital Tanggal &amp; Waktu ACC
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Catatan Verifikasi Kepala Gudang (Opsional)
                  </label>
                  <input
                    type="text"
                    value={headVerificationNotes}
                    onChange={(e) => setHeadVerificationNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                    placeholder="Contoh: Pengeluaran stock diverifikasi Kepala Gudang & stok dipotong"
                  />
                </div>
              </div>
            </>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Rejection Form */}
          {isRejecting && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-900">
                <div className="font-semibold flex items-center gap-1.5 text-red-800 mb-1">
                  <XCircle className="w-4 h-4 text-red-600" />
                  Form Penolakan Nota Pengambilan
                </div>
                <p className="text-[11px] text-red-700">
                  Stok yang sebelumnya dialokasikan akan dikembalikan menjadi tersedia kembali untuk pemohon lain.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Alasan Penolakan <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-red-600 focus:outline-hidden"
                  placeholder="Contoh: Spesifikasi tidak sesuai / belum ada otorisasi departemen."
                />
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          {!isRejecting ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setIsRejecting(true);
                  setErrorMsg('');
                }}
                className="px-3.5 py-2 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              >
                Tolak Nota SIV
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>

                {isAdminValidationStage ? (
                  canPerformAdminValidation ? (
                    <button
                      type="button"
                      onClick={handleConfirmAdminValidation}
                      className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-xs transition-colors"
                    >
                      <ScanBarcode className="w-4 h-4" />
                      <span>ACC SIV &amp; Validasi/Scan Barang (Stok Belum Berubah)</span>
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg">
                      <Lock className="w-4 h-4 text-amber-600" />
                      <span>Khusus Wewenang User Admin Gudang (ACC &amp; Scan Barang)</span>
                    </span>
                  )
                ) : canPerformHeadApproval ? (
                  <button
                    type="button"
                    onClick={handleConfirmHeadVerification}
                    className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs transition-colors"
                  >
                    <PackageCheck className="w-4 h-4" />
                    <span>Approve Pengurangan Stock (Kepala Gudang)</span>
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-200 rounded-lg">
                    <Lock className="w-4 h-4 text-blue-600" />
                    <span>Khusus Wewenang User Kepala Gudang (Approve Pengurangan Stock)</span>
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setIsRejecting(false);
                  setErrorMsg('');
                }}
                className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                &larr; Kembali ke Verifikasi
              </button>

              <button
                type="button"
                onClick={handleConfirmRejection}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg shadow-xs transition-colors"
              >
                <XCircle className="w-4 h-4" />
                Konfirmasi Tolak Nota
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
