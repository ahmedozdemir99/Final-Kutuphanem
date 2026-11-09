import React, { useState, useEffect } from 'react';
import { 
  Sparkles, BookOpen, RefreshCw, Plus, Check, ChevronRight, Compass, Flame, Lightbulb, BookmarkCheck, Trash2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { BookCoverImage } from './BookCoverImage';
import { DEFAULT_BOOK_COVERS } from '../data/catalogData';

interface SmartRecommendation {
  title: string;
  author: string;
  category: string;
  totalPages: number;
  reason: string;
  estimatedDays: number;
  tag: string;
}

const DEFAULT_INITIAL_RECOMMENDATIONS: SmartRecommendation[] = [
  {
    title: "İhyâ'u Ulûmi'd-Dîn (İlim ve Kalp)",
    author: "İmâm-ı Gazâlî",
    category: "Din ve İlahiyat",
    totalPages: 480,
    reason: "Kişinin zihnini ve kalbini tezkiye eden, ibadet ve ahlakın manevi sırlarını açan şaheser.",
    estimatedDays: 12,
    tag: "Temel Başyapıt"
  },
  {
    title: "Doğu ve Batı Arasında İslam",
    author: "Aliya İzzetbegoviç",
    category: "Felsefe",
    totalPages: 380,
    reason: "Modern fikir akımlarıyla İslam medeniyetinin ruh-madde dengesini inşa eden entelektüel anıt.",
    estimatedDays: 9,
    tag: "Ufuk Açıcı"
  },
  {
    title: "Saatleri Ayarlama Enstitüsü",
    author: "Ahmet Hamdi Tanpınar",
    category: "Edebiyat",
    totalPages: 382,
    reason: "Doğu-Batı ikilemini, zaman felsefesini ve toplum psikolojisini mizahla harmanlayan Türk klasiği.",
    estimatedDays: 10,
    tag: "Edebiyat Klasiği"
  },
  {
    title: "İnsanın Anlam Arayışı",
    author: "Viktor E. Frankl",
    category: "Psikoloji",
    totalPages: 168,
    reason: "Zorluklar karşısında insanın içsel anlam ve gaye bularak ayakta kalmasını anlatan eser.",
    estimatedDays: 4,
    tag: "Ruh & İrade"
  }
];

export const SmartBookRecommendations: React.FC = () => {
  const { userBooks, userProfile, quotations, addBookToLibrary, deleteBookFromLibrary, setSelectedBookForDetail } = useApp();

  const [recommendations, setRecommendations] = useState<SmartRecommendation[]>(DEFAULT_INITIAL_RECOMMENDATIONS);
  const [curatorNote, setCuratorNote] = useState<string>('Okuma ritminize, kütüphanenize ve yapay zekâ sohbetlerinize göre seçilen öneriler:');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedFocus, setSelectedFocus] = useState<string>('all');

  const fetchRecommendations = async (focusCategory: string = selectedFocus) => {
    setIsLoading(true);
    try {
      const activeBooks = userBooks.map(b => ({
        title: b.title,
        author: b.author,
        category: b.category,
        status: b.status
      }));

      // Extract recent AI chat topics from localStorage for personalized grounding
      let chatTopics: string[] = [];
      try {
        const chatHist = localStorage.getItem('dk_robi_chat_history') || localStorage.getItem('dk_chat_messages');
        if (chatHist) {
          const parsed = JSON.parse(chatHist);
          if (Array.isArray(parsed)) {
            chatTopics = parsed.slice(-10).map((m: any) => typeof m === 'string' ? m : m.content || m.text || m.userPrompt || '').filter(Boolean);
          }
        }
      } catch {}

      const res = await fetch('/api/ai-recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentBooks: activeBooks.slice(-12),
          preferredCategory: focusCategory === 'all' ? 'Edebiyat, Felsefe, Tefsir, Tarih, Tasavvuf, Psikoloji' : focusCategory,
          dailyTarget: userProfile.dailyTargetPages || 40,
          chatTopics: chatTopics.slice(-6),
          userQuotations: (quotations || []).slice(-5).map(q => ({ quote: q.quoteText, book: q.bookTitle })),
          mood: 'Okuma listesi, alıntılar ve yapay zeka sohbet konularına göre kişiselleştirilmiş entelektüel öneriler'
        })
      });

      if (!res.ok) throw new Error('API Hatası');
      const data = await res.json();
      setRecommendations(data.recommendations || []);
      setCuratorNote(data.curatorNote || 'Okuma listeniz ve sohbet konularınıza göre seçilen akıllı öneriler:');
    } catch (err) {
      console.warn('Smart recommendations fallback triggered', err);
      setRecommendations(DEFAULT_INITIAL_RECOMMENDATIONS);
      setCuratorNote("Kütüphane okuma çizginize göre özenle seçilmiş akıllı okuma rotası:");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (recommendations.length === 0) {
      fetchRecommendations('all');
    }
  }, []);

  const handleOpenBookDetail = (rec: SmartRecommendation) => {
    const existing = userBooks.find(b => b.title.toLowerCase().trim() === rec.title.toLowerCase().trim());
    const coverUrl = existing?.coverUrl || DEFAULT_BOOK_COVERS[rec.category] || DEFAULT_BOOK_COVERS['Edebiyat'];

    const savedBook = addBookToLibrary({
      title: rec.title,
      author: rec.author,
      category: rec.category,
      publisher: 'Klasik Yayınları',
      totalPages: rec.totalPages || 250,
      currentPage: existing ? existing.currentPage : 0,
      coverUrl,
      description: rec.reason,
      status: existing ? existing.status : 'reading'
    });

    setSelectedBookForDetail(savedBook);
  };

  const handleToggleBookInLibrary = (rec: SmartRecommendation, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const existing = userBooks.find(b => b.title.toLowerCase().trim() === rec.title.toLowerCase().trim());

    if (existing) {
      // User requirement: Clicking "Kütüphanemde" removes the book from library
      deleteBookFromLibrary(existing.id);
    } else {
      // Book is not in library: Add it
      const coverUrl = DEFAULT_BOOK_COVERS[rec.category] || DEFAULT_BOOK_COVERS['Edebiyat'];
      addBookToLibrary({
        title: rec.title,
        author: rec.author,
        category: rec.category,
        publisher: 'Klasik Yayınları',
        totalPages: rec.totalPages || 250,
        currentPage: 0,
        coverUrl,
        description: rec.reason,
        status: 'reading'
      });
    }
  };

  const categories = [
    { id: 'all', label: 'Tüm Alanlar' },
    { id: 'Felsefe & Tefekkür', label: 'Felsefe & Tefekkür' },
    { id: 'Türk & Dünya Edebiyatı', label: 'Klasik Edebiyat' },
    { id: 'Din, İlahiyat & Tasavvuf', label: 'İlim & Tasavvuf' },
    { id: 'Tarih & Medeniyet', label: 'Tarih & Medeniyet' },
    { id: 'Psikoloji & Şahsiyet', label: 'Psikoloji & Şahsiyet' },
  ];

  return (
    <div className="bg-white dark:bg-[#1E1E1E] rounded-3xl p-6 md:p-8 shadow-md border border-black/5 dark:border-white/5 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-black/5 dark:border-white/5 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#B79A63] mb-1">
            <Sparkles className="w-4 h-4 text-amber-500 fill-amber-500" />
            <span>Kişiselleştirilmiş Yapay Zekâ Destekli Okuma Danışmanı</span>
          </div>
          <h2 className="font-serif-title font-bold text-xl md:text-2xl text-[#742C3C] dark:text-[#B79A63]">
            Akıllı Kitap Önerileri
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Okuma listeniz, alıntılarınız ve AI sohbetlerinizdeki konulara göre size özel seçilen başyapıtlar.
          </p>
        </div>

        {/* Refresh & Generate Button */}
        <button
          onClick={() => fetchRecommendations(selectedFocus)}
          disabled={isLoading}
          className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#742C3C] to-[#4B1E2B] hover:from-[#5a222f] hover:to-[#35141e] text-white text-xs font-bold shadow-md shadow-[#742C3C]/20 transition-all flex items-center justify-center gap-2 shrink-0 active:scale-95 border border-[#B79A63]/30 disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 text-[#B79A63] ${isLoading ? 'animate-spin' : ''}`} />
          <span>{isLoading ? 'Öneriler Hazırlanıyor...' : 'Yeni Öneriler Üret 🔄'}</span>
        </button>
      </div>

      {/* Focus Category Filter Chips */}
      <div className="flex overflow-x-auto gap-2 pb-1 no-scrollbar text-xs">
        {categories.map(c => (
          <button
            key={c.id}
            onClick={() => {
              setSelectedFocus(c.id);
              fetchRecommendations(c.id);
            }}
            className={`px-3.5 py-1.5 rounded-xl font-semibold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
              selectedFocus === c.id
                ? 'bg-[#742C3C] text-white shadow-sm'
                : 'bg-black/5 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-black/10 dark:hover:bg-white/10'
            }`}
          >
            <span>{c.label}</span>
          </button>
        ))}
      </div>

      {/* Curator Note Banner */}
      {curatorNote && (
        <div className="p-3.5 rounded-2xl bg-[#F8F5EF] dark:bg-[#141414] border border-[#B79A63]/25 flex items-center gap-3 text-xs text-slate-700 dark:text-slate-300">
          <Lightbulb className="w-5 h-5 text-amber-500 shrink-0" />
          <p className="font-medium italic">{curatorNote}</p>
        </div>
      )}

      {/* Recommendations Cards Grid - Exact Library Shelf Style */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
        {recommendations.map((rec, idx) => {
          const existing = userBooks.find(b => b.title.toLowerCase().trim() === rec.title.toLowerCase().trim());
          const isAdded = !!existing;
          const coverUrl = existing?.coverUrl || DEFAULT_BOOK_COVERS[rec.category] || DEFAULT_BOOK_COVERS['Edebiyat'];

          return (
            <div 
              key={idx}
              onClick={() => handleOpenBookDetail(rec)}
              className="group flex flex-col items-center cursor-pointer transition-transform duration-200 hover:-translate-y-1.5"
            >
              {/* Visual 3D Book Cover matching LibraryView */}
              <div className="w-full aspect-[2/3] rounded-xl overflow-hidden book-shadow book-spine-effect relative">
                <BookCoverImage 
                  src={coverUrl} 
                  alt={rec.title}
                  title={rec.title}
                  author={rec.author}
                  category={rec.category}
                />
                
                {/* Category Badge */}
                <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#742C3C]/90 text-white shadow-sm max-w-[85%] truncate">
                  {rec.tag || rec.category}
                </div>

                {/* In Library Checkmark Indicator */}
                {isAdded && (
                  <div className="absolute top-2 right-2 p-1 rounded-full bg-emerald-600 text-white shadow-md" title="Kütüphanenizde Mevcut">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                )}
              </div>

              {/* Book Metadata & Title */}
              <div className="w-full mt-2.5 text-center space-y-1">
                <h4 className="font-serif-title font-bold text-xs text-slate-900 dark:text-slate-100 line-clamp-1 group-hover:text-[#742C3C] dark:group-hover:text-[#B79A63] transition-colors">
                  {rec.title}
                </h4>
                <p className="text-[11px] text-slate-500 truncate">
                  {rec.author}
                </p>
                <p className="text-[10px] text-slate-600 dark:text-slate-400 line-clamp-2 italic px-1 pt-0.5">
                  "{rec.reason}"
                </p>

                {/* Toggle Add/Remove Button */}
                <div className="pt-2" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={(e) => handleToggleBookInLibrary(rec, e)}
                    className={`w-full py-1.5 px-2 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 transition-all active:scale-95 shadow-xs cursor-pointer ${
                      isAdded
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-rose-500/20 hover:text-rose-700 dark:hover:text-rose-300 border border-emerald-500/30'
                        : 'bg-[#742C3C] text-white hover:bg-[#4B1E2B]'
                    }`}
                    title={isAdded ? 'Tıklayarak Kütüphaneden Çıkar' : 'Kütüphaneme Ekle'}
                  >
                    {isAdded ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>Kütüphanemde</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3 h-3 text-[#B79A63]" />
                        <span>Kütüphaneme Ekle</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
