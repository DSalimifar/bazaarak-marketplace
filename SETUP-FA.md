# راه‌اندازی Worker و D1 بازارچه

1. در GitHub شاخه `feature/cloudflare-worker-d1-binding` را از `main` بسازید.
2. چهار فایل این بسته را در مسیرهای متناظر مخزن کپی کنید.
3. از ریشه مخزن `npm test` را اجرا کنید.
4. از پوشه `worker` اجرا کنید:
   ```bash
   npm install
   npx wrangler d1 migrations list marketplace-db --remote
   ```
5. فقط اگر migration اولیه در فهرست اجرا نشده بود و دیتابیس را تأیید کردید:
   ```bash
   npx wrangler d1 migrations apply marketplace-db --remote
   ```
6. سپس از پوشه `worker`:
   ```bash
   npx wrangler deploy
   ```
7. آدرس زیر را باز کنید:
   `https://bazaarak-marketplace.dsze.workers.dev/api/health`
   پاسخ موفق باید `database: "connected"` داشته باشد.

کلیدهای Supabase و Session را فقط با `npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY` و
`npx wrangler secret put SESSION_SECRET` وارد کنید؛ هرگز در Git یا فایل تنظیمات قرار ندهید.

این بسته فقط Worker، فایل‌های استاتیک و تست اتصال D1 را آماده می‌کند. API ورود، دعوت، محصول،
سفارش و پرداخت هنوز ساخته نشده و سیستم برای سفارش واقعی آماده نیست.
