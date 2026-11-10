اصلاح مسیریابی Bazaarak

این سه فایل را در مخزن GitHub با همین مسیرها جایگزین کن:
- worker/src/index.js
- worker/wrangler.toml
- worker/tests/worker.test.js

تغییر اصلی: run_worker_first = true
چون اکنون همه درخواست‌ها ابتدا وارد Worker می‌شوند، کد Worker درخواست‌های غیر API را به env.ASSETS.fetch(request) می‌فرستد تا صفحه اصلی و فایل‌های CSS/JS همچنان کار کنند.

بعد از Commit روی main، Workflow فعلی باید تست‌ها را اجرا و Deploy کند.
سپس این آدرس را تست کن:
https://bazaarak-marketplace.dsze.workers.dev/api/health

پاسخ مورد انتظار:
{"ok":true,"service":"marketplace-api","database":"connected"}

این اصلاح هیچ Migration دیتابیسی را اجرا یا تغییر نمی‌دهد.
