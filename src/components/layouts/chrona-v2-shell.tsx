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
  Plus,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChronaV2ShellProps {
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
  tab?: ChronaV2ShellProps['activeTab']
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

export function ChronaV2Shell({
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
}: ChronaV2ShellProps) {
  const { user, logout } = useAuth()
  const { activePersona, personas, activatePersona } = usePersonas()
  const isMobile = useIsMobile()

  // ─── Panel State ─────────────────────────────────────────────────────────
  const [activityPanelOpen, setActivityPanelOpen] = useState(!isMobile)
  const [dmPanelOpen, setDmPanelOpen] = useState(!isMobile)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [commandQuery, setCommandQuery] = useState('')
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0)
  const [dockHoveredItem, setDockHoveredItem] = useState<string | null>(null)

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

  // ─── Reset selected command index on query change or palette open ─────
  useEffect(() => {
    setSelectedCommandIndex(0)
  }, [commandQuery])

  useEffect(() => {
    if (commandPaletteOpen) {
      setSelectedCommandIndex(0)
    }
  }, [commandPaletteOpen])

  // ─── Scroll selected command into view ──────────────────────────────────
  useEffect(() => {
    if (selectedCommandRef.current) {
      selectedCommandRef.current.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedCommandIndex])

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
      // Command palette arrow / enter handling
      if (commandPaletteOpen) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setSelectedCommandIndex((prev) =>
            prev < filteredCommands.length - 1 ? prev + 1 : prev
          )
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setSelectedCommandIndex((prev) => (prev > 0 ? prev - 1 : prev))
          return
        }
        if (e.key === 'Enter') {
          e.preventDefault()
          if (filteredCommands[selectedCommandIndex]) {
            filteredCommands[selectedCommandIndex].action()
          }
          return
        }
      }

      // ⌘K / Ctrl+K for command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen((prev) => !prev)
        setCommandQuery('')
        setSelectedCommandIndex(0)
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

      // Escape to close command palette
      if (e.key === 'Escape' && commandPaletteOpen) {
        setCommandPaletteOpen(false)
        setCommandQuery('')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [commandPaletteOpen, filteredCommands, selectedCommandIndex, visibleNavItems, onSelectTab])

  // ─── Nav Item Click Handler ─────────────────────────────────────────────

  const handleNavClick = useCallback(
    (item: NavItem) => {
      if (item.tab) onSelectTab(item.tab)
      else if (item.action) item.action()
    },
    [onSelectTab]
  )

  // ─── Persona switching ────────────────────────────────────────────────────
  const handleActivatePersona = useCallback(async (personaId: string) => {
    try {
      await activatePersona(personaId)
    } catch (error) {
      console.error('Failed to activate persona:', error)
    }
  }, [activatePersona])

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

  // ─── Dock nav items for the floating dock ──────────────────────────────
  const dockItems = visibleNavItems

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0b0a10]">
        {/* ─── Top Bar ──────────────────────────────────────────────────── */}
        <header className="flex-shrink-0 h-11 bg-[#0e0d14]/80 backdrop-blur-xl border-b border-violet-500/[0.08] flex items-center px-3 gap-3 z-30">
          {/* Logo */}
          <button
            onClick={() => onSelectTab('home')}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-shrink-0"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold bg-gradient-to-r from-violet-300 to-purple-300 bg-clip-text text-transparent hidden sm:inline">
              Chrona
            </span>
          </button>

          {/* Panel toggle buttons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setActivityPanelOpen((prev) => !prev)}
                  className={`w-7 h-7 rounded-md flex items-center justify-center transition-all duration-200 ${
                    activityPanelOpen
                      ? 'text-violet-400 bg-violet-500/15 shadow-sm shadow-violet-500/10'
                      : 'text-slate-500 hover:text-violet-300 hover:bg-white/[0.04]'
                  }`}
                >
                  <PanelLeft className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-[#1a1625] text-violet-200 border-violet-500/20 text-xs">
                {activityPanelOpen ? 'Hide Activity' : 'Show Activity'}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setDmPanelOpen((prev) => !prev)}
                  className={`w-7 h-7 rounded-md flex items-center justify-center transition-all duration-200 ${
                    dmPanelOpen
                      ? 'text-violet-400 bg-violet-500/15 shadow-sm shadow-violet-500/10'
                      : 'text-slate-500 hover:text-violet-300 hover:bg-white/[0.04]'
                  }`}
                >
                  <PanelRight className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-[#1a1625] text-violet-200 border-violet-500/20 text-xs">
                {dmPanelOpen ? 'Hide DMs' : 'Show DMs'}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Search - center */}
          <div className="flex-1 flex justify-center">
            <button
              onClick={() => {
                setCommandPaletteOpen(true)
                setCommandQuery('')
                setTimeout(() => commandInputRef.current?.focus(), 50)
              }}
              className="flex items-center gap-2 h-7 w-full max-w-xs px-3 rounded-lg bg-white/[0.03] border border-violet-500/[0.08] text-slate-500 hover:border-violet-500/20 hover:bg-white/[0.05] transition-all duration-200"
            >
              <Search className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="text-[11px] truncate">Search or command...</span>
              <kbd className="ml-auto text-[9px] text-slate-600 bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.06] flex-shrink-0 hidden sm:inline">⌘K</kbd>
            </button>
          </div>

          {/* Right: Avatar + Settings */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <ProfileDropdown
              onNavigate={onNavigate}
              onOpenEditProfile={onOpenEditProfile}
              onOpenMyPersonas={onOpenMyPersonas}
              position="bottom-right"
              trigger={
                <div className="flex items-center gap-1.5 px-1.5 py-1 rounded-lg hover:bg-white/[0.04] transition-colors cursor-pointer">
                  <div className="relative">
                    <Avatar className="w-6 h-6 border border-violet-500/30">
                      <AvatarImage src={user?.avatarUrl || activePersona?.avatarUrl || undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-white text-[9px] font-bold">
                        {(user?.username || 'U').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full border border-[#0e0d14]" />
                  </div>
                  <span className="text-[11px] text-slate-400 hidden sm:inline truncate max-w-[80px]">
                    {user?.username || 'User'}
                  </span>
                </div>
              }
            />
          </div>
        </header>

        {/* ─── Main Area: Left Panel | Content | Right Panel ──────────── */}
        <div className="flex flex-1 min-h-0 relative">
          {/* ─── Activity Panel (Left) ────────────────────────────────── */}
          <div
            className={`flex-shrink-0 flex flex-col transition-all duration-300 overflow-hidden ${
              activityPanelOpen ? 'w-64' : 'w-0'
            }`}
          >
            {activityPanelOpen && (
              <div className="w-64 h-full bg-[#0e0d14]/60 backdrop-blur-md border-r border-violet-500/[0.08] flex flex-col">
                {/* Activity Header */}
                <div className="h-9 px-3 flex items-center justify-between border-b border-violet-500/[0.08] flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-violet-400" />
                    <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Activity</span>
                  </div>
                  <button
                    onClick={() => setActivityPanelOpen(false)}
                    className="w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:text-violet-300 hover:bg-white/[0.04] transition-colors"
                  >
                    <PanelLeftClose className="w-3 h-3" />
                  </button>
                </div>

                <ScrollArea className="flex-1">
                  <div className="p-3 space-y-4">
                    {/* Online Personas */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                          Online — {onlinePersonas.length}
                        </span>
                      </div>
                      {isLoadingOnline ? (
                        <div className="space-y-2">
                          {[...Array(3)].map((_, i) => (
                            <div key={i} className="flex items-center gap-2 px-1">
                              <div className="w-6 h-6 rounded-full bg-violet-500/[0.06] animate-pulse" />
                              <div className="h-3 w-20 bg-violet-500/[0.06] rounded animate-pulse" />
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
                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-violet-500/[0.08] transition-colors group"
                                >
                                  <div className="relative flex-shrink-0">
                                    <Avatar className="w-6 h-6 border border-violet-500/20">
                                      <AvatarImage src={persona.avatarUrl || undefined} />
                                      <AvatarFallback className="bg-gradient-to-br from-violet-500/40 to-purple-500/50 text-white text-[9px] font-medium">
                                        {persona.name.charAt(0).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full border border-[#0e0d14]" />
                                  </div>
                                  <span className="text-xs text-slate-400 group-hover:text-violet-200 truncate">
                                    {persona.name}
                                  </span>
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="bg-[#1a1625] text-violet-200 border-violet-500/20 text-xs">
                                Click to start DM with {persona.name}
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-500 px-2 py-2">No one online right now</p>
                      )}
                    </div>

                    {/* Mentions */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <AtSign className="w-3 h-3 text-violet-500/70" />
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                          Mentions
                        </span>
                        {mentions.length > 0 && (
                          <Badge className="h-4 px-1.5 text-[9px] bg-violet-500/20 text-violet-400 border-violet-500/30 hover:bg-violet-500/30">
                            {mentions.length}
                          </Badge>
                        )}
                      </div>
                      {mentions.length > 0 ? (
                        <div className="space-y-0.5">
                          {mentions.slice(0, 5).map((mention) => (
                            <button
                              key={mention.id}
                              className="w-full flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-violet-500/[0.06] transition-colors group text-left"
                            >
                              <Avatar className="w-5 h-5 border border-violet-500/20 flex-shrink-0 mt-0.5">
                                <AvatarImage src={mention.fromPersona.avatarUrl || undefined} />
                                <AvatarFallback className="bg-gradient-to-br from-violet-500/30 to-purple-500/30 text-white text-[8px]">
                                  {mention.fromPersona.name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] text-slate-300 truncate group-hover:text-violet-100">
                                  <span className="text-violet-400/80">{mention.fromPersona.name}</span>
                                  {mention.storylineName && (
                                    <span className="text-slate-600"> in {mention.storylineName}</span>
                                  )}
                                </p>
                                <p className="text-[10px] text-slate-600 truncate">{mention.content}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-500 px-2 py-2">No recent mentions</p>
                      )}
                    </div>

                    {/* Storyline Activity */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Crown className="w-3 h-3 text-violet-500/70" />
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                          Storylines
                        </span>
                      </div>
                      {isLoadingActivity ? (
                        <div className="space-y-2">
                          {[...Array(3)].map((_, i) => (
                            <div key={i} className="flex items-center gap-2 px-1">
                              <div className="w-6 h-6 rounded bg-violet-500/[0.06] animate-pulse" />
                              <div className="flex-1">
                                <div className="h-3 w-24 bg-violet-500/[0.06] rounded animate-pulse mb-1" />
                                <div className="h-2 w-12 bg-violet-500/[0.06] rounded animate-pulse" />
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
                                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors group ${
                                    activeStorylineId === sl.id
                                      ? 'bg-violet-500/15 text-violet-400'
                                      : 'hover:bg-violet-500/[0.08] hover:text-slate-300'
                                  }`}
                                >
                                  <div className="w-6 h-6 rounded bg-gradient-to-br from-violet-500/30 to-purple-500/30 flex items-center justify-center flex-shrink-0 overflow-hidden border border-violet-500/20">
                                    {sl.iconUrl ? (
                                      <img src={sl.iconUrl} alt={sl.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="text-white text-[9px] font-bold">{sl.name.charAt(0).toUpperCase()}</span>
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className={`text-[11px] truncate ${
                                      activeStorylineId === sl.id
                                        ? 'text-violet-400'
                                        : 'text-slate-300 group-hover:text-violet-100'
                                    }`}>
                                      {sl.name}
                                    </p>
                                    <p className="text-[10px] text-slate-500">
                                      {sl.lastActivity ? formatRelativeTime(sl.lastActivity) : 'No activity'}
                                    </p>
                                  </div>
                                  {sl.unreadCount && sl.unreadCount > 0 && (
                                    <Badge className="h-4 px-1.5 text-[9px] bg-violet-500/20 text-violet-400 border-violet-500/30 flex-shrink-0">
                                      {sl.unreadCount}
                                    </Badge>
                                  )}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="bg-[#1a1625] text-violet-200 border-violet-500/20 text-xs max-w-[200px]">
                                {sl.name}
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      ) : (
                        <button
                          onClick={() => onSelectTab('storylines')}
                          className="w-full p-4 rounded-lg border border-dashed border-violet-500/20 flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-violet-300 hover:border-violet-500/40 hover:bg-violet-500/[0.04] transition-all"
                        >
                          <Crown className="w-5 h-5 text-violet-500/50" />
                          <span className="text-[11px] font-medium">Join a storyline</span>
                          <span className="text-[9px] text-slate-600">Explore collaborative stories</span>
                        </button>
                      )}
                    </div>

                    {/* My Personas Quick Access */}
                    {personas.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="w-3 h-3 text-violet-500/70" />
                          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                            Characters
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          {personas.slice(0, 6).map((persona) => (
                            <button
                              key={persona.id}
                              onClick={() => handleActivatePersona(persona.id)}
                              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors group ${
                                persona.isActive
                                  ? 'bg-violet-500/15'
                                  : 'hover:bg-violet-500/[0.08]'
                              }`}
                            >
                              <Avatar className="w-6 h-6 border border-violet-500/20">
                                <AvatarImage src={persona.avatarUrl || undefined} />
                                <AvatarFallback className="bg-gradient-to-br from-violet-500/40 to-purple-500/50 text-white text-[9px] font-medium">
                                  {persona.name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className={`text-[11px] truncate ${
                                persona.isActive ? 'text-violet-400 font-medium' : 'text-slate-400 group-hover:text-violet-200'
                              }`}>
                                {persona.name}
                              </span>
                              {persona.isActive && (
                                <Circle className="w-2 h-2 fill-violet-400 text-violet-400 ml-auto flex-shrink-0" />
                              )}
                            </button>
                          ))}
                          {personas.length < 10 && (
                            <button
                              onClick={onCreatePersona}
                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-violet-500/[0.08] transition-colors text-slate-500 hover:text-violet-300"
                            >
                              <div className="w-6 h-6 rounded border border-dashed border-violet-500/20 flex items-center justify-center">
                                <Plus className="w-3 h-3" />
                              </div>
                              <span className="text-[11px]">Create new</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>

          {/* ─── Main Content Area ─────────────────────────────────────── */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            <main className="flex-1 overflow-y-auto pb-20">
              {children}
            </main>
          </div>

          {/* ─── DM Panel (Right) ──────────────────────────────────────── */}
          <div
            className={`flex-shrink-0 flex flex-col transition-all duration-300 overflow-hidden ${
              dmPanelOpen ? 'w-70' : 'w-0'
            }`}
          >
            {dmPanelOpen && (
              <div className="w-70 h-full bg-[#0e0d14]/60 backdrop-blur-md border-l border-violet-500/[0.08] flex flex-col">
                {/* DM Header */}
                <div className="h-9 px-3 flex items-center justify-between border-b border-violet-500/[0.08] flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-3.5 h-3.5 text-violet-400" />
                    <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Messages</span>
                  </div>
                  <button
                    onClick={() => setDmPanelOpen(false)}
                    className="w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:text-violet-300 hover:bg-white/[0.04] transition-colors"
                  >
                    <PanelRightClose className="w-3 h-3" />
                  </button>
                </div>

                {/* DM Search */}
                <div className="px-3 py-2 border-b border-violet-500/[0.06] flex-shrink-0">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-600" />
                    <Input
                      placeholder="Search messages..."
                      className="h-7 pl-7 text-[11px] bg-white/[0.03] border-violet-500/[0.08] text-slate-300 placeholder:text-slate-600 focus-visible:border-violet-500/30 focus-visible:ring-violet-500/20"
                    />
                  </div>
                </div>

                {/* DM List */}
                <ScrollArea className="flex-1">
                  {isLoadingConversations ? (
                    <div className="space-y-1 p-2">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex items-center gap-2 px-2 py-2">
                          <div className="w-8 h-8 rounded-full bg-violet-500/[0.06] animate-pulse" />
                          <div className="flex-1">
                            <div className="h-3 w-20 bg-violet-500/[0.06] rounded animate-pulse mb-1" />
                            <div className="h-2 w-28 bg-violet-500/[0.06] rounded animate-pulse" />
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
                            className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg transition-colors group ${
                              isActive
                                ? 'bg-violet-500/15'
                                : 'hover:bg-violet-500/[0.08]'
                            }`}
                          >
                            <div className="relative flex-shrink-0">
                              <Avatar className={`w-8 h-8 border ${isActive ? 'border-violet-500/40' : 'border-violet-500/20'}`}>
                                <AvatarImage src={conv.otherPersona.avatarUrl || undefined} />
                                <AvatarFallback className="bg-gradient-to-br from-violet-500/40 to-purple-500/50 text-white text-[10px] font-medium">
                                  {conv.otherPersona.name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              {conv.otherPersona.isOnline && (
                                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#0e0d14]" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1 text-left">
                              <div className="flex items-center justify-between">
                                <p className={`text-[11px] font-medium truncate ${
                                  isActive ? 'text-violet-300' : 'text-slate-300 group-hover:text-violet-100'
                                }`}>
                                  {conv.otherPersona.name}
                                </p>
                                {conv.lastMessage && (
                                  <span className="text-[9px] text-slate-600 flex-shrink-0 ml-1">
                                    {formatRelativeTime(conv.lastMessage.createdAt)}
                                  </span>
                                )}
                              </div>
                              {conv.lastMessage && (
                                <p className="text-[10px] text-slate-600 truncate">{conv.lastMessage.content}</p>
                              )}
                            </div>
                            {conv.unreadCount && conv.unreadCount > 0 && (
                              <Badge className="h-4 px-1.5 text-[9px] bg-violet-500/20 text-violet-400 border-violet-500/30 flex-shrink-0">
                                {conv.unreadCount}
                              </Badge>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 px-4">
                      <MessageCircle className="w-8 h-8 text-violet-500/30 mb-2" />
                      <p className="text-xs text-slate-500">No messages yet</p>
                      <p className="text-[10px] text-slate-600 mt-1">Start a conversation from the activity panel</p>
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}
          </div>
        </div>

        {/* ─── Floating Dock (Bottom Center) ────────────────────────────── */}
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40">
          <div className="flex items-center gap-1 px-2 py-1.5 rounded-2xl bg-[#14121e]/80 backdrop-blur-xl border border-violet-500/[0.12] shadow-2xl shadow-violet-950/40 shadow-black/30">
            {dockItems.map((item) => {
              const isActive = item.tab === activeTab
              const Icon = item.icon
              const isHovered = dockHoveredItem === item.id

              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleNavClick(item)}
                      onMouseEnter={() => setDockHoveredItem(item.id)}
                      onMouseLeave={() => setDockHoveredItem(null)}
                      className={`
                        relative flex items-center justify-center rounded-xl transition-all duration-200 ease-out
                        ${isActive
                          ? 'w-11 h-11 bg-violet-500/20 text-violet-300 shadow-lg shadow-violet-500/20'
                          : isHovered
                            ? 'w-10 h-10 text-violet-300 bg-violet-500/[0.08]'
                            : 'w-9 h-9 text-slate-500 hover:text-slate-300'
                        }
                      `}
                    >
                      {/* Active indicator dot */}
                      {isActive && (
                        <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-violet-400 shadow-sm shadow-violet-400/50" />
                      )}
                      <Icon className={`transition-all duration-200 ${
                        isActive ? 'w-5 h-5' : isHovered ? 'w-[18px] h-[18px]' : 'w-4 h-4'
                      }`} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-[#1a1625] text-violet-200 border-violet-500/20 text-xs flex items-center gap-2">
                    {item.label}
                    <span className="text-violet-500/60 text-[10px] ml-1">{item.shortcut}</span>
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        </div>

        {/* ─── Command Palette Overlay ────────────────────────────────────── */}
        {commandPaletteOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => {
                setCommandPaletteOpen(false)
                setCommandQuery('')
              }}
            />
            <div
              className="relative w-full max-w-lg bg-[#14121e]/95 backdrop-blur-xl border border-violet-500/[0.12] rounded-2xl shadow-2xl shadow-violet-950/30 shadow-black/40 flex flex-col max-h-[70vh]"
              style={{ animation: 'fadeInScale 0.15s ease-out' }}
            >
              {/* Search Input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-violet-500/[0.08] flex-shrink-0">
                <Search className="w-4 h-4 text-violet-400 flex-shrink-0" />
                <input
                  ref={commandInputRef}
                  type="text"
                  value={commandQuery}
                  onChange={(e) => setCommandQuery(e.target.value)}
                  placeholder="Type a command or search..."
                  className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 outline-none"
                  autoFocus
                />
                <kbd className="text-[9px] text-slate-600 bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.06] flex-shrink-0">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar">
                {filteredCommands.length > 0 ? (
                  <div className="p-1.5">
                    {(['nav', 'action'] as const).map((category) => {
                      const categoryItems = filteredCommands.filter((i) => i.category === category)
                      if (categoryItems.length === 0) return null
                      return (
                        <div key={category} className="mb-1">
                          <p className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                            {category === 'nav' ? 'Navigation' : 'Actions'}
                          </p>
                          {categoryItems.map((item) => {
                            const Icon = item.icon
                            const flatIndex = filteredCommands.indexOf(item)
                            const isSelected = flatIndex === selectedCommandIndex
                            return (
                              <button
                                key={item.id}
                                ref={isSelected ? selectedCommandRef : undefined}
                                onClick={item.action}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group text-left ${
                                  isSelected
                                    ? 'bg-violet-500/15 text-violet-100'
                                    : 'hover:bg-violet-500/[0.08]'
                                }`}
                              >
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                                  isSelected
                                    ? 'bg-violet-500/20'
                                    : 'bg-violet-500/[0.08] group-hover:bg-violet-500/15'
                                }`}>
                                  <Icon className="w-3.5 h-3.5 text-violet-400" />
                                </div>
                                <span className={`text-sm flex-1 ${
                                  isSelected
                                    ? 'text-violet-100'
                                    : 'text-slate-300 group-hover:text-violet-100'
                                }`}>
                                  {item.label}
                                </span>
                                {item.shortcut && (
                                  <span className="text-[10px] text-slate-600 bg-white/[0.03] px-1.5 py-0.5 rounded border border-white/[0.06]">
                                    {item.shortcut}
                                  </span>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8">
                    <Command className="w-8 h-8 text-violet-500/30 mb-2" />
                    <p className="text-sm text-slate-500">No results found</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2 border-t border-violet-500/[0.08] flex items-center gap-4 text-[10px] text-slate-600 flex-shrink-0">
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

      {/* ─── Global Styles ──────────────────────────────────────────────────── */}
      <style jsx global>{`
        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale(0.96);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        /* Custom scrollbar for chrona-v2 theme */
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(139, 92, 246, 0.15);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(139, 92, 246, 0.25);
        }
      `}</style>
    </TooltipProvider>
  )
}
