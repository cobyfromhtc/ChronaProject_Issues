'use client'

import { useState, useMemo } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useVariantAccent } from '@/lib/ui-variant-styles'
import { formatDistanceToNow } from 'date-fns'
import {
  MessageCircle,
  Users,
  Search,
  Loader2,
  Circle,
  Sparkles,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface OnlinePersona {
  id: string
  name: string
  avatarUrl: string | null
  username: string
  userId: string
  isOnline: boolean
}

interface ChatLandingPageProps {
  conversations: Conversation[]
  onlinePersonas: OnlinePersona[]
  onSelectChat: (conversationId: string) => void
  onStartChat: (params: { targetPersonaId: string; myPersonaId?: string }) => void
  activePersonaId: string | null
  isLoading?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isBlorpConversation(conv: Conversation): boolean {
  return (
    conv.otherPersona.username === 'Blorp' ||
    conv.otherPersona.name === 'Blorp'
  )
}

function formatTimeAgo(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: false })
  } catch {
    return ''
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ConversationItem({
  conversation,
  onSelect,
  accent,
}: {
  conversation: Conversation
  onSelect: () => void
  accent: ReturnType<typeof useVariantAccent>
}) {
  const isBlorp = isBlorpConversation(conversation)
  const persona = conversation.otherPersona

  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-150 group hover:bg-white/[0.04] text-left"
    >
      {/* Avatar with online indicator */}
      <div className="relative flex-shrink-0">
        {isBlorp ? (
          <div
            className={`w-11 h-11 rounded-full bg-gradient-to-br ${accent.avatarFrom} ${accent.avatarTo} flex items-center justify-center border-2 ${accent.avatarBorder}`}
          >
            <Sparkles className="w-5 h-5 text-white" />
          </div>
        ) : (
          <>
            <Avatar
              className={`w-11 h-11 border-2 ${accent.avatarBorder} group-hover:${accent.borderStrong} transition-colors`}
            >
              <AvatarImage src={persona.avatarUrl || undefined} />
              <AvatarFallback
                className={`bg-gradient-to-br ${accent.avatarFrom} ${accent.avatarTo} text-white text-sm font-medium`}
              >
                {persona.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {persona.isOnline && (
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 ${accent.onlineBg} rounded-full border-2 border-[#0b0d11]`}
              />
            )}
          </>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-100 truncate">
            {persona.name}
          </span>
          {isBlorp && (
            <Badge
              className={`h-4 px-1.5 text-[9px] ${accent.bgTint} ${accent.text} ${accent.borderSubtle} border`}
            >
              BOT
            </Badge>
          )}
          {conversation.lastMessageAt && (
            <span className="ml-auto text-[10px] text-slate-600 flex-shrink-0">
              {formatTimeAgo(conversation.lastMessageAt)}
            </span>
          )}
        </div>
        {conversation.lastMessage ? (
          <p className="text-xs text-slate-500 truncate mt-0.5">
            {conversation.lastMessage.content}
          </p>
        ) : (
          <p className="text-xs text-slate-600 italic mt-0.5">No messages yet</p>
        )}
      </div>
    </button>
  )
}

function OnlineUserItem({
  persona,
  onStartChat,
  accent,
  activePersonaId,
}: {
  persona: OnlinePersona
  onStartChat: () => void
  accent: ReturnType<typeof useVariantAccent>
  activePersonaId: string | null
}) {
  const [isStarting, setIsStarting] = useState(false)

  const handleClick = async () => {
    if (!activePersonaId) return
    setIsStarting(true)
    try {
      onStartChat()
    } finally {
      // Small delay to prevent rapid clicks; parent will handle navigation
      setTimeout(() => setIsStarting(false), 1000)
    }
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group hover:bg-white/[0.04]">
      <div className="relative flex-shrink-0">
        <Avatar className={`w-9 h-9 border ${accent.avatarBorder}`}>
          <AvatarImage src={persona.avatarUrl || undefined} />
          <AvatarFallback
            className={`bg-gradient-to-br ${accent.avatarFrom} ${accent.avatarTo} text-white text-xs font-medium`}
          >
            {persona.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 ${accent.onlineBg} rounded-full border-2 border-[#0b0d11]`}
        />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-200 truncate">
          {persona.name}
        </p>
        <p className="text-[10px] text-slate-600 truncate">@{persona.username}</p>
      </div>

      <button
        onClick={handleClick}
        disabled={!activePersonaId || isStarting}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${
          activePersonaId
            ? `${accent.bgSubtle} ${accent.text} hover:${accent.bgHeavy} border ${accent.borderSubtle} hover:${accent.borderMedium}`
            : 'bg-white/[0.03] text-slate-600 border border-white/[0.06]'
        }`}
      >
        {isStarting ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <MessageCircle className="w-3 h-3" />
        )}
        <span className="hidden sm:inline">Chat</span>
      </button>
    </div>
  )
}

// ─── Empty States ─────────────────────────────────────────────────────────────

function EmptyConversations({ accent }: { accent: ReturnType<typeof useVariantAccent> }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div
        className={`w-16 h-16 rounded-2xl ${accent.bgSubtle} flex items-center justify-center mb-4 border ${accent.borderSubtle}`}
      >
        <MessageCircle className={`w-8 h-8 ${accent.textDim}`} />
      </div>
      <p className="text-sm font-medium text-slate-200/80">No conversations yet</p>
      <p className="text-xs text-slate-500 mt-1.5 max-w-[200px]">
        Start a chat with someone online or say hi to Blorp!
      </p>
    </div>
  )
}

function EmptyOnlineUsers({ accent }: { accent: ReturnType<typeof useVariantAccent> }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div
        className={`w-14 h-14 rounded-2xl ${accent.bgSubtle} flex items-center justify-center mb-4 border ${accent.borderSubtle}`}
      >
        <Users className={`w-7 h-7 ${accent.textDim}`} />
      </div>
      <p className="text-sm font-medium text-slate-200/80">No one online</p>
      <p className="text-xs text-slate-500 mt-1.5">
        Check back later — people come and go!
      </p>
    </div>
  )
}

function LoadingSkeleton({ accent }: { accent: ReturnType<typeof useVariantAccent> }) {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-3">
          <div
            className={`w-11 h-11 rounded-full ${accent.bgSubtle} animate-pulse`}
          />
          <div className="flex-1 space-y-2">
            <div className={`h-3 w-24 rounded ${accent.bgSubtle} animate-pulse`} />
            <div className="h-2.5 w-36 rounded bg-white/[0.03] animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ChatLandingPage({
  conversations,
  onlinePersonas,
  onSelectChat,
  onStartChat,
  activePersonaId,
  isLoading = false,
}: ChatLandingPageProps) {
  const accent = useVariantAccent()
  const [searchQuery, setSearchQuery] = useState('')

  // Filter conversations by search query
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations
    const q = searchQuery.toLowerCase()
    return conversations.filter(
      (conv) =>
        conv.otherPersona.name.toLowerCase().includes(q) ||
        conv.otherPersona.username.toLowerCase().includes(q) ||
        (conv.lastMessage?.content?.toLowerCase().includes(q) ?? false)
    )
  }, [conversations, searchQuery])

  // Filter online users by search query
  const filteredOnlinePersonas = useMemo(() => {
    if (!searchQuery.trim()) return onlinePersonas
    const q = searchQuery.toLowerCase()
    return onlinePersonas.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.username.toLowerCase().includes(q)
    )
  }, [onlinePersonas, searchQuery])

  // Separate Blorp conversations from regular ones
  const blorpConversations = filteredConversations.filter(isBlorpConversation)
  const regularConversations = filteredConversations.filter(
    (c) => !isBlorpConversation(c)
  )

  return (
    <div className="flex flex-col h-full bg-[#0b0d11]">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-white/[0.06]">
        <div className="px-4 sm:px-6 pt-5 pb-4">
          <div className="flex items-center gap-3 mb-4">
            <div
              className={`w-10 h-10 rounded-xl bg-gradient-to-br ${accent.from} ${accent.to} flex items-center justify-center shadow-lg ${accent.shadowGlow}`}
            >
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-100">Messages</h1>
              <p className="text-xs text-slate-500">
                Your conversations & online users
              </p>
            </div>
            {!activePersonaId && (
              <Badge className="ml-auto h-5 px-2 text-[10px] bg-amber-500/15 text-amber-400 border-amber-500/20">
                No active character
              </Badge>
            )}
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              placeholder="Search conversations or people..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`h-9 pl-9 pr-4 text-sm bg-white/[0.03] border-white/[0.06] text-slate-200 placeholder:text-slate-600 focus-visible:${accent.ringFocus} focus-visible:border-white/[0.12]`}
            />
          </div>
        </div>
      </div>

      {/* Two-column layout on desktop, single column on mobile */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* Left Column: Conversations */}
        <div className="flex-1 min-h-0 flex flex-col border-b lg:border-b-0 lg:border-r border-white/[0.06]">
          {/* Section Header */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 sm:px-5 py-3 border-b border-white/[0.04]">
            <div className="flex items-center gap-2">
              <MessageCircle className={`w-3.5 h-3.5 ${accent.textDim}`} />
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Conversations
              </span>
              {conversations.length > 0 && (
                <span className="text-[10px] text-slate-600 bg-white/[0.03] px-1.5 py-0.5 rounded-full">
                  {conversations.length}
                </span>
              )}
            </div>
          </div>

          {/* Conversation List */}
          <ScrollArea className="flex-1">
            {isLoading ? (
              <LoadingSkeleton accent={accent} />
            ) : filteredConversations.length > 0 ? (
              <div className="p-2 space-y-0.5">
                {/* Blorp conversations first */}
                {blorpConversations.length > 0 && (
                  <>
                    {blorpConversations.map((conv) => (
                      <ConversationItem
                        key={conv.id}
                        conversation={conv}
                        onSelect={() => onSelectChat(conv.id)}
                        accent={accent}
                      />
                    ))}
                    {regularConversations.length > 0 && (
                      <div className={`my-2 mx-3 h-px ${accent.bgTint}`} />
                    )}
                  </>
                )}

                {/* Regular conversations */}
                {regularConversations.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    conversation={conv}
                    onSelect={() => onSelectChat(conv.id)}
                    accent={accent}
                  />
                ))}
              </div>
            ) : (
              <EmptyConversations accent={accent} />
            )}
          </ScrollArea>
        </div>

        {/* Right Column: Online Users */}
        <div className="w-full lg:w-80 xl:w-96 flex-shrink-0 flex flex-col min-h-0">
          {/* Section Header */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 sm:px-5 py-3 border-b border-white/[0.04]">
            <div className="flex items-center gap-2">
              <span
                className={`w-1.5 h-1.5 rounded-full ${accent.onlineBg} animate-pulse`}
              />
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Online
              </span>
              {onlinePersonas.length > 0 && (
                <span className="text-[10px] text-slate-600 bg-white/[0.03] px-1.5 py-0.5 rounded-full">
                  {onlinePersonas.length}
                </span>
              )}
            </div>
            <Circle className={`w-2 h-2 fill-emerald-400 text-emerald-400`} />
          </div>

          {/* Online Users List */}
          <ScrollArea className="flex-1 max-h-96 lg:max-h-none">
            {isLoading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                    <div
                      className={`w-9 h-9 rounded-full ${accent.bgSubtle} animate-pulse`}
                    />
                    <div className="flex-1 space-y-1.5">
                      <div
                        className={`h-3 w-20 rounded ${accent.bgSubtle} animate-pulse`}
                      />
                      <div className="h-2 w-14 rounded bg-white/[0.03] animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredOnlinePersonas.length > 0 ? (
              <div className="p-2 space-y-0.5">
                {filteredOnlinePersonas.map((persona) => (
                  <OnlineUserItem
                    key={persona.id}
                    persona={persona}
                    onStartChat={() =>
                      onStartChat({
                        targetPersonaId: persona.id,
                        myPersonaId: activePersonaId || undefined,
                      })
                    }
                    accent={accent}
                    activePersonaId={activePersonaId}
                  />
                ))}
              </div>
            ) : (
              <EmptyOnlineUsers accent={accent} />
            )}
          </ScrollArea>

          {/* No active persona call-to-action */}
          {!activePersonaId && !isLoading && (
            <div className="flex-shrink-0 px-4 py-3 border-t border-white/[0.06]">
              <div className="rounded-xl bg-amber-500/[0.06] border border-amber-500/[0.12] px-4 py-3">
                <div className="flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-amber-300/90">
                      Activate a character to chat
                    </p>
                    <p className="text-[10px] text-amber-400/50 mt-0.5">
                      Select one of your personas to start conversations with
                      other users.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
