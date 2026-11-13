const KEY = 'ds.apiKey'

export function loadKey(): string {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveKey(key: string): void {
  localStorage.setItem(KEY, key.trim())
}

export function clearKey(): void {
  localStorage.removeItem(KEY)
}
