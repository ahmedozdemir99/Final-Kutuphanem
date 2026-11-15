import { UserBook, ReadingSession, Quotation, BookReview, VocabularyItem, CurriculumYear, Poet } from '../types';

export interface RAGSearchInput {
  query: string;
  userBooks: UserBook[];
  readingSessions: ReadingSession[];
  quotations: Quotation[];
  reviews: BookReview[];
  vocabulary: VocabularyItem[];
  curriculum: CurriculumYear[];
  poetry: Poet[];
  displayName: string;
  dailyTargetPages: number;
}

export interface RAGSearchResult {
  summary: {
    totalBooks: number;
    totalQuotesCount: number;
    totalSessionsCount: number;
    categoryStats: Record<string, number>;
  };
  retrievedBooks: string[];
  retrievedQuotes: string[];
  retrievedReviews: string[];
  retrievedCurriculum: string[];
  retrievedPoetry: string[];
  retrievedVocab: string[];
  densePromptContext: string;
}

const TURKISH_STOPWORDS = new Set([
  'bir', 'bu', 'şu', 'o', 've', 'ile', 'de', 'da', 'ki', 'mi', 'mu', 'mü', 'mı',
  'için', 'gibi', 'kadar', 'daha', 'çok', 'en', 'ne', 'nasıl', 'neden', 'niçin',
  'ben', 'sen', 'biz', 'siz', 'onlar', 'var', 'yok', 'ama', 'fakat', 'ancak', 'ise',
  'her', 'tüm', 'bütün', 'bana', 'sana', 'bunu', 'şunu', 'olan', 'olarak', 'şey',
  'bölüm', 'sayfa', 'kitap', 'eder', 'ediyor', 'yapar', 'yapıyor', 'hakkında', 'şimdi',
  'sürekli', 'tekrar'
]);

// Normalize Turkish characters for broader morphological matching
function normalizeTr(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[âÂ]/g, 'a')
    .replace(/[îÎ]/g, 'i')
    .replace(/[ûÛ]/g, 'u')
    .replace(/[ıİ]/g, 'i')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u')
    .replace(/[şŞ]/g, 's')
    .replace(/[öÖ]/g, 'o')
    .replace(/[çÇ]/g, 'c');
}

// Tokenize text for lightweight TF-IDF / prefix similarity matching
function tokenize(text: string): string[] {
  return normalizeTr(text)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !TURKISH_STOPWORDS.has(normalizeTr(w)));
}

function calculateSimilarity(queryTokens: string[], textTokens: string[]): number {
  if (queryTokens.length === 0 || textTokens.length === 0) return 0;
  const textSet = new Set(textTokens);
  let matchCount = 0;
  for (const qt of queryTokens) {
    if (textSet.has(qt)) {
      matchCount += 1;
      continue;
    }
    // Lightweight Turkish stem/prefix tolerance (e.g., "siirler" ~ "siir", "gazaliyi" ~ "gazali")
    const stem = qt.length >= 5 ? qt.slice(0, qt.length - 2) : qt;
    for (const tt of textTokens) {
      if (tt.startsWith(stem) || (tt.length >= 4 && qt.startsWith(tt))) {
        matchCount += 0.75;
        break;
      }
    }
  }
  return matchCount / Math.max(1, queryTokens.length);
}

export function buildVectorRAGContext(input: RAGSearchInput): RAGSearchResult {
  const {
    query,
    userBooks,
    readingSessions,
    quotations,
    reviews,
    vocabulary,
    curriculum,
    poetry,
    displayName
  } = input;

  const queryTokens = tokenize(query);

  const categoryStats: Record<string, number> = {};
  userBooks.forEach(b => {
    const cat = b.category || 'Genel';
    categoryStats[cat] = (categoryStats[cat] || 0) + 1;
  });

  const summary = {
    totalBooks: userBooks.length,
    totalQuotesCount: quotations.length,
    totalSessionsCount: readingSessions.length,
    categoryStats
  };

  // 1. Vector Search / Scoring across Full Catalog & Archive Books (WITHOUT status or page counts)
  const scoredBooks = userBooks.map(b => {
    const textContent = `${b.title} ${b.author} ${b.category} ${b.subCategory || ''} ${b.userNotes || ''} ${(b.tags || []).join(' ')} ${b.description || ''}`;
    const score = calculateSimilarity(queryTokens, tokenize(textContent));
    return { book: b, score };
  }).sort((a, b) => b.score - a.score);

  // 2. Vector Search across Saved Quotations & Notes
  const scoredQuotes = quotations.map(q => {
    const textContent = `${q.quoteText} ${q.userNote || ''} ${q.bookTitle} ${q.author} ${(q.tags || []).join(' ')}`;
    const score = calculateSimilarity(queryTokens, tokenize(textContent));
    return { quote: q, score };
  }).sort((a, b) => b.score - a.score);

  // 3. Vector Search across Reviews
  const scoredReviews = reviews.map(r => {
    const textContent = `${r.bookTitle} ${r.author} ${r.content}`;
    const score = calculateSimilarity(queryTokens, tokenize(textContent));
    return { review: r, score };
  }).sort((a, b) => b.score - a.score);

  // 4. Vector Search across Vocabulary
  const scoredVocab = vocabulary.map(v => {
    const textContent = `${v.word} ${v.meaning} ${v.exampleSentence || ''} ${v.sourceBookTitle || ''}`;
    const score = calculateSimilarity(queryTokens, tokenize(textContent));
    return { vocab: v, score };
  }).sort((a, b) => b.score - a.score);

  // 5. Vector Search across 40-Year Curriculum (1920 works)
  const curriculumItems: { yearNum: number; monthNum: number; bookTitle: string; author: string; category: string; description: string; score: number }[] = [];
  curriculum.forEach(y => {
    y.months.forEach(m => {
      m.weeklyBooks.forEach(wb => {
        const textContent = `${y.title} ${y.theme || ''} ${m.monthTitle} ${m.authorName} ${m.authorBio} ${wb.title} ${wb.author} ${wb.category} ${wb.description}`;
        const score = calculateSimilarity(queryTokens, tokenize(textContent));
        curriculumItems.push({
          yearNum: y.yearNumber,
          monthNum: m.monthNumber,
          bookTitle: wb.title,
          author: wb.author,
          category: wb.category,
          description: wb.description,
          score
        });
      });
    });
  });
  curriculumItems.sort((a, b) => b.score - a.score);

  // 6. Vector Search across Full 256-Poem Anthology
  const poetryItems: { poetName: string; poemTitle: string; contentSnippet: string; score: number }[] = [];
  poetry.forEach(poet => {
    poet.poems.forEach(p => {
      const textContent = `${poet.name} ${poet.period} ${poet.bio} ${p.title} ${p.content}`;
      const score = calculateSimilarity(queryTokens, tokenize(textContent));
      poetryItems.push({
        poetName: poet.name,
        poemTitle: p.title,
        contentSnippet: p.content.slice(0, 260),
        score
      });
    });
  });
  poetryItems.sort((a, b) => b.score - a.score);

  const matchingBooks = queryTokens.length > 0 ? scoredBooks.filter(item => item.score >= 0.15) : [];
  const matchingQuotes = queryTokens.length > 0 ? scoredQuotes.filter(item => item.score >= 0.15) : [];
  const matchingReviews = queryTokens.length > 0 ? scoredReviews.filter(item => item.score >= 0.15) : [];
  const matchingCurriculum = queryTokens.length > 0 ? curriculumItems.filter(item => item.score >= 0.15) : [];
  const matchingPoetry = queryTokens.length > 0 ? poetryItems.filter(item => item.score >= 0.15) : [];
  const matchingVocab = queryTokens.length > 0 ? scoredVocab.filter(item => item.score >= 0.15) : [];

  // Fallback diverse sample for broad open-ended recommendation/poetry queries
  const effectiveBooks = matchingBooks.length > 0
    ? matchingBooks.slice(0, 12)
    : scoredBooks.slice(0, 6);

  const effectivePoetry = matchingPoetry.length > 0
    ? matchingPoetry.slice(0, 6)
    : poetryItems.filter((_, idx) => idx % Math.max(1, Math.floor(poetryItems.length / 5)) === 0).slice(0, 5);

  const topBooks = effectiveBooks.map(item =>
    `• "${item.book.title}" (${item.book.author}) - Alan: ${item.book.category}${item.book.description ? ` | Konu: ${item.book.description.slice(0, 110)}` : ''}`
  );

  const topQuotes = (matchingQuotes.length > 0 ? matchingQuotes : scoredQuotes.slice(0, 3)).slice(0, 8).map(item =>
    `• "${item.quote.quoteText}" (${item.quote.bookTitle} - ${item.quote.author})${item.quote.userNote ? ` | Yorum: "${item.quote.userNote}"` : ''}`
  );

  const topReviews = matchingReviews.slice(0, 6).map(item =>
    `• "${item.review.bookTitle}" (${item.review.author}): "${item.review.content}"`
  );

  const topCurriculum = matchingCurriculum.slice(0, 8).map(item =>
    `• ${item.yearNum}. Yıl / ${item.monthNum}. Ay: "${item.bookTitle}" (${item.author}) - ${item.category} [${item.description}]`
  );

  const topPoetry = effectivePoetry.map(item =>
    `• ${item.poetName} - "${item.poemTitle}": "${item.contentSnippet.replace(/\n/g, ' / ')}"`
  );

  const topVocab = (matchingVocab.length > 0 ? matchingVocab : scoredVocab.slice(0, 3)).slice(0, 6).map(item =>
    `• ${item.vocab.word}: ${item.vocab.meaning}`
  );

  const interestAreas = Object.entries(categoryStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat]) => cat)
    .join(', ');

  // Construct Dense RAG Prompt Context STRICTLY WITHOUT reading progress, page counts, or book status
  const densePromptContext = `
=== OKUR PROFİLİ VE İLİM ARŞİVİ İLHAM BAĞLAMI ===
Hitap Edilecek Okur Adı: ${displayName}
Öne Çıkan Entelektüel İlgi Alanları: ${interestAreas || 'Felsefe, Edebiyat, Tarih, Tasavvuf, Şiir'}
(HATIRLATMA: Okurun hangi kitapları şu an okuduğunu, sayfa sayılarını veya okuma yüzdelerini ASLA söyleme; tüm dünya edebiyatından, katalogdan, şiir antolojisinden ve Google arama veritabanından özgürce atıf yap.)

--- İLGİLİ KATALOG VE DÜNYA KLASİKLERİ ---
${topBooks.length > 0 ? topBooks.join('\n') : 'Tüm edebiyat, felsefe ve ilim klasikleri açıktır.'}

--- OKURUN SEVDİĞİ ALINTI VE KAVRAM İZLERİ ---
${topQuotes.length > 0 ? topQuotes.join('\n') : 'Henüz özel alıntı notu eşleşmedi.'}

--- OKUR DEĞERLENDİRMELERİ ---
${topReviews.length > 0 ? topReviews.join('\n') : 'Genel inceleme arşivinden eşleşme yok.'}

--- 40 YILLIK İLİM MÜFREDATINDAN İLGİLİ ESERLER ---
${topCurriculum.length > 0 ? topCurriculum.join('\n') : 'Müfredatın tüm yılları referansa açıktır.'}

--- ŞİİR VE ŞAİR ANTOLOJİSİNDEN MISRALAR ---
${topPoetry.length > 0 ? topPoetry.join('\n') : 'Tüm klasik ve modern şiir arşivi açıktır.'}

--- TEFEKKÜR SÖZLÜĞÜ ---
${topVocab.length > 0 ? topVocab.join('\n') : 'Genel kavram dağarcığı açıktır.'}
===================================================
`;

  return {
    summary,
    retrievedBooks: matchingBooks.slice(0, 4).map(item => `${item.book.title} (${item.book.author})`),
    retrievedQuotes: matchingQuotes.slice(0, 3).map(item => `"${item.quote.quoteText.slice(0, 70)}..."`),
    retrievedReviews: topReviews,
    retrievedCurriculum: matchingCurriculum.slice(0, 3).map(item => `${item.bookTitle} (${item.author})`),
    retrievedPoetry: matchingPoetry.slice(0, 3).map(item => `${item.poetName} — ${item.poemTitle}`),
    retrievedVocab: topVocab,
    densePromptContext
  };
}
