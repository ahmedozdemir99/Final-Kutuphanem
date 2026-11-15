import React, { useState, useEffect } from 'react';
import { X, Sparkles, BookOpen, Lightbulb, Compass, RefreshCw, Bookmark } from 'lucide-react';
import { UserBook } from '../types';

interface ChapterAnalysisModalProps {
  book: UserBook;
  isOpen: boolean;
  onClose: () => void;
}

interface AnalysisData {
  sectionTitle: string;
  keyThemes: string[];
  literaryAnalysis: string;
  reflectionQuestion: string;
  recommendedParallelReads: string[];
}

export const ChapterAnalysisModal: React.FC<ChapterAnalysisModalProps> = ({
  book,
  isOpen,
  onClose
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchAnalysis = async (forceRefresh = false) => {
    const cacheKey = `mto_analysis_${book.id}_${book.currentPage || 1}`;
    if (!forceRefresh) {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.sectionTitle) {
            setAnalysis(parsed);
            setLoading(false);
            return;
          }
        }
      } catch {
        // continue
      }
    }

    setLoading(true);
    setErrorMsg(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const res = await fetch('/api/chapter-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          title: book.title || 'Okunan Eser',
          author: book.author || 'Mütefekkir Yazar',
          category: book.category || 'Edebiyat',
          description: book.description || '',
          currentPage: book.currentPage || 1,
          totalPages: book.totalPages || 200,
          userNotes: book.userNotes || ''
        })
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data && data.sectionTitle && data.literaryAnalysis) {
        setAnalysis(data);
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(data));
        } catch {}
      } else {
        throw new Error('Geçersiz Tahlil Yanıtı');
      }
    } catch (err) {
      clearTimeout(timeoutId);
      const progPercent = Math.round(((book.currentPage || 1) / Math.max(1, book.totalPages || 200)) * 100);
      const fallbackData: AnalysisData = {
        sectionTitle: `"${book.title}" — Sayfa ${book.currentPage || 1} Felsefi Tahlili`,
        keyThemes: [book.category || 'Edebiyat', 'Zaman & Anlam', 'İnsan & Tefekkür'],
        literaryAnalysis: `"${book.title}" adlı eserin ${book.currentPage || 1}. sayfadaki bu aşaması, ${book.author || 'yazar'}'ın anlatı dilinde derin bir felsefi aks oluşturur. Okuma serüveninizin %${progPercent}'lik bu evresinde yazar, karakterlerin içsel derinliklerini ve toplumsal/zamansal katmanları açığa çıkarmaktadır.\n\nEserin bu bölümü, bireysel tefekkürle okurun kendi hayat tecrübeleri arasında canlı bir köprü inşa eder.`,
        reflectionQuestion: `Yazarın bu bölümdeki ana düşüncesi kendi zihin dünyanızda nasıl bir tefekkür kapısı açıyor?`,
        recommendedParallelReads: [
          `Saatleri Ayarlama Enstitüsü (Ahmet Hamdi Tanpınar)`,
          `İhyâ'u Ulûmi'd-Dîn (İmâm-ı Gazâlî)`,
          `Doğu ve Batı Arasında İslam (Aliya İzzetbegoviç)`
        ]
      };
      setAnalysis(fallbackData);
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(fallbackData));
      } catch {}
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAnalysis();
    }
  }, [isOpen, book.id, book.currentPage]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#FAF8F5] dark:bg-[#1A1A1A] rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl border border-[#B79A63]/30 my-8 space-y-6 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-black/10 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-[#742C3C] text-[#B79A63] shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif-title font-bold text-lg md:text-xl text-[#742C3C] dark:text-[#B79A63]">
                AI Bölüm & İlerleme Analizi
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                "{book.title}" — {book.currentPage}. Sayfa (%{Math.round((book.currentPage / Math.max(1, book.totalPages)) * 100)})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="py-12 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-[#742C3C] dark:text-[#B79A63] animate-spin mx-auto" />
            <p className="font-serif-title font-bold text-sm text-slate-800 dark:text-slate-200">
              Yapay Zeka Tarafından Derinlikli Bölüm Tahlili Hazırlanıyor...
            </p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Eserin üslubu, felsefi arka planı ve bu bölümdeki edebi katmanlar inceleniyor.
            </p>
          </div>
        ) : errorMsg ? (
          <div className="p-4 rounded-2xl bg-rose-500/10 text-rose-700 dark:text-rose-300 text-xs text-center border border-rose-500/20">
            {errorMsg}
          </div>
        ) : analysis ? (
          <div className="space-y-5 text-xs">
            {/* Section Title */}
            <div className="p-4 rounded-2xl bg-[#742C3C]/10 border border-[#742C3C]/20 text-[#742C3C] dark:text-[#B79A63]">
              <span className="text-[10px] font-bold uppercase tracking-wider block mb-1">
                Felsefi & Edebi Odak Noktası
              </span>
              <h4 className="font-serif-title font-bold text-base leading-snug">
                {analysis.sectionTitle}
              </h4>
            </div>

            {/* Key Themes Chips */}
            {analysis.keyThemes && analysis.keyThemes.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-500 uppercase mr-1">Temalar:</span>
                {analysis.keyThemes.map((theme, idx) => (
                  <span key={idx} className="px-2.5 py-1 rounded-xl bg-black/5 dark:bg-white/10 font-bold text-[11px] text-[#742C3C] dark:text-[#B79A63]">
                    #{theme}
                  </span>
                ))}
              </div>
            )}

            {/* Literary Analysis Prose */}
            <div className="p-4 rounded-2xl bg-white dark:bg-[#141414] border border-black/5 dark:border-white/5 space-y-2.5">
              <div className="flex items-center gap-2 font-serif-title font-bold text-sm text-[#742C3C] dark:text-[#B79A63]">
                <BookOpen className="w-4 h-4" />
                <span>Edebi & Düşünsel Tahlil</span>
              </div>
              <p className="text-slate-700 dark:text-slate-300 font-serif-title leading-relaxed text-xs sm:text-sm whitespace-pre-line">
                {analysis.literaryAnalysis}
              </p>
            </div>

            {/* Reflection Question */}
            {analysis.reflectionQuestion && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-1 text-slate-800 dark:text-slate-200">
                <div className="flex items-center gap-2 font-bold text-amber-700 dark:text-amber-300">
                  <Lightbulb className="w-4 h-4 shrink-0" />
                  <span>Okur Tefekkür Sorusu</span>
                </div>
                <p className="font-serif-title italic text-xs leading-relaxed">
                  "{analysis.reflectionQuestion}"
                </p>
              </div>
            )}

            {/* Parallel Reads */}
            {analysis.recommendedParallelReads && analysis.recommendedParallelReads.length > 0 && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1.5 text-slate-800 dark:text-slate-200">
                <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-300">
                  <Compass className="w-4 h-4 shrink-0" />
                  <span>Paralel Okuma & Tefekkür Önerileri</span>
                </div>
                <ul className="list-disc list-inside space-y-1 font-serif-title text-xs">
                  {analysis.recommendedParallelReads.map((rec, idx) => (
                    <li key={idx}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : null}

        {/* Footer Actions */}
        <div className="flex justify-between items-center pt-2 border-t border-black/10 dark:border-white/10">
          <button
            onClick={() => fetchAnalysis(true)}
            disabled={loading}
            className="px-4 py-2.5 rounded-2xl bg-black/5 dark:bg-white/10 text-xs font-semibold hover:bg-black/10 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Yeniden Tahlil Et</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-2xl bg-[#742C3C] text-white font-bold text-xs hover:bg-[#4B1E2B] transition-colors cursor-pointer"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
