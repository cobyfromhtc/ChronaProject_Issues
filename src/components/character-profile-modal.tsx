'use client'

import { useState, useEffect, startTransition } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import ReactMarkdown from 'react-markdown'
import { 
  X, MessageCircle, User, Sparkles, Heart, BookOpen,
  Brain, Star, Users, Eye, Link2, ChevronLeft, Hash, Loader2, Check, UserPlus, Zap, Clock, Flag
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { usePersonas } from '@/hooks/use-personas'
import { apiFetch } from '@/lib/api-client'
import { ReportModal } from '@/components/report-modal'
import { useVariantAccent } from '@/lib/ui-variant-styles'

// Friend status interface
interface FriendStatus {
  isFriend: boolean
  hasPendingRequest: boolean
  hasSentRequest: boolean
}

// Connection interface
interface PersonaConnection {
  id: string
  characterName: string
  relationshipType: string
  specificRole: string | null
  characterAge: number | null
  description: string | null
}

// Big Five (OCEAN) personality traits
interface BigFiveTraits {
  openness: number
  conscientiousness: number
  extraversion: number
  agreeableness: number
  neuroticism: number
}

// HEXACO personality traits (6-factor model)
interface HexacoTraits {
  honestyHumility: number
  emotionality: number
  extraversion: number
  agreeableness: number
  conscientiousness: number
  opennessToExperience: number
}

// Personality spectrums (MBTI-based)
interface PersonalitySpectrums {
  introvertExtrovert: number
  intuitiveObservant: number
  thinkingFeeling: number
  judgingProspecting: number
  assertiveTurbulent: number
}

// Full persona profile interface
interface PersonaProfile {
  id: string
  name: string
  avatarUrl: string | null
  bio: string | null
  username: string
  userId: string
  isOnline: boolean
  archetype: string | null
  gender: string | null
  age: number | null
  tags: string[]
  personalityDescription: string | null
  personalitySpectrums: PersonalitySpectrums | null
  bigFive: BigFiveTraits | null
  hexaco: HexacoTraits | null
  strengths: string[]
  flaws: string[]
  values: string[]
  fears: string[]
  species: string | null
  likes: string[]
  dislikes: string[]
  hobbies: string[]
  skills: string[]
  languages: string[]
  habits: string[]
  speechPatterns: string[]
  backstory: string | null
  appearance: string | null
  mbtiType: string | null
  connections: PersonaConnection[]
}

interface CharacterProfileModalProps {
  persona: PersonaProfile
  isOpen: boolean
  onClose: () => void
  onStartChat: (personaId: string) => void
}

// Helper component for tag chips
function TagChip({ label, color = 'purple' }: { label: string; color?: string }) {
  const colors: Record<string, string> = {
    purple: 'bg-white/[0.08] text-slate-300 border-white/[0.10]',
    green: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
    red: 'bg-red-500/15 text-red-300 border-red-500/25',
    amber: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
    blue: 'bg-blue-500/15 text-blue-300 border-blue-500/25',
    pink: 'bg-pink-500/15 text-pink-300 border-pink-500/25',
    cyan: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25',
    slate: 'bg-slate-500/15 text-slate-300 border-slate-500/25',
  }
  
  return (
    <span className={`px-2.5 py-1 rounded-lg text-xs border ${colors[color] || colors.purple}`}>
      {label}
    </span>
  )
}

// Helper for spectrum bars with modern look
function SpectrumBar({ label, value, leftLabel, rightLabel, icon, accent }: { 
  label: string; 
  value: number; 
  leftLabel: string; 
  rightLabel: string;
  icon?: React.ReactNode;
  accent?: { from: string; to: string; bgSubtle: string; shadowGlow: string };
}) {
  const fromColor = accent?.from || 'from-teal-500';
  const toColor = accent?.to || 'to-cyan-400';
  
  return (
    <div className="bg-slate-900/20 rounded-xl p-4 border border-white/[0.06]">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className="text-sm font-medium text-slate-200">{label}</span>
      </div>
      <div className="flex justify-between text-xs text-slate-500 mb-2">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
      <div className="h-3 bg-slate-950/40 rounded-full overflow-hidden relative">
        <div className={`absolute inset-0 bg-gradient-to-r ${fromColor}/20 via-${fromColor.slice(5)}/30 to-${toColor.slice(3)}/20`} />
        <div 
          className={`h-full bg-gradient-to-r ${fromColor} ${toColor} rounded-full relative transition-all duration-300`}
          style={{ width: `${value}%` }}
        >
          <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg ${accent?.shadowGlow || 'shadow-teal-500/30'}`} />
        </div>
      </div>
    </div>
  )
}

// Section component
function Section({ title, icon: Icon, children, className = '' }: { 
  title: string; 
  icon: any; 
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-4 ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-slate-400" />
        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </div>
  )
}

// Text block for longer content with markdown support
function TextBlock({ content, className = '', accent }: { content: string; className?: string; accent?: { bgSubtle: string; borderSubtle: string } }) {
  return (
    <div className={`bg-slate-900/15 rounded-xl p-4 border border-white/[0.06] ${className}`}>
      <div className="text-slate-100/90 text-sm leading-relaxed whitespace-pre-wrap markdown-content">
        <ReactMarkdown
          components={{
            strong: ({ children }) => <strong className="font-bold text-slate-100">{children}</strong>,
            em: ({ children }) => <em className="italic text-slate-200">{children}</em>,
            code: ({ children }) => (
              <code className={`${accent?.bgSubtle || 'bg-orange-500/15'} px-1.5 py-0.5 rounded text-slate-200 text-xs font-mono`}>
                {children}
              </code>
            ),
            a: ({ href, children }) => (
              <a href={href} className="text-slate-400 underline underline-offset-2 hover:text-slate-300" target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ),
            blockquote: ({ children }) => (
              <blockquote className={`border-l-2 ${accent?.borderSubtle || 'border-orange-500/20'} pl-4 italic text-slate-300 my-2`}>
                {children}
              </blockquote>
            ),
            ul: ({ children }) => <ul className="list-disc pl-4 my-2">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal pl-4 my-2">{children}</ol>,
            li: ({ children }) => <li className="my-0.5">{children}</li>,
            hr: () => <hr className={`${accent?.borderSubtle || 'border-orange-500/20'} my-3`} />,
            h1: ({ children }) => <h1 className="text-lg font-bold text-slate-100 mb-2">{children}</h1>,
            h2: ({ children }) => <h2 className="text-base font-bold text-slate-100 mb-2">{children}</h2>,
            h3: ({ children }) => <h3 className="text-sm font-bold text-slate-100 mb-1">{children}</h3>,
            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  )
}

// Tag grid
function TagGrid({ items, color = 'purple' }: { items: string[] | string | null; color?: string }) {
  // Handle both array and JSON string inputs
  let parsedItems: string[] = []
  if (items) {
    if (Array.isArray(items)) {
      parsedItems = items
    } else if (typeof items === 'string') {
      try {
        const parsed = JSON.parse(items)
        parsedItems = Array.isArray(parsed) ? parsed : []
      } catch {
        parsedItems = []
      }
    }
  }
  
  if (parsedItems.length === 0) return null
  
  return (
    <div className="flex flex-wrap gap-2">
      {parsedItems.map((item, i) => (
        <TagChip key={i} label={item} color={color} />
      ))}
    </div>
  )
}

interface FollowStatusData {
  isFollowing: boolean
  followersCount: number
  followingCount: number
}

export function CharacterProfileModal({ 
  persona, 
  isOpen, 
  onClose, 
  onStartChat 
}: CharacterProfileModalProps) {
  const { user } = useAuth()
  const { activePersona } = usePersonas()
  const accent = useVariantAccent()
  
  const [activeTab, setActiveTab] = useState<'overview' | 'appearance' | 'personality' | 'attributes'>('overview')
  const [followStatus, setFollowStatus] = useState<FollowStatusData | null>(null)
  const [isLoadingFollowStatus, setIsLoadingFollowStatus] = useState(true)
  const [isFollowLoading, setIsFollowLoading] = useState(false)
  const [followError, setFollowError] = useState<string | null>(null)
  
  // Friend status state
  const [friendStatus, setFriendStatus] = useState<FriendStatus | null>(null)
  const [isLoadingFriendStatus, setIsLoadingFriendStatus] = useState(true)
  const [isFriendLoading, setIsFriendLoading] = useState(false)
  const [friendError, setFriendError] = useState<string | null>(null)
  const [friendSuccess, setFriendSuccess] = useState<string | null>(null)
  
  // Report modal state
  const [showReportModal, setShowReportModal] = useState(false)
  
  // Reset states when modal opens
  useEffect(() => {
    if (isOpen) {
      startTransition(() => {
        setFriendError(null)
        setFriendSuccess(null)
      })
    }
  }, [isOpen])

  // Fetch follow status on mount
  useEffect(() => {
    if (!isOpen || !persona?.userId) return

    const fetchFollowStatus = async () => {
      try {
        const response = await apiFetch(`/api/follow/status?targetUserId=${persona.userId}`)
        
        if (response.ok) {
          const data = await response.json()
          setFollowStatus({
            isFollowing: data.isFollowing,
            followersCount: data.followersCount,
            followingCount: data.followingCount,
          })
        } else {
          setFollowStatus({
            isFollowing: false,
            followersCount: 0,
            followingCount: 0,
          })
        }
      } catch (error) {
        console.error('Error fetching follow status:', error)
        setFollowStatus({
          isFollowing: false,
          followersCount: 0,
          followingCount: 0,
        })
      } finally {
        setIsLoadingFollowStatus(false)
      }
    }

    fetchFollowStatus()
  }, [isOpen, persona?.userId])

  // Fetch friend status on mount
  useEffect(() => {
    if (!isOpen || !persona?.userId) return

    const fetchFriendStatus = async () => {
      try {
        const response = await apiFetch(`/api/friends/status?targetUserId=${persona.userId}`)
        
        if (response.ok) {
          const data = await response.json()
          setFriendStatus({
            isFriend: data.isFriend || false,
            hasPendingRequest: data.hasPendingRequest || false,
            hasSentRequest: data.hasSentRequest || false,
          })
        } else {
          setFriendStatus({
            isFriend: false,
            hasPendingRequest: false,
            hasSentRequest: false,
          })
        }
      } catch (error) {
        console.error('Error fetching friend status:', error)
        setFriendStatus({
          isFriend: false,
          hasPendingRequest: false,
          hasSentRequest: false,
        })
      } finally {
        setIsLoadingFriendStatus(false)
      }
    }

    fetchFriendStatus()
  }, [isOpen, persona?.userId])

  const handleFollow = async () => {
    if (!user || !persona?.userId || user.id === persona.userId) return

    setIsFollowLoading(true)
    setFollowError(null)
    
    try {
      const isFollowing = followStatus?.isFollowing ?? false
      
      const url = `/api/follow?targetUserId=${persona.userId}`

      const response = await apiFetch(url, {
        method: isFollowing ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: isFollowing ? undefined : JSON.stringify({ targetUserId: persona.userId }),
      })

      const data = await response.json()

      if (response.ok) {
        // Update local state
        setFollowStatus(prev => {
          if (!prev) return prev
          return {
            ...prev,
            isFollowing: !prev.isFollowing,
            followersCount: prev.isFollowing 
              ? Math.max(0, prev.followersCount - 1) 
              : prev.followersCount + 1,
            followingCount: prev.followingCount,
          }
        })
      } else {
        setFollowError(data.error || 'Failed to update follow status')
      }
    } catch (error) {
      console.error('Error toggling follow:', error)
      setFollowError('Failed to update follow status. Please try again.')
    } finally {
      setIsFollowLoading(false)
    }
  }

  // Handle add friend
  const handleAddFriend = async () => {
    if (!user || !persona?.userId || user.id === persona.userId) return

    setIsFriendLoading(true)
    setFriendError(null)
    setFriendSuccess(null)
    
    try {
      const response = await apiFetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: persona.username }),
      })

      const data = await response.json()

      if (response.ok) {
        setFriendSuccess('Friend request sent!')
        setFriendStatus(prev => prev ? { ...prev, hasSentRequest: true } : { isFriend: false, hasPendingRequest: false, hasSentRequest: true })
      } else {
        setFriendError(data.error || 'Failed to send friend request')
      }
    } catch (error) {
      console.error('Error sending friend request:', error)
      setFriendError('Failed to send friend request. Please try again.')
    } finally {
      setIsFriendLoading(false)
    }
  }

  if (!isOpen) return null

  const tabs: { id: 'overview' | 'appearance' | 'personality' | 'attributes'; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <User className="w-4 h-4" /> },
    { id: 'appearance', label: 'Appearance', icon: <Eye className="w-4 h-4" /> },
    { id: 'personality', label: 'Personality', icon: <Brain className="w-4 h-4" /> },
    { id: 'attributes', label: 'Attributes', icon: <Hash className="w-4 h-4" /> },
  ]

  const isFollowing = followStatus?.isFollowing ?? false
  const isOwnProfile = user?.id === persona.userId

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="w-full max-w-2xl max-h-[90vh] bg-gradient-to-b from-[#100e0d] to-[#0c0a09] rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className={`w-12 h-12 border-2 ${accent.avatarBorder}`}>
              <AvatarImage src={persona.avatarUrl || undefined} />
              <AvatarFallback className={`bg-gradient-to-br ${accent.avatarFrom} ${accent.avatarTo} text-white text-lg font-bold`}>
                {persona.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1">
              <h2 className="text-lg font-bold text-white">{persona.name}</h2>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-sm">@{persona.username}</span>
                {persona.isOnline && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Online
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Report Button */}
            {!isOwnProfile && (
              <button
                onClick={() => setShowReportModal(true)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Report this persona"
              >
                <Flag className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="px-4 py-3 border-b border-white/[0.08] flex items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" />
              <span className="text-sm">
                <span className="font-semibold text-slate-100">{followStatus?.followersCount ?? 0}</span>
                <span className="text-slate-400"> followers</span>
              </span>
            </div>
            <div className="w-px h-6 bg-white/[0.05]" />
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-slate-400" />
              <span className="text-sm">
                <span className="font-semibold text-slate-100">{followStatus?.followingCount ?? 0}</span>
                <span className="text-slate-400"> following</span>
              </span>
            </div>
          </div>
          
          {/* Follow Button */}
          {!isOwnProfile && (
            <button
              onClick={handleFollow}
              disabled={isFollowLoading}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                isFollowing
                  ? `${accent.bgSubtle} text-slate-300 border ${accent.borderSubtle} hover:${accent.bgTint}`
                  : `${accent.bgSolid} text-white hover:opacity-90`
              }`}
            >
              {isFollowLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isFollowing ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Following</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Follow</span>
                </>
              )}
            </button>
          )}
          
          {/* Add Friend Button */}
          {!isOwnProfile && !friendStatus?.isFriend && !friendStatus?.hasSentRequest && (
            <button
              onClick={handleAddFriend}
              disabled={isFriendLoading}
              className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30"
            >
              {isFriendLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add Friend</span>
                </>
              )}
            </button>
          )}
          
          {/* Request Sent Badge */}
          {!isOwnProfile && !friendStatus?.isFriend && friendStatus?.hasSentRequest && (
            <span className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Request Sent</span>
            </span>
          )}
          
          {/* Already Friends Badge */}
          {!isOwnProfile && friendStatus?.isFriend && (
            <span className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" />
              <span>Friends</span>
            </span>
          )}
          
          {/* Friend Error/Success Messages */}
          {friendError && (
            <span className="text-xs text-red-400">{friendError}</span>
          )}
          {friendSuccess && (
            <span className="text-xs text-emerald-400">{friendSuccess}</span>
          )}
          
          {/* Follow Error */}
          {followError && (
            <span className="text-xs text-red-400">{followError}</span>
          )}
          
          {/* Message Button */}
          <button
            onClick={() => onStartChat(persona.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r ${accent.from} ${accent.to} text-white hover:opacity-90 transition-all flex items-center gap-2`}
          >
            <MessageCircle className="w-4 h-4" />
            <span>Message</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="px-4 py-2 border-b border-white/[0.08] flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? `${accent.bgSubtle} text-slate-200 border ${accent.borderSubtle}`
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
          <div className="p-4">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {persona.bio && (
                <TextBlock content={persona.bio} accent={accent} />
              )}
              
              {persona.tags && persona.tags.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-300 mb-2">Tags</h4>
                  <div className="flex flex-wrap gap-2">
                    {persona.tags.map((tag, i) => (
                      <TagChip key={i} label={tag} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-4">
              {persona.appearance ? (
                <TextBlock content={persona.appearance} accent={accent} />
              ) : (
                <div className="text-center py-8 text-slate-500">
                  No appearance description provided
                </div>
              )}
            </div>
          )}

          {activeTab === 'personality' && (
            <div className="space-y-6">
              {persona.personalityDescription && (
                <TextBlock content={persona.personalityDescription} accent={accent} />
              )}
              
              {/* MBTI Personality Spectrums */}
              {persona.personalitySpectrums && (
                <div>
                  <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                    <Brain className="w-4 h-4" />
                    Personality Spectrums (MBTI)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <SpectrumBar
                      label="Energy"
                      value={persona.personalitySpectrums.introvertExtrovert}
                      leftLabel="Introvert"
                      rightLabel="Extrovert"
                      icon={<Zap className="w-4 h-4 text-slate-400" />}
                      accent={accent}
                    />
                    <SpectrumBar
                      label="Perception"
                      value={persona.personalitySpectrums.intuitiveObservant}
                      leftLabel="Intuitive"
                      rightLabel="Observant"
                      icon={<Eye className="w-4 h-4 text-slate-400" />}
                      accent={accent}
                    />
                    <SpectrumBar
                      label="Decisions"
                      value={persona.personalitySpectrums.thinkingFeeling}
                      leftLabel="Thinking"
                      rightLabel="Feeling"
                      icon={<Heart className="w-4 h-4 text-slate-400" />}
                      accent={accent}
                    />
                    <SpectrumBar
                      label="Structure"
                      value={persona.personalitySpectrums.judgingProspecting}
                      leftLabel="Judging"
                      rightLabel="Prospecting"
                      icon={<Sparkles className="w-4 h-4 text-slate-400" />}
                      accent={accent}
                    />
                    <SpectrumBar
                      label="Identity"
                      value={persona.personalitySpectrums.assertiveTurbulent}
                      leftLabel="Assertive"
                      rightLabel="Turbulent"
                      icon={<Star className="w-4 h-4 text-slate-400" />}
                      accent={accent}
                    />
                  </div>
                </div>
              )}
              
              {/* Big Five (OCEAN) Personality Traits */}
              {persona.bigFive && (
                <div>
                  <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Big Five (OCEAN) Traits
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <SpectrumBar
                      label="Openness"
                      value={persona.bigFive.openness}
                      leftLabel="Practical"
                      rightLabel="Open"
                      icon={<Brain className="w-4 h-4 text-cyan-400" />}
                      accent={accent}
                    />
                    <SpectrumBar
                      label="Conscientiousness"
                      value={persona.bigFive.conscientiousness}
                      leftLabel="Flexible"
                      rightLabel="Organized"
                      icon={<BookOpen className="w-4 h-4 text-cyan-400" />}
                      accent={accent}
                    />
                    <SpectrumBar
                      label="Extraversion"
                      value={persona.bigFive.extraversion}
                      leftLabel="Reserved"
                      rightLabel="Social"
                      icon={<Users className="w-4 h-4 text-cyan-400" />}
                      accent={accent}
                    />
                    <SpectrumBar
                      label="Agreeableness"
                      value={persona.bigFive.agreeableness}
                      leftLabel="Competitive"
                      rightLabel="Cooperative"
                      icon={<Heart className="w-4 h-4 text-cyan-400" />}
                      accent={accent}
                    />
                    <SpectrumBar
                      label="Neuroticism"
                      value={persona.bigFive.neuroticism}
                      leftLabel="Stable"
                      rightLabel="Reactive"
                      icon={<Zap className="w-4 h-4 text-cyan-400" />}
                      accent={accent}
                    />
                  </div>
                </div>
              )}
              
              {/* HEXACO Personality Traits (6-factor model) */}
              {persona.hexaco && (
                <div>
                  <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                    <Star className="w-4 h-4" />
                    HEXACO Traits (6-Factor Model)
                  </h4>
                  <p className="text-xs text-slate-500 mb-3">
                    Includes Honesty-Humility dimension not found in Big Five
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <SpectrumBar
                      label="Honesty-Humility"
                      value={persona.hexaco.honestyHumility}
                      leftLabel="Self-Serving"
                      rightLabel="Genuine"
                      icon={<Heart className="w-4 h-4 text-emerald-400" />}
                      accent={accent}
                    />
                    <SpectrumBar
                      label="Emotionality"
                      value={persona.hexaco.emotionality}
                      leftLabel="Unemotional"
                      rightLabel="Sensitive"
                      icon={<Zap className="w-4 h-4 text-emerald-400" />}
                      accent={accent}
                    />
                    <SpectrumBar
                      label="eXtraversion"
                      value={persona.hexaco.extraversion}
                      leftLabel="Introverted"
                      rightLabel="Extroverted"
                      icon={<Users className="w-4 h-4 text-emerald-400" />}
                      accent={accent}
                    />
                    <SpectrumBar
                      label="Agreeableness"
                      value={persona.hexaco.agreeableness}
                      leftLabel="Competitive"
                      rightLabel="Cooperative"
                      icon={<Sparkles className="w-4 h-4 text-emerald-400" />}
                      accent={accent}
                    />
                    <SpectrumBar
                      label="Conscientiousness"
                      value={persona.hexaco.conscientiousness}
                      leftLabel="Flexible"
                      rightLabel="Organized"
                      icon={<BookOpen className="w-4 h-4 text-emerald-400" />}
                      accent={accent}
                    />
                    <SpectrumBar
                      label="Openness"
                      value={persona.hexaco.opennessToExperience}
                      leftLabel="Practical"
                      rightLabel="Curious"
                      icon={<Eye className="w-4 h-4 text-emerald-400" />}
                      accent={accent}
                    />
                  </div>
                </div>
              )}
              
              {!persona.personalitySpectrums && !persona.bigFive && !persona.hexaco && !persona.personalityDescription && (
                <div className="text-center py-8 text-slate-500">
                  No personality information provided
                </div>
              )}
            </div>
          )}

          {activeTab === 'attributes' && (
            <div className="space-y-4">
              {persona.mbtiType && (
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-3 py-1 rounded-lg ${accent.bgSubtle} text-slate-300 text-sm font-medium`}>
                    MBTI: {persona.mbtiType}
                  </span>
                </div>
              )}

              {persona.strengths && persona.strengths.length > 0 && (
                <Section title="Strengths" icon={Star}>
                  <TagGrid items={persona.strengths} color="green" />
                </Section>
              )}

              {persona.flaws && persona.flaws.length > 0 && (
                <Section title="Flaws" icon={Star}>
                  <TagGrid items={persona.flaws} color="red" />
                </Section>
              )}

              {persona.values && persona.values.length > 0 && (
                <Section title="Values" icon={Heart}>
                  <TagGrid items={persona.values} color="pink" />
                </Section>
              )}

              {persona.fears && persona.fears.length > 0 && (
                <Section title="Fears" icon={Eye}>
                  <TagGrid items={persona.fears} color="amber" />
                </Section>
              )}

              {persona.likes && persona.likes.length > 0 && (
                <Section title="Likes" icon={Heart}>
                  <TagGrid items={persona.likes} color="cyan" />
                </Section>
              )}

              {persona.dislikes && persona.dislikes.length > 0 && (
                <Section title="Dislikes" icon={X}>
                  <TagGrid items={persona.dislikes} color="red" />
                </Section>
              )}

              {persona.hobbies && persona.hobbies.length > 0 && (
                <Section title="Hobbies" icon={BookOpen}>
                  <TagGrid items={persona.hobbies} color="purple" />
                </Section>
              )}

              {persona.skills && persona.skills.length > 0 && (
                <Section title="Skills" icon={Star}>
                  <TagGrid items={persona.skills} color="blue" />
                </Section>
              )}
            </div>
          )}
          </div>
        </div>
      </div>
      
      {/* Report Modal */}
      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        type="persona"
        reportedId={persona.userId}
        referenceId={persona.id}
        reportedName={persona.name}
      />
    </div>
  )
}
