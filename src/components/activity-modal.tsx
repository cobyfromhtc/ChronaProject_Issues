'use client'

import React, { useState, useEffect, useCallback, startTransition } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Activity, Users, AtSign, Crown, MessageCircle, Bell, 
  Search, X, Loader2, Circle, ChevronRight, Clock,
  Sparkles, TrendingUp, Zap
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { useVariantAccent } from '@/lib/ui-variant-styles'

interface OnlinePersona {
  id: string
  name: string
  avatarUrl: string | null
  username: string
  isOnline: boolean
}

interface Mention {
  id: string
  content: string
  createdAt: string
  fromPersona: {
    id: string
    name: string
    avatarUrl: string | null
  }
  storylineId: string | null
  storylineName: string | null
}

interface StorylineActivity {
  id: string
  name: string
  iconUrl: string | null
  memberCount: number
  lastActivity: string
}

interface Conversation {
  id: string
  otherPersona: {
    id: string
    name: string
    avatarUrl: string | null
    isOnline: boolean
  }
  lastMessage: {
    content: string
    createdAt: string
  } | null
  lastMessageAt: string
}

interface ActivityModalProps {
  isOpen: boolean
  onClose: () => void
  onStartChat?: (params: { targetPersonaId: string; myPersonaId?: string }) => void
  activePersonaId?: string | null
}

export function ActivityModal({ isOpen, onClose, onStartChat, activePersonaId }: ActivityModalProps) {
  const accent = useVariantAccent()
  const [activeTab, setActiveTab] = useState('online')
  const [searchQuery, setSearchQuery] = useState('')
  
  // Data states
  const [onlinePersonas, setOnlinePersonas] = useState<OnlinePersona[]>([])
  const [mentions, setMentions] = useState<Mention[]>([])
  const [storylineActivity, setStorylineActivity] = useState<StorylineActivity[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  
  // Loading states
  const [isLoadingOnline, setIsLoadingOnline] = useState(false)
  const [isLoadingMentions, setIsLoadingMentions] = useState(false)
  const [isLoadingActivity, setIsLoadingActivity] = useState(false)
  const [isLoadingConversations, setIsLoadingConversations] = useState(false)

  // Fetch functions
  const fetchOnlinePersonas = useCallback(async () => {
    setIsLoadingOnline(true)
    try {
      const res = await fetch('/api/personas/online')
      if (res.ok) {
        const data = await res.json()
        setOnlinePersonas(data.personas || [])
      }
    } catch (err) {
      console.error('Failed to fetch online personas:', err)
    } finally {
      setIsLoadingOnline(false)
    }
  }, [])

  const fetchMentions = useCallback(async () => {
    setIsLoadingMentions(true)
    try {
      const res = await fetch('/api/mentions')
      if (res.ok) {
        const data = await res.json()
        setMentions(data.mentions || [])
      }
    } catch (err) {
      console.error('Failed to fetch mentions:', err)
    } finally {
      setIsLoadingMentions(false)
    }
  }, [])

  const fetchStorylineActivity = useCallback(async () => {
    setIsLoadingActivity(true)
    try {
      const res = await fetch('/api/storylines')
      if (res.ok) {
        const data = await res.json()
        const storylines = (data.storylines || []).map((sl: any) => ({
          id: sl.id,
          name: sl.name,
          iconUrl: sl.iconUrl || null,
          memberCount: sl._count?.members || 0,
          lastActivity: sl.lastActivity || sl.updatedAt || ''
        }))
        // Sort by last activity
        storylines.sort((a: StorylineActivity, b: StorylineActivity) => 
          new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
        )
        setStorylineActivity(storylines)
      }
    } catch (err) {
      console.error('Failed to fetch storyline activity:', err)
    } finally {
      setIsLoadingActivity(false)
    }
  }, [])

  const fetchConversations = useCallback(async () => {
    setIsLoadingConversations(true)
    try {
      const res = await fetch('/api/dm/conversations')
      if (res.ok) {
        const data = await res.json()
        setConversations(data.conversations || [])
      }
    } catch (err) {
      console.error('Failed to fetch conversations:', err)
    } finally {
      setIsLoadingConversations(false)
    }
  }, [])

  // Load all data on open
  useEffect(() => {
    if (isOpen) {
      startTransition(() => {
        fetchOnlinePersonas()
        fetchMentions()
        fetchStorylineActivity()
        fetchConversations()
      })
    }
  }, [isOpen, fetchOnlinePersonas, fetchMentions, fetchStorylineActivity, fetchConversations])

  // Helper function for relative time
  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return format(date, 'MMM d')
  }

  // Filter by search query
  const filteredOnline = onlinePersonas.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.username.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredMentions = mentions.filter(m => 
    m.fromPersona.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.content.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredStorylines = storylineActivity.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredConversations = conversations.filter(c =>
    c.otherPersona.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Stats
  const totalOnline = onlinePersonas.length
  const totalMentions = mentions.length
  const totalActivity = storylineActivity.length

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={`max-w-2xl max-h-[85vh] overflow-hidden flex flex-col ${accent.bgSurfaceDeep} border-white/[0.08]`}>
        {/* Header */}
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${accent.bgHeavy} flex items-center justify-center`}>
              <Activity className={`w-5 h-5 ${accent.text}`} />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-slate-100">Activity Center</DialogTitle>
              <p className="text-xs text-slate-500">Stay updated with your latest activity</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </DialogHeader>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3 py-4">
          <div className={`${accent.bgTint} ${accent.borderSubtle} border rounded-xl p-3`}>
            <div className="flex items-center gap-2 mb-1">
              <Circle className={`w-2.5 h-2.5 ${accent.text.replace('text-', 'text-')} fill-current animate-pulse`} />
              <span className="text-xs text-slate-400">Online</span>
            </div>
            <span className="text-xl font-bold text-slate-100">{totalOnline}</span>
          </div>
          <div className={`${accent.bgTint} ${accent.borderSubtle} border rounded-xl p-3`}>
            <div className="flex items-center gap-2 mb-1">
              <AtSign className={`w-2.5 h-2.5 ${accent.text}`} />
              <span className="text-xs text-slate-400">Mentions</span>
            </div>
            <span className="text-xl font-bold text-slate-100">{totalMentions}</span>
          </div>
          <div className={`${accent.bgTint} ${accent.borderSubtle} border rounded-xl p-3`}>
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className={`w-2.5 h-2.5 ${accent.text}`} />
              <span className="text-xs text-slate-400">Active</span>
            </div>
            <span className="text-xl font-bold text-slate-100">{totalActivity}</span>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search activity..."
            className={`pl-9 h-9 ${accent.bgSurface} border-white/[0.06] text-sm text-slate-200 placeholder:text-slate-500 focus:${accent.borderMedium}`}
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-4 h-9 bg-white/[0.02] border border-white/[0.06] rounded-lg mb-3">
            <TabsTrigger 
              value="online" 
              className="h-7 text-xs rounded-md text-slate-400 data-[state=active]:text-white data-[state=active]:bg-white/10 hover:text-slate-300 hover:bg-white/[0.04] transition-all"
            >
              <Users className="w-3.5 h-3.5 mr-1.5" />
              Online
            </TabsTrigger>
            <TabsTrigger 
              value="mentions" 
              className="h-7 text-xs rounded-md text-slate-400 data-[state=active]:text-white data-[state=active]:bg-white/10 hover:text-slate-300 hover:bg-white/[0.04] transition-all relative"
            >
              <AtSign className="w-3.5 h-3.5 mr-1.5" />
              Mentions
              {totalMentions > 0 && (
                <Badge className={`ml-1 h-4 px-1 text-[9px] ${accent.bgSolid} text-white border-0`}>
                  {totalMentions}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="storylines" 
              className="h-7 text-xs rounded-md text-slate-400 data-[state=active]:text-white data-[state=active]:bg-white/10 hover:text-slate-300 hover:bg-white/[0.04] transition-all"
            >
              <Crown className="w-3.5 h-3.5 mr-1.5" />
              Storylines
            </TabsTrigger>
            <TabsTrigger 
              value="messages" 
              className="h-7 text-xs rounded-md text-slate-400 data-[state=active]:text-white data-[state=active]:bg-white/10 hover:text-slate-300 hover:bg-white/[0.04] transition-all"
            >
              <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
              Messages
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 -mx-6 px-6">
            {/* Online Tab */}
            <TabsContent value="online" className="mt-0 space-y-1">
              {isLoadingOnline ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className={`w-6 h-6 animate-spin ${accent.text}`} />
                </div>
              ) : filteredOnline.length > 0 ? (
                filteredOnline.map((persona) => (
                  <button
                    key={persona.id}
                    onClick={() => {
                      if (onStartChat && activePersonaId) {
                        onStartChat({ targetPersonaId: persona.id, myPersonaId: activePersonaId })
                        onClose()
                      }
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-colors group"
                  >
                    <div className="relative">
                      <Avatar className={`w-10 h-10 ${accent.avatarBorder}`}>
                        <AvatarImage src={persona.avatarUrl || undefined} />
                        <AvatarFallback className={`${accent.avatarFrom} ${accent.avatarTo} text-white font-medium`}>
                          {persona.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0f1117]" />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-200 group-hover:text-slate-100 truncate">
                          {persona.name}
                        </span>
                        <span className="text-[10px] text-slate-600">@{persona.username}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Circle className="w-1.5 h-1.5 fill-emerald-400 text-emerald-400" />
                        <span className="text-xs text-emerald-400">Online now</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                  </button>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className={`w-14 h-14 rounded-xl ${accent.bgHeavy} flex items-center justify-center mb-3`}>
                    <Users className={`w-6 h-6 ${accent.text}`} />
                  </div>
                  <p className="text-sm font-medium text-slate-300">No one online right now</p>
                  <p className="text-xs text-slate-500 mt-1">Check back later or start a new conversation</p>
                </div>
              )}
            </TabsContent>

            {/* Mentions Tab */}
            <TabsContent value="mentions" className="mt-0 space-y-1">
              {isLoadingMentions ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className={`w-6 h-6 animate-spin ${accent.text}`} />
                </div>
              ) : filteredMentions.length > 0 ? (
                filteredMentions.map((mention) => (
                  <button
                    key={mention.id}
                    className="w-full flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-colors group text-left"
                  >
                    <Avatar className={`w-9 h-9 mt-0.5 ${accent.avatarBorder}`}>
                      <AvatarImage src={mention.fromPersona.avatarUrl || undefined} />
                      <AvatarFallback className={`${accent.avatarFrom} ${accent.avatarTo} text-white text-xs`}>
                        {mention.fromPersona.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-sm font-medium ${accent.text}`}>
                          {mention.fromPersona.name}
                        </span>
                        {mention.storylineName && (
                          <span className="text-xs text-slate-600">in {mention.storylineName}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-2 mb-1">
                        {mention.content}
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(mention.createdAt)}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors mt-1" />
                  </button>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className={`w-14 h-14 rounded-xl ${accent.bgHeavy} flex items-center justify-center mb-3`}>
                    <AtSign className={`w-6 h-6 ${accent.text}`} />
                  </div>
                  <p className="text-sm font-medium text-slate-300">No mentions yet</p>
                  <p className="text-xs text-slate-500 mt-1">When someone mentions you, it will appear here</p>
                </div>
              )}
            </TabsContent>

            {/* Storylines Tab */}
            <TabsContent value="storylines" className="mt-0 space-y-1">
              {isLoadingActivity ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className={`w-6 h-6 animate-spin ${accent.text}`} />
                </div>
              ) : filteredStorylines.length > 0 ? (
                filteredStorylines.map((storyline) => (
                  <button
                    key={storyline.id}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-colors group"
                  >
                    <div className={`w-10 h-10 rounded-xl ${accent.bgSubtle} border ${accent.borderSubtle} flex items-center justify-center overflow-hidden`}>
                      {storyline.iconUrl ? (
                        <img src={storyline.iconUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Crown className={`w-5 h-5 ${accent.text}`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <span className="font-medium text-slate-200 group-hover:text-slate-100 truncate block">
                        {storyline.name}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Users className="w-3 h-3 text-slate-600" />
                        <span className="text-xs text-slate-500">{storyline.memberCount} members</span>
                        <span className="text-slate-700">•</span>
                        <span className="text-xs text-slate-500">
                          {storyline.lastActivity ? formatRelativeTime(storyline.lastActivity) : 'No activity'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {storyline.lastActivity && (
                        <div className={`w-2 h-2 rounded-full ${accent.bgSolid}`} />
                      )}
                      <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                    </div>
                  </button>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className={`w-14 h-14 rounded-xl ${accent.bgHeavy} flex items-center justify-center mb-3`}>
                    <Crown className={`w-6 h-6 ${accent.text}`} />
                  </div>
                  <p className="text-sm font-medium text-slate-300">No active storylines</p>
                  <p className="text-xs text-slate-500 mt-1">Join a storyline to see activity here</p>
                </div>
              )}
            </TabsContent>

            {/* Messages Tab */}
            <TabsContent value="messages" className="mt-0 space-y-1">
              {isLoadingConversations ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className={`w-6 h-6 animate-spin ${accent.text}`} />
                </div>
              ) : filteredConversations.length > 0 ? (
                filteredConversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-colors group"
                  >
                    <div className="relative">
                      <Avatar className={`w-10 h-10 ${accent.avatarBorder}`}>
                        <AvatarImage src={conversation.otherPersona.avatarUrl || undefined} />
                        <AvatarFallback className={`${accent.avatarFrom} ${accent.avatarTo} text-white font-medium`}>
                          {conversation.otherPersona.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {conversation.otherPersona.isOnline && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0f1117]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-200 group-hover:text-slate-100 truncate">
                          {conversation.otherPersona.name}
                        </span>
                        {conversation.otherPersona.isOnline && (
                          <span className="text-[10px] text-emerald-400">Online</span>
                        )}
                      </div>
                      {conversation.lastMessage && (
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {conversation.lastMessage.content}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-600">
                        {conversation.lastMessageAt ? formatRelativeTime(conversation.lastMessageAt) : ''}
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors mt-1" />
                    </div>
                  </button>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className={`w-14 h-14 rounded-xl ${accent.bgHeavy} flex items-center justify-center mb-3`}>
                    <MessageCircle className={`w-6 h-6 ${accent.text}`} />
                  </div>
                  <p className="text-sm font-medium text-slate-300">No conversations yet</p>
                  <p className="text-xs text-slate-500 mt-1">Start a chat from the Online tab</p>
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        {/* Footer */}
        <div className="pt-3 mt-3 border-t border-white/[0.06] flex items-center justify-between">
          <p className="text-[10px] text-slate-600">
            Last updated: {new Date().toLocaleTimeString()}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              fetchOnlinePersonas()
              fetchMentions()
              fetchStorylineActivity()
              fetchConversations()
            }}
            className="h-7 text-xs text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
          >
            <Zap className="w-3 h-3 mr-1" />
            Refresh
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
