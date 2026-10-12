# راهنمای انتشار RA Audit روی Vercel و Supabase

## متغیرهای محیطی سمت سرور
در Vercel از مسیر Project → Settings → Environment Variables این متغیرها را برای محیط Production (و در صورت نیاز Preview) تنظیم کنید:

- `SUPABASE_URL`: آدرس پروژه Supabase به شکل `https://<project-ref>.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY`: کلید محرمانه سمت سرور، فقط در Environment Variables سرور

در صورت استفاده مستقیم از Supabase در مرورگر، این دو متغیر عمومی نیز در Build Environment لازم‌اند:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (یا کلید publishable سازگار با پروژه)

**هرگز `SUPABASE_SERVICE_ROLE_KEY` را با پیشوند `VITE_` تعریف نکنید و آن را در کد سمت مرورگر یا مخزن Git قرار ندهید.** کلید service role می‌تواند RLS را دور بزند. از کلید عمومی در مرورگر استفاده کنید و سیاست‌های RLS را در Supabase تنظیم کنید.

بعد از افزودن یا تغییر Environment Variables، یک Deployment جدید اجرا کنید.

## مسیریابی API
تمام درخواست‌های `/api/*` با rewrite به `api/index.ts` می‌رسند. این handler مسیر اصلی را بازسازی می‌کند و سپس درخواست را به routeهای Express در `server.ts` می‌دهد. فایل‌های catch-all قدیمی حذف شده‌اند تا یک ورودی واحد برای API وجود داشته باشد.

## Realtime
در محیط Vercel دیگر برای هر رویداد به `/api/v1/realtime/broadcast` درخواست ارسال نمی‌شود. رویدادهای بین‌دستگاهی از کانال Supabase Realtime استفاده می‌کنند؛ SSE فقط برای توسعه محلی نگه داشته شده است. برای دریافت رویدادهای Broadcast باید پروژه Supabase و کلید عمومی مرورگر معتبر باشند و شبکه WebSocket مسدود نباشد.

## بررسی پس از انتشار
1. در Vercel، آخرین Deployment باید `Ready` شود.
2. `GET /api/health` باید JSON با `status: "ok"` برگرداند.
3. `POST /api/v1/auth/login` باید JSON معتبر برگرداند؛ پاسخ خطا نیز باید `error` رشته‌ای یا شیء دارای `message` داشته باشد.
4. در مرورگر، خطای React #31 نباید با پاسخ خطای API رخ دهد.
5. برای تأیید همگام‌سازی، دو مرورگر/سیستم را باز کنید و یک تغییر ذخیره‌شده را آزمایش کنید.

## محدودیت تأیید
این بسته در محیط فعلی و با توجه به در دسترس نبودن نصب وابستگی‌های npm، Build نهایی و تست واقعی روی Vercel/Supabase را تأیید نمی‌کند. پیش از Production، Deployment Preview را بررسی کنید.
