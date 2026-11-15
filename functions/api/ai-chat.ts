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
    // Model availability can vary by project. Retry only if the model is unavailable.
    const models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];
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
    return json({ error: 'Gemini modelleri bu API anahtarıyla kullanılamıyor (404). Google AI Studio model erişimini kontrol edin.' }, 502);
  } catch (error) {
    console.error('AI function error', error);
    return json({ error: 'Yapay zekâ bağlantısı zaman aşımına uğradı veya kesildi.' }, 504);
  }
};
