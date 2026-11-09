import { ThinkingLevel, UrlRetrievalStatus } from '@google/genai';
import type { Content, GoogleGenAI } from '@google/genai';
import { askRobiBrain } from './robiBrain.ts';

export type RobiChatMode = 'balanced' | 'deep' | 'source';

const SYSTEM_INSTRUCTION = `Sen Dijital Kütüphanem'in bilge, entelektüel, felsefi ve edebi birikimi en üst seviyede olan ilim, kültür ve tefekkür yoldaşı "Robi"sin (🐿️).

[TEMEL KİMLİĞİN VE ÜSLUBUN]:
1. Entelektüel ve Edebi Derinlik: Yüzeysel, sıradan veya klişe cümleler kurma. Açıklamalarında kavramsal berraklık, felsefi derinlik ve edebi bir estetik hakim olsun. Türkçeyi zengin, akıcı, latif ve felsefi bir vakarla kullan. Selamlaşmayı veya basmakalıp girişleri her yanıtta tekrarlama; doğrudan sorunun özüne ve fikrin kalbine gir.
2. Disiplinler Arası Harmanlama ve Terkip (Sentez): Kullanıcının sorusunu ele alırken yalnızca o an okuduğu kitaba hapsolma. Şunları aynı potada harmanlayarak atıfta bulun:
   - Okurun kütüphanesi, okuma notları ve alıntı arşivi
   - 40 Yıllık İlim ve Tefekkür Müfredatımızdaki klasik başyapıtlar (Gazâlî, İbn Rüşd, Fârâbî, İbn Sînâ, Platon, Aristoteles, Kant, Spinoza, Hegel, Descartes vb.)
   - 256 şiirlik zengin antolojimiz ve divan/çağdaş şiir hafızamız (Yunus Emre, Mevlânâ, Fuzûlî, Şeyh Gâlib, Yahya Kemal, Ahmet Hamdi Tanpınar, Sezai Karakoç, Necip Fazıl, Rilke, Baudelaire)
   - Dünya literatürü, Google Books, Vikipedi ve ansiklopedik ilim mirası (TDV İslam Ansiklopedisi, Stanford Felsefe Ansiklopedisi, Britannica düzeyi)
3. 12 Kategoriye Mutlak Hakimiyet:
   - Din ve İlahiyat: Kelam, tefsir, hadis, fıkıh usulü ve mukayeseli dinler
   - Felsefe ve Mantık: Ontoloji, epistemoloji, ahlak felsefesi, mantık ve varoluşçuluk
   - Edebiyat ve Sanat: Roman sanatı, estetik, hermenötik ve edebiyat kuramları
   - Tarih ve Medeniyet: Medeniyet tahlili, Doğu-Batı sentezi, tarih felsefesi
   - Tasavvuf ve Ahlak: İrfan mektebi, kalp tezkiyesi, hikmet ve ahlak
   - Sosyoloji ve Siyaset: Kültür, toplum, modernleşme sancısı ve siyaset felsefesi
   - Psikoloji ve Ruh Sağlığı: İçsel anlam arayışı, irade terbiyesi, şuur katmanları
   - Bilim ve Tabiat: Bilim felsefesi, kozmoloji, doğa felsefesi
   - İktisat ve İdare: İktisat ahlakı, yönetim hikmeti, adalet nazariyesi
   - Biyografi ve Hatırat: Şahsiyet inşası, münevverlerin tanıklıkları
   - Dil ve Filoloji: Etimoloji, dil felsefesi, belagat ve kavramsal soykütük
   - Çocuk ve Gençlik: Karakter pedagojisi ve erdem terbiyesi
4. Canlı Alıntı ve Doğruluk: İlgili düşünürlerin temel tezlerini ve mısralarını yerli yerinde zikret. Uydurma bilgi veya yanlış isnat yapma; kaynakları, kavramları ve şahsiyetleri titizlikle ayırt et.
5. Sesli Dinlemeye Uygun Ahenk: Sesli okuma motoruna uygun, nefes alımlı, duru ve musikisi olan cümleler kur.`;

const MODE_INSTRUCTIONS: Record<RobiChatMode, string> = {
  balanced: 'Sorunun özüne doğrudan cevap ver; ardından 12 kategori, şiir veya okuma müfredatından somut bir kavramsal irtibat ve zarif bir edebi bağ kurarak kısa/orta uzunlukta tamamla.',
  deep: 'Soruyu en yüksek felsefi ve edebi derinlikle tahlil et. Kavramları tanımla; tezi, antitezi ve sentezi kur. Okur arşivinden, 40 yıllık müfredat klasikleri ve şiir antolojimizden atıflar yaparak ufuk açıcı bir sonraki tefekkür adımı sun.',
  source: 'Yalnızca verilen web bağlantısındaki metni URL Context ile incele. İddiayı, kanıtları ve felsefi/tarihsel bağlamı açıkla. İnceleyemediğin kaynaklar için varsayım üretme.',
};

export function normalizeRobiMode(value: unknown): RobiChatMode {
  return value === 'balanced' || value === 'source' ? value : 'deep';
}

export function getRobiSourceUrls(message: string): string[] {
  const urls = new Set<string>();
  for (const match of message.matchAll(/https?:\/\/[^\s<>"`]+/giu)) {
    let address = match[0].replace(/[.,;!]+$/u, '');
    while (address.endsWith(')') && address.split(')').length > address.split('(').length) {
      address = address.slice(0, -1);
    }
    if (!URL.canParse(address)) continue;
    const url = new URL(address);
    if (!url.username && !url.password) {
      url.hash = '';
      urls.add(url.href);
    }
  }
  return [...urls];
}

interface RobiChatInput {
  message: string;
  mode: RobiChatMode;
  history: unknown;
  archive: string;
  summary: unknown;
}

export interface RobiChatReply {
  reply: string;
  model?: string;
  isFallback: boolean;
  sourceUrls?: string[];
}

export async function generateRobiChat(ai: GoogleGenAI | undefined, input: RobiChatInput): Promise<RobiChatReply> {
  const { message, mode, archive, summary } = input;
  const isSource = mode === 'source';
  const sourceUrls = isSource ? getRobiSourceUrls(message) : [];
  const contents: Content[] = [];

  if (!isSource && Array.isArray(input.history)) {
    for (const turn of input.history.slice(-10)) {
      const role = turn?.role;
      const text = turn?.text ?? turn?.parts?.[0]?.text;
      if ((role !== 'user' && role !== 'model') || typeof text !== 'string' || !text.trim()) continue;
      if (contents.length === 0 && role === 'model') continue;

      const part = { text: text.slice(0, 5000) };
      const previous = contents.at(-1);
      if (previous && previous.role === role) previous.parts?.push(part);
      else contents.push({ role, parts: [part] });
    }
  }

  const latestParts = [
    ...(!isSource && archive ? [{ text: `[OKUR KÜTÜPHANESİ, 12 KATEGORİ, ŞİİR VE MÜFREDAT BAĞLAMI]:\n${archive.slice(0, 16000)}` }] : []),
    { text: message },
  ];
  const previous = contents.at(-1);
  if (previous?.role === 'user') previous.parts?.push(...latestParts);
  else contents.push({ role: 'user', parts: latestParts });

  const models = isSource
    ? ['gemini-3.8-flash', 'gemini-flash-latest']
    : mode === 'balanced'
      ? ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash']
      : ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];

  if (ai) {
    for (const model of models) {
      // 1. Try with Google Search Grounding for rich Wikipedia, Google Books, & global literature access
      const tools = isSource
        ? [{ urlContext: {} }]
        : [{ googleSearch: {} }];

      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: `${SYSTEM_INSTRUCTION}\n\n${MODE_INSTRUCTIONS[mode]}`,
            httpOptions: { timeout: 28000, retryOptions: { attempts: 1 } },
            ...(model !== 'gemini-3.1-flash-lite' ? {
              thinkingConfig: { thinkingLevel: mode === 'balanced' ? ThinkingLevel.LOW : ThinkingLevel.HIGH },
            } : {}),
            tools: tools as any,
          },
        });

        const reply = response.text?.trim();
        if (reply) {
          if (!isSource) {
            // Extract grounding chunks / search citations if available
            const groundingChunks = (response.candidates?.[0] as any)?.groundingMetadata?.groundingChunks;
            const searchUris: string[] = [];
            if (Array.isArray(groundingChunks)) {
              for (const chunk of groundingChunks) {
                if (chunk?.web?.uri && typeof chunk.web.uri === 'string') {
                  searchUris.push(chunk.web.uri);
                }
              }
            }
            const uniqueUrls = Array.from(new Set(searchUris)).slice(0, 4);
            return { reply, model, isFallback: false, ...(uniqueUrls.length > 0 ? { sourceUrls: uniqueUrls } : {}) };
          }

          const loaded = new Set((response.candidates?.[0]?.urlContextMetadata?.urlMetadata ?? [])
            .filter(entry => entry.urlRetrievalStatus === UrlRetrievalStatus.URL_RETRIEVAL_STATUS_SUCCESS)
            .flatMap(entry => getRobiSourceUrls(entry.retrievedUrl ?? '')));
          const verified = sourceUrls.filter(url => loaded.has(url));
          if (verified.length > 0) return { reply, model, isFallback: false, sourceUrls: verified };
        }
      } catch (searchToolError) {
        // If googleSearch tool encountered an issue (e.g. region or rate limit), try without search tool
        try {
          const directResponse = await ai.models.generateContent({
            model,
            contents,
            config: {
              systemInstruction: `${SYSTEM_INSTRUCTION}\n\n${MODE_INSTRUCTIONS[mode]}`,
              httpOptions: { timeout: 25000, retryOptions: { attempts: 1 } },
              ...(model !== 'gemini-3.1-flash-lite' ? {
                thinkingConfig: { thinkingLevel: mode === 'balanced' ? ThinkingLevel.LOW : ThinkingLevel.HIGH },
              } : {}),
            },
          });
          const directReply = directResponse.text?.trim();
          if (directReply) {
            return { reply: directReply, model, isFallback: false };
          }
        } catch (directErr) {
          console.warn('Robi direct model error:', model, (directErr as { status?: number })?.status ?? 'request failed');
        }
      }
    }
  }

  if (isSource) {
    return { reply: 'Bu bağlantının içeriğini doğrudan doğrulayamadım. İncelememi istediğin pasajı buraya yazıp Derin tahlil seçeneğinde tahlil edebiliriz.', isFallback: true };
  }
  return { reply: askRobiBrain({ message, userSummary: summary }), isFallback: true };
}
