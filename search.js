'use strict';
const BLOCKED = [
"facebook.com", "instagram.com", "tiktok.com", "youtube.com",
"wikipedia.org", "reddit.com", "pinterest.com", "linkedin.com"
];

function hostOf(url) {
try { return new URL(url).hostname.replace(/^www./, "").toLowerCase(); }
catch { return ""; }
}

function scoreResult(item) {
const title = (item.title || "").toLowerCase();
const snippet = (item.snippet || "").toLowerCase();
const url = item.link || "";
const text = ${title} ${snippet} ${url}.toLowerCase();
let score = 40;
const commerce = ["خرید", "فروشگاه", "قیمت", "سفارش", "ارسال", "محصول", "فروش", "shop", "store", "buy", "price", "product", "cart", "market"];
const diversity = ["تنوع", "برند", "محصولات", "کالاها", "دسته‌بندی", "مدل", "variety", "brands", "catalog", "categories"];
for (const word of commerce) if (text.includes(word)) score += 4;
for (const word of diversity) if (text.includes(word)) score += 3;
if (url.startsWith("https://")) score += 4;
if (item.pagemap && (item.pagemap.product || item.pagemap.offer || item.pagemap.organization)) score += 8;
return Math.max(0, Math.min(100, score));
}

exports.handler = async function(event) {
const q = (event.queryStringParameters && event.queryStringParameters.q || "").trim();
if (!q) return { statusCode: 400, headers: { "content-type": "application/json; charset=utf-8" }, body: JSON.stringify({ error: "لطفاً نام کالا یا خدمت را وارد کنید." }) };
if (q.length > 180) return { statusCode: 400, headers: { "content-type": "application/json; charset=utf-8" }, body: JSON.stringify({ error: "عبارت جست‌وجو بیش از حد طولانی است." }) };

const key = process.env.GOOGLE_CSE_API_KEY;
const cx = process.env.GOOGLE_CSE_CX;
if (!key || !cx) return { statusCode: 503, headers: { "content-type": "application/json; charset=utf-8" }, body: JSON.stringify({ error: "موتور جست‌وجو هنوز پیکربندی نشده است. مدیر سایت باید کلیدهای API را در Netlify تنظیم کند." }) };

try {
const url = new URL("https://www.googleapis.com/customsearch/v1");
url.searchParams.set("key", key);
url.searchParams.set("cx", cx);
url.searchParams.set("q", ${q} خرید فروشگاه قیمت);
url.searchParams.set("num", "10");
const response = await fetch(url.toString());
const data = await response.json();
if (!response.ok) {
return { statusCode: 502, headers: { "content-type": "application/json; charset=utf-8" }, body: JSON.stringify({ error: "سرویس جست‌وجو پاسخ مناسبی نداد. کلید API، شناسه موتور جست‌وجو و سهمیه را بررسی کنید." }) };
}
const seen = new Set();
const results = (data.items || [])
.filter(x => x.link && !BLOCKED.some(d => hostOf(x.link) === d || hostOf(x.link).endsWith("." + d)))
.map(x => ({ title: x.title || hostOf(x.link), link: x.link, snippet: x.snippet || "", host: hostOf(x.link), score: scoreResult(x) }))
.filter(x => {
if (!x.host || seen.has(x.host)) return false;
seen.add(x.host); return true;
})
.sort((a,b) => b.score - a.score)
.slice(0,10)
.map((x,i) => ({ ...x, rank: i+1, reason: x.score >= 70 ? "نشانه‌های تجاری و ارتباط متنی قوی‌تر" : x.score >= 55 ? "ارتباط مناسب با جست‌وجوی خرید" : "نتیجه مرتبط؛ پیش از خرید اعتبار فروشگاه را بررسی کنید" }));
return { statusCode: 200, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }, body: JSON.stringify({ query: q, results, note: "امتیازها تخمینی و مبتنی بر متن صفحه‌اند؛ کیفیت واقعی، تعداد کالاها و اعتبار فروشنده باید جداگانه بررسی شوند." }) };
} catch (e) {
return { statusCode: 500, headers: { "content-type": "application/json; charset=utf-8" }, body: JSON.stringify({ error: "در اتصال به سرویس جست‌وجو خطایی رخ داد. اتصال و تنظیمات API را بررسی کنید." }) };
}
};
