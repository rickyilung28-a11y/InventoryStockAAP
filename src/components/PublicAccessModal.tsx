import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { useInventory } from '../context/InventoryContext';
import {
  Globe,
  X,
  QrCode,
  Copy,
  Check,
  ShieldCheck,
  Users,
  ExternalLink,
} from 'lucide-react';

interface PublicAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PublicAccessModal: React.FC<PublicAccessModalProps> = ({ isOpen, onClose }) => {
  const { currentUser } = useInventory();

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [livePublicUrl, setLivePublicUrl] = useState<string>(
    typeof window !== 'undefined' ? window.location.origin : ''
  );

  useEffect(() => {
    fetch('/api/public-url')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.publicUrl) {
          setLivePublicUrl(data.publicUrl);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  const loginUrl = livePublicUrl || (typeof window !== 'undefined' ? window.location.origin : '');

  useEffect(() => {
    if (!isOpen || !loginUrl) return;
    QRCode.toDataURL(loginUrl, {
      width: 220,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(''));
  }, [loginUrl, isOpen]);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(loginUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // fallback
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  Link Login Sistem &amp; QR Code Aplikasi
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Bagikan link ini agar setiap pengguna dapat login menggunakan username &amp; password masing-masing.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4 text-xs">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-5">
            {qrDataUrl && (
              <div className="keep-light-surface bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs shrink-0">
                <img
                  src={qrDataUrl}
                  alt="QR Code Login Aplikasi"
                  className="w-36 h-36 object-contain"
                />
                <div className="text-[10px] text-center font-mono text-slate-600 mt-1">
                  Scan untuk Buka Halaman Login
                </div>
              </div>
            )}

            <div className="flex-1 space-y-3 w-full">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" />
                  <span>Tautan Halaman Login (Deploy URL)</span>
                </span>
                <p className="text-slate-600 text-[11px] mt-1 leading-relaxed">
                  Setiap pengguna yang membuka link ini akan diarahkan ke <strong>Halaman Login</strong> dan wajib memasukkan <strong>Username &amp; Password</strong> akun masing-masing.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={loginUrl}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-800 select-all focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shrink-0 transition-colors shadow-2xs cursor-pointer"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Salin Link</span>
                    </>
                  )}
                </button>
              </div>

              <div className="pt-1">
                <a
                  href={loginUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-emerald-700 hover:text-emerald-800 font-semibold text-xs underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Buka Link Login di Tab Baru</span>
                </a>
              </div>
            </div>
          </div>

          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-[11px] text-emerald-900">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong>Keamanan Akun &amp; Sinkronisasi Server:</strong> Fitur login cepat telah dinonaktifkan. Seluruh pengguna wajib login menggunakan Username &amp; Password yang terdaftar pada menu <strong>Manajemen Pengguna</strong>.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <Users className="w-4 h-4 text-emerald-600" />
            <span>
              Login Saat Ini: <strong>{currentUser?.name}</strong> (@{currentUser?.username})
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
