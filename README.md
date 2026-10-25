# پیداکالا — جست‌وجوی هوشمند فروشگاه‌ها

سایت فارسی راست‌چین برای جست‌وجوی فروشگاه‌ها و ارائه حداکثر ۱۰ نتیجه. رابط کاربری روی Netlify منتشر می‌شود و تابع جست‌وجو در `netlify/functions/search.js` اجرا می‌شود.

## نیازمندی‌ها
- حساب Netlify
- کلید Google Custom Search JSON API و شناسه موتور جست‌وجوی برنامه‌پذیر (CX)
- Node.js برای انتشار از طریق Netlify CLI

## متغیرهای محیطی
در تنظیمات سایت Netlify این متغیرها را تعریف کنید:
- `GOOGLE_CSE_API_KEY`
- `GOOGLE_CSE_CX`

کلیدها را در کد عمومی یا مخزن عمومی قرار ندهید.

## انتشار از گوشی اندروید با Termux
پس از نصب Node.js و unzip:
```bash
termux-setup-storage
cd ~/storage/downloads
unzip smart-shop-search.zip
cd smart-shop-search
npm install
npx netlify login
npx netlify init
npx netlify deploy --prod
```
اگر فایل ZIP در پوشه Downloads نیست، آن را ابتدا در همان پوشه ذخیره کنید. پس از افزودن متغیرهای محیطی در داشبورد Netlify، دوباره deploy کنید.

## نکته
رتبه‌بندی نتایج بر اساس نشانه‌های متنی و تجاری است و تضمین مستقلی درباره کیفیت واقعی، تنوع کالا، اعتبار فروشنده یا سیاست مرجوعی ارائه نمی‌کند.
