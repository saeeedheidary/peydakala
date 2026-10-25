const form = document.querySelector("#search-form");
const queryInput = document.querySelector("#query");
const button = document.querySelector("#search-button");
const statusBox = document.querySelector("#status");
const resultsBox = document.querySelector("#results");

function make(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const q = queryInput.value.trim();
  if (!q) return;
  button.disabled = true;
  button.textContent = "در حال جست‌وجو…";
  resultsBox.replaceChildren();
  statusBox.textContent = "در حال بررسی فروشگاه‌های مرتبط هستیم؛ کمی صبر کنید.";
  try {
    const response = await fetch(`/.netlify/functions/search?q=${encodeURIComponent(q)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "جست‌وجو انجام نشد.");
    if (!data.results || data.results.length === 0) {
      statusBox.textContent = "نتیجه‌ای پیدا نشد. عبارت دیگری را امتحان کنید.";
      return;
    }
    statusBox.textContent = `برای «${data.query}» تعداد ${data.results.length} نتیجه پیدا شد. ${data.note || ""}`;
    for (const item of data.results) {
      const card = make("article", "result");
      const head = make("div", "result-head");
      head.append(make("div", "rank", String(item.rank)));
      const headingWrap = make("div");
      headingWrap.append(make("h2", "", item.title), make("div", "host", item.host));
      head.append(headingWrap);
      card.append(head);
      card.append(make("p", "", item.snippet || "توضیح بیشتری از این نتیجه در دسترس نیست."));
      const meta = make("div", "meta");
      meta.append(make("span", "score", `امتیاز تخمینی: ${item.score} از ۱۰۰`));
      const link = make("a", "visit", "مشاهده فروشگاه ↗");
      link.href = item.link;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      meta.append(link);
      card.append(meta);
      card.append(make("p", "", `دلیل رتبه‌بندی: ${item.reason}`));
      resultsBox.append(card);
    }
  } catch (err) {
    statusBox.textContent = err.message || "خطایی رخ داد. اتصال اینترنت و تنظیمات موتور جست‌وجو را بررسی کنید.";
  } finally {
    button.disabled = false;
    button.textContent = "جست‌وجو";
  }
});
