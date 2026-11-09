import React, { useState, useMemo } from 'react';
import { 
  X, Search, BookOpen, Check, Plus, Sparkles, Filter, 
  Layers, CheckCircle2, BookmarkCheck, ArrowRight, ExternalLink 
} from 'lucide-react';
import { MEDENIYET_TASAVVURU_100_KITAP, MTO_STAGES, MTOBook } from '../data/medeniyetTasavvuru';
import { useApp } from '../context/AppContext';

interface MTOModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MTOModal: React.FC<MTOModalProps> = ({ isOpen, onClose }) => {
  const { userBooks, addBookToLibrary } = useApp();

  const [selectedStage, setSelectedStage] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Set of titles already in user's library
  const existingTitles = useMemo(() => {
    return new Set(userBooks.map(b => b.title.toLowerCase().trim()));
  }, [userBooks]);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  // Filtered books
  const filteredBooks = useMemo(() => {
    return MEDENIYET_TASAVVURU_100_KITAP.filter(book => {
      if (selectedStage !== 'all' && book.stage !== selectedStage) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = book.title.toLowerCase().includes(q);
        const matchAuthor = book.author.toLowerCase().includes(q);
        const matchCat = book.category.toLowerCase().includes(q);
        const matchSub = book.subCategory.toLowerCase().includes(q);
        const matchOrder = String(book.orderNumber) === q;
        return matchTitle || matchAuthor || matchCat || matchSub || matchOrder;
      }
      return true;
    });
  }, [selectedStage, searchQuery]);

  // Count existing MTO books in library
  const inLibraryCount = useMemo(() => {
    return MEDENIYET_TASAVVURU_100_KITAP.filter(b => existingTitles.has(b.title.toLowerCase().trim())).length;
  }, [existingTitles]);

  if (!isOpen) return null;

  const handleAddSingle = (book: MTOBook) => {
    if (existingTitles.has(book.title.toLowerCase().trim()) || addedIds.has(book.id)) {
      return;
    }

    addBookToLibrary({
      title: book.title,
      author: book.author,
      category: book.category,
      subCategory: book.subCategory,
      publisher: 'MTO Klasik Yayınları',
      publishYear: '2024',
      isbn: `MTO-100-${String(book.orderNumber).padStart(3, '0')}`,
      totalPages: book.totalPages,
      currentPage: 0,
      coverUrl: book.coverUrl,
      description: `[MTO 100 Temel Eser #${book.orderNumber} - ${book.stageTitle}]: ${book.description}`,
      status: 'want_to_read',
      tags: ['MTO 100', `Kademe ${book.stage}`, book.category]
    });

    setAddedIds(prev => new Set(prev).add(book.id));
    showToast(`"${book.title}" kütüphanenize eklendi!`);
  };

  const handleAddAllFiltered = () => {
    let count = 0;
    const newAdded = new Set(addedIds);

    filteredBooks.forEach(book => {
      if (!existingTitles.has(book.title.toLowerCase().trim()) && !addedIds.has(book.id)) {
        addBookToLibrary({
          title: book.title,
          author: book.author,
          category: book.category,
          subCategory: book.subCategory,
          publisher: 'MTO Klasik Yayınları',
          publishYear: '2024',
          isbn: `MTO-100-${String(book.orderNumber).padStart(3, '0')}`,
          totalPages: book.totalPages,
          currentPage: 0,
          coverUrl: book.coverUrl,
          description: `[MTO 100 Temel Eser #${book.orderNumber} - ${book.stageTitle}]: ${book.description}`,
          status: 'want_to_read',
          tags: ['MTO 100', `Kademe ${book.stage}`, book.category]
        });
        newAdded.add(book.id);
        count++;
      }
    });

    setAddedIds(newAdded);
    if (count > 0) {
      showToast(`${count} adet MTO eseri kütüphanenize başarıyla eklendi!`);
    } else {
      showToast('Seçili eserlerin tamamı zaten kütüphanenizde mevcut.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="relative max-w-5xl w-full bg-[#FAF8F5] dark:bg-[#151515] text-slate-900 dark:text-slate-100 border border-[#B79A63]/30 rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Toast Alert */}
        {successToast && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-[#742C3C] text-[#FAF8F5] border border-[#B79A63]/50 text-xs font-bold shadow-xl animate-in fade-in slide-in-from-top-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{successToast}</span>
          </div>
        )}

        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/30 backdrop-blur-sm flex flex-col gap-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-gradient-to-br from-[#742C3C] to-[#43141E] text-[#B79A63] shadow-md border border-[#B79A63]/30">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-serif-title font-bold text-lg sm:text-2xl text-[#742C3C] dark:text-[#E8DCC4]">
                    Medeniyet Tasavvuru Okulu (MTO)
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#B79A63]/20 text-[#742C3C] dark:text-[#B79A63] border border-[#B79A63]/30">
                    100 Temel Eser
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Öncü kuşakların zihin inşası, ilim, irfan ve hikmet sütunları üzerinde 3 kademeli külliyat.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-2xl hover:bg-black/5 dark:hover:bg-white/10 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress & Quick Batch Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 dark:text-slate-400">Kütüphanenizde:</span>
              <span className="font-bold text-[#742C3C] dark:text-[#B79A63]">
                {inLibraryCount} / 100 Eser
              </span>
              <div className="w-24 sm:w-32 bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-[#742C3C] to-[#B79A63] h-full rounded-full transition-all duration-500"
                  style={{ width: `${inLibraryCount}%` }}
                />
              </div>
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                %{inLibraryCount}
              </span>
            </div>

            <button
              onClick={handleAddAllFiltered}
              className="px-3.5 py-2 rounded-2xl bg-gradient-to-r from-[#742C3C] to-[#43141E] hover:from-[#8A3447] hover:to-[#551A27] text-white text-xs font-bold shadow-md shadow-rose-950/20 border border-[#B79A63]/40 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 text-[#B79A63]" />
              <span>
                {selectedStage === 'all' ? '100 Kitabın Eksik Olanlarını Ekle' : 'Seçili Kademeyi Kütüphaneme Ekle'}
              </span>
            </button>
          </div>

          {/* Stage Filters & Search Input */}
          <div className="flex flex-col md:flex-row gap-2.5 pt-1">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Kitap adı, yazar, kategori veya numara (#1..100) ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 rounded-2xl bg-white dark:bg-[#1E1E1E] border border-black/10 dark:border-white/10 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#742C3C]"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Stages Selector Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <button
                onClick={() => setSelectedStage('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedStage === 'all'
                    ? 'bg-[#742C3C] text-white shadow-xs'
                    : 'bg-black/5 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-black/10'
                }`}
              >
                Tümü (100)
              </button>
              {MTO_STAGES.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedStage(s.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    selectedStage === s.id
                      ? 'bg-[#742C3C] text-white shadow-xs'
                      : 'bg-black/5 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-black/10'
                  }`}
                >
                  {s.id}. Kademe ({s.count})
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Book Grid / List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {filteredBooks.map((book) => {
              const isAlreadyInLib = existingTitles.has(book.title.toLowerCase().trim()) || addedIds.has(book.id);

              return (
                <div
                  key={book.id}
                  className="bg-white dark:bg-[#1E1E1E] rounded-2xl p-3.5 sm:p-4 border border-black/5 dark:border-white/5 shadow-xs hover:shadow-md transition-all flex gap-3.5 items-start group"
                >
                  {/* Book Cover Thumbnail with Order Number */}
                  <div className="relative w-20 sm:w-24 h-28 sm:h-32 shrink-0 rounded-xl overflow-hidden shadow-sm bg-slate-200 dark:bg-slate-800 border border-black/5 dark:border-white/10">
                    <img
                      src={book.coverUrl}
                      alt={book.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        // Fallback typography banner
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                    <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-[#742C3C]/90 text-[#FAF8F5] text-[10px] font-bold font-mono shadow-xs border border-[#B79A63]/40">
                      #{book.orderNumber}
                    </div>
                  </div>

                  {/* Book Info */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between h-full">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className="px-2 py-0.5 rounded-md bg-[#B79A63]/15 text-[#742C3C] dark:text-[#B79A63] text-[10px] font-bold">
                          {book.stage}. Kademe
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          {book.category}
                        </span>
                      </div>

                      <h4 className="font-serif-title font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 line-clamp-1 leading-snug">
                        {book.title}
                      </h4>
                      <p className="text-xs font-medium text-[#742C3C] dark:text-[#B79A63] line-clamp-1">
                        {book.author}
                      </p>

                      <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                        {book.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2.5 mt-1 border-t border-black/5 dark:border-white/5">
                      <span className="text-[10px] text-slate-500">
                        {book.totalPages} sayfa
                      </span>

                      {isAlreadyInLib ? (
                        <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-xl border border-emerald-500/20">
                          <Check className="w-3.5 h-3.5" />
                          <span>Kütüphanede</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleAddSingle(book)}
                          className="flex items-center gap-1 text-[11px] font-bold text-white bg-[#742C3C] hover:bg-[#8A3447] px-3 py-1 rounded-xl shadow-xs transition-all active:scale-95"
                        >
                          <Plus className="w-3 h-3 text-[#B79A63]" />
                          <span>Kütüphaneye Ekle</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredBooks.length === 0 && (
            <div className="py-16 text-center text-slate-500 space-y-2">
              <BookOpen className="w-10 h-10 mx-auto text-slate-400 stroke-1" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Aramanızla eşleşen MTO eseri bulunamadı.
              </p>
              <p className="text-xs">
                Farklı bir arama terimi deneyebilir veya filtreyi sıfırlayabilirsiniz.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-black/10 dark:border-white/10 bg-white/40 dark:bg-black/20 text-center text-[11px] text-slate-500 shrink-0">
          Medeniyet Tasavvuru Okulu Külliyatı · İlim, İrfan ve Hikmet Yolculuğu
        </div>
      </div>
    </div>
  );
};
