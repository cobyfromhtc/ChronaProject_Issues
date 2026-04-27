// API Configuration for Local Development
// This configures the app to use relative paths for local development

// Check if we're in development or production
const isDev = process.env.NODE_ENV === 'development'

// Check if running in Electron or static export
const isStaticExport = typeof window !== 'undefined' && 
  window.location.protocol === 'file:'

// Remote API URL for production (configure via environment)
const REMOTE_API_URL = process.env.NEXT_PUBLIC_API_URL || ''

// API Base URL - use relative for local dev
export const API_BASE_URL = isStaticExport ? REMOTE_API_URL : ''

// WebSocket URL for chat service
export const WS_BASE_URL = isStaticExport && REMOTE_API_URL 
  ? REMOTE_API_URL.replace('https://', 'wss://').replace('http://', 'ws://')
  : ''

// Helper function to make API calls
export async function apiFetch(
  endpoint: string, 
  options: RequestInit = {}
): Promise<Response> {
  const url = `${API_BASE_URL}${endpoint}`
  
  // Get token from localStorage if available
  const token = typeof window !== 'undefined' 
    ? localStorage.getItem('session_token') 
    : null
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  
  // Add authorization header if we have a token
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  return fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Include cookies for CORS
  })
}

// Helper for JSON responses
export async function apiJson<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await apiFetch(endpoint, options)
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }
  
  return response.json()
}

// Auth token management
export function setAuthToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('session_token', token)
  }
}

export function getAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('session_token')
  }
  return null
}

export function clearAuthToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('session_token')
    localStorage.removeItem('accounts')
  }
}