// Simple in-memory fetch cache with TTL to reduce flicker between pages
const _cache = new Map()

export async function fetchJsonCached(url, { ttl = 30000, fetcher = fetch } = {}) {
  const now = Date.now()
  const entry = _cache.get(url)
  if (entry && (now - entry.time) < ttl) {
    return entry.data
  }
  const res = await fetcher(url)
  if (!res.ok) throw new Error(`Fetch failed ${res.status}`)
  const data = await res.json()
  _cache.set(url, { time: now, data })
  return data
}

export function prefetchJson(url, opts) {
  // fire-and-forget; ignore errors
  fetchJsonCached(url, opts).catch(() => {})
}

