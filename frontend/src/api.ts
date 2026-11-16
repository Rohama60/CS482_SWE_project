export async function apiRequest<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = options.headers ?? (options.body ? { 'Content-Type': 'application/json' } : undefined)
  if (options.body && headers && !(headers instanceof Headers) && !Object.keys(headers).some(key => key.toLowerCase() === 'content-type')) {
    (headers as Record<string, string>)['Content-Type'] = 'application/json'
  }

  const response = await fetch(url, {
    ...options,
    credentials: options.credentials ?? 'include',
    ...(headers ? { headers } : {}),
  })
  const data = await response.json().catch(() => ({})) as T & { error?: string; message?: string }

  if (!response.ok) {
    throw new Error(data.error || data.message || 'Something went wrong')
  }

  return data
}

export function guestRequestHeaders(guestId?: string): Record<string, string> {
  const headers: Record<string, string> = {}
  if (guestId) headers['x-guest-id'] = guestId
  return headers
}
