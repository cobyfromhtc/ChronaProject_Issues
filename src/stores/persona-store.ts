'use client'

import { create } from 'zustand'

// Personality spectrums type (MBTI-based)
export interface PersonalitySpectrums {
  introvertExtrovert: number  // 0 = Introvert, 100 = Extrovert
  intuitiveObservant: number  // 0 = Intuitive, 100 = Observant
  thinkingFeeling: number     // 0 = Thinking, 100 = Feeling
  judgingProspecting: number  // 0 = Judging, 100 = Prospecting
  assertiveTurbulent: number  // 0 = Assertive, 100 = Turbulent
}

// Big Five (OCEAN) personality traits
export interface BigFiveTraits {
  openness: number           // 0 = Practical/Conventional, 100 = Open/Creative
  conscientiousness: number  // 0 = Flexible/Spontaneous, 100 = Organized/Disciplined
  extraversion: number       // 0 = Introverted/Reserved, 100 = Extraverted/Social
  agreeableness: number      // 0 = Competitive/Critical, 100 = Cooperative/Compassionate
  neuroticism: number        // 0 = Emotionally Stable, 100 = Emotionally Reactive
}

// HEXACO personality traits (6-factor model)
export interface HexacoTraits {
  honestyHumility: number    // 0 = Self-interest/Self-enhancement, 100 = Sincerity/Fairness/Modesty
  emotionality: number       // 0 = Detached/Unemotional, 100 = Sentimental/Emotionally sensitive
  extraversion: number       // 0 = Reserved/Solitary, 100 = Social/Expressive
  agreeableness: number      // 0 = Critical/Competitive, 100 = Patient/Tolerant/Forgiving
  conscientiousness: number  // 0 = Impulsive/Disorganized, 100 = Disciplined/Organized
  opennessToExperience: number // 0 = Conventional/Traditional, 100 = Creative/Unconventional
}

// Connection type for relationships
export interface PersonaConnection {
  id: string
  characterName: string
  relationshipType: string
  specificRole: string | null
  characterAge: number | null
  description: string | null
}

export interface Persona {
  id: string
  userId: string
  name: string
  avatarUrl: string | null
  isActive: boolean
  isOnline: boolean
  
  // Overview
  description: string | null
  archetype: string | null
  gender: string | null
  pronouns: string | null
  age: number | null
  tags: string[]
  
  // Personality
  personalityDescription: string | null
  personalitySpectrums: PersonalitySpectrums
  bigFive: BigFiveTraits
  hexaco: HexacoTraits
  strengths: string[]
  flaws: string[]
  values: string[]
  fears: string[]
  
  // Attributes
  species: string | null
  likes: string[]
  dislikes: string[]
  hobbies: string[]
  skills: string[]
  languages: string[]
  habits: string[]
  speechPatterns: string[]
  
  // Backstory
  backstory: string | null
  appearance: string | null
  
  // MBTI
  mbtiType: string | null
  
  // Profile Theme
  themeId: string | null
  themeEnabled: boolean
  
  // Roleplay Preferences
  rpStyle: string | null
  rpPreferredGenders: string[]
  rpGenres: string[]
  rpLimits: string[]
  rpThemes: string[]
  rpExperienceLevel: string | null
  rpResponseTime: string | null
  
  // NSFW Content (18+)
  nsfwEnabled: boolean
  nsfwBodyType: string | null
  nsfwKinks: string[]
  nsfwContentWarnings: string[]
  nsfwOrientation: string | null
  nsfwRolePreference: string | null
  
  // Timestamps
  createdAt: string
  updatedAt: string
  
  // Relations
  connections?: PersonaConnection[]
}

interface PersonaState {
  personas: Persona[]
  activePersona: Persona | null
  isLoading: boolean
  
  // Actions
  setPersonas: (personas: Persona[]) => void
  addPersona: (persona: Persona) => void
  updatePersona: (id: string, data: Partial<Persona>) => void
  removePersona: (id: string) => void
  setActivePersona: (persona: Persona | null) => void
  setLoading: (loading: boolean) => void
}

// Helper to parse JSON arrays safely
function parseJsonArray(value: string | null): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// Helper to parse personality spectrums
function parseSpectrums(value: string | null): PersonalitySpectrums {
  const defaultSpectrums: PersonalitySpectrums = {
    introvertExtrovert: 50,
    intuitiveObservant: 50,
    thinkingFeeling: 50,
    judgingProspecting: 50,
    assertiveTurbulent: 50,
  }
  if (!value) return defaultSpectrums
  try {
    const parsed = JSON.parse(value)
    return { ...defaultSpectrums, ...parsed }
  } catch {
    return defaultSpectrums
  }
}

// Default Big Five values
export const defaultBigFive: BigFiveTraits = {
  openness: 50,
  conscientiousness: 50,
  extraversion: 50,
  agreeableness: 50,
  neuroticism: 50,
}

// Default HEXACO values
export const defaultHexaco: HexacoTraits = {
  honestyHumility: 50,
  emotionality: 50,
  extraversion: 50,
  agreeableness: 50,
  conscientiousness: 50,
  opennessToExperience: 50,
}

// Helper to parse Big Five traits
function parseBigFive(value: string | null): BigFiveTraits {
  if (!value) return defaultBigFive
  try {
    const parsed = JSON.parse(value)
    return { ...defaultBigFive, ...parsed }
  } catch {
    return defaultBigFive
  }
}

// Helper to parse HEXACO traits
function parseHexaco(value: string | null): HexacoTraits {
  if (!value) return defaultHexaco
  try {
    const parsed = JSON.parse(value)
    return { ...defaultHexaco, ...parsed }
  } catch {
    return defaultHexaco
  }
}

// Transform raw database persona to frontend Persona
export function transformPersona(raw: {
  id: string
  userId: string
  name: string
  avatarUrl: string | null
  isActive: boolean
  isOnline: boolean
  description: string | null
  archetype: string | null
  gender: string | null
  pronouns: string | null
  age: number | null
  tags: string | null
  personalityDescription: string | null
  personalitySpectrums: string | null
  bigFive: string | null
  hexaco: string | null
  strengths: string | null
  flaws: string | null
  values: string | null
  fears: string | null
  species: string | null
  likes: string | null
  dislikes: string | null
  hobbies: string | null
  skills: string | null
  languages: string | null
  habits: string | null
  speechPatterns: string | null
  backstory: string | null
  appearance: string | null
  mbtiType: string | null
  themeId: string | null
  themeEnabled: boolean
  rpStyle: string | null
  rpPreferredGenders: string | null
  rpGenres: string | null
  rpLimits: string | null
  rpThemes: string | null
  rpExperienceLevel: string | null
  rpResponseTime: string | null
  // NSFW fields
  nsfwEnabled: boolean
  nsfwBodyType: string | null
  nsfwKinks: string | null
  nsfwContentWarnings: string | null
  nsfwOrientation: string | null
  nsfwRolePreference: string | null
  createdAt: Date | string
  updatedAt: Date | string
  connections?: {
    id: string
    characterName: string
    relationshipType: string
    specificRole: string | null
    characterAge: number | null
    description: string | null
  }[]
}): Persona {
  return {
    id: raw.id,
    userId: raw.userId,
    name: raw.name,
    avatarUrl: raw.avatarUrl,
    isActive: raw.isActive,
    isOnline: raw.isOnline,
    description: raw.description,
    archetype: raw.archetype,
    gender: raw.gender,
    pronouns: raw.pronouns,
    age: raw.age,
    tags: parseJsonArray(raw.tags),
    personalityDescription: raw.personalityDescription,
    personalitySpectrums: parseSpectrums(raw.personalitySpectrums),
    bigFive: parseBigFive(raw.bigFive),
    hexaco: parseHexaco(raw.hexaco),
    strengths: parseJsonArray(raw.strengths),
    flaws: parseJsonArray(raw.flaws),
    values: parseJsonArray(raw.values),
    fears: parseJsonArray(raw.fears),
    species: raw.species,
    likes: parseJsonArray(raw.likes),
    dislikes: parseJsonArray(raw.dislikes),
    hobbies: parseJsonArray(raw.hobbies),
    skills: parseJsonArray(raw.skills),
    languages: parseJsonArray(raw.languages),
    habits: parseJsonArray(raw.habits),
    speechPatterns: parseJsonArray(raw.speechPatterns),
    backstory: raw.backstory,
    appearance: raw.appearance,
    mbtiType: raw.mbtiType,
    themeId: raw.themeId,
    themeEnabled: raw.themeEnabled ?? false,
    rpStyle: raw.rpStyle,
    rpPreferredGenders: parseJsonArray(raw.rpPreferredGenders),
    rpGenres: parseJsonArray(raw.rpGenres),
    rpLimits: parseJsonArray(raw.rpLimits),
    rpThemes: parseJsonArray(raw.rpThemes),
    rpExperienceLevel: raw.rpExperienceLevel,
    rpResponseTime: raw.rpResponseTime,
    // NSFW fields
    nsfwEnabled: raw.nsfwEnabled ?? false,
    nsfwBodyType: raw.nsfwBodyType,
    nsfwKinks: parseJsonArray(raw.nsfwKinks),
    nsfwContentWarnings: parseJsonArray(raw.nsfwContentWarnings),
    nsfwOrientation: raw.nsfwOrientation,
    nsfwRolePreference: raw.nsfwRolePreference,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : raw.createdAt.toISOString(),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : raw.updatedAt.toISOString(),
    connections: raw.connections?.map(c => ({
      id: c.id,
      characterName: c.characterName,
      relationshipType: c.relationshipType,
      specificRole: c.specificRole,
      characterAge: c.characterAge,
      description: c.description,
    })),
  }
}

export const usePersonaStore = create<PersonaState>((set) => ({
  personas: [],
  activePersona: null,
  isLoading: true,
  
  setPersonas: (personas) => {
    // Fix: Ensure only ONE persona is marked as active
    const activePersonas = personas.filter(p => p.isActive)
    let fixedPersonas = personas
    
    if (activePersonas.length > 1) {
      // Keep only the first active one
      fixedPersonas = personas.map(p => ({
        ...p,
        isActive: p.id === activePersonas[0].id,
        isOnline: p.id === activePersonas[0].id
      }))
    }
    
    return set({ 
      personas: fixedPersonas,
      activePersona: fixedPersonas.find(p => p.isActive) || null,
      isLoading: false 
    })
  },
  
  addPersona: (persona) => set((state) => {
    // If new persona is active, deactivate all others
    const updatedPersonas = persona.isActive 
      ? [{ ...persona }, ...state.personas.map(p => ({ ...p, isActive: false, isOnline: false }))]
      : [persona, ...state.personas]
    
    return {
      personas: updatedPersonas,
      activePersona: persona.isActive ? persona : state.activePersona
    }
  }),
  
  updatePersona: (id, data) => set((state) => ({ 
    personas: state.personas.map(p => 
      p.id === id ? { ...p, ...data } : p
    ),
    activePersona: state.activePersona?.id === id 
      ? { ...state.activePersona, ...data } 
      : state.activePersona
  })),
  
  removePersona: (id) => set((state) => ({ 
    personas: state.personas.filter(p => p.id !== id),
    activePersona: state.activePersona?.id === id 
      ? state.personas.find(p => p.id !== id && p.isActive) || null
      : state.activePersona
  })),
  
  setActivePersona: (persona) => set((state) => ({ 
    activePersona: persona,
    personas: state.personas.map(p => ({
      ...p,
      isActive: p.id === persona?.id,
      isOnline: p.id === persona?.id
    }))
  })),
  
  setLoading: (isLoading) => set({ isLoading }),
}))
