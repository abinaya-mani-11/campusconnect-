// Small helper to perform fetch with automatic token refresh.
// Usage: import fetchWithAuth from '../utils/fetchWithAuth';
// const res = await fetchWithAuth(url, { method: 'GET' });

const API_REFRESH_URL = 'http://localhost:5000/api/auth/refresh-token';

async function refreshTokens() {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return null;
  try {
    const r = await fetch(API_REFRESH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });
    if (!r.ok) return null;
    const data = await r.json();
    if (data.accessToken) {
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('jwtToken', data.accessToken);
      sessionStorage.setItem('accessToken', data.accessToken);
      sessionStorage.setItem('jwtToken', data.accessToken);
    }
    if (data.refreshToken) {
      localStorage.setItem('refreshToken', data.refreshToken);
    }
    // keep tokenExpiry consistent with frontend convention (24h)
    localStorage.setItem('tokenExpiry', new Date(Date.now() + 24*60*60*1000).toISOString());
    return data;
  } catch (e) {
    console.warn('refreshTokens failed', e);
    return null;
  }
}

export default async function fetchWithAuth(input, init = {}) {
  const url = typeof input === 'string' ? input : input.url;
  const token = sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken') || sessionStorage.getItem('jwtToken') || localStorage.getItem('jwtToken');

  const headers = new Headers(init.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  // default content-type if not provided and body exists
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json');

  const options = { ...init, headers };

  let response = await fetch(url, options);

  // if unauthorized, try refreshing once and retry
  if (response.status === 401 || response.status === 403) {
    const refreshed = await refreshTokens();
    if (refreshed && refreshed.accessToken) {
      const newToken = refreshed.accessToken;
      headers.set('Authorization', `Bearer ${newToken}`);
      response = await fetch(url, { ...options, headers });
    }
  }

  return response;
}
