'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useAuthStore, User, Account } from '@/stores/auth-store'
import { 
  apiFetch, 
  parseJsonResponse, 
  setSessionToken, 
  getSessionToken, 
  clearSessionToken,
  getStoredAccounts,
  setStoredAccounts,
  addStoredAccount,
  API_BASE_URL 
} from '@/lib/api-client'

// Set personas online status
async function setOnlineStatus(isOnline: boolean) {
  try {
    await apiFetch('/api/personas/online', {
      method: 'POST',
      body: JSON.stringify({ isOnline }),
    })
  } catch (error) {
    console.error('Failed to update online status:', error)
  }
}

// Set offline using fetch with keepalive (for page unload)
function setOfflineOnExit() {
  const token = getSessionToken()
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  if (API_BASE_URL.includes('ngrok')) {
    headers['ngrok-skip-browser-warning'] = 'true'
  }
  
  fetch(API_BASE_URL + '/api/personas/online', {
    method: 'POST',
    headers,
    body: JSON.stringify({ isOnline: false }),
    keepalive: true,
    credentials: 'include',
  })
}

export function useAuth() {
  const { 
    user, 
    isLoading, 
    isAuthenticated, 
    accounts,
    setUser, 
    setLoading, 
    logout: storeLogout,
    setAccounts,
    addAccount,
    removeAccount,
    switchAccount,
    getActiveAccount,
  } = useAuthStore()
  
  const hasSetOnline = useRef(false)

  // Fetch current session on mount
  useEffect(() => {
    async function fetchSession() {
      // Skip API call if there's no session token — avoids unnecessary 401 errors
      const token = getSessionToken()
      if (!token) {
        setUser(null)
        return
      }

      try {
        const response = await apiFetch('/api/auth/me')
        
        if (response.ok) {
          const data = await parseJsonResponse(response) as { user: User }
          setUser(data.user)
          
          // Load stored accounts
          const storedAccounts = getStoredAccounts()
          if (Object.keys(storedAccounts.accounts).length > 0) {
            const accountList = Object.values(storedAccounts.accounts).map(a => ({
              ...a.user,
              token: a.token,
              isActive: storedAccounts.activeAccountId === a.user.id
            })) as Account[]
            setAccounts(accountList)
          }
        } else {
          setUser(null)
        }
      } catch (error) {
        console.error('Failed to fetch session:', error)
        setUser(null)
      }
    }
    
    fetchSession()
  }, [setUser, setAccounts])
  
  // Set online status when authenticated
  useEffect(() => {
    if (isAuthenticated && user && !hasSetOnline.current) {
      setOnlineStatus(true)
      hasSetOnline.current = true
    }
  }, [isAuthenticated, user])
  
  // Handle browser close/refresh - set offline
  useEffect(() => {
    let lastOnlinePing = 0
    const ONLINE_PING_COOLDOWN = 30000 // 30 seconds between online pings
    
    const handleBeforeUnload = () => {
      if (isAuthenticated) {
        setOfflineOnExit()
      }
    }
    
    const handleVisibilityChange = () => {
      const now = Date.now()
      if (document.visibilityState === 'hidden' && isAuthenticated) {
        setOfflineOnExit()
      } else if (document.visibilityState === 'visible' && isAuthenticated) {
        // Throttle online pings to avoid excessive API calls
        if (now - lastOnlinePing > ONLINE_PING_COOLDOWN) {
          lastOnlinePing = now
          setOnlineStatus(true)
        }
      }
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isAuthenticated])
  
  const login = async (username: string, password: string) => {
    const response = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })

    let data: { user: User; token?: string; error?: string; requiresSecurityKey?: boolean; id?: string }
    try {
      data = await parseJsonResponse(response) as typeof data
    } catch (err) {
      throw new Error(`Login failed: ${err instanceof Error ? err.message : 'Invalid server response'}`)
    }

    if (!response.ok) {
      throw new Error(data?.error || 'Login failed')
    }

    // Store token if provided (for cross-origin auth)
    if (data.token) {
      setSessionToken(data.token)
    }

    // Handle security key requirement
    if (data.requiresSecurityKey) {
      return { requiresSecurityKey: true, userId: data.user?.id || data.id, user: data.user }
    }

    setUser(data.user)
    addAccount(data.user)
    addStoredAccount(data.user, data.token || '')
    await setOnlineStatus(true)
    hasSetOnline.current = true
    return data
  }
  
  // Verify security key (second step of login)
  const verifySecurityKey = async (userId: string, securityKey: string) => {
    const response = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ userId, securityKey }),
    })

    let data: { user: User; token?: string; error?: string }
    try {
      data = await parseJsonResponse(response) as typeof data
    } catch (err) {
      throw new Error(`Verification failed: ${err instanceof Error ? err.message : 'Invalid server response'}`)
    }

    if (!response.ok) {
      throw new Error(data?.error || 'Invalid security key')
    }

    // Store token
    if (data.token) {
      setSessionToken(data.token)
    }

    setUser(data.user)
    addAccount(data.user)
    addStoredAccount(data.user, data.token || '')
    await setOnlineStatus(true)
    hasSetOnline.current = true
    return data
  }
  
  const signup = async (email: string, username: string, password: string, confirmPassword: string, dateOfBirth?: string) => {
    const response = await apiFetch('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, username, password, confirmPassword, dateOfBirth }),
    })

    let data: { user: User; token?: string; securityKey?: string; error?: string }
    try {
      data = await parseJsonResponse(response) as typeof data
    } catch (err) {
      throw new Error(`Signup failed: ${err instanceof Error ? err.message : 'Invalid server response'}`)
    }

    if (!response.ok) {
      throw new Error(data?.error || 'Signup failed')
    }

    // Store token if provided
    if (data.token) {
      setSessionToken(data.token)
    }

    setUser(data.user)
    addAccount(data.user)
    if (data.token) {
      addStoredAccount(data.user, data.token)
    }
    await setOnlineStatus(true)
    hasSetOnline.current = true
    return data
  }
  
  const logout = useCallback(async () => {
    // Set offline before logging out
    await setOnlineStatus(false)
    hasSetOnline.current = false
    
    await apiFetch('/api/auth/logout', { method: 'POST' })
    clearSessionToken()
    storeLogout()
  }, [storeLogout])
  
  // Switch to a different account
  const handleSwitchAccount = useCallback(async (userId: string): Promise<User | null> => {
    try {
      // Always call the API to switch account - this ensures the session cookie is updated
      const response = await apiFetch('/api/auth/switch-account', {
        method: 'POST',
        body: JSON.stringify({ userId }),
      })
      
      if (!response.ok) {
        const data = await parseJsonResponse(response) as { error?: string }
        throw new Error(data.error || 'Failed to switch account')
      }
      
      const data = await parseJsonResponse(response) as { user: User; token?: string }
      setUser(data.user)
      switchAccount(userId)
      
      if (data.token) {
        setSessionToken(data.token)
      }
      
      await setOnlineStatus(true)
      return data.user
    } catch (error) {
      console.error('Switch account error:', error)
      throw error
    }
  }, [setUser, switchAccount])
  
  // Remove an account from the accounts list
  const handleRemoveAccount = useCallback(async (userId: string): Promise<{ success: boolean; switchedTo: User | null }> => {
    try {
      const response = await apiFetch('/api/auth/remove-account', {
        method: 'POST',
        body: JSON.stringify({ userId }),
      })
      
      if (!response.ok) {
        const data = await parseJsonResponse(response) as { error?: string }
        throw new Error(data.error || 'Failed to remove account')
      }
      
      const data = await parseJsonResponse(response) as { switchedTo?: User; loggedOut?: boolean }
      
      // Update local state
      removeAccount(userId)
      
      if (data.switchedTo) {
        setUser(data.switchedTo)
      } else if (data.loggedOut) {
        clearSessionToken()
        storeLogout()
      }
      
      return { success: true, switchedTo: data.switchedTo || null }
    } catch (error) {
      console.error('Remove account error:', error)
      throw error
    }
  }, [removeAccount, setUser, storeLogout])
  
  // Add an account (after logging in from the "Add Account" modal)
  const handleAddAccount = useCallback((user: User, token?: string) => {
    addAccount(user)
    setUser(user)
    if (token) {
      addStoredAccount(user, token)
    }
  }, [addAccount, setUser])
  
  return {
    user,
    isLoading,
    isAuthenticated,
    accounts,
    login,
    verifySecurityKey,
    signup,
    logout,
    setUser,
    switchAccount: handleSwitchAccount,
    removeAccount: handleRemoveAccount,
    addAccount: handleAddAccount,
    getActiveAccount,
  }
}