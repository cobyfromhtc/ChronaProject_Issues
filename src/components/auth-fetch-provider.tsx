'use client'

import { useEffect } from 'react'

/**
 * Global fetch interceptor that adds the Authorization header
 * to all same-origin /api/ requests. This ensures that even
 * plain `fetch('/api/...')` calls include the session token,
 * which is needed because cookies may not be forwarded in
 * proxied/sandbox environments.
 */
export function AuthFetchProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const TOKEN_KEY = 'chrona_session_token'
    const originalFetch = window.fetch

    window.fetch = function patchedFetch(input: RequestInfo | URL, init?: RequestInit) {
      // Only intercept same-origin /api/ requests
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url

      const isApiRequest = url.startsWith('/api/') || url.startsWith('/?XTransformPort')

      if (isApiRequest) {
        const token = localStorage.getItem(TOKEN_KEY)

        if (token) {
          const headers = new Headers(init?.headers || (input as Request)?.headers)

          // Don't override if Authorization already set
          if (!headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${token}`)
          }

          // Merge headers back into init
          init = {
            ...init,
            headers,
          }
        }
      }

      return originalFetch.call(this, input, init)
    }

    return () => {
      window.fetch = originalFetch
    }
  }, [])

  return <>{children}</>
}
