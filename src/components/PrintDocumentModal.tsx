import React, { useState, useRef } from 'react';
import { LPBDocument, IssueVoucherDocument } from '../types/inventory';
import { useInventory } from '../context/InventoryContext';
import {
  Printer,
  X,
  FileText,
  Download,
  Loader2,
  CheckCircle2,
  Scissors,
  Columns2,
  Rows2,
  Maximize2,
  Stamp,
} from 'lucide-react';
import { exportElementToPdf, printElementDirectly } from '../utils/exportPdf';

interface PrintDocumentModalProps {
  documentData: {
    type: 'LPB' | 'NPB';
    doc: LPBDocument | IssueVoucherDocument;
  } | null;
  onClose: () => void;
}

// Logo Tunas Tanaman PT. Abadi Agrosindo Persada (Sesuai Form Fisik Asli)
const AapSproutLogo = ({ className = 'w-10 h-10' }: { className?: string }) => (
  <svg
    className={`${className} shrink-0 text-slate-900`}
    viewBox="0 0 64 64"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Daun Kiri & Kanan */}
    <path d="M29 33C24 19 12 14 7 16C8 26 19 32 29 33Z" />
    <path d="M32 30C37 16 49 10 56 12C54 23 42 29 32 30Z" />
    {/* Batang Tengah */}
    <path d="M28.5 32C30 39 30 45 30 49H34C33.5 44 33.5 37 32.5 29.5" />
    {/* Tanah & Akar Bawah */}
    <rect x="11" y="45" width="42" height="5" />
    <rect x="11" y="51.5" width="42" height="3.5" />
    <rect x="11" y="56.5" width="42" height="2.5" />
    {/* Garis Akar Putih di Tengah Tanah */}
    <path
      d="M32 45V58M32 48L24 55M32 49L40 55M28 52L20 58M36 52L44 58"
      stroke="#ffffff"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
  </svg>
);

// Stempel / Badge ACC Digital Resmi dengan Tanggal & Jam (Opsional untuk SIV)
const DigitalAccStamp: React.FC<{
  badge?: string;
  title: string;
  date: string;
  time: string;
  officerRole?: string;
  authCode?: string;
  colorScheme?: 'blue' | 'emerald' | 'amber';
  compact?: boolean;
}> = ({
  badge = 'ACC DIGITAL',
  title,
  date,
  time,
  officerRole,
  authCode,
  colorScheme = 'blue',
  compact = true,
}) => {
  const styles = {
    blue: {
      border: 'border-blue-900',
      bg: 'bg-blue-50/70',
      badgeBg: 'bg-blue-900 text-white',
      titleColor: 'text-blue-950',
      textColor: 'text-blue-900',
      subColor: 'text-blue-800',
    },
    emerald: {
      border: 'border-emerald-900',
      bg: 'bg-emerald-50/70',
      badgeBg: 'bg-emerald-900 text-white',
      titleColor: 'text-emerald-950',
      textColor: 'text-emerald-900',
      subColor: 'text-emerald-800',
    },
    amber: {
      border: 'border-amber-900',
      bg: 'bg-amber-50/70',
      badgeBg: 'bg-amber-900 text-white',
      titleColor: 'text-amber-950',
      textColor: 'text-amber-900',
      subColor: 'text-amber-800',
    },
  }[colorScheme];

  return (
    <div
      className={`border ${styles.border} ${styles.bg} rounded p-1 text-center w-full select-none shadow-2xs`}
    >
      <div
        className={`inline-block ${styles.badgeBg} font-mono ${
          compact ? 'text-[6.5px]' : 'text-[7.5px]'
        } font-extrabold px-1.5 py-0.2 rounded-xs uppercase tracking-wider`}
      >
        {badge}
      </div>
      <div
        className={`${
          compact ? 'text-[7.5px]' : 'text-[8.5px]'
        } font-bold uppercase tracking-tight mt-0.5 leading-tight ${styles.titleColor}`}
      >
        {title}
      </div>
      <div
        className={`mt-0.5 font-mono ${
          compact ? 'text-[7px]' : 'text-[8px]'
        } font-semibold leading-tight border-t border-b border-dashed border-slate-300 py-0.5 ${
          styles.textColor
        }`}
      >
        <div>Tgl : {date}</div>
        <div>Jam : {time}</div>
      </div>
      {officerRole && (
        <div
          className={`text-[6.5px] font-medium uppercase tracking-tight mt-0.5 ${styles.subColor}`}
        >
          {officerRole}
        </div>
      )}
      {authCode && (
        <div className="text-[6px] font-mono text-slate-500 tracking-tighter mt-0.5">
          {authCode}
        </div>
      )}
    </div>
  );
};

// Helper ekstraksi kode dari Cost Center dan GL Acc
const cleanCodeOnly = (val?: string) => {
  if (!val) return '';
  const trimmed = val.trim();
  const match = trimmed.match(/^([A-Za-z0-9_.-]+)/);
  return match ? match[1] : trimmed;
};

/**
 * Memecah nama barang yang panjang menjadi beberapa baris sesuai kapasitas lebar kolom.
 * Baris ke-2 dst. akan ditempatkan pada baris tabel di bawahnya ("teruskan kolom bawahnya")
 * sehingga nomor urut barang berikutnya ("nomor 2", dst.) otomatis turun ke baris berikutnya.
 */
const wrapTextToLines = (text: string, maxCharsPerLine: number): string[] => {
  const cleaned = (text || '').trim();
  if (!cleaned) return ['-'];

  const paragraphs = cleaned.split(/\r?\n/);
  const lines: string[] = [];

  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/);
    let currentLine = '';

    for (const word of words) {
      if (!currentLine) {
        if (word.length <= maxCharsPerLine) {
          currentLine = word;
        } else {
          let remaining = word;
          while (remaining.length > maxCharsPerLine) {
            lines.push(remaining.slice(0, maxCharsPerLine));
            remaining = remaining.slice(maxCharsPerLine);
          }
          currentLine = remaining;
        }
      } else if (currentLine.length + 1 + word.length <= maxCharsPerLine) {
        currentLine += ` ${word}`;
      } else {
        lines.push(currentLine);
        if (word.length <= maxCharsPerLine) {
          currentLine = word;
        } else {
          let remaining = word;
          while (remaining.length > maxCharsPerLine) {
            lines.push(remaining.slice(0, maxCharsPerLine));
            remaining = remaining.slice(maxCharsPerLine);
          }
          currentLine = remaining;
        }
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines.length > 0 ? lines : ['-'];
};

// =========================================================================
// 1. KOMPONEN BLOK TUNGGAL NOTA PENGAMBILAN BARANG (SIV)
//    Persis sesuai gambar fisik:
//    - Header Kiri: Logo Tunas + PT. Abadi Agrosindo Persada / Sidoarjo
//    - Header Tengah: NOTA PENGAMBILAN BARANG / STORE ISSUE VOUCHER
//    - Header Kanan: Box [FR/AAP/G-STR/23/001], Tanggal : DD/MM/YYYY, No. Doc :
//    - Tabel: No | MATERIAL CODE | NAMA BARANG | JUMLAH | SAT | COST CENTER | GL ACC
//    - Box tengah: "Spare part tersebut di atas akan kami gunakan untuk"
//    - Tabel TTD 4 Kolom:
//      PERMINTAAN/PENGAMBILAN BARANG (DITERIMA | DISETUJUI)
//      PENYERAHAN/PENGELUARAN BARANG (DISERAHKAN | DISETUJUI)
//    - Footnote: Putih : Akunting   Kuning : Gudang
// =========================================================================
interface SingleNotaBlockProps {
  npb: IssueVoucherDocument;
  formatFullDate: (dateStr: string) => string;
  reqApprovalStamp: { date: string; time: string };
  handoverStamp: { date: string; time: string };
  whLeaderStamp: { date: string; time: string };
  isSideBySide?: boolean;
  showDigitalStamp?: boolean;
  companyName: string;
  companyCity: string;
  logoUrl?: string;
  docCode: string;
}

interface SivDisplayRow {
  rowKey: string;
  itemNumber: number | null;
  materialCode: string;
  nameLine: string;
  isContinuation: boolean;
  qty: number | string;
  unit: string;
  costCenter: string;
  glAcc: string;
  isEmptyRow: boolean;
}

const SingleNotaBlock: React.FC<SingleNotaBlockProps> = ({
  npb,
  formatFullDate,
  reqApprovalStamp,
  handoverStamp,
  whLeaderStamp,
  isSideBySide = false,
  showDigitalStamp = true,
  companyName,
  companyCity,
  logoUrl,
  docCode,
}) => {
  // Kapasitas karakter per baris untuk kolom NAMA BARANG pada SIV
  const maxNameChars = isSideBySide ? 26 : 44;
  // Jumlah minimal baris mengikuti form fisik (6 baris di gambar, atau lebih jika item panjang)
  const targetMinRows = isSideBySide ? 8 : 6;

  // KETENTUAN BARU:
  // "dari hasil validasi pengeluaran barang, hanya barang dituliskan jumlah qty pengeluaran lebih dari 0 yang masuk ke bukti pdf SIV"
  const printableItems = npb.items.filter((item) => {
    if (item.isCancelled) return false;
    const effectiveQty = item.issuedQty ?? item.approvedQty ?? item.requestedQty;
    return effectiveQty > 0;
  });

  // Bangun baris tabel: jika nama barang panjang, teruskan ke baris bawahnya dan otomatis nomor 2 turun
  const itemRows: SivDisplayRow[] = [];
  printableItems.forEach((item, idx) => {
    const effectiveQty = item.issuedQty ?? item.approvedQty ?? item.requestedQty;
    const wrappedLines = wrapTextToLines(item.itemName, maxNameChars);
    wrappedLines.forEach((lineText, lineIdx) => {
      if (lineIdx === 0) {
        itemRows.push({
          rowKey: `siv-item-${idx}-line-0`,
          itemNumber: idx + 1,
          materialCode: item.sku || '',
          nameLine: lineText,
          isContinuation: false,
          qty: effectiveQty,
          unit: item.unit || 'pcs',
          costCenter: cleanCodeOnly(item.costCenter),
          glAcc: cleanCodeOnly(item.glAcc),
          isEmptyRow: false,
        });
      } else {
        itemRows.push({
          rowKey: `siv-item-${idx}-line-${lineIdx}`,
          itemNumber: null, // Kosong karena lanjutan nama barang di atasnya
          materialCode: '',
          nameLine: lineText,
          isContinuation: true,
          qty: '',
          unit: '',
          costCenter: '',
          glAcc: '',
          isEmptyRow: false,
        });
      }
    });
  });

  // Baris kosong di bawah item: nomor urut melanjutkan dari jumlah item terakhir (otomatis turun jika ada nama panjang)
  const emptyRowCount = Math.max(0, targetMinRows - itemRows.length);
  const allRows: SivDisplayRow[] = [...itemRows];
  for (let i = 0; i < emptyRowCount; i++) {
    allRows.push({
      rowKey: `siv-empty-${i}`,
      itemNumber: printableItems.length + i + 1,
      materialCode: '',
      nameLine: '',
      isContinuation: false,
      qty: '',
      unit: '',
      costCenter: '',
      glAcc: '',
      isEmptyRow: true,
    });
  }

  // Penentuan nama untuk 4 kolom tanda tangan SIV sesuai ketentuan:
  // 1. Permintaan - Diterima  : nama penerima (yang diinputkan admin)
  // 2. Permintaan - Disetujui : User yang Menerbitkan Nota Pengambilan Barang
  // 3. Penyerahan - Diserahkan: nama User yang ACC SIV + TTD Digital Tanggal dan Waktu Penyerahan
  // 4. Penyerahan - Disetujui : (Nama Kepala Gudang) + TTD Digital tanggal dan waktu ACC SIV
  const recipientDisplayName = npb.recipientName || '';
  const issuerDisplayName = npb.requestedBy || npb.approvedByRequester || '';
  const accSivUserDisplayName = npb.approvedByAdmin || npb.handoverOfficer || '';
  const warehouseHeadDisplayName =
    npb.approvedByWarehouseHead || npb.approvedByAdmin || 'Suryadi';

  const isApprovedOrCompleted =
    npb.status === 'APPROVED' || npb.status === 'HANDOVER_COMPLETED';
  const isHandoverDone =
    npb.status === 'HANDOVER_COMPLETED' || Boolean(npb.handoverAt || npb.recipientName);

  return (
    <div className="bg-white text-slate-900 select-text flex flex-col h-full justify-between">
      {/* BAGIAN ATAS: HEADER + JUDUL */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-1">
          {/* Kiri: Logo Tunas + Nama Perusahaan + Kota */}
          <div className="flex items-start gap-2.5 min-w-0">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo"
                className={
                  isSideBySide
                    ? 'w-9 h-9 object-contain shrink-0'
                    : 'w-12 h-12 object-contain shrink-0'
                }
              />
            ) : (
              <AapSproutLogo className={isSideBySide ? 'w-9 h-9' : 'w-12 h-12'} />
            )}
            <div className="min-w-0 pt-0.5">
              <h1
                className={`${
                  isSideBySide ? 'text-[13px]' : 'text-base sm:text-lg'
                } font-bold text-slate-900 leading-tight tracking-tight truncate`}
                style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
              >
                {companyName}
              </h1>
              <p
                className={`${
                  isSideBySide ? 'text-[10px]' : 'text-xs'
                } font-normal text-slate-800 leading-tight mt-0.5`}
              >
                {companyCity}
              </p>
            </div>
          </div>

          {/* Kanan: Kotak Kode Dokumen + Tanggal & No. Doc */}
          <div className="shrink-0 text-left">
            <div
              className={`border border-slate-900 ${
                isSideBySide ? 'px-2 py-0.5 text-[8.5px]' : 'px-4 py-0.5 text-[10px]'
              } font-bold text-slate-900 text-center tracking-wide mb-1`}
            >
              {docCode || 'FR/AAP/G-STR/23/001'}
            </div>
            <div
              className={`${
                isSideBySide ? 'text-[9px]' : 'text-[10.5px]'
              } text-slate-900 space-y-0.5`}
            >
              <div className="grid grid-cols-[46px_8px_1fr] items-baseline">
                <span className="font-medium">Tanggal</span>
                <span>:</span>
                <span className="font-semibold">{formatFullDate(npb.requestDate)}</span>
              </div>
              <div className="grid grid-cols-[46px_8px_1fr] items-baseline">
                <span className="font-medium">No. Doc</span>
                <span>:</span>
                <span className="font-semibold font-mono">{npb.voucherNumber}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Judul Tengah: NOTA PENGAMBILAN BARANG / STORE ISSUE VOUCHER */}
        <div className="text-center -mt-2 mb-2">
          <h2
            className={`${
              isSideBySide ? 'text-[12px]' : 'text-sm sm:text-base'
            } font-extrabold uppercase tracking-wide text-slate-900 leading-tight`}
          >
            NOTA PENGAMBILAN BARANG
          </h2>
          <p
            className={`${
              isSideBySide ? 'text-[8.5px]' : 'text-[10px]'
            } font-medium uppercase tracking-wider text-slate-800 leading-tight`}
          >
            STORE ISSUE VOUCHER
          </p>
        </div>
      </div>

      {/* BAGIAN TENGAH: TABEL ITEM SIV (Persis Gambar: No | MATERIAL CODE | NAMA BARANG | JUMLAH | SAT | COST CENTER | GL ACC) */}
      <div className="flex-1 flex flex-col">
        <div className="border border-slate-900 flex-1 flex flex-col">
          <table className="w-full h-full border-collapse text-slate-900">
            <thead>
              <tr
                className={`border-b border-slate-900 font-bold text-slate-900 text-center uppercase ${
                  isSideBySide ? 'text-[8px] h-6' : 'text-[9.5px] h-7'
                }`}
              >
                <th className="border-r border-slate-900 px-1 w-7 text-center">No</th>
                <th
                  className={`border-r border-slate-900 px-1 text-center ${
                    isSideBySide ? 'w-18' : 'w-26'
                  }`}
                >
                  MATERIAL CODE
                </th>
                <th className="border-r border-slate-900 px-2 text-center">NAMA BARANG</th>
                <th
                  className={`border-r border-slate-900 px-1 text-center ${
                    isSideBySide ? 'w-11' : 'w-15'
                  }`}
                >
                  JUMLAH
                </th>
                <th
                  className={`border-r border-slate-900 px-1 text-center ${
                    isSideBySide ? 'w-10' : 'w-13'
                  }`}
                >
                  SAT
                </th>
                <th
                  className={`border-r border-slate-900 px-1 text-center ${
                    isSideBySide ? 'w-18' : 'w-25'
                  }`}
                >
                  COST CENTER
                </th>
                <th className={`px-1 text-center ${isSideBySide ? 'w-18' : 'w-25'}`}>
                  GL ACC
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900">
              {allRows.map((row) => (
                <tr
                  key={row.rowKey}
                  className={`${
                    isSideBySide ? 'text-[9px] h-6' : 'text-[10.5px] h-7'
                  } text-slate-900`}
                >
                  {/* No (dengan titik seperti "1.", "2.", kosong jika baris lanjutan nama panjang) */}
                  <td className="border-r border-slate-900 px-1 text-center font-semibold tabular-nums">
                    {row.itemNumber !== null ? `${row.itemNumber}.` : ''}
                  </td>

                  {/* MATERIAL CODE */}
                  <td className="border-r border-slate-900 px-1.5 text-center font-mono text-[8.5px] sm:text-[9.5px] font-medium whitespace-nowrap">
                    {row.materialCode || '\u00A0'}
                  </td>

                  {/* NAMA BARANG */}
                  <td className="border-r border-slate-900 px-2 font-semibold text-left whitespace-nowrap">
                    {row.nameLine || '\u00A0'}
                  </td>

                  {/* JUMLAH */}
                  <td className="border-r border-slate-900 px-1 text-center font-bold tabular-nums">
                    {row.qty !== '' ? row.qty : '\u00A0'}
                  </td>

                  {/* SAT */}
                  <td className="border-r border-slate-900 px-1 text-center font-medium">
                    {row.unit || '\u00A0'}
                  </td>

                  {/* COST CENTER */}
                  <td className="border-r border-slate-900 px-1 text-center font-mono font-semibold text-[8.5px] sm:text-[9.5px]">
                    {row.costCenter || '\u00A0'}
                  </td>

                  {/* GL ACC */}
                  <td className="px-1 text-center font-mono font-semibold text-[8.5px] sm:text-[9.5px]">
                    {row.glAcc || '\u00A0'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* BAGIAN BAWAH: KOTAK KEPERLUAN + TABEL 4 KOLOM TANDA TANGAN + FOOTNOTE */}
      <div className="mt-2">
        {/* Kotak: "Spare part tersebut di atas akan kami gunakan untuk" */}
        <div
          className={`border border-slate-900 px-2.5 py-1 ${
            isSideBySide ? 'min-h-[38px]' : 'min-h-[46px]'
          } flex flex-col justify-between bg-white`}
        >
          <div className={`${isSideBySide ? 'text-[8.5px]' : 'text-[9.5px]'} text-slate-800`}>
            Spare part tersebut di atas akan kami gunakan untuk
          </div>
          <div
            className={`${
              isSideBySide ? 'text-[10px]' : 'text-xs'
            } font-semibold text-slate-900 pl-2 pt-0.5`}
          >
            {npb.purpose
              ? `${npb.purpose}${npb.department ? ` — ${npb.department}` : ''}`
              : npb.department || '-'}
          </div>
        </div>

        {/* Tabel Tanda Tangan 2 Grup (4 Kolom): PERMINTAAN/PENGAMBILAN BARANG & PENYERAHAN/PENGELUARAN BARANG */}
        <div className="border border-slate-900 mt-2 text-slate-900 bg-white">
          <table className="w-full border-collapse">
            <thead>
              <tr
                className={`border-b border-slate-900 font-semibold text-center uppercase ${
                  isSideBySide ? 'text-[8px]' : 'text-[9.5px]'
                }`}
              >
                <th colSpan={2} className="border-r border-slate-900 py-0.5 px-1 w-1/2">
                  PERMINTAAN/PENGAMBILAN BARANG
                </th>
                <th colSpan={2} className="py-0.5 px-1 w-1/2">
                  PENYERAHAN/PENGELUARAN BARANG
                </th>
              </tr>
              <tr
                className={`border-b border-slate-900 font-semibold text-center uppercase ${
                  isSideBySide ? 'text-[8px]' : 'text-[9.5px]'
                }`}
              >
                <th className="border-r border-slate-900 py-0.5 px-1 w-1/4">DITERIMA</th>
                <th className="border-r border-slate-900 py-0.5 px-1 w-1/4">DISETUJUI</th>
                <th className="border-r border-slate-900 py-0.5 px-1 w-1/4">DISERAHKAN</th>
                <th className="py-0.5 px-1 w-1/4">DISETUJUI</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                {/* Kolom 1: PERMINTAAN/PENGAMBILAN BARANG -> DITERIMA : Nama Penerima (yang diinputkan admin) */}
                <td
                  className={`border-r border-slate-900 p-1 align-bottom ${
                    isSideBySide ? 'h-20' : 'h-24'
                  }`}
                >
                  <div className="flex flex-col justify-between items-center h-full">
                    <div className="flex-1 w-full flex items-center justify-center">
                      {/* Ruang tanda tangan penerima */}
                    </div>
                    <div
                      className={`flex items-center justify-between w-full px-1 ${
                        isSideBySide ? 'text-[8.5px]' : 'text-[10px]'
                      } font-semibold text-slate-900`}
                    >
                      <span>(</span>
                      <span className="truncate px-1 text-center">{recipientDisplayName}</span>
                      <span>)</span>
                    </div>
                  </div>
                </td>

                {/* Kolom 2: PERMINTAAN/PENGAMBILAN BARANG -> DISETUJUI : User yang Menerbitkan Nota Pengambilan Barang */}
                <td
                  className={`border-r border-slate-900 p-1 align-bottom ${
                    isSideBySide ? 'h-20' : 'h-24'
                  }`}
                >
                  <div className="flex flex-col justify-between items-center h-full">
                    <div className="flex-1 w-full flex items-center justify-center p-0.5">
                      {showDigitalStamp && (
                        <DigitalAccStamp
                          badge="TTD DIGITAL"
                          title="PENERBIT NOTA SIV"
                          date={reqApprovalStamp.date}
                          time={reqApprovalStamp.time}
                          colorScheme="amber"
                          compact={true}
                        />
                      )}
                    </div>
                    <div
                      className={`flex items-center justify-between w-full px-1 ${
                        isSideBySide ? 'text-[8.5px]' : 'text-[10px]'
                      } font-semibold text-slate-900`}
                    >
                      <span>(</span>
                      <span className="truncate px-1 text-center">{issuerDisplayName}</span>
                      <span>)</span>
                    </div>
                  </div>
                </td>

                {/* Kolom 3: PENYERAHAN/PENGELUARAN BARANG -> DISERAHKAN : Nama User yang ACC SIV, TTD Digital Tanggal dan Waktu Penyerahan */}
                <td
                  className={`border-r border-slate-900 p-1 align-bottom ${
                    isSideBySide ? 'h-20' : 'h-24'
                  }`}
                >
                  <div className="flex flex-col justify-between items-center h-full">
                    <div className="flex-1 w-full flex items-center justify-center p-0.5">
                      {showDigitalStamp && isHandoverDone && (
                        <DigitalAccStamp
                          badge="TTD DIGITAL"
                          title="DISERAHKAN"
                          date={handoverStamp.date}
                          time={handoverStamp.time}
                          colorScheme="blue"
                          compact={true}
                        />
                      )}
                    </div>
                    <div
                      className={`flex items-center justify-between w-full px-1 ${
                        isSideBySide ? 'text-[8.5px]' : 'text-[10px]'
                      } font-semibold text-slate-900`}
                    >
                      <span>(</span>
                      <span className="truncate px-1 text-center">{accSivUserDisplayName}</span>
                      <span>)</span>
                    </div>
                  </div>
                </td>

                {/* Kolom 4: PENYERAHAN/PENGELUARAN BARANG -> DISETUJUI : (Nama Kepala Gudang), TTD Digital tanggal dan waktu ACC SIV */}
                <td className={`p-1 align-bottom ${isSideBySide ? 'h-20' : 'h-24'}`}>
                  <div className="flex flex-col justify-between items-center h-full">
                    <div className="flex-1 w-full flex items-center justify-center p-0.5">
                      {showDigitalStamp && isApprovedOrCompleted && (
                        <DigitalAccStamp
                          badge="TTD DIGITAL"
                          title="ACC SIV - KA. GUDANG"
                          date={whLeaderStamp.date}
                          time={whLeaderStamp.time}
                          colorScheme="emerald"
                          compact={true}
                        />
                      )}
                    </div>
                    <div
                      className={`flex items-center justify-between w-full px-1 ${
                        isSideBySide ? 'text-[8.5px]' : 'text-[10px]'
                      } font-semibold text-slate-900`}
                    >
                      <span>(</span>
                      <span className="truncate px-1 text-center">{warehouseHeadDisplayName}</span>
                      <span>)</span>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footnote Persis Gambar: Putih : Akunting   Kuning : Gudang */}
        <div
          className={`flex items-center gap-10 ${
            isSideBySide ? 'text-[8.5px]' : 'text-[10px]'
          } font-medium text-slate-900 mt-1 px-1`}
        >
          <span>Putih : Akunting</span>
          <span>Kuning : Gudang</span>
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// 2. KOMPONEN BLOK TUNGGAL LAPORAN PENERIMAAN BARANG (LPB)
//    - Ukuran A5 (Kertas A4 dibagi 2 Kanan dan Kiri)
//    - Full ke bawah (mengisi penuh tinggi kertas A5 sampai bawah)
//    - Jumlah baris ke bawah mengikuti tinggi kertas (16 baris pada A5)
//    - Apabila nama barang panjang, diteruskan ke baris/kolom bawahnya
//      dan otomatis nomor 2 (serta nomor berikutnya) turun ke baris bawahnya.
// =========================================================================
interface SingleLpbBlockProps {
  lpb: LPBDocument;
  copyLabel: string;
  copyBadgeColor: 'blue' | 'emerald';
  paperCopyColorNote: string;
  formatShortDate: (dateStr: string) => string;
  isCompact?: boolean;
  isSideBySide?: boolean;
  companyName: string;
  companyCity: string;
  companyAddress: string;
  logoUrl?: string;
  docCode: string;
}

interface LpbDisplayRow {
  rowKey: string;
  itemNumber: number | null; // Nomor urut (1, 2, dst.), null apabila baris lanjutan nama barang panjang
  nameLine: string;          // Teks pada kolom Nama Barang
  isContinuation: boolean;   // true apabila baris ini adalah terusan nama barang panjang dari baris di atasnya
  condition: string;
  unit: string;
  quantity: number | string;
  batchNo: string;
  isEmptyRow: boolean;
}

const SingleLpbBlock: React.FC<SingleLpbBlockProps> = ({
  lpb,
  copyLabel,
  copyBadgeColor,
  paperCopyColorNote,
  formatShortDate,
  isCompact = true,
  isSideBySide = false,
  companyName,
  companyCity,
  companyAddress,
  logoUrl,
  docCode,
}) => {
  const badgeClasses = {
    blue: 'border-blue-900 bg-blue-50 text-blue-900',
    emerald: 'border-emerald-900 bg-emerald-50 text-emerald-900',
  }[copyBadgeColor];

  // Batas karakter per baris pada kolom Nama Barang:
  // Pada mode A5 (A4 dibagi 2 Kanan & Kiri), setiap > 27 karakter otomatis diteruskan ke baris bawahnya
  const maxCharsPerNameLine = isSideBySide ? 27 : isCompact ? 42 : 56;

  // Jumlah baris ke bawah mengikuti tinggi kertas A5 (16 baris penuh ke bawah)
  const targetPaperRows = isSideBySide ? 16 : isCompact ? 10 : 14;

  // Susun baris item: apabila nama barang panjang, teruskan ke kolom bawahnya dan otomatis nomor 2 turun
  const itemDisplayRows: LpbDisplayRow[] = [];
  lpb.items.forEach((item, idx) => {
    const wrappedNameLines = wrapTextToLines(item.itemName, maxCharsPerNameLine);
    wrappedNameLines.forEach((lineText, lineIdx) => {
      if (lineIdx === 0) {
        itemDisplayRows.push({
          rowKey: `lpb-item-${idx}-line-0`,
          itemNumber: idx + 1,
          nameLine: lineText,
          isContinuation: false,
          condition: item.condition || 'Baik',
          unit: item.unit || 'Pcs',
          quantity: item.quantity,
          batchNo: item.batchNo || '-',
          isEmptyRow: false,
        });
      } else {
        // Baris lanjutan untuk nama barang panjang ("teruskan kolom bawahnya")
        itemDisplayRows.push({
          rowKey: `lpb-item-${idx}-line-${lineIdx}`,
          itemNumber: null, // Kosong agar nomor berikutnya otomatis turun ke baris di bawahnya
          nameLine: lineText,
          isContinuation: true,
          condition: '',
          unit: '',
          quantity: '',
          batchNo: '',
          isEmptyRow: false,
        });
      }
    });
  });

  // Sisa baris kosong untuk memenuhi kertas sampai ke bawah ("Full kan bawah, jumlah kolom ke bawah mengikuti kertas")
  // Nomor pada baris kosong melanjutkan nomor item terakhir sehingga otomatis turun mengikuti jumlah baris lanjutan
  const emptyRowCount = Math.max(0, targetPaperRows - itemDisplayRows.length);
  const allLpbRows: LpbDisplayRow[] = [...itemDisplayRows];
  for (let emptyIdx = 0; emptyIdx < emptyRowCount; emptyIdx++) {
    allLpbRows.push({
      rowKey: `lpb-empty-${emptyIdx}`,
      itemNumber: lpb.items.length + emptyIdx + 1,
      nameLine: '',
      isContinuation: false,
      condition: '',
      unit: '',
      quantity: '',
      batchNo: '',
      isEmptyRow: true,
    });
  }

  return (
    <div className="bg-white text-slate-900 select-text flex flex-col h-full justify-between">
      {/* BAGIAN ATAS: HEADER + JUDUL + META GRID */}
      <div>
        {/* Header LPB: Logo, Nama Perusahaan, Form Code, Tanggal, No. LPB */}
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-1.5 mb-1 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo"
                className={
                  isSideBySide
                    ? 'w-8 h-8 object-contain shrink-0'
                    : 'w-9 h-9 object-contain shrink-0'
                }
              />
            ) : (
              <AapSproutLogo className={isSideBySide ? 'w-8 h-8' : 'w-9 h-9'} />
            )}
            <div className="min-w-0">
              <h1
                className={`${
                  isSideBySide
                    ? 'text-[11px]'
                    : isCompact
                    ? 'text-xs sm:text-sm'
                    : 'text-sm sm:text-base'
                } font-extrabold text-slate-900 tracking-tight leading-tight uppercase truncate`}
              >
                {companyName}
              </h1>
              <p className="text-[9px] font-bold text-slate-700 truncate">
                {companyCity} &middot;{' '}
                {companyAddress ? companyAddress.split(',')[0] : 'Jawa Timur'}
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="flex items-center justify-end gap-1 mb-0.5 flex-wrap">
              <span
                className={`inline-block border px-1.5 py-0.2 font-bold text-[7.5px] uppercase tracking-wider rounded-xs ${badgeClasses}`}
              >
                {copyLabel}
              </span>
              <div className="inline-block border border-slate-900 px-1 py-0.2 font-bold text-[8px] font-mono text-slate-900 tracking-wider bg-slate-50">
                {docCode || 'FR/AAP/G-LPB/23/002'}
              </div>
            </div>
            <div className="text-[9px] space-y-0.2 font-mono">
              <div className="flex justify-end gap-1">
                <span className="text-slate-600 font-sans font-medium">Tanggal :</span>
                <span className="font-bold text-slate-900">
                  {formatShortDate(lpb.receivedDate)}
                </span>
              </div>
              <div className="flex justify-end gap-1">
                <span className="text-slate-600 font-sans font-medium">No. LPB :</span>
                <span className="font-bold text-slate-900 underline underline-offset-2">
                  {lpb.lpbNumber}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Document Title Center */}
        <div className="text-center my-0.5">
          <h2
            className={`${
              isSideBySide ? 'text-xs' : isCompact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'
            } font-black uppercase tracking-wider text-slate-900`}
          >
            LAPORAN PENERIMAAN BARANG (LPB)
          </h2>
          <p className="text-[7.5px] font-bold uppercase tracking-widest text-slate-700 -mt-0.5">
            GOODS RECEIPT REPORT &mdash; UKURAN A5
          </p>
        </div>

        <p className="text-[8.5px] text-slate-800 mb-1 font-medium">
          Barang - barang yang tertera di bawah ini kami terima dengan baik, sbb :
        </p>

        {/* Meta Grid LPB */}
        <div className="text-[8.5px] text-slate-900 border border-slate-900 p-1.5 mb-1.5 bg-slate-50/60">
          <div className="grid grid-cols-2 gap-x-2.5 gap-y-0.5">
            <div className="flex items-baseline min-w-0">
              <span className="w-16 text-slate-700 shrink-0 font-medium">No. PO</span>
              <span className="mr-1 font-bold">:</span>
              <span className="font-mono font-semibold text-slate-900 border-b border-dotted border-slate-600 flex-1 truncate">
                {lpb.poNumber || '-'}
              </span>
            </div>

            <div className="flex items-baseline min-w-0">
              <span className="w-18 text-slate-700 shrink-0 font-medium">No. SJ</span>
              <span className="mr-1 font-bold">:</span>
              <span className="font-mono font-bold text-slate-900 border-b border-dotted border-slate-600 flex-1 truncate">
                {lpb.sjNumber}
              </span>
            </div>

            <div className="flex items-baseline min-w-0">
              <span className="w-16 text-slate-700 shrink-0 font-medium">Supplier</span>
              <span className="mr-1 font-bold">:</span>
              <span className="font-semibold text-slate-900 border-b border-dotted border-slate-600 flex-1 truncate">
                {lpb.supplierName}
              </span>
            </div>

            <div className="flex items-baseline min-w-0">
              <span className="w-18 text-slate-700 shrink-0 font-medium">Sopir / Plat</span>
              <span className="mr-1 font-bold">:</span>
              <span className="text-slate-800 border-b border-dotted border-slate-600 flex-1 truncate">
                {lpb.driverName || 'Ekspedisi'} {lpb.vehiclePlate ? `(${lpb.vehiclePlate})` : ''}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* BAGIAN TENGAH (FLEX-1 FULL KE BAWAH): TABEL BARANG LPB */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="border border-slate-900 flex-1 flex flex-col overflow-hidden">
          <table className="w-full h-full border-collapse text-[9px]">
            <thead>
              <tr className="border-b border-slate-900 bg-slate-100 font-bold text-slate-900 text-center uppercase text-[8px] h-5.5">
                <th className="border-r border-slate-900 py-0.5 px-1 w-6 text-center">No</th>
                <th className="border-r border-slate-900 py-0.5 px-1.5 text-left">
                  Nama Barang
                </th>
                <th className="border-r border-slate-900 py-0.5 px-1 w-12 text-center">
                  Kualitas
                </th>
                <th className="border-r border-slate-900 py-0.5 px-1 w-11 text-center">
                  Satuan
                </th>
                <th className="border-r border-slate-900 py-0.5 px-1 w-11 text-center">
                  Jumlah
                </th>
                <th className="py-0.5 px-1 w-18 text-center">No. Lot/Batch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900">
              {allLpbRows.map((row) => (
                <tr
                  key={row.rowKey}
                  className={`h-5.5 ${
                    row.isEmptyRow ? 'text-slate-400' : 'text-slate-900'
                  }`}
                >
                  {/* Kolom No: Kosong jika baris lanjutan nama barang panjang, sehingga nomor 2 otomatis turun */}
                  <td
                    className={`border-r border-slate-900 px-1 text-center tabular-nums ${
                      row.isEmptyRow ? 'font-mono text-slate-400' : 'font-bold text-slate-900'
                    }`}
                  >
                    {row.itemNumber !== null ? row.itemNumber : '\u00A0'}
                  </td>

                  {/* Kolom Nama Barang: Jika panjang diteruskan ke baris bawahnya */}
                  <td className="border-r border-slate-900 px-1.5 font-semibold whitespace-nowrap">
                    {row.nameLine || '\u00A0'}
                  </td>

                  {/* Kolom Kualitas */}
                  <td className="border-r border-slate-900 px-1 text-center font-medium whitespace-nowrap">
                    {row.condition || '\u00A0'}
                  </td>

                  {/* Kolom Satuan */}
                  <td className="border-r border-slate-900 px-1 text-center font-medium whitespace-nowrap">
                    {row.unit || '\u00A0'}
                  </td>

                  {/* Kolom Jumlah */}
                  <td className="border-r border-slate-900 px-1 text-center font-bold font-mono tabular-nums whitespace-nowrap">
                    {row.quantity !== '' ? row.quantity : '\u00A0'}
                  </td>

                  {/* Kolom No. Lot/Batch */}
                  <td className="px-1 text-center font-mono text-[8px] text-slate-700 truncate">
                    {row.batchNo || '\u00A0'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* BAGIAN BAWAH (MENEMPEL PENUH DI BAWAH TABEL SAMPAI UJUNG BAWAH KERTAS A5) */}
      <div>
        {/* Usage Purpose & Storage Location Box */}
        <div className="border border-slate-900 border-t-0 p-1.5 text-[8.5px] bg-white text-slate-900">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-baseline min-w-0">
              <span className="shrink-0 text-slate-700 font-medium">Untuk :</span>
              <span className="ml-1 font-semibold border-b border-dotted border-slate-600 flex-1 truncate">
                {lpb.usagePurpose || lpb.notes || 'Persediaan Gudang & Produksi'}
              </span>
            </div>
            <div className="flex items-baseline min-w-0">
              <span className="shrink-0 text-slate-700 font-medium">Rak Simpan :</span>
              <span className="ml-1 font-mono font-bold text-slate-950 border-b border-dotted border-slate-600 flex-1 truncate">
                {lpb.storageLocation || 'Rak A-01 (Gudang Utama)'}
              </span>
            </div>
          </div>
        </div>

        {/* 3 TANDA TANGAN MANUAL (Semua TTD Manual Basah untuk LPB) */}
        <div className="border border-slate-900 border-t-0 text-slate-900 bg-white">
          <table className="w-full border-collapse text-[8.5px]">
            <thead>
              <tr className="border-b border-slate-900 font-bold text-center bg-slate-100 uppercase text-[8px]">
                <th className="border-r border-slate-900 py-0.5 px-1.5 w-1/3">
                  Pengirim / Sopir,
                </th>
                <th className="border-r border-slate-900 py-0.5 px-1.5 w-1/3">
                  Diperiksa Oleh,
                </th>
                <th className="py-0.5 px-1.5 w-1/3">Diterima Oleh,</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                {/* 1. Pengirim / Sopir (Manual) */}
                <td className="border-r border-slate-900 p-1 text-center align-bottom h-16">
                  <div className="flex flex-col justify-between items-center h-full">
                    <div className="flex-1 w-full flex items-center justify-center">
                      <span className="text-[7px] text-slate-400 italic select-none">
                        ( Tanda Tangan Basah )
                      </span>
                    </div>
                    <div className="w-full pt-0.5 border-t border-dotted border-slate-400">
                      <div className="font-bold text-[8px] text-slate-900 truncate">
                        ( {lpb.driverName || '............................'} )
                      </div>
                      <div className="text-[7px] text-slate-500 font-medium">
                        Pengirim / Ekspedisi
                      </div>
                    </div>
                  </div>
                </td>

                {/* 2. Diperiksa Oleh (Staff Gudang Manual) */}
                <td className="border-r border-slate-900 p-1 text-center align-bottom h-16">
                  <div className="flex flex-col justify-between items-center h-full">
                    <div className="flex-1 w-full flex items-center justify-center">
                      <span className="text-[7px] text-slate-400 italic select-none">
                        ( Tanda Tangan Basah )
                      </span>
                    </div>
                    <div className="w-full pt-0.5 border-t border-dotted border-slate-400">
                      <div className="font-bold text-[8px] text-slate-900 truncate">
                        ( ................................ )
                      </div>
                      <div className="text-[7px] text-slate-500 font-medium">
                        Pemeriksa Barang
                      </div>
                    </div>
                  </div>
                </td>

                {/* 3. Diterima Oleh (Kepala Gudang Manual) */}
                <td className="p-1 text-center align-bottom h-16">
                  <div className="flex flex-col justify-between items-center h-full">
                    <div className="flex-1 w-full flex items-center justify-center">
                      <span className="text-[7px] text-slate-400 italic select-none">
                        ( Tanda Tangan Basah )
                      </span>
                    </div>
                    <div className="w-full pt-0.5 border-t border-dotted border-slate-400">
                      <div className="font-bold text-[8px] text-slate-900 truncate">
                        ( {lpb.receivedByAdmin || 'Kepala Gudang AAP'} )
                      </div>
                      <div className="text-[7px] text-slate-500 font-medium">Kepala Gudang</div>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Paper Copies Footnote */}
        <div className="flex items-center justify-between text-[7.5px] font-semibold text-slate-800 mt-1 px-0.5">
          <div className="flex items-center gap-2">
            <span>Putih : Gudang</span>
            <span>Kuning : Purchasing</span>
            <span className="text-slate-500 font-normal">Merah : Supplier</span>
          </div>
          <div className="text-[7px] text-slate-500 font-mono italic truncate">
            {paperCopyColorNote}
          </div>
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// MAIN EXPORT MODAL COMPONENT
// =========================================================================
export const PrintDocumentModal: React.FC<PrintDocumentModalProps> = ({
  documentData,
  onClose,
}) => {
  const { companyProfile } = useInventory();
  const [isExporting, setIsExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Default layout:
  // - Untuk LPB: 'landscape-side' (Ukuran A5 = Kertas A4 dibagi 2 Kanan & Kiri, Full Bawah)
  // - Untuk SIV: 'landscape-single' atau 'landscape-side' (bisa dipilih bebas)
  const [layoutMode, setLayoutMode] = useState<
    'landscape-side' | 'landscape-single' | 'portrait-stack'
  >('landscape-side');

  // Default untuk SIV: Tampilkan TTD Digital Tanggal & Waktu Penyerahan serta ACC SIV Kepala Gudang
  const [showDigitalStamp, setShowDigitalStamp] = useState(true);

  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!documentData) return null;

  const { type, doc } = documentData;
  const isLPB = type === 'LPB';
  const lpb = isLPB ? (doc as LPBDocument) : null;
  const npb = !isLPB ? (doc as IssueVoucherDocument) : null;

  const isLandscape = layoutMode === 'landscape-side' || layoutMode === 'landscape-single';

  const docTitle = isLPB
    ? `LPB_A5_2in1_${lpb?.lpbNumber}`
    : `NOTA_SIV_${npb?.voucherNumber}`;

  const handlePrint = () => {
    if (printAreaRef.current) {
      printElementDirectly(
        printAreaRef.current,
        docTitle,
        isLandscape ? 'landscape' : 'portrait'
      );
    } else {
      window.print();
    }
  };

  const handleDownloadPdf = async () => {
    if (!printAreaRef.current || isExporting) return;
    setIsExporting(true);
    setExportNotice(null);

    const suffix =
      layoutMode === 'landscape-side'
        ? 'A5_KANAN_KIRI_FULL'
        : layoutMode === 'landscape-single'
        ? 'LANDSCAPE'
        : 'PORTRAIT_2IN1';

    const safeFilename = isLPB
      ? `LPB_${lpb?.lpbNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}_${suffix}.pdf`
      : `NOTA_SIV_${npb?.voucherNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}_${suffix}.pdf`;

    const result = await exportElementToPdf(printAreaRef.current, {
      filename: safeFilename,
      title: docTitle,
      orientation: isLandscape ? 'landscape' : 'portrait',
      format: 'a4',
      marginMm: 4,
      fitFullHeight: layoutMode === 'landscape-side',
    });

    setIsExporting(false);

    if (result.success) {
      setExportNotice(
        isLPB
          ? 'File PDF LPB Ukuran A5 (A4 dibagi 2 Kanan & Kiri - Full Bawah) berhasil diekspor dan diunduh!'
          : 'File PDF NOTA PENGAMBILAN BARANG (SIV) berhasil diekspor dan diunduh!'
      );
      setTimeout(() => setExportNotice(null), 4000);
    } else {
      setExportNotice(result.error || 'Gagal membuat file PDF. Silakan coba kembali.');
      setTimeout(() => setExportNotice(null), 5000);
    }
  };

  const formatShortDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = String(d.getFullYear()).slice(-2);
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  };

  // Format DD/MM/YYYY sesuai foto fisik SIV ("17/10/2026")
  const formatFullDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  };

  const formatDigitalAccTimestamp = (
    timestamp?: string,
    fallbackDate?: string,
    defaultHour = 9,
    defaultMinute = 15
  ) => {
    let dateObj: Date | null = null;
    if (timestamp) {
      const parsed = new Date(timestamp);
      if (!isNaN(parsed.getTime())) {
        dateObj = parsed;
      }
    }
    if (!dateObj && fallbackDate) {
      const parsed = new Date(fallbackDate);
      if (!isNaN(parsed.getTime())) {
        dateObj = parsed;
        if (!fallbackDate.includes('T') && !fallbackDate.includes(':')) {
          dateObj.setHours(defaultHour, defaultMinute, 0, 0);
        }
      }
    }
    if (!dateObj) {
      dateObj = new Date();
    }

    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const seconds = String(dateObj.getSeconds()).padStart(2, '0');

    return {
      date: `${day}/${month}/${year}`,
      time: `${hours}:${minutes}:${seconds} WIB`,
      shortTime: `${hours}:${minutes} WIB`,
    };
  };

  const reqApprovalStamp = formatDigitalAccTimestamp(
    npb?.createdAt || npb?.requestDate,
    npb?.requestDate,
    9,
    30
  );

  const handoverStamp = formatDigitalAccTimestamp(
    npb?.handoverAt || npb?.approvedAt || npb?.updatedAt || npb?.createdAt,
    npb?.requestDate,
    14,
    25
  );

  const whLeaderStamp = formatDigitalAccTimestamp(
    npb?.headApprovedAt || npb?.approvedAt || npb?.updatedAt || npb?.createdAt,
    npb?.requestDate,
    11,
    15
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="print-modal-container relative w-full max-w-6xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-3 sm:my-6 max-h-[94vh] flex flex-col">
        {/* Top Control Bar */}
        <div className="no-print flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-slate-900 text-white shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2 truncate mr-2">
            <FileText className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="truncate">
              <span className="font-semibold text-xs sm:text-sm block truncate">
                Pratinjau Cetak &amp; Ekspor PDF:{' '}
                {isLPB ? `LPB (${lpb?.lpbNumber})` : `Nota SIV (${npb?.voucherNumber})`}
              </span>
              <span className="text-[10px] text-slate-300 hidden sm:block">
                {companyProfile.companyName || 'PT. Abadi Agrosindo Persada'} &middot;{' '}
                {isLPB
                  ? 'Ukuran A5 × 2 (Kertas A4 dibagi 2 Kanan & Kiri — Full Bawah)'
                  : 'Format Resmi Nota Pengambilan Barang (FR/AAP/G-STR/23/001)'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Toggle Stempel ACC Digital khusus SIV */}
            {!isLPB && (
              <button
                type="button"
                onClick={() => setShowDigitalStamp((prev) => !prev)}
                className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  showDigitalStamp
                    ? 'bg-blue-600/20 border-blue-400 text-blue-200'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                }`}
                title="Tampilkan atau sembunyikan TTD Digital Tanggal & Waktu pada kolom tanda tangan SIV"
              >
                <Stamp className="w-3.5 h-3.5" />
                <span>{showDigitalStamp ? 'TTD Digital: Aktif' : 'TTD Polos (Tanpa Jam)'}</span>
              </button>
            )}

            {/* Layout Mode Switcher */}
            <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setLayoutMode('landscape-side')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors flex items-center gap-1.5 ${
                  layoutMode === 'landscape-side'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Ukuran A5 (Kertas A4 Landscape dibagi 2 Kanan & Kiri - Full Bawah)"
              >
                <Columns2 className="w-3.5 h-3.5" />
                <span>Ukuran A5 (A4 Jadi 2 Kanan-Kiri)</span>
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('landscape-single')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                  layoutMode === 'landscape-single'
                    ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="1 Tabel Lebar Penuh dalam 1 Lembar Landscape"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>1 Lembar Penuh (Landscape)</span>
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('portrait-stack')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                  layoutMode === 'portrait-stack'
                    ? 'bg-emerald-600 text-white font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="2 Rangkap Atas-Bawah pada Kertas A4 Portrait"
              >
                <Rows2 className="w-3.5 h-3.5" />
                <span>Atas-Bawah (Portrait)</span>
              </button>
            </div>

            {/* Download PDF button */}
            <button
              onClick={handleDownloadPdf}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-700/60 rounded-lg transition-colors shadow-xs"
              title="Unduh langsung sebagai file dokumen PDF"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Membuat PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Unduh PDF</span>
                </>
              )}
            </button>

            {/* Print button */}
            <button
              onClick={handlePrint}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-lg border border-slate-700 transition-colors shadow-2xs"
              title="Buka dialog cetak browser"
            >
              <Printer className="w-4 h-4 text-slate-400" />
              <span className="hidden sm:inline">Cetak</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors ml-1"
              title="Tutup Pratinjau"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Download notification banner */}
        {exportNotice && (
          <div className="no-print px-4 py-2 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{exportNotice}</span>
            </div>
            <button
              onClick={() => setExportNotice(null)}
              className="text-emerald-700 hover:text-emerald-900 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Informative Guidance Banner */}
        <div className="no-print px-4 sm:px-6 py-2 bg-slate-100 border-b border-slate-200 text-xs text-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span>
              {isLPB ? (
                layoutMode === 'landscape-side' ? (
                  <>
                    Format <strong>LPB Ukuran A5 (Kertas A4 dibagi 2 Kanan &amp; Kiri)</strong>:{' '}
                    Tabel ditarik <strong>Full ke Bawah</strong> mengikuti tinggi kertas A5 (16 baris).
                    Nama barang panjang otomatis diteruskan ke baris bawahnya dan menggeser nomor urut berikutnya.
                  </>
                ) : (
                  <>
                    Format <strong>LPB</strong>: Nama barang panjang otomatis diteruskan ke baris
                    bawahnya dan menggeser nomor urut berikutnya.
                  </>
                )
              ) : (
                <>
                  Format <strong>NOTA PENGAMBILAN BARANG (STORE ISSUE VOUCHER)</strong> sesuai form
                  resmi <strong>{companyProfile.sivDocCode || 'FR/AAP/G-STR/23/001'}</strong>{' '}
                  (Kolom: No, Material Code, Nama Barang, Jumlah, Sat, Cost Center, GL Acc).
                </>
              )}
            </span>
          </div>

          <span className="text-[11px] font-mono text-slate-500 hidden sm:inline shrink-0">
            {layoutMode === 'landscape-side'
              ? '2 × A5 (148.5 × 210 mm) pada 1 A4 Landscape'
              : isLandscape
              ? 'A4 Landscape (297 × 210 mm)'
              : 'A4 Portrait (210 × 297 mm)'}
          </span>
        </div>

        {/* Printable Sheet Viewport */}
        <div className="p-3 sm:p-5 overflow-auto flex-1 bg-slate-200/80">
          <div
            ref={printAreaRef}
            className="print-container bg-white text-slate-900 shadow-md mx-auto p-2.5 sm:p-3 flex flex-col"
            style={{
              width: isLandscape ? '1080px' : '794px',
              minHeight:
                layoutMode === 'landscape-side'
                  ? '756px' // Rasio presisi A4 Landscape (289mm : 202mm) agar A5 Kanan-Kiri Full sampai bawah kertas
                  : isLandscape
                  ? '680px'
                  : '1080px',
            }}
          >
            {/* =================================================================== */}
            {/* 1. NOTA PENGAMBILAN BARANG (SIV) — PERSIS SESUAI GAMBAR FISIK       */}
            {/* =================================================================== */}
            {!isLPB && npb && (
              <div className="flex-1 flex flex-col h-full">
                {layoutMode === 'landscape-side' ? (
                  <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2.5 flex-1 h-full">
                    {/* KIRI: LEMBAR 1 (PUTIH : AKUNTING / ADMIN) */}
                    <div className="p-2 bg-white min-w-0 flex flex-col h-full">
                      <SingleNotaBlock
                        npb={npb}
                        formatFullDate={formatFullDate}
                        reqApprovalStamp={reqApprovalStamp}
                        handoverStamp={handoverStamp}
                        whLeaderStamp={whLeaderStamp}
                        isSideBySide={true}
                        showDigitalStamp={showDigitalStamp}
                        companyName={companyProfile.companyName || 'PT. Abadi Agrosindo Persada'}
                        companyCity={companyProfile.city || 'Sidoarjo'}
                        logoUrl={companyProfile.logoUrl}
                        docCode={companyProfile.sivDocCode || 'FR/AAP/G-STR/23/001'}
                      />
                    </div>

                    {/* GARIS POTONG VERTIKAL TENGAH */}
                    <div className="flex flex-col items-center justify-between py-2 px-0.5 border-l border-r border-dashed border-slate-400 bg-slate-50/70 select-none text-slate-500">
                      <Scissors className="w-3.5 h-3.5 text-slate-600 rotate-90" />
                      <span
                        className="text-[7.5px] font-mono font-bold uppercase tracking-widest text-slate-500"
                        style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                      >
                        POTONG DI SINI &mdash; PUTIH : AKUNTING (KIRI) &amp; KUNING : GUDANG (KANAN)
                      </span>
                      <Scissors className="w-3.5 h-3.5 text-slate-600 -rotate-90" />
                    </div>

                    {/* KANAN: LEMBAR 2 (KUNING : GUDANG / PENERIMA) */}
                    <div className="p-2 bg-white min-w-0 flex flex-col h-full">
                      <SingleNotaBlock
                        npb={npb}
                        formatFullDate={formatFullDate}
                        reqApprovalStamp={reqApprovalStamp}
                        handoverStamp={handoverStamp}
                        whLeaderStamp={whLeaderStamp}
                        isSideBySide={true}
                        showDigitalStamp={showDigitalStamp}
                        companyName={companyProfile.companyName || 'PT. Abadi Agrosindo Persada'}
                        companyCity={companyProfile.city || 'Sidoarjo'}
                        logoUrl={companyProfile.logoUrl}
                        docCode={companyProfile.sivDocCode || 'FR/AAP/G-STR/23/001'}
                      />
                    </div>
                  </div>
                ) : layoutMode === 'landscape-single' ? (
                  <div className="p-4 bg-white flex-1 flex flex-col h-full">
                    <SingleNotaBlock
                      npb={npb}
                      formatFullDate={formatFullDate}
                      reqApprovalStamp={reqApprovalStamp}
                      handoverStamp={handoverStamp}
                      whLeaderStamp={whLeaderStamp}
                      isSideBySide={false}
                      showDigitalStamp={showDigitalStamp}
                      companyName={companyProfile.companyName || 'PT. Abadi Agrosindo Persada'}
                      companyCity={companyProfile.city || 'Sidoarjo'}
                      logoUrl={companyProfile.logoUrl}
                      docCode={companyProfile.sivDocCode || 'FR/AAP/G-STR/23/001'}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col justify-between flex-1 h-full gap-2">
                    {/* ATAS: LEMBAR 1 */}
                    <div className="p-3 bg-white flex-1 flex flex-col">
                      <SingleNotaBlock
                        npb={npb}
                        formatFullDate={formatFullDate}
                        reqApprovalStamp={reqApprovalStamp}
                        handoverStamp={handoverStamp}
                        whLeaderStamp={whLeaderStamp}
                        isSideBySide={false}
                        showDigitalStamp={showDigitalStamp}
                        companyName={companyProfile.companyName || 'PT. Abadi Agrosindo Persada'}
                        companyCity={companyProfile.city || 'Sidoarjo'}
                        logoUrl={companyProfile.logoUrl}
                        docCode={companyProfile.sivDocCode || 'FR/AAP/G-STR/23/001'}
                      />
                    </div>

                    {/* Garis Potong Tengah */}
                    <div className="py-0.5 flex items-center justify-center text-slate-500 text-[9px] font-mono border-t border-b border-dashed border-slate-400 bg-slate-50 select-none">
                      <div className="flex items-center gap-2 font-bold uppercase tracking-widest text-slate-600">
                        <Scissors className="w-3 h-3 text-slate-600" />
                        <span>POTONG DI SINI &mdash; PUTIH : AKUNTING &amp; KUNING : GUDANG</span>
                        <Scissors className="w-3 h-3 text-slate-600" />
                      </div>
                    </div>

                    {/* BAWAH: LEMBAR 2 */}
                    <div className="p-3 bg-white flex-1 flex flex-col">
                      <SingleNotaBlock
                        npb={npb}
                        formatFullDate={formatFullDate}
                        reqApprovalStamp={reqApprovalStamp}
                        handoverStamp={handoverStamp}
                        whLeaderStamp={whLeaderStamp}
                        isSideBySide={false}
                        showDigitalStamp={showDigitalStamp}
                        companyName={companyProfile.companyName || 'PT. Abadi Agrosindo Persada'}
                        companyCity={companyProfile.city || 'Sidoarjo'}
                        logoUrl={companyProfile.logoUrl}
                        docCode={companyProfile.sivDocCode || 'FR/AAP/G-STR/23/001'}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* =================================================================== */}
            {/* 2. LAPORAN PENERIMAAN BARANG (LPB) — UKURAN A5 (A4 JADI 2), FULL BAWAH */}
            {/* =================================================================== */}
            {isLPB && lpb && (
              <div className="flex-1 flex flex-col h-full">
                {layoutMode === 'landscape-side' ? (
                  <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2 flex-1 h-full">
                    {/* KIRI (UKURAN A5 FULL BAWAH): LEMBAR 1 ARSIP GUDANG / ADMIN */}
                    <div className="border border-slate-900 p-2.5 bg-white min-w-0 flex flex-col h-full">
                      <SingleLpbBlock
                        lpb={lpb}
                        copyLabel="LEMBAR 1 (A5) : ARSIP GUDANG / ADMIN"
                        copyBadgeColor="blue"
                        paperCopyColorNote="Lembar 1 (Kiri - A5): Arsip Pembukuan & Kontrol Gudang"
                        formatShortDate={formatShortDate}
                        isCompact={true}
                        isSideBySide={true}
                        companyName={companyProfile.companyName || 'PT. Abadi Agrosindo Persada'}
                        companyCity={companyProfile.city || 'Sidoarjo'}
                        companyAddress={
                          companyProfile.address || 'Kawasan Industri Pergudangan'
                        }
                        logoUrl={companyProfile.logoUrl}
                        docCode={companyProfile.lpbDocCode || 'FR/AAP/G-LPB/23/002'}
                      />
                    </div>

                    {/* GARIS POTONG VERTIKAL TENGAH (PEMBAGI A4 MENJADI 2 LEMBAR A5) */}
                    <div className="flex flex-col items-center justify-between py-2 px-0.5 border-l border-r border-dashed border-slate-400 bg-slate-50/70 select-none text-slate-500">
                      <Scissors className="w-3.5 h-3.5 text-slate-600 rotate-90" />
                      <span
                        className="text-[7.5px] font-mono font-bold uppercase tracking-widest text-slate-600"
                        style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                      >
                        GARIS POTONG A5 &mdash; KIRI : GUDANG &amp; KANAN : PURCHASING / SUPPLIER
                      </span>
                      <Scissors className="w-3.5 h-3.5 text-slate-600 -rotate-90" />
                    </div>

                    {/* KANAN (UKURAN A5 FULL BAWAH): LEMBAR 2 ARSIP PURCHASING / SUPPLIER */}
                    <div className="border border-slate-900 p-2.5 bg-white min-w-0 flex flex-col h-full">
                      <SingleLpbBlock
                        lpb={lpb}
                        copyLabel="LEMBAR 2 (A5) : ARSIP PURCHASING / SUPPLIER"
                        copyBadgeColor="emerald"
                        paperCopyColorNote="Lembar 2 (Kanan - A5): Tembusan Purchasing & Supplier"
                        formatShortDate={formatShortDate}
                        isCompact={true}
                        isSideBySide={true}
                        companyName={companyProfile.companyName || 'PT. Abadi Agrosindo Persada'}
                        companyCity={companyProfile.city || 'Sidoarjo'}
                        companyAddress={
                          companyProfile.address || 'Kawasan Industri Pergudangan'
                        }
                        logoUrl={companyProfile.logoUrl}
                        docCode={companyProfile.lpbDocCode || 'FR/AAP/G-LPB/23/002'}
                      />
                    </div>
                  </div>
                ) : layoutMode === 'landscape-single' ? (
                  <div className="border border-slate-900 p-4 bg-white flex-1 flex flex-col h-full">
                    <SingleLpbBlock
                      lpb={lpb}
                      copyLabel="ARSIP RESMI GUDANG & PURCHASING (A4 LANDSCAPE)"
                      copyBadgeColor="blue"
                      paperCopyColorNote="1 Lembar A4 Landscape Resmi Gudang PT. Abadi Agrosindo Persada"
                      formatShortDate={formatShortDate}
                      isCompact={false}
                      isSideBySide={false}
                      companyName={companyProfile.companyName || 'PT. Abadi Agrosindo Persada'}
                      companyCity={companyProfile.city || 'Sidoarjo'}
                      companyAddress={
                        companyProfile.address || 'Kawasan Industri Pergudangan'
                      }
                      logoUrl={companyProfile.logoUrl}
                      docCode={companyProfile.lpbDocCode || 'FR/AAP/G-LPB/23/002'}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col justify-between flex-1 h-full gap-2">
                    {/* LEMBAR 1: ARSIP GUDANG */}
                    <div className="border border-slate-900 p-2.5 sm:p-3 bg-white flex-1 flex flex-col">
                      <SingleLpbBlock
                        lpb={lpb}
                        copyLabel="LEMBAR 1 : ARSIP GUDANG"
                        copyBadgeColor="blue"
                        paperCopyColorNote="Lembar 1: Arsip Pembukuan & Kontrol Gudang"
                        formatShortDate={formatShortDate}
                        isCompact={true}
                        companyName={companyProfile.companyName || 'PT. Abadi Agrosindo Persada'}
                        companyCity={companyProfile.city || 'Sidoarjo'}
                        companyAddress={
                          companyProfile.address || 'Kawasan Industri Pergudangan'
                        }
                        logoUrl={companyProfile.logoUrl}
                        docCode={companyProfile.lpbDocCode || 'FR/AAP/G-LPB/23/002'}
                      />
                    </div>

                    {/* Perforated Cutting Line */}
                    <div className="py-0.5 flex items-center justify-center text-slate-500 text-[9px] font-mono border-t border-b border-dashed border-slate-400 bg-slate-50 select-none">
                      <div className="flex items-center gap-2 font-bold uppercase tracking-widest text-slate-600">
                        <Scissors className="w-3 h-3 text-slate-600" />
                        <span>
                          POTONG DI SINI &mdash; PISAHKAN ARSIP GUDANG DAN PURCHASING / SUPPLIER
                        </span>
                        <Scissors className="w-3 h-3 text-slate-600" />
                      </div>
                    </div>

                    {/* LEMBAR 2: ARSIP PURCHASING / SUPPLIER */}
                    <div className="border border-slate-900 p-2.5 sm:p-3 bg-white flex-1 flex flex-col">
                      <SingleLpbBlock
                        lpb={lpb}
                        copyLabel="LEMBAR 2 : ARSIP PURCHASING / SUPPLIER"
                        copyBadgeColor="emerald"
                        paperCopyColorNote="Lembar 2: Tembusan Purchasing & Dokumen Vendor"
                        formatShortDate={formatShortDate}
                        isCompact={true}
                        companyName={companyProfile.companyName || 'PT. Abadi Agrosindo Persada'}
                        companyCity={companyProfile.city || 'Sidoarjo'}
                        companyAddress={
                          companyProfile.address || 'Kawasan Industri Pergudangan'
                        }
                        logoUrl={companyProfile.logoUrl}
                        docCode={companyProfile.lpbDocCode || 'FR/AAP/G-LPB/23/002'}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Bottom Bar */}
        <div className="no-print px-6 py-3 bg-slate-100 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
          >
            Tutup Pratinjau
          </button>
        </div>
      </div>
    </div>
  );
};
