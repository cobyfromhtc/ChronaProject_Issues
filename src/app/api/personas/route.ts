import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'
import { isMinor, canEnableNsfw } from '@/lib/age-utils'

// Personas API - Full CRUD for character personas with all fields
// Last updated: 2024

// Schema for creating a persona with all fields
const createPersonaSchema = z.object({
  // Overview
  name: z.string().min(1, 'Name is required').max(50, 'Name must be at most 50 characters'),
  avatarUrl: z.string().optional().nullable(),
  description: z.string().max(12000, 'Description must be at most 12000 characters').optional().nullable(),
  archetype: z.string().max(50).optional().nullable(),
  gender: z.string().max(50).optional().nullable(),
  pronouns: z.string().max(50).optional().nullable(),
  age: z.number().int().min(0).max(9999).optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  
  // Personality
  personalityDescription: z.string().max(12000).optional().nullable(),
  personalitySpectrums: z.object({
    introvertExtrovert: z.number().min(0).max(100),
    intuitiveObservant: z.number().min(0).max(100),
    thinkingFeeling: z.number().min(0).max(100),
    judgingProspecting: z.number().min(0).max(100),
    assertiveTurbulent: z.number().min(0).max(100),
  }).optional().nullable(),
  bigFive: z.object({
    openness: z.number().min(0).max(100),
    conscientiousness: z.number().min(0).max(100),
    extraversion: z.number().min(0).max(100),
    agreeableness: z.number().min(0).max(100),
    neuroticism: z.number().min(0).max(100),
  }).optional().nullable(),
  hexaco: z.object({
    honestyHumility: z.number().min(0).max(100),
    emotionality: z.number().min(0).max(100),
    extraversion: z.number().min(0).max(100),
    agreeableness: z.number().min(0).max(100),
    conscientiousness: z.number().min(0).max(100),
    opennessToExperience: z.number().min(0).max(100),
  }).optional().nullable(),
  strengths: z.array(z.string().max(100)).max(20).optional(),
  flaws: z.array(z.string().max(100)).max(20).optional(),
  values: z.array(z.string().max(100)).max(20).optional(),
  fears: z.array(z.string().max(100)).max(20).optional(),
  
  // Attributes
  species: z.string().max(100).optional().nullable(),
  likes: z.array(z.string().max(100)).max(30).optional(),
  dislikes: z.array(z.string().max(100)).max(30).optional(),
  hobbies: z.array(z.string().max(100)).max(20).optional(),
  skills: z.array(z.string().max(100)).max(20).optional(),
  languages: z.array(z.string().max(100)).max(10).optional(),
  habits: z.array(z.string().max(100)).max(20).optional(),
  speechPatterns: z.array(z.string().max(100)).max(20).optional(),
  
  // Backstory
  backstory: z.string().max(12000).optional().nullable(),
  appearance: z.string().max(12000).optional().nullable(),
  
  // MBTI
  mbtiType: z.string().max(10).optional().nullable(),
  
  // Profile Theme
  themeEnabled: z.boolean().optional(),
  
  // Roleplay Preferences
  rpStyle: z.string().max(50).optional().nullable(),
  rpPreferredGenders: z.array(z.string().max(50)).max(10).optional(),
  rpGenres: z.array(z.string().max(100)).max(20).optional(),
  rpLimits: z.array(z.string().max(100)).max(30).optional(),
  rpThemes: z.array(z.string().max(100)).max(30).optional(),
  rpExperienceLevel: z.string().max(50).optional().nullable(),
  rpResponseTime: z.string().max(50).optional().nullable(),
  
  // NSFW Content (18+)
  nsfwEnabled: z.boolean().optional(),
  nsfwBodyType: z.string().max(12000).optional().nullable(),
  nsfwKinks: z.array(z.string().max(100)).max(50).optional(),
  nsfwContentWarnings: z.array(z.string().max(100)).max(50).optional(),
  nsfwOrientation: z.string().max(50).optional().nullable(),
  nsfwRolePreference: z.string().max(50).optional().nullable(),
  
  // Connections
  connections: z.array(z.object({
    characterName: z.string().max(100),
    relationshipType: z.string().max(50),
    specificRole: z.string().max(100).optional().nullable(),
    characterAge: z.number().int().min(0).max(9999).optional().nullable(),
    description: z.string().max(500).optional().nullable(),
  })).max(50).optional(),
})

// GET - Fetch all personas for current user
export async function GET(request: Request) {
  try {
    const user = await getSessionFromRequest(request)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    // Fetch personas
    const personas = await db.persona.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' }
    })
    
    // Fix: Ensure only ONE persona is active (in case of data inconsistency)
    const activePersonas = personas.filter(p => p.isActive)
    if (activePersonas.length > 1) {
      // Keep only the most recently active one active
      const mostRecentActive = activePersonas[0]
      await db.persona.updateMany({
        where: {
          userId: user.id,
          id: { not: mostRecentActive.id },
          isActive: true
        },
        data: { isActive: false, isOnline: false }
      })
      // Re-fetch after fix
      const fixedPersonas = await db.persona.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' }
      })
      
      const personasWithConnections = await Promise.all(
        fixedPersonas.map(async (persona) => {
          const connections = await db.personaConnection.findMany({
            where: { personaId: persona.id },
            orderBy: { createdAt: 'asc' }
          })
          return { ...persona, connections }
        })
      )
      
      return NextResponse.json({ 
        success: true,
        personas: personasWithConnections 
      })
    }
    
    // Fetch connections for each persona
    const personasWithConnections = await Promise.all(
      personas.map(async (persona) => {
        const connections = await db.personaConnection.findMany({
          where: { personaId: persona.id },
          orderBy: { createdAt: 'asc' }
        })
        return { ...persona, connections }
      })
    )
    
    return NextResponse.json({ 
      success: true,
      personas: personasWithConnections 
    })
    
  } catch (error) {
    console.error('Fetch personas error:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}

// POST - Create a new persona
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionFromRequest(request)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    const body = await request.json()
    
    // Validate input
    const result = createPersonaSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }
    
    const data = result.data
    
    // Age-gating: Fetch user's DOB for age checks
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { dateOfBirth: true, purchasedSlots: true }
    })
    const userDob = dbUser?.dateOfBirth ?? null
    const isUserMinor = isMinor(userDob)
    
    // Age-gating: If user is a minor, force nsfwEnabled off and clear NSFW fields
    if (isUserMinor) {
      data.nsfwEnabled = false
      data.nsfwBodyType = null
      data.nsfwKinks = undefined
      data.nsfwContentWarnings = undefined
      data.nsfwOrientation = null
      data.nsfwRolePreference = null
    }
    
    // Check slot limits (25 free + purchased slots)
    const FREE_SLOTS = 25
    // dbUser already fetched above
    const userData = dbUser
    
    const existingPersonas = await db.persona.count({
      where: { userId: user.id }
    })
    
    const totalSlots = FREE_SLOTS + (userData?.purchasedSlots || 0)
    
    if (existingPersonas >= totalSlots) {
      return NextResponse.json(
        { 
          error: 'No available persona slots. Purchase more slots in the Chronos wallet.',
          code: 'NO_SLOTS',
          currentSlots: existingPersonas,
          totalSlots,
        },
        { status: 400 }
      )
    }
    
    // If this is the first persona, make it active by default
    const isActive = existingPersonas === 0
    
    // Generate a unique display ID (15-digit number like 123456789101112)
    const generateDisplayId = (): bigint => {
      const timestamp = Date.now() // 13 digits
      const random = Math.floor(Math.random() * 1000) // 3 digits
      return BigInt(`${timestamp}${random.toString().padStart(3, '0')}`)
    }
    
    // Create persona with all fields
    const persona = await db.persona.create({
      data: {
        userId: user.id,
        displayId: generateDisplayId(),
        originalCreatorId: user.id, // Track original creator
        name: data.name,
        avatarUrl: data.avatarUrl || null,
        description: data.description || null,
        archetype: data.archetype || null,
        gender: data.gender || null,
        pronouns: data.pronouns || null,
        age: data.age ?? null,
        tags: data.tags ? JSON.stringify(data.tags) : null,
        personalityDescription: data.personalityDescription || null,
        personalitySpectrums: data.personalitySpectrums ? JSON.stringify(data.personalitySpectrums) : null,
        bigFive: data.bigFive ? JSON.stringify(data.bigFive) : null,
        hexaco: data.hexaco ? JSON.stringify(data.hexaco) : null,
        strengths: data.strengths ? JSON.stringify(data.strengths) : null,
        flaws: data.flaws ? JSON.stringify(data.flaws) : null,
        values: data.values ? JSON.stringify(data.values) : null,
        fears: data.fears ? JSON.stringify(data.fears) : null,
        species: data.species || null,
        likes: data.likes ? JSON.stringify(data.likes) : null,
        dislikes: data.dislikes ? JSON.stringify(data.dislikes) : null,
        hobbies: data.hobbies ? JSON.stringify(data.hobbies) : null,
        skills: data.skills ? JSON.stringify(data.skills) : null,
        languages: data.languages ? JSON.stringify(data.languages) : null,
        habits: data.habits ? JSON.stringify(data.habits) : null,
        speechPatterns: data.speechPatterns ? JSON.stringify(data.speechPatterns) : null,
        backstory: data.backstory || null,
        appearance: data.appearance || null,
        mbtiType: data.mbtiType || null,
        themeEnabled: data.themeEnabled ?? false,
        rpStyle: data.rpStyle || null,
        rpPreferredGenders: data.rpPreferredGenders ? JSON.stringify(data.rpPreferredGenders) : null,
        rpGenres: data.rpGenres ? JSON.stringify(data.rpGenres) : null,
        rpLimits: data.rpLimits ? JSON.stringify(data.rpLimits) : null,
        rpThemes: data.rpThemes ? JSON.stringify(data.rpThemes) : null,
        rpExperienceLevel: data.rpExperienceLevel || null,
        rpResponseTime: data.rpResponseTime || null,
        // NSFW fields
        nsfwEnabled: data.nsfwEnabled ?? false,
        nsfwBodyType: data.nsfwBodyType || null,
        nsfwKinks: data.nsfwKinks ? JSON.stringify(data.nsfwKinks) : null,
        nsfwContentWarnings: data.nsfwContentWarnings ? JSON.stringify(data.nsfwContentWarnings) : null,
        nsfwOrientation: data.nsfwOrientation || null,
        nsfwRolePreference: data.nsfwRolePreference || null,
        isActive,
        isOnline: isActive,
      }
    })
    
    // Create connections if provided
    let connections: { id: string; characterName: string; relationshipType: string; specificRole: string | null; characterAge: number | null; description: string | null }[] = []
    if (data.connections && data.connections.length > 0) {
      const createdConnections = await Promise.all(
        data.connections.map(conn => 
          db.personaConnection.create({
            data: {
              personaId: persona.id,
              characterName: conn.characterName,
              relationshipType: conn.relationshipType,
              specificRole: conn.specificRole || null,
              characterAge: conn.characterAge ?? null,
              description: conn.description || null,
            }
          })
        )
      )
      connections = createdConnections
    }
    
    return NextResponse.json({ 
      success: true,
      persona: { ...persona, connections } 
    })
    
  } catch (error) {
    console.error('Create persona error:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
