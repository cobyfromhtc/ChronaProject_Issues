'use client'

import { useState, useEffect, useCallback, startTransition } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { usePersonas } from '@/hooks/use-personas'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  MessageCircle, ChevronLeft, ChevronRight, PanelRightClose, PanelRight
} from 'lucide-react'
import { useVariantAccent } from '@/lib/ui-variant-styles'

// Custom event name for DM refresh
export const DM_REFRESH_EVENT = 'chrona:dm-refresh'

// Types
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
}

interface FriendUser {
  id: string
  friendId: string
  username: string
  avatarUrl: string | null
  isFavourite: boolean
  activePersona: {
    id: string
    name: string
    avatarUrl: string | null
    isOnline: boolean
  } | null
}

interface DMSidebarProps {
  activeChatId: string | null
  onSelectChat: (conversationId: string) => void
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

export function DMSidebar({
  activeChatId,
  onSelectChat,
  isCollapsed = false,
  onToggleCollapse
}: DMSidebarProps) {
  const { user } = useAuth()
  const { activePersona } = usePersonas()
  const accent = useVariantAccent()
  
  const [dmConversations, setDmConversations] = useState<DMConversation[]>([])
  const [friends, setFriends] = useState<FriendUser[]>([])
  const [isLoadingConversations, setIsLoadingConversations] = useState(true)
  const [isLoadingFriends, setIsLoadingFriends] = useState(true)
  
  // Fetch DM conversations
  const fetchConversations = useCallback(async () => {
    setIsLoadingConversations(true)
    try {
      const response = await fetch('/api/conversations')
      if (response.ok) {
        const data = await response.json()
        setDmConversations(data.conversations)
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error)
    } finally {
      setIsLoadingConversations(false)
    }
  }, [])
  
  // Initial fetch on mount
  useEffect(() => {
    startTransition(() => { fetchConversations() })
  }, [fetchConversations])
  
  // Listen for DM refresh events
  useEffect(() => {
    const handleRefresh = () => {
      fetchConversations()
    }
    
    window.addEventListener(DM_REFRESH_EVENT, handleRefresh)
    return () => window.removeEventListener(DM_REFRESH_EVENT, handleRefresh)
  }, [fetchConversations])
  
  // Fetch friends
  useEffect(() => {
    async function fetchFriends() {
      try {
        const response = await fetch('/api/friends')
        if (response.ok) {
          const data = await response.json()
          setFriends(data.friends)
        }
      } catch (error) {
        console.error('Failed to fetch friends:', error)
      } finally {
        setIsLoadingFriends(false)
      }
    }
    fetchFriends()
  }, [])
  

  
  // Start conversation
  const startConversation = async (targetPersonaId: string) => {
    if (!activePersona) {
      alert('Please activate a persona first!')
      return
    }
    
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetPersonaId, myPersonaId: activePersona.id })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        // Check if we need DM request (first message to this user)
        if (data.needsDmRequest) {
          alert('Send a message request to start chatting!')
          return
        }
        
        // Conversation created or already exists
        if (data.conversation) {
          onSelectChat(data.conversation.id)
        }
        
        // Refresh conversations list
        fetchConversations()
      }
    } catch (error) {
      console.error('Failed to start conversation:', error)
    }
  }
  
  // Separate favourites and regular friends
  const favouriteFriends = friends.filter(f => f.isFavourite)
  const regularFriends = friends.filter(f => !f.isFavourite)
  
  // Get online friends for the top section
  const onlineFriends = [...favouriteFriends, ...regularFriends].filter(f => f.activePersona?.isOnline)

  // Collapsed View
  if (isCollapsed) {
    return (
      <div className="w-14 bg-[#0e1015] border-r border-white/[0.08] flex flex-col flex-shrink-0 relative items-center py-3 gap-2 h-full">
        {/* Decorative top glow */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />
        
        {/* Toggle Button */}
        <button 
          onClick={onToggleCollapse}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] transition-all relative z-10"
          title="Expand sidebar"
        >
          <PanelRight className="w-4 h-4" />
        </button>
        
        {/* Divider */}
        <div className={`w-6 h-px ${accent.bgTint} my-1`} />
        
        {/* Online Friends Avatars */}
        {isLoadingFriends ? (
          <div className="flex flex-col gap-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className={`w-9 h-9 rounded-full ${accent.bgTint}`} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {onlineFriends.slice(0, 5).map((friend) => (
              <button
                key={friend.id}
                onClick={() => friend.activePersona && startConversation(friend.activePersona.id)}
                className="group relative p-0.5"
                title={friend.activePersona?.name || friend.username}
              >
                <div className="persona-status persona-status-online">
                  <Avatar className={`w-9 h-9 border-2 ${accent.avatarBorder} group-hover:${accent.borderStrong} transition-colors`}>
                    <AvatarImage src={friend.activePersona?.avatarUrl || friend.avatarUrl || undefined} />
                    <AvatarFallback className={`bg-gradient-to-br ${accent.avatarFrom} ${accent.avatarTo} text-white text-xs font-medium`}>
                      {(friend.activePersona?.name || friend.username)?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </button>
            ))}
          </div>
        )}
        
        {/* Divider */}
        {onlineFriends.length > 0 && <div className={`w-6 h-px ${accent.bgTint} my-1`} />}
        
        {/* Recent Conversations */}
        {isLoadingConversations ? (
          <div className="flex flex-col gap-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className={`w-9 h-9 rounded-full ${accent.bgTint}`} />
            ))}
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-2 items-center">
              {dmConversations.slice(0, 10).map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => onSelectChat(conv.id)}
                  className={`group relative p-0.5 rounded-full ${activeChatId === conv.id ? `ring-2 ring-inset ${accent.ringColor} ${accent.bgTint}` : ''}`}
                  title={conv.otherPersona.name}
                >
                  <div className={`persona-status ${conv.otherPersona.isOnline ? 'persona-status-online' : 'persona-status-offline'}`}>
                    <Avatar className={`w-9 h-9 border ${accent.avatarBorder} group-hover:${accent.borderStrong} transition-colors`}>
                      <AvatarImage src={conv.otherPersona.avatarUrl || undefined} />
                      <AvatarFallback className={`bg-gradient-to-br ${accent.avatarFrom} ${accent.avatarTo} text-white text-xs font-medium`}>
                        {conv.otherPersona.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}

      </div>
    )
  }

  // Expanded View
  return (
    <div className="w-60 bg-[#0e1015] border-r border-white/[0.08] flex flex-col flex-shrink-0 relative h-full">
      {/* Decorative top glow */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />
      
      {/* Header */}
      <div className="relative z-10 h-14 px-4 flex items-center justify-between border-b border-white/[0.08] flex-shrink-0">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-slate-400" />
          <span className="font-semibold text-slate-100">Messages</span>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={onToggleCollapse}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] transition-all"
            title="Collapse sidebar"
          >
            <PanelRightClose className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Online Friends Section */}
      {(onlineFriends.length > 0 || isLoadingFriends) && (
        <div className="relative z-10 px-3 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2 px-1 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="persona-section-header">Online — {onlineFriends.length}</span>
          </div>
          {isLoadingFriends ? (
            <div className="flex flex-wrap gap-3">
              {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className={`w-9 h-9 rounded-full ${accent.bgTint}`} />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {onlineFriends.slice(0, 8).map((friend) => (
                <button
                  key={friend.id}
                  onClick={() => friend.activePersona && startConversation(friend.activePersona.id)}
                  className="group relative p-0.5"
                  title={friend.activePersona?.name || friend.username}
                >
                  <div className="persona-status persona-status-online">
                    <Avatar className={`w-9 h-9 border-2 ${accent.avatarBorder} group-hover:${accent.borderStrong} transition-colors`}>
                      <AvatarImage src={friend.activePersona?.avatarUrl || friend.avatarUrl || undefined} />
                      <AvatarFallback className={`bg-gradient-to-br ${accent.avatarFrom} ${accent.avatarTo} text-white text-xs font-medium`}>
                        {(friend.activePersona?.name || friend.username)?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* DM List */}
      <div className="flex-1 flex flex-col min-h-0 relative z-10">
        <div className="px-4 py-2 flex-shrink-0">
          <span className="persona-section-header">Recent</span>
        </div>
        <ScrollArea className="flex-1 px-3">
          {isLoadingConversations ? (
            <div className="space-y-1">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skeleton className={`w-9 h-9 rounded-full ${accent.bgTint}`} />
                  <div className="flex-1">
                    <Skeleton className={`h-4 w-24 ${accent.bgTint} mb-1`} />
                    <Skeleton className="h-3 w-32 bg-white/[0.05]" />
                  </div>
                </div>
              ))}
            </div>
          ) : dmConversations.length > 0 ? (
            <div className="space-y-0.5 py-1">
              {dmConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => onSelectChat(conv.id)}
                  className={`persona-dm-item w-full ${activeChatId === conv.id ? 'persona-dm-item-active' : ''}`}
                >
                  <div className={`persona-status ${conv.otherPersona.isOnline ? 'persona-status-online' : 'persona-status-offline'}`}>
                    <Avatar className={`w-9 h-9 border ${accent.avatarBorder}`}>
                      <AvatarImage src={conv.otherPersona.avatarUrl || undefined} />
                      <AvatarFallback className={`bg-gradient-to-br ${accent.avatarFrom} ${accent.avatarTo} text-white text-xs font-medium`}>
                        {conv.otherPersona.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-slate-100 truncate">{conv.otherPersona.name}</p>
                    {conv.lastMessage && (
                      <p className="text-xs text-slate-500 truncate">{conv.lastMessage.content}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="w-12 h-12 rounded-full bg-white/[0.05] flex items-center justify-center mb-4 border border-white/[0.08]">
                <MessageCircle className="w-6 h-6 text-slate-400/80" />
              </div>
              <p className="text-sm font-medium text-slate-200/80">No conversations yet</p>
              <p className="text-xs text-slate-500 mt-1">Start chatting with friends!</p>
            </div>
          )}
        </ScrollArea>
      </div>
      
    </div>
  )
}
