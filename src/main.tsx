import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import '@fontsource/vazirmatn/400.css';
import '@fontsource/vazirmatn/500.css';
import '@fontsource/vazirmatn/600.css';
import '@fontsource/vazirmatn/700.css';
import '@fontsource/vazirmatn/800.css';
import App from './App.tsx';
import { AppErrorBoundary } from './AppErrorBoundary';
import './index.css';

// Report errors that happen outside React render (event handlers, async effects,
// rejected promises). Previously these could leave the user with an empty-looking
// screen without a useful on-screen message.
function showRuntimeFailure(title: string, detail: string) {
  console.error(`[RA Audit] ${title}`, detail);
  let panel = document.getElementById('ra-audit-runtime-error');
  if (!panel) {
    panel = document.createElement('section');
    panel.id = 'ra-audit-runtime-error';
    panel.setAttribute('dir', 'rtl');
    panel.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:2147483647', 'overflow:auto',
      'background:#f8fafc', 'color:#0f172a', 'padding:28px',
      'font-family:Vazirmatn, sans-serif'
    ].join(';');
    document.body.appendChild(panel);
  }
  panel.innerHTML = '';
  const heading = document.createElement('h1');
  heading.textContent = title;
  heading.style.cssText = 'font-size:22px;font-weight:800;margin:0 0 12px';
  const intro = document.createElement('p');
  intro.textContent = 'خطای فنی هنگام اجرای سامانه رخ داده است. متن زیر را برای بررسی ارسال کنید.';
  intro.style.cssText = 'margin:0 0 16px';
  const pre = document.createElement('pre');
  pre.dir = 'ltr';
  pre.textContent = detail || '(بدون جزئیات خطا)';
  pre.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;background:#fff1f2;border:1px solid #fecaca;border-radius:10px;padding:16px;font:12px/1.6 monospace';
  const reload = document.createElement('button');
  reload.textContent = 'بارگذاری مجدد';
  reload.style.cssText = 'margin-top:16px;padding:10px 18px;border:0;border-radius:8px;background:#0f766e;color:white;cursor:pointer';
  reload.onclick = () => window.location.reload();
  panel.append(heading, intro, pre, reload);
}

window.addEventListener('error', (event) => {
  // Resource load errors may not expose an Error object.
  const target = event.target as HTMLElement | null;
  const detail = event.error instanceof Error
    ? `${event.message}\n${event.error.stack || ''}`
    : `${event.message || 'Resource failed to load'}\nResource: ${(target as any)?.src || (target as any)?.href || 'unknown'}`;
  showRuntimeFailure('خطا در اجرای سامانه', detail);
}, true);

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const detail = reason instanceof Error ? `${reason.message}\n${reason.stack || ''}` : String(reason ?? 'Unknown rejection');
  showRuntimeFailure('خطا در دریافت اطلاعات یا اجرای عملیات', detail);
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  showRuntimeFailure('عنصر اصلی برنامه پیدا نشد', 'index.html باید شامل عنصر <div id="root"></div> باشد.');
} else {
  createRoot(rootElement).render(
    <StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </StrictMode>,
  );

  // A final guard for failures that prevent React from mounting any UI.
  window.setTimeout(() => {
    if (!rootElement.childElementCount && !document.getElementById('ra-audit-runtime-error')) {
      showRuntimeFailure(
        'داشبورد بارگذاری نشد',
        'برنامه پس از بارگذاری فایل‌های جاوااسکریپت هیچ رابطی ایجاد نکرد. در DevTools > Console و Network خطاهای فایل‌های JS و پاسخ API را بررسی کنید.'
      );
    }
  }, 5000);
}
