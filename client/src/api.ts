const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';
let accessToken: string | null = null;
let refreshInFlight: Promise<{ accessToken: string; user: { id: string; email: string; displayName: string; role: string } } | null> | null = null;

export function setAccessToken(token: string | null) { accessToken = token; }

export async function refreshSession() {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${baseUrl}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) return null;
        const session = await response.json() as { accessToken: string; user: { id: string; email: string; displayName: string; role: string } };
        setAccessToken(session.accessToken);
        return session;
      })
      .catch(() => null)
      .finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const send = () => {
    const headers = new Headers(init.headers);
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
    return fetch(`${baseUrl}${path}`, { ...init, headers, credentials: 'include' });
  };
  const response = await send();
  if (response.status !== 401) return response;
  const session = await refreshSession();
  if (!session) return response;
  return send();
}
