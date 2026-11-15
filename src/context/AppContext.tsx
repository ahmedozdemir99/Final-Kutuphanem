import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, getDocFromServer, setDoc, deleteDoc } from 'firebase/firestore';
import { BookReview, BookStatus, MainTab, Quotation, ReadingSession, UserBook, UserProfile, VocabularyItem, QuranProgress, AppNotification, Badge } from '../types';
import { DEFAULT_USER_BOOKS, DEFAULT_BOOK_COVERS, MAIN_CATEGORIES, inferCategoryForBook } from '../data/catalogData';
import { PERMANENT_BOOKS } from '../data/permanentBooks';
import { auth, db, loginWithGoogle, handleFirestoreError, OperationType, ensureFirestoreNetwork } from '../lib/firebase';
import { saveBookFileToIDB, getBookFileFromIDB, saveCoverToIDB, getCoverFromIDB, saveAppDataToIDB, getAppDataFromIDB, deleteBookDataFromIDB, requestPersistentStorage } from '../lib/indexedDb';
import { validateBackupJSON, ValidationResult } from '../lib/jsonValidator';
import { AVAILABLE_BADGES } from '../data/badgeData';
import { compressImageDataUrl } from '../utils/imageUtils';

interface AppContextType {
  activeTab: MainTab;
  setActiveTab: (tab: MainTab) => void;
  exploreSubTab: 'curriculum' | 'quran' | 'catalog' | 'poets';
  setExploreSubTab: (tab: 'curriculum' | 'quran' | 'catalog' | 'poets') => void;
  userBooks: UserBook[];
  setUserBooks: React.Dispatch<React.SetStateAction<UserBook[]>>;
  readingSessions: ReadingSession[];
  reviews: BookReview[];
  quotations: Quotation[];
  vocabulary: VocabularyItem[];
  userProfile: UserProfile;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  activeBookForReader: UserBook | null;
  setActiveBookForReader: (book: UserBook | null) => void;
  selectedBookForDetail: UserBook | null;
  setSelectedBookForDetail: (book: UserBook | null) => void;
  cloudSyncStatus: 'synced' | 'syncing' | 'offline' | 'error';
  cloudSyncProgress: number;
  cloudSyncStage: string;
  lastCloudSyncAt: string | null;
  
  // Theme & Global Modals
  notifications: AppNotification[];
  addNotification: (notif: Omit<AppNotification, 'id' | 'createdAt' | 'isRead' | 'time'>) => void;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  deleteNotification: (id: string) => void;
  clearAllNotifications: () => void;
  theme: 'light' | 'dark';

  toggleTheme: () => void;
  isAddBookModalOpen: boolean;
  setIsAddBookModalOpen: (open: boolean) => void;
  isAddQuoteModalOpen: boolean;
  setIsAddQuoteModalOpen: (open: boolean) => void;
  isAddReviewModalOpen: boolean;
  setIsAddReviewModalOpen: (open: boolean) => void;
  isAddPoemModalOpen: boolean;
  setIsAddPoemModalOpen: (open: boolean) => void;

  // Quran Module State & Handlers
  quranProgress: QuranProgress;
  updateQuranProgress: (patch: Partial<QuranProgress>) => void;
  bookmarkAyah: (surahNumber: number, ayahNumber: number) => void;
  toggleFavoriteAyah: (fav: { surahNumber: number; ayahNumber: number; textArabic: string; translationTurkish: string; createdAt: string }) => void;
  saveAyahNote: (surahNumber: number, ayahNumber: number, noteText: string) => void;

  // Book Handlers & Cover Manager
  addBookToLibrary: (bookData: Omit<UserBook, 'id' | 'createdAt' | 'updatedAt'> | (Partial<UserBook> & { title: string; author: string; category: string })) => UserBook;
  updateBookProgress: (bookId: string, newPage: number) => void;
  updateBookStatus: (bookId: string, status: UserBook['status']) => void;
  deleteBookFromLibrary: (bookId: string) => void;
  logReadingSession: (bookId: string, pagesRead: number) => void;
  attachBookFile: (bookId: string, fileBlob: File) => Promise<string>;
  updateBookCover: (bookId: string, newCoverUrl: string, source?: string, confidence?: number) => void;
  updateBookTags: (bookId: string, tags: string[]) => void;

  // Archive Handlers
  addReview: (review: Omit<BookReview, 'id' | 'createdAt' | 'updatedAt'>) => void;
  deleteReview: (id: string) => void;
  addQuotation: (quoteText: string, pageNum?: number, note?: string, bookId?: string, bookTitle?: string, author?: string) => void;
  deleteQuotation: (id: string) => void;
  addVocabularyItem: (word: string, meaning: string, example?: string, sourceBook?: string) => void;
  toggleVocabularyLearned: (id: string) => void;
  deleteVocabularyItem: (id: string) => void;

  // Backup & Data Sync
  exportUserDataJSON: () => string;
  importUserDataJSON: (jsonString: string, onProgress?: (progress: number) => void) => Promise<{ success: boolean; validation?: ValidationResult; message: string }>;
  syncAllDataToCloud: (onProgress?: (progress: number) => void, forceSync?: boolean) => Promise<{ success: boolean; message: string }>;
  restoreFromCloud: (uidOverride?: string) => Promise<{ success: boolean; message: string; restoredBooks?: number }>;
  storagePersisted: boolean;
  deduplicateBooks: () => number;
  verifyDataIntegrity: () => { totalBooks: number; totalSessions: number; totalQuotes: number; totalWords: number; integrityOk: boolean };
  newBadgeNotification: Badge | null;
  setNewBadgeNotification: React.Dispatch<React.SetStateAction<Badge | null>>;
  clearBadgeNotification: () => void;
}

export const normalizeBookKey = (str: string) => {
  return (str || '')
    .toLowerCase()
    .replace(/[ıİ]/g, 'i')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u')
    .replace(/[şŞ]/g, 's')
    .replace(/[öÖ]/g, 'o')
    .replace(/[çÇ]/g, 'c')
    .replace(/['"’‘`´.,:;!?\-_()[\]{}\\/|#*~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

export const mergePermanentBooksWithExisting = (existingBooks: UserBook[]): UserBook[] => {
  const map = new Map<string, UserBook>();

  // 1. Seed with permanent 504 books
  PERMANENT_BOOKS.forEach(pb => {
    const key = `${normalizeBookKey(pb.title)}___${normalizeBookKey(pb.author)}`;
    map.set(key, { ...pb });
  });

  // 2. Overlay existing books (preserving user's custom progress, notes, ratings, covers, pdfs)
  existingBooks.forEach(eb => {
    const key = `${normalizeBookKey(eb.title)}___${normalizeBookKey(eb.author)}`;
    if (!map.has(key)) {
      map.set(key, eb);
    } else {
      const target = map.get(key)!;
      if ((eb.currentPage || 0) > (target.currentPage || 0)) {
        target.currentPage = eb.currentPage;
      }
      if (eb.totalPages && eb.totalPages > target.totalPages) {
        target.totalPages = eb.totalPages;
      }
      if (eb.status && eb.status !== 'want_to_read') {
        target.status = eb.status;
      }
      if (eb.userRating) target.userRating = eb.userRating;
      if (eb.userNotes) {
        if (!target.userNotes) target.userNotes = eb.userNotes;
        else if (!target.userNotes.includes(eb.userNotes)) {
          target.userNotes = `${target.userNotes}\n${eb.userNotes}`;
        }
      }
      if (eb.fileStorageUrl && !target.fileStorageUrl) {
        target.fileStorageUrl = eb.fileStorageUrl;
        target.fileName = eb.fileName;
        target.fileType = eb.fileType;
      }
      if (eb.coverUrl && !eb.coverUrl.includes('placeholder') && eb.coverUrl.length > 20) {
        if (!target.coverUrl || target.coverUrl.length < 20 || eb.coverUrl.startsWith('data:')) {
          target.coverUrl = eb.coverUrl;
        }
      }
      if (Array.isArray(eb.tags) && eb.tags.length > 0) {
        target.tags = Array.from(new Set([...(target.tags || []), ...eb.tags]));
      }
    }
  });

  return Array.from(map.values());
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<MainTab>(() => {
    if (typeof window !== 'undefined') {
      const tabParam = new URLSearchParams(window.location.search).get('tab');
      if (tabParam && ['today', 'library', 'explore', 'archive', 'stats', 'chat', 'profile'].includes(tabParam)) {
        return tabParam as MainTab;
      }
    }
    return 'today';
  });

  const [exploreSubTab, setExploreSubTab] = useState<'curriculum' | 'quran' | 'catalog' | 'poets'>(() => {
    if (typeof window !== 'undefined') {
      const subParam = new URLSearchParams(window.location.search).get('sub');
      if (subParam && ['curriculum', 'quran', 'catalog', 'poets'].includes(subParam)) {
        return subParam as 'curriculum' | 'quran' | 'catalog' | 'poets';
      }
    }
    return 'curriculum';
  });

  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'synced' | 'syncing' | 'offline' | 'error'>('offline');
  const [cloudSyncProgress, setCloudSyncProgress] = useState<number>(0);
  const [cloudSyncStage, setCloudSyncStage] = useState<string>('');
  const [lastCloudSyncAt, setLastCloudSyncAt] = useState<string | null>(() => {
    try {
      return localStorage.getItem('dk_last_sync_iso');
    } catch {
      return null;
    }
  });
  const [isHydrated, setIsHydrated] = useState<boolean>(false);
  const [storagePersisted, setStoragePersisted] = useState<boolean>(false);
  const hasCheckedCloudRestoreRef = useRef<string | null>(null);

  // Helper for safe LocalStorage operations without unhandled QuotaExceededError exceptions.
  // Never store base64 data:image strings inside localStorage (5MB limit); keep them solely in IndexedDB.
  const safeLocalStorageSet = (key: string, value: any) => {
    try {
      let payload = value;
      if (key === 'dk_user_books' && Array.isArray(value)) {
        payload = value.map((b: any) => {
          if (!b || typeof b !== 'object') return b;
          const copy = { ...b };
          delete copy.fileData;
          delete copy.fileStorageUrl;
          if (typeof copy.coverUrl === 'string' && copy.coverUrl.startsWith('data:')) {
            copy.coverUrl = '';
            if (!copy.coverSource) copy.coverSource = 'embedded';
          }
          return copy;
        });

        // Ensure every book's cover is permanently stored in IDB covers store intact
        value.forEach((b: any) => {
          if (b?.id && b?.coverUrl && typeof b.coverUrl === 'string' && b.coverUrl.trim() !== '') {
            saveCoverToIDB(b.id, b.coverUrl).catch(() => {});
          }
        });
      }
      localStorage.setItem(key, JSON.stringify(payload));
      // In IndexedDB we save the full value completely intact with all covers
      saveAppDataToIDB(key, value);
    } catch {
      // LocalStorage quota fallback: store ultra-compact metadata in localStorage and full data in IndexedDB
      try {
        if (key === 'dk_user_books' && Array.isArray(value)) {
          const minimal = value.map((b: any) => {
            const copy = { ...b };
            delete copy.fileData;
            delete copy.fileStorageUrl;
            if (typeof copy.description === 'string' && copy.description.length > 200) {
              copy.description = copy.description.slice(0, 200);
            }
            if (typeof copy.coverUrl === 'string' && copy.coverUrl.startsWith('data:')) {
              copy.coverUrl = '';
            }
            return copy;
          });
          localStorage.setItem(key, JSON.stringify(minimal));
        }
        saveAppDataToIDB(key, value);
      } catch {}
    }
  };

  // Load state from localStorage on init with safe error fallback and 504 permanent books guarantee
  const [userBooks, setUserBooks] = useState<UserBook[]>(() => {
    try {
      const saved = localStorage.getItem('dk_user_books');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= PERMANENT_BOOKS.length) {
          return parsed;
        }
        if (Array.isArray(parsed) && parsed.length > 0) {
          return mergePermanentBooksWithExisting(parsed);
        }
      }
      return PERMANENT_BOOKS;
    } catch {
      return PERMANENT_BOOKS;
    }
  });

  const [readingSessions, setReadingSessions] = useState<ReadingSession[]>(() => {
    try {
      const saved = localStorage.getItem('dk_reading_sessions');
      if (saved) return JSON.parse(saved);
    } catch {}
    const todayStr = new Date().toISOString().split('T')[0];
    return [
      {
        id: 'rs-1',
        bookId: 'ub-1',
        bookTitle: 'Saatleri Ayarlama Enstitüsü',
        date: todayStr,
        pagesRead: 15,
        isMultiVolume: false,
        createdAt: new Date().toISOString()
      },
      {
        id: 'rs-2',
        bookId: 'ub-2',
        bookTitle: "İhyâu 'Ulûmi'd-Dîn (1. Cilt)",
        date: todayStr,
        pagesRead: 18,
        isMultiVolume: true,
        createdAt: new Date().toISOString()
      }
    ];
  });

  const [reviews, setReviews] = useState<BookReview[]>(() => {
    try {
      const saved = localStorage.getItem('dk_reviews');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'rev-1',
        bookId: 'ub-3',
        bookTitle: 'Bu Ülke',
        author: 'Cemil Meriç',
        rating: 5,
        content: "Cemil Meriç'in kaleme aldığı 'Bu Ülke', Türk aydınının kimlik arayışını ve fikir çilelerini tarafsızca ortaya koyan eşsiz bir klasiktir.",
        createdAt: '2026-09-21T12:00:00.000Z',
        updatedAt: '2026-09-21T12:00:00.000Z'
      }
    ];
  });

  const [quotations, setQuotations] = useState<Quotation[]>(() => {
    try {
      const saved = localStorage.getItem('dk_quotations');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'q-1',
        bookId: 'ub-3',
        bookTitle: 'Bu Ülke',
        author: 'Cemil Meriç',
        pageNumber: 42,
        quoteText: 'Kamus, bir milletin namusudur.',
        userNote: 'Dil bilinci ve kültür muhafazası üzerine kilit söz.',
        tags: ['Dil', 'Kültür'],
        createdAt: '2026-09-10T14:00:00.000Z'
      },
      {
        id: 'q-2',
        bookId: 'ub-1',
        bookTitle: 'Saatleri Ayarlama Enstitüsü',
        author: 'Ahmet Hamdi Tanpınar',
        pageNumber: 115,
        quoteText: 'Saat, zamanın kendisi değil, onun ölçüsüdür.',
        userNote: 'Zaman idraki üzerine mükemmel bir cümle.',
        tags: ['Zaman', 'Felsefe'],
        createdAt: '2026-10-20T09:30:00.000Z'
      }
    ];
  });

  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>(() => {
    try {
      const saved = localStorage.getItem('dk_vocabulary');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'v-1',
        word: 'Tefekkür',
        meaning: 'Belli bir mesele üzerinde derinlemesine düşünme, zihni yorma.',
        sourceBookTitle: "İhyâu 'Ulûmi'd-Dîn",
        exampleSentence: 'Gazâli, ilmin meyvesinin tefekkür olduğunu belirtir.',
        isLearned: true,
        createdAt: '2026-10-02T10:00:00.000Z'
      },
      {
        id: 'v-2',
        word: 'Hars',
        meaning: 'Kültür, bir cemiyetin sahip olduğu manevi değerlerin bütünü.',
        sourceBookTitle: 'Kültür ve Medeniyet',
        exampleSentence: 'Ziya Gökalp gars ile medeniyeti ayrıştırır.',
        isLearned: false,
        createdAt: '2026-10-18T16:20:00.000Z'
      }
    ];
  });

  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem('dk_user_profile');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      displayName: 'Kütüphane Okuru',
      email: 'okur@dijitalkutuphanem.com',
      dailyTargetPages: 40,
      singleVolumeTargetPages: 20,
      multiVolumeTargetPages: 20,
      autoBackupEnabled: true,
      theme: 'light',
      joinedDate: '2026-01-01',
      reminderEnabled: true,
      reminderTimes: ['08:30', '14:00', '21:30'],
      reminderSound: true,
      badges: []
    };
  });

  // Notifications State & Logic
  const DEFAULT_INITIAL_NOTIFICATIONS: AppNotification[] = [
    {
      id: 'notif-1',
      title: '📖 Günlük Okuma Hatırlatıcı',
      message: 'Bugünkü 40 sayfa okuma hedefinize henüz ulaşmadınız. Kütüphanenizdeki kitaba devam edin.',
      time: 'Bugün 08:30',
      isRead: false,
      type: 'reminder',
      linkTab: 'library',
      createdAt: new Date().toISOString()
    },
    {
      id: 'notif-2',
      title: '🌙 Kur\'an-ı Kerim Hatim İlerlemesi',
      message: '14. Hizb okuma aşamasındasınız. Bugünkü cüz/sayfa hedefinizi tamamlamak için Kur\'an bölümünü açın.',
      time: 'Bugün 14:00',
      isRead: false,
      type: 'milestone',
      linkTab: 'explore',
      createdAt: new Date().toISOString()
    },
    {
      id: 'notif-3',
      title: '✨ Günün Hikmetli Sözü',
      message: 'Bediüzzaman Said Nursi: "Güzel gören güzel düşünür, güzel düşünen hayatından lezzet alır."',
      time: 'Dün 21:00',
      isRead: false,
      type: 'wisdom',
      linkTab: 'today',
      createdAt: new Date(Date.now() - 86400000).toISOString()
    },
    {
      id: 'notif-4',
      title: '🚀 Sistem Güncellemesi',
      message: 'Google Görseller kapak arama 🔍 ve canlı bildirim kutusu aktif edildi!',
      time: '2 gün önce',
      isRead: true,
      type: 'system',
      linkTab: 'today',
      createdAt: new Date(Date.now() - 172800000).toISOString()
    }
  ];

  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const saved = localStorage.getItem('dk_notifications');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_INITIAL_NOTIFICATIONS;
  });

  useEffect(() => {
    if (isHydrated) {
      safeLocalStorageSet('dk_notifications', notifications);
    }
  }, [notifications, isHydrated]);

  const addNotification = (notif: Omit<AppNotification, 'id' | 'createdAt' | 'isRead' | 'time'>) => {
    const newNotif: AppNotification = {
      ...notif,
      id: 'notif-' + Date.now(),
      isRead: false,
      time: 'Az önce',
      createdAt: new Date().toISOString()
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const markAllNotificationsAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  // Global Modals State

  const [isAddBookModalOpen, setIsAddBookModalOpen] = useState<boolean>(false);
  const [isAddQuoteModalOpen, setIsAddQuoteModalOpen] = useState<boolean>(false);
  const [isAddReviewModalOpen, setIsAddReviewModalOpen] = useState<boolean>(false);
  const [isAddPoemModalOpen, setIsAddPoemModalOpen] = useState<boolean>(false);

  // Theme Sync & Handler
  const theme: 'light' | 'dark' = userProfile.theme === 'dark' ? 'dark' : 'light';
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    setUserProfile(prev => ({ ...prev, theme: nextTheme }));
  };

  // Quran Progress State
  const [quranProgress, setQuranProgress] = useState<QuranProgress>(() => {
    try {
      const saved = localStorage.getItem('dk_quran_progress');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      lastReadSurah: 1,
      lastReadAyah: 1,
      lastReadPage: 1,
      completedJuzs: [1, 2],
      pagesReadToday: 5,
      versesReadToday: 20,
      completedHatimCount: 1,
      dailyHizbGoal: 1,
      dailyPageGoal: 20,
      readingCalendar: { [new Date().toISOString().split('T')[0]]: 5 },
      bookmarkedAyahs: [{ surahNumber: 1, ayahNumber: 1, createdAt: new Date().toISOString() }],
      favoriteAyahs: [],
      ayahNotes: {}
    };
  });

  const [activeBookForReader, setActiveBookForReaderState] = useState<UserBook | null>(null);
  const [selectedBookForDetail, setSelectedBookForDetail] = useState<UserBook | null>(null);

  const setActiveBookForReader = async (book: UserBook | null) => {
    if (!book) {
      setActiveBookForReaderState(null);
      return;
    }
    // Always fetch the latest book object from userBooks to get the most recent progress
    const latestBook = userBooks.find(b => b.id === book.id) || book;
    
    // Check if there is an exact last page saved in localStorage
    let savedPage = latestBook.currentPage || 1;
    try {
      const localSaved = localStorage.getItem(`dk_last_page_${latestBook.id}`);
      if (localSaved) {
        const parsed = parseInt(localSaved, 10);
        if (!isNaN(parsed) && parsed > 0) {
          savedPage = parsed;
        }
      }
    } catch {}

    const bookWithPage: UserBook = {
      ...latestBook,
      currentPage: Math.max(1, savedPage),
      totalPages: Math.max(latestBook.totalPages || 1, savedPage)
    };
    
    try {
      const idbFile = await getBookFileFromIDB(latestBook.id);
      if (idbFile) {
        const updated: UserBook = {
          ...bookWithPage,
          fileStorageUrl: idbFile.objectUrl,
          fileName: idbFile.fileName,
          fileType: idbFile.fileType
        };
        setActiveBookForReaderState(updated);
        setUserBooks(prev => prev.map(b => b.id === latestBook.id ? updated : b));
      } else {
        setActiveBookForReaderState(bookWithPage);
      }
    } catch {
      setActiveBookForReaderState(bookWithPage);
    }
  };
  
  // Persistence Guard: Only save to storage after initial hydration is complete
  useEffect(() => {
    if (!isHydrated) return;
    safeLocalStorageSet('dk_user_books', userBooks);
  }, [userBooks, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    safeLocalStorageSet('dk_reading_sessions', readingSessions);
  }, [readingSessions, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    safeLocalStorageSet('dk_reviews', reviews);
  }, [reviews, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    safeLocalStorageSet('dk_quotations', quotations);
  }, [quotations, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    safeLocalStorageSet('dk_vocabulary', vocabulary);
  }, [vocabulary, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    safeLocalStorageSet('dk_user_profile', userProfile);
  }, [userProfile, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    safeLocalStorageSet('dk_quran_progress', quranProgress);
  }, [quranProgress, isHydrated]);

  // Restore IndexedDB file, backup data & cover references on mount + request persistent storage
  useEffect(() => {
    async function loadAllData() {
      try {
        requestPersistentStorage().then(persisted => {
          setStoragePersisted(persisted);
        }).catch(() => {});

        const [
          savedBooks, 
          savedSessions, 
          savedReviews, 
          savedQuotes, 
          savedVocab, 
          savedQuran,
          savedNotifs,
          savedProfile
        ] = await Promise.all([
          getAppDataFromIDB('dk_user_books'),
          getAppDataFromIDB('dk_reading_sessions'),
          getAppDataFromIDB('dk_reviews'),
          getAppDataFromIDB('dk_quotations'),
          getAppDataFromIDB('dk_vocabulary'),
          getAppDataFromIDB('dk_quran_progress'),
          getAppDataFromIDB('dk_notifications'),
          getAppDataFromIDB('dk_user_profile')
        ]);

        let localBooks: UserBook[] = [];
        try {
          const rawLs = localStorage.getItem('dk_user_books');
          if (rawLs) {
            const parsedLs = JSON.parse(rawLs);
            if (Array.isArray(parsedLs)) localBooks = parsedLs;
          }
        } catch {}

        const idbBooks = Array.isArray(savedBooks) ? savedBooks : [];
        const combinedSources = [...idbBooks, ...localBooks];
        const baseBooksToEnrich = mergePermanentBooksWithExisting(combinedSources);

        const enriched = await Promise.all(
          baseBooksToEnrich.map(async (book: UserBook) => {
            let cover = book.coverUrl;
            if (!cover || cover.trim() === '' || cover.includes('placeholder')) {
              const idbCover = await getCoverFromIDB(book.id);
              if (idbCover && idbCover.trim() !== '') {
                cover = idbCover;
              }
            }
            if (cover && !cover.includes('placeholder')) {
              saveCoverToIDB(book.id, cover).catch(() => {});
            }
            const idbFile = await getBookFileFromIDB(book.id);
            return {
              ...book,
              coverUrl: cover || DEFAULT_BOOK_COVERS[book.category] || DEFAULT_BOOK_COVERS["Edebiyat"],
              fileStorageUrl: idbFile?.objectUrl || book.fileStorageUrl,
              fileName: idbFile?.fileName || book.fileName,
              fileType: idbFile?.fileType || book.fileType
            };
          })
        );
        setUserBooks(enriched);
        safeLocalStorageSet('dk_user_books', enriched);
        if (Array.isArray(savedSessions)) setReadingSessions(savedSessions);
        if (Array.isArray(savedReviews)) setReviews(savedReviews);
        if (Array.isArray(savedQuotes)) setQuotations(savedQuotes);
        if (Array.isArray(savedVocab)) setVocabulary(savedVocab);
        if (savedQuran && typeof savedQuran === 'object') setQuranProgress(savedQuran);
        if (Array.isArray(savedNotifs)) setNotifications(savedNotifs);
        if (savedProfile && typeof savedProfile === 'object') {
          setUserProfile(prev => ({ ...prev, ...savedProfile }));
        }

        // Mark as hydrated so future state changes trigger saves
        setIsHydrated(true);
      } catch (err) {
        console.warn('Persistence hydration warning:', err);
        setIsHydrated(true); // Proceed anyway to avoid locking the app
      }
    }
    loadAllData();
  }, []);

  const [newBadgeNotification, setNewBadgeNotification] = useState<Badge | null>(null);

  useEffect(() => {
    if (!isHydrated) return;

    const completedBooks = userBooks.filter(b => b.status === 'completed').length;
    const totalPages = readingSessions.reduce((sum, s) => sum + s.pagesRead, 0);

    const earnedBadges = AVAILABLE_BADGES
      .filter(badge => {
        if (badge.requirementType === 'completedBooks') return completedBooks >= badge.requirement;
        if (badge.requirementType === 'totalPages') return totalPages >= badge.requirement;
        return false;
      });
      
    const earnedBadgeIds = earnedBadges.map(b => b.id);
    const prevBadgeIds = userProfile.badges || [];

    // Check for newly earned badges
    const newlyEarned = earnedBadges.find(b => !prevBadgeIds.includes(b.id));
    if (newlyEarned) {
        setNewBadgeNotification(newlyEarned);
        setTimeout(() => setNewBadgeNotification(null), 6000);
    }

    // Only update if badges actually changed to avoid infinite loop
    if (JSON.stringify(earnedBadgeIds.sort()) !== JSON.stringify(prevBadgeIds.sort())) {
      setUserProfile(prev => ({ ...prev, badges: earnedBadgeIds }));
    }
  }, [userBooks, readingSessions, isHydrated]);

  // Automatic one-time deduplication upon hydration
  useEffect(() => {
    if (isHydrated && userBooks.length > 1) {
      deduplicateBooks();
    }
  }, [isHydrated]);


  // Firebase Auth listener: track real Google accounts cleanly and auto-restore cloud snapshot ONLY when local storage was wiped or on Google login
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        setCloudSyncStatus('synced');
        setUserProfile(prev => ({
          ...prev,
          uid: user.uid,
          displayName: user.displayName || prev.displayName,
          email: user.email || prev.email,
          photoURL: user.photoURL || prev.photoURL
        }));

        // If user signed in with a real Google account (not ephemeral anonymous) and we haven't checked cloud restore in this session
        if (!user.isAnonymous && hasCheckedCloudRestoreRef.current !== user.uid) {
          hasCheckedCloudRestoreRef.current = user.uid;
          // Single-read check ONLY when local user has no restored backup yet or freshly signed in
          const hasLocalRestore = !!localStorage.getItem('dk_last_backup_restore_at') || !!localStorage.getItem('dk_last_sync_time');
          if (!hasLocalRestore) {
            restoreFromCloud(user.uid).catch(() => {});
          }
        }
      } else {
        setCloudSyncStatus('offline');
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Periodic background auto-sync to Cloud and IndexedDB every 30 seconds + on visibilitychange/unload
  // Periodic auto-sync removed to drastically reduce Firestore read/write quota usage.
  // Sync now is strictly manual via UI trigger.

  // Helper function to sanitize any object for Firestore (removes undefined fields)
  const cleanForFirestore = (obj: any): any => {
    if (obj === null || obj === undefined) return null;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
      return obj.filter(item => item !== undefined).map(cleanForFirestore);
    }
    const clean: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val !== undefined) {
        clean[key] = cleanForFirestore(val);
      }
    }
    return clean;
  };

  // Helper for resilient Firestore writes with quota limit handling
  const safeFirestoreSet = async (docRef: any, data: any) => {
    if (!auth.currentUser) return;
    try {
      const sanitized = cleanForFirestore(data);
      await setDoc(docRef, sanitized);
    } catch (err: any) {
      if (err?.code === 'resource-exhausted') {
        console.warn("Firestore kota limiti aşıldı; veriler yerel hafızada güvendedir.");
        setCloudSyncStatus('offline');
      } else {
        console.warn("Firestore yazma uyarısı:", err?.message || err);
      }
    }
  };

  const safeFirestoreDelete = async (docRef: any) => {
    if (!auth.currentUser) return;
    try {
      await deleteDoc(docRef);
    } catch (err: any) {
      if (err?.code === 'resource-exhausted') {
        console.warn("Firestore kota limiti aşıldı.");
        setCloudSyncStatus('offline');
      } else {
        console.warn("Firestore silme uyarısı:", err?.message || err);
      }
    }
  };

  // Quran Handlers
  const updateQuranProgress = (patch: Partial<QuranProgress>) => {
    setQuranProgress(prev => {
      return { ...prev, ...patch };
    });
  };

  const bookmarkAyah = (surahNumber: number, ayahNumber: number) => {
    setQuranProgress(prev => {
      const bookmarked = prev.bookmarkedAyahs || [];
      const exists = bookmarked.some(b => b.surahNumber === surahNumber && b.ayahNumber === ayahNumber);
      const updated = exists 
        ? bookmarked.filter(b => !(b.surahNumber === surahNumber && b.ayahNumber === ayahNumber))
        : [...bookmarked, { surahNumber, ayahNumber, createdAt: new Date().toISOString() }];

      const newProg = { ...prev, bookmarkedAyahs: updated };
      return newProg;
    });
  };

  const toggleFavoriteAyah = (fav: { surahNumber: number; ayahNumber: number; textArabic: string; translationTurkish: string; createdAt: string }) => {
    setQuranProgress(prev => {
      const favs = prev.favoriteAyahs || [];
      const exists = favs.some(f => f.surahNumber === fav.surahNumber && f.ayahNumber === fav.ayahNumber);
      const updated = exists 
        ? favs.filter(f => !(f.surahNumber === fav.surahNumber && f.ayahNumber === fav.ayahNumber))
        : [fav, ...favs];

      const newProg = { ...prev, favoriteAyahs: updated };
      return newProg;
    });
  };

  const saveAyahNote = (surahNumber: number, ayahNumber: number, noteText: string) => {
    setQuranProgress(prev => {
      const key = `${surahNumber}_${ayahNumber}`;
      const updatedNotes = { ...(prev.ayahNotes || {}), [key]: noteText };
      const newProg = { ...prev, ayahNotes: updatedNotes };
      return newProg;
    });
  };

  const saveBookToFirestore = async (book: UserBook) => {
    // Firestore writes are now deferred to throttled background sync
  };

  const updateBookCover = async (bookId: string, newCoverUrl: string, source: string = 'user', confidence: number = 100) => {
    let finalCoverUrl = newCoverUrl;
    if (newCoverUrl && typeof newCoverUrl === 'string' && newCoverUrl.startsWith('data:image')) {
      try {
        finalCoverUrl = await compressImageDataUrl(newCoverUrl, 600, 900, 0.75);
      } catch (err) {
        console.warn('Cover compression fallback:', err);
      }
    }

    if (finalCoverUrl && !finalCoverUrl.includes('placeholder')) {
      saveCoverToIDB(bookId, finalCoverUrl).catch(e => console.warn(e));
    }

    setUserBooks(prev => prev.map(b => {
      if (b.id === bookId) {
        const updated: UserBook = {
          ...b,
          coverUrl: finalCoverUrl,
          coverSource: source as any,
          coverMatchScore: confidence,
          updatedAt: new Date().toISOString()
        };
        saveBookToFirestore(updated);
        return updated;
      }
      return b;
    }));
  };

  const attachBookFile = async (bookId: string, fileBlob: File): Promise<string> => {
    const fileType = fileBlob.name.endsWith('.epub') ? 'epub' : 'pdf';
    const objectUrl = await saveBookFileToIDB(bookId, fileBlob, fileBlob.name, fileType as 'pdf' | 'epub');
    
    setUserBooks(prev => prev.map(b => {
      if (b.id === bookId) {
        const updatedBook = {
          ...b,
          fileStorageUrl: objectUrl,
          fileName: fileBlob.name,
          fileType: fileType as 'pdf' | 'epub',
          updatedAt: new Date().toISOString()
        };
        saveBookToFirestore(updatedBook);
        return updatedBook;
      }
      return b;
    }));

    return objectUrl;
  };

  const updateBookTags = (bookId: string, tags: string[]) => {
    const now = new Date().toISOString();
    setUserBooks(prev => prev.map(b => {
      if (b.id === bookId) {
        const updated = { ...b, tags, updatedAt: now };
        saveBookToFirestore(updated);
        return updated;
      }
      return b;
    }));
  };

  const addBookToLibrary = (bookData: Omit<UserBook, 'id' | 'createdAt' | 'updatedAt'> | (Partial<UserBook> & { title: string; author: string; category: string })): UserBook => {
    const now = new Date().toISOString();
    let resultBook: UserBook;

    setUserBooks(prev => {
      // Robust check for existing book by ID or case-insensitive title and author match
      const existingIndex = prev.findIndex(b => 
        (('id' in bookData && bookData.id && b.id === bookData.id)) ||
        (b.title.trim().toLowerCase() === bookData.title.trim().toLowerCase() && 
         b.author.trim().toLowerCase() === bookData.author.trim().toLowerCase())
      );

      if (existingIndex !== -1) {
        // Book exists: Update its createdAt to 'now' so it moves to top of 'recent' list, and merge any new metadata
        const existingBook = prev[existingIndex];
        resultBook = {
          ...existingBook,
          ...bookData, 
          updatedAt: now,
          createdAt: now // Important: Update createdAt to move to front of "Recently Added"
        };
        
        const rest = prev.filter((_, i) => i !== existingIndex);
        const newList = [resultBook, ...rest];
        
        // Background sync to Firestore
        saveBookToFirestore(resultBook);
        return newList;
      } else {
        // Brand new book
        const bookId = ('id' in bookData && bookData.id) ? bookData.id : `ub-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        resultBook = {
          publisher: 'Klasik Yayınları',
          totalPages: 280,
          currentPage: 0,
          coverUrl: DEFAULT_BOOK_COVERS[bookData.category] || DEFAULT_BOOK_COVERS['Edebiyat'],
          description: '',
          status: 'reading',
          ...bookData,
          id: bookId,
          userId: auth.currentUser?.uid,
          createdAt: now,
          updatedAt: now
        };
        
        const newList = [resultBook, ...prev];
        saveBookToFirestore(resultBook);
        if (resultBook.coverUrl && resultBook.coverUrl.trim() !== '') {
          saveCoverToIDB(resultBook.id, resultBook.coverUrl).catch(() => {});
        }
        return newList;
      }
    });

    // In React state batching, construct the return object cleanly
    const existingInState = userBooks.find(b => 
      (('id' in bookData && bookData.id && b.id === bookData.id)) ||
      (b.title.trim().toLowerCase() === bookData.title.trim().toLowerCase() && 
       b.author.trim().toLowerCase() === bookData.author.trim().toLowerCase())
    );

    if (existingInState) {
      return {
        ...existingInState,
        ...bookData,
        updatedAt: now,
        createdAt: now
      };
    }

    return {
      publisher: 'Klasik Yayınları',
      totalPages: 280,
      currentPage: 0,
      coverUrl: DEFAULT_BOOK_COVERS[bookData.category] || DEFAULT_BOOK_COVERS['Edebiyat'],
      description: '',
      status: 'reading',
      ...bookData,
      id: ('id' in bookData && bookData.id) ? bookData.id : `ub-${Date.now()}`,
      userId: auth.currentUser?.uid,
      createdAt: now,
      updatedAt: now
    };
  };

  const updateBookProgress = (bookId: string, newPage: number) => {
    const now = new Date().toISOString();
    const todayStr = now.split('T')[0];
    const validPage = Math.max(1, Math.floor(newPage));

    try {
      localStorage.setItem(`dk_last_page_${bookId}`, String(validPage));
    } catch {}

    const targetBook = userBooks.find(b => b.id === bookId);
    let pagesDiff = 0;
    let updatedBookToSave: UserBook | null = null;

    setUserBooks(prev => {
      return prev.map(b => {
        if (b.id === bookId) {
          pagesDiff = Math.max(0, validPage - b.currentPage);
          const finalTotal = Math.max(b.totalPages || 1, validPage);
          const updatedStatus = validPage >= finalTotal ? 'completed' : b.status === 'want_to_read' ? 'reading' : b.status;

          const updatedBook: UserBook = {
            ...b,
            currentPage: validPage,
            totalPages: finalTotal,
            status: updatedStatus,
            endDate: updatedStatus === 'completed' && !b.endDate ? todayStr : b.endDate,
            updatedAt: now
          };
          updatedBookToSave = updatedBook;
          return updatedBook;
        }
        return b;
      });
    });

    // Also keep activeBookForReader state synchronized
    setActiveBookForReaderState(current => {
      if (current && current.id === bookId) {
        return {
          ...current,
          currentPage: validPage,
          totalPages: Math.max(current.totalPages || 1, validPage)
        };
      }
      return current;
    });

    if (updatedBookToSave) {
      saveBookToFirestore(updatedBookToSave);
    }
    if (pagesDiff > 0 && targetBook) {
      logReadingSession(bookId, pagesDiff);
    }
  };

  const updateBookStatus = (bookId: string, status: UserBook['status']) => {
    const now = new Date().toISOString();
    setUserBooks(prev => prev.map(b => {
      if (b.id === bookId) {
        const updated = { ...b, status, updatedAt: now };
        saveBookToFirestore(updated);
        return updated;
      }
      return b;
    }));
  };

  const clearBadgeNotification = () => setNewBadgeNotification(null);

  const mergeAndDeduplicateBooksList = (list1: UserBook[], list2?: UserBook[]): UserBook[] => {
    const combined = [...(list1 || []), ...(list2 || [])];
    const seen = new Map<string, UserBook>();
    const toDeleteIds: string[] = [];

    const normalizeKey = (str?: string) => {
      if (!str) return '';
      return str
        .toLowerCase()
        .replace(/[ıİI]/g, 'i')
        .replace(/[ğĞ]/g, 'g')
        .replace(/[üÜ]/g, 'u')
        .replace(/[şŞ]/g, 's')
        .replace(/[öÖ]/g, 'o')
        .replace(/[çÇ]/g, 'c')
        .replace(/['"’‘`´.,:;!?\-_()\[\]{}\\/|#*~]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };

    for (const book of combined) {
      if (!book || !book.title) continue;
      const titleKey = normalizeKey(book.title);
      if (!titleKey) continue;
      const authorKey = normalizeKey(book.author);
      const vol = book.isMultiVolume ? `_cilt${book.volumeNumber || 1}` : '';
      const key = `${titleKey}___${authorKey}${vol}`;

      if (!seen.has(key)) {
        seen.set(key, { ...book });
      } else {
        const existing = seen.get(key)!;

        const bookCoverScore = (book.coverUrl && !book.coverUrl.includes('placeholder')) 
          ? (book.coverUrl.startsWith('data:') ? 70 : 50) : 0;
        const existCoverScore = (existing.coverUrl && !existing.coverUrl.includes('placeholder')) 
          ? (existing.coverUrl.startsWith('data:') ? 70 : 50) : 0;

        const bookScore = (book.currentPage || 0) * 10 + (book.fileStorageUrl ? 100 : 0) + (book.userNotes ? 25 : 0) + bookCoverScore;
        const existScore = (existing.currentPage || 0) * 10 + (existing.fileStorageUrl ? 100 : 0) + (existing.userNotes ? 25 : 0) + existCoverScore;

        const winner = bookScore > existScore ? { ...book } : { ...existing };
        const loser = bookScore > existScore ? existing : book;

        // Merge page progress & metadata seamlessly
        winner.currentPage = Math.max(winner.currentPage || 0, loser.currentPage || 0);
        winner.totalPages = Math.max(winner.totalPages || 0, loser.totalPages || 0, winner.currentPage);

        // Respect status derived from latest updatedAt timestamp or explicit page completion
        const winnerTime = new Date(winner.updatedAt || 0).getTime();
        const loserTime = new Date(loser.updatedAt || 0).getTime();
        if (loserTime > winnerTime && loser.status) {
          winner.status = loser.status;
          winner.updatedAt = loser.updatedAt;
        }

        if (winner.currentPage >= winner.totalPages && winner.totalPages > 0) {
          winner.status = 'completed';
        }

        if (!winner.coverUrl || winner.coverUrl.includes('placeholder') || winner.coverUrl.trim() === '') {
          winner.coverUrl = loser.coverUrl;
        } else if (loser.coverUrl && loser.coverUrl.startsWith('data:') && !winner.coverUrl.startsWith('data:')) {
          winner.coverUrl = loser.coverUrl;
        }

        if (!winner.fileStorageUrl && loser.fileStorageUrl) {
          winner.fileStorageUrl = loser.fileStorageUrl;
          winner.fileName = loser.fileName;
          winner.fileType = loser.fileType;
        }

        if (loser.userNotes && !winner.userNotes?.includes(loser.userNotes)) {
          winner.userNotes = winner.userNotes ? `${winner.userNotes}\n${loser.userNotes}` : loser.userNotes;
        }

        if (loser.userRating && !winner.userRating) {
          winner.userRating = loser.userRating;
        }

        winner.tags = Array.from(new Set([...(winner.tags || []), ...(loser.tags || [])]));

        if (loser.id && loser.id !== winner.id) {
          toDeleteIds.push(loser.id);
        }
        seen.set(key, winner);
      }
    }

    // Background cleanup for duplicate documents in Firestore
    if (toDeleteIds.length > 0 && auth.currentUser) {
      toDeleteIds.forEach(id => {
        deleteDoc(doc(db, 'userBooks', id)).catch(() => {});
      });
    }

    return Array.from(seen.values());
  };

  const deduplicateBooks = (): number => {
    let removedCount = 0;
    const toDeleteIds: string[] = [];

    const normalizeKey = (str: string) => {
      return (str || '')
        .toLowerCase()
        .replace(/[ıİ]/g, 'i')
        .replace(/[ğĞ]/g, 'g')
        .replace(/[üÜ]/g, 'u')
        .replace(/[şŞ]/g, 's')
        .replace(/[öÖ]/g, 'o')
        .replace(/[çÇ]/g, 'c')
        .replace(/['"’‘`´.,:;!?\-_()\[\]{}\\/|#*~]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };

    setUserBooks(prev => {
      const seen = new Map<string, UserBook>();

      for (const book of prev) {
        const titleKey = normalizeKey(book.title);
        if (!titleKey) continue;
        const authorKey = normalizeKey(book.author);
        const vol = book.isMultiVolume ? `_cilt${book.volumeNumber || 1}` : '';
        const key = `${titleKey}___${authorKey}${vol}`;

        if (!seen.has(key)) {
          seen.set(key, book);
        } else {
          removedCount++;
          const existing = seen.get(key)!;

          const bookCoverScore = (book.coverUrl && !book.coverUrl.includes('placeholder')) 
            ? (book.coverUrl.startsWith('data:') ? 70 : 50) 
            : 0;
          const existCoverScore = (existing.coverUrl && !existing.coverUrl.includes('placeholder')) 
            ? (existing.coverUrl.startsWith('data:') ? 70 : 50) 
            : 0;

          const bookScore = (book.currentPage || 0) * 10 + (book.fileStorageUrl ? 100 : 0) + (book.userNotes ? 25 : 0) + bookCoverScore;
          const existScore = (existing.currentPage || 0) * 10 + (existing.fileStorageUrl ? 100 : 0) + (existing.userNotes ? 25 : 0) + existCoverScore;

          const winner = bookScore > existScore ? { ...book } : { ...existing };
          const loser = bookScore > existScore ? existing : book;

          // Merge valuable data from loser into winner
          winner.currentPage = Math.max(winner.currentPage || 0, loser.currentPage || 0);
          winner.totalPages = Math.max(winner.totalPages || 0, loser.totalPages || 0);
          if (!winner.coverUrl || winner.coverUrl.includes('placeholder') || winner.coverUrl.trim() === '') {
            winner.coverUrl = loser.coverUrl;
          } else if (loser.coverUrl && loser.coverUrl.startsWith('data:') && !winner.coverUrl.startsWith('data:')) {
            winner.coverUrl = loser.coverUrl;
          }
          if (!winner.fileStorageUrl && loser.fileStorageUrl) {
            winner.fileStorageUrl = loser.fileStorageUrl;
            winner.fileName = loser.fileName;
            winner.fileType = loser.fileType;
          }
          if (loser.userNotes && !winner.userNotes?.includes(loser.userNotes)) {
            winner.userNotes = winner.userNotes ? `${winner.userNotes}\n${loser.userNotes}` : loser.userNotes;
          }
          const winnerTime = new Date(winner.updatedAt || 0).getTime();
          const loserTime = new Date(loser.updatedAt || 0).getTime();
          if (loserTime > winnerTime && loser.status) {
            winner.status = loser.status;
            winner.updatedAt = loser.updatedAt;
          }
          if (winner.currentPage >= winner.totalPages && winner.totalPages > 0) {
            winner.status = 'completed';
          }
          if (loser.userRating && !winner.userRating) {
            winner.userRating = loser.userRating;
          }
          winner.tags = Array.from(new Set([...(winner.tags || []), ...(loser.tags || [])]));

          toDeleteIds.push(loser.id);
          seen.set(key, winner);
        }
      }

      const deduplicated = Array.from(seen.values());
      // Ensure all deduplicated covers are stored safely in IndexedDB
      deduplicated.forEach((b: UserBook) => {
        if (b.id && b.coverUrl && !b.coverUrl.includes('placeholder')) {
          saveCoverToIDB(b.id, b.coverUrl).catch(() => {});
        }
      });
      safeLocalStorageSet('dk_user_books', deduplicated);
      saveAppDataToIDB('dk_user_books', deduplicated);
      return deduplicated;
    });

    if (toDeleteIds.length > 0) {
      toDeleteIds.forEach(id => {
        deleteBookDataFromIDB(id).catch(() => {});
        if (auth.currentUser) {
          deleteDoc(doc(db, 'userBooks', id)).catch(err => console.warn('dedup firestore delete notice:', err));
        }
      });
    }

    return removedCount;
  };

  const deleteBookFromLibrary = async (bookId: string) => {
    setUserBooks(prev => prev.filter(b => b.id !== bookId));
    setActiveBookForReaderState(current => (current && current.id === bookId ? null : current));
    
    // Clean up local storage and IndexedDB file / cover stores
    try {
      localStorage.removeItem(`dk_last_page_${bookId}`);
      await deleteBookDataFromIDB(bookId);
    } catch (e) {
      console.warn('IDB delete cleanup warning:', e);
    }

    if (auth.currentUser) {
      try {
        await deleteDoc(doc(db, 'userBooks', bookId));
      } catch (err) {
        console.error('deleteBookFromLibrary firestore error:', err);
      }
    }
  };

  const logReadingSession = async (bookId: string, pagesRead: number) => {
    const targetBook = userBooks.find(b => b.id === bookId);
    if (!targetBook) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const newSession: ReadingSession = {
      id: `rs-${Date.now()}`,
      userId: auth.currentUser?.uid,
      bookId,
      bookTitle: targetBook.title,
      date: todayStr,
      pagesRead,
      isMultiVolume: !!targetBook.isMultiVolume,
      createdAt: new Date().toISOString()
    };

    setReadingSessions(prev => [newSession, ...prev]);

    if (auth.currentUser) {
      try {
        await setDoc(doc(db, 'readingSessions', newSession.id), newSession);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const addReview = async (reviewData: Omit<BookReview, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newReview: BookReview = {
      ...reviewData,
      id: `rev-${Date.now()}`,
      userId: auth.currentUser?.uid,
      createdAt: now,
      updatedAt: now
    };
    setReviews(prev => [newReview, ...prev]);

    if (auth.currentUser) {
      try {
        await setDoc(doc(db, 'reviews', newReview.id), newReview);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const deleteReview = async (id: string) => {
    setReviews(prev => prev.filter(r => r.id !== id));
    if (auth.currentUser) {
      try {
        await deleteDoc(doc(db, 'reviews', id));
      } catch (err) {
        console.error(err);
      }
    }
  };

  const addQuotation = async (
    quoteText: string, 
    pageNum?: number, 
    note?: string, 
    bookId?: string, 
    bookTitle?: string, 
    authorName?: string
  ) => {
    const defaultBook = activeBookForReader || userBooks.find(b => b.status === 'reading') || userBooks[0];
    const newQuote: Quotation = {
      id: `q-${Date.now()}`,
      userId: auth.currentUser?.uid,
      bookId: bookId || defaultBook?.id || 'general',
      bookTitle: bookTitle || defaultBook?.title || 'Genel Okuma',
      author: authorName || defaultBook?.author || 'Bilinmiyor',
      pageNumber: pageNum,
      quoteText,
      userNote: note,
      createdAt: new Date().toISOString()
    };
    setQuotations(prev => [newQuote, ...prev]);

    if (auth.currentUser) {
      try {
        await setDoc(doc(db, 'quotations', newQuote.id), newQuote);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const deleteQuotation = async (id: string) => {
    setQuotations(prev => prev.filter(q => q.id !== id));
    if (auth.currentUser) {
      try {
        await deleteDoc(doc(db, 'quotations', id));
      } catch (err) {
        console.error(err);
      }
    }
  };

  const addVocabularyItem = async (word: string, meaning: string, example?: string, sourceBook?: string) => {
    const newWord: VocabularyItem = {
      id: `v-${Date.now()}`,
      userId: auth.currentUser?.uid,
      word,
      meaning,
      exampleSentence: example,
      sourceBookTitle: sourceBook,
      isLearned: false,
      createdAt: new Date().toISOString()
    };
    setVocabulary(prev => [newWord, ...prev]);

    if (auth.currentUser) {
      try {
        await setDoc(doc(db, 'vocabulary', newWord.id), newWord);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const toggleVocabularyLearned = async (id: string) => {
    setVocabulary(prev => prev.map(v => {
      if (v.id === id) {
        const updated = { ...v, isLearned: !v.isLearned };
        if (auth.currentUser) setDoc(doc(db, 'vocabulary', id), updated);
        return updated;
      }
      return v;
    }));
  };

  const deleteVocabularyItem = async (id: string) => {
    setVocabulary(prev => prev.filter(v => v.id !== id));
    if (auth.currentUser) {
      try {
        await deleteDoc(doc(db, 'vocabulary', id));
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Export User Data
  const exportUserDataJSON = () => {
    const backupData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      userProfile,
      userBooks,
      readingSessions,
      reviews,
      quotations,
      vocabulary,
      quranProgress
    };
    return JSON.stringify(backupData, null, 2);
  };

  // Restore User Data with Validation
  const importUserDataJSON = async (jsonString: string, onProgress?: (progress: number) => void) => {
    onProgress?.(10);
    const validation = validateBackupJSON(jsonString);

    if (!validation.isValid) {
      return {
        success: false,
        validation,
        message: `Yedek Dosyası Doğrulama Hatası: ${validation.errors.join(' ')}`
      };
    }

    try {
      const data = JSON.parse(jsonString);
      onProgress?.(30);

      let bookCount = 0;
      const incomingRaw = Array.isArray(data) ? data : (Array.isArray(data.userBooks) ? data.userBooks : null);

      let importedBooksForSync: UserBook[] = userBooks;
      if (incomingRaw && incomingRaw.length > 0) {
        let idCounter = Date.now();
        const normalizedBooks = incomingRaw.map((b: any, index: number) => {
          const rawCat = b.category || '';
          let matchedCat = MAIN_CATEGORIES.find(c => c.toLowerCase() === rawCat.toLowerCase());
          if (!matchedCat) {
            matchedCat = inferCategoryForBook(b.title, b.subCategory, b.author);
          }
          const rawStatus = (b.status || '').toLowerCase();
          let validStatus: BookStatus = 'want_to_read';
          if (['reading', 'okunuyor'].includes(rawStatus)) validStatus = 'reading';
          else if (['completed', 'okundu', 'bitti'].includes(rawStatus)) validStatus = 'completed';
          else if (['paused', 'durduruldu'].includes(rawStatus)) validStatus = 'paused';
          else if (['want_to_read', 'okunacak'].includes(rawStatus)) validStatus = 'want_to_read';
          else if (Number(b.currentPage) > 0 && Number(b.currentPage) >= Number(b.totalPages || b.pageCount)) validStatus = 'completed';
          else if (Number(b.currentPage) > 0) validStatus = 'reading';

          const totalPages = Number(b.totalPages || b.pageCount) || 200;
          const currentPage = Number(b.currentPage) || 0;
          const finalTags = Array.isArray(b.tags) && b.tags.length > 0 ? b.tags : [matchedCat, b.subCategory].filter(Boolean);
          const cover = b.coverUrl || DEFAULT_BOOK_COVERS[matchedCat] || DEFAULT_BOOK_COVERS["Edebiyat"];

          return {
            id: b.id || `imp-bk-${idCounter++}-${index}`,
            title: (b.title || '').trim(),
            author: (b.author || 'Bilinmiyor').trim(),
            category: matchedCat,
            subCategory: b.subCategory || matchedCat || 'Genel',
            tags: Array.from(new Set(finalTags)),
            publisher: b.publisher || '',
            publishYear: b.publishYear || (b.publishedDate ? String(b.publishedDate).slice(0, 4) : ''),
            isbn: b.isbn || '',
            totalPages,
            currentPage,
            coverUrl: cover,
            coverSource: cover.startsWith('data:') ? 'embedded' : (cover ? 'open_library' : 'missing'),
            description: b.description || '',
            status: validStatus,
            isMultiVolume: b.isMultiVolume || (b.title || '').includes('Cilt') || (b.title || '').includes('Takım'),
            seriesTitle: b.seriesTitle || '',
            volumeNumber: Number(b.volumeNumber) || 1,
            totalVolumes: Number(b.totalVolumes) || 1,
            userRating: Number(b.userRating || b.rating) || 0,
            userNotes: b.userNotes || b.notes || '',
            fileStorageUrl: b.fileStorageUrl || b.pdfUrl || '',
            fileName: b.fileName || b.pdfName || '',
            fileType: (b.fileStorageUrl || b.pdfUrl || b.fileName || b.pdfName) ? 'pdf' : undefined,
            createdAt: b.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
          } as UserBook;
        });

        bookCount = normalizedBooks.length;

        // Persist all imported book covers directly into IndexedDB so they never disappear
        normalizedBooks.forEach((book: UserBook) => {
          if (book.id && book.coverUrl && !book.coverUrl.includes('placeholder')) {
            saveCoverToIDB(book.id, book.coverUrl).catch(() => {});
          }
        });

        // Merge with existing books preserving user progress without mutating state in place
        const permanentMap = new Map<string, UserBook>();
        userBooks.forEach(eb => {
          const k = `${normalizeBookKey(eb.title)}___${normalizeBookKey(eb.author)}`;
          permanentMap.set(k, { ...eb });
        });
        normalizedBooks.forEach((nb: UserBook) => {
          const k = `${normalizeBookKey(nb.title)}___${normalizeBookKey(nb.author)}`;
          if (!permanentMap.has(k)) {
            permanentMap.set(k, nb);
          } else {
            const target = { ...permanentMap.get(k)! };
            if (nb.currentPage > target.currentPage) target.currentPage = nb.currentPage;
            if (nb.totalPages > target.totalPages) target.totalPages = nb.totalPages;
            if (nb.status && nb.status !== 'want_to_read') target.status = nb.status;
            if (nb.userRating && !target.userRating) target.userRating = nb.userRating;
            if (nb.userNotes) {
              if (!target.userNotes) target.userNotes = nb.userNotes;
              else if (!target.userNotes.includes(nb.userNotes)) target.userNotes += `\n${nb.userNotes}`;
            }
            if (nb.fileStorageUrl && !target.fileStorageUrl) {
              target.fileStorageUrl = nb.fileStorageUrl;
              target.fileName = nb.fileName;
              target.fileType = nb.fileType;
            }
            if (nb.coverUrl && !nb.coverUrl.includes('placeholder')) {
              if (!target.coverUrl || target.coverUrl.includes('placeholder') || nb.coverUrl.startsWith('data:')) {
                target.coverUrl = nb.coverUrl;
              }
            }
            target.tags = Array.from(new Set([...(target.tags || []), ...(nb.tags || [])]));
            permanentMap.set(k, target);
          }
        });

        const mergedBooks = mergeAndDeduplicateBooksList(Array.from(permanentMap.values()));
        importedBooksForSync = mergedBooks;
        setUserBooks(mergedBooks);
        safeLocalStorageSet('dk_user_books', mergedBooks);
      }

      onProgress?.(60);

      const importedProfile = (data.userProfile && typeof data.userProfile === 'object') ? { ...userProfile, ...data.userProfile } : userProfile;
      if (data.userProfile && typeof data.userProfile === 'object') {
        setUserProfile(importedProfile);
        safeLocalStorageSet('dk_user_profile', importedProfile);
      }
      const importedSessions = Array.isArray(data.readingSessions) ? data.readingSessions : readingSessions;
      if (Array.isArray(data.readingSessions)) {
        setReadingSessions(data.readingSessions);
        safeLocalStorageSet('dk_reading_sessions', data.readingSessions);
      }
      const importedReviews = Array.isArray(data.reviews) ? data.reviews : reviews;
      if (Array.isArray(data.reviews)) {
        setReviews(data.reviews);
        safeLocalStorageSet('dk_reviews', data.reviews);
      }
      const importedQuotations = Array.isArray(data.quotations) ? data.quotations : quotations;
      if (Array.isArray(data.quotations)) {
        setQuotations(data.quotations);
        safeLocalStorageSet('dk_quotations', data.quotations);
      }
      const importedVocabulary = Array.isArray(data.vocabulary) ? data.vocabulary : vocabulary;
      if (Array.isArray(data.vocabulary)) {
        setVocabulary(data.vocabulary);
        safeLocalStorageSet('dk_vocabulary', data.vocabulary);
      }
      const importedQuran = data.quranProgress || quranProgress;
      if (data.quranProgress) {
        setQuranProgress(data.quranProgress);
        safeLocalStorageSet('dk_quran_progress', data.quranProgress);
      }

      try {
        localStorage.setItem('dk_last_backup_restore_at', new Date().toISOString());
      } catch {}

      onProgress?.(90);

      // Immediately push single-document cloud snapshot with freshly imported state if signed in with Google
      if (auth.currentUser && !auth.currentUser.isAnonymous) {
        syncAllDataToCloud(undefined, true, {
          userBooks: importedBooksForSync,
          readingSessions: importedSessions,
          reviews: importedReviews,
          quotations: importedQuotations,
          vocabulary: importedVocabulary,
          quranProgress: importedQuran,
          userProfile: importedProfile
        }).catch(e => console.warn("Background sync warning:", e));
      }

      onProgress?.(100);

      return { 
        success: true, 
        validation,
        message: `✅ Yedek doğrulaması başarılı! ${bookCount} eser, kapaklar, Kur'an ilerlemesi ve tüm arşiv kalıcı hafızaya aktarıldı.` 
      };
    } catch (err) {
      return { 
        success: false, 
        message: `Ayrıştırma hatası: ${err instanceof Error ? err.message : 'Bilinmeyen dosya biçimi'}`
      };
    }
  };

  const isSyncingRef = React.useRef(false);
  const syncStartedAtRef = React.useRef<number>(0);

  const getUtf8ByteSize = (text: string): number => {
    try {
      return new TextEncoder().encode(text).length;
    } catch {
      return text.length * 2;
    }
  };

  // Extract compact snapshot containing only user progress/custom books + sessions/quotes/reviews/vocab/quran so the entire cloud backup fits in ONE Firestore write!
  const buildCompactCloudSnapshot = (
    uid: string,
    override?: {
      userBooks?: UserBook[];
      readingSessions?: ReadingSession[];
      reviews?: BookReview[];
      quotations?: Quotation[];
      vocabulary?: VocabularyItem[];
      quranProgress?: QuranProgress;
      userProfile?: UserProfile;
    }
  ) => {
    const srcBooks = override?.userBooks ?? userBooks;
    const srcSessions = override?.readingSessions ?? readingSessions;
    const srcReviews = override?.reviews ?? reviews;
    const srcQuotes = override?.quotations ?? quotations;
    const srcVocab = override?.vocabulary ?? vocabulary;
    const srcQuran = override?.quranProgress ?? quranProgress;
    const srcProfile = override?.userProfile ?? userProfile;

    const permanentDefaults = new Map<string, UserBook>();
    PERMANENT_BOOKS.forEach(pb => {
      permanentDefaults.set(`${normalizeBookKey(pb.title)}___${normalizeBookKey(pb.author)}`, pb);
    });

    const modifiedOrCustomBooks = mergeAndDeduplicateBooksList(srcBooks)
      .filter(b => {
        const key = `${normalizeBookKey(b.title)}___${normalizeBookKey(b.author)}`;
        const def = permanentDefaults.get(key);
        if (!def) return true; // user-added or imported custom book
        return (
          (b.currentPage || 0) > 0 ||
          b.status !== def.status ||
          (b.userRating || 0) > 0 ||
          !!b.userNotes ||
          (b.coverUrl && !b.coverUrl.startsWith('data:') && b.coverUrl !== def.coverUrl) ||
          (Array.isArray(b.tags) && b.tags.length > (def.tags?.length || 0))
        );
      })
      .map(b => {
        const copy: any = { ...b, userId: uid };
        delete copy.fileData;
        delete copy.fileStorageUrl;
        // Strip raw base64 covers to guarantee snapshot stays well under Firestore 1MB limit
        if (typeof copy.coverUrl === 'string' && copy.coverUrl.startsWith('data:')) {
          copy.coverUrl = '';
        }
        if (typeof copy.description === 'string' && copy.description.length > 260) {
          copy.description = copy.description.slice(0, 260);
        }
        return copy;
      });

    return {
      uid,
      email: auth.currentUser?.email || srcProfile.email || 'okur@dijitalkutuphanem.com',
      displayName: auth.currentUser?.displayName || srcProfile.displayName || 'Okur',
      photoURL: auth.currentUser?.photoURL || srcProfile.photoURL || '',
      snapshotVersion: '2.0',
      updatedAt: new Date().toISOString(),
      userProfile: cleanForFirestore(srcProfile),
      quranProgress: cleanForFirestore(srcQuran),
      readingSessions: cleanForFirestore(srcSessions.slice(0, 400)),
      reviews: cleanForFirestore(srcReviews),
      quotations: cleanForFirestore(srcQuotes),
      vocabulary: cleanForFirestore(srcVocab),
      customBooks: cleanForFirestore(modifiedOrCustomBooks)
    };
  };

  const syncAllDataToCloud = async (
    onProgress?: (progress: number) => void,
    forceSync: boolean = false,
    overrideData?: {
      userBooks?: UserBook[];
      readingSessions?: ReadingSession[];
      reviews?: BookReview[];
      quotations?: Quotation[];
      vocabulary?: VocabularyItem[];
      quranProgress?: QuranProgress;
      userProfile?: UserProfile;
    }
  ): Promise<{ success: boolean; message: string }> => {
    const nowCheck = Date.now();
    // Stale lock guard: if a previous sync got stuck for >22s, allow recovery cleanly
    if (isSyncingRef.current && (nowCheck - syncStartedAtRef.current) < 22000) {
      return {
        success: true,
        message: `Senkronizasyon şu an devam ediyor (%${cloudSyncProgress}).`
      };
    }
    isSyncingRef.current = true;
    syncStartedAtRef.current = nowCheck;

    const updateProgress = (pct: number, stage: string) => {
      const clamped = Math.max(0, Math.min(100, Math.round(pct)));
      setCloudSyncProgress(clamped);
      setCloudSyncStage(stage);
      onProgress?.(clamped);
    };

    let activeUser = auth.currentUser;
    if (!activeUser || activeUser.isAnonymous) {
      try {
        activeUser = await loginWithGoogle();
      } catch {
        // continue
      }
    }

    if (!activeUser || !auth.currentUser || auth.currentUser.isAnonymous) {
      isSyncingRef.current = false;
      syncStartedAtRef.current = 0;
      setCloudSyncStatus('offline');
      updateProgress(0, '');
      return {
        success: false,
        message: '⚠️ Kalıcı bulut eşitlemesi için Google hesabınızla giriş yapın. Yerel verileriniz cihazda kaydedildi.'
      };
    }

    const uid = auth.currentUser.uid;
    const lastSyncStr = localStorage.getItem('dk_last_sync_time');
    const nowMs = Date.now();
    if (!forceSync && lastSyncStr && (nowMs - parseInt(lastSyncStr, 10) < 1000 * 60 * 5)) {
      isSyncingRef.current = false;
      syncStartedAtRef.current = 0;
      setCloudSyncStatus('synced');
      updateProgress(100, 'Bulut yedeği güncel');
      return { success: true, message: '✅ Bulut yedeğiniz zaten güncel.' };
    }

    setCloudSyncStatus('syncing');
    updateProgress(10, 'Bulut bağlantısı doğrulanıyor...');

    let progressTicker: ReturnType<typeof setInterval> | null = null;

    try {
      // Ensure Firestore network wasn't disabled by an earlier quota error
      await ensureFirestoreNetwork();
      updateProgress(28, 'Kütüphane ve arşiv paketleniyor...');

      let snapshot = buildCompactCloudSnapshot(uid, overrideData);
      let serialized = JSON.stringify(snapshot);
      let byteSize = getUtf8ByteSize(serialized);

      // Progressive compaction to strictly respect Firestore's 1 MiB document ceiling
      if (byteSize > 850000 && Array.isArray(snapshot.customBooks)) {
        snapshot.customBooks = snapshot.customBooks.map((b: any) => ({ ...b, description: '' }));
        serialized = JSON.stringify(snapshot);
        byteSize = getUtf8ByteSize(serialized);
      }
      if (byteSize > 850000 && Array.isArray(snapshot.readingSessions)) {
        snapshot.readingSessions = snapshot.readingSessions.slice(0, 200);
        serialized = JSON.stringify(snapshot);
        byteSize = getUtf8ByteSize(serialized);
      }
      if (byteSize > 850000 && Array.isArray(snapshot.customBooks)) {
        snapshot.customBooks = snapshot.customBooks.map((b: any) => ({ ...b, coverUrl: '' }));
        serialized = JSON.stringify(snapshot);
        byteSize = getUtf8ByteSize(serialized);
      }

      const payloadKB = Math.max(1, Math.round(byteSize / 1024));
      let livePct = 52;
      updateProgress(livePct, `Firestore buluta aktarılıyor (${payloadKB} KB)...`);

      progressTicker = setInterval(() => {
        if (livePct < 92) {
          livePct = Math.min(92, livePct + 5);
          setCloudSyncProgress(livePct);
          onProgress?.(livePct);
        }
      }, 450);

      // Single atomic Firestore write protected by a 15-second timeout so it never hangs forever
      await Promise.race([
        setDoc(doc(db, 'users', uid), snapshot, { merge: true }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('SYNC_TIMEOUT')), 15000)
        )
      ]);

      if (progressTicker) {
        clearInterval(progressTicker);
        progressTicker = null;
      }

      const completedIso = new Date().toISOString();
      try {
        localStorage.setItem('dk_last_sync_time', String(Date.now()));
        localStorage.setItem('dk_last_sync_iso', completedIso);
      } catch {}
      setLastCloudSyncAt(completedIso);

      updateProgress(100, `Tamamlandı (${payloadKB} KB)`);
      setCloudSyncStatus('synced');
      return {
        success: true,
        message: `✅ Bulut eşitlemesi tamamlandı (${payloadKB} KB: ${snapshot.customBooks.length} kitap kaydı, ${snapshot.quotations.length} alıntı, ${snapshot.readingSessions.length} oturum).`
      };
    } catch (err: any) {
      if (progressTicker) {
        clearInterval(progressTicker);
        progressTicker = null;
      }
      handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
      const errMsg = String(err?.message || '');
      if (err?.code === 'resource-exhausted' || errMsg.includes('Quota limit exceeded')) {
        setCloudSyncStatus('offline');
        updateProgress(0, 'Günlük bulut kotası doldu');
        return { success: false, message: '⚠️ Günlük Firestore kotası doldu. Verileriniz cihazınızda güvenle korunuyor; yarın tekrar deneyebilirsiniz.' };
      }
      if (errMsg === 'SYNC_TIMEOUT') {
        setCloudSyncStatus('error');
        updateProgress(0, 'Bağlantı zaman aşımı');
        return {
          success: false,
          message: '⚠️ Bulut sunucusu 15 saniye içinde yanıt vermedi (internet bağlantınız yavaş veya çevrimdışı olabilir). Verileriniz cihazınızda güvenle kaydedildi.'
        };
      }
      setCloudSyncStatus('error');
      updateProgress(0, 'Aktarım hatası');
      return {
        success: false,
        message: `⚠️ Bulut eşitlemesi tamamlanamadı (${errMsg || 'bağlantı hatası'}), yerel veriler güvende.`
      };
    } finally {
      if (progressTicker) {
        clearInterval(progressTicker);
      }
      isSyncingRef.current = false;
      syncStartedAtRef.current = 0;
    }
  };

  const restoreFromCloud = async (uidOverride?: string): Promise<{ success: boolean; message: string; restoredBooks?: number }> => {
    const uid = uidOverride || auth.currentUser?.uid;
    if (!uid || (auth.currentUser?.isAnonymous && !uidOverride)) {
      return { success: false, message: '⚠️ Buluttan geri yüklemek için Google hesabınızla giriş yapın.' };
    }

    setCloudSyncStatus('syncing');
    setCloudSyncProgress(20);
    setCloudSyncStage('Bulut bağlantısı açılıyor...');

    try {
      await ensureFirestoreNetwork();
      setCloudSyncProgress(55);
      setCloudSyncStage('Bulut yedeği indiriliyor...');

      const docRef = doc(db, 'users', uid);
      let snap;
      try {
        snap = await Promise.race([
          getDocFromServer(docRef),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('RESTORE_TIMEOUT')), 12000)
          )
        ]);
      } catch (serverErr: any) {
        if (String(serverErr?.message) === 'RESTORE_TIMEOUT') {
          throw serverErr;
        }
        snap = await Promise.race([
          getDoc(docRef),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('RESTORE_TIMEOUT')), 8000)
          )
        ]);
      }

      if (!snap.exists()) {
        setCloudSyncStatus('synced');
        setCloudSyncProgress(100);
        setCloudSyncStage('');
        return { success: false, message: 'Bu Google hesabında henüz bulut yedeği bulunamadı. Önce "Buluta Şimdi Senkronize Et"e basın.' };
      }

      const data = snap.data() as any;
      if (!data || !data.snapshotVersion) {
        setCloudSyncStatus('synced');
        setCloudSyncProgress(100);
        setCloudSyncStage('');
        return { success: false, message: 'Bulut kaydı bulundu ancak henüz tam kütüphane yedeği yüklenmemiş.' };
      }

      setCloudSyncProgress(85);
      setCloudSyncStage('Kütüphane birleştiriliyor...');

      let restoredCount = 0;
      if (Array.isArray(data.customBooks)) {
        const merged = mergeAndDeduplicateBooksList(userBooks, data.customBooks);
        setUserBooks(merged);
        safeLocalStorageSet('dk_user_books', merged);
        restoredCount = data.customBooks.length;
      }

      if (Array.isArray(data.readingSessions)) {
        setReadingSessions(data.readingSessions);
        safeLocalStorageSet('dk_reading_sessions', data.readingSessions);
      }
      if (Array.isArray(data.reviews)) {
        setReviews(data.reviews);
        safeLocalStorageSet('dk_reviews', data.reviews);
      }
      if (Array.isArray(data.quotations)) {
        setQuotations(data.quotations);
        safeLocalStorageSet('dk_quotations', data.quotations);
      }
      if (Array.isArray(data.vocabulary)) {
        setVocabulary(data.vocabulary);
        safeLocalStorageSet('dk_vocabulary', data.vocabulary);
      }
      if (data.quranProgress && typeof data.quranProgress === 'object') {
        setQuranProgress(data.quranProgress);
        safeLocalStorageSet('dk_quran_progress', data.quranProgress);
      }
      if (data.userProfile && typeof data.userProfile === 'object') {
        const mergedProf = { ...userProfile, ...data.userProfile };
        setUserProfile(mergedProf);
        safeLocalStorageSet('dk_user_profile', mergedProf);
      }

      const syncIso = typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString();
      try {
        localStorage.setItem('dk_last_backup_restore_at', new Date().toISOString());
        localStorage.setItem('dk_last_sync_iso', syncIso);
      } catch {}
      setLastCloudSyncAt(syncIso);
      setCloudSyncStatus('synced');
      setCloudSyncProgress(100);
      setCloudSyncStage('Buluttan geri yüklendi');
      return {
        success: true,
        restoredBooks: restoredCount,
        message: `✅ Bulut yedeğiniz başarıyla geri yüklendi (${restoredCount} özel/ilerlemeli kitap ve tüm arşiv).`
      };
    } catch (err: any) {
      handleFirestoreError(err, OperationType.GET, `users/${uid}`);
      const errMsg = String(err?.message || '');
      if (err?.code === 'resource-exhausted' || errMsg.includes('Quota limit exceeded')) {
        setCloudSyncStatus('offline');
      } else {
        setCloudSyncStatus('error');
      }
      setCloudSyncProgress(0);
      setCloudSyncStage('');
      return {
        success: false,
        message: errMsg === 'RESTORE_TIMEOUT'
          ? '⚠️ Bulut sunucusu 12 saniye içinde yanıt vermedi. İnternet bağlantınızı kontrol edip tekrar deneyin.'
          : `⚠️ Buluttan geri yükleme başarısız: ${errMsg || 'Bağlantı/kota hatası'}`
      };
    }
  };


  const verifyDataIntegrity = () => {
    return {
      totalBooks: userBooks.length,
      totalSessions: readingSessions.length,
      totalQuotes: quotations.length,
      totalWords: vocabulary.length,
      integrityOk: userBooks.length > 0 && Array.isArray(readingSessions)
    };
  };

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        exploreSubTab,
        setExploreSubTab,
        userBooks,
        setUserBooks,
        readingSessions,
        reviews,
        quotations,
        vocabulary,
        userProfile,
        setUserProfile,
        activeBookForReader,
        setActiveBookForReader,
        selectedBookForDetail,
        setSelectedBookForDetail,
        cloudSyncStatus,
        cloudSyncProgress,
        cloudSyncStage,
        lastCloudSyncAt,
        notifications,
        addNotification,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        deleteNotification,
        clearAllNotifications,
        theme,

        toggleTheme,
        isAddBookModalOpen,
        setIsAddBookModalOpen,
        isAddQuoteModalOpen,
        setIsAddQuoteModalOpen,
        isAddReviewModalOpen,
        setIsAddReviewModalOpen,
        isAddPoemModalOpen,
        setIsAddPoemModalOpen,
        quranProgress,
        updateQuranProgress,
        bookmarkAyah,
        toggleFavoriteAyah,
        saveAyahNote,
        addBookToLibrary,
        updateBookProgress,
        updateBookStatus,
        deleteBookFromLibrary,
        logReadingSession,
        attachBookFile,
        updateBookCover,
        updateBookTags,
        addReview,
        deleteReview,
        addQuotation,
        deleteQuotation,
        addVocabularyItem,
        toggleVocabularyLearned,
        deleteVocabularyItem,
        exportUserDataJSON,
        importUserDataJSON,
        syncAllDataToCloud,
        restoreFromCloud,
        storagePersisted,
        verifyDataIntegrity,
        newBadgeNotification,
        setNewBadgeNotification,
        clearBadgeNotification,
        deduplicateBooks
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
