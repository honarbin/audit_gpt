/**
 * Session token handling for every /api request.
 * - The token is issued by the server at login (and also set as an HttpOnly cookie for GET-only
 *   resources such as file previews and the realtime stream).
 * - It is kept only for the current browser tab/session (sessionStorage), never in localStorage.
 * - A 401 from the server means the session expired: the token is dropped and the page reloads to the login screen.
 */
const TOKEN_KEY = 'ra_audit_api_token_v1';
let memoryToken = '';

export function getAuthToken(): string {
  if (memoryToken) return memoryToken;
  try { memoryToken = sessionStorage.getItem(TOKEN_KEY) || ''; } catch { /* storage blocked */ }
  return memoryToken;
}

export function setAuthToken(token: string | null | undefined): void {
  memoryToken = token || '';
  try {
    if (memoryToken) sessionStorage.setItem(TOKEN_KEY, memoryToken);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch { /* storage blocked */ }
}

export function hasAuthToken(): boolean {
  return !!getAuthToken();
}

/** Ends the session on the server (clears the cookie) and locally. */
export async function endServerSession(): Promise<void> {
  try { await fetch('/api/v1/auth/logout', { method: 'POST' }); } catch { /* offline */ }
  setAuthToken(null);
}

let installed = false;
/** Wraps window.fetch once so every same-origin /api call carries the session token. */
export function installAuthFetch(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : (input as Request).url;
    const isApi = /^(\/api\/|https?:\/\/[^/]+\/api\/)/.test(url) && (url.startsWith('/') || url.startsWith(window.location.origin));
    const isLogin = url.includes('/api/v1/auth/login') || url.includes('/api/v1/auth/logout');
    if (!isApi) return original(input, init);

    const token = getAuthToken();
    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
    const res = await original(input, { ...init, headers, credentials: 'same-origin' });
    if (res.status === 401 && !isLogin && token) {
      setAuthToken(null);
      try { localStorage.removeItem('ra_audit_session_v2'); } catch { /* ignore */ }
      window.location.reload();
    }
    return res;
  };
}
