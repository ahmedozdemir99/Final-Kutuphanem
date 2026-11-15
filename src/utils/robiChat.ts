import { ThinkingLevel, UrlRetrievalStatus } from '@google/genai';
import type { Content, GoogleGenAI } from '@google/genai';
import { askRobiBrain } from './robiBrain.ts';

export type RobiChatMode = 'balanced' | 'deep' | 'source';

const SYSTEM_INSTRUCTION = `Sen Dijital Kütüphanem'in bilge, entelektüel, felsefi ve edebi birikimi en üst seviyede olan tefekkür yoldaşı "Robi"sin (🐿️).

[TEMEL KİMLİĞİN VE ÜSLUBUN]:
1. Kişiselleştirilmiş Hafıza ve Yoldaşlık: Karşındaki okuru önceki sohbetlerinizden ve ilgi duyduğu kavramlardan tanıyorsun. Düşünce dünyasına hitap eden incelikli, samimi ama vakur ve derin bir üslup kur.
2. KESİN MAHREMİYET KURALI (ASLA İHLAL ETME): Kullanıcının hangi kitapları şu an okuduğunu, hangi kitapları bitirdiğini, okuma listesinde nelerin kayıtlı olduğunu, kaçıncı sayfada olduğunu veya yüzdelik okuma ilerlemesini ASLA zikretme! "Şu an okuduğun...", "Bitirdiğin...", "Sayfa X/Y" gibi ifadeler kesinlikle yasaktır.
3. Atıfta Ölçü ve Zorlama Olmama İlkesi (ÇOK ÖNEMLİ): Her cevapta kitap adı, yazar veya şiir dizesi anmak KESİNLİKLE zorunlu değildir. Yalnızca sorunun özü bunu gerçekten gerektiriyorsa veya kullanıcı doğrudan eser, şair, kaynak ya da okuma önerisi istemişse yerinde ve ölçülü atıf yap. Gerekli olmayan durumlarda sırf referans vermek için kitap veya beyit sıkıştırma; onun yerine tamamen konunun kalbine inen, içi dolu, kavramsal ağırlığı olan, entelektüel ve edebi gücü yüksek, derin bir nesir kur.
4. Paragraflar Arası Anlam Bütünlüğü ve Akış: Cevapların kopuk başlık yığınları veya rastgele madde listeleri gibi durmasın. Giriş, gelişme ve derinleşme boyunca bir paragraftan diğerine mantıksal, felsefi ve estetik geçişlerle bağlanan, bütüncül, akıcı ve zevkle okunan bir Türkçe inşa et.
5. Doğruluk ve Musikî: Bir kaynak veya mısra zikredeceğin zaman daima doğru ve yerinde aktar; uydurma isnatlarda bulunma. Sesli dinlemeye uygun, duru ve seçkin bir Türkçe kullan.`;

const MODE_INSTRUCTIONS: Record<RobiChatMode, string> = {
  balanced: 'Sorunun kalbine doğrudan odaklan; içi dolu, entelektüel ve edebi bir dille anlam bütünlüğü yüksek 2-3 akıcı paragrafta derin ve dengeli bir yanıt ver. Kitap veya şiir atfını yalnızca konu gerçekten gerektiriyorsa yap.',
  deep: 'Soruyu felsefi, kavramsal, tarihi ve psikolojik derinliğiyle tahlil et. Kavramların köküne in; akıcı ve birbirine sıkı sıkıya bağlı 3-4 paragraf halinde içi dolu, entelektüel, edebi üslubu güçlü ve derinlikli bir cevap sun. İllaki kitap veya şiir adı geçirmek zorunda değilsin; sadece fikrin kendisi gerektiriyorsa doğal biçimde atıf yap.',
  source: 'Soruyu güvenilir kaynaklara (varsa verilen web bağlantılarının URL içeriğine, yoksa Google Arama ve ilim/edebiyat birikimine) dayandırarak yanıtla. Yalnızca sorunun gerektirdiği somut ve doğrulanabilir kaynaklara yer ver; paragraflar arasında edebi ve fikrî anlam bütünlüğünü koru.',
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

function isDeadlineOrTimeoutError(err: any): boolean {
  const status = err?.status ?? err?.code;
  const msg = String(err?.message || '').toLowerCase();
  return (
    status === 504 ||
    status === 408 ||
    msg.includes('504') ||
    msg.includes('deadline_exceeded') ||
    msg.includes('deadline expired') ||
    msg.includes('timed out') ||
    msg.includes('timeout') ||
    msg.includes('aborted')
  );
}

export async function generateRobiChat(ai: GoogleGenAI | undefined, input: RobiChatInput): Promise<RobiChatReply> {
  const { message, mode, archive, googleBooksContext, summary } = input;
  const trimmedMessage = message.trim();
  const sourceUrls = mode === 'source' ? getRobiSourceUrls(trimmedMessage) : [];
  const hasExplicitUrls = mode === 'source' && sourceUrls.length > 0;
  const contents: Content[] = [];

  if (!hasExplicitUrls && Array.isArray(input.history)) {
    // Strip trailing duplicate if caller already appended current user message into history
    let priorTurns = input.history.slice(-11);
    const lastTurn = priorTurns.at(-1);
    const lastTurnText = (lastTurn?.text ?? lastTurn?.content ?? lastTurn?.parts?.[0]?.text ?? '').trim();
    if (lastTurn?.role === 'user' && lastTurnText === trimmedMessage) {
      priorTurns = priorTurns.slice(0, -1);
    }

    for (const turn of priorTurns.slice(-10)) {
      const role = turn?.role;
      const text = turn?.text ?? turn?.content ?? turn?.parts?.[0]?.text;
      if ((role !== 'user' && role !== 'model') || typeof text !== 'string' || !text.trim()) continue;
      if (contents.length === 0 && role === 'model') continue;

      const part = { text: text.slice(0, 1800) };
      const previous = contents.at(-1);
      if (previous && previous.role === role) previous.parts?.push(part);
      else contents.push({ role, parts: [part] });
    }
  }

  const latestParts = [
    ...(!hasExplicitUrls && archive ? [{ text: `[OKUR İLGİ PROFİLİ, 12 KATEGORİ, ŞİİR VE MÜFREDAT BAĞLAMI]:\n${archive.slice(0, 6500)}` }] : []),
    ...(!hasExplicitUrls && googleBooksContext ? [{ text: `[GOOGLE BOOKS VERİTABANI ARAMA SONUÇLARI]:\n${googleBooksContext.slice(0, 2000)}` }] : []),
    { text: trimmedMessage },
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
        ? { thinkingLevel: mode === 'balanced' ? ThinkingLevel.LOW : ThinkingLevel.MEDIUM }
        : undefined;

      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: `${SYSTEM_INSTRUCTION}\n\n${MODE_INSTRUCTIONS[mode]}`,
            httpOptions: { timeout: 35000, retryOptions: { attempts: 1 } },
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
        if (hasExplicitUrls) continue;
        // On 504/deadline timeout for this model, move directly to the next faster model instead of repeating a timed-out call
        if (isDeadlineOrTimeoutError(searchToolError)) {
          continue;
        }

        try {
          const directThinkingConfig = model === 'gemini-4-hydrogen'
            ? { thinkingLevel: ThinkingLevel.LOW }
            : undefined;
          const directResponse = await ai.models.generateContent({
            model,
            contents,
            config: {
              systemInstruction: `${SYSTEM_INSTRUCTION}\n\n${MODE_INSTRUCTIONS[mode]}`,
              httpOptions: { timeout: 25000, retryOptions: { attempts: 1 } },
              ...(directThinkingConfig ? { thinkingConfig: directThinkingConfig } : {}),
            },
          });
          const directReply = directResponse.text?.trim();
          if (directReply) {
            return { reply: directReply, model, isFallback: false };
          }
        } catch {
          // Move cleanly to next model or encyclopedic brain fallback
        }
      }
    }
  }

  if (hasExplicitUrls) {
    return { reply: 'Bu bağlantının içeriğini doğrudan doğrulayamadım. İncelememi istediğin pasajı buraya yazıp Derin tahlil seçeneğinde birlikte çözümleyebiliriz.', isFallback: true };
  }
  return {
    reply: askRobiBrain({
      message: trimmedMessage,
      history: Array.isArray(input.history) ? input.history : undefined,
      densePromptContext: archive,
      userSummary: summary
    }),
    isFallback: true
  };
}
