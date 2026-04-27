'use client'

import { useState, useEffect } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import ReactMarkdown from 'react-markdown'
import { 
  X, User, Sparkles, Heart, BookOpen,
  Brain, Star, Users, Eye, Hash, Loader2, Check, Download,
  Coins, AlertCircle, Flag
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { apiFetch } from '@/lib/api-client'
import { ReportModal } from '@/components/report-modal'

// Big Five (OCEAN) personality traits
interface BigFiveTraits {
  openness: number
  conscientiousness: number
  extraversion: number
  agreeableness: number
  neuroticism: number
}

// Personality spectrums (MBTI-based)
interface PersonalitySpectrums {
  introvertExtrovert: number
  intuitiveObservant: number
  thinkingFeeling: number
  judgingProspecting: number
  assertiveTurbulent: number
}

// Full persona profile interface for marketplace
interface MarketplacePersonaProfile {
  id: string
  name: string
  avatarUrl: string | null
  description: string | null
  archetype: string | null
  gender: string | null
  age: number | null
  tags: string[]
  personalityDescription: string | null
  personalitySpectrums: PersonalitySpectrums | null
  bigFive: BigFiveTraits | null
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
}

interface MarketplaceListing {
  id: string
  name: string
  avatarUrl: string | null
  description: string | null
  tags: string | null
  price: number
  downloads: number
  purchaseCount: number
  createdAt: string
  creator: {
    id: string
    username: string
    avatarUrl: string | null
  }
  persona?: MarketplacePersonaProfile
  hasPurchased?: boolean
  isOwner?: boolean
  creatorId?: string
}

interface MarketplacePersonaModalProps {
  listing: MarketplaceListing | null
  isOpen: boolean
  onClose: () => void
  onPurchase: () => Promise<void>
  isPurchasing: boolean
  purchaseError: string
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
function SpectrumBar({ label, value, leftLabel, rightLabel, icon }: { 
  label: string; 
  value: number; 
  leftLabel: string; 
  rightLabel: string;
  icon?: React.ReactNode
}) {
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
        <div className="absolute inset-0 bg-gradient-to-r from-teal-600/20 via-teal-500/30 to-cyan-500/20" />
        <div 
          className="h-full bg-gradient-to-r from-teal-500 to-cyan-400 rounded-full relative transition-all duration-300"
          style={{ width: `${value}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg shadow-teal-500/30" />
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
function TextBlock({ content, className = '' }: { content: string; className?: string }) {
  return (
    <div className={`bg-slate-900/15 rounded-xl p-4 border border-white/[0.06] ${className}`}>
      <div className="text-slate-100/90 text-sm leading-relaxed whitespace-pre-wrap markdown-content">
        <ReactMarkdown
          components={{
            strong: ({ children }) => <strong className="font-bold text-slate-100">{children}</strong>,
            em: ({ children }) => <em className="italic text-slate-200">{children}</em>,
            code: ({ children }) => (
              <code className="bg-teal-500/15 px-1.5 py-0.5 rounded text-slate-200 text-xs font-mono">
                {children}
              </code>
            ),
            a: ({ href, children }) => (
              <a href={href} className="text-slate-400 underline underline-offset-2 hover:text-slate-300" target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ),
            blockquote: ({ children }) => (
              <blockquote className="border-l-2 border-teal-500 pl-4 italic text-slate-300 my-2">
                {children}
              </blockquote>
            ),
            ul: ({ children }) => <ul className="list-disc pl-4 my-2">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal pl-4 my-2">{children}</ol>,
            li: ({ children }) => <li className="my-0.5">{children}</li>,
            hr: () => <hr className="border-teal-500/20 my-3" />,
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

// Parse JSON arrays safely
function parseJsonArray(value: string | null): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// Parse personality spectrums
function parseSpectrums(value: string | null): PersonalitySpectrums | null {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

// Parse Big Five traits
function parseBigFive(value: string | null): BigFiveTraits | null {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

export function MarketplacePersonaModal({ 
  listing, 
  isOpen, 
  onClose,
  onPurchase,
  isPurchasing,
  purchaseError
}: MarketplacePersonaModalProps) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'overview' | 'appearance' | 'personality' | 'attributes'>('overview')
  const [slotInfo, setSlotInfo] = useState<{ used: number; total: number } | null>(null)
  const [showReportModal, setShowReportModal] = useState(false)

  // Fetch slot info
  useEffect(() => {
    if (!isOpen || !user) return
    
    const fetchSlotInfo = async () => {
      try {
        const response = await apiFetch('/api/personas')
        if (response.ok) {
          const data = await response.json()
          const used = data.personas?.length || 0
          const total = 25 + (user.purchasedSlots || 0)
          setSlotInfo({ used, total })
        }
      } catch (error) {
        console.error('Failed to fetch slot info:', error)
      }
    }
    
    fetchSlotInfo()
  }, [isOpen, user])

  if (!isOpen || !listing) return null

  // Parse persona data from listing
  const persona = listing.persona
  
  // Tags might be a string (JSON) or an array - handle both cases
  const tags = Array.isArray(persona?.tags) 
    ? persona.tags 
    : parseJsonArray(typeof persona?.tags === 'string' ? persona.tags : listing.tags)
  
  // Personality spectrums and big five are stored as JSON strings - always parse them
  const personalitySpectrums = parseSpectrums(persona?.personalitySpectrums || null)
  const bigFive = parseBigFive(persona?.bigFive || null)
  
  // Parse all array fields - they're stored as JSON strings in the database
  const strengths = parseJsonArray(persona?.strengths || null)
  const flaws = parseJsonArray(persona?.flaws || null)
  const values = parseJsonArray(persona?.values || null)
  const fears = parseJsonArray(persona?.fears || null)
  const likes = parseJsonArray(persona?.likes || null)
  const dislikes = parseJsonArray(persona?.dislikes || null)
  const hobbies = parseJsonArray(persona?.hobbies || null)
  const skills = parseJsonArray(persona?.skills || null)
  
  const hasSlots = slotInfo ? slotInfo.used < slotInfo.total : true
  const canAfford = user ? (user.chronos || 0) >= listing.price : false

  const tabs: { id: 'overview' | 'appearance' | 'personality' | 'attributes'; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <User className="w-4 h-4" /> },
    { id: 'appearance', label: 'Appearance', icon: <Eye className="w-4 h-4" /> },
    { id: 'personality', label: 'Personality', icon: <Brain className="w-4 h-4" /> },
    { id: 'attributes', label: 'Attributes', icon: <Hash className="w-4 h-4" /> },
  ]

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="w-full max-w-2xl max-h-[90vh] bg-gradient-to-b from-[#150a25] to-[#0a0312] rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="w-12 h-12 border-2 border-teal-500/20">
              <AvatarImage src={listing.avatarUrl || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-teal-500 to-cyan-400 text-white text-lg font-bold">
                {listing.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1">
              <h2 className="text-lg font-bold text-white">{listing.name}</h2>
              <div className="flex items-center gap-2">
                <Avatar className="w-4 h-4">
                  <AvatarImage src={listing.creator.avatarUrl || undefined} />
                  <AvatarFallback className="text-[8px] bg-teal-600">
                    {listing.creator.username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-slate-400 text-sm">by @{listing.creator.username}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Report Button */}
            {user && listing.creatorId && user.id !== listing.creatorId && (
              <button
                onClick={() => setShowReportModal(true)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Report this persona"
              >
                <Flag className="w-4 h-4" />
              </button>
            )}
            
            {/* Price Badge */}
            {listing.price === 0 ? (
              <span className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-sm font-medium border border-emerald-500/30">
                FREE
              </span>
            ) : (
              <span className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 text-sm font-medium border border-amber-500/30 flex items-center gap-1.5">
                <Coins className="w-4 h-4" />
                {listing.price}
              </span>
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
              <Download className="w-4 h-4 text-slate-400" />
              <span className="text-sm">
                <span className="font-semibold text-slate-100">{listing.downloads + listing.purchaseCount}</span>
                <span className="text-slate-400"> downloads</span>
              </span>
            </div>
          </div>
          
          {/* Slot Info */}
          {slotInfo && (
            <div className="flex items-center gap-2 ml-auto text-sm">
              <span className="text-slate-400">Slots:</span>
              <span className={`font-semibold ${hasSlots ? 'text-slate-100' : 'text-red-400'}`}>
                {slotInfo.used}/{slotInfo.total}
              </span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="px-4 py-2 border-b border-white/[0.08] flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'bg-teal-500/15 text-slate-200 border border-teal-500/20'
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
              {(listing.description || persona?.description) && (
                <TextBlock content={listing.description || persona?.description || ''} />
              )}
              
              {tags && tags.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-300 mb-2">Tags</h4>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag, i) => (
                      <TagChip key={i} label={tag} />
                    ))}
                  </div>
                </div>
              )}
              
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-3">
                {persona?.archetype && (
                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <p className="text-xs text-slate-500">Archetype</p>
                    <p className="text-sm font-medium text-slate-100">{persona.archetype}</p>
                  </div>
                )}
                {persona?.gender && (
                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <p className="text-xs text-slate-500">Gender</p>
                    <p className="text-sm font-medium text-slate-100">{persona.gender}</p>
                  </div>
                )}
                {persona?.age !== null && persona?.age !== undefined && (
                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <p className="text-xs text-slate-500">Age</p>
                    <p className="text-sm font-medium text-slate-100">{persona.age}</p>
                  </div>
                )}
                {persona?.species && (
                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <p className="text-xs text-slate-500">Species</p>
                    <p className="text-sm font-medium text-slate-100">{persona.species}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-4">
              {persona?.appearance ? (
                <TextBlock content={persona.appearance} />
              ) : (
                <div className="text-center py-8 text-slate-500">
                  No appearance description provided
                </div>
              )}
            </div>
          )}

          {activeTab === 'personality' && (
            <div className="space-y-6">
              {persona?.personalityDescription && (
                <TextBlock content={persona.personalityDescription} />
              )}
              
              {/* MBTI Personality Spectrums */}
              {personalitySpectrums && (
                <div>
                  <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                    <Brain className="w-4 h-4" />
                    Personality Spectrums (MBTI)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <SpectrumBar
                      label="Energy"
                      value={personalitySpectrums.introvertExtrovert}
                      leftLabel="Introvert"
                      rightLabel="Extrovert"
                      icon={<Sparkles className="w-4 h-4 text-slate-400" />}
                    />
                    <SpectrumBar
                      label="Perception"
                      value={personalitySpectrums.intuitiveObservant}
                      leftLabel="Intuitive"
                      rightLabel="Observant"
                      icon={<Eye className="w-4 h-4 text-slate-400" />}
                    />
                    <SpectrumBar
                      label="Decisions"
                      value={personalitySpectrums.thinkingFeeling}
                      leftLabel="Thinking"
                      rightLabel="Feeling"
                      icon={<Heart className="w-4 h-4 text-slate-400" />}
                    />
                    <SpectrumBar
                      label="Structure"
                      value={personalitySpectrums.judgingProspecting}
                      leftLabel="Judging"
                      rightLabel="Prospecting"
                      icon={<Star className="w-4 h-4 text-slate-400" />}
                    />
                    <SpectrumBar
                      label="Identity"
                      value={personalitySpectrums.assertiveTurbulent}
                      leftLabel="Assertive"
                      rightLabel="Turbulent"
                      icon={<User className="w-4 h-4 text-slate-400" />}
                    />
                  </div>
                </div>
              )}
              
              {/* Big Five (OCEAN) Personality Traits */}
              {bigFive && (
                <div>
                  <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Big Five (OCEAN) Traits
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <SpectrumBar
                      label="Openness"
                      value={bigFive.openness}
                      leftLabel="Practical"
                      rightLabel="Open"
                      icon={<Brain className="w-4 h-4 text-cyan-400" />}
                    />
                    <SpectrumBar
                      label="Conscientiousness"
                      value={bigFive.conscientiousness}
                      leftLabel="Flexible"
                      rightLabel="Organized"
                      icon={<BookOpen className="w-4 h-4 text-cyan-400" />}
                    />
                    <SpectrumBar
                      label="Extraversion"
                      value={bigFive.extraversion}
                      leftLabel="Reserved"
                      rightLabel="Social"
                      icon={<Users className="w-4 h-4 text-cyan-400" />}
                    />
                    <SpectrumBar
                      label="Agreeableness"
                      value={bigFive.agreeableness}
                      leftLabel="Competitive"
                      rightLabel="Cooperative"
                      icon={<Heart className="w-4 h-4 text-cyan-400" />}
                    />
                    <SpectrumBar
                      label="Neuroticism"
                      value={bigFive.neuroticism}
                      leftLabel="Stable"
                      rightLabel="Reactive"
                      icon={<Sparkles className="w-4 h-4 text-cyan-400" />}
                    />
                  </div>
                </div>
              )}
              
              {!personalitySpectrums && !bigFive && !persona?.personalityDescription && (
                <div className="text-center py-8 text-slate-500">
                  No personality information provided
                </div>
              )}
            </div>
          )}

          {activeTab === 'attributes' && (
            <div className="space-y-4">
              {persona?.mbtiType && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-3 py-1 rounded-lg bg-teal-500/15 text-slate-300 text-sm font-medium">
                    MBTI: {persona.mbtiType}
                  </span>
                </div>
              )}

              {strengths.length > 0 && (
                <Section title="Strengths" icon={Star}>
                  <TagGrid items={strengths} color="green" />
                </Section>
              )}

              {flaws.length > 0 && (
                <Section title="Flaws" icon={Star}>
                  <TagGrid items={flaws} color="red" />
                </Section>
              )}

              {values.length > 0 && (
                <Section title="Values" icon={Heart}>
                  <TagGrid items={values} color="pink" />
                </Section>
              )}

              {fears.length > 0 && (
                <Section title="Fears" icon={Eye}>
                  <TagGrid items={fears} color="amber" />
                </Section>
              )}

              {likes.length > 0 && (
                <Section title="Likes" icon={Heart}>
                  <TagGrid items={likes} color="cyan" />
                </Section>
              )}

              {dislikes.length > 0 && (
                <Section title="Dislikes" icon={X}>
                  <TagGrid items={dislikes} color="red" />
                </Section>
              )}

              {hobbies.length > 0 && (
                <Section title="Hobbies" icon={BookOpen}>
                  <TagGrid items={hobbies} color="purple" />
                </Section>
              )}

              {skills.length > 0 && (
                <Section title="Skills" icon={Star}>
                  <TagGrid items={skills} color="blue" />
                </Section>
              )}
              
              {strengths.length === 0 && flaws.length === 0 && values.length === 0 && fears.length === 0 && 
               likes.length === 0 && dislikes.length === 0 && hobbies.length === 0 && skills.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  No attribute information provided
                </div>
              )}
            </div>
          )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-white/[0.06] bg-[#0a0610]">
          {/* Error Messages */}
          {purchaseError && (
            <div className="mb-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {purchaseError}
            </div>
          )}
          
          {!hasSlots && !listing.hasPurchased && !listing.isOwner && (
            <div className="mb-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              No available persona slots. Purchase more in the Chronos wallet.
            </div>
          )}
          
          {!canAfford && listing.price > 0 && !listing.hasPurchased && !listing.isOwner && (
            <div className="mb-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              Not enough Chronos. You need {listing.price} Chronos.
            </div>
          )}
          
          {listing.isOwner ? (
            <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-white/[0.05] text-slate-300 font-medium border border-white/[0.08]">
              <User className="w-5 h-5" />
              You listed this character
            </div>
          ) : listing.hasPurchased ? (
            <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/20">
              <Check className="w-5 h-5" />
              You own this persona
            </div>
          ) : (
            <button
              onClick={onPurchase}
              disabled={isPurchasing || !hasSlots || (listing.price > 0 && !canAfford)}
              className="w-full py-3 px-4 rounded-lg font-semibold text-sm
                bg-gradient-to-r from-teal-600 to-cyan-600 
                hover:from-teal-500 hover:to-cyan-500
                text-white shadow-lg shadow-black/40
                transition-all duration-200 flex items-center justify-center gap-2
                disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPurchasing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : listing.price === 0 ? (
                <>
                  <Download className="w-5 h-5" />
                  Add to My Personas
                </>
              ) : (
                <>
                  <Coins className="w-5 h-5" />
                  Use Persona for {listing.price} Chronos
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
