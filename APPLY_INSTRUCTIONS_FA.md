# بسته پیاده‌سازی احراز هویت بازارچه

این بسته بر اساس وضعیت فعلی شاخه `main` مخزن `DSalimifar/bazaarak-marketplace` تهیه شده است.

## فایل‌هایی که باید اضافه یا جایگزین شوند

- جایگزین: `worker/src/index.js`
- جایگزین: `worker/tests/worker.test.js`
- اضافه: `migrations/0002_invitation_auth.sql`
- اضافه: `public/auth-ui.js`
- اضافه: `docs/AUTH_SETUP_FA.md`
- فایل `worker/src/supabase-storage.js` در این بسته فقط برای اجرای مستقل تست‌ها و با محتوای فعلی مخزن نگه داشته شده؛ نیازی به جایگزینی آن نیست.

## روش اعمال

۱. در GitHub یک شاخه جدید با نام `feature/invitation-auth` از `main` بسازید.
۲. فایل‌های بالا را در مسیرهای متناظر اضافه/جایگزین کنید.
۳. در `public/index.html` بعد از `<script src="./app.js"></script>`، خط `<script src="./auth-ui.js"></script>` را اضافه کنید.
۴. تغییرات را Commit و یک Pull Request به `main` باز کنید.
۵. بعد از بررسی CI و Merge، Workflow `Apply D1 Migrations` را با `apply_migrations=true` اجرا کنید.
۶. سپس Secretهای Worker را طبق `docs/AUTH_SETUP_FA.md` تنظیم و مدیر اولیه را ایجاد کنید.

## تست محلی انجام‌شده

```bash
node --test worker/tests/worker.test.js
```

نتیجه هنگام ساخت این بسته: ۱۳ تست موفق، ۰ تست ناموفق. همچنین Migration جدید با SQLite بررسی شده و ساخت جدول‌ها و ستون نقش دعوت‌نامه موفق بوده است.

## محدودیت دسترسی در این اجرا

تلاش برای ایجاد شاخه از طریق اتصال GitHub با پاسخ `403 Resource not accessible by integration` رد شد. بنابراین هیچ تغییری روی `main` اعمال نشده و این بسته، تغییرات آماده اعمال در شاخه جداگانه را تحویل می‌دهد.
