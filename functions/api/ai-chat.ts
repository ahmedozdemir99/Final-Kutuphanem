interface Env { GEMINI_API_KEY?: string }

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });

  if (!env.GEMINI_API_KEY) return json({ error: 'Yapay zekâ API anahtarı Cloudflare ortamında ayarlanmamış. GEMINI_API_KEY değişkenini ekleyin.' }, 503);

  let body: { message?: string; history?: Array<{ role?: string; parts?: Array<{ text?: string }> }>; densePromptContext?: string };
  try { body = await request.json(); } catch { return json({ error: 'Geçersiz istek.' }, 400); }
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 5000) : '';
  if (!message) return json({ error: 'Lütfen bir mesaj yazın.' }, 400);
  const context = typeof body.densePromptContext === 'string' ? body.densePromptContext.slice(0, 18000) : '';
  const history = Array.isArray(body.history) ? body.history.slice(-12).map(item => ({
    role: item.role === 'model' ? 'model' : 'user',
    parts: [{ text: String(item.parts?.[0]?.text || '').slice(0, 4000) }]
  })).filter(item => item.parts[0].text) : [];
  // The client already includes the current message in history.
  const contents = history.length ? history : [{ role: 'user', parts: [{ text: message }] }];
  if (contents[contents.length - 1]?.role !== 'user' || contents[contents.length - 1]?.parts?.[0]?.text !== message) {
    contents.push({ role: 'user', parts: [{ text: message }] });
  }
  try {
    const payload = JSON.stringify({
      systemInstruction: { parts: [{ text: 'Sen Final-Kütüphanem uygulamasındaki Türkçe konuşan, nazik ve bilgili okuma arkadaşı Robi’sin. Kullanıcının sorusunu doğrudan cevapla. Kişisel kütüphane verilerini gereksiz yere tekrarlama. İlgili kütüphane bağlamı:\\n' + context }] },
      contents,
      generationConfig: { maxOutputTokens: 1400, temperature: 0.7 }
    });
    // Discover models actually available to this key instead of guessing model IDs.
    const discovery = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=100', {
      headers: { 'x-goog-api-key': env.GEMINI_API_KEY! }
    });
    const discovered: any = await discovery.json().catch(() => null);
    if (!discovery.ok) {
      console.error('Gemini model discovery failed', discovery.status, discovered?.error?.status);
      return json({ error: 'Gemini model listesi alınamadı (' + discovery.status + '). Google API durumu: ' + String(discovered?.error?.status || 'bilinmiyor') + '.' }, 502);
    }
    const models: string[] = (Array.isArray(discovered?.models) ? discovered.models : [])
      .filter((item: any) => Array.isArray(item.supportedGenerationMethods) && item.supportedGenerationMethods.includes('generateContent'))
      .map((item: any) => String(item.name || '').replace(/^models\\//, ''))
      .filter((name: string) => name.startsWith('gemini-') && !name.includes('embedding') && !name.includes('image') && !name.includes('tts'))
      .sort((a: string, b: string) => {
        const rank = (name: string) => name.includes('flash-lite') ? 0 : name.includes('flash') ? 1 : 2;
        return rank(a) - rank(b);
      }).slice(0, 5);
    if (!models.length) return json({ error: 'Bu Google API anahtarı için generateContent destekleyen Gemini modeli listelenmiyor. Generative Language API erişimini kontrol edin.' }, 502);
    for (const model of models) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      let upstream: Response;
      try {
        upstream = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY! },
          body: payload,
          signal: controller.signal
        });
      } finally { clearTimeout(timeout); }
      const result: any = await upstream.json().catch(() => null);
      if (upstream.status === 404) {
        console.warn('Gemini model unavailable:', model);
        continue;
      }
      if (!upstream.ok) {
        console.error('Gemini request failed', upstream.status, result?.error?.status);
        const reason = upstream.status === 429
          ? 'Yapay zekâ kullanım sınırına ulaşıldı. Biraz sonra tekrar deneyin.'
          : upstream.status === 403 || upstream.status === 401
            ? 'Gemini API anahtarının erişim yetkisi reddedildi (' + upstream.status + ').'
            : 'Yapay zekâ hizmeti yanıt veremedi (' + upstream.status + ').';
        return json({ error: reason }, upstream.status === 429 ? 429 : 502);
      }
      const reply = result?.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join('').trim();
      if (!reply) return json({ error: 'Yapay zekâdan boş yanıt alındı.' }, 502);
      return json({ reply });
    }
    return json({ error: 'Google tarafından listelenen modeller de 404 döndürdü. API yapılandırmasını ve Cloudflare anahtarını kontrol edin.' }, 502);
  } catch (error) {
    console.error('AI function error', error);
    return json({ error: 'Yapay zekâ bağlantısı zaman aşımına uğradı veya kesildi.' }, 504);
  }
};
