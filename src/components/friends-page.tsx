'use client'

import { useState, useEffect, useRef, useCallback, startTransition } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { usePersonas } from '@/hooks/use-personas'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Users, UserPlus, Clock, Ban, Star, X, MessageCircle,
  Check, Sparkles, Heart, Send, Loader2, UserX, Mail
} from 'lucide-react'
import { DM_REFRESH_EVENT } from '@/components/dm-sidebar'
import { useVariantAccent } from '@/lib/ui-variant-styles'
import { parseMessageWithMarkdown } from '@/lib/markdown'

interface Conversation {
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
  createdAt: string
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

interface PendingRequest {
  id: string
  sender: {
    id: string
    username: string
    avatarUrl: string | null
    personas?: {
      id: string
      name: string
      avatarUrl: string | null
    }[]
  }
}

interface SentRequest {
  id: string
  receiver: {
    id: string
    username: string
    avatarUrl: string | null
  }
}

interface BlockedUser {
  id: string
  blockedAt: string
  user: {
    id: string
    username: string
    avatarUrl: string | null
  }
}

interface SearchResult {
  id: string
  username: string
  avatarUrl: string | null
  activePersona?: {
    name: string
    avatarUrl: string | null
  } | null
}

interface DmRequest {
  id: string
  firstMessage: string
  imageUrl: string | null
  createdAt: string
  sender: {
    id: string
    name: string
    avatarUrl: string | null
    username: string
    userId: string
  }
}

type TabType = 'all' | 'online' | 'pending' | 'blocked' | 'favourites'

interface FriendsPageProps {
  onStartChat?: (conversation: Conversation) => void
}

export function FriendsPage({ onStartChat }: FriendsPageProps) {
  const { user } = useAuth()
  const { activePersona } = usePersonas()
  const accent = useVariantAccent()
  
  const [activeTab, setActiveTab] = useState<TabType>('all')
  const [friends, setFriends] = useState<FriendUser[]>([])
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([])
  const [sentRequests, setSentRequests] = useState<SentRequest[]>([])
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([])
  const [dmRequests, setDmRequests] = useState<DmRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Add Friend state
  const [showAddFriend, setShowAddFriend] = useState(false)
  const [addFriendUsername, setAddFriendUsername] = useState('')
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [actioningRequestId, setActioningRequestId] = useState<string | null>(null)
  const [actioningDmRequestId, setActioningDmRequestId] = useState<string | null>(null)
  
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Fetch all data
  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [friendsRes, requestsRes, blockedRes, dmRequestsRes] = await Promise.all([
        fetch('/api/friends'),
        fetch('/api/friends/requests'),
        fetch('/api/friends/blocked'),
        fetch('/api/dm-requests')
      ])
      
      if (friendsRes.ok) {
        const data = await friendsRes.json()
        setFriends(data.friends)
      }
      
      if (requestsRes.ok) {
        const data = await requestsRes.json()
        setPendingRequests(data.received || [])
        setSentRequests(data.sent || [])
      }
      
      if (blockedRes.ok) {
        const data = await blockedRes.json()
        setBlockedUsers(data.blocked)
      }
      
      if (dmRequestsRes.ok) {
        const data = await dmRequestsRes.json()
        setDmRequests(data.dmRequests || [])
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])
  
  useEffect(() => {
    startTransition(() => { fetchData() })
  }, [fetchData])
  
  // Debounced search as user types
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    
    const trimmedUsername = addFriendUsername.trim()
    
    // Reset search state if input is empty
    if (!trimmedUsername) {
      startTransition(() => {
        setSearchResult(null)
        setHasSearched(false)
        setMessage(null)
      })
      return
    }
    
    // Debounce search - wait 400ms after user stops typing
    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true)
      setHasSearched(false)
      setMessage(null)
      
      try {
        const response = await fetch(`/api/friends/search?q=${encodeURIComponent(trimmedUsername)}`)
        const data = await response.json()
        
        if (response.ok && data.users) {
          // Find exact match (case-insensitive)
          const exactMatch = data.users.find(
            (u: SearchResult) => u.username.toLowerCase() === trimmedUsername.toLowerCase()
          )
          
          if (exactMatch) {
            setSearchResult(exactMatch)
            setHasSearched(true)
          } else {
            setSearchResult(null)
            setHasSearched(true) // Mark as searched to show "not found"
          }
        } else {
          setSearchResult(null)
          setHasSearched(true)
        }
      } catch (error) {
        console.error('Search error:', error)
        setSearchResult(null)
        setHasSearched(true)
      } finally {
        setIsSearching(false)
      }
    }, 400)
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [addFriendUsername])
  
  // Check if we can send a request to the found user
  const canSendRequest = (targetUser: SearchResult): { canSend: boolean; reason?: string } => {
    // Can't send to yourself
    if (user && targetUser.id === user.id) {
      return { canSend: false, reason: "That's you!" }
    }
    
    // Check if already friends
    const isAlreadyFriend = friends.some(
      f => f.friendId === targetUser.id
    )
    if (isAlreadyFriend) {
      return { canSend: false, reason: 'Already friends' }
    }
    
    // Check for pending sent request
    const hasSentRequest = sentRequests.some(
      r => r.receiver.id === targetUser.id
    )
    if (hasSentRequest) {
      return { canSend: false, reason: 'Request already sent' }
    }
    
    // Check for pending received request from this user
    const hasReceivedRequest = pendingRequests.some(
      r => r.sender.id === targetUser.id
    )
    if (hasReceivedRequest) {
      return { canSend: false, reason: 'They already sent you a request!' }
    }
    
    return { canSend: true }
  }
  
  // Send friend request
  const handleSendRequest = async () => {
    if (!searchResult) return
    
    const { canSend, reason } = canSendRequest(searchResult)
    if (!canSend) {
      setMessage({ type: 'error', text: reason || 'Cannot send request' })
      return
    }
    
    setIsSending(true)
    setMessage(null)
    
    try {
      const response = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: searchResult.username })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setMessage({ type: 'success', text: `Friend request sent to ${searchResult.username}!` })
        setAddFriendUsername('')
        setSearchResult(null)
        setHasSearched(false)
        // Refresh data to update sent requests
        fetchData()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to send request' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to send request' })
    } finally {
      setIsSending(false)
    }
  }
  
  // Accept friend request
  const handleAccept = async (requestId: string, senderUsername: string) => {
    setActioningRequestId(requestId)
    setMessage(null)
    
    try {
      const response = await fetch('/api/friends/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ requestId })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        // Remove from pending requests immediately
        setPendingRequests(prev => prev.filter(r => r.id !== requestId))
        setMessage({ type: 'success', text: `${senderUsername} is now your friend!` })
        // Refresh to get the updated friends list
        fetchData()
      } else {
        console.error('Accept failed:', response.status, data)
        setMessage({ type: 'error', text: data.error || `Failed to accept request (${response.status})` })
      }
    } catch (error) {
      console.error('Failed to accept request:', error)
      setMessage({ type: 'error', text: 'Failed to accept request' })
    } finally {
      setActioningRequestId(null)
    }
  }
  
  // Decline friend request
  const handleDecline = async (requestId: string) => {
    setActioningRequestId(requestId)
    setMessage(null)
    
    try {
      const response = await fetch('/api/friends/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ requestId })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        // Remove from pending requests immediately
        setPendingRequests(prev => prev.filter(r => r.id !== requestId))
        setMessage({ type: 'success', text: 'Friend request declined' })
      } else {
        console.error('Decline failed:', response.status, data)
        setMessage({ type: 'error', text: data.error || `Failed to decline request (${response.status})` })
      }
    } catch (error) {
      console.error('Failed to decline request:', error)
      setMessage({ type: 'error', text: 'Failed to decline request' })
    } finally {
      setActioningRequestId(null)
    }
  }
  
  // Cancel sent request
  const handleCancelRequest = async (requestId: string) => {
    try {
      const response = await fetch('/api/friends/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ requestId, cancelSent: true })
      })
      
      if (response.ok) {
        fetchData()
      }
    } catch (error) {
      console.error('Failed to cancel request:', error)
    }
  }
  
  // Remove friend
  const handleRemove = async (friendId: string) => {
    if (!confirm('Are you sure you want to remove this friend?')) return
    
    try {
      const response = await fetch('/api/friends/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendId })
      })
      
      if (response.ok) {
        fetchData()
      }
    } catch (error) {
      console.error('Failed to remove friend:', error)
    }
  }
  
  // Toggle favourite
  const handleToggleFavourite = async (friendId: string, isFavourite: boolean) => {
    try {
      const response = await fetch('/api/friends/favourite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendId, isFavourite: !isFavourite })
      })
      
      if (response.ok) {
        fetchData()
      }
    } catch (error) {
      console.error('Failed to toggle favourite:', error)
    }
  }
  
  // Block user
  const handleBlock = async (userId: string) => {
    if (!confirm('Are you sure you want to block this user? They will not be able to message you.')) return
    
    try {
      const response = await fetch('/api/friends/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })
      
      if (response.ok) {
        fetchData()
      }
    } catch (error) {
      console.error('Failed to block user:', error)
    }
  }
  
  // Unblock user
  const handleUnblock = async (userId: string) => {
    try {
      const response = await fetch('/api/friends/unblock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })
      
      if (response.ok) {
        fetchData()
      }
    } catch (error) {
      console.error('Failed to unblock user:', error)
    }
  }
  
  // Accept DM request
  const handleAcceptDmRequest = async (requestId: string, senderName: string) => {
    setActioningDmRequestId(requestId)
    setMessage(null)
    
    try {
      const response = await fetch(`/api/dm-requests/${requestId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setDmRequests(prev => prev.filter(r => r.id !== requestId))
        setMessage({ type: 'success', text: `DM request from ${senderName} accepted!` })
        fetchData()
        // Dispatch event to refresh DM sidebar
        window.dispatchEvent(new CustomEvent(DM_REFRESH_EVENT))
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to accept DM request' })
      }
    } catch (error) {
      console.error('Failed to accept DM request:', error)
      setMessage({ type: 'error', text: 'Failed to accept DM request' })
    } finally {
      setActioningDmRequestId(null)
    }
  }
  
  // Start a conversation with a friend
  const startConversation = async (targetPersonaId: string) => {
    if (!activePersona) {
      setMessage({ type: 'error', text: 'Please activate a character first!' })
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
        // Check if conversation was created (friends can chat directly)
        if (data.conversation) {
          // Transform the conversation data to match the expected Conversation interface
          const conv = data.conversation
          const isPersonaA = conv.personaAId === activePersona.id
          const otherPersona = isPersonaA ? conv.personaB : conv.personaA
          
          const newConversation: Conversation = {
            id: conv.id,
            otherPersona: {
              id: otherPersona.id,
              name: otherPersona.name,
              avatarUrl: otherPersona.avatarUrl,
              username: otherPersona.user.username,
              isOnline: otherPersona.isOnline || false
            },
            myPersona: {
              id: activePersona.id,
              name: activePersona.name
            },
            lastMessage: null,
            lastMessageAt: conv.createdAt,
            createdAt: conv.createdAt
          }
          
          if (onStartChat) {
            onStartChat(newConversation)
            // Refresh DM sidebar
            window.dispatchEvent(new CustomEvent(DM_REFRESH_EVENT))
          }
        } else if (data.needsDmRequest) {
          // Shouldn't happen for friends, but handle it
          setMessage({ type: 'error', text: 'You need to be friends to send a message!' })
        }
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to start conversation' })
      }
    } catch (error) {
      console.error('Failed to start conversation:', error)
      setMessage({ type: 'error', text: 'Failed to start conversation' })
    }
  }
  
  // Ignore DM request
  const handleIgnoreDmRequest = async (requestId: string) => {
    setActioningDmRequestId(requestId)
    setMessage(null)
    
    try {
      const response = await fetch(`/api/dm-requests/${requestId}/ignore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setDmRequests(prev => prev.filter(r => r.id !== requestId))
        setMessage({ type: 'success', text: 'DM request ignored' })
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to ignore DM request' })
      }
    } catch (error) {
      console.error('Failed to ignore DM request:', error)
      setMessage({ type: 'error', text: 'Failed to ignore DM request' })
    } finally {
      setActioningDmRequestId(null)
    }
  }
  
  // Filter friends by tab
  const getFilteredFriends = () => {
    switch (activeTab) {
      case 'online':
        return friends.filter(f => f.activePersona?.isOnline)
      case 'favourites':
        return friends.filter(f => f.isFavourite)
      case 'pending':
        return []
      case 'blocked':
        return []
      default:
        return friends
    }
  }
  
  const filteredFriends = getFilteredFriends()
  
  const tabs: { id: TabType; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'all', label: 'All', icon: <Users className="w-4 h-4" />, count: friends.length },
    { id: 'online', label: 'Online', icon: <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> },
    { id: 'pending', label: 'Pending', icon: <Clock className="w-4 h-4" />, count: pendingRequests.length + sentRequests.length + dmRequests.length },
    { id: 'blocked', label: 'Blocked', icon: <Ban className="w-4 h-4" />, count: blockedUsers.length },
    { id: 'favourites', label: 'Favourites', icon: <Heart className="w-4 h-4" /> },
  ]
  
  return (
    <div className="flex flex-col h-full persona-bg">
      {/* Header */}
      <div className="h-14 border-b border-white/[0.08] flex items-center px-4 gap-4 bg-[#0f1117]/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${accent.from} ${accent.to} flex items-center justify-center`}>
            <Users className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-semibold text-slate-100">Friends</span>
        </div>
        <div className={`w-px h-6 ${accent.bgSubtle}`} />
        
        {/* Tabs */}
        <div className="persona-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`persona-tab flex items-center gap-2 ${activeTab === tab.id ? 'persona-tab-active' : ''}`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className="text-xs bg-fuchsia-500/30 text-fuchsia-200 px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
        
        <div className="ml-auto">
          <button
            onClick={() => {
              setShowAddFriend(!showAddFriend)
              if (showAddFriend) {
                setAddFriendUsername('')
                setSearchResult(null)
                setHasSearched(false)
                setMessage(null)
              }
            }}
            className="btn-persona flex items-center gap-2 text-sm"
          >
            <UserPlus className="w-4 h-4" />
            Add Friend
          </button>
        </div>
      </div>
      
      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {/* Add Friend Section */}
          {showAddFriend && (
            <div className="persona-card persona-card-hover mb-6">
              <div className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl ${accent.bgHeavy} flex items-center justify-center`}>
                    <Sparkles className="w-5 h-5 text-slate-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-100">Add Friend</h3>
                    <p className="text-sm text-slate-400">Connect with other roleplayers</p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <Input
                      placeholder="Enter username..."
                      value={addFriendUsername}
                      onChange={(e) => setAddFriendUsername(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && searchResult && canSendRequest(searchResult).canSend) {
                          handleSendRequest()
                        }
                      }}
                      className="persona-input w-full pr-10"
                    />
                    {isSearching && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />
                    )}
                  </div>
                  <button 
                    onClick={handleSendRequest}
                    disabled={isSending || !searchResult || !canSendRequest(searchResult).canSend}
                    className="btn-persona flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    Send Request
                  </button>
                </div>
                
                {/* User Preview / Search Result */}
                {searchResult && (
                  <div className="mt-3 p-3 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center gap-3">
                    <Avatar className={`w-10 h-10 border-2 ${accent.avatarBorder}`}>
                      <AvatarImage src={searchResult.avatarUrl || undefined} />
                      <AvatarFallback className={`bg-gradient-to-br ${accent.avatarFrom} ${accent.avatarTo} text-white font-medium`}>
                        {searchResult.username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-100">{searchResult.username}</p>
                      {searchResult.activePersona?.name && (
                        <p className="text-xs text-slate-400">as {searchResult.activePersona.name}</p>
                      )}
                    </div>
                    {(() => {
                      const { canSend, reason } = canSendRequest(searchResult)
                      return (
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          canSend 
                            ? 'bg-emerald-500/20 text-emerald-300' 
                            : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {canSend ? 'Available' : reason}
                        </span>
                      )
                    })()}
                  </div>
                )}
                
                {/* Not Found Message - Only show after search settles */}
                {hasSearched && !searchResult && addFriendUsername.trim() && !isSearching && (
                  <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                      <X className="w-5 h-5 text-red-400" />
                    </div>
                    <div>
                      <p className="font-medium text-red-300">User not found</p>
                      <p className="text-xs text-red-400/70">No user with username &quot;{addFriendUsername.trim()}&quot; exists</p>
                    </div>
                  </div>
                )}
                
                {/* Success/Error Message */}
                {message && (
                  <p className={`mt-3 text-sm ${message.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {message.text}
                  </p>
                )}
              </div>
            </div>
          )}
          
          {/* Pending Requests */}
          {activeTab === 'pending' && (
            <div className="space-y-6">
              {/* Success/Error Message */}
              {message && (
                <div className={`p-3 rounded-lg flex items-center gap-3 ${
                  message.type === 'success' 
                    ? 'bg-emerald-500/10 border border-emerald-500/20' 
                    : 'bg-red-500/10 border border-red-500/20'
                }`}>
                  {message.type === 'success' ? (
                    <Check className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <X className="w-5 h-5 text-red-400" />
                  )}
                  <p className={`text-sm ${message.type === 'success' ? 'text-emerald-300' : 'text-red-300'}`}>
                    {message.text}
                  </p>
                </div>
              )}
              
              {/* DM Requests */}
              {dmRequests.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="persona-section-header text-sm">DM Requests</span>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${accent.bgTint} ${accent.text} ${accent.borderSubtle}`}>{dmRequests.length}</span>
                  </div>
                  <div className="space-y-3">
                    {dmRequests.map(req => (
                      <div key={req.id} className="persona-card persona-card-hover p-4">
                        <div className="flex items-start gap-4">
                          <Avatar className={`w-12 h-12 border-2 ${accent.borderMedium}`}>
                            <AvatarImage src={req.sender.avatarUrl || undefined} />
                            <AvatarFallback className={`bg-gradient-to-br ${accent.avatarFrom} ${accent.avatarTo} text-white font-medium`}>
                              {req.sender.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-slate-100">{req.sender.name}</p>
                              <span className="text-xs text-slate-500">@{req.sender.username}</span>
                            </div>
                            <p className={`text-xs ${accent.text}/70 mb-2`}>wants to start a conversation</p>
                            <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                              <div className="text-sm text-slate-200/80 line-clamp-2 [&_a]:underline [&_a]:text-slate-300 [&_code]:bg-white/10 [&_code]:px-1 [&_code]:rounded [&_code]:text-xs [&_strong]:text-slate-100 [&_em]:text-slate-300">
                              {parseMessageWithMarkdown(req.firstMessage || '')}
                            </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3 justify-end">
                          <button
                            onClick={() => handleIgnoreDmRequest(req.id)}
                            disabled={actioningDmRequestId === req.id}
                            className="btn-persona-ghost flex items-center gap-1.5 text-sm py-2 disabled:opacity-50"
                          >
                            {actioningDmRequestId === req.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <X className="w-4 h-4" />
                            )}
                            Ignore
                          </button>
                          <button
                            onClick={() => handleAcceptDmRequest(req.id, req.sender.name)}
                            disabled={actioningDmRequestId === req.id}
                            className="btn-persona flex items-center gap-1.5 text-sm py-2 disabled:opacity-50"
                          >
                            {actioningDmRequestId === req.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <MessageCircle className="w-4 h-4" />
                                Accept
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Incoming Requests */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="persona-section-header text-sm">Incoming Requests</span>
                  <span className="persona-badge persona-badge-primary">{pendingRequests.length}</span>
                </div>
                {pendingRequests.length === 0 ? (
                  <div className="persona-empty-state persona-card">
                    <div className="persona-empty-state-icon">
                      <Clock className="w-6 h-6" />
                    </div>
                    <p className="text-slate-300/60">No incoming requests</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingRequests.map(req => (
                      <div key={req.id} className="persona-card persona-card-hover p-4 flex items-center gap-4">
                        <Avatar className={`w-12 h-12 border-2 ${accent.avatarBorder}`}>
                          <AvatarImage src={req.sender.avatarUrl || undefined} />
                          <AvatarFallback className={`bg-gradient-to-br ${accent.avatarFrom} ${accent.avatarTo} text-white font-medium`}>
                            {req.sender.username.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-semibold text-slate-100">{req.sender.username}</p>
                          <p className="text-xs text-slate-500">Sent you a friend request</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAccept(req.id, req.sender.username)}
                            disabled={actioningRequestId === req.id}
                            className="btn-persona flex items-center gap-1.5 text-sm py-2 disabled:opacity-50"
                          >
                            {actioningRequestId === req.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                            Accept
                          </button>
                          <button
                            onClick={() => handleDecline(req.id)}
                            disabled={actioningRequestId === req.id}
                            className="btn-persona-ghost flex items-center gap-1.5 text-sm py-2 disabled:opacity-50"
                          >
                            {actioningRequestId === req.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <X className="w-4 h-4" />
                            )}
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Sent Requests */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="persona-section-header text-sm">Sent Requests</span>
                  <span className="persona-badge" style={{ background: 'rgba(168, 85, 247, 0.2)', color: '#d8b4fe' }}>{sentRequests.length}</span>
                </div>
                {sentRequests.length === 0 ? (
                  <div className="persona-empty-state persona-card">
                    <div className="persona-empty-state-icon">
                      <Send className="w-6 h-6" />
                    </div>
                    <p className="text-slate-300/60">No sent requests</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sentRequests.map(req => (
                      <div key={req.id} className="persona-card p-4 flex items-center gap-4 opacity-75">
                        <Avatar className="w-12 h-12 border-2 border-white/[0.08]">
                          <AvatarImage src={req.receiver.avatarUrl || undefined} />
                          <AvatarFallback className={`bg-gradient-to-br ${accent.avatarFrom} ${accent.avatarTo} text-white font-medium`}>
                            {req.receiver.username.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-semibold text-slate-100">{req.receiver.username}</p>
                          <p className="text-xs text-slate-500">Pending response</p>
                        </div>
                        <button
                          onClick={() => handleCancelRequest(req.id)}
                          className="btn-persona-ghost flex items-center gap-1.5 text-sm py-2 text-red-400 hover:bg-red-500/10"
                        >
                          <UserX className="w-4 h-4" /> Cancel
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Blocked Users */}
          {activeTab === 'blocked' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <span className="persona-section-header text-sm">Blocked Users</span>
                <span className="persona-badge" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.3)' }}>{blockedUsers.length}</span>
              </div>
              {blockedUsers.length === 0 ? (
                <div className="persona-empty-state persona-card">
                  <div className="persona-empty-state-icon">
                    <Ban className="w-6 h-6" />
                  </div>
                  <p className="text-slate-300/60">No blocked users</p>
                  <p className="text-xs text-slate-400/40 mt-1">Blocked users will appear here</p>
                </div>
              ) : (
                blockedUsers.map(block => (
                  <div key={block.id} className="persona-card p-4 flex items-center gap-4 border-red-500/20">
                    <Avatar className="w-12 h-12 border-2 border-red-500/30 grayscale">
                      <AvatarImage src={block.user.avatarUrl || undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-red-500/50 to-red-600/50 text-white font-medium">
                        {block.user.username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-100">{block.user.username}</p>
                      <p className="text-xs text-red-400/60">Blocked</p>
                    </div>
                    <button
                      onClick={() => handleUnblock(block.user.id)}
                      className="btn-persona-ghost text-sm py-2"
                    >
                      Unblock
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
          
          {/* Friends List */}
          {activeTab !== 'pending' && activeTab !== 'blocked' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <span className="persona-section-header text-sm">
                  {activeTab === 'favourites' ? 'Favourite Friends' : activeTab === 'online' ? 'Online Now' : 'All Friends'}
                </span>
                <span className="persona-badge persona-badge-primary">{filteredFriends.length}</span>
              </div>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className={`w-8 h-8 border-2 ${accent.borderStrong} border-t-transparent rounded-full animate-spin`} />
                </div>
              ) : filteredFriends.length === 0 ? (
                <div className="persona-empty-state persona-card">
                  <div className="persona-empty-state-icon">
                    {activeTab === 'favourites' ? <Heart className="w-6 h-6" /> : <Users className="w-6 h-6" />}
                  </div>
                  <p className="text-slate-300/60">
                    {activeTab === 'favourites' 
                      ? 'No favourite friends yet'
                      : activeTab === 'online'
                      ? 'No friends online right now'
                      : 'No friends yet'}
                  </p>
                  <p className="text-xs text-slate-400/40 mt-1">
                    {activeTab === 'favourites' 
                      ? 'Star a friend to add them to favourites!'
                      : activeTab === 'online'
                      ? 'Friends will appear here when they come online'
                      : 'Add some friends to get started!'}
                  </p>
                </div>
              ) : (
                filteredFriends.map(friend => (
                  <div key={friend.id} className="persona-card persona-card-hover p-4 flex items-center gap-4 group">
                    <div className={`persona-status ${friend.activePersona?.isOnline ? 'persona-status-online' : 'persona-status-offline'}`}>
                      <Avatar className={`w-12 h-12 border-2 ${accent.avatarBorder}`}>
                        <AvatarImage src={friend.activePersona?.avatarUrl || friend.avatarUrl || undefined} />
                        <AvatarFallback className={`bg-gradient-to-br ${accent.avatarFrom} ${accent.avatarTo} text-white font-medium`}>
                          {(friend.activePersona?.name || friend.username)?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {friend.isFavourite && <Star className="w-3.5 h-3.5 persona-favourite fill-current" />}
                        <p className="font-semibold text-slate-100">
                          {friend.activePersona?.name || friend.username}
                        </p>
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        @{friend.username} {friend.activePersona && `· as ${friend.activePersona.name}`}
                      </p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleFavourite(friend.friendId, friend.isFavourite)
                        }}
                        className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all pointer-events-auto ${
                          friend.isFavourite 
                            ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20' 
                            : 'text-slate-500 hover:text-amber-400 hover:bg-amber-500/10'
                        }`}
                        title={friend.isFavourite ? 'Remove from favourites' : 'Add to favourites'}
                      >
                        <Star className={`w-4 h-4 ${friend.isFavourite ? 'fill-current' : ''}`} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (friend.activePersona?.id) {
                            startConversation(friend.activePersona.id)
                          } else {
                            setMessage({ type: 'error', text: 'This friend has no active character!' })
                          }
                        }}
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/[0.05] transition-all pointer-events-auto"
                        title="Message"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemove(friend.friendId)
                        }}
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all pointer-events-auto"
                        title="Remove friend"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
