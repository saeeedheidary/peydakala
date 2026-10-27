const BLOCKED = [
  'facebook.com', 'instagram.com', 'tiktok.com',
  'youtube.com', 'wikipedia.org', 'reddit.com',
  'pinterest.com', 'linkedin.com', 'twitter.com',
  'x.com', 't.co'
];

const CONFIG = {
  MAX_QUERY_LENGTH: 180,
  TIMEOUT_MS: 15000,
  MAX_RESULTS: 10
};

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function sanitize(input) {
  if (!input || typeof input !== 'string') return '';
  return input.trim().replace(/[<>\"']/g, '').replace(/\s+/g, ' ');
}

function buildQuery(q) {
  const hasPersian = /[\u0600-\u06FF]/.test(q);
  return hasPersian ? `${q} خرید فروشگاه قیمت` : `${q} buy price shop store`;
}

function scoreResult(item) {
  const text = `${item.title || ''} ${item.snippet || ''} ${item.link || ''}`.toLowerCase();
  const commerce = ['خرید', 'فروشگاه', 'قیمت', 'سفارش', 'محصول', 'shop', 'store', 'buy', 'price', 'product'];
  const diversity = ['تنوع', 'برند', 'محصولات', 'دسته‌بندی', 'variety', 'brands', 'catalog'];
  let score = 40;

  for (const word of commerce) if (text.includes(word)) score += 4;
  for (const word of diversity) if (text.includes(word)) score += 3;
  if ((item.link || '').startsWith('https://')) score += 4;
  if (item.pagemap && (item.pagemap.product || item.pagemap.offer)) score += 8;

  return Math.min(100, score);
}

function reply(statusCode, data, reqId) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'Content-Type'
    },
    body: JSON.stringify({ ...data, reqId })
  };
}

function makeTimeout(ms) {
  if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
    return AbortSignal.timeout(ms);
  }
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}

export const handler = async (event) => {
  const reqId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  
  console.log(`[${reqId}] === NEW REQUEST ===`);
  console.log(`[${reqId}] Method: ${event.httpMethod}`);
  console.log(`[${reqId}] Query params:`, event.queryStringParameters);

  if (event.httpMethod === 'OPTIONS') {
    return reply(204, {}, reqId);
  }

  const rawQ = event.queryStringParameters?.q;
  const q = sanitize(rawQ);

  console.log(`[${reqId}] Sanitized query: "${q}"`);

  if (!q) {
    return reply(400, { error: 'لطفاً نام کالا یا خدمت را وارد کنید.' }, reqId);
  }
  
  if (q.length > CONFIG.MAX_QUERY_LENGTH) {
    return reply(400, { error: 'عبارت جست‌وجو بیش از حد طولانی است.' }, reqId);
  }

  const key = process.env.GOOGLE_CSE_API_KEY;
  const cx = process.env.GOOGLE_CSE_CX;

  console.log(`[${reqId}] API Key present: ${key ? 'YES' : 'NO'}`);
  console.log(`[${reqId}] CX present: ${cx ? 'YES' : 'NO'}`);

  if (!key || !cx) {
    return reply(503, { 
      error: 'موتور جست‌وجو پیکربندی نشده است.',
      hint: 'GOOGLE_CSE_API_KEY and GOOGLE_CSE_CX must be set in Netlify environment variables.'
    }, reqId);
  }

  try {
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.set('key', key);
    url.searchParams.set('cx', cx);
    url.searchParams.set('q', buildQuery(q));
    url.searchParams.set('num', String(CONFIG.MAX_RESULTS));

    const safeUrl = url.toString().replace(key, '***');
    console.log(`[${reqId}] Calling: ${safeUrl}`);

    const response = await fetch(url.toString(), {
      signal: makeTimeout(CONFIG.TIMEOUT_MS)
    });

    console.log(`[${reqId}] Google status: ${response.status}`);

    let data;
    try {
      data = await response.json();
    } catch (parseErr) {
      console.error(`[${reqId}] JSON parse failed:`, parseErr.message);
      return reply(502, { error: 'پاسخ نامعتبر از سرویس جست‌وجو.' }, reqId);
    }

    if (!response.ok) {
      console.error(`[${reqId}] Google error:`, data.error);
      const msg = response.status === 429 ? 'سهمیه جست‌وجو تمام شده است.'
        : response.status === 403 ? 'دسترسی به API محدود شده است.'
        : response.status === 400 ? 'درخواست نامعتبر - CX یا کلید API اشتباه است.'
        : 'سرویس جست‌وجو خطا داد.';
      return reply(502, { error: msg, details: data.error?.message }, reqId);
    }

    console.log(`[${reqId}] Got ${data.items?.length || 0} items`);

    const seen = new Set();
    const results = (data.items || [])
      .filter(item => item && item.link)
      .map(item => ({
        title: item.title || hostOf(item.link),
        link: item.link,
        snippet: item.snippet || '',
        host: hostOf(item.link),
        score: scoreResult(item)
      }))
      .filter(item => {
        if (!item.host) return false;
        const blocked = BLOCKED.some(d => item.host === d || item.host.endsWith('.' + d));
        if (blocked || seen.has(item.host)) return false;
        seen.add(item.host);
        return true;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, CONFIG.MAX_RESULTS)
      .map((item, index) => ({
        rank: index + 1,
        title: item.title,
        link: item.link,
        snippet: item.snippet,
        host: item.host,
        score: item.score,
        reason: item.score >= 70
          ? 'نشانه‌های تجاری و ارتباط متنی قوی‌تر'
          : 'نتیجه مرتبط؛ اعتبار فروشگاه را بررسی کنید'
      }));

    console.log(`[${reqId}] Returning ${results.length} results`);

    return reply(200, {
      query: q,
      results,
      note: 'امتیازها تخمینی هستند و اعتبار واقعی فروشگاه را تضمین نمی‌کنند.'
    }, reqId);

  } catch (err) {
    console.error(`[${reqId}] EXCEPTION:`, err.name, err.message);
    const isTimeout = err.name === 'AbortError' || err.name === 'TimeoutError';
    return reply(500, {
      error: isTimeout ? 'سرویس جست‌وجو زمان‌بر شد. دوباره تلاش کنید.' : 'ارتباط با سرویس جست‌وجو برقرار نشد.'
    }, reqId);
  }
};
