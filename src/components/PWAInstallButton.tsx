import React, { useState } from 'react';
import { Download, ExternalLink, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  // Hide install button when already running in standalone installed PWA mode
  if (isInstalled) {
    return null;
  }

  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
  const currentUrl = typeof window !== 'undefined' ? window.location.origin : '/';

  const handleClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) {
        setShowInstallGuide(true);
      }
      return;
    }
    setShowInstallGuide(true);
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-2xl bg-[#440405] text-white text-xs font-bold hover:bg-[#5c0b0d] transition-all shadow-md active:scale-95 border border-[#C99A49]/40 shrink-0"
        title="Uygulamayı Cihaza Yükle (PWA)"
      >
        <Download className="w-3.5 h-3.5 text-[#E0B15A] shrink-0" />
        <span className="hidden sm:inline">Uygulamayı Yükle</span>
        <span className="sm:hidden">Yükle</span>
      </button>

      {showInstallGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowInstallGuide(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#1E1E1E] p-6 shadow-2xl border border-black/10 dark:border-white/10 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start gap-3">
              <div className="flex items-center gap-3">
                <img
                  src="/icon-192.png"
                  alt="Dijital Kütüphanem İkonu"
                  className="w-12 h-12 rounded-xl shadow-md shrink-0"
                />
                <div>
                  <h3 className="text-base font-serif-title font-bold text-[#440405] dark:text-[#E0B15A]">
                    Dijital Kütüphanem Yükle
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Ana ekrana uygulama olarak ekleyin
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowInstallGuide(false)}
                className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-slate-500"
                aria-label="Kapat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isInIframe && (
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-800 dark:text-amber-300 space-y-2">
                <p className="font-semibold">Önizleme Penceresindesiniz</p>
                <p className="leading-relaxed">
                  Tarayıcı güvenlik kuralları gereği PWA kurulumu için uygulamayı doğrudan tarayıcı sekmesinde açmanız gerekir.
                </p>
                <a
                  href={currentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#440405] text-white font-semibold hover:bg-[#5c0b0d] transition"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[#E0B15A]" />
                  <span>Tarayıcıda Aç</span>
                </a>
              </div>
            )}

            {isIOS ? (
              <div className="p-3.5 rounded-2xl bg-[#F8F5EF] dark:bg-[#141414] text-xs text-slate-700 dark:text-slate-300 leading-relaxed space-y-1.5">
                <p className="font-bold flex items-center gap-1.5 text-[#440405] dark:text-[#E0B15A]">
                  <Smartphone className="w-4 h-4" />
                  iPhone / iPad (Safari):
                </p>
                <p>1. Safari alt menüsündeki <strong>Paylaş</strong> simgesine dokunun.</p>
                <p>2. Listeden <strong>Ana Ekrana Ekle</strong> seçeneğine dokunun.</p>
                <p>3. Sağ üstteki <strong>Ekle</strong> butonuna basın.</p>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-[#F8F5EF] dark:bg-[#141414] text-xs text-slate-700 dark:text-slate-300 leading-relaxed space-y-1.5">
                <p className="font-bold flex items-center gap-1.5 text-[#440405] dark:text-[#E0B15A]">
                  <Smartphone className="w-4 h-4" />
                  Android Chrome / Masaüstü:
                </p>
                <p>1. Sağ üst köşedeki <strong>⋮</strong> (üç nokta) menüsünü açın.</p>
                <p>2. <strong>Ana ekrana ekle</strong> veya <strong>Uygulamayı yükle</strong> seçeneğine dokunun.</p>
                <p>3. Açılan pencerede <strong>Yükle</strong> butonunu onaylayın.</p>
              </div>
            )}

            <button
              onClick={() => setShowInstallGuide(false)}
              className="w-full rounded-xl bg-[#440405] py-2.5 text-xs font-semibold text-white hover:bg-[#5c0b0d] transition"
            >
              Anladım
            </button>
          </div>
        </div>
      )}
    </>
  );
};
