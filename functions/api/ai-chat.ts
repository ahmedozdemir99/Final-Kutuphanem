interface Env { GEMINI_API_KEY?: string }

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    let upstream: Response;
    try {
      upstream = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: 'Sen Final-Kütüphanem uygulamasındaki Türkçe konuşan, nazik ve bilgili okuma arkadaşı Robi’sin. Kullanıcının sorusunu doğrudan cevapla. Kişisel kütüphane verilerini gereksiz yere tekrarlama. İlgili kütüphane bağlamı:\\n' + context }] },
          contents,
          generationConfig: { maxOutputTokens: 1400, temperature: 0.7 }
        }),
        signal: controller.signal
      });
    } finally { clearTimeout(timeout); }
    const result: any = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      console.error('Gemini request failed', upstream.status, result?.error?.status);
      return json({ error: upstream.status === 429 ? 'Yapay zekâ kullanım sınırına ulaşıldı. Biraz sonra tekrar deneyin.' : 'Yapay zekâ hizmeti yanıt veremedi (' + upstream.status + ').' }, upstream.status === 429 ? 429 : 502);
    }
    const reply = result?.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join('').trim();
    if (!reply) return json({ error: 'Yapay zekâdan boş yanıt alındı.' }, 502);
    return json({ reply });
  } catch (error) {
    console.error('AI function error', error);
    return json({ error: 'Yapay zekâ bağlantısı zaman aşımına uğradı veya kesildi.' }, 504);
  }
};
