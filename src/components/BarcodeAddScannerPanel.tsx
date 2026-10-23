import React, { useState, useEffect, useRef } from 'react';
import { StockItem } from '../types/inventory';
import {
  Camera,
  CameraOff,
  ScanBarcode,
  CheckCircle2,
  AlertCircle,
  Volume2,
  Plus,
  Minus,
  Sparkles,
  PackagePlus,
} from 'lucide-react';

interface BarcodeAddScannerPanelProps {
  mode: 'SIV' | 'LPB';
  stockItems: StockItem[];
  initialAllocationsMap?: Record<string, number>;
  selectedQuantitiesMap?: Record<string, number>;
  onBarcodeAddItem: (item: StockItem, quantity: number, scannedCode: string) => void;
  onUnrecognizedBarcodeInLPB?: (scannedCode: string, quantity: number) => void;
  onClose?: () => void;
}

export const BarcodeAddScannerPanel: React.FC<BarcodeAddScannerPanelProps> = ({
  mode,
  stockItems,
  initialAllocationsMap = {},
  selectedQuantitiesMap = {},
  onBarcodeAddItem,
  onUnrecognizedBarcodeInLPB,
  onClose,
}) => {
  const isLPB = mode === 'LPB';
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [scanQty, setScanQty] = useState<number>(isLPB ? 10 : 1);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanFeedback, setScanFeedback] = useState<{
    type: 'success' | 'error' | 'unrecognized';
    message: string;
    code?: string;
    item?: StockItem;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const lastScanRef = useRef<{ code: string; timestamp: number }>({ code: '', timestamp: 0 });
  const inputRef = useRef<HTMLInputElement | null>(null);

  const getAvailableForSIV = (item: StockItem) => {
    const extraReserved = initialAllocationsMap[item.id] || 0;
    return Math.max(0, item.currentStock - item.allocatedStock + extraReserved);
  };

  const playBeep = (success = true) => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = success ? 'sine' : 'sawtooth';
      osc.frequency.setValueAtTime(success ? 1100 : 320, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + (success ? 0.12 : 0.22));
    } catch {
      // ignore audio error
    }
  };

  const processScannedCode = (rawCode: string) => {
    const cleaned = rawCode.trim().toUpperCase();
    if (!cleaned) return;

    // Find matching item by exact SKU first, then partial SKU or exact name
    const exactMatch =
      stockItems.find((s) => s.sku.toUpperCase() === cleaned) ||
      stockItems.find(
        (s) =>
          cleaned.includes(s.sku.toUpperCase()) ||
          s.sku.toUpperCase().includes(cleaned) ||
          s.name.toUpperCase() === cleaned
      );

    if (!exactMatch) {
      playBeep(false);
      if (isLPB && onUnrecognizedBarcodeInLPB) {
        setScanFeedback({
          type: 'unrecognized',
          code: cleaned,
          message: `Barcode "${cleaned}" belum terdaftar di Master Stok. Anda dapat langsung mendaftarkannya sebagai Barang Baru.`,
        });
      } else {
        setScanFeedback({
          type: 'error',
          code: cleaned,
          message: `Barcode "${cleaned}" tidak ditemukan dalam katalog Master Gudang.`,
        });
      }
      return;
    }

    if (!isLPB) {
      const avail = getAvailableForSIV(exactMatch);
      const alreadyInDoc = selectedQuantitiesMap[exactMatch.id] || 0;
      if (avail <= 0) {
        playBeep(false);
        setScanFeedback({
          type: 'error',
          code: exactMatch.sku,
          item: exactMatch,
          message: `Stok "${exactMatch.name}" (${exactMatch.sku}) sedang habis (Tersedia: 0 ${exactMatch.unit}).`,
        });
        return;
      }
      if (alreadyInDoc >= avail) {
        playBeep(false);
        setScanFeedback({
          type: 'error',
          code: exactMatch.sku,
          item: exactMatch,
          message: `Item "${exactMatch.name}" (${exactMatch.sku}) di daftar sudah mencapai batas maksimal stok tersedia (${avail} ${exactMatch.unit}).`,
        });
        return;
      }
    }

    const effectiveQty = Math.max(1, Number(scanQty) || 1);
    playBeep(true);
    onBarcodeAddItem(exactMatch, effectiveQty, exactMatch.sku);
    setBarcodeInput('');
    setScanFeedback({
      type: 'success',
      code: exactMatch.sku,
      item: exactMatch,
      message: isLPB
        ? `✓ Barcode ${exactMatch.sku} terbaca! +${effectiveQty} ${exactMatch.unit} "${exactMatch.name}" ditambahkan & otomatis tervalidasi scan.`
        : `✓ Barcode ${exactMatch.sku} terbaca! +${effectiveQty} ${exactMatch.unit} "${exactMatch.name}" berhasil masuk ke daftar SIV.`,
    });
  };

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      window.clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    if (!isCameraActive) {
      stopCamera();
      return;
    }

    let isMounted = true;
    setCameraError(null);

    const startCamera = async () => {
      stopCamera();
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          'Perangkat ini tidak menyediakan akses kamera langsung. Gunakan kolom input Scanner Laser atau klik tombol Simulasi Scan Barcode di bawah.'
        );
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        const BarcodeDetectorClass = (
          window as unknown as {
            BarcodeDetector?: new (opts?: { formats: string[] }) => {
              detect: (el: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
            };
          }
        ).BarcodeDetector;

        if (BarcodeDetectorClass) {
          const detector = new BarcodeDetectorClass({
            formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'qr_code', 'upc_a'],
          });

          scanIntervalRef.current = window.setInterval(async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) return;
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes.length > 0 && barcodes[0].rawValue) {
                const raw = barcodes[0].rawValue.trim().toUpperCase();
                const now = Date.now();
                // 1.6s cooldown for the same code so a single scan doesn't fire repeatedly
                if (
                  raw === lastScanRef.current.code &&
                  now - lastScanRef.current.timestamp < 1600
                ) {
                  return;
                }
                lastScanRef.current = { code: raw, timestamp: now };
                processScannedCode(raw);
              }
            } catch {
              // ignore frame error
            }
          }, 300);
        }
      } catch {
        if (isMounted) {
          setCameraError(
            'Izin kamera tidak aktif atau perangkat tanpa kamera. Anda tetap dapat menggunakan Laser Barcode Scanner (USB/Bluetooth) pada kolom di bawah atau klik Simulasi Barcode.'
          );
        }
      }
    };

    startCamera();
    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [isCameraActive, scanQty, stockItems]);

  const handleManualScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    processScannedCode(barcodeInput);
  };

  return (
    <div
      className={`mb-3.5 rounded-xl border p-3.5 space-y-3 text-xs shadow-sm ${
        isLPB
          ? 'bg-emerald-950 text-white border-emerald-500/40'
          : 'bg-slate-900 text-white border-amber-500/40'
      }`}
    >
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              isLPB
                ? 'bg-emerald-500/20 border border-emerald-400/30 text-emerald-300'
                : 'bg-amber-500/20 border border-amber-400/30 text-amber-300'
            }`}
          >
            <ScanBarcode className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-xs sm:text-sm text-white flex items-center gap-2">
              <span>
                Scan Barcode untuk Tambah Item {isLPB ? 'LPB (Barang Masuk)' : 'SIV (Barang Keluar)'}
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                  isCameraActive
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {isCameraActive ? '● KAMERA & LASER AKTIF' : 'MODE LASER / INPUT'}
              </span>
            </h4>
            <p className="text-[11px] text-slate-300">
              {isLPB
                ? 'Arahkan kamera ke barcode barang atau gunakan scanner laser. Barang otomatis masuk daftar & tervalidasi scan.'
                : 'Arahkan kamera ke barcode barang atau gunakan scanner laser untuk langsung menambahkan ke Nota SIV.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsCameraActive((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
              isCameraActive
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {isCameraActive ? (
              <>
                <CameraOff className="w-3.5 h-3.5" />
                <span>Matikan Kamera</span>
              </>
            ) : (
              <>
                <Camera className="w-3.5 h-3.5" />
                <span>Nyalakan Kamera</span>
              </>
            )}
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold transition-colors"
            >
              Selesai Scan
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Camera Viewfinder + Laser Input & Quantity Control */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-stretch">
        {/* Camera Preview Box */}
        {isCameraActive && (
          <div className="sm:col-span-5 flex flex-col justify-between bg-black/80 rounded-xl border border-slate-700 overflow-hidden relative min-h-[150px]">
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-40 object-cover"
            />
            {/* Laser Target Overlay */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-4">
              <div className="w-4/5 h-20 border-2 border-dashed border-amber-400/70 rounded-lg relative flex items-center justify-center">
                <div className="w-full h-0.5 bg-red-500/90 shadow-[0_0_10px_#ef4444] animate-pulse" />
              </div>
              <span className="mt-1.5 text-[10px] font-mono text-white/90 bg-slate-950/80 px-2 py-0.5 rounded">
                Arahkan Barcode / QR ke Area Kotak
              </span>
            </div>
          </div>
        )}

        {/* Controls: Quantity per Scan + Laser Gun Input + Quick Barcode Tap */}
        <div
          className={`${
            isCameraActive ? 'sm:col-span-7' : 'sm:col-span-12'
          } flex flex-col justify-between gap-2.5 bg-white/5 rounded-xl p-3 border border-white/10`}
        >
          {/* Row 1: Quantity to add per barcode scan + Manual/Laser Barcode Input */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
            <div className="sm:col-span-4">
              <label className="block text-[11px] font-semibold text-slate-200 mb-1">
                Qty Otomatis per Scan:
              </label>
              <div className="flex items-center bg-slate-800 border border-slate-600 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setScanQty((q) => Math.max(1, q - 1))}
                  className="px-2.5 py-1.5 text-slate-200 hover:bg-slate-700"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="number"
                  min={1}
                  value={scanQty}
                  onChange={(e) => setScanQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full py-1.5 bg-transparent text-center font-mono font-bold text-white text-xs focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => setScanQty((q) => q + 1)}
                  className="px-2.5 py-1.5 text-slate-200 hover:bg-slate-700"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="sm:col-span-8">
              <label className="block text-[11px] font-semibold text-slate-200 mb-1">
                Input Scanner Laser (USB/Bluetooth) / Ketik Kode Barcode:
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  ref={inputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleManualScanSubmit(e);
                    }
                  }}
                  placeholder="Scan atau ketik Material Code (Cth: BRG-001) lalu Enter..."
                  className="flex-1 px-3 py-1.5 bg-white text-slate-900 rounded-lg font-mono text-xs placeholder:text-slate-400 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleManualScanSubmit}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs shrink-0 transition-colors ${
                    isLPB
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                      : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                  }`}
                >
                  + Scan Masuk
                </button>
              </div>
            </div>
          </div>

          {/* Row 2: Simulasi Scan Barcode Cepat (1-Click Tap Barcode Chips) */}
          <div className="pt-1 border-t border-white/10">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold text-slate-300 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Simulasi Scan Cepat (Klik label barcode di bawah untuk langsung scan & tambah):</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {stockItems.map((item) => {
                const avail = getAvailableForSIV(item);
                const isDisabledSIV = !isLPB && avail <= 0;
                const inDocQty = selectedQuantitiesMap[item.id] || 0;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={isDisabledSIV}
                    onClick={() => processScannedCode(item.sku)}
                    className={`group px-2.5 py-1 rounded-lg border text-left shrink-0 transition-all flex items-center gap-2 ${
                      isDisabledSIV
                        ? 'bg-slate-800/40 border-slate-700 opacity-40 cursor-not-allowed'
                        : inDocQty > 0
                        ? 'bg-amber-500/20 border-amber-400/60 hover:bg-amber-500/30 text-white'
                        : 'bg-slate-800/90 border-slate-600 hover:border-emerald-400 hover:bg-slate-800 text-white'
                    }`}
                    title={`${item.sku} - ${item.name} (${
                      isLPB ? `Stok: ${item.currentStock}` : `Siap Diambil: ${avail}`
                    } ${item.unit})`}
                  >
                    <ScanBarcode className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <div>
                      <div className="font-mono font-bold text-[10px] leading-tight flex items-center gap-1">
                        <span>{item.sku}</span>
                        {inDocQty > 0 && (
                          <span className="px-1 rounded bg-amber-400 text-slate-950 text-[9px] font-extrabold">
                            {inDocQty}
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] text-slate-300 truncate max-w-[110px]">
                        {item.name}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Camera Warning if any */}
      {cameraError && isCameraActive && (
        <div className="p-2 bg-amber-500/15 border border-amber-400/30 rounded-lg text-[11px] text-amber-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{cameraError}</span>
        </div>
      )}

      {/* Live Scan Result Feedback Banner */}
      {scanFeedback && (
        <div
          className={`p-2.5 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
            scanFeedback.type === 'success'
              ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-100'
              : scanFeedback.type === 'unrecognized'
              ? 'bg-amber-500/20 border-amber-400/50 text-amber-100'
              : 'bg-red-500/20 border-red-400/50 text-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {scanFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <Volume2 className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span className="font-medium">{scanFeedback.message}</span>
          </div>

          {scanFeedback.type === 'unrecognized' &&
            isLPB &&
            onUnrecognizedBarcodeInLPB &&
            scanFeedback.code && (
              <button
                type="button"
                onClick={() => {
                  onUnrecognizedBarcodeInLPB(scanFeedback.code!, Math.max(1, scanQty));
                  setScanFeedback(null);
                }}
                className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs shrink-0"
              >
                <PackagePlus className="w-3.5 h-3.5" />
                <span>+ Daftarkan "{scanFeedback.code}" ke Master & LPB</span>
              </button>
            )}
        </div>
      )}
    </div>
  );
};
