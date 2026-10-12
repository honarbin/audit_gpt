import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

const STORAGE_KEY_SUPABASE_CONFIG = 'ra_audit_supabase_credentials_v1';

/**
 * پاک‌سازی و استانداردسازی آدرس Supabase جهت جلوگیری از خطای PGRST125 (Invalid path specified in request URL)
 */
export function normalizeSupabaseUrl(rawUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let url = rawUrl.trim();

  // Remove surrounding quotes
  url = url.replace(/^["']+|["']+$/g, '').trim();
  if (!url) return '';

  // If user pasted a Supabase dashboard URL: https://supabase.com/dashboard/project/<project_ref>
  const dashboardMatch = url.match(/https?:\/\/(?:app\.)?supabase\.(?:com|io)\/dashboard\/project\/([a-zA-Z0-9_-]+)/i);
  if (dashboardMatch && dashboardMatch[1]) {
    return `https://${dashboardMatch[1]}.supabase.co`;
  }

  // Ensure scheme
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  try {
    const parsed = new URL(url);
    // Supabase project endpoints must not have /rest/v1 or trailing slashes in the base url
    let cleanPath = parsed.pathname
      .replace(/\/rest\/v1.*$/i, '')
      .replace(/\/api\/v1.*$/i, '')
      .replace(/\/graphql.*$/i, '')
      .replace(/\/auth\/v1.*$/i, '')
      .replace(/\/+$/, '');

    // For standard supabase hosted projects (*.supabase.co), base url is pure origin
    if (parsed.hostname.endsWith('.supabase.co') || parsed.hostname.endsWith('.supabase.in')) {
      return `${parsed.protocol}//${parsed.host}`;
    }

    return `${parsed.protocol}//${parsed.host}${cleanPath}`;
  } catch {
    return url.replace(/\/rest\/v1.*$/i, '').replace(/\/+$/, '');
  }
}

/**
 * پاک‌سازی کلید Anon
 */
export function normalizeSupabaseKey(rawKey?: string): string {
  if (!rawKey || typeof rawKey !== 'string') return '';
  return rawKey.trim().replace(/^["']+|["']+$/g, '');
}

// Default to env variables if available
export const getStoredSupabaseConfig = (): SupabaseConfig => {
  const envObj = (typeof import.meta !== 'undefined' && (import.meta as any).env) || {};
  const envUrl = normalizeSupabaseUrl(envObj.VITE_SUPABASE_URL || '');
  const envKey = normalizeSupabaseKey(envObj.VITE_SUPABASE_ANON_KEY || '');

  try {
    const saved = localStorage.getItem(STORAGE_KEY_SUPABASE_CONFIG);
    if (saved) {
      const parsed = JSON.parse(saved);
      const cleanUrl = normalizeSupabaseUrl(parsed.url);
      const cleanKey = normalizeSupabaseKey(parsed.anonKey);
      if (cleanUrl && cleanKey) {
        return { url: cleanUrl, anonKey: cleanKey };
      }
    }
  } catch (e) {
    console.error('Error reading supabase config from storage', e);
  }

  return {
    url: envUrl,
    anonKey: envKey,
  };
};

export const saveSupabaseConfig = (config: SupabaseConfig) => {
  const cleanConfig: SupabaseConfig = {
    url: normalizeSupabaseUrl(config.url),
    anonKey: normalizeSupabaseKey(config.anonKey),
  };
  localStorage.setItem(STORAGE_KEY_SUPABASE_CONFIG, JSON.stringify(cleanConfig));
  cachedClient = null; // reset client
};

let cachedClient: SupabaseClient | null = null;
let cachedConfigKey = '';

export const getSupabaseClient = (): SupabaseClient | null => {
  const config = getStoredSupabaseConfig();
  const cleanUrl = normalizeSupabaseUrl(config.url);
  const cleanKey = normalizeSupabaseKey(config.anonKey);

  if (!cleanUrl || !cleanKey) {
    return null;
  }

  // Prevent connecting to placeholders
  if (
    cleanUrl.includes('your-project') || 
    cleanUrl.includes('MY_SUPABASE') ||
    cleanKey.includes('your-anon-key') || 
    cleanKey.length < 20
  ) {
    return null;
  }

  const currentKey = `${cleanUrl}:::${cleanKey}`;
  if (cachedClient && cachedConfigKey === currentKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(cleanUrl, cleanKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    cachedConfigKey = currentKey;
    return cachedClient;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
};

export const isSupabaseReady = (): boolean => {
  const config = getStoredSupabaseConfig();
  const cleanUrl = normalizeSupabaseUrl(config.url);
  const cleanKey = normalizeSupabaseKey(config.anonKey);

  if (!cleanUrl || !cleanKey) return false;
  if (
    cleanUrl.includes('your-project') || 
    cleanUrl.includes('MY_SUPABASE') ||
    cleanKey.includes('your-anon-key') || 
    cleanKey.length < 20
  ) {
    return false;
  }
  return true;
};

