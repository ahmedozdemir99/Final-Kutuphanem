import { ThinkingLevel, UrlRetrievalStatus } from '@google/genai';
import type { Content, GoogleGenAI } from '@google/genai';
import { askRobiBrain } from './robiBrain.ts';

export type RobiChatMode = 'balanced' | 'deep' | 'source';

const SYSTEM_INSTRUCTION = `Sen Dijital Kütüphanem'in bilge, entelektüel, felsefi ve edebi birikimi en üst seviyede olan ilim, kültür ve tefekkür yoldaşı "Robi"sin (🐿️).

[TEMEL KİMLİĞİN VE ÜSLUBUN]:
1. Kişiselleştirilmiş Hafıza ve Yoldaşlık: Karşındaki okuru önceki sohbetlerinizden, ilgi duyduğu kavramlardan, notlarından ve beğendiği mısralardan tanıyorsun. Cevaplarını, kitap önerilerini, şiir paylaşımlarını ve okuma listelerini okurun düşünce dünyasına göre incelikle kişiselleştir.
2. KESİN MAHREMİYET KURALI (ASLA İHLAL ETME): Kullanıcının hangi kitapları şu an okuduğunu, hangi kitapları bitirdiğini, okuma listesinde nelerin kayıtlı olduğunu, kaçıncı sayfada olduğunu veya yüzdelik okuma ilerlemesini ASLA zikretme! "Şu an okuduğun...", "Bitirdiğin...", "Sayfa X/Y" gibi ifadeler kesinlikle yasaktır. Kütüphane ve sohbet izlerini sadece okurun zevkini sessizce sezmek için arka planda tut; cevabında doğrudan konuya ve evrensel birikime odaklan.
3. Tüm Kitaplardan, Şiirlerden ve Google Veritabanından Atıf: Kendini yalnızca birkaç bilinen kitapla sınırlama. Dünya edebiyatı, Türk edebiyatı, İslam düşüncesi, felsefe, psikoloji, tarih, tasavvuf, 1920 eserlik 40 yıllık ilim müfredatı, 256 şiirlik antoloji, Google Kitaplar ve Google Arama veritabanındaki tüm eserlerden, şairlerden ve kaynaklardan özgürce ve zengin bir çeşitlilikle atıf yap.
4. Paragraflar Arası Anlam Bütünlüğü ve Akış: Cevapların kopuk başlık yığınları veya rastgele madde listeleri gibi durmasın. Giriş, gelişme ve derinleşme boyunca bir paragraftan diğerine mantıksal ve edebi geçişlerle bağlanan, bütüncül, akıcı ve zevkle okunan bir nesir kur.
5. Canlı Alıntı ve Doğruluk: Şiir mısralarını, kitap adlarını ve düşünür görüşlerini doğru ve yerinde aktar; uydurma isnatlarda bulunma. Sesli dinlemeye uygun, duru ve musikisi güçlü bir Türkçe kullan.`;

const MODE_INSTRUCTIONS: Record<RobiChatMode, string> = {
  balanced: 'Sorunun kalbine doğrudan odaklan; anlam bütünlüğü yüksek 2-3 akıcı paragrafla konuyu derinleştirip uygun kitap veya şiir atıflarıyla dengeli biçimde tamamla.',
  deep: 'Soruyu en yüksek felsefi, tarihi ve edebi derinlikle tahlil et. Kavramların köküne in; önceki sohbet izlerini gözeterek akıcı ve birbirine sıkı sıkıya bağlı paragraflar halinde kapsamlı bir değerlendirme, ilgili şiir/kitap referansları veya kişiselleştirilmiş okuma listesi sun.',
  source: 'Soruyu doğrudan güvenilir kaynaklara (varsa verilen web bağlantılarının URL içeriğine, yoksa Google Arama ve Google Kitaplar veritabanı ile edebiyat/ilim arşivine) dayandırarak yanıtla. İncelediğin eserlerden, şiirlerden, düşünürlerden ve tarihsel bağlamdan somut atıflar ver; paragraflar arasında anlam bütünlüğü koru ve doğrulayamadığın bilgiler için uydurma isnatlarda bulunma.',
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
  googleBooksContext?: string;
  summary: unknown;
}

export interface RobiChatReply {
  reply: string;
  model?: string;
  isFallback: boolean;
  sourceUrls?: string[];
}

export async function generateRobiChat(ai: GoogleGenAI | undefined, input: RobiChatInput): Promise<RobiChatReply> {
  const { message, mode, archive, googleBooksContext, summary } = input;
  const sourceUrls = mode === 'source' ? getRobiSourceUrls(message) : [];
  const hasExplicitUrls = mode === 'source' && sourceUrls.length > 0;
  const contents: Content[] = [];

  if (!hasExplicitUrls && Array.isArray(input.history)) {
    for (const turn of input.history.slice(-16)) {
      const role = turn?.role;
      const text = turn?.text ?? turn?.content ?? turn?.parts?.[0]?.text;
      if ((role !== 'user' && role !== 'model') || typeof text !== 'string' || !text.trim()) continue;
      if (contents.length === 0 && role === 'model') continue;

      const part = { text: text.slice(0, 4000) };
      const previous = contents.at(-1);
      if (previous && previous.role === role) previous.parts?.push(part);
      else contents.push({ role, parts: [part] });
    }
  }

  const latestParts = [
    ...(!hasExplicitUrls && archive ? [{ text: `[OKUR İLGİ PROFİLİ, 12 KATEGORİ, ŞİİR VE MÜFREDAT BAĞLAMI]:\n${archive.slice(0, 14000)}` }] : []),
    ...(!hasExplicitUrls && googleBooksContext ? [{ text: `[GOOGLE BOOKS VERİTABANI ARAMA SONUÇLARI]:\n${googleBooksContext.slice(0, 4000)}` }] : []),
    { text: message },
  ];
  const previous = contents.at(-1);
  if (previous?.role === 'user') previous.parts?.push(...latestParts);
  else contents.push({ role: 'user', parts: latestParts });

  const models = mode === 'balanced'
    ? ['gemini-3.1-flash-lite', 'gemini-4-hydrogen']
    : ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'];

  if (ai) {
    for (const model of models) {
      const tools = hasExplicitUrls
        ? [{ urlContext: {} }]
        : [{ googleSearch: {} }];

      const thinkingConfig = model === 'gemini-4-hydrogen'
        ? { thinkingLevel: mode === 'balanced' ? ThinkingLevel.LOW : ThinkingLevel.HIGH }
        : undefined;

      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: `${SYSTEM_INSTRUCTION}\n\n${MODE_INSTRUCTIONS[mode]}`,
            httpOptions: { timeout: 28000, retryOptions: { attempts: 1 } },
            ...(thinkingConfig ? { thinkingConfig } : {}),
            tools: tools as any,
          },
        });

        const reply = response.text?.trim();
        if (reply) {
          if (!hasExplicitUrls) {
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
          return { reply, model, isFallback: false };
        }
      } catch (searchToolError: any) {
        console.warn(`[Robi Grounded Error] ${model}:`, searchToolError?.status, searchToolError?.message?.substring(0, 140));
        if (hasExplicitUrls) continue;

        try {
          const directResponse = await ai.models.generateContent({
            model,
            contents,
            config: {
              systemInstruction: `${SYSTEM_INSTRUCTION}\n\n${MODE_INSTRUCTIONS[mode]}`,
              httpOptions: { timeout: 25000, retryOptions: { attempts: 1 } },
              ...(thinkingConfig ? { thinkingConfig } : {}),
            },
          });
          const directReply = directResponse.text?.trim();
          if (directReply) {
            return { reply: directReply, model, isFallback: false };
          }
        } catch (directErr: any) {
          console.warn(`[Robi Direct Error] ${model}:`, directErr?.status, directErr?.message?.substring(0, 140));
        }
      }
    }
  }

  if (hasExplicitUrls) {
    return { reply: 'Bu bağlantının içeriğini doğrudan doğrulayamadım. İncelememi istediğin pasajı buraya yazıp Derin tahlil seçeneğinde birlikte çözümleyebiliriz.', isFallback: true };
  }
  return {
    reply: askRobiBrain({
      message,
      history: Array.isArray(input.history) ? input.history : undefined,
      densePromptContext: archive,
      userSummary: summary
    }),
    isFallback: true
  };
}
