
'use strict';

const BLOCKED = [
  'facebook.com',
  'instagram.com',
  'tiktok.com',
  'youtube.com',
  'wikipedia.org',
  'reddit.com',
  'pinterest.com',
  'linkedin.com'
];

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    },
    body: JSON.stringify(payload)
  };
}

function scoreResult(item) {
  const title = (item.title || '').toLowerCase();
  const snippet = (item.snippet || '').toLowerCase();
  const link = item.link || '';
  const text = `${title} ${snippet} ${link}`.toLowerCase();

  let score = 40;

  const commerce = [
    'خرید', 'فروشگاه', 'قیمت', 'سفارش', 'ارسال',
    'محصول', 'فروش', 'shop', 'store', 'buy',
    'price', 'product', 'cart', 'market'
  ];

  const diversity = [
    'تنوع', 'برند', 'محصولات', 'کالاها',
    'دسته‌بندی', 'مدل', 'variety', 'brands',
    'catalog', 'categories'
  ];

  for (const word of commerce) {
    if (text.includes(word)) score += 4;
  }

  for (const word of diversity) {
    if (text.includes(word)) score += 3;
  }

  if (link.startsWith('https://')) score += 4;

  if (
    item.pagemap &&
    (item.pagemap.product ||
      item.pagemap.offer ||
      item.pagemap.organization)
  ) {
    score += 8;
  }

  return Math.max(0, Math.min(100, score));
}

exports.handler = async function (event) {
  const q = (
    event.queryStringParameters &&
    event.queryStringParameters.q
      ? event.queryStringParameters.q
      : ''
  ).trim();

  if (!q) {
    return jsonResponse(400, {
      error: 'لطفاً نام کالا یا خدمت را وارد کنید.'
    });
  }

  if (q.length > 180) {
    return jsonResponse(400, {
      error: 'عبارت جست‌وجو بیش از حد طولانی است.'
    });
  }

  const key = process.env.GOOGLE_CSE_API_KEY;
  const cx = process.env.GOOGLE_CSE_CX;

  if (!key || !cx) {
    return jsonResponse(503, {
      error: 'موتور جست‌وجو پیکربندی نشده است. متغیرهای API را در Netlify بررسی کنید.'
    });
  }

  try {
    const url = new URL(
      'https://www.googleapis.com/customsearch/v1'
    );

    url.searchParams.set('key', key);
    url.searchParams.set('cx', cx);
    url.searchParams.set('q', `${q} خرید فروشگاه قیمت`);
    url.searchParams.set('num', '10');

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(12000)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error(
        'Google Search API error:',
        response.status,
        data.error && data.error.message
          ? data.error.message
          : 'Unknown API error'
      );

      return jsonResponse(502, {
        error: 'سرویس جست‌وجو پاسخ مناسبی نداد. کلید API، شناسه موتور جست‌وجو و سهمیه را بررسی کنید.'
      });
    }

    const seen = new Set();

    const results = (data.items || [])
      .filter((item) => {
        if (!item.link) return false;

        const host = hostOf(item.link);

        return host &&
          !BLOCKED.some(
            (domain) =>
              host === domain ||
              host.endsWith('.' + domain)
          );
      })
      .map((item) => ({
        title: item.title || hostOf(item.link),
        link: item.link,
        snippet: item.snippet || '',
        host: hostOf(item.link),
        score: scoreResult(item)
      }))
      .filter((item) => {
        if (!item.host || seen.has(item.host)) return false;

        seen.add(item.host);
        return true;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((item, index) => ({
        ...item,
        rank: index + 1,
        reason:
          item.score >= 70
            ? 'نشانه‌های تجاری و ارتباط متنی قوی‌تر'
            : item.score >= 55
              ? 'ارتباط مناسب با جست‌وجوی خرید'
              : 'نتیجه مرتبط؛ پیش از خرید اعتبار فروشگاه را بررسی کنید'
      }));

    return jsonResponse(200, {
      query: q,
      results,
      note: 'امتیازها تخمینی و مبتنی بر متن نتایج هستند؛ اعتبار واقعی فروشگاه باید جداگانه بررسی شود.'
    });
  } catch (error) {
    console.error('Search function error:', error.message);

    return jsonResponse(500, {
      error: 'در اتصال به سرویس جست‌وجو خطایی رخ داد. اتصال و تنظیمات API را بررسی کنید.'
    });
  }
};
