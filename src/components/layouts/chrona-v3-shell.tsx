'use client'

import { useState, useEffect, useCallback, useRef, useMemo, startTransition } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { usePersonas } from '@/hooks/use-personas'
import { useUIVariant } from '@/stores/ui-variant-store'
import { apiFetch } from '@/lib/api-client'
import { canAccessAdminPanel } from '@/lib/roles'
import { useIsMobile } from '@/hooks/use-mobile'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ProfileDropdown } from '@/components/profile-dropdown'

import {
  Compass,
  Users,
  Crown,
  MessageCircle,
  ShoppingBag,
  Wallet,
  Trophy,
  Shield,
  Settings,
  Search,
  Sparkles,
  LogOut,
  X,
  Circle,
  Plus,
  Loader2,
  PanelRightClose,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChronaV3ShellProps {
  activeTab: 'home' | 'friends' | 'storylines' | 'chat' | 'wallet' | 'admin' | 'marketplace'
  activeStorylineId: string | null
  activeChat: any | null
  onSelectTab: (tab: any) => void
  onSelectStoryline: (storylineId: string) => void
  onSelectChat: (conversationId: string) => void
  onStartChat: (conv: any) => void
  onNavigate: (item: string) => void
  onOpenEditProfile: () => void
  onOpenMyPersonas: () => void
  onCreatePersona: () => void
  children: React.ReactNode
}

interface OnlinePersona {
  id: string
  name: string
  avatarUrl: string | null
  isOnline: boolean
  user?: {
    username: string
  }
}

interface DMConversation {
  id: string
  otherPersona: {
    id: string
    name: string
    avatarUrl: string | null
    isOnline: boolean
  }
  lastMessage?: {
    content: string
    createdAt: string
  } | null
  lastMessageAt: string
  unreadCount?: number
}

// ─── Nav Item Definition ─────────────────────────────────────────────────────

interface NavPillItem {
  id: string
  icon: React.ElementType
  label: string
  tab?: ChronaV3ShellProps['activeTab']
  action?: () => void
  staffOnly?: boolean
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ChronaV3Shell({
  activeTab,
  activeStorylineId,
  activeChat,
  onSelectTab,
  onSelectStoryline,
  onSelectChat,
  onStartChat,
  onNavigate,
  onOpenEditProfile,
  onOpenMyPersonas,
  onCreatePersona,
  children,
}: ChronaV3ShellProps) {
  const { user } = useAuth()
  const { activePersona, personas, activatePersona } = usePersonas()
  const { variant: uiVariant } = useUIVariant()
  const isMobile = useIsMobile()

  // ─── Panel State ─────────────────────────────────────────────────────────
  const [dmDrawerOpen, setDmDrawerOpen] = useState(false)
  const [dmSearchQuery, setDmSearchQuery] = useState('')

  // ─── Data State ──────────────────────────────────────────────────────────
  const [onlinePersonas, setOnlinePersonas] = useState<OnlinePersona[]>([])
  const [dmConversations, setDmConversations] = useState<DMConversation[]>([])
  const [isLoadingOnline, setIsLoadingOnline] = useState(true)
  const [isLoadingConversations, setIsLoadingConversations] = useState(true)

  // ─── Staff check ────────────────────────────────────────────────────────
  const isStaff = useMemo(() => {
    if (!user?.role) return false
    return canAccessAdminPanel(user.role)
  }, [user?.role])

  // ─── Nav Pill Items ──────────────────────────────────────────────────────
  const navPillItems: NavPillItem[] = useMemo(() => [
    { id: 'discover', icon: Compass, label: 'Discover', tab: 'home' },
    { id: 'friends', icon: Users, label: 'Friends', tab: 'friends' },
    { id: 'storylines', icon: Crown, label: 'Storylines', tab: 'storylines' },
    { id: 'marketplace', icon: ShoppingBag, label: 'Marketplace', tab: 'marketplace' },
    { id: 'chronos', icon: Wallet, label: 'Chronos', tab: 'wallet' },
    {
      id: 'achievements',
      icon: Trophy,
      label: 'Achievements',
      action: () => window.dispatchEvent(new CustomEvent('chrona:open-achievements')),
    },
    { id: 'admin', icon: Shield, label: 'Admin', tab: 'admin', staffOnly: true },
  ], [])

  const visibleNavItems = useMemo(
    () => navPillItems.filter((item) => !item.staffOnly || isStaff),
    [navPillItems, isStaff]
  )

  // ─── Data Fetching ──────────────────────────────────────────────────────

  // Fetch online personas
  const fetchOnlinePersonas = useCallback(async () => {
    try {
      const response = await apiFetch('/api/personas/online')
      if (response.ok) {
        const data = await response.json()
        setOnlinePersonas(data.personas || [])
      }
    } catch (error) {
      console.error('Failed to fetch online personas:', error)
    } finally {
      setIsLoadingOnline(false)
    }
  }, [])

  // Fetch DM conversations
  const fetchConversations = useCallback(async () => {
    setIsLoadingConversations(true)
    try {
      const response = await apiFetch('/api/conversations')
      if (response.ok) {
        const data = await response.json()
        setDmConversations(data.conversations || [])
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error)
    } finally {
      setIsLoadingConversations(false)
    }
  }, [])

  // Initial data fetch
  useEffect(() => {
    startTransition(() => {
      fetchOnlinePersonas()
      fetchConversations()
    })

    // Refresh online list every 60s
    const interval = setInterval(fetchOnlinePersonas, 60_000)
    return () => clearInterval(interval)
  }, [fetchOnlinePersonas, fetchConversations])

  // Listen for refresh events
  useEffect(() => {
    const handleDMRefresh = () => fetchConversations()

    window.addEventListener('chrona:dm-refresh', handleDMRefresh)

    return () => {
      window.removeEventListener('chrona:dm-refresh', handleDMRefresh)
    }
  }, [fetchConversations])

  // ─── Responsive: close drawer on mobile when navigating ──────────────────
  useEffect(() => {
    if (isMobile && dmDrawerOpen) {
      // Auto-close on mobile isn't needed unless navigating away
    }
  }, [isMobile])

  // ─── Persona switching ────────────────────────────────────────────────────
  const handleActivatePersona = useCallback(async (personaId: string) => {
    try {
      await activatePersona(personaId)
    } catch (error) {
      console.error('Failed to activate persona:', error)
    }
  }, [activatePersona])

  // ─── Nav Pill Click Handler ──────────────────────────────────────────────

  const handleNavPillClick = useCallback(
    (item: NavPillItem) => {
      if (item.tab) onSelectTab(item.tab)
      else if (item.action) item.action()
    },
    [onSelectTab]
  )

  // ─── Time Formatting ────────────────────────────────────────────────────

  const formatRelativeTime = (dateStr: string) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'now'
    if (diffMins < 60) return `${diffMins}m`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h`
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d`
  }

  // ─── Compute avatar display ──────────────────────────────────────────────
  const avatarSrc = user?.avatarUrl || activePersona?.avatarUrl || undefined
  const avatarFallback =
    (user?.username || activePersona?.name || 'U').charAt(0).toUpperCase()

  // ─── Compute total unread count for DM badge ────────────────────────────
  const totalUnreadDMs = useMemo(
    () => dmConversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0),
    [dmConversations]
  )

  // ─── Filtered DM conversations ──────────────────────────────────────────
  const filteredDMConversations = useMemo(() => {
    if (!dmSearchQuery.trim()) return dmConversations
    const q = dmSearchQuery.toLowerCase()
    return dmConversations.filter(
      (conv) =>
        conv.otherPersona.name.toLowerCase().includes(q) ||
        (conv.lastMessage?.content && conv.lastMessage.content.toLowerCase().includes(q))
    )
  }, [dmConversations, dmSearchQuery])

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0d0a0b] text-rose-50">
      {/* ====== TOP BAR ====== */}
      <header className="flex-shrink-0 h-14 bg-[#0d0a0b]/80 backdrop-blur-xl border-b border-rose-500/[0.08] z-40">
        <div className="flex items-center h-full px-4 lg:px-8 gap-4">
          {/* Left: Logo */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-lg shadow-rose-500/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold bg-gradient-to-r from-rose-400 to-pink-400 bg-clip-text text-transparent hidden sm:inline tracking-wide">
              Chrona
            </span>
          </div>

          {/* Center: Navigation Pills */}
          <nav className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-1 bg-white/[0.02] rounded-full p-1 border border-white/[0.04]">
              {visibleNavItems.map((item) => {
                const isActive = item.tab === activeTab
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavPillClick(item)}
                    className={`
                      flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                      transition-all duration-200 whitespace-nowrap
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50
                      ${
                        isActive
                          ? 'bg-rose-500/15 text-rose-400 shadow-sm shadow-rose-500/10'
                          : 'text-rose-200/40 hover:text-rose-200/70 hover:bg-white/[0.04]'
                      }
                    `}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">{item.label}</span>
                  </button>
                )
              })}
            </div>
          </nav>

          {/* Right: Chat icon + Profile Dropdown + Avatar */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* DM Drawer Toggle */}
            <button
              onClick={() => setDmDrawerOpen((prev) => !prev)}
              className={`
                relative w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50
                ${
                  dmDrawerOpen
                    ? 'bg-rose-500/15 text-rose-400'
                    : 'text-rose-200/40 hover:text-rose-200/70 hover:bg-white/[0.04]'
                }
              `}
              title="Messages"
            >
              <MessageCircle className="w-[18px] h-[18px]" />
              {totalUnreadDMs > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center shadow-lg shadow-rose-500/40">
                  {totalUnreadDMs > 99 ? '99+' : totalUnreadDMs}
                </span>
              )}
            </button>

            {/* Create Persona */}
            <button
              onClick={onCreatePersona}
              className="w-9 h-9 rounded-full flex items-center justify-center text-rose-200/40 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50"
              title="Create Persona"
            >
              <Plus className="w-[18px] h-[18px]" />
            </button>

            {/* Profile Dropdown */}
            <ProfileDropdown
              onNavigate={onNavigate}
              onOpenEditProfile={onOpenEditProfile}
              onOpenMyPersonas={onOpenMyPersonas}
              position="bottom-right"
              trigger={
                <button className="relative w-9 h-9 rounded-full flex items-center justify-center hover:bg-rose-500/10 transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50">
                  <div className="relative">
                    <Avatar className="w-8 h-8 border-2 border-rose-500/25">
                      <AvatarImage src={avatarSrc} />
                      <AvatarFallback className="bg-gradient-to-br from-rose-500 to-pink-600 text-white text-[10px] font-bold">
                        {avatarFallback}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#0d0a0b]" />
                  </div>
                </button>
              }
            />
          </div>
        </div>
      </header>

      {/* ====== MAIN CONTENT AREA ====== */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Content column — each page handles its own max-width */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          {children}
        </main>

        {/* ====== DM DRAWER (Slide-in from right) ====== */}
        {/* Backdrop overlay (mobile only) */}
        {dmDrawerOpen && isMobile && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300"
            onClick={() => setDmDrawerOpen(false)}
          />
        )}

        {/* Drawer panel */}
        <div
          className={`
            ${
              isMobile
                ? `fixed inset-y-0 right-0 z-50 w-full sm:w-80 ${dmDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`
                : `relative flex-shrink-0 flex flex-col transition-all duration-300 overflow-hidden ${dmDrawerOpen ? 'w-80' : 'w-0'}`
            }
            bg-[#0d0a0b] border-l border-rose-500/[0.08]
            transition-transform duration-300 ease-out
          `}
        >
          {dmDrawerOpen && (
            <>
              {/* DM Drawer Header */}
              <div className="h-14 px-4 flex items-center justify-between border-b border-rose-500/[0.08] flex-shrink-0">
                <div className="flex items-center gap-2.5">
                  <MessageCircle className="w-4 h-4 text-rose-400" />
                  <span className="text-xs font-semibold text-rose-200/60 uppercase tracking-widest">
                    Messages
                  </span>
                </div>
                <button
                  onClick={() => setDmDrawerOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-rose-200/30 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-200"
                >
                  <PanelRightClose className="w-4 h-4" />
                </button>
              </div>

              {/* DM Search */}
              <div className="px-4 py-3 border-b border-rose-500/[0.04] flex-shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-rose-200/20" />
                  <Input
                    value={dmSearchQuery}
                    onChange={(e) => setDmSearchQuery(e.target.value)}
                    placeholder="Search conversations..."
                    className="h-8 pl-9 pr-3 text-xs bg-white/[0.02] border-rose-500/[0.08] text-rose-100 placeholder:text-rose-200/20 focus-visible:border-rose-500/30 focus-visible:ring-rose-500/20 rounded-full"
                  />
                  {dmSearchQuery && (
                    <button
                      onClick={() => setDmSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-rose-200/20 hover:text-rose-400 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-3 space-y-4">
                  {/* Online Personas Section */}
                  <div>
                    <div className="flex items-center gap-2 mb-2.5 px-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[10px] font-semibold text-rose-200/30 uppercase tracking-widest">
                        Online — {onlinePersonas.length}
                      </span>
                      {isLoadingOnline && (
                        <Loader2 className="w-3 h-3 animate-spin text-rose-400/40" />
                      )}
                    </div>
                    {isLoadingOnline ? (
                      <div className="space-y-2">
                        {[...Array(4)].map((_, i) => (
                          <div key={i} className="flex items-center gap-2.5 px-1">
                            <div className="w-8 h-8 rounded-full bg-rose-500/[0.04] animate-pulse" />
                            <div className="flex-1">
                              <div className="h-3 w-20 bg-rose-500/[0.04] rounded animate-pulse mb-1" />
                              <div className="h-2 w-14 bg-rose-500/[0.04] rounded animate-pulse" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : onlinePersonas.length > 0 ? (
                      <div className="space-y-0.5">
                        {onlinePersonas.slice(0, 8).map((persona) => (
                          <button
                            key={persona.id}
                            onClick={() => {
                              if (activePersona) {
                                onStartChat({ targetPersonaId: persona.id, myPersonaId: activePersona.id })
                              }
                            }}
                            className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-rose-500/[0.06] transition-all duration-200 group text-left"
                          >
                            <div className="relative flex-shrink-0">
                              <Avatar className="w-8 h-8 border border-rose-500/20">
                                <AvatarImage src={persona.avatarUrl || undefined} />
                                <AvatarFallback className="bg-gradient-to-br from-rose-500/40 to-pink-500/50 text-white text-[9px] font-medium">
                                  {persona.name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full border-2 border-[#0d0a0b]" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-rose-200/60 group-hover:text-rose-200 truncate transition-colors">
                                {persona.name}
                              </p>
                              <p className="text-[10px] text-rose-200/20">
                                {persona.user?.username}
                              </p>
                            </div>
                          </button>
                        ))}
                        {onlinePersonas.length > 8 && (
                          <p className="text-[10px] text-rose-200/20 text-center pt-1 px-2">
                            +{onlinePersonas.length - 8} more online
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <Users className="w-5 h-5 text-rose-200/10 mb-2" />
                        <p className="text-[11px] text-rose-200/20">Nobody online right now</p>
                      </div>
                    )}
                  </div>

                  <Separator className="bg-rose-500/[0.06]" />

                  {/* DM Conversations Section */}
                  <div>
                    <div className="flex items-center gap-2 mb-2.5 px-1">
                      <span className="text-[10px] font-semibold text-rose-200/30 uppercase tracking-widest">
                        Conversations
                      </span>
                      {isLoadingConversations && (
                        <Loader2 className="w-3 h-3 animate-spin text-rose-400/40" />
                      )}
                    </div>
                    {isLoadingConversations ? (
                      <div className="space-y-1.5">
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className="flex items-center gap-2.5 px-2 py-2">
                            <div className="w-8 h-8 rounded-full bg-rose-500/[0.04] animate-pulse" />
                            <div className="flex-1">
                              <div className="h-3 w-20 bg-rose-500/[0.04] rounded animate-pulse mb-1" />
                              <div className="h-2 w-28 bg-rose-500/[0.04] rounded animate-pulse" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : filteredDMConversations.length > 0 ? (
                      <div className="space-y-0.5">
                        {filteredDMConversations.map((conv) => {
                          const isActive = activeChat?.id === conv.id
                          return (
                            <button
                              key={conv.id}
                              onClick={() => onSelectChat(conv.id)}
                              className={`w-full flex items-center gap-2.5 px-2 py-2.5 rounded-xl transition-all duration-200 group text-left ${
                                isActive
                                  ? 'bg-rose-500/10'
                                  : 'hover:bg-rose-500/[0.06]'
                              }`}
                            >
                              <div className="relative flex-shrink-0">
                                <Avatar className={`w-9 h-9 border ${isActive ? 'border-rose-500/40' : 'border-rose-500/15'}`}>
                                  <AvatarImage src={conv.otherPersona.avatarUrl || undefined} />
                                  <AvatarFallback className="bg-gradient-to-br from-rose-500/40 to-pink-500/50 text-white text-[10px] font-medium">
                                    {conv.otherPersona.name.charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                {conv.otherPersona.isOnline && (
                                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#0d0a0b]" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between">
                                  <p className={`text-xs font-medium truncate ${
                                    isActive ? 'text-rose-300' : 'text-rose-200/60 group-hover:text-rose-200/80'
                                  }`}>
                                    {conv.otherPersona.name}
                                  </p>
                                  {conv.lastMessage && (
                                    <span className="text-[9px] text-rose-200/15 flex-shrink-0 ml-1">
                                      {formatRelativeTime(conv.lastMessage.createdAt)}
                                    </span>
                                  )}
                                </div>
                                {conv.lastMessage && (
                                  <p className="text-[10px] text-rose-200/20 truncate mt-0.5">
                                    {conv.lastMessage.content}
                                  </p>
                                )}
                              </div>
                              {conv.unreadCount && conv.unreadCount > 0 && (
                                <Badge className="h-4 px-1.5 text-[9px] bg-rose-500/20 text-rose-400 border-rose-500/30 flex-shrink-0">
                                  {conv.unreadCount}
                                </Badge>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <MessageCircle className="w-5 h-5 text-rose-200/10 mb-2" />
                        <p className="text-[11px] text-rose-200/20">
                          {dmSearchQuery ? 'No matching conversations' : 'No conversations yet'}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* My Personas Quick Access */}
                  {personas.length > 0 && (
                    <>
                      <Separator className="bg-rose-500/[0.06]" />
                      <div>
                        <div className="flex items-center gap-2 mb-2.5 px-1">
                          <span className="text-[10px] font-semibold text-rose-200/30 uppercase tracking-widest">
                            Characters
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          {personas.slice(0, 5).map((persona) => (
                            <button
                              key={persona.id}
                              onClick={() => handleActivatePersona(persona.id)}
                              className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-all duration-200 group ${
                                persona.isActive
                                  ? 'bg-rose-500/10'
                                  : 'hover:bg-rose-500/[0.06]'
                              }`}
                            >
                              <Avatar className="w-6 h-6 border border-rose-500/20">
                                <AvatarImage src={persona.avatarUrl || undefined} />
                                <AvatarFallback className="bg-gradient-to-br from-rose-500/40 to-pink-500/50 text-white text-[9px] font-medium">
                                  {persona.name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className={`text-[11px] truncate ${
                                persona.isActive ? 'text-rose-400 font-medium' : 'text-rose-200/40 group-hover:text-rose-200/70'
                              }`}>
                                {persona.name}
                              </span>
                              {persona.isActive && (
                                <Circle className="w-2 h-2 fill-rose-400 text-rose-400 ml-auto flex-shrink-0" />
                              )}
                            </button>
                          ))}
                          {personas.length < 10 && (
                            <button
                              onClick={onCreatePersona}
                              className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-rose-500/[0.06] transition-all duration-200 text-rose-200/20 hover:text-rose-400"
                            >
                              <div className="w-6 h-6 rounded border border-dashed border-rose-500/15 flex items-center justify-center">
                                <Plus className="w-3 h-3" />
                              </div>
                              <span className="text-[11px]">Create new</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </ScrollArea>
            </>
          )}
        </div>
      </div>

      {/* ====== GLOBAL STYLES ====== */}
      <style jsx global>{`
        /* Safe area padding for mobile */
        .safe-area-bottom {
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }

        /* Custom scrollbar for chrona-v3 theme */
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(244, 63, 94, 0.08);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(244, 63, 94, 0.14);
        }

        /* Zen pulse animation for active elements */
        @keyframes zen-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}
