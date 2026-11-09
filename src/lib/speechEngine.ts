export interface VoicePreset {
  id: string;
  name: string;
  gender: 'male' | 'female';
  tagline: string;
  rate: number;
  pitch: number;
  fallbackPitch: number; // Pitch used when only female/default voice is available in browser
  description: string;
  avatar: string;
  audioPreviewSample?: string;
}

export const VOICE_PRESETS: VoicePreset[] = [
  // 3 ERKEK SESİ
  {
    id: 'ahmet_fenrir',
    name: 'Ahmet (Bilge Tok Erkek Sesi)',
    gender: 'male',
    tagline: 'Hikmetli & Derin Tok Bariton',
    rate: 0.88,
    pitch: 0.85,
    fallbackPitch: 0.58, // Chrome kadın sesini tok ve derin bariton erkek sesine dönüştürür
    description: 'Ağırbaşlı, tok, tefekkür dolu ve derin bilge erkek ses tonu.',
    avatar: '🧔'
  },
  {
    id: 'kerem_puck',
    name: 'Kerem (Radyo Sunucusu Erkek Sesi)',
    gender: 'male',
    tagline: 'Berrak Edebiyat & Roman Anlatıcısı',
    rate: 0.98,
    pitch: 0.92,
    fallbackPitch: 0.68, // Akıcı radyo sunucusu erkek tınısı
    description: 'Tane tane okuyan, akıcı ve kültür-sanat anlatıcısı erkek sesi.',
    avatar: '🎙️'
  },
  {
    id: 'omer_zephyr',
    name: 'Ömer (Dinamik Genç Erkek Sesi)',
    gender: 'male',
    tagline: 'Motivasyon & Dinamik Hasbihal',
    rate: 1.04,
    pitch: 1.00,
    fallbackPitch: 0.78, // Enerjik berrak genç erkek tınısı
    description: 'Okuma hedefleri ve canlı sohbet için enerjik ve berrak genç erkek sesi.',
    avatar: '⚡'
  },

  // 3 KADIN SESİ
  {
    id: 'zeynep_kore',
    name: 'Zeynep (Yumuşak & Berrak Kadın Sesi)',
    gender: 'female',
    tagline: 'Huzurlu, Doğal & Sıcak Kadın Sesi',
    rate: 0.95,
    pitch: 1.05,
    fallbackPitch: 1.05,
    description: 'Kitap okuma ve sohbet için huzur veren, berrak ve doğal kadın sesi.',
    avatar: '🌸'
  },
  {
    id: 'leyla_aoede',
    name: 'Leyla (Zarif & Edebi Kadın Sesi)',
    gender: 'female',
    tagline: 'Edebi & Akıcı Roman Seslendirmesi',
    rate: 0.98,
    pitch: 1.15,
    fallbackPitch: 1.15,
    description: 'Edebiyat tahlilleri ve şiirler için zarif, melodik ve kültürlü kadın sesi.',
    avatar: '📖'
  },
  {
    id: 'elif_talia',
    name: 'Elif (Canlı & Parlak Kadın Sesi)',
    gender: 'female',
    tagline: 'Motivasyon & Parlak Anlatım',
    rate: 1.02,
    pitch: 1.25,
    fallbackPitch: 1.25,
    description: 'Canlı, teşvik edici, modern ve neşeli profesyonel kadın sesi.',
    avatar: '✨'
  }
];

export function getVoicePreset(voiceId: string): VoicePreset {
  if (!voiceId) return VOICE_PRESETS[0];
  if (voiceId === 'ahmet_tok' || voiceId === 'ahmet') return VOICE_PRESETS[0];
  if (voiceId === 'zeynep_yumusak' || voiceId === 'zeynep') return VOICE_PRESETS[3];
  return VOICE_PRESETS.find(p => p.id === voiceId) || VOICE_PRESETS[0];
}

let globalAudio: HTMLAudioElement | null = null;
let activeUtterances: SpeechSynthesisUtterance[] = [];
let speechQueueCancelled = false;

export function stopAllSpeech(): void {
  speechQueueCancelled = true;
  if (globalAudio) {
    try {
      globalAudio.pause();
      globalAudio.currentTime = 0;
    } catch {}
    globalAudio = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
  activeUtterances = [];
}

/**
 * Cihazdaki mevcut sesleri tarayarak seçilen profile (Erkek/Kadın) en uygun sesi ve 
 * doğru akustik pitch/rate değerini hesaplar. 
 * Tarayıcıda sadece kadın sesi varsa (örn. Chrome Google Türkçe), erkek seçildiğinde 
 * pitch değerini derin erkek formanta indirir (0.58 - 0.78), böylece asla kadın sesi duyulmaz!
 */
export function selectBestVoiceForPreset(
  voices: SpeechSynthesisVoice[],
  preset: VoicePreset
): { voice?: SpeechSynthesisVoice; pitch: number; rate: number } {
  if (!voices || voices.length === 0) {
    return { pitch: preset.pitch, rate: preset.rate };
  }

  const trVoices = voices.filter(v => {
    const l = (v.lang || '').toLowerCase();
    return l.startsWith('tr') || l.includes('tr');
  });

  const candidates = trVoices.length > 0 ? trVoices : voices;

  if (preset.gender === 'male') {
    // 1. Gerçek yerel erkek sesi ara (Windows Tolga/Ahmet, Mac Cem, Samsung TTS tr-tr-x-dfg/efg vb.)
    const authenticMale = candidates.find(v => {
      const n = (v.name || '').toLowerCase();
      const uri = (v.voiceURI || '').toLowerCase();
      return (
        n.includes('male') || n.includes('erkek') || n.includes('ahmet') || 
        n.includes('tolga') || n.includes('cem') || n.includes('murat') ||
        n.includes('dfg') || n.includes('efg') || uri.includes('male') ||
        uri.includes('tolga') || uri.includes('cem') || uri.includes('dfg')
      );
    });

    if (authenticMale) {
      return {
        voice: authenticMale,
        pitch: preset.pitch,
        rate: preset.rate
      };
    }

    // 2. Tarayıcıda yerel erkek sesi yoksa (örn. Chrome varsayılan Google Türkçe kadın sesi)
    // Mevcut Türkçe sesi alıp pitch'ini derin erkek formanta (0.58-0.78) çekiyoruz
    const defaultTr = candidates.find(v => (v.lang || '').toLowerCase().startsWith('tr')) || candidates[0];
    return {
      voice: defaultTr,
      pitch: preset.fallbackPitch, // Erkek sesi için özel akustik derinlik
      rate: preset.rate
    };
  } else {
    // Kadın sesi için
    const authenticFemale = candidates.find(v => {
      const n = (v.name || '').toLowerCase();
      const uri = (v.voiceURI || '').toLowerCase();
      return (
        n.includes('female') || n.includes('kadın') || n.includes('emel') || 
        n.includes('yelda') || n.includes('seda') || n.includes('filiz') ||
        n.includes('google') || uri.includes('female') || uri.includes('cfg') ||
        uri.includes('emel') || uri.includes('yelda') || uri.includes('google')
      );
    });

    const chosenVoice = authenticFemale || candidates[0];
    return {
      voice: chosenVoice,
      pitch: preset.pitch,
      rate: preset.rate
    };
  }
}

/**
 * Seçilen ses profiliyle metni seslendirir.
 * 1. Önce sunucu nöral TTS sesini dener.
 * 2. Kota veya gecikme durumunda anında optimize edilmiş yerel Web Speech API motorunu devreye sokar.
 */
export async function speakVoiceText(
  text: string,
  voiceId: string,
  options?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: any) => void;
  }
): Promise<void> {
  stopAllSpeech();
  speechQueueCancelled = false;

  const preset = getVoicePreset(voiceId);
  const cleanText = text.trim();
  if (!cleanText) return;

  // 1. Nöral TTS (Varsa veya önbellekteyse stüdyo kalitesinde gerçek ses)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        text: cleanText.substring(0, 320),
        voiceId: preset.id
      })
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data && data.audioUrl && !speechQueueCancelled) {
        const audio = new Audio(data.audioUrl);
        globalAudio = audio;
        
        audio.onplay = () => {
          if (!speechQueueCancelled) options?.onStart?.();
        };
        audio.onended = () => {
          globalAudio = null;
          if (!speechQueueCancelled) options?.onEnd?.();
        };
        audio.onerror = () => {
          globalAudio = null;
          fallbackToBrowserSpeech(cleanText, preset, options);
        };

        await audio.play();
        return;
      }
    }
  } catch {
    // Hızlı geçiş: Kota bittiyse veya ağ gecikirse yerel motora geç
  }

  // 2. Güçlendirilmiş Akustik Tarayıcı Web Speech API Fallback
  if (!speechQueueCancelled) {
    fallbackToBrowserSpeech(cleanText, preset, options);
  }
}

/**
 * Metni cümlelere ayırarak Android ve Chrome'da sesin yarıda kesilmesini önleyen ve
 * seçilen erkek/kadın kimliğine sadık kalan yerel seslendirme
 */
function fallbackToBrowserSpeech(
  text: string,
  preset: VoicePreset,
  options?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: any) => void;
  }
) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    options?.onError?.(new Error('Web Speech API desteklenmiyor'));
    return;
  }

  try {
    window.speechSynthesis.cancel();
    speechQueueCancelled = false;

    // Uzun metinleri doğal cümlelere böl (Chrome 15 saniye zaman aşımını engeller)
    const rawSentences = text
      .replace(/([.?!;:])\s+/g, '$1|')
      .split('|')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const sentences = rawSentences.length > 0 ? rawSentences : [text];
    const voices = window.speechSynthesis.getVoices();
    const voiceConfig = selectBestVoiceForPreset(voices, preset);

    let currentIndex = 0;
    let hasStarted = false;

    const speakNext = () => {
      if (speechQueueCancelled) return;
      if (currentIndex >= sentences.length) {
        options?.onEnd?.();
        return;
      }

      const sentenceText = sentences[currentIndex];
      const utterance = new SpeechSynthesisUtterance(sentenceText);
      activeUtterances = [utterance];

      if (voiceConfig.voice) {
        utterance.voice = voiceConfig.voice;
      }
      utterance.lang = 'tr-TR';
      utterance.rate = voiceConfig.rate;
      utterance.pitch = voiceConfig.pitch;

      utterance.onstart = () => {
        if (!hasStarted) {
          hasStarted = true;
          options?.onStart?.();
        }
      };

      utterance.onend = () => {
        currentIndex++;
        speakNext();
      };

      utterance.onerror = (e) => {
        // Eğer kullanıcı kendisi durdurmadıysa hatayı ilet
        if (!speechQueueCancelled) {
          currentIndex++;
          if (currentIndex < sentences.length) {
            speakNext();
          } else {
            options?.onEnd?.();
          }
        }
      };

      window.speechSynthesis.speak(utterance);
    };

    speakNext();

  } catch (err) {
    options?.onError?.(err);
  }
}
