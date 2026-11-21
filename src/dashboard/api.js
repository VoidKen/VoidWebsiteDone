// Small fetch wrapper for the dashboard API. Handles "your permissions need refreshing" by sending the
// user through a silent Discord re-login (once), instead of showing a confusing error.

const REAUTH_KEY = 'void_dash_reauth';

export function dashLoginUrl(returnTo = '/dashboard', { silent = false } = {}) {
  const params = new URLSearchParams({ dash: '1', returnTo });
  if (silent) params.set('silent', '1');
  return `/api/auth/login?${params.toString()}`;
}

/** True if we already tried a silent refresh in the last 30 seconds (prevents redirect loops). */
function recentlyTriedReauth() {
  try {
    const at = Number(window.sessionStorage.getItem(REAUTH_KEY) || 0);
    return Date.now() - at < 30000;
  } catch (err) {
    return false;
  }
}

function markReauth() {
  try { window.sessionStorage.setItem(REAUTH_KEY, String(Date.now())); } catch (err) { /* private mode: fine */ }
}

export class ApiError extends Error {
  constructor(message, status, extra = {}) {
    super(message);
    this.status = status;
    Object.assign(this, extra);
  }
}

export async function api(query, { method = 'GET', body } = {}) {
  const url = `/api/dashboard?${new URLSearchParams(query).toString()}`;
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
  } catch (err) {
    throw new ApiError('Could not reach the server. Check your connection.', 0);
  }
  let data = {};
  try { data = await res.json(); } catch (err) { /* non-JSON error page */ }

  if (res.status === 401 && data.reauth) {
    if (!recentlyTriedReauth()) {
      markReauth();
      window.location.href = dashLoginUrl(window.location.pathname, { silent: true });
      return new Promise(() => {}); // the page is navigating away
    }
    throw new ApiError('We could not refresh your server permissions automatically.', 401, { needsLogin: true });
  }
  if (res.status === 401) throw new ApiError(data.error || 'Please log in.', 401, { needsLogin: true });
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`, res.status);
  return data;
}

export function setIn(obj, path, value) {
  const [head, ...rest] = path;
  return { ...obj, [head]: rest.length ? setIn(obj[head] || {}, rest, value) : value };
}
