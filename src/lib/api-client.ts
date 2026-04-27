'use client'

// API Configuration for Local Development
// Uses relative paths for local dev, supports remote backend for production

// Check if running in Electron or static export
const isStaticExport = typeof window !== 'undefined' && 
  window.location.protocol === 'file:'

// Remote API URL for production/static builds (configure as needed)
const REMOTE_API_URL = process.env.NEXT_PUBLIC_API_URL || ''

// API Base URL - use relative for local dev, remote for static exports
export const API_BASE_URL = isStaticExport ? REMOTE_API_URL : ''

// WebSocket URL for chat service
export function getWebSocketUrl(): string {
  if (isStaticExport && REMOTE_API_URL) {
    return REMOTE_API_URL.replace('https://', 'wss://').replace('http://', 'ws://')
  }
  return '' // Use relative path for local dev (through gateway)
}

// Token management
const TOKEN_KEY = 'chrona_session_token'
const ACCOUNTS_KEY = 'chrona_accounts'

export function setSessionToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, token)
  }
}

export function getSessionToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(TOKEN_KEY)
  }
  return null
}

export function clearSessionToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(ACCOUNTS_KEY)
  }
}

// Stored account interface
export interface StoredAccount {
  token: string
  user: {
    id: string
    email: string | null
    username: string
    avatarUrl: string | null
    role: string
  }
}

export function getStoredAccounts(): { accounts: Record<string, StoredAccount>; activeAccountId: string | null } {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(ACCOUNTS_KEY)
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch {
        return { accounts: {}, activeAccountId: null }
      }
    }
  }
  return { accounts: {}, activeAccountId: null }
}

export function setStoredAccounts(accounts: Record<string, StoredAccount>, activeAccountId: string | null): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify({ accounts, activeAccountId }))
  }
}

export function addStoredAccount(user: StoredAccount['user'], token: string): void {
  const store = getStoredAccounts()
  store.accounts[user.id] = { token, user }
  if (!store.activeAccountId) {
    store.activeAccountId = user.id
  }
  setStoredAccounts(store.accounts, store.activeAccountId)
  setSessionToken(token)
}

// API Fetch with auth token support and retry logic
export async function apiFetch(
  endpoint: string,
  options: RequestInit = {},
  retries: number = 3
): Promise<Response> {
  const url = API_BASE_URL + endpoint
  
  const token = getSessionToken()
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  
  // Add ngrok-skip-browser-warning header for ngrok
  if (API_BASE_URL.includes('ngrok')) {
    headers['ngrok-skip-browser-warning'] = 'true'
  }
  
  // Add authorization header if we have a token
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  let lastError: Error | null = null
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
      })
      return response
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Fetch failed')
      // Wait before retrying (exponential backoff)
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, i)))
      }
    }
  }
  
  throw lastError || new Error('Fetch failed after retries')
}

// Helper for JSON responses
export async function apiJson<T = unknown>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await apiFetch(endpoint, options)
  
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`
    try {
      const error = await response.json()
      errorMessage = error.error || errorMessage
    } catch {
      // Ignore JSON parse errors
    }
    throw new Error(errorMessage)
  }
  
  return response.json()
}

// Parse JSON response safely
export async function parseJsonResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    const text = await response.text()
    throw new Error(`Expected JSON response, got ${response.statusText || response.status}: ${text.slice(0, 300)}`)
  }
  return response.json()
}