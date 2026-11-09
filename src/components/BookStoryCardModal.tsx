import React, { useState, useRef, useEffect } from 'react';
import { X, Download, Share2, Sparkles, Check, Palette, Quote as QuoteIcon, BookOpen, Type, Sun, Moon, Sparkle, CheckCircle2 } from 'lucide-react';
import { UserBook, Quotation } from '../types';
import { getCoverFromIDB } from '../lib/indexedDb';

interface BookStoryCardModalProps {
  book: UserBook;
  quotations?: Quotation[];
  isOpen: boolean;
  onClose: () => void;
}

type StoryTheme = 'crimson' | 'midnight' | 'emerald' | 'parchment';
type QuoteBgStyle = 'parchment' | 'midnight' | 'emerald' | 'gold_luxury';
type FontSize = 'small' | 'medium' | 'large';
type FontStyle = 'serif' | 'sans' | 'italic' | 'mono';

const THEMES: Record<StoryTheme, {
  name: string;
  gradStart: string;
  gradMid: string;
  gradEnd: string;
  textColor: string;
  subTextColor: string;
  goldColor: string;
}> = {
  crimson: {
    name: 'Bordo & Altın',
    gradStart: '#4A1521',
    gradMid: '#742C3C',
    gradEnd: '#240A10',
    textColor: '#FFFFFF',
    subTextColor: '#F3E5AB',
    goldColor: '#D4AF37',
  },
  midnight: {
    name: 'Gece & Yıldız',
    gradStart: '#0F172A',
    gradMid: '#1E1B4B',
    gradEnd: '#020617',
    textColor: '#FFFFFF',
    subTextColor: '#A5B4FC',
    goldColor: '#F59E0B',
  },
  emerald: {
    name: 'Zümrüt & İrfan',
    gradStart: '#044B35',
    gradMid: '#063826',
    gradEnd: '#011B13',
    textColor: '#FFFFFF',
    subTextColor: '#D4AF37',
    goldColor: '#D4AF37',
  },
  parchment: {
    name: 'Klasik Fildişi',
    gradStart: '#FAF6EE',
    gradMid: '#F3EAD7',
    gradEnd: '#E5DAC0',
    textColor: '#2C2523',
    subTextColor: '#742C3C',
    goldColor: '#742C3C',
  },
};

const INSPIRATIONAL_QUOTES = [
  "Kitaplar, aklın dondurulmuş çığlıkları ve kalbin sonsuz fısıltılarıdır.",
  "Okumak, iki ruhun zaman ve mekân sınırlarını aşarak konuşmasıdır.",
  "İlim tahsil etmek, ruhun tezkiyesi ve hakikatin izini sürmektir.",
  "Bir kitabı bitirdiğinde eski sen değilsen, o kitap ömrüne ömür katmıştır.",
];

export const BookStoryCardModal: React.FC<BookStoryCardModalProps> = ({
  book,
  quotations = [],
  isOpen,
  onClose,
}) => {
  const [selectedTheme, setSelectedTheme] = useState<StoryTheme>('crimson');
  const [quoteBgStyle, setQuoteBgStyle] = useState<QuoteBgStyle>('parchment');
  const [fontSize, setFontSize] = useState<FontSize>('medium');
  const [fontStyle, setFontStyle] = useState<FontStyle>('serif');
  const [fontColor, setFontColor] = useState<string>(''); // empty = automatic based on box
  const [showQuote, setShowQuote] = useState(true);

  const [isExporting, setIsExporting] = useState(false);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // Available quotes for this book
  const bookQuotes = quotations.filter(
    q => q.bookId === book.id || (q.bookTitle && q.bookTitle.toLowerCase().trim() === book.title.toLowerCase().trim())
  );

  const [selectedQuoteIndex, setSelectedQuoteIndex] = useState<number>(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const activeQuoteObj = bookQuotes.length > 0 ? bookQuotes[selectedQuoteIndex % bookQuotes.length] : null;
  const activeQuoteText = activeQuoteObj
    ? activeQuoteObj.quoteText
    : INSPIRATIONAL_QUOTES[(book.title.length + (book.author?.length || 0)) % INSPIRATIONAL_QUOTES.length];

  const progressPercent = Math.round(((book.currentPage || 0) / Math.max(1, book.totalPages || 100)) * 100);

  const [loadedCoverImg, setLoadedCoverImg] = useState<HTMLImageElement | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    let isCancelled = false;

    async function loadCover() {
      if (!isOpen) {
        setLoadedCoverImg(null);
        return;
      }

      // 1. First check IndexedDB for user's stored custom cover (safe local data URL / blob)
      try {
        const idbCover = await getCoverFromIDB(book.id);
        if (idbCover && !isCancelled) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            if (!isCancelled) setLoadedCoverImg(img);
          };
          img.src = idbCover;
          return;
        }
      } catch {
        // continue
      }

      // 2. If no IDB cover, load from book.coverUrl safely via /api/proxy-image or direct data URI
      if (!book.coverUrl) {
        if (!isCancelled) setLoadedCoverImg(null);
        return;
      }

      const isDataUri = book.coverUrl.startsWith('data:');
      const isExternal = book.coverUrl.startsWith('http://') || book.coverUrl.startsWith('https://');
      const targetSrc = isExternal 
        ? `/api/proxy-image?url=${encodeURIComponent(book.coverUrl)}` 
        : book.coverUrl;

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (!isCancelled) setLoadedCoverImg(img);
      };
      img.onerror = () => {
        // If image fails, keep loadedCoverImg null so canvas renders the elegant typography cover
        // and remains 100% clean and non-tainted for PNG export!
        if (!isCancelled) setLoadedCoverImg(null);
      };
      img.src = targetSrc;
    }

    loadCover();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, book.id, book.coverUrl]);

  // Helper for drawing rounded rect
  const drawRoundedRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  // Canvas 2D HD Rendering (1080x1920 Instagram Story 9:16)
  const renderStoryCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 1080;
    const height = 1920;
    canvas.width = width;
    canvas.height = height;

    const theme = THEMES[selectedTheme];
    const isDark = selectedTheme !== 'parchment';

    // 1. Background Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, theme.gradStart);
    bgGrad.addColorStop(0.5, theme.gradMid);
    bgGrad.addColorStop(1, theme.gradEnd);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle Radial Glow Overlay
    const radial = ctx.createRadialGradient(width / 2, height / 3, 100, width / 2, height / 3, width);
    radial.addColorStop(0, isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.4)');
    radial.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, width, height);

    // 2. Decorative Outer Border
    ctx.strokeStyle = theme.goldColor;
    ctx.lineWidth = 6;
    drawRoundedRect(ctx, 40, 40, width - 80, height - 80, 48);
    ctx.stroke();

    ctx.lineWidth = 2;
    drawRoundedRect(ctx, 55, 55, width - 110, height - 110, 32);
    ctx.stroke();

    // 3. Top Header: DİJİTAL KÜTÜPHANEM
    ctx.fillStyle = theme.goldColor;
    ctx.font = 'bold 30px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('D İ J İ T A L   K Ü T Ü P H A N E M', width / 2, 130);

    const todayStr = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    ctx.font = '20px Georgia, serif';
    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)';
    ctx.fillText(todayStr, width / 2, 170);

    // 4. Center 3D Book Cover (Renders User's Actual Uploaded / Custom Cover)
    const coverWidth = 360;
    const coverHeight = 520;
    const coverX = width / 2 - coverWidth / 2;
    const coverY = 210;

    // Cover Shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 45;
    ctx.shadowOffsetY = 22;

    const bookGrad = ctx.createLinearGradient(coverX, coverY, coverX + coverWidth, coverY + coverHeight);
    bookGrad.addColorStop(0, '#742C3C');
    bookGrad.addColorStop(0.5, '#4A1D27');
    bookGrad.addColorStop(1, '#2B0E15');
    ctx.fillStyle = bookGrad;
    drawRoundedRect(ctx, coverX, coverY, coverWidth, coverHeight, 20);
    ctx.fill();
    ctx.restore();

    // Draw User's Actual Book Cover Image
    if (loadedCoverImg) {
      ctx.save();
      drawRoundedRect(ctx, coverX, coverY, coverWidth, coverHeight, 20);
      ctx.clip();
      ctx.drawImage(loadedCoverImg, coverX, coverY, coverWidth, coverHeight);
      ctx.restore();
    } else {
      // Text fallback while loading image
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 30px Georgia, serif';
      ctx.textAlign = 'center';

      const titleWords = book.title.split(' ');
      let line1 = '';
      let line2 = '';
      for (let w of titleWords) {
        if ((line1 + w).length <= 16) {
          line1 += (line1 ? ' ' : '') + w;
        } else {
          line2 += (line2 ? ' ' : '') + w;
        }
      }
      ctx.fillText(line1, width / 2, coverY + coverHeight / 2 - 25);
      if (line2) {
        ctx.fillText(line2, width / 2, coverY + coverHeight / 2 + 15);
      }

      ctx.font = 'italic 22px Georgia, serif';
      ctx.fillStyle = '#D4AF37';
      ctx.fillText(book.author || 'Mütefekkir Yazar', width / 2, coverY + coverHeight / 2 + 70);
    }

    // 3D Book Spine Reflection Overlay
    const spineGrad = ctx.createLinearGradient(coverX, coverY, coverX + 28, coverY);
    spineGrad.addColorStop(0, 'rgba(0,0,0,0.5)');
    spineGrad.addColorStop(0.3, 'rgba(255,255,255,0.25)');
    spineGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    drawRoundedRect(ctx, coverX, coverY, coverWidth, coverHeight, 20);
    ctx.clip();
    ctx.fillStyle = spineGrad;
    ctx.fillRect(coverX, coverY, 28, coverHeight);
    ctx.restore();

    // Book Cover Inner Gold Border
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.75)';
    ctx.lineWidth = 3;
    drawRoundedRect(ctx, coverX, coverY, coverWidth, coverHeight, 20);
    ctx.stroke();

    // 5. Category Badge
    const badgeY = coverY + coverHeight + 50;
    ctx.fillStyle = isDark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.8)';
    drawRoundedRect(ctx, width / 2 - 120, badgeY - 22, 240, 40, 20);
    ctx.fill();
    ctx.strokeStyle = theme.goldColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = theme.subTextColor;
    ctx.font = 'bold 18px Georgia, serif';
    ctx.fillText((book.category || 'Edebiyat').toUpperCase(), width / 2, badgeY + 4);

    // 6. Book Meta Title & Author
    ctx.fillStyle = theme.textColor;
    ctx.font = 'bold 44px Georgia, serif';
    ctx.fillText(book.title, width / 2, badgeY + 95);

    ctx.font = 'italic 26px Georgia, serif';
    ctx.fillStyle = theme.subTextColor;
    ctx.fillText(book.author, width / 2, badgeY + 140);

    // 7. Progress Bar
    const progY = badgeY + 195;
    const progWidth = 600;
    const progX = width / 2 - progWidth / 2;

    ctx.font = 'bold 22px Georgia, serif';
    ctx.fillStyle = theme.textColor;
    ctx.textAlign = 'left';
    ctx.fillText(
      book.status === 'completed' ? '🏆 Tamamlandı' : `Sayfa ${book.currentPage || 0} / ${book.totalPages || 100}`,
      progX,
      progY - 15
    );

    ctx.textAlign = 'right';
    ctx.fillText(`%${progressPercent}`, progX + progWidth, progY - 15);

    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)';
    drawRoundedRect(ctx, progX, progY, progWidth, 16, 8);
    ctx.fill();

    const fillW = Math.max(16, (progWidth * Math.min(100, progressPercent)) / 100);
    ctx.fillStyle = theme.goldColor;
    drawRoundedRect(ctx, progX, progY, fillW, 16, 8);
    ctx.fill();

    // 8. HIGH CONTRAST CUSTOMIZABLE QUOTE & THOUGHT BOX
    if (showQuote) {
      const quoteY = progY + 50;
      const quoteBoxW = 880;
      const quoteBoxH = 320;
      const quoteBoxX = width / 2 - quoteBoxW / 2;

      // Determine Quote Box Background and Border
      if (quoteBgStyle === 'parchment') {
        ctx.fillStyle = 'rgba(253, 251, 247, 0.96)'; // Solid Fildişi Parşömen
        ctx.strokeStyle = '#D4AF37';
      } else if (quoteBgStyle === 'midnight') {
        ctx.fillStyle = 'rgba(10, 10, 18, 0.92)'; // Deep Obsidian
        ctx.strokeStyle = '#F59E0B';
      } else if (quoteBgStyle === 'emerald') {
        ctx.fillStyle = 'rgba(4, 60, 42, 0.9)'; // Deep Emerald
        ctx.strokeStyle = '#D4AF37';
      } else {
        // gold_luxury
        ctx.fillStyle = 'rgba(212, 175, 55, 0.28)';
        ctx.strokeStyle = '#D4AF37';
      }

      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 20;
      ctx.lineWidth = 3.5;
      drawRoundedRect(ctx, quoteBoxX, quoteY, quoteBoxW, quoteBoxH, 32);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Big Quote Decorative Symbol
      ctx.fillStyle = quoteBgStyle === 'parchment' ? 'rgba(116, 44, 60, 0.3)' : 'rgba(212, 175, 55, 0.4)';
      ctx.font = 'bold 96px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('“', quoteBoxX + 65, quoteY + 85);

      // Quote Text Color Selection
      let finalTextColor = fontColor;
      if (!finalTextColor) {
        finalTextColor = quoteBgStyle === 'parchment' ? '#1C1917' : '#FFFFFF';
      }
      ctx.fillStyle = finalTextColor;

      // Font Family Stack
      let fontStack = 'Georgia, serif';
      if (fontStyle === 'sans') fontStack = 'system-ui, sans-serif';
      if (fontStyle === 'mono') fontStack = 'monospace';
      if (fontStyle === 'italic') fontStack = 'Georgia, serif';

      const fontPx = fontSize === 'small' ? 22 : fontSize === 'large' ? 32 : 26;
      ctx.font = `${fontStyle === 'italic' ? 'italic ' : ''}bold ${fontPx}px ${fontStack}`;
      ctx.textAlign = 'center';

      // Auto-Wrap Text into Lines
      const words = activeQuoteText.split(' ');
      const lines: string[] = [];
      let currentLine = '';
      const maxLineWidth = quoteBoxW - 120;

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxLineWidth) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);

      // Render Quote Text
      const lineStep = fontPx + 10;
      let startTextY = quoteY + 80;

      for (let i = 0; i < Math.min(4, lines.length); i++) {
        ctx.fillText(lines[i], width / 2, startTextY + i * lineStep);
      }

      // Render Personal Note / Thought if present!
      if (activeQuoteObj?.userNote) {
        const noteY = startTextY + Math.min(4, lines.length) * lineStep + 20;
        ctx.font = 'italic bold 22px Georgia, serif';
        ctx.fillStyle = quoteBgStyle === 'parchment' ? '#742C3C' : '#F59E0B';
        ctx.fillText(`💭 Notum: "${activeQuoteObj.userNote}"`, width / 2, noteY);
      }
    }

    // 9. Footer Watermark
    ctx.fillStyle = theme.goldColor;
    ctx.font = 'bold 22px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('✦  ÖMÜR BOYU İLİM VE TEFEKKÜR YOLCULUĞU  ✦', width / 2, height - 110);

    ctx.font = '16px Georgia, serif';
    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)';
    ctx.fillText('Dijital Kütüphanem · Okuma & Tefekkür Kaydı', width / 2, height - 75);
  };

  useEffect(() => {
    if (isOpen) {
      renderStoryCanvas();
    }
  }, [isOpen, book, selectedTheme, quoteBgStyle, fontSize, fontStyle, fontColor, showQuote, selectedQuoteIndex, loadedCoverImg]);

  if (!isOpen) return null;

  // Direct High-Definition Canvas PNG Download
  const handleDownloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsExporting(true);

    try {
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      const safeTitle = (book.title || 'Story').replace(/[^a-zA-Z0-9-çğıöşüÇĞİÖŞÜ]/g, '_');
      link.download = `${safeTitle}_Story_Karti.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setCopiedSuccess(true);
      showToast('📸 Story kartınız yüksek kalitede (HD PNG) başarıyla indirildi!');
      setTimeout(() => setCopiedSuccess(false), 3000);
    } catch (err: any) {
      console.error('Download PNG error:', err);
      showToast('⚠️ İndirme yapılamadı: ' + (err?.message || 'Görsel izin kısıtı'));
    } finally {
      setTimeout(() => setIsExporting(false), 400);
    }
  };

  // Story Share via Web Share API
  const handleShareStory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsExporting(true);

    try {
      canvas.toBlob(async (blob) => {
        if (!blob) {
          setIsExporting(false);
          handleDownloadImage();
          return;
        }

        const safeTitle = (book.title || 'Story').replace(/[^a-zA-Z0-9-çğıöşüÇĞİÖŞÜ]/g, '_');
        const file = new File([blob], `${safeTitle}_Story.png`, { type: 'image/png' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: `${book.title} - ${book.author}`,
              text: `📖 "${book.title}" (${book.author}) - Dijital Kütüphanem okuma kaydı`,
            });
            setIsExporting(false);
            showToast('✅ Hikaye paylaşım menüsü açıldı!');
            return;
          } catch (e: any) {
            if (e.name === 'AbortError') {
              setIsExporting(false);
              return;
            }
          }
        }

        // Fallback to direct download
        handleDownloadImage();
        showToast('ℹ️ Cihazınızda doğrudan paylaşım desteklenmediği için görsel PNG olarak indirildi!');
        setIsExporting(false);
      }, 'image/png');
    } catch (err) {
      handleDownloadImage();
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="relative max-w-lg w-full bg-slate-900 border border-white/10 rounded-3xl p-4 sm:p-6 shadow-2xl flex flex-col gap-4 text-white my-6 max-h-[92vh] overflow-y-auto">
        
        {/* Toast Feedback */}
        {toastMessage && (
          <div className="p-3 rounded-2xl bg-[#742C3C] text-amber-200 border border-amber-400/30 text-xs font-bold text-center shadow-lg animate-in fade-in slide-in-from-top-2">
            {toastMessage}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#D4AF37]" />
            <h3 className="font-serif-title font-bold text-base sm:text-lg">
              Hikaye (Story) Kartı Özelleştirici 📸
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CUSTOMIZATION TOOLBAR */}
        <div className="space-y-3 bg-black/40 p-3.5 rounded-2xl border border-white/10 text-xs">
          {/* Card Theme */}
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-amber-300 flex items-center gap-1">
              <Palette className="w-3.5 h-3.5" />
              <span>Kart Teması:</span>
            </span>
            <div className="flex gap-1 overflow-x-auto no-scrollbar">
              {(Object.keys(THEMES) as StoryTheme[]).map((tKey) => (
                <button
                  key={tKey}
                  onClick={() => setSelectedTheme(tKey)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all ${
                    selectedTheme === tKey
                      ? 'bg-[#D4AF37] text-slate-950 shadow-md scale-105'
                      : 'bg-white/10 hover:bg-white/20 text-white/80'
                  }`}
                >
                  {THEMES[tKey].name}
                </button>
              ))}
            </div>
          </div>

          {/* Quote Box Background Style (CRITICAL FOR HIGH CONTRAST) */}
          <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-2.5">
            <span className="font-bold text-amber-300 flex items-center gap-1">
              <Sparkle className="w-3.5 h-3.5" />
              <span>Alıntı Kutusu Arka Planı:</span>
            </span>
            <div className="flex gap-1 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setQuoteBgStyle('parchment')}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all ${
                  quoteBgStyle === 'parchment'
                    ? 'bg-[#FAF6EE] text-[#742C3C] ring-2 ring-[#D4AF37]'
                    : 'bg-white/10 text-white/80'
                }`}
              >
                ✨ Parşömen Fildişi
              </button>
              <button
                onClick={() => setQuoteBgStyle('midnight')}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all ${
                  quoteBgStyle === 'midnight'
                    ? 'bg-[#0A0A12] text-[#F59E0B] ring-2 ring-[#F59E0B]'
                    : 'bg-white/10 text-white/80'
                }`}
              >
                🌙 Gece Zifir
              </button>
              <button
                onClick={() => setQuoteBgStyle('emerald')}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all ${
                  quoteBgStyle === 'emerald'
                    ? 'bg-[#044B35] text-white ring-2 ring-[#D4AF37]'
                    : 'bg-white/10 text-white/80'
                }`}
              >
                💎 Zümrüt Cam
              </button>
              <button
                onClick={() => setQuoteBgStyle('gold_luxury')}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all ${
                  quoteBgStyle === 'gold_luxury'
                    ? 'bg-[#D4AF37]/30 text-white ring-2 ring-[#D4AF37]'
                    : 'bg-white/10 text-white/80'
                }`}
              >
                🏆 Altın Işıltı
              </button>
            </div>
          </div>

          {/* Font Size & Font Style Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2.5">
            <div className="flex items-center gap-2">
              <span className="font-bold text-amber-300 flex items-center gap-1">
                <Type className="w-3.5 h-3.5" />
                <span>Boyut:</span>
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setFontSize('small')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${fontSize === 'small' ? 'bg-amber-400 text-slate-950' : 'bg-white/10'}`}
                >
                  Küçük
                </button>
                <button
                  onClick={() => setFontSize('medium')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${fontSize === 'medium' ? 'bg-amber-400 text-slate-950' : 'bg-white/10'}`}
                >
                  Orta
                </button>
                <button
                  onClick={() => setFontSize('large')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${fontSize === 'large' ? 'bg-amber-400 text-slate-950' : 'bg-white/10'}`}
                >
                  Büyük
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-bold text-amber-300">Stil:</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setFontStyle('serif')}
                  className={`px-2 py-0.5 rounded text-[10px] font-serif ${fontStyle === 'serif' ? 'bg-amber-400 text-slate-950 font-bold' : 'bg-white/10'}`}
                >
                  Serif
                </button>
                <button
                  onClick={() => setFontStyle('italic')}
                  className={`px-2 py-0.5 rounded text-[10px] italic ${fontStyle === 'italic' ? 'bg-amber-400 text-slate-950 font-bold' : 'bg-white/10'}`}
                >
                  İtalik
                </button>
                <button
                  onClick={() => setFontStyle('sans')}
                  className={`px-2 py-0.5 rounded text-[10px] font-sans ${fontStyle === 'sans' ? 'bg-amber-400 text-slate-950 font-bold' : 'bg-white/10'}`}
                >
                  Sans
                </button>
                <button
                  onClick={() => setFontStyle('mono')}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono ${fontStyle === 'mono' ? 'bg-amber-400 text-slate-950 font-bold' : 'bg-white/10'}`}
                >
                  Daktilo
                </button>
              </div>
            </div>
          </div>

          {/* Font Color Selector */}
          <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-2.5">
            <span className="font-bold text-amber-300">Yazı Rengi:</span>
            <div className="flex items-center gap-2">
              {[
                { label: 'Siyah', value: '#1C1917', bg: 'bg-[#1C1917]' },
                { label: 'Beyaz', value: '#FFFFFF', bg: 'bg-white' },
                { label: 'Altın', value: '#D4AF37', bg: 'bg-[#D4AF37]' },
                { label: 'Kehribar', value: '#F59E0B', bg: 'bg-[#F59E0B]' },
                { label: 'Açık Sarı', value: '#FEF08A', bg: 'bg-[#FEF08A]' },
              ].map(c => (
                <button
                  key={c.value}
                  onClick={() => setFontColor(c.value)}
                  className={`w-5 h-5 rounded-full ${c.bg} border-2 transition-all cursor-pointer ${
                    fontColor === c.value ? 'border-amber-400 scale-125 ring-2 ring-amber-400/50' : 'border-white/30'
                  }`}
                  title={c.label}
                />
              ))}
              {fontColor && (
                <button
                  onClick={() => setFontColor('')}
                  className="text-[9px] underline opacity-70 hover:opacity-100"
                >
                  Otomatik
                </button>
              )}
            </div>

            {/* Toggle Quote On/Off */}
            <button
              onClick={() => setShowQuote(!showQuote)}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all ${
                showQuote ? 'bg-amber-400/20 text-amber-200 border border-amber-400/40' : 'bg-white/10 text-white/60'
              }`}
            >
              <QuoteIcon className="w-3 h-3" />
              <span>{showQuote ? 'Açık' : 'Kapalı'}</span>
            </button>
          </div>
        </div>

        {/* Quote Switcher if multiple quotes exist */}
        {bookQuotes.length > 1 && (
          <div className="flex items-center justify-between text-xs bg-amber-500/10 p-2 rounded-xl border border-amber-500/20 text-amber-200">
            <span>Kayıtlı Alıntılardan Seçin ({selectedQuoteIndex % bookQuotes.length + 1}/{bookQuotes.length}):</span>
            <button
              onClick={() => setSelectedQuoteIndex(prev => prev + 1)}
              className="px-2 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold text-[10px] cursor-pointer"
            >
              Diğer Alıntı ➔
            </button>
          </div>
        )}

        {/* Live Canvas Preview (HD Native 2D Canvas) */}
        <div className="flex justify-center bg-slate-950 p-3 rounded-2xl shadow-inner max-h-[380px] overflow-y-auto">
          <canvas 
            ref={canvasRef} 
            className="max-w-full h-auto shadow-2xl rounded-2xl border border-white/10"
            style={{ maxHeight: '350px' }}
          />
        </div>

        {/* Actions Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            onClick={handleDownloadImage}
            disabled={isExporting}
            className="py-3 px-4 rounded-2xl bg-[#742C3C] hover:bg-[#8e374a] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#D4AF37]" />
            <span>{isExporting ? 'Hazırlanıyor…' : 'PNG Olarak İndir (HD)'}</span>
          </button>

          <button
            onClick={handleShareStory}
            disabled={isExporting}
            className="py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {copiedSuccess ? (
              <>
                <Check className="w-4 h-4 text-emerald-200" />
                <span>İndirildi!</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4 text-amber-200" />
                <span>Story Paylaş</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
