'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
  id: string
  email: string
  username: string
  avatarUrl: string | null
  bio?: string | null
  bannerUrl?: string | null
  status?: string | null
  pronouns?: string | null
  location?: string | null
  socialLinks?: string | null
  role: string // user, mod, admin, owner
  chronos?: number
  createdAt?: string
  dateOfBirth?: string | null // ISO date string or null
  contentMaturity?: string // safe, mature, unrestricted
  theme?: string // dark, light, midnight, forest
  febBoxToken?: string | null
  navigationMode?: string // static, linear
}

export interface Account extends User {
  isActive: boolean
  token?: string // Optional token for cross-origin auth
}

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  accounts: Account[]
  
  // Actions
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  logout: () => void
  setAccounts: (accounts: Account[]) => void
  addAccount: (user: User) => void
  removeAccount: (userId: string) => void
  switchAccount: (userId: string) => void
  getActiveAccount: () => Account | null
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: true,
      isAuthenticated: false,
      accounts: [],
      
      setUser: (user) => set({ 
        user, 
        isAuthenticated: !!user,
        isLoading: false,
        // Update accounts list when user changes
        accounts: user 
          ? get().accounts.map(a => ({ ...a, isActive: a.id === user.id }))
          : get().accounts,
      }),
      
      setLoading: (isLoading) => set({ isLoading }),
      
      logout: () => set({ 
        user: null, 
        isAuthenticated: false,
        isLoading: false,
      }),
      
      setAccounts: (accounts) => set({ accounts }),
      
      addAccount: (user) => {
        const accounts = get().accounts
        const exists = accounts.find(a => a.id === user.id)
        
        if (exists) {
          // Account exists, just switch to it
          set({
            accounts: accounts.map(a => ({ ...a, isActive: a.id === user.id })),
            user,
            isAuthenticated: true,
          })
        } else {
          // New account
          set({
            accounts: [...accounts.map(a => ({ ...a, isActive: false })), { ...user, isActive: true }],
            user,
            isAuthenticated: true,
          })
        }
      },
      
      removeAccount: (userId) => {
        const accounts = get().accounts.filter(a => a.id !== userId)
        const currentActive = get().user
        
        // If we removed the active account, switch to another
        if (currentActive?.id === userId) {
          const newActive = accounts[0] || null
          set({
            accounts: accounts.map(a => ({ ...a, isActive: a.id === newActive?.id })),
            user: newActive || null,
            isAuthenticated: !!newActive,
          })
        } else {
          set({ accounts })
        }
      },
      
      switchAccount: (userId) => {
        const accounts = get().accounts
        const account = accounts.find(a => a.id === userId)
        
        if (account) {
          set({
            accounts: accounts.map(a => ({ ...a, isActive: a.id === userId })),
            user: account,
            isAuthenticated: true,
          })
        }
      },
      
      getActiveAccount: () => {
        return get().accounts.find(a => a.isActive) || null
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        accounts: state.accounts,
      }),
    }
  )
)