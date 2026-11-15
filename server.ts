import 'dotenv/config';
import express from 'express';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import fs from 'fs';
import path from 'path';
import webpush from 'web-push';
import { askRobiBrain } from './src/utils/robiBrain.ts';
import { generateRobiChat, normalizeRobiMode } from './src/utils/robiChat.ts';

// WebPush VAPID Setup for Background Notifications (delivers even when app is closed)
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BB91Tt47oG2rr99hCjR0-nSCVHnDio1XzwIvZqd5bem2W6lQndUzw-uvYVH3pdClkjKwcdVyjNcTv6bV3EOIUnQ';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'YYzK4YS7qFTurd6jZdFy49QNznecyzOduk7YeXlAIhs';
const VAPID_EMAIL = 'mailto:ahmedkadiri99@gmail.com';

try {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (vapidErr) {
  console.warn('VAPID setup warning:', vapidErr);
}

// Subscriptions storage file
const SUBSCRIPTIONS_FILE = path.join(process.cwd(), 'push_subscriptions.json');

interface StoredPushSub {
  endpoint: string;
  subscription: webpush.PushSubscription;
  reminderTimes: string[];
  lastNotifiedSlot?: string;
  updatedAt: string;
}

let pushSubscriptions: StoredPushSub[] = [];

function loadPushSubscriptions() {
  try {
    if (fs.existsSync(SUBSCRIPTIONS_FILE)) {
      const data = fs.readFileSync(SUBSCRIPTIONS_FILE, 'utf-8');
      pushSubscriptions = JSON.parse(data);
    }
  } catch (err) {
    pushSubscriptions = [];
  }
}

function savePushSubscriptions() {
  try {
    fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(pushSubscriptions, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Push subscriptions write error:', err);
  }
}

loadPushSubscriptions();

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Helper to dynamically get GoogleGenAI client with latest environment variables
  function getGenAI() {
    const key = process.env.GEMINI_API_KEY || '';
    return new GoogleGenAI({ 
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }

  app.get('/api/health', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json({ status: 'ok', hasApiKey: !!(process.env.GEMINI_API_KEY || '') });
  });

  app.get('/api/test-gemini', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    const key = process.env.GEMINI_API_KEY || '';
    const ai = getGenAI();
    const results: any[] = [];
    for (const m of ['gemini-4-hydrogen', 'gemini-3.1-flash-lite']) {
      try {
        const r = await ai.models.generateContent({ model: m, contents: 'Merhaba, bana 1 cümle ile Gazaliyi anlat.' });
        results.push({ model: m, status: 'ok', text: r.text });
      } catch (err: any) {
        results.push({ model: m, status: 'error', code: err?.status, message: err?.message });
      }
    }
    res.json({ keyLength: key.length, results });
  });

  // CORS-Safe Image Proxy for Story Card HTML5 Canvas rendering & PDF covers
  app.get('/api/proxy-image', async (req, res) => {
    try {
      const rawUrl = req.query.url;
      if (!rawUrl || typeof rawUrl !== 'string') {
        return res.status(400).send('Image URL required');
      }

      // Only allow http/https
      if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
        return res.status(400).send('Invalid image URL protocol');
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const upstream = await fetch(rawUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      clearTimeout(timeout);

      if (!upstream.ok) {
        return res.status(upstream.status).send('Upstream image error');
      }

      const contentType = upstream.headers.get('content-type') || 'image/jpeg';
      const buffer = await upstream.arrayBuffer();

      res.setHeader('Content-Type', contentType);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
      res.send(Buffer.from(buffer));
    } catch (err: any) {
      console.warn('Proxy image error:', err?.message || err);
      // Return a 1x1 transparent GIF fallback so images don't break UI
      const transparentPixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      res.setHeader('Content-Type', 'image/gif');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(transparentPixel);
    }
  });

  // In-memory audio cache for TTS to prevent quota/rate-limit errors on sample previews and repeated texts
  const ttsCache = new Map<string, string>();

  // Gemini 3.8 Studio-Quality Authentic Speech Audio Generation Endpoint
  app.post('/api/tts', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const text = (req.body?.text || '').trim();
      const voiceId = req.body?.voiceId || 'ahmet_tok';

      if (!text) {
        return res.status(400).json({ error: 'Seslendirilecek metin bulunamadı.' });
      }

      const cleanText = text.substring(0, 350);
      const cacheKey = `${voiceId}_${cleanText}`;

      if (ttsCache.has(cacheKey)) {
        return res.json({
          audioUrl: ttsCache.get(cacheKey),
          cached: true
        });
      }

      // Map voiceId to Gemini 3.8 Speech prebuiltVoiceConfig (3 Erkek & 3 Kadın)
      let voiceName = 'Fenrir'; // Default Ahmet (Bariton Erkek)
      let stylePrompt = 'Deep, wise, calm, articulate Turkish male scholar speaking with warm cadence';

      if (voiceId === 'kerem_puck') {
        voiceName = 'Puck';
        stylePrompt = 'Clear, articulate, engaging Turkish radio presenter male narrator';
      } else if (voiceId === 'omer_zephyr') {
        voiceName = 'Zephyr';
        stylePrompt = 'Energetic, cheerful, bright young Turkish male speaker';
      } else if (voiceId === 'zeynep_kore' || voiceId === 'zeynep_yumusak') {
        voiceName = 'Kore';
        stylePrompt = 'Soft, clear, gentle, warm Turkish female narrator';
      } else if (voiceId === 'leyla_aoede') {
        voiceName = 'Aoede';
        stylePrompt = 'Expressive, elegant, literary Turkish female speaker with melodic tone';
      } else if (voiceId === 'elif_talia') {
        voiceName = 'Leda';
        stylePrompt = 'Bright, professional, encouraging, and vibrant Turkish female speaker';
      } else if (voiceId === 'ahmet_fenrir' || voiceId === 'ahmet_tok') {
        voiceName = 'Fenrir';
        stylePrompt = 'Deep, wise, calm, articulate Turkish male scholar speaking with warm cadence';
      }

      const currentAi = getGenAI();
      const response = await currentAi.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: cleanText,
                speechMetadata: {
                  style: stylePrompt
                }
              }
            ]
          }
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName }
            }
          }
        }
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioUrl = `data:audio/wav;base64,${base64Audio}`;
        // Store in cache (limit cache size to 100 entries)
        if (ttsCache.size > 100) {
          const firstKey = ttsCache.keys().next().value;
          if (firstKey) ttsCache.delete(firstKey);
        }
        ttsCache.set(cacheKey, audioUrl);

        return res.json({ audioUrl });
      }

      throw new Error('Gemini TTS audio data is empty');
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.warn('Gemini 3.8 TTS Note:', errMsg.substring(0, 150));
      return res.status(500).json({ error: errMsg, fallback: true });
    }
  });

  // VAPID Public Key endpoint for client subscription
  app.get('/api/push-public-key', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json({ publicKey: VAPID_PUBLIC_KEY });
  });

  // Save/Update Web Push Subscription with preferred reminder times and user timezone
  app.post('/api/save-subscription', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    const { subscription, reminderTimes, timeZone } = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Geçersiz abonelik bilgisi.' });
    }

    const existingIndex = pushSubscriptions.findIndex(s => s.endpoint.trim() === subscription.endpoint.trim());
    const validTimes = Array.isArray(reminderTimes) && reminderTimes.length > 0 
      ? reminderTimes 
      : ['08:30', '14:00', '21:30'];

    const updatedRecord: StoredPushSub = {
      endpoint: subscription.endpoint.trim(),
      subscription,
      reminderTimes: validTimes,
      updatedAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      pushSubscriptions[existingIndex] = {
        ...pushSubscriptions[existingIndex],
        ...updatedRecord
      };
    } else {
      pushSubscriptions.push(updatedRecord);
    }

    savePushSubscriptions();
    console.log(`[Push Subscription Saved] Total registered devices: ${pushSubscriptions.length}, Reminder times:`, validTimes);
    res.json({ success: true, totalSubscribers: pushSubscriptions.length });
  });

  // Immediate Test Push Notification from Server to Device (Delivers even when app is closed)
  app.post('/api/send-test-push', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    const { subscription } = req.body;
    const targetSubs: webpush.PushSubscription[] = [];

    if (subscription && subscription.endpoint) {
      targetSubs.push(subscription);
    } else if (pushSubscriptions.length > 0) {
      pushSubscriptions.forEach(s => targetSubs.push(s.subscription));
    }

    if (targetSubs.length === 0) {
      return res.status(400).json({ error: 'Kayıtlı telefon/cihaz aboneliği bulunamadı. Lütfen önce bildirim iznini onaylayın.' });
    }

    const payload = JSON.stringify({
      title: '📖 Dijital Kütüphanem: Okuma Vakti',
      body: 'Harika! Telefonunuz ve uygulama kapalıyken bile bu bildirim doğrudan kilit ekranınıza ulaşır.',
      url: '/?tab=today',
      tag: `test-push-${Date.now()}`
    });

    const pushOptions = {
      TTL: 86400,
      urgency: 'high' as const
    };

    let sentCount = 0;
    const errors: string[] = [];

    for (const sub of targetSubs) {
      try {
        await webpush.sendNotification(sub, payload, pushOptions);
        sentCount++;
      } catch (pushErr: any) {
        console.warn('Test push send error:', pushErr?.statusCode || pushErr?.message);
        errors.push(pushErr?.message || 'Push delivery failed');
      }
    }

    console.log(`[Test Push Sent] Successfully dispatched to ${sentCount}/${targetSubs.length} device(s)`);
    res.json({ success: sentCount > 0, sentCount, errors: errors.length > 0 ? errors : undefined });
  });

  // Native Android Widget Data Endpoint
  app.get('/api/widget-data', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json({
      bookPercent: 82,
      todayPages: 33,
      dailyTarget: 40,
      hatimPercent: 23,
      currentHizb: 14,
      ilimPercent: 4.2,
      completedBooks: 6,
      curriculumTotal: 1920,
      updatedAt: new Date().toISOString()
    });
  });

  // Intelligent Dynamic Brain Engine: Uses RAG context & encyclopedic knowledge base
  function generateDynamicRobiFallback(message: string, context: any, denseContext?: string, history?: any[]): string {
    return askRobiBrain({
      message,
      history,
      densePromptContext: denseContext,
      userSummary: context
    });
  }

  // Helper hash function for deterministic variation based on prompt text
  function hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  async function fetchGoogleBooksContext(queryText: string): Promise<string> {
    const cleanQ = (queryText || '').trim().slice(0, 120);
    if (!cleanQ) return '';
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(cleanQ)}&maxResults=5&printType=books`;
      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!resp.ok) return '';
      const json: any = await resp.json();
      const items = Array.isArray(json?.items) ? json.items : [];
      if (items.length === 0) return '';
      return items
        .map((it: any) => {
          const v = it?.volumeInfo || {};
          const title = v.title || '';
          const authors = Array.isArray(v.authors) ? v.authors.join(', ') : '';
          const desc = typeof v.description === 'string' ? v.description.slice(0, 160) : '';
          return `• ${title}${authors ? ` (${authors})` : ''}${desc ? ` — ${desc}` : ''}`;
        })
        .filter(Boolean)
        .join('\n');
    } catch {
      return '';
    }
  }

  function safeParseJsonObject(raw: string): any {
    const cleaned = (raw || '')
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```$/i, '')
      .trim();
    return JSON.parse(cleaned);
  }

  // Smart AI Book Recommendations based on reader's interests, chat history, and quotations
  app.post('/api/ai-recommendations', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const { currentBooks, preferredCategory, mood, dailyTarget, chatTopics, userQuotations } = req.body;
      const currentApiKey = process.env.GEMINI_API_KEY || '';
      if (!currentApiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY bulunamadı.' });
      }

      const prompt = `Sen entelektüel, edebi ve felsefi bir okuma danışmanısın. Kullanıcının düşünce ve ilgi profili:
- Kütüphane ve ilgi eksenindeki eser temaları: ${JSON.stringify((currentBooks || []).map((b: any) => ({ title: b.title, author: b.author, category: b.category })))}
- Yapay zeka (Robi) ile sohbetlerinde tartıştığı konular ve ilgilendiği kavramlar: ${JSON.stringify(chatTopics || [])}
- Kaydettiği favori alıntılar / şiirler: ${JSON.stringify(userQuotations || [])}
- Seçilen odak kategori: ${preferredCategory || 'Tüm Alanlar'}
- Okuma gayesi: ${mood || 'Derinleşme, tefekkür, entelektüel ufkunu genişletme'}
- Günlük hedef temposu: ${dailyTarget || 40} sayfa

ÖNEMLİ KURAL: "curatorNote" ve "reason" metinlerinde ASLA kullanıcının şu an hangi kitabı okuduğunu, sayfa sayısını veya okuma yüzdesini zikretme. Bunlardan ilham alarak Türkiye ve dünya edebiyatı, İslam felsefesi, tefekkür, tarih, tasavvuf, şiir ve psikoloji klasikleri arasından TAM 6 ADET son derece kişiselleştirilmiş "Akıllı Kitap Önerisi" sun.

Yanıtını MUTLAKA sadece aşağıdaki JSON formatında ver (ekstra açıklama veya markdown tırnakları eklemeden doğrudan geçerli bir JSON objesi döndür):
{
  "curatorNote": "Okurun düşünce dünyasına, ilgi duyduğu temalara ve sohbet konularına hitap eden, okuma ilerlemesini ifşa etmeyen zarif 1-2 cümlelik tavsiye notu.",
  "recommendations": [
    {
      "title": "Kitap Adı",
      "author": "Yazar Adı",
      "category": "Edebiyat / Felsefe / Tarih / Din ve İlahiyat / Psikoloji / Şiir",
      "totalPages": 280,
      "reason": "Bu kitabın okurun fikir ve şiir dünyasıyla nasıl bağlantılı olduğunu açıklayan çarpıcı, akıcı gerekçe.",
      "estimatedDays": 7,
      "tag": "Klasik / Ufuk Açıcı / Derin Tefekkür / Başyapıt"
    }
  ]
}`;

      const modelsToTry = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'];
      let resultText = '';
      let lastErr = null;
      const currentAi = getGenAI();

      for (const m of modelsToTry) {
        try {
          const apiCall = currentAi.models.generateContent({
            model: m,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              httpOptions: { timeout: 25000, retryOptions: { attempts: 1 } },
              ...(m === 'gemini-4-hydrogen' ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {})
            }
          });
          const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 25000));
          const resp = await Promise.race([apiCall, timeoutPromise]);
          if (resp && (resp as any).text) {
            resultText = (resp as any).text;
            break;
          }
        } catch (e: any) {
          lastErr = e;
        }
      }

      if (!resultText) {
        throw lastErr || new Error("Öneri üretilemedi.");
      }

      const parsed = safeParseJsonObject(resultText);
      return res.json(parsed);
    } catch (err: any) {
      const curatedList = [
        {
          title: "İhyâ'u Ulûmi'd-Dîn (1. Cilt: İlim ve Kalp)",
          author: "İmâm-ı Gazâlî",
          category: "Din ve İlahiyat",
          totalPages: 480,
          reason: "İbadet ve ahlakın manevi boyutunu ele alan, kalbi tezkiye eden ölümsüz bir başyapıt.",
          estimatedDays: 12,
          tag: "Temel Başyapıt"
        },
        {
          title: "Doğu ve Batı Arasında İslam",
          author: "Aliya İzzetbegoviç",
          category: "Felsefe",
          totalPages: 380,
          reason: "Madde ve mana dengesinde 20. yüzyılın en derin tefekkür ve medeniyet tahlili.",
          estimatedDays: 9,
          tag: "Ufuk Açıcı"
        },
        {
          title: "Saatleri Ayarlama Enstitüsü",
          author: "Ahmet Hamdi Tanpınar",
          category: "Edebiyat",
          totalPages: 382,
          reason: "Zaman, insan psikolojisi ve modernleşme sancılarını işleyen Türk edebiyatı zirvesi.",
          estimatedDays: 10,
          tag: "Edebiyat Klasiği"
        },
        {
          title: "İnsanın Anlam Arayışı",
          author: "Viktor E. Frankl",
          category: "Psikoloji",
          totalPages: 168,
          reason: "Zorluklar karşısında insanın içsel anlam ve irade gücünü anlatan klasik rehber.",
          estimatedDays: 4,
          tag: "Ruh & İrade"
        }
      ];

      return res.json({
        curatorNote: "İlgi alanlarınıza ve düşünce ufkunuza göre özenle seçilmiş klasik eserler:",
        recommendations: curatedList
      });
    }
  });

  app.post('/api/ai-chat', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const { message, mode, history, userContext, densePromptContext, userSummary } = req.body;
      const normalizedMode = normalizeRobiMode(mode);
      const archive = densePromptContext || (typeof userContext === 'string' ? userContext : JSON.stringify(userContext || {}));
      const currentApiKey = process.env.GEMINI_API_KEY || '';
      const currentAi = currentApiKey ? getGenAI() : undefined;

      // Enrich with Google Books live lookup only when the user query involves books, literature, authors, or reading suggestions
      const msgStr = String(message || '');
      const shouldFetchBooks =
        normalizedMode !== 'source' &&
        /\b(kitap|eser|yazar|roman|şair|siir|şiir|okuma|müfredat|mufredat|liste|tavsiye|öner|oner|baskı|baski|yayın|yayin|cilt|tercüme|tercume|çeviri|ceviri)\b/i.test(msgStr);
      const googleBooksContext = shouldFetchBooks
        ? await fetchGoogleBooksContext(msgStr)
        : '';

      const result = await generateRobiChat(currentAi, {
        message: String(message || ''),
        mode: normalizedMode,
        history,
        archive,
        googleBooksContext,
        summary: userContext || userSummary
      });

      return res.json(result);
    } catch (err: any) {
      console.warn("AI Chat Error intercepted:", err?.message || err);
      const dynamicReply = generateDynamicRobiFallback(
        req.body?.message,
        req.body?.userContext || req.body?.userSummary,
        req.body?.densePromptContext,
        req.body?.history
      );
      return res.json({ reply: dynamicReply, isFallback: true });
    }
  });

  // AI Chapter & Page Progress Analysis Endpoint
  app.post('/api/chapter-analysis', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const title = req.body?.title || 'Okunan Eser';
      const author = req.body?.author || 'Değerli Yazar';
      const category = req.body?.category || 'Edebiyat ve Tefekkür';
      const description = req.body?.description || '';
      const currentPage = Number(req.body?.currentPage) || 1;
      const totalPages = Number(req.body?.totalPages) || 200;
      const userNotes = req.body?.userNotes || '';

      const progPercent = Math.round((currentPage / Math.max(1, totalPages)) * 100);

      const prompt = `Sen yüksek derecede entelektüel, felsefi ve edebi derinliğe sahip doçent seviyesinde bir kitap ve medeniyet tahlilcisisin.
İncelenen eser bilgileri:
- Eser Adı: ${title}
- Yazar: ${author}
- Ana Kategori: ${category || 'Edebiyat ve Tefekkür'}
- Eser Özeti/Konusu: ${description || 'Eser konuları'}
- İncelenen Konum: Sayfa ${currentPage || 1} / ${totalPages || 200} (%${progPercent})
${userNotes ? `- Not/Alıntı: "${userNotes}"` : ''}

Lütfen bu aşamaya dair derinlikli, edebi ve felsefi bir "Bölüm & İlerleme Analizi" hazırla.
Çıktıyı kesinlikle geçerli bir JSON nesnesi olarak döndür:
{
  "sectionTitle": "Bölümün Temel Felsefi & Edebi Aksı",
  "keyThemes": ["Tema 1", "Tema 2", "Tema 3"],
  "literaryAnalysis": "Anlam bütünlüğü güçlü 2-3 paragraflık entelektüel değerlendirme...",
  "reflectionQuestion": "Derin tefekkür sorusu",
  "recommendedParallelReads": ["Paralel Eser 1 (Yazar)", "Paralel Eser 2 (Yazar)"]
}`;

      const modelsToTry = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'];
      let resultText = '';
      const currentAi = getGenAI();

      for (const m of modelsToTry) {
        try {
          const apiCall = currentAi.models.generateContent({
            model: m,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              httpOptions: { timeout: 25000, retryOptions: { attempts: 1 } },
              ...(m === 'gemini-4-hydrogen' ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {})
            }
          });
          
          const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 25000));
          const resp = await Promise.race([apiCall, timeoutPromise]);

          if (resp && (resp as any).text) {
            resultText = (resp as any).text;
            break;
          }
        } catch (e) {
          // try next model
        }
      }

      if (resultText) {
        const parsed = safeParseJsonObject(resultText);
        return res.json(parsed);
      }

      return res.json({
        sectionTitle: `"${title}" — Sayfa ${currentPage} Felsefi & Edebi Tahlili`,
        keyThemes: [category || "Edebi Derinlik", "İnsan ve Zaman", "Felsefi Tefekkür"],
        literaryAnalysis: `"${title}" eserinin ${currentPage}. sayfadaki bu aşaması, ${author}'ın üslubundaki edebi katmanları ve felsefi arka planı görünür kılar. Yazar bu bölümde karakterlerin içsel derinliklerini ve dönemin zihniyet çatışmalarını incelikle açığa çıkarmaktadır.\n\nEserin bu evresi, okurun kendi hayat tecrübeleriyle metin arasında hikmetli bir düşünce köprüsü inşa eder.`,
        reflectionQuestion: `Yazarın bu bölümdeki ana düşüncesi zihninizde nasıl bir tefekkür ve ilham kapısı açıyor?`,
        recommendedParallelReads: [
          `Saatleri Ayarlama Enstitüsü (Ahmet Hamdi Tanpınar)`,
          `İhyâ'u Ulûmi'd-Dîn (İmâm-ı Gazâlî)`,
          `Doğu ve Batı Arasında İslam (Aliya İzzetbegoviç)`
        ]
      });
    } catch (err) {
      return res.json({
        sectionTitle: "Bölüm & İlerleme Analizi",
        keyThemes: ["Edebi Derinlik", "Zaman ve Varlık", "Anlam Arayışı"],
        literaryAnalysis: "Eserin bu bölümü, okurun metinle kurduğu zihinsel diyaloğu derinleştiren felsefi bir dönüm noktasıdır.",
        reflectionQuestion: "Bu bölümde karşılaştığınız fikirler zihninizde nasıl bir yankı uyandırıyor?",
        recommendedParallelReads: ["Doğu ve Batı Arasında İslam (Aliya İzzetbegoviç)"]
      });
    }
  });

  // Handle production build vs dev Vite middleware
  const distPath = path.join(process.cwd(), 'dist');
  const hasDist = fs.existsSync(distPath) && fs.existsSync(path.join(distPath, 'index.html'));

  if (hasDist) {
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          const base = path.basename(filePath);
          if (
            base === 'index.html' ||
            base === 'sw.js' ||
            base === 'notifications-sw.js' ||
            base === 'manifest.webmanifest' ||
            base.startsWith('workbox-')
          ) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
          } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
          }
        },
      })
    );
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // 24/7 Cloud Background Reminder Scheduler
  // Triggers Web Push to user devices at their scheduled time, even when phone screen and app are completely closed!
  const reminderTimer = setInterval(async () => {
    try {
      if (pushSubscriptions.length === 0) return;

      const now = new Date();
      let modified = false;

      // Current time in Turkey (Europe/Istanbul)
      const trDateStr = now.toLocaleString('en-US', { timeZone: 'Europe/Istanbul' });
      const istanbulDate = new Date(trDateStr);
      const trHours = String(istanbulDate.getHours()).padStart(2, '0');
      const trMinutes = String(istanbulDate.getMinutes()).padStart(2, '0');
      const trCurrentTime = `${trHours}:${trMinutes}`;

      const year = istanbulDate.getFullYear();
      const month = String(istanbulDate.getMonth() + 1).padStart(2, '0');
      const day = String(istanbulDate.getDate()).padStart(2, '0');
      const currentSlot = `${year}-${month}-${day}_${trCurrentTime}`;

      for (let i = pushSubscriptions.length - 1; i >= 0; i--) {
        const item = pushSubscriptions[i];
        if (!item.reminderTimes || !Array.isArray(item.reminderTimes) || item.reminderTimes.length === 0) continue;

        if (item.reminderTimes.includes(trCurrentTime)) {
          if (item.lastNotifiedSlot !== currentSlot) {
            item.lastNotifiedSlot = currentSlot;
            modified = true;

            const payload = JSON.stringify({
              title: '📖 Dijital Kütüphanem: Okuma Vakti',
              body: `Günün tefekkür ve sayfa hedefini tamamlama vakti (${trCurrentTime})! Eserinizi açın.`,
              url: '/?tab=today',
              tag: `reminder-${currentSlot}`
            });

            const pushOptions = {
              TTL: 86400,
              urgency: 'high' as const
            };

            try {
              await webpush.sendNotification(item.subscription, payload, pushOptions);
              console.log(`[Scheduled Push Sent] Dispatched to ${item.endpoint.substring(0, 35)}... at ${trCurrentTime}`);
            } catch (err: any) {
              console.warn('[Scheduled Push Failed]:', err?.statusCode || err?.message);
              if (err?.statusCode === 410 || err?.statusCode === 404) {
                pushSubscriptions.splice(i, 1);
                modified = true;
              }
            }
          }
        }
      }

      if (modified) {
        savePushSubscriptions();
      }
    } catch (schedErr) {
      console.warn('Background reminder check warning:', schedErr);
    }
  }, 30000);

  // Open HTTP port immediately so Cloud Run startup health checks pass without waiting for Vite
  let viteMiddleware: any = null;
  if (!hasDist) {
    app.use((req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      if (viteMiddleware) {
        return viteMiddleware(req, res, next);
      }
      res.status(503).set('Retry-After', '1').send('Yükleniyor...');
    });
  }

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${port}`);
  });

  if (!hasDist) {
    (async () => {
      try {
        const { createServer: createViteServer } = await import('vite');
        const vite = await createViteServer({
          server: {
            middlewareMode: true,
            allowedHosts: true,
            hmr: false
          },
          appType: 'spa'
        });
        viteMiddleware = vite.middlewares;
      } catch (viteErr) {
        console.warn("Vite middleware load warning:", viteErr);
      }
    })();
  }

  const shutdown = () => {
    clearInterval(reminderTimer);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer();
