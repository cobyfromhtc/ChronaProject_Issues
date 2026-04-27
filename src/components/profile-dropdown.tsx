'use client'

import { useState, useRef, useEffect, useCallback, useMemo, startTransition, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/hooks/use-auth'
import { usePersonas } from '@/hooks/use-personas'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  MessageCircle, Search, X, Loader2, Users, Settings,
  User, History, Palette, Shield,
  Eye, EyeOff, Copy, Check, Compass, ChevronRight,
  PanelLeft, LayoutList, LayoutGrid, Lock, LogOut
} from 'lucide-react'
import { apiFetch } from '@/lib/api-client'
import { isAdult } from '@/lib/age-utils'
import { useUIVariant, UI_VARIANT_INFO, type UIVariant } from '@/stores/ui-variant-store'

interface ProfileDropdownProps {
  trigger: ReactNode
  onNavigate?: (item: string) => void
  onOpenEditProfile?: () => void
  onOpenMyPersonas?: () => void
  position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'
}

interface ChatHistoryEntry {
  id: string
  otherPersona: {
    id: string
    name: string
    avatarUrl: string | null
    username: string
    isOnline: boolean
  }
  myPersona: {
    id: string
    name: string
  }
  lastMessage: {
    content: string
    createdAt: string
  } | null
  lastMessageAt: string
}

export function ProfileDropdown({
  trigger,
  onNavigate,
  onOpenEditProfile,
  onOpenMyPersonas,
  position = 'bottom-right'
}: ProfileDropdownProps) {
  const { user, setUser, logout } = useAuth()
  const userIsAdult = user?.dateOfBirth ? isAdult(new Date(user.dateOfBirth)) : false
  const { activePersona } = usePersonas()
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)

  // Portal positioning state
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({})
  // Track whether animation should play (only on initial open, not on position updates)
  const [shouldAnimate, setShouldAnimate] = useState(false)
  const prevIsOpenRef = useRef(false)

  // Chat History state
  const [chatHistory, setChatHistory] = useState<ChatHistoryEntry[]>([])
  const [isLoadingChatHistory, setIsLoadingChatHistory] = useState(false)
  const [showChatHistoryModal, setShowChatHistoryModal] = useState(false)

  // Find Users state
  const [showFindUsers, setShowFindUsers] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)

  // Preferences state
  const [contentMaturity, setContentMaturity] = useState(user?.contentMaturity || 'safe')
  const [theme, setTheme] = useState(user?.theme || 'dark')
  const [isUpdatingMaturity, setIsUpdatingMaturity] = useState(false)
  const [isUpdatingTheme, setIsUpdatingTheme] = useState(false)
  const [isUpdatingNavigation, setIsUpdatingNavigation] = useState(false)

  // UI variant state
  const { variant: uiVariant, setVariant: setUIVariant } = useUIVariant()

  // Variant-specific accent colors
  const variantAccentMap: Record<UIVariant, { border: string; ring: string; bg: string; borderSubtle: string; bgSubtle: string }> = {
    chrona: { border: 'border-teal-400', ring: 'ring-teal-400/40', bg: 'bg-teal-500', borderSubtle: 'border-teal-500/20', bgSubtle: 'bg-teal-500/10' },
    'chrona-v2': { border: 'border-violet-400', ring: 'ring-violet-400/40', bg: 'bg-violet-500', borderSubtle: 'border-violet-500/20', bgSubtle: 'bg-violet-500/10' },
    'chrona-v3': { border: 'border-rose-400', ring: 'ring-rose-400/40', bg: 'bg-rose-500', borderSubtle: 'border-rose-500/20', bgSubtle: 'bg-rose-500/10' },
    horizon: { border: 'border-blue-400', ring: 'ring-blue-400/40', bg: 'bg-blue-500', borderSubtle: 'border-blue-500/20', bgSubtle: 'bg-blue-500/10' },
    pulse: { border: 'border-orange-400', ring: 'ring-orange-400/40', bg: 'bg-orange-500', borderSubtle: 'border-orange-500/20', bgSubtle: 'bg-orange-500/10' },
    nexus: { border: 'border-amber-400', ring: 'ring-amber-400/40', bg: 'bg-amber-500', borderSubtle: 'border-amber-500/20', bgSubtle: 'bg-amber-500/10' },
  }
  const currentAccent = variantAccentMap[uiVariant]

  // Navigation mode state
  const [navigationMode, setNavigationMode] = useState(user?.navigationMode || 'static')

  // Security key state
  const [showSecurityKey, setShowSecurityKey] = useState(false)
  const [securityKeyValue, setSecurityKeyValue] = useState<string | null>(null)
  const [isGeneratingKey, setIsGeneratingKey] = useState(false)
  const [hasCopiedKey, setHasCopiedKey] = useState(false)

  // Friends count
  const [friendsCount, setFriendsCount] = useState(0)

  // Update dropdown position with auto-flip and viewport clamping
  const updateDropdownPosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const DROPDOWN_ESTIMATED_HEIGHT = 600
      const DROPDOWN_ESTIMATED_WIDTH = 380
      const GAP = 8
      const VIEWPORT_PADDING = 8
      const styles: CSSProperties = {
        position: 'fixed',
        zIndex: 9999,
      }

      // Determine effective vertical placement based on available viewport space
      const spaceBelow = window.innerHeight - rect.bottom - GAP
      const spaceAbove = rect.top - GAP
      const isBottom = position.startsWith('bottom')

      // Choose the direction with more space, preferring the requested direction
      const shouldFlipToTop = isBottom && spaceBelow < DROPDOWN_ESTIMATED_HEIGHT && spaceAbove > spaceBelow
      const shouldFlipToBottom = !isBottom && spaceAbove < DROPDOWN_ESTIMATED_HEIGHT && spaceBelow > spaceAbove

      const effectiveIsTop = isBottom ? shouldFlipToTop : !shouldFlipToBottom

      // Calculate available height and set max-height to keep dropdown on screen
      let availableHeight: number
      if (effectiveIsTop) {
        // Position above the trigger
        const bottomEdge = window.innerHeight - rect.top + GAP
        styles.bottom = bottomEdge
        availableHeight = rect.top - GAP - VIEWPORT_PADDING
      } else {
        // Position below the trigger
        const topEdge = rect.bottom + GAP
        styles.top = topEdge
        availableHeight = window.innerHeight - topEdge - VIEWPORT_PADDING
      }

      // Clamp max-height so the dropdown never extends beyond the viewport
      if (availableHeight < DROPDOWN_ESTIMATED_HEIGHT) {
        styles.maxHeight = Math.max(200, availableHeight)
        styles.overflowY = 'auto'
      }

      // Horizontal positioning with auto-flip
      const isRight = position.endsWith('right')
      const spaceToRight = window.innerWidth - rect.left
      const spaceToLeft = rect.right
      const shouldFlipHorizontalRight = isRight && spaceToLeft < DROPDOWN_ESTIMATED_WIDTH && spaceToRight > spaceToLeft
      const shouldFlipHorizontalLeft = !isRight && spaceToRight < DROPDOWN_ESTIMATED_WIDTH && spaceToLeft > spaceToRight
      const effectiveIsRight = isRight ? !shouldFlipHorizontalRight : shouldFlipHorizontalLeft

      if (effectiveIsRight) {
        // Align dropdown's right edge with trigger's right edge
        styles.right = window.innerWidth - rect.right
      } else {
        // Align dropdown's left edge with trigger's left edge
        styles.left = rect.left
      }

      // Clamp to viewport: ensure dropdown never goes off-screen horizontally
      if (styles.left !== undefined && styles.left < VIEWPORT_PADDING) {
        styles.left = VIEWPORT_PADDING
      }
      if (styles.right !== undefined && styles.right < VIEWPORT_PADDING) {
        styles.right = VIEWPORT_PADDING
      }

      setDropdownStyle(styles)
    }
  }, [position])

  // Track animation: only play on initial open, not on position updates
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      // Dropdown just opened - enable animation
      setShouldAnimate(true)
    } else if (!isOpen) {
      // Dropdown closed - reset animation state
      setShouldAnimate(false)
    }
    prevIsOpenRef.current = isOpen
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      updateDropdownPosition()
      const handleResize = () => updateDropdownPosition()
      const handleScroll = () => updateDropdownPosition()
      window.addEventListener('resize', handleResize)
      window.addEventListener('scroll', handleScroll, true)
      return () => {
        window.removeEventListener('resize', handleResize)
        window.removeEventListener('scroll', handleScroll, true)
      }
    }
  }, [isOpen, updateDropdownPosition])

  // Close on Escape
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false)
        setShowChatHistoryModal(false)
      }
    }
    if (isOpen || showChatHistoryModal) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, showChatHistoryModal])

  // Sync preferences
  useEffect(() => {
    if (user) {
      startTransition(() => {
        setContentMaturity(user.contentMaturity || 'safe')
        setTheme(user.theme || 'dark')
        setNavigationMode(user.navigationMode || 'static')
      })
    } else {
      try {
        const stored = localStorage.getItem('chrona-theme')
        if (stored) startTransition(() => { setTheme(stored) })
        const storedNav = localStorage.getItem('chrona-navigation-mode')
        if (storedNav) startTransition(() => { setNavigationMode(storedNav) })
      } catch {}
    }
  }, [user])

  // Apply theme
  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('theme-dark', 'theme-midnight', 'theme-forest', 'theme-light')
    root.classList.add(`theme-${theme}`)
    if (theme === 'light') {
      root.classList.remove('dark')
    } else {
      root.classList.add('dark')
    }
  }, [theme])

  // Fetch data when dropdown opens
  // NOTE: fetchChatHistory and fetchFriendsCount are defined as useCallback
  // before this useEffect to avoid the "access before declaration" error.
  const fetchChatHistory = useCallback(async () => {
    setIsLoadingChatHistory(true)
    try {
      const response = await apiFetch('/api/conversations')
      if (response.ok) {
        const data = await response.json()
        setChatHistory(data.conversations || [])
      }
    } catch (error) {
      console.error('Failed to fetch chat history:', error)
    } finally {
      setIsLoadingChatHistory(false)
    }
  }, [])

  const fetchFriendsCount = useCallback(async () => {
    try {
      const response = await apiFetch('/api/friends')
      if (response.ok) {
        const data = await response.json()
        setFriendsCount(data.friends?.length || 0)
      }
    } catch (error) {
      // Non-critical
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      fetchChatHistory()
      fetchFriendsCount()
    }
  }, [isOpen, fetchChatHistory, fetchFriendsCount])

  const handleUpdateContentMaturity = async (maturity: string) => {
    setIsUpdatingMaturity(true)
    try {
      const response = await apiFetch('/api/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentMaturity: maturity }),
      })
      if (response.ok) {
        setContentMaturity(maturity)
        if (user) {
          setUser({ ...user, contentMaturity: maturity })
        }
      }
    } catch (error) {
      console.error('Failed to update content maturity:', error)
    } finally {
      setIsUpdatingMaturity(false)
    }
  }

  const handleUpdateTheme = async (newTheme: string) => {
    setIsUpdatingTheme(true)
    try {
      localStorage.setItem('chrona-theme', newTheme)
      const response = await apiFetch('/api/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: newTheme }),
      })
      if (response.ok) {
        setTheme(newTheme)
        if (user) {
          setUser({ ...user, theme: newTheme })
        }
      }
    } catch (error) {
      console.error('Failed to update theme:', error)
    } finally {
      setIsUpdatingTheme(false)
    }
  }

  const handleUpdateNavigationMode = async (mode: string) => {
    setIsUpdatingNavigation(true)
    try {
      localStorage.setItem('chrona-navigation-mode', mode)
      const response = await apiFetch('/api/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ navigationMode: mode }),
      })
      if (response.ok) {
        setNavigationMode(mode)
        if (user) {
          setUser({ ...user, navigationMode: mode })
        }
        window.dispatchEvent(new CustomEvent('chrona:navigation-mode-changed', { detail: { mode } }))
      }
    } catch (error) {
      console.error('Failed to update navigation mode:', error)
    } finally {
      setIsUpdatingNavigation(false)
    }
  }

  const handleRevealSecurityKey = async () => {
    setIsGeneratingKey(true)
    try {
      const response = await apiFetch('/api/auth/security-key', {
        method: 'POST',
      })
      if (response.ok) {
        const data = await response.json()
        setSecurityKeyValue(data.securityKey)
        setShowSecurityKey(true)
      }
    } catch (error) {
      console.error('Failed to get security key:', error)
    } finally {
      setIsGeneratingKey(false)
    }
  }

  const copySecurityKey = () => {
    if (securityKeyValue) {
      navigator.clipboard.writeText(securityKeyValue)
      setHasCopiedKey(true)
      setTimeout(() => setHasCopiedKey(false), 2000)
    }
  }

  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    if (query.length < 2) {
      setSearchResults([])
      return
    }
    setIsSearching(true)
    try {
      const response = await apiFetch(`/api/friends/search?q=${encodeURIComponent(query)}`)
      if (response.ok) {
        const data = await response.json()
        setSearchResults(data.users || [])
      }
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsSearching(false)
    }
  }

  const handleStartChat = async (targetPersonaId: string) => {
    if (!activePersona) {
      alert('Please activate a persona first!')
      return
    }
    try {
      const response = await apiFetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetPersonaId, myPersonaId: activePersona.id }),
      })
      const data = await response.json()
      if (response.ok && data.conversation) {
        setShowFindUsers(false)
        setSearchQuery('')
        setSearchResults([])
        onNavigate?.('chat')
      }
    } catch (error) {
      console.error('Failed to start conversation:', error)
    }
  }

  // Dropdown content
  const dropdownContent = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9998]"
        onClick={() => setIsOpen(false)}
      />
      <div
        className="w-[340px] sm:w-[380px] rounded-xl persona-modal shadow-2xl shadow-black/40 overflow-hidden"
        style={{
          ...dropdownStyle,
          animation: shouldAnimate ? 'fadeInScale 0.15s ease-out' : 'none',
        }}
      >
        {/* User Info Header */}
        <div className="px-4 pt-4 pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className={`w-11 h-11 border-2 ${currentAccent.borderSubtle}`}>
                <AvatarImage src={user?.avatarUrl || activePersona?.avatarUrl || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-teal-500 to-cyan-400 text-white text-sm font-semibold">
                  {(user?.username || activePersona?.name || 'U').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-[#0f1117]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-100 truncate">{user?.username || 'User'}</p>
              <p className="text-xs text-slate-500 capitalize">{activePersona ? `as ${activePersona.name}` : 'No active persona'}</p>
            </div>
          </div>
        </div>

        {/* Main Grid: 2-column layout */}
        <div className="grid grid-cols-2 gap-1 p-2">
          {/* Friends */}
          <button
            onClick={() => { setIsOpen(false); onNavigate?.('friends') }}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-white/[0.05] transition-all text-left group"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-500/20 transition-colors">
              <Users className="w-4 h-4 text-amber-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">Friends</p>
              <p className="text-[10px] text-slate-500 truncate">{friendsCount} friends</p>
            </div>
          </button>

          {/* My Personas */}
          <button
            onClick={() => { setIsOpen(false); onOpenMyPersonas?.() }}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-white/[0.05] transition-all text-left group"
          >
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-teal-500/20 transition-colors">
              <User className="w-4 h-4 text-teal-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">My Personas</p>
              <p className="text-[10px] text-slate-500">Manage characters</p>
            </div>
          </button>

          {/* Storylines */}
          <button
            onClick={() => { setIsOpen(false); onNavigate?.('storylines') }}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-white/[0.05] transition-all text-left group"
          >
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-500/20 transition-colors">
              <Compass className="w-4 h-4 text-violet-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">Storylines</p>
              <p className="text-[10px] text-slate-500">Active storylines</p>
            </div>
          </button>

          {/* Chat History */}
          <button
            onClick={() => { setIsOpen(false); setShowChatHistoryModal(true) }}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-white/[0.05] transition-all text-left group"
          >
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-cyan-500/20 transition-colors">
              <History className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">Chat History</p>
              <p className="text-[10px] text-slate-500">{chatHistory.length} recent</p>
            </div>
          </button>

          {/* Settings */}
          <button
            onClick={() => { setIsOpen(false); onOpenEditProfile?.() }}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-white/[0.05] transition-all text-left group"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-slate-500/20 transition-colors">
              <Settings className="w-4 h-4 text-slate-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">Settings</p>
              <p className="text-[10px] text-slate-500">Edit profile</p>
            </div>
          </button>

          {/* Messages */}
          <button
            onClick={() => { setIsOpen(false); setShowFindUsers(true) }}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-white/[0.05] transition-all text-left group"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-500/20 transition-colors">
              <MessageCircle className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">Messages</p>
              <p className="text-[10px] text-slate-500">Find & chat</p>
            </div>
          </button>
        </div>

        {/* Preferences Section */}
        <div className="border-t border-white/[0.06] px-3 py-3">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium px-1 mb-2.5 flex items-center gap-1.5">
            <Palette className="w-3 h-3" />
            Preferences
          </p>
          <div className="space-y-2.5">
            {/* Theme Selector - Only available in Chrona V1 */}
            {uiVariant === 'chrona' ? (
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <Palette className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs text-slate-300">Theme</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {[
                    { id: 'dark', label: 'Dark', color: 'bg-slate-800', ring: 'ring-slate-400' },
                    { id: 'midnight', label: 'Midnight', color: 'bg-indigo-900', ring: 'ring-indigo-400' },
                    { id: 'forest', label: 'Forest', color: 'bg-emerald-900', ring: 'ring-emerald-400' },
                    { id: 'light', label: 'Light', color: 'bg-slate-200', ring: 'ring-slate-500' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleUpdateTheme(t.id)}
                      disabled={isUpdatingTheme}
                      className={`w-6 h-6 rounded-full ${t.color} border-2 transition-all ${
                        theme === t.id
                          ? `${currentAccent.border} ring-2 ${currentAccent.ring} scale-110`
                          : 'border-transparent hover:border-white/20'
                      }`}
                      title={t.label}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between px-2 opacity-40 pointer-events-none">
                <div className="flex items-center gap-2">
                  <Palette className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs text-slate-300">Theme</span>
                </div>
                <span className="text-[9px] text-slate-500 italic">Chrona V1 only</span>
              </div>
            )}

            {/* UI Layout Selector - Revamped */}
            <div className="px-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs text-slate-300">Layout</span>
                </div>
                <span className="text-[9px] text-slate-500 capitalize">{UI_VARIANT_INFO[uiVariant]?.name}</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { 
                    id: 'chrona' as UIVariant, 
                    color: 'bg-teal-500', 
                    ring: 'ring-teal-400',
                    preview: (
                      <div className="flex gap-0.5 items-end h-4">
                        <div className="w-1 h-4 rounded-sm bg-current opacity-80" />
                        <div className="w-2.5 h-3 rounded-sm bg-current opacity-50" />
                        <div className="w-3 h-4 rounded-sm bg-current opacity-30" />
                      </div>
                    )
                  },
                  { 
                    id: 'chrona-v2' as UIVariant, 
                    color: 'bg-violet-500', 
                    ring: 'ring-violet-400',
                    preview: (
                      <div className="flex gap-0.5 items-end h-4">
                        <div className="w-2 h-4 rounded-sm bg-current opacity-40" />
                        <div className="w-3 h-3.5 rounded-sm bg-current opacity-60" />
                        <div className="w-1.5 h-4 rounded-sm bg-current opacity-40" />
                      </div>
                    )
                  },
                  { 
                    id: 'chrona-v3' as UIVariant, 
                    color: 'bg-rose-500', 
                    ring: 'ring-rose-400',
                    preview: (
                      <div className="flex flex-col gap-0.5 items-center h-4">
                        <div className="w-4 h-1.5 rounded-sm bg-current opacity-50" />
                        <div className="w-5 h-2 rounded-sm bg-current opacity-30" />
                      </div>
                    )
                  },
                  { 
                    id: 'horizon' as UIVariant, 
                    color: 'bg-blue-500', 
                    ring: 'ring-blue-400',
                    preview: (
                      <div className="flex flex-col gap-0.5 items-center h-4">
                        <div className="w-5 h-1 rounded-sm bg-current opacity-60" />
                        <div className="w-4 h-2.5 rounded-sm bg-current opacity-40" />
                      </div>
                    )
                  },
                  { 
                    id: 'pulse' as UIVariant, 
                    color: 'bg-orange-500', 
                    ring: 'ring-orange-400',
                    preview: (
                      <div className="flex flex-col gap-0.5 items-center h-4">
                        <div className="w-4 h-2.5 rounded-sm bg-current opacity-40" />
                        <div className="w-5 h-1 rounded-sm bg-current opacity-60" />
                      </div>
                    )
                  },
                  { 
                    id: 'nexus' as UIVariant, 
                    color: 'bg-amber-500', 
                    ring: 'ring-amber-400',
                    preview: (
                      <div className="flex gap-0.5 items-end h-4">
                        <div className="w-1 h-4 rounded-sm bg-current opacity-70" />
                        <div className="w-3 h-3.5 rounded-sm bg-current opacity-50" />
                        <div className="w-1 h-4 rounded-sm bg-current opacity-70" />
                      </div>
                    )
                  },
                ]).map((item) => {
                  const info = UI_VARIANT_INFO[item.id]
                  const isActive = uiVariant === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        // Don't do anything if already on this variant
                        if (isActive) return
                        // Close dropdown first, then change layout after a delay
                        // The delay ensures the dropdown unmounts cleanly before
                        // the entire shell layout swaps, preventing React errors
                        setIsOpen(false)
                        setTimeout(() => {
                          setUIVariant(item.id)
                        }, 150)
                      }}
                      className={`relative px-2.5 py-2 rounded-lg text-[11px] font-medium border transition-all duration-200 flex flex-col items-start gap-1.5 group ${
                        isActive
                          ? `text-white ${info.accentBg} ${info.accentBorder} shadow-lg`
                          : 'text-slate-400 bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12] hover:text-slate-300 hover:bg-white/[0.04]'
                      }`}
                      title={info.description}
                    >
                      <div className="flex items-center gap-2 w-full">
                        <div className={`${isActive ? 'text-white opacity-90' : 'text-slate-500 group-hover:text-slate-400'} transition-colors`}>
                          {item.preview}
                        </div>
                        <span className={`font-medium ${isActive ? 'text-slate-100' : ''}`}>{info.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${item.color} ${isActive ? 'ring-2 ring-white/30' : 'opacity-50'} transition-all`} />
                        <span className="text-[9px] text-slate-500">{info.accent}</span>
                      </div>
                      {isActive && (
                        <div className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${item.color} shadow-lg animate-pulse`} />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Navigation Mode - Only available in Chrona V1 */}
            {uiVariant === 'chrona' ? (
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <PanelLeft className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs text-slate-300">Navigation</span>
                </div>
                <div className="flex items-center gap-1">
                  {[
                    { id: 'static', label: 'Static', icon: PanelLeft, color: 'text-teal-400 bg-teal-500/10 border-teal-500/20' },
                    { id: 'linear', label: 'Linear', icon: LayoutList, color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
                  ].map((n) => (
                    <button
                      key={n.id}
                      onClick={() => handleUpdateNavigationMode(n.id)}
                      disabled={isUpdatingNavigation}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-all flex items-center gap-1 ${
                        navigationMode === n.id
                          ? n.color
                          : 'text-slate-500 bg-transparent border-white/[0.06] hover:border-white/10'
                      }`}
                    >
                      <n.icon className="w-3 h-3" />
                      {n.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between px-2 opacity-40 pointer-events-none">
                <div className="flex items-center gap-2">
                  <PanelLeft className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs text-slate-300">Navigation</span>
                </div>
                <span className="text-[9px] text-slate-500 italic">Chrona V1 only</span>
              </div>
            )}

            {/* Content Maturity */}
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                {contentMaturity === 'safe' ? (
                  <Eye className="w-3.5 h-3.5 text-emerald-400" />
                ) : contentMaturity === 'mature' ? (
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5 text-red-400" />
                )}
                <span className="text-xs text-slate-300">Content Maturity</span>
                {!userIsAdult && (
                  <span className="relative group">
                    <Lock className="w-3 h-3 text-slate-500 cursor-help" />
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded text-[9px] text-slate-300 bg-slate-800 border border-white/10 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                      Content maturity is restricted for users under 18
                    </span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {[
                  { id: 'safe', label: 'Safe', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
                  { id: 'mature', label: 'Mature', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
                  { id: 'unrestricted', label: 'All', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
                ].map((m) => {
                  const isLocked = !userIsAdult && m.id !== 'safe'
                  return (
                    <button
                      key={m.id}
                      onClick={() => !isLocked && handleUpdateContentMaturity(m.id)}
                      disabled={isUpdatingMaturity || isLocked}
                      title={isLocked ? 'Content maturity is restricted for users under 18' : undefined}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-all flex items-center gap-0.5 ${
                        isLocked
                          ? 'text-slate-600 bg-transparent border-white/[0.04] cursor-not-allowed opacity-50'
                          : contentMaturity === m.id
                            ? m.color
                            : 'text-slate-500 bg-transparent border-white/[0.06] hover:border-white/10'
                      }`}
                    >
                      {isLocked && <Lock className="w-2.5 h-2.5" />}
                      {m.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Account Security Key */}
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs text-slate-300">Account Security Key</span>
              </div>
              {showSecurityKey && securityKeyValue ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-slate-400 max-w-[80px] truncate">{securityKeyValue}</span>
                  <button
                    onClick={copySecurityKey}
                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/[0.06] transition-colors"
                    title="Copy key"
                  >
                    {hasCopiedKey ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleRevealSecurityKey}
                  disabled={isGeneratingKey}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/15 transition-all disabled:opacity-50"
                >
                  {isGeneratingKey ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <>
                      <Shield className="w-3 h-3" />
                      Reveal
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Logout */}
        <div className="border-t border-white/[0.06] px-3 py-2">
          <button
            onClick={() => { logout(); setIsOpen(false) }}
            className="flex items-center gap-2.5 w-full px-2 py-2 rounded-lg hover:bg-red-500/10 transition-all text-left group"
          >
            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-red-500/20 transition-colors">
              <LogOut className="w-4 h-4 text-red-400" />
            </div>
            <p className="text-sm font-medium text-red-400 group-hover:text-red-300 transition-colors">Log Out</p>
          </button>
        </div>
      </div>
    </>
  )

  // Listen for external open-find-users event
  useEffect(() => {
    const handleOpenFindUsers = () => {
      setIsOpen(false)
      setShowFindUsers(true)
    }
    window.addEventListener('chrona:open-find-users', handleOpenFindUsers)
    return () => window.removeEventListener('chrona:open-find-users', handleOpenFindUsers)
  }, [])

  return (
    <>
      <div ref={triggerRef} onClick={() => setIsOpen(!isOpen)}>
        {trigger}
      </div>
      {isOpen && typeof document !== 'undefined' && createPortal(dropdownContent, document.body)}

      {/* Find Users Modal */}
      {showFindUsers && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowFindUsers(false); setSearchQuery(''); setSearchResults([]) }} />
          <div className="relative w-full max-w-md mx-4 rounded-xl bg-[#0f1117] border border-white/[0.08] shadow-2xl shadow-black/40 overflow-hidden" style={{ animation: 'fadeInScale 0.15s ease-out' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-slate-100">Find Users</h3>
              </div>
              <button
                onClick={() => { setShowFindUsers(false); setSearchQuery(''); setSearchResults([]) }}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input */}
            <div className="px-4 py-3 border-b border-white/[0.04]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search by username..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  autoFocus
                  className="w-full h-9 pl-9 pr-3 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/30 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />
                )}
              </div>
            </div>

            {/* Results */}
            <div className="max-h-80 overflow-y-auto">
              {searchQuery.length < 2 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <Users className="w-8 h-8 text-slate-600 mb-2" />
                  <p className="text-sm text-slate-400">Type at least 2 characters to search</p>
                </div>
              ) : isSearching ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                </div>
              ) : searchResults.length > 0 ? (
                <div className="p-2 space-y-1">
                  {searchResults.map((result: any) => (
                    <button
                      key={result.id}
                      onClick={() => handleStartChat(result.activePersona?.id || result.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.04] transition-colors text-left"
                    >
                      <div className="relative">
                        <Avatar className="w-9 h-9 border border-white/10">
                          <AvatarImage src={result.activePersona?.avatarUrl || result.avatarUrl || undefined} />
                          <AvatarFallback className="bg-gradient-to-br from-emerald-500/40 to-teal-500/50 text-white text-xs font-medium">
                            {(result.activePersona?.name || result.username || 'U').charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {result.activePersona?.isOnline && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#0f1117]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-100 truncate">{result.username}</p>
                        {result.activePersona && (
                          <p className="text-xs text-slate-500">as {result.activePersona.name}</p>
                        )}
                      </div>
                      <MessageCircle className="w-4 h-4 text-slate-500" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <Search className="w-8 h-8 text-slate-600 mb-2" />
                  <p className="text-sm text-slate-400">No users found</p>
                  <p className="text-xs text-slate-500 mt-1">Try a different search term</p>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Chat History Modal */}
      {showChatHistoryModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowChatHistoryModal(false)} />
          <div className="relative w-full max-w-md mx-4 rounded-xl bg-[#0f1117] border border-white/[0.08] shadow-2xl shadow-black/40 overflow-hidden" style={{ animation: 'fadeInScale 0.15s ease-out' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-slate-100">Chat History</h3>
              </div>
              <button
                onClick={() => setShowChatHistoryModal(false)}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Chat List */}
            <div className="max-h-96 overflow-y-auto">
              {isLoadingChatHistory ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                </div>
              ) : chatHistory.length > 0 ? (
                <div className="p-2 space-y-1">
                  {chatHistory.map((chat) => (
                    <button
                      key={chat.id}
                      onClick={() => {
                        setShowChatHistoryModal(false)
                        onNavigate?.('chat')
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.04] transition-colors text-left"
                    >
                      <div className="relative">
                        <Avatar className="w-9 h-9 border border-white/10">
                          <AvatarImage src={chat.otherPersona.avatarUrl || undefined} />
                          <AvatarFallback className="bg-gradient-to-br from-cyan-500/40 to-blue-500/50 text-white text-xs font-medium">
                            {chat.otherPersona.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {chat.otherPersona.isOnline && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#0f1117]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-100 truncate">{chat.otherPersona.name}</p>
                        {chat.lastMessage ? (
                          <p className="text-xs text-slate-500 truncate">{chat.lastMessage.content}</p>
                        ) : (
                          <p className="text-xs text-slate-600">No messages yet</p>
                        )}
                      </div>
                      {chat.lastMessage && (
                        <span className="text-[10px] text-slate-600 flex-shrink-0">
                          {new Date(chat.lastMessage.createdAt).toLocaleDateString()}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <History className="w-8 h-8 text-slate-600 mb-2" />
                  <p className="text-sm text-slate-400">No chat history</p>
                  <p className="text-xs text-slate-500 mt-1">Start a conversation to see it here</p>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
