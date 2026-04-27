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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  PanelRightClose,
  PanelRight,
  Search,
  Command,
  AtSign,
  Activity,
  Sparkles,
  LogOut,
  X,
  Hash,
  Circle,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface NexusShellProps {
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

interface StorylineActivity {
  id: string
  name: string
  iconUrl: string | null
  lastActivity: string
  unreadCount?: number
}

interface MentionItem {
  id: string
  fromPersona: {
    name: string
    avatarUrl: string | null
  }
  storylineName: string
  content: string
  createdAt: string
}

// ─── Nav Item Definition ─────────────────────────────────────────────────────

interface NavItem {
  id: string
  icon: React.ElementType
  label: string
  shortcut: string
  tab?: NexusShellProps['activeTab']
  action?: () => void
  staffOnly?: boolean
}

// ─── Command Palette Item ────────────────────────────────────────────────────

interface CommandItem {
  id: string
  label: string
  shortcut?: string
  icon: React.ElementType
  action: () => void
  category: 'nav' | 'action'
}

// ─── Component ───────────────────────────────────────────────────────────────

export function NexusShell({
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
}: NexusShellProps) {
  const { user, logout } = useAuth()
  const { activePersona, personas } = usePersonas()
  const isMobile = useIsMobile()

  // ─── Panel State ─────────────────────────────────────────────────────────
  const [activityPanelOpen, setActivityPanelOpen] = useState(!isMobile)
  const [dmPanelOpen, setDmPanelOpen] = useState(!isMobile)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [commandQuery, setCommandQuery] = useState('')
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0)

  // ─── Data State ──────────────────────────────────────────────────────────
  const [onlinePersonas, setOnlinePersonas] = useState<OnlinePersona[]>([])
  const [mentions, setMentions] = useState<MentionItem[]>([])
  const [storylineActivity, setStorylineActivity] = useState<StorylineActivity[]>([])
  const [dmConversations, setDmConversations] = useState<DMConversation[]>([])
  const [isLoadingOnline, setIsLoadingOnline] = useState(true)
  const [isLoadingConversations, setIsLoadingConversations] = useState(true)
  const [isLoadingActivity, setIsLoadingActivity] = useState(true)

  const commandInputRef = useRef<HTMLInputElement>(null)
  const selectedCommandRef = useRef<HTMLButtonElement>(null)

  // ─── Responsive panel collapse ──────────────────────────────────────────
  useEffect(() => {
    if (isMobile) {
      startTransition(() => {
        setActivityPanelOpen(false)
        setDmPanelOpen(false)
      })
    }
  }, [isMobile])

  // ─── Staff check ────────────────────────────────────────────────────────
  const isStaff = useMemo(() => {
    if (!user?.role) return false
    return canAccessAdminPanel(user.role)
  }, [user?.role])

  // ─── Nav Items ──────────────────────────────────────────────────────────
  const navItems: NavItem[] = useMemo(() => [
    { id: 'discover', icon: Compass, label: 'Discover', shortcut: '⌘1', tab: 'home' },
    { id: 'friends', icon: Users, label: 'Friends', shortcut: '⌘2', tab: 'friends' },
    { id: 'storylines', icon: Crown, label: 'Storylines', shortcut: '⌘3', tab: 'storylines' },
    { id: 'chat', icon: MessageCircle, label: 'Chat', shortcut: '⌘4', tab: 'chat' },
    { id: 'marketplace', icon: ShoppingBag, label: 'Marketplace', shortcut: '⌘5', tab: 'marketplace' },
    { id: 'chronos', icon: Wallet, label: 'Chronos', shortcut: '⌘6', tab: 'wallet' },
    {
      id: 'achievements',
      icon: Trophy,
      label: 'Achievements',
      shortcut: '⌘7',
      action: () => window.dispatchEvent(new CustomEvent('chrona:open-achievements')),
    },
    { id: 'admin', icon: Shield, label: 'Admin', shortcut: '⌘8', tab: 'admin', staffOnly: true },
  ], [])

  const visibleNavItems = useMemo(
    () => navItems.filter((item) => !item.staffOnly || isStaff),
    [navItems, isStaff]
  )

  // ─── Command Palette Items ──────────────────────────────────────────────
  const commandItems: CommandItem[] = useMemo(() => {
    const items: CommandItem[] = [
      ...visibleNavItems.map((item) => ({
        id: item.id,
        label: item.label,
        shortcut: item.shortcut,
        icon: item.icon,
        action: () => {
          if (item.tab) onSelectTab(item.tab)
          else if (item.action) item.action()
          setCommandPaletteOpen(false)
          setCommandQuery('')
        },
        category: 'nav' as const,
      })),
      {
        id: 'edit-profile',
        label: 'Edit Profile',
        shortcut: '⌘P',
        icon: Settings,
        action: () => { onOpenEditProfile(); setCommandPaletteOpen(false); setCommandQuery('') },
        category: 'action',
      },
      {
        id: 'my-personas',
        label: 'My Characters',
        shortcut: '⌘⇧P',
        icon: Users,
        action: () => { onOpenMyPersonas(); setCommandPaletteOpen(false); setCommandQuery('') },
        category: 'action',
      },
      {
        id: 'create-persona',
        label: 'Create Character',
        shortcut: '⌘N',
        icon: Sparkles,
        action: () => { onCreatePersona(); setCommandPaletteOpen(false); setCommandQuery('') },
        category: 'action',
      },
    ]
    return items
  }, [visibleNavItems, onSelectTab, onOpenEditProfile, onOpenMyPersonas, onCreatePersona])

  const filteredCommands = useMemo(() => {
    if (!commandQuery.trim()) return commandItems
    const q = commandQuery.toLowerCase()
    return commandItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q)
    )
  }, [commandItems, commandQuery])

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

  // Fetch storyline activity
  const fetchStorylineActivity = useCallback(async () => {
    setIsLoadingActivity(true)
    try {
      const response = await apiFetch('/api/storylines/joined')
      if (response.ok) {
        const data = await response.json()
        const storylines = (data.storylines || []).map((sl: any) => ({
          id: sl.id,
          name: sl.name,
          iconUrl: sl.iconUrl,
          lastActivity: sl.lastActivity || sl.updatedAt || '',
          unreadCount: sl.unreadCount || 0,
        }))
        setStorylineActivity(storylines)
      }
    } catch (error) {
      console.error('Failed to fetch storyline activity:', error)
    } finally {
      setIsLoadingActivity(false)
    }
  }, [])

  // Fetch mentions
  const fetchMentions = useCallback(async () => {
    try {
      const response = await apiFetch('/api/notifications')
      if (response.ok) {
        const data = await response.json()
        const mentionItems = (data.notifications || [])
          .filter((n: any) => n.type === 'mention')
          .slice(0, 8)
          .map((n: any) => ({
            id: n.id,
            fromPersona: {
              name: n.fromPersona?.name || n.fromUser?.username || 'Unknown',
              avatarUrl: n.fromPersona?.avatarUrl || n.fromUser?.avatarUrl || null,
            },
            storylineName: n.storylineName || n.storyline?.name || '',
            content: n.content || '',
            createdAt: n.createdAt,
          }))
        setMentions(mentionItems)
      }
    } catch (error) {
      // Notifications endpoint may not exist yet, fail gracefully
      setMentions([])
    }
  }, [])

  // Initial data fetch
  useEffect(() => {
    startTransition(() => {
      fetchOnlinePersonas()
      fetchConversations()
      fetchStorylineActivity()
      fetchMentions()
    })
  }, [fetchOnlinePersonas, fetchConversations, fetchStorylineActivity, fetchMentions])

  // Listen for refresh events
  useEffect(() => {
    const handleDMRefresh = () => fetchConversations()
    const handleStorylineRefresh = () => fetchStorylineActivity()

    window.addEventListener('chrona:dm-refresh', handleDMRefresh)
    window.addEventListener('chrona:storyline-refresh', handleStorylineRefresh)

    return () => {
      window.removeEventListener('chrona:dm-refresh', handleDMRefresh)
      window.removeEventListener('chrona:storyline-refresh', handleStorylineRefresh)
    }
  }, [fetchConversations, fetchStorylineActivity])

  // ─── Keyboard Shortcuts ─────────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ⌘K / Ctrl+K for command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen((prev) => !prev)
        setCommandQuery('')
        setTimeout(() => commandInputRef.current?.focus(), 50)
        return
      }

      // ⌘1-8 for nav shortcuts
      if (e.metaKey || e.ctrlKey) {
        const num = parseInt(e.key)
        if (num >= 1 && num <= visibleNavItems.length) {
          e.preventDefault()
          const item = visibleNavItems[num - 1]
          if (item.tab) onSelectTab(item.tab)
          else if (item.action) item.action()
          return
        }
      }

      // Arrow navigation & Enter when command palette is open
      if (commandPaletteOpen) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setSelectedCommandIndex((prev) =>
            prev >= filteredCommands.length - 1 ? 0 : prev + 1
          )
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setSelectedCommandIndex((prev) =>
            prev <= 0 ? filteredCommands.length - 1 : prev - 1
          )
          return
        }
        if (e.key === 'Enter') {
          e.preventDefault()
          const cmd = filteredCommands[selectedCommandIndex]
          if (cmd) {
            cmd.action()
          }
          return
        }
      }

      // Escape to close command palette
      if (e.key === 'Escape' && commandPaletteOpen) {
        setCommandPaletteOpen(false)
        setCommandQuery('')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [commandPaletteOpen, visibleNavItems, onSelectTab, filteredCommands, selectedCommandIndex])

  // ─── Reset selected index when query changes ────────────────────────────
  useEffect(() => {
    setSelectedCommandIndex(0)
  }, [commandQuery])

  // ─── Reset selected index when palette opens ────────────────────────────
  useEffect(() => {
    if (commandPaletteOpen) {
      setSelectedCommandIndex(0)
    }
  }, [commandPaletteOpen])

  // ─── Scroll selected item into view ─────────────────────────────────────
  useEffect(() => {
    if (selectedCommandRef.current) {
      selectedCommandRef.current.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedCommandIndex])

  // ─── Nav Item Click Handler ─────────────────────────────────────────────

  const handleNavClick = useCallback(
    (item: NavItem) => {
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

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0c0a09]">
        {/* Main Row: Icon Bar | Activity Panel | Content | DM Panel */}
        <div className="flex flex-1 min-h-0">
          {/* ─── Icon Bar ──────────────────────────────────────────────── */}
          <div className="bg-[#0d0b09] w-12 border-r border-white/[0.06] flex flex-col items-center py-2 flex-shrink-0 relative z-20">
            {/* Logo */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="w-9 h-9 rounded-lg flex items-center justify-center mb-2 hover:bg-white/[0.06] transition-colors"
                  onClick={() => onSelectTab('home')}
                >
                  <div className="w-7 h-7 rounded-md bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                    <span className="text-white font-bold text-xs">C</span>
                  </div>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-[#1a1714] text-amber-200 border-amber-500/20 text-xs">
                Chrona Home
              </TooltipContent>
            </Tooltip>

            <Separator className="w-6 bg-white/[0.06] my-1" />

            {/* Nav Items */}
            <div className="flex flex-col items-center gap-0.5">
              {visibleNavItems.map((item) => {
                const isActive = item.tab === activeTab
                const Icon = item.icon
                return (
                  <Tooltip key={item.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleNavClick(item)}
                        className={`
                          w-9 h-9 rounded-lg flex items-center justify-center relative transition-all duration-150
                          ${isActive
                            ? 'bg-amber-500/15 text-amber-400'
                            : 'text-stone-500 hover:text-stone-300 hover:bg-white/[0.06]'
                          }
                        `}
                      >
                        {isActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-amber-400" />
                        )}
                        <Icon className="w-[18px] h-[18px]" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-[#1a1714] text-amber-200 border-amber-500/20 text-xs flex items-center gap-2">
                      {item.label}
                      <span className="text-amber-500/60 text-[10px] ml-1">{item.shortcut}</span>
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            <Separator className="w-6 bg-white/[0.06] my-1" />

            {/* Activity Panel Toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setActivityPanelOpen((prev) => !prev)}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                    activityPanelOpen
                      ? 'text-amber-400 bg-amber-500/10'
                      : 'text-stone-500 hover:text-stone-300 hover:bg-white/[0.06]'
                  }`}
                >
                  <PanelLeft className="w-[18px] h-[18px]" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-[#1a1714] text-amber-200 border-amber-500/20 text-xs">
                {activityPanelOpen ? 'Hide Activity' : 'Show Activity'}
              </TooltipContent>
            </Tooltip>

            {/* DM Panel Toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setDmPanelOpen((prev) => !prev)}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                    dmPanelOpen
                      ? 'text-amber-400 bg-amber-500/10'
                      : 'text-stone-500 hover:text-stone-300 hover:bg-white/[0.06]'
                  }`}
                >
                  <PanelRight className="w-[18px] h-[18px]" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-[#1a1714] text-amber-200 border-amber-500/20 text-xs">
                {dmPanelOpen ? 'Hide DMs' : 'Show DMs'}
              </TooltipContent>
            </Tooltip>

            <Separator className="w-6 bg-white/[0.06] my-1" />

            {/* Profile Dropdown - replaces Settings and Avatar */}
            <ProfileDropdown
              onNavigate={onNavigate}
              onOpenEditProfile={onOpenEditProfile}
              onOpenMyPersonas={onOpenMyPersonas}
              position="top-left"
              trigger={
                <div className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-white/[0.06] transition-colors cursor-pointer">
                  <div className="relative">
                    <Avatar className="w-7 h-7 border border-amber-500/30">
                      <AvatarImage src={user?.avatarUrl || activePersona?.avatarUrl || undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-amber-500 to-orange-600 text-white text-[10px] font-bold">
                        {(user?.username || 'U').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#0d0b09]" />
                  </div>
                </div>
              }
            />
          </div>

          {/* ─── Activity Panel ────────────────────────────────────────── */}
          <div
            className={`bg-[#110e0c] border-r border-white/[0.06] flex-shrink-0 flex flex-col transition-all duration-200 overflow-hidden ${
              activityPanelOpen ? 'w-64' : 'w-0'
            }`}
          >
            {activityPanelOpen && (
              <>
                {/* Activity Header */}
                <div className="h-10 px-3 flex items-center justify-between border-b border-white/[0.06] flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-semibold text-stone-300 uppercase tracking-wider">Activity</span>
                  </div>
                  <button
                    onClick={() => setActivityPanelOpen(false)}
                    className="w-6 h-6 rounded flex items-center justify-center text-stone-500 hover:text-stone-300 hover:bg-white/[0.06] transition-colors"
                  >
                    <PanelLeftClose className="w-3.5 h-3.5" />
                  </button>
                </div>

                <ScrollArea className="flex-1">
                  <div className="p-3 space-y-4">
                    {/* Online Personas */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">
                          Online — {onlinePersonas.length}
                        </span>
                      </div>
                      {isLoadingOnline ? (
                        <div className="space-y-2">
                          {[...Array(3)].map((_, i) => (
                            <div key={i} className="flex items-center gap-2 px-1">
                              <div className="w-6 h-6 rounded-full bg-white/[0.04] animate-pulse" />
                              <div className="h-3 w-20 bg-white/[0.04] rounded animate-pulse" />
                            </div>
                          ))}
                        </div>
                      ) : onlinePersonas.length > 0 ? (
                        <div className="space-y-0.5">
                          {onlinePersonas.slice(0, 12).map((persona) => (
                            <Tooltip key={persona.id}>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => {
                                    if (activePersona) {
                                      onStartChat({ targetPersonaId: persona.id, myPersonaId: activePersona.id })
                                    }
                                  }}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/[0.06] transition-colors group"
                                >
                                  <div className="relative flex-shrink-0">
                                    <Avatar className="w-6 h-6 border border-amber-500/20">
                                      <AvatarImage src={persona.avatarUrl || undefined} />
                                      <AvatarFallback className="bg-gradient-to-br from-amber-500/40 to-orange-500/50 text-white text-[9px] font-medium">
                                        {persona.name.charAt(0).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full border border-[#110e0c]" />
                                  </div>
                                  <span className="text-xs text-stone-400 group-hover:text-stone-200 truncate">
                                    {persona.name}
                                  </span>
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="bg-[#1a1714] text-stone-300 border-amber-500/20 text-xs">
                                Click to start DM with {persona.name}
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-stone-500 px-2 py-2">No one online right now</p>
                      )}
                    </div>

                    {/* Mentions */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <AtSign className="w-3 h-3 text-amber-500/70" />
                        <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">
                          Mentions
                        </span>
                        {mentions.length > 0 && (
                          <Badge className="h-4 px-1.5 text-[9px] bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30">
                            {mentions.length}
                          </Badge>
                        )}
                      </div>
                      {mentions.length > 0 ? (
                        <div className="space-y-0.5">
                          {mentions.slice(0, 5).map((mention) => (
                            <button
                              key={mention.id}
                              className="w-full flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-white/[0.04] transition-colors group text-left"
                            >
                              <Avatar className="w-5 h-5 border border-amber-500/20 flex-shrink-0 mt-0.5">
                                <AvatarImage src={mention.fromPersona.avatarUrl || undefined} />
                                <AvatarFallback className="bg-gradient-to-br from-amber-500/30 to-orange-500/30 text-white text-[8px]">
                                  {mention.fromPersona.name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] text-stone-300 truncate group-hover:text-stone-100">
                                  <span className="text-amber-400/80">{mention.fromPersona.name}</span>
                                  {mention.storylineName && (
                                    <span className="text-stone-600"> in {mention.storylineName}</span>
                                  )}
                                </p>
                                <p className="text-[10px] text-stone-600 truncate">{mention.content}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-stone-500 px-2 py-2">No recent mentions</p>
                      )}
                    </div>

                    {/* Storyline Activity */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Crown className="w-3 h-3 text-amber-500/70" />
                        <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">
                          Storylines
                        </span>
                      </div>
                      {isLoadingActivity ? (
                        <div className="space-y-2">
                          {[...Array(3)].map((_, i) => (
                            <div key={i} className="flex items-center gap-2 px-1">
                              <div className="w-6 h-6 rounded bg-white/[0.04] animate-pulse" />
                              <div className="flex-1">
                                <div className="h-3 w-24 bg-white/[0.04] rounded animate-pulse mb-1" />
                                <div className="h-2 w-12 bg-white/[0.04] rounded animate-pulse" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : storylineActivity.length > 0 ? (
                        <div className="space-y-0.5">
                          {storylineActivity.slice(0, 8).map((sl) => (
                            <Tooltip key={sl.id}>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => onSelectStoryline(sl.id)}
                                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors group ${
                                    activeStorylineId === sl.id
                                      ? 'bg-amber-500/15 text-amber-400'
                                      : 'hover:bg-white/[0.06] hover:text-stone-300'
                                  }`}
                                >
                                  <div className="w-6 h-6 rounded bg-gradient-to-br from-amber-500/30 to-orange-500/30 flex items-center justify-center flex-shrink-0 overflow-hidden border border-amber-500/20">
                                    {sl.iconUrl ? (
                                      <img src={sl.iconUrl} alt={sl.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="text-white text-[9px] font-bold">{sl.name.charAt(0).toUpperCase()}</span>
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className={`text-[11px] truncate ${
                                      activeStorylineId === sl.id
                                        ? 'text-amber-400'
                                        : 'text-stone-300 group-hover:text-stone-100'
                                    }`}>
                                      {sl.name}
                                    </p>
                                    <p className="text-[10px] text-stone-500">
                                      {sl.lastActivity ? formatRelativeTime(sl.lastActivity) : 'No activity'}
                                    </p>
                                  </div>
                                  {sl.unreadCount && sl.unreadCount > 0 && (
                                    <Badge className="h-4 px-1.5 text-[9px] bg-amber-500/20 text-amber-400 border-amber-500/30 flex-shrink-0">
                                      {sl.unreadCount}
                                    </Badge>
                                  )}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="bg-[#1a1714] text-stone-300 border-amber-500/20 text-xs max-w-[200px]">
                                {sl.name}
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      ) : (
                        <button
                          onClick={() => onSelectTab('storylines')}
                          className="w-full p-4 rounded-md border border-dashed border-amber-500/20 flex flex-col items-center justify-center gap-2 text-stone-500 hover:text-stone-300 hover:border-amber-500/40 hover:bg-amber-500/5 transition-all"
                        >
                          <Crown className="w-5 h-5 text-amber-500/50" />
                          <span className="text-[11px] font-medium">Join a storyline</span>
                          <span className="text-[9px] text-stone-600">Explore collaborative stories</span>
                        </button>
                      )}
                    </div>

                    {/* My Personas Quick Access */}
                    {personas.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="w-3 h-3 text-amber-500/70" />
                          <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">
                            Characters
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          {personas.slice(0, 6).map((persona) => (
                            <button
                              key={persona.id}
                              onClick={onOpenMyPersonas}
                              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors group ${
                                persona.isActive
                                  ? 'bg-amber-500/15'
                                  : 'hover:bg-white/[0.06]'
                              }`}
                            >
                              <Avatar className="w-6 h-6 border border-amber-500/20">
                                <AvatarImage src={persona.avatarUrl || undefined} />
                                <AvatarFallback className="bg-gradient-to-br from-amber-500/40 to-orange-500/50 text-white text-[9px] font-medium">
                                  {persona.name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className={`text-[11px] truncate ${
                                persona.isActive ? 'text-amber-400 font-medium' : 'text-stone-400 group-hover:text-stone-200'
                              }`}>
                                {persona.name}
                              </span>
                              {persona.isActive && (
                                <Circle className="w-2 h-2 fill-amber-400 text-amber-400 ml-auto flex-shrink-0" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </>
            )}
          </div>

          {/* ─── Main Content Area ─────────────────────────────────────── */}
          <div className="flex-1 min-w-0 bg-[#0c0a09] flex flex-col overflow-hidden">
            <main className="flex-1 overflow-y-auto">
              {children}
            </main>
          </div>

          {/* ─── DM Panel ──────────────────────────────────────────────── */}
          <div
            className={`bg-[#110e0c] border-l border-white/[0.06] flex-shrink-0 flex flex-col transition-all duration-200 overflow-hidden ${
              dmPanelOpen ? 'w-70' : 'w-0'
            }`}
          >
            {dmPanelOpen && (
              <>
                {/* DM Header */}
                <div className="h-10 px-3 flex items-center justify-between border-b border-white/[0.06] flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-semibold text-stone-300 uppercase tracking-wider">Messages</span>
                  </div>
                  <button
                    onClick={() => setDmPanelOpen(false)}
                    className="w-6 h-6 rounded flex items-center justify-center text-stone-500 hover:text-stone-300 hover:bg-white/[0.06] transition-colors"
                  >
                    <PanelRightClose className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* DM Search */}
                <div className="px-3 py-2 border-b border-white/[0.04] flex-shrink-0">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-stone-600" />
                    <Input
                      placeholder="Search messages..."
                      className="h-7 pl-7 text-[11px] bg-white/[0.03] border-white/[0.06] text-stone-300 placeholder:text-stone-600 focus-visible:border-amber-500/30 focus-visible:ring-amber-500/20"
                    />
                  </div>
                </div>

                {/* DM List */}
                <ScrollArea className="flex-1">
                  {isLoadingConversations ? (
                    <div className="space-y-1 p-2">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex items-center gap-2 px-2 py-2">
                          <div className="w-8 h-8 rounded-full bg-white/[0.04] animate-pulse" />
                          <div className="flex-1">
                            <div className="h-3 w-20 bg-white/[0.04] rounded animate-pulse mb-1" />
                            <div className="h-2 w-28 bg-white/[0.04] rounded animate-pulse" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : dmConversations.length > 0 ? (
                    <div className="space-y-0.5 p-2">
                      {dmConversations.map((conv) => {
                        const isActive = activeChat?.id === conv.id
                        return (
                          <button
                            key={conv.id}
                            onClick={() => onSelectChat(conv.id)}
                            className={`w-full flex items-center gap-2 px-2 py-2 rounded-md transition-colors group ${
                              isActive
                                ? 'bg-amber-500/15'
                                : 'hover:bg-white/[0.06]'
                            }`}
                          >
                            <div className="relative flex-shrink-0">
                              <Avatar className={`w-8 h-8 border ${isActive ? 'border-amber-500/40' : 'border-amber-500/20'}`}>
                                <AvatarImage src={conv.otherPersona.avatarUrl || undefined} />
                                <AvatarFallback className="bg-gradient-to-br from-amber-500/40 to-orange-500/50 text-white text-[10px] font-medium">
                                  {conv.otherPersona.name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              {conv.otherPersona.isOnline && (
                                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#110e0c]" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1 text-left">
                              <div className="flex items-center justify-between">
                                <p className={`text-[11px] font-medium truncate ${
                                  isActive ? 'text-amber-300' : 'text-stone-300 group-hover:text-stone-100'
                                }`}>
                                  {conv.otherPersona.name}
                                </p>
                                {conv.lastMessage && (
                                  <span className="text-[9px] text-stone-600 flex-shrink-0 ml-1">
                                    {formatRelativeTime(conv.lastMessage.createdAt)}
                                  </span>
                                )}
                              </div>
                              {conv.lastMessage && (
                                <p className="text-[10px] text-stone-600 truncate">{conv.lastMessage.content}</p>
                              )}
                            </div>
                            {conv.unreadCount && conv.unreadCount > 0 && (
                              <Badge className="h-4 px-1.5 text-[9px] bg-amber-500/20 text-amber-400 border-amber-500/30 flex-shrink-0">
                                {conv.unreadCount}
                              </Badge>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                      <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-3 border border-amber-500/20">
                        <MessageCircle className="w-6 h-6 text-amber-500/50" />
                      </div>
                      <p className="text-xs font-medium text-stone-300">No messages yet</p>
                      <p className="text-[10px] text-stone-500 mt-1 mb-3">Start a conversation from the Activity panel</p>
                      <button
                        onClick={() => setActivityPanelOpen(true)}
                        className="text-[10px] text-amber-400 hover:text-amber-300 transition-colors"
                      >
                        View online users →
                      </button>
                    </div>
                  )}
                </ScrollArea>
              </>
            )}
          </div>
        </div>

        {/* ─── Command Bar ─────────────────────────────────────────────── */}
        <div className="bg-[#0d0b09] h-9 border-t border-white/[0.06] flex items-center px-3 gap-3 flex-shrink-0 z-20">
          {/* Command Palette Trigger */}
          <button
            onClick={() => {
              setCommandPaletteOpen(true)
              setCommandQuery('')
              setTimeout(() => commandInputRef.current?.focus(), 50)
            }}
            className="flex items-center gap-2 text-stone-600 hover:text-stone-400 transition-colors group"
          >
            <div className="flex items-center gap-1">
              <Command className="w-3 h-3" />
              <span className="text-[10px] font-mono">K</span>
            </div>
            <span className="text-[10px] text-stone-600 group-hover:text-stone-400">Command palette...</span>
          </button>

          {/* Separator */}
          <div className="w-px h-4 bg-white/[0.06]" />

          {/* Active Tab Indicator */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-amber-500/70">
              {activeTab === 'home' ? 'Discover' :
               activeTab === 'storylines' ? 'Storylines' :
               activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </span>
            {activeStorylineId && (
              <>
                <ChevronRight className="w-2.5 h-2.5 text-stone-700" />
                <span className="text-[10px] text-stone-500 truncate max-w-[120px]">Storyline</span>
              </>
            )}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Quick Shortcuts */}
          <div className="hidden sm:flex items-center gap-3 text-[10px] text-stone-700">
            <span>
              <span className="font-mono text-stone-600">⌘1-8</span> Nav
            </span>
            <span>
              <span className="font-mono text-stone-600">⌘K</span> Search
            </span>
          </div>

          {/* Separator */}
          <div className="hidden sm:block w-px h-4 bg-white/[0.06]" />

          {/* User Info */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Avatar className="w-5 h-5 border border-amber-500/20">
                <AvatarImage src={user?.avatarUrl || activePersona?.avatarUrl || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-amber-500/40 to-orange-500/50 text-white text-[8px] font-bold">
                  {(user?.username || 'U').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-400 rounded-full border border-[#0d0b09]" />
            </div>
            <span className="text-[10px] text-stone-500 truncate max-w-[80px]">
              {activePersona?.name || user?.username || 'User'}
            </span>
          </div>
        </div>

        {/* ─── Command Palette Overlay ─────────────────────────────────── */}
        {commandPaletteOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => {
                setCommandPaletteOpen(false)
                setCommandQuery('')
              }}
            />

            {/* Palette */}
            <div className="relative w-full max-w-md bg-[#1a1714] border border-amber-500/20 rounded-xl shadow-2xl shadow-amber-500/5 overflow-hidden flex flex-col max-h-[70vh]">
              {/* Search Input */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] flex-shrink-0">
                <Command className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <input
                  ref={commandInputRef}
                  type="text"
                  value={commandQuery}
                  onChange={(e) => setCommandQuery(e.target.value)}
                  placeholder="Type a command or search..."
                  className="flex-1 bg-transparent text-sm text-stone-200 placeholder:text-stone-600 outline-none"
                />
                <kbd className="text-[10px] text-stone-600 bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.06]">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div className="flex-1 overflow-y-auto min-h-0">
                {filteredCommands.length > 0 ? (
                  <div className="p-2">
                    {/* Navigation Items */}
                    {filteredCommands.some((c) => c.category === 'nav') && (
                      <>
                        <div className="px-2 py-1">
                          <span className="text-[10px] font-semibold text-stone-600 uppercase tracking-wider">
                            Navigation
                          </span>
                        </div>
                        {filteredCommands
                          .filter((c) => c.category === 'nav')
                          .map((item) => {
                            const Icon = item.icon
                            const globalIndex = filteredCommands.indexOf(item)
                            const isSelected = globalIndex === selectedCommandIndex
                            return (
                              <button
                                key={item.id}
                                ref={isSelected ? selectedCommandRef : undefined}
                                onClick={item.action}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group ${
                                  isSelected ? 'bg-amber-500/15' : 'hover:bg-amber-500/10'
                                }`}
                              >
                                <Icon className={`w-4 h-4 ${isSelected ? 'text-amber-400' : 'text-stone-500 group-hover:text-amber-400'}`} />
                                <span className={`text-sm flex-1 text-left ${
                                  isSelected ? 'text-stone-100' : 'text-stone-300 group-hover:text-stone-100'
                                }`}>
                                  {item.label}
                                </span>
                                {item.shortcut && (
                                  <span className="text-[10px] text-stone-700 font-mono">{item.shortcut}</span>
                                )}
                              </button>
                            )
                          })}
                      </>
                    )}

                    {/* Action Items */}
                    {filteredCommands.some((c) => c.category === 'action') && (
                      <>
                        <div className="px-2 py-1 mt-1">
                          <span className="text-[10px] font-semibold text-stone-600 uppercase tracking-wider">
                            Actions
                          </span>
                        </div>
                        {filteredCommands
                          .filter((c) => c.category === 'action')
                          .map((item) => {
                            const Icon = item.icon
                            const globalIndex = filteredCommands.indexOf(item)
                            const isSelected = globalIndex === selectedCommandIndex
                            return (
                              <button
                                key={item.id}
                                ref={isSelected ? selectedCommandRef : undefined}
                                onClick={item.action}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group ${
                                  isSelected ? 'bg-amber-500/15' : 'hover:bg-amber-500/10'
                                }`}
                              >
                                <Icon className={`w-4 h-4 ${isSelected ? 'text-amber-400' : 'text-stone-500 group-hover:text-amber-400'}`} />
                                <span className={`text-sm flex-1 text-left ${
                                  isSelected ? 'text-stone-100' : 'text-stone-300 group-hover:text-stone-100'
                                }`}>
                                  {item.label}
                                </span>
                                {item.shortcut && (
                                  <span className="text-[10px] text-stone-700 font-mono">{item.shortcut}</span>
                                )}
                              </button>
                            )
                          })}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                    <Search className="w-6 h-6 text-stone-700 mb-2" />
                    <p className="text-sm text-stone-500">No results found</p>
                    <p className="text-[10px] text-stone-700 mt-1">Try a different search term</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2 border-t border-white/[0.06] flex items-center gap-4 text-[10px] text-stone-700 flex-shrink-0">
                <span className="flex items-center gap-1">
                  <kbd className="bg-white/[0.04] px-1 py-0.5 rounded border border-white/[0.06]">↑↓</kbd>
                  Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="bg-white/[0.04] px-1 py-0.5 rounded border border-white/[0.06]">↵</kbd>
                  Select
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="bg-white/[0.04] px-1 py-0.5 rounded border border-white/[0.06]">esc</kbd>
                  Close
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
