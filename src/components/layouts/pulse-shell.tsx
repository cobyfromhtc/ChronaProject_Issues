'use client'

import { useState, useEffect, useCallback, useRef, startTransition } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { usePersonas } from '@/hooks/use-personas'
import { useUIVariant } from '@/stores/ui-variant-store'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { ProfileDropdown } from '@/components/profile-dropdown'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { apiFetch } from '@/lib/api-client'
import { canAccessAdminPanel } from '@/lib/roles'
import {
  Home,
  Users,
  BookOpen,
  MessageCircle,
  ShoppingBag,
  Coins,
  Search,
  Plus,
  Settings,
  LogOut,
  Sparkles,
  Check,
  Shield,
  Compass,
  Crown,
  TrendingUp,
  X,
  Loader2,
  UserPlus,
  Wand2,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PulseShellProps {
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
  username: string
}

interface TrendingStoryline {
  id: string
  name: string
  memberCount: number
  iconUrl: string | null
  category: string
}

// ---------------------------------------------------------------------------
// Bottom nav items
// ---------------------------------------------------------------------------

const BOTTOM_NAV_ITEMS: {
  id: PulseShellProps['activeTab']
  label: string
  icon: typeof Home
}[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'friends', label: 'Friends', icon: Users },
  { id: 'storylines', label: 'Stories', icon: BookOpen },
  { id: 'chat', label: 'Chat', icon: MessageCircle },
  { id: 'marketplace', label: 'Market', icon: ShoppingBag },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PulseShell({
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
}: PulseShellProps) {
  const { user, logout, switchAccount, accounts, removeAccount } = useAuth()
  const { personas, activePersona, activatePersona } = usePersonas()
  const { variant: uiVariant } = useUIVariant()

  // ---- Local state ----
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [onlinePersonas, setOnlinePersonas] = useState<OnlinePersona[]>([])
  const [isLoadingOnline, setIsLoadingOnline] = useState(false)
  const [trendingStorylines, setTrendingStorylines] = useState<TrendingStoryline[]>([])
  const [isLoadingTrending, setIsLoadingTrending] = useState(false)

  // ---- Refs ----
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ---- Derived ----
  const isAdmin = user ? canAccessAdminPanel(user.role) : false

  // ---- Tab bar items (context-dependent) ----
  const tabBarItems = (() => {
    switch (activeTab) {
      case 'home':
        return ['Discover', 'Trending', 'Featured', 'New']
      case 'friends':
        return ['All Friends', 'Online', 'Pending', 'Blocked']
      case 'storylines':
        return ['My Storylines', 'Browse', 'Featured', 'Create']
      case 'chat':
        return ['Messages', 'Requests']
      case 'marketplace':
        return ['Browse', 'My Listings', 'Purchased']
      default:
        return []
    }
  })()

  const [activeSubTab, setActiveSubTab] = useState(0)

  // Reset sub-tab when main tab changes
  useEffect(() => {
    startTransition(() => { setActiveSubTab(0) })
  }, [activeTab])

  // ---- Fetch online personas (desktop sidebar) ----
  const fetchOnlinePersonas = useCallback(async () => {
    setIsLoadingOnline(true)
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

  // ---- Fetch trending storylines (desktop sidebar) ----
  const fetchTrendingStorylines = useCallback(async () => {
    setIsLoadingTrending(true)
    try {
      const response = await apiFetch('/api/storylines')
      if (response.ok) {
        const data = await response.json()
        const storylines = (data.storylines || [])
          .sort((a: any, b: any) => (b.memberCount || 0) - (a.memberCount || 0))
          .slice(0, 5)
        setTrendingStorylines(storylines)
      }
    } catch (error) {
      console.error('Failed to fetch trending storylines:', error)
    } finally {
      setIsLoadingTrending(false)
    }
  }, [])

  // Fetch sidebar data on mount
  useEffect(() => {
    startTransition(() => {
      fetchOnlinePersonas()
      fetchTrendingStorylines()
    })

    // Refresh online list every 60s
    const interval = setInterval(fetchOnlinePersonas, 60_000)
    return () => clearInterval(interval)
  }, [fetchOnlinePersonas, fetchTrendingStorylines])

  // ---- Search ----
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current)
    }

    if (query.length < 2) {
      setSearchResults([])
      return
    }

    searchDebounceRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const response = await apiFetch(
          `/api/friends/search?q=${encodeURIComponent(query)}`
        )
        if (response.ok) {
          const data = await response.json()
          setSearchResults(data.users || [])
        }
      } catch (error) {
        console.error('Search error:', error)
      } finally {
        setIsSearching(false)
      }
    }, 300)
  }, [])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current)
      }
    }
  }, [])

  // ---- Persona quick-switch ----
  const handlePersonaSwitch = useCallback(
    async (personaId: string) => {
      try {
        await activatePersona(personaId)
      } catch (error) {
        console.error('Failed to switch persona:', error)
      }
    },
    [activatePersona]
  )

  // ---- Account switch ----
  const handleAccountSwitch = useCallback(
    async (userId: string) => {
      try {
        await switchAccount(userId)
        window.location.reload()
      } catch (error) {
        console.error('Failed to switch account:', error)
      }
    },
    [switchAccount]
  )

  // ---- Compute avatar display ----
  const avatarSrc = user?.avatarUrl || activePersona?.avatarUrl || undefined
  const avatarFallback =
    (user?.username || activePersona?.name || 'U').charAt(0).toUpperCase()

  // ======================================================================
  // RENDER
  // ======================================================================

  return (
    <div className="flex flex-col h-screen bg-[#0c0a09] text-slate-100 overflow-hidden">
      {/* ====== TOP BAR ====== */}
      <header className="flex-shrink-0 bg-[#100e0d] border-b border-white/[0.06] z-30">
        <div className="flex items-center gap-3 px-4 h-12">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search users, storylines..."
              className="w-full h-8 pl-9 pr-8 rounded-full bg-white/[0.04] border border-white/[0.06] text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-orange-500/40 focus:ring-1 focus:ring-orange-500/20 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setSearchResults([])
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}

            {/* Search dropdown */}
            {searchQuery.length >= 2 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#100e0d] border border-white/[0.08] rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-50">
                {isSearching ? (
                  <div className="p-4 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-orange-400" />
                  </div>
                ) : searchResults.length > 0 ? (
                  <ScrollArea className="max-h-64">
                    <div className="p-1.5">
                      {searchResults.map((result: any) => (
                        <button
                          key={result.id}
                          onClick={() => {
                            if (result.activePersona) {
                              onStartChat({
                                targetPersonaId: result.activePersona.id,
                                name: result.activePersona.name,
                                avatarUrl: result.activePersona.avatarUrl,
                              })
                            }
                            setSearchQuery('')
                            setSearchResults([])
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.04] transition-colors text-left"
                        >
                          <div className="relative">
                            <Avatar className="w-9 h-9 border border-orange-500/20">
                              <AvatarImage
                                src={
                                  result.activePersona?.avatarUrl ||
                                  result.avatarUrl ||
                                  undefined
                                }
                              />
                              <AvatarFallback className="bg-gradient-to-br from-orange-500/40 to-amber-500/50 text-white text-xs font-medium">
                                {(
                                  result.activePersona?.name ||
                                  result.username
                                )
                                  .charAt(0)
                                  .toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            {result.activePersona?.isOnline && (
                              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#100e0d]" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-100 truncate">
                              {result.username}
                            </p>
                            {result.activePersona && (
                              <p className="text-xs text-slate-500">
                                as {result.activePersona.name}
                              </p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="p-4 text-center">
                    <p className="text-sm text-slate-500">No results found</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Logo - center */}
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-2">
              <img
                src="/logo.png"
                alt="Chrona"
                className="w-7 h-7 rounded-lg object-cover"
              />
              <span className="text-sm font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent hidden sm:inline">
                Chrona
              </span>
            </div>
          </div>

          {/* Right: Avatar with dropdown */}
          <div className="flex-1 flex items-center justify-end gap-2">
            {/* Create persona quick action */}
            <button
              onClick={onCreatePersona}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50"
              title="Create Persona"
            >
              <Plus className="w-4 h-4" />
            </button>

            {/* Profile Dropdown with Settings/Preferences */}
            <ProfileDropdown
              onNavigate={onNavigate}
              onOpenEditProfile={onOpenEditProfile}
              onOpenMyPersonas={onOpenMyPersonas}
              position="bottom-right"
              trigger={
                <button className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50">
                  <Settings className="w-4 h-4" />
                </button>
              }
            />

            {/* Avatar dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="relative w-8 h-8 rounded-full overflow-hidden ring-2 ring-white/10 hover:ring-orange-500/40 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={avatarSrc} />
                    <AvatarFallback className="bg-gradient-to-br from-orange-500 to-amber-500 text-white text-xs font-semibold">
                      {avatarFallback}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#100e0d]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-72 bg-[#100e0d] border-white/[0.08] rounded-xl shadow-2xl shadow-black/40"
              >
                {/* User info header */}
                <div className="px-3 py-2.5 border-b border-white/[0.06]">
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      <Avatar className="w-10 h-10 border-2 border-orange-500/25">
                        <AvatarImage src={avatarSrc} />
                        <AvatarFallback className="bg-gradient-to-br from-orange-500 to-amber-500 text-white text-sm font-semibold">
                          {avatarFallback}
                        </AvatarFallback>
                      </Avatar>
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#100e0d]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-100 truncate">
                        {user?.username || 'User'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {activePersona ? `as ${activePersona.name}` : 'No active persona'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Persona quick-switch */}
                {personas.length > 0 && (
                  <div className="px-1 py-1.5">
                    <DropdownMenuLabel className="text-[10px] text-slate-500 uppercase tracking-wider font-medium px-2 py-1">
                      Switch Persona
                    </DropdownMenuLabel>
                    <div className="max-h-36 overflow-y-auto custom-scrollbar">
                      {personas.map((persona) => (
                        <DropdownMenuItem
                          key={persona.id}
                          onClick={() => handlePersonaSwitch(persona.id)}
                          className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-orange-500/10 focus:bg-orange-500/10"
                        >
                          <Avatar className="w-7 h-7 border border-orange-500/20">
                            <AvatarImage src={persona.avatarUrl || undefined} />
                            <AvatarFallback className="bg-gradient-to-br from-orange-500/40 to-amber-500/50 text-white text-[10px] font-medium">
                              {persona.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-slate-200 flex-1 truncate">
                            {persona.name}
                          </span>
                          {persona.isActive && (
                            <Check className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                          )}
                        </DropdownMenuItem>
                      ))}
                    </div>
                  </div>
                )}

                <DropdownMenuSeparator className="bg-white/[0.06]" />

                {/* Account switch */}
                {accounts.length > 1 && (
                  <>
                    <DropdownMenuLabel className="text-[10px] text-slate-500 uppercase tracking-wider font-medium px-2 py-1">
                      Switch Account
                    </DropdownMenuLabel>
                    <div className="max-h-28 overflow-y-auto custom-scrollbar">
                      {accounts.map((account) => (
                        <DropdownMenuItem
                          key={account.id}
                          onClick={() => handleAccountSwitch(account.id)}
                          className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-orange-500/10 focus:bg-orange-500/10"
                        >
                          <Avatar className="w-6 h-6 border border-white/10">
                            <AvatarImage src={account.avatarUrl || undefined} />
                            <AvatarFallback className="bg-gradient-to-br from-orange-500/40 to-amber-500/50 text-white text-[9px] font-medium">
                              {account.username.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-slate-200 flex-1 truncate">
                            {account.username}
                          </span>
                          {account.isActive && (
                            <Check className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                          )}
                        </DropdownMenuItem>
                      ))}
                    </div>
                    <DropdownMenuSeparator className="bg-white/[0.06]" />
                  </>
                )}

                {/* Actions */}
                <DropdownMenuItem
                  onClick={onOpenMyPersonas}
                  className="flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer hover:bg-orange-500/10 focus:bg-orange-500/10"
                >
                  <Users className="w-4 h-4 text-orange-400" />
                  <span className="text-sm text-slate-200">My Personas</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onOpenEditProfile}
                  className="flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer hover:bg-orange-500/10 focus:bg-orange-500/10"
                >
                  <Settings className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-200">Edit Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onCreatePersona}
                  className="flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer hover:bg-orange-500/10 focus:bg-orange-500/10"
                >
                  <Wand2 className="w-4 h-4 text-orange-400" />
                  <span className="text-sm text-slate-200">Create Persona</span>
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem
                    onClick={() => onSelectTab('admin')}
                    className="flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer hover:bg-orange-500/10 focus:bg-orange-500/10"
                  >
                    <Shield className="w-4 h-4 text-amber-400" />
                    <span className="text-sm text-slate-200">Admin Panel</span>
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator className="bg-white/[0.06]" />

                <DropdownMenuItem
                  onClick={() => logout()}
                  className="flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer hover:bg-red-500/10 focus:bg-red-500/10"
                >
                  <LogOut className="w-4 h-4 text-red-400" />
                  <span className="text-sm text-red-400">Log Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* ====== TAB BAR (sub-navigation) ====== */}
      {tabBarItems.length > 0 && (
        <div className="flex-shrink-0 bg-[#100e0d] border-b border-white/[0.06] z-20">
          <ScrollArea className="w-full">
            <div className="flex items-center gap-1 px-4 py-2 min-w-max">
              {tabBarItems.map((item, idx) => (
                <button
                  key={item}
                  onClick={() => setActiveSubTab(idx)}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50 focus-visible:ring-offset-1 focus-visible:ring-offset-[#100e0d] ${
                    activeSubTab === idx
                      ? 'bg-orange-500/15 text-orange-400 border border-orange-500/25'
                      : 'text-slate-400 hover:text-slate-300 hover:bg-white/[0.04] border border-transparent'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* ====== MAIN CONTENT AREA ====== */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Content column */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          <div className="pb-20 lg:pb-4">{children}</div>
        </main>

        {/* ====== RIGHT SIDEBAR (Desktop only) ====== */}
        <aside className="hidden lg:flex flex-col w-72 flex-shrink-0 bg-[#100e0d] border-l border-white/[0.06] overflow-hidden">
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-5">
              {/* ---- Quick Actions ---- */}
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
                  Quick Actions
                </h3>
                <div className="space-y-1.5">
                  <button
                    onClick={onCreatePersona}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-gradient-to-r from-orange-500/15 to-amber-500/10 border border-orange-500/20 hover:border-orange-500/30 hover:from-orange-500/20 hover:to-amber-500/15 transition-all duration-200 text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50"
                  >
                    <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center group-hover:bg-orange-500/30 transition-colors duration-200">
                      <Wand2 className="w-4 h-4 text-orange-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-orange-300 group-hover:text-orange-200 transition-colors duration-200">
                        Create Persona
                      </p>
                      <p className="text-[10px] text-slate-400">New character</p>
                    </div>
                  </button>
                  <button
                    onClick={() => onSelectTab('storylines')}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.10] hover:bg-white/[0.04] transition-all duration-200 text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50"
                  >
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/15 transition-colors duration-200">
                      <Crown className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors duration-200">
                        Create Storyline
                      </p>
                      <p className="text-[10px] text-slate-400">Start a new RP</p>
                    </div>
                  </button>
                </div>
              </div>

              <Separator className="bg-white/[0.06]" />

              {/* ---- Online Personas ---- */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Online Now
                  </h3>
                  {isLoadingOnline && (
                    <Loader2 className="w-3 h-3 animate-spin text-orange-400" />
                  )}
                </div>
                {onlinePersonas.length > 0 ? (
                  <div className="space-y-1">
                    {onlinePersonas.slice(0, 10).map((persona) => (
                      <button
                        key={persona.id}
                        onClick={() =>
                          onStartChat({
                            targetPersonaId: persona.id,
                            name: persona.name,
                            avatarUrl: persona.avatarUrl,
                          })
                        }
                        className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-white/[0.04] transition-all duration-200 text-left group"
                      >
                        <div className="relative">
                          <Avatar className="w-8 h-8 border border-orange-500/15">
                            <AvatarImage src={persona.avatarUrl || undefined} />
                            <AvatarFallback className="bg-gradient-to-br from-orange-500/40 to-amber-500/50 text-white text-xs font-medium">
                              {persona.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#100e0d]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-200 group-hover:text-white truncate transition-colors">
                            {persona.name}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {persona.username}
                          </p>
                        </div>
                      </button>
                    ))}
                    {onlinePersonas.length > 10 && (
                      <p className="text-[10px] text-slate-500 text-center pt-1">
                        +{onlinePersonas.length - 10} more online
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <Users className="w-6 h-6 text-slate-600 mb-2" />
                    <p className="text-sm text-slate-400">Nobody online right now</p>
                  </div>
                )}
              </div>

              <Separator className="bg-white/[0.06]" />

              {/* ---- Trending Storylines ---- */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-3 h-3 text-orange-400" />
                    Trending
                  </h3>
                  {isLoadingTrending && (
                    <Loader2 className="w-3 h-3 animate-spin text-orange-400" />
                  )}
                </div>
                {trendingStorylines.length > 0 ? (
                  <div className="space-y-1">
                    {trendingStorylines.map((storyline) => (
                      <button
                        key={storyline.id}
                        onClick={() => onSelectStoryline(storyline.id)}
                        className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-white/[0.04] transition-all duration-200 text-left group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center overflow-hidden border border-orange-500/20 flex-shrink-0">
                          {storyline.iconUrl ? (
                            <img
                              src={storyline.iconUrl}
                              alt={storyline.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-white font-bold text-xs">
                              {storyline.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-200 group-hover:text-white truncate transition-colors">
                            {storyline.name}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {storyline.memberCount} members
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <Compass className="w-6 h-6 text-slate-600 mb-2" />
                    <p className="text-sm text-slate-400">No trending storylines</p>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </aside>
      </div>

      {/* ====== BOTTOM NAVIGATION ====== */}
      <nav className="flex-shrink-0 fixed bottom-0 left-0 right-0 bg-[#100e0d] border-t border-white/[0.06] z-30 safe-area-bottom">
        <div className="flex items-center justify-around h-14 max-w-lg mx-auto px-2">
          {BOTTOM_NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-xl transition-all duration-200 relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50 focus-visible:ring-offset-1 focus-visible:ring-offset-[#100e0d] ${
                  isActive
                    ? 'text-orange-400'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {isActive && (
                  <span className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-orange-400" />
                )}
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    isActive ? 'scale-110' : ''
                  }`}
                />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            )
          })}

          {/* Chronos / Wallet */}
          <button
            onClick={() => onSelectTab('wallet')}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-xl transition-all duration-200 relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50 focus-visible:ring-offset-1 focus-visible:ring-offset-[#100e0d] ${
              activeTab === 'wallet'
                ? 'text-orange-400'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {activeTab === 'wallet' && (
              <span className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-orange-400" />
            )}
            <Coins
              className={`w-5 h-5 transition-transform ${
                activeTab === 'wallet' ? 'scale-110' : ''
              }`}
            />
            <span className="text-[10px] font-medium">Chronos</span>
          </button>

          {/* Admin - conditional */}
          {isAdmin && (
            <button
              onClick={() => onSelectTab('admin')}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-xl transition-all duration-200 relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50 focus-visible:ring-offset-1 focus-visible:ring-offset-[#100e0d] ${
                activeTab === 'admin'
                  ? 'text-orange-400'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {activeTab === 'admin' && (
                <span className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-orange-400" />
              )}
              <Shield
                className={`w-5 h-5 transition-transform ${
                  activeTab === 'admin' ? 'scale-110' : ''
                }`}
              />
              <span className="text-[10px] font-medium">Admin</span>
            </button>
          )}
        </div>
      </nav>

      {/* ====== GLOBAL STYLES ====== */}
      <style jsx global>{`
        /* Safe area padding for bottom nav on iOS */
        .safe-area-bottom {
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }

        /* Custom scrollbar for pulse theme */
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.14);
        }

        /* Pulse accent animation */
        @keyframes pulse-accent {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  )
}
