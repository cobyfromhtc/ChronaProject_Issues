'use client'

import React, { useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { MessageSquare, User, Sparkles, Crown, Heart, Zap, Star, Eye, Globe, Bookmark, Send } from 'lucide-react'

interface PersonaConnectionData {
  id: string
  characterName: string
  relationshipType: string
  specificRole: string | null
  characterAge: number | null
  description: string | null
}

interface PersonaCardProps {
  persona: {
    id: string
    name: string
    avatarUrl: string | null
    bannerUrl: string | null
    bio: string | null
    username: string
    userId: string
    isOnline: boolean
    archetype: string | null
    gender: string | null
    age: number | null
    tags: string[]
    personalityDescription: string | null
    personalitySpectrums: {
      introvertExtrovert: number
      intuitiveObservant: number
      thinkingFeeling: number
      judgingProspecting: number
      assertiveTurbulent: number
    } | null
    bigFive: {
      openness: number
      conscientiousness: number
      extraversion: number
      agreeableness: number
      neuroticism: number
    } | null
    hexaco: {
      honestyHumility: number
      emotionality: number
      extraversion: number
      agreeableness: number
      conscientiousness: number
      opennessToExperience: number
    } | null
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
    connections: PersonaConnectionData[]
    rpStyle?: string | null
  }
  onStartChat: (personaId: string) => void
  onViewProfile: (persona: any) => void
}

// Archetype icons and colors
const archetypeConfig: Record<string, { icon: any; color: string; gradient: string; bg: string }> = {
  'Hero': { icon: Crown, color: 'text-amber-400', gradient: 'from-amber-500 to-orange-500', bg: 'from-amber-500/30 to-orange-500/20' },
  'Villain': { icon: Zap, color: 'text-red-400', gradient: 'from-red-500 to-rose-500', bg: 'from-red-500/30 to-rose-500/20' },
  'Mentor': { icon: Star, color: 'text-blue-400', gradient: 'from-blue-500 to-cyan-500', bg: 'from-blue-500/30 to-cyan-500/20' },
  'Lover': { icon: Heart, color: 'text-pink-400', gradient: 'from-pink-500 to-rose-500', bg: 'from-pink-500/30 to-rose-500/20' },
  'Explorer': { icon: Eye, color: 'text-emerald-400', gradient: 'from-emerald-500 to-teal-500', bg: 'from-emerald-500/30 to-teal-500/20' },
  'Creator': { icon: Sparkles, color: 'text-slate-400', gradient: 'from-teal-500 to-violet-500', bg: 'from-teal-500/20 to-violet-500/20' },
  'default': { icon: User, color: 'text-slate-400', gradient: 'from-teal-500 to-cyan-400', bg: 'from-teal-500/20 to-cyan-500/15' },
}

// RP Style config with colored pills
const rpStyleConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  'one_liner': { label: '1-Liner', color: 'text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-500/25' },
  'semi_lit': { label: 'Semi-Lit', color: 'text-cyan-300', bg: 'bg-cyan-500/15', border: 'border-cyan-500/25' },
  'literate': { label: 'Literate', color: 'text-violet-300', bg: 'bg-violet-500/15', border: 'border-violet-500/25' },
  'novella': { label: 'Novella', color: 'text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-500/25' },
}

export const PersonaCard = React.memo(function PersonaCard({ persona, onStartChat, onViewProfile }: PersonaCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [bannerLoaded, setBannerLoaded] = useState(false)
  const [bannerError, setBannerError] = useState(false)
  const [isFavorited, setIsFavorited] = useState(false)
  
  const config = archetypeConfig[persona.archetype || 'default'] || archetypeConfig['default']
  const ArchetypeIcon = config.icon
  
  // Get personality indicator (MBTI or simplified)
  const getPersonalityBadge = () => {
    if (persona.mbtiType) {
      return persona.mbtiType
    }
    if (persona.personalitySpectrums) {
      const e = persona.personalitySpectrums.introvertExtrovert > 50 ? 'E' : 'I'
      const n = persona.personalitySpectrums.intuitiveObservant > 50 ? 'N' : 'S'
      const t = persona.personalitySpectrums.thinkingFeeling > 50 ? 'T' : 'F'
      const j = persona.personalitySpectrums.judgingProspecting > 50 ? 'J' : 'P'
      return `${e}${n}${t}${j}`
    }
    return null
  }
  
  const personalityBadge = getPersonalityBadge()
  
  // Format info display
  const infoParts = [persona.gender, persona.age ? `${persona.age}y` : null, persona.species].filter(Boolean)
  
  // Get initials for avatar fallback
  const getInitials = (name: string) => {
    const parts = name.split(' ')
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }
  
  // Generate gradient colors based on name for avatar fallback
  const getAvatarGradient = (name: string) => {
    let hash = 0
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash)
    }
    const gradients = [
      'from-rose-600 via-pink-600 to-fuchsia-700',
      'from-teal-600 via-cyan-600 to-purple-700',
      'from-amber-600 via-orange-600 to-red-700',
      'from-emerald-600 via-teal-600 to-cyan-700',
      'from-violet-600 via-purple-600 to-fuchsia-700',
      'from-cyan-600 via-teal-600 to-emerald-700',
    ]
    return gradients[Math.abs(hash) % gradients.length]
  }
  
  // RP style config
  const rpConfig = persona.rpStyle ? rpStyleConfig[persona.rpStyle] : null

  return (
    <TooltipProvider delayDuration={300}>
      <div 
        className={`relative group cursor-pointer transition-all duration-500 ease-out ${isHovered ? 'scale-[1.04] z-10' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => onViewProfile(persona)}
      >
        {/* Glow effect on hover - more dramatic */}
        <div className={`absolute -inset-1 rounded-2xl transition-all duration-500 ${isHovered ? 'opacity-100 scale-105' : 'opacity-0 scale-100'}`}>
          <div className={`absolute inset-0 bg-gradient-to-br ${config.bg} rounded-2xl blur-xl`} />
        </div>
        
        {/* Card container - wider, shorter */}
        <div className={`relative overflow-hidden rounded-2xl border transition-all duration-500 ${
          isHovered 
            ? 'border-teal-500/40 bg-[#0f1117]/95 shadow-lg shadow-teal-500/10' 
            : 'border-white/[0.08] bg-[#0f1117]/80'
        }`}>
          {/* Banner Section */}
          <div className="relative h-24 overflow-hidden">
            {persona.bannerUrl && !bannerError ? (
              <>
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0f1117] z-10" />
                <img 
                  src={persona.bannerUrl}
                  alt=""
                  width={400}
                  height={96}
                  className={`w-full h-full object-cover transition-all duration-700 ${isHovered ? 'scale-110' : 'scale-100'} ${bannerLoaded ? 'opacity-100' : 'opacity-0'}`}
                  onLoad={() => setBannerLoaded(true)}
                  onError={() => setBannerError(true)}
                  loading="lazy"
                  decoding="async"
                />
              </>
            ) : (
              <div className={`w-full h-full bg-gradient-to-br ${config.bg}`}>
                {/* Animated pattern for empty banner */}
                <div className="absolute inset-0 opacity-30">
                  <div className="absolute top-2 right-8 w-16 h-16 rounded-full bg-white/5 blur-xl" />
                  <div className="absolute bottom-1 left-12 w-12 h-12 rounded-full bg-white/5 blur-lg" />
                </div>
              </div>
            )}
            
            {/* Online status badge */}
            {persona.isOnline && (
              <div className="absolute top-2 right-2 z-20">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 backdrop-blur-sm">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
                  </span>
                </div>
              </div>
            )}

            {/* Favorite/Bookmark button */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                setIsFavorited(!isFavorited)
              }}
              className={`absolute top-2 left-2 z-20 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 ${
                isFavorited 
                  ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400' 
                  : 'bg-black/30 border border-white/10 text-white/40 hover:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/30'
              } backdrop-blur-sm`}
            >
              <Bookmark className={`w-3.5 h-3.5 transition-all ${isFavorited ? 'fill-current' : ''}`} />
            </button>
            
            {/* Avatar - positioned at center-bottom of banner, fully visible */}
            <div className="absolute bottom-3 left-3 z-20">
              {/* Background circle to make avatar stand out */}
              <div className="absolute inset-0 rounded-full bg-[#0f1117]/90 backdrop-blur-sm scale-110" />
              
              <div className={`relative transition-transform duration-500 ${isHovered ? 'scale-110' : ''}`}>
                {/* Outer ring */}
                <div className={`absolute inset-0 rounded-full p-[2px] bg-gradient-to-br ${
                  persona.isOnline 
                    ? 'from-emerald-400 via-teal-500 to-cyan-500' 
                    : 'from-teal-500/40 via-cyan-500/50 to-purple-500/50'
                } transition-all duration-500 ${isHovered ? 'opacity-100' : 'opacity-80'}`}>
                  <div className="w-full h-full rounded-full bg-[#0f1117]" />
                </div>
                
                {/* Avatar */}
                {persona.avatarUrl ? (
                  <Avatar className="w-14 h-14 border-2 border-transparent relative z-10">
                    <AvatarImage 
                      src={persona.avatarUrl} 
                      className={`transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                      onLoad={() => setImageLoaded(true)}
                    />
                    <AvatarFallback className={`${getAvatarGradient(persona.name)} text-white text-lg font-bold`}>
                      {getInitials(persona.name)}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <Avatar className="w-14 h-14 border-2 border-transparent relative z-10">
                    <AvatarFallback className={`${getAvatarGradient(persona.name)} text-white font-bold`}>
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-base leading-none font-bold">{getInitials(persona.name)}</span>
                      </div>
                    </AvatarFallback>
                  </Avatar>
                )}
                
                {/* Archetype icon */}
                {persona.archetype && (
                  <div className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-gradient-to-br ${config.gradient} border border-teal-500/20 flex items-center justify-center shadow-lg`}>
                    <ArchetypeIcon className={`w-2.5 h-2.5 text-white`} />
                  </div>
                )}
              </div>
            </div>

            {/* Connection count badge */}
            {persona.connections && persona.connections.length > 0 && (
              <div className="absolute bottom-2 right-2 z-20">
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-teal-500/20 border border-teal-500/30 backdrop-blur-sm">
                  <Globe className="w-2.5 h-2.5 text-teal-400" />
                  <span className="text-[9px] font-medium text-teal-300">{persona.connections.length}</span>
                </div>
              </div>
            )}
          </div>
          
          {/* Content section - more compact */}
          <div className="px-3 pt-2 pb-3">
            {/* Name row with personality badge and RP style */}
            <div className="flex items-center gap-1.5 mb-0.5">
              <h3 className="font-semibold text-slate-100 text-sm truncate flex-1">
                {persona.name}
              </h3>
              {personalityBadge && (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30 flex-shrink-0">
                  {personalityBadge}
                </span>
              )}
            </div>
            
            {/* Username */}
            <p className="text-[10px] text-slate-500 truncate mb-1">@{persona.username}</p>
            
            {/* Info row: gender, age, species */}
            {infoParts.length > 0 && (
              <div className="flex items-center gap-1 text-[10px] text-slate-500 mb-1.5">
                {infoParts.map((part, i) => (
                  <span key={i} className="flex items-center gap-1">
                    {i > 0 && <span className="text-slate-500/30">•</span>}
                    <span>{part}</span>
                  </span>
                ))}
              </div>
            )}
            
            {/* Bio preview - shorter */}
            {persona.bio && (
              <p className="text-[10px] text-slate-300/50 line-clamp-1 mb-1.5">
                {persona.bio}
              </p>
            )}

            {/* RP Style indicator */}
            {rpConfig && (
              <div className="mb-1.5">
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${rpConfig.bg} ${rpConfig.color} border ${rpConfig.border}`}>
                  {rpConfig.label}
                </span>
              </div>
            )}
            
            {/* Tags - max 2 visible */}
            {persona.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {persona.tags.slice(0, 2).map((tag, index) => (
                  <span 
                    key={index}
                    className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.05] text-slate-300/70 border border-white/[0.08]"
                  >
                    {tag}
                  </span>
                ))}
                {persona.tags.length > 2 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.05] text-slate-500">
                    +{persona.tags.length - 2}
                  </span>
                )}
              </div>
            )}
            
            {/* Personality bars - mini horizontal */}
            {persona.personalitySpectrums && (
              <div className="flex items-center gap-0.5 mb-2 h-4">
                {Object.entries(persona.personalitySpectrums).map(([key, value]) => (
                  <Tooltip key={key}>
                    <TooltipTrigger asChild>
                      <div className="relative w-1.5 h-full cursor-help">
                        <div className="absolute inset-0 rounded-full bg-teal-500/15" />
                        <div 
                          className={`absolute bottom-0 left-0 right-0 rounded-full transition-all duration-300 ${
                            value > 50 ? 'bg-fuchsia-500/70' : 'bg-teal-500/70'
                          }`}
                          style={{ height: `${Math.abs(value - 50) * 2}%` }}
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent 
                      side="top" 
                      className="bg-[#0f1117] border-teal-500/20 px-2 py-1"
                      sideOffset={5}
                    >
                      <p className="text-[10px] text-slate-100 font-medium">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </p>
                      <p className="text-[9px] text-slate-300">{value}%</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            )}
            
            {/* Action buttons */}
            <div className="flex gap-1.5">
              <button 
                onClick={(e) => { 
                  e.stopPropagation()
                  onViewProfile(persona)
                }}
                className="flex-1 py-1.5 rounded-lg text-[10px] font-medium bg-white/[0.05] text-slate-300 border border-white/[0.08] hover:bg-teal-500/15 hover:border-teal-500/20 transition-all flex items-center justify-center gap-1"
              >
                <Eye className="w-3 h-3" />
                View
              </button>
              <button 
                onClick={(e) => { 
                  e.stopPropagation()
                  onStartChat(persona.id)
                }}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium transition-all flex items-center justify-center gap-1 ${
                  persona.isOnline
                    ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white hover:from-teal-500 hover:to-cyan-500 shadow-lg shadow-teal-500/15'
                    : 'bg-teal-500/15 text-slate-200 hover:bg-teal-500/20'
                }`}
              >
                <MessageSquare className="w-3 h-3" />
                Chat
              </button>
              {/* Quick DM button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onStartChat(persona.id)
                }}
                className="py-1.5 px-2 rounded-lg text-[10px] font-medium bg-white/[0.05] text-slate-400 border border-white/[0.08] hover:bg-cyan-500/15 hover:border-cyan-500/20 hover:text-cyan-300 transition-all flex items-center justify-center"
                title="Quick DM"
              >
                <Send className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
})
