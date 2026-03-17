export function getApiBaseUrl() {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

  if (!apiBaseUrl) {
    throw new Error('Missing API base URL environment variable');
  }

  return apiBaseUrl.replace(/\/$/, '');
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { accessToken?: string } = {},
) {
  const headers = new Headers(options.headers);

  if (options.accessToken) {
    headers.set('Authorization', `Bearer ${options.accessToken}`);
  }

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;

    throw new Error(errorPayload?.message ?? 'API request failed');
  }

  return (await response.json()) as T;
}
