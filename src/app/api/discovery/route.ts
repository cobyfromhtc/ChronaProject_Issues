import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { db } from '@/lib/db'
import { BLORP_USER_ID } from '@/lib/blorp'
import { isMinor, canInteract } from '@/lib/age-utils'

// MBTI to approximate HEXACO/Big Five mappings for search sync
const MBTI_TO_TRAITS: Record<string, { hexaco: string[]; bigFive: string[] }> = {
  'INTJ': { hexaco: ['analytical', 'strategic', 'independent'], bigFive: ['high openness', 'low extraversion', 'high conscientiousness'] },
  'INTP': { hexaco: ['analytical', 'curious', 'logical'], bigFive: ['high openness', 'low extraversion', 'low conscientiousness'] },
  'ENTJ': { hexaco: ['assertive', 'strategic', 'leader'], bigFive: ['high extraversion', 'high conscientiousness', 'low agreeableness'] },
  'ENTP': { hexaco: ['innovative', 'debater', 'quick-thinking'], bigFive: ['high openness', 'high extraversion', 'low conscientiousness'] },
  'INFJ': { hexaco: ['insightful', 'empathetic', 'principled'], bigFive: ['high openness', 'high agreeableness', 'low extraversion'] },
  'INFP': { hexaco: ['creative', 'empathetic', 'idealistic'], bigFive: ['high openness', 'high agreeableness', 'low extraversion'] },
  'ENFJ': { hexaco: ['charismatic', 'empathetic', 'leader'], bigFive: ['high extraversion', 'high agreeableness', 'high conscientiousness'] },
  'ENFP': { hexaco: ['enthusiastic', 'creative', 'empathetic'], bigFive: ['high openness', 'high extraversion', 'high agreeableness'] },
  'ISTJ': { hexaco: ['reliable', 'organized', 'practical'], bigFive: ['high conscientiousness', 'low openness', 'low extraversion'] },
  'ISFJ': { hexaco: ['supportive', 'reliable', 'empathetic'], bigFive: ['high agreeableness', 'high conscientiousness', 'low extraversion'] },
  'ESTJ': { hexaco: ['organized', 'assertive', 'practical'], bigFive: ['high extraversion', 'high conscientiousness', 'low openness'] },
  'ESFJ': { hexaco: ['supportive', 'social', 'organized'], bigFive: ['high extraversion', 'high agreeableness', 'high conscientiousness'] },
  'ISTP': { hexaco: ['practical', 'analytical', 'independent'], bigFive: ['low extraversion', 'low agreeableness', 'low conscientiousness'] },
  'ISFP': { hexaco: ['artistic', 'sensitive', 'flexible'], bigFive: ['high openness', 'high agreeableness', 'low extraversion'] },
  'ESTP': { hexaco: ['action-oriented', 'practical', 'bold'], bigFive: ['high extraversion', 'low conscientiousness', 'low agreeableness'] },
  'ESFP': { hexaco: ['entertaining', 'social', 'spontaneous'], bigFive: ['high extraversion', 'high agreeableness', 'low conscientiousness'] },
}

// Helper: parse a persona row into the frontend shape (with age gating)
function parsePersonaRow(p: any, userDob: Date | null, isUserMinor: boolean) {
  // Age bracket check
  const ownerDob = p.user?.dateOfBirth ?? null
  if (!canInteract(userDob, ownerDob)) return null
  // NSFW check for minors
  if (isUserMinor && p.nsfwEnabled) return null

  return {
    id: p.id,
    name: p.name,
    avatarUrl: p.avatarUrl,
    bannerUrl: p.bannerUrl,
    bio: p.description,
    username: p.user?.username || 'Unknown',
    userId: p.userId,
    isOnline: p.isOnline,
    archetype: p.archetype,
    gender: p.gender,
    age: p.age,
    tags: p.tags ? JSON.parse(p.tags) : [],
    personalityDescription: p.personalityDescription,
    personalitySpectrums: p.personalitySpectrums ? JSON.parse(p.personalitySpectrums) : null,
    bigFive: p.bigFive ? JSON.parse(p.bigFive) : null,
    hexaco: p.hexaco ? JSON.parse(p.hexaco) : null,
    strengths: p.strengths ? JSON.parse(p.strengths) : [],
    flaws: p.flaws ? JSON.parse(p.flaws) : [],
    values: p.values ? JSON.parse(p.values) : [],
    fears: p.fears ? JSON.parse(p.fears) : [],
    species: p.species,
    likes: p.likes ? JSON.parse(p.likes) : [],
    dislikes: p.dislikes ? JSON.parse(p.dislikes) : [],
    hobbies: p.hobbies ? JSON.parse(p.hobbies) : [],
    skills: p.skills ? JSON.parse(p.skills) : [],
    languages: p.languages ? JSON.parse(p.languages) : [],
    habits: p.habits ? JSON.parse(p.habits) : [],
    speechPatterns: p.speechPatterns ? JSON.parse(p.speechPatterns) : [],
    backstory: p.backstory,
    appearance: p.appearance,
    mbtiType: p.mbtiType,
    rpStyle: p.rpStyle,
    connections: p.connections || [],
  }
}

// GET - Fetch personas for discovery with advanced search
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionFromRequest(request)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    const { searchParams } = new URL(request.url)
    const section = searchParams.get('section')
    
    // ── Section-based queries ──────────────────────────────────
    if (section === 'continue-chatting') {
      return await handleContinueChatting(user)
    }
    if (section === 'for-you') {
      return await handleForYou(user)
    }
    if (section === 'relatable') {
      return await handleRelatable(user)
    }
    if (section === 'mutual-friends') {
      return await handleMutualFriends(user)
    }
    
    // ── Original discovery endpoint (no section param) ─────────
    const filter = searchParams.get('filter') || 'new'
    const showOffline = searchParams.get('showOffline') === 'true'
    
    // Advanced search parameters
    const searchQuery = searchParams.get('q') || ''
    const searchIn = searchParams.get('searchIn')?.split(',') || ['all'] // all, name, tags, backstory, attributes
    const mbtiTypes = searchParams.get('mbti')?.split(',').filter(Boolean) || []
    const gender = searchParams.get('gender')?.split(',').filter(Boolean) || []
    const ageMin = searchParams.get('ageMin') ? parseInt(searchParams.get('ageMin')!) : null
    const ageMax = searchParams.get('ageMax') ? parseInt(searchParams.get('ageMax')!) : null
    const species = searchParams.get('species')?.split(',').filter(Boolean) || []
    const archetypes = searchParams.get('archetype')?.split(',').filter(Boolean) || []
    const tagsFilter = searchParams.get('tags')?.split(',').filter(Boolean) || []
    const attributesFilter = searchParams.get('attributes')?.split(',').filter(Boolean) || [] // strengths, flaws, values, fears
    const likesFilter = searchParams.get('likes')?.split(',').filter(Boolean) || []
    const hobbiesFilter = searchParams.get('hobbies')?.split(',').filter(Boolean) || []
    const skillsFilter = searchParams.get('skills')?.split(',').filter(Boolean) || []
    const syncPersonality = searchParams.get('syncPersonality') === 'true' // Sync MBTI with HEXACO/Big Five
    
    // Age-gating: Fetch user's DOB for age checks
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { dateOfBirth: true }
    })
    const userDob = dbUser?.dateOfBirth ?? null
    const isUserMinor = isMinor(userDob)
    
    // Get current user's active persona to exclude from results
    const currentUserPersonas = await db.persona.findMany({
      where: { userId: user.id },
      select: { id: true }
    })
    const currentUserPersonaIds = currentUserPersonas.map(p => p.id)
    
    // Define the select object for all persona fields
    const personaSelect = {
      id: true,
      userId: true,
      name: true,
      avatarUrl: true,
      bannerUrl: true,
      description: true,
      archetype: true,
      gender: true,
      age: true,
      tags: true,
      personalityDescription: true,
      personalitySpectrums: true,
      bigFive: true,
      hexaco: true,
      strengths: true,
      flaws: true,
      values: true,
      fears: true,
      species: true,
      likes: true,
      dislikes: true,
      hobbies: true,
      skills: true,
      languages: true,
      habits: true,
      speechPatterns: true,
      backstory: true,
      appearance: true,
      mbtiType: true,
      rpStyle: true,
      isOnline: true,
      nsfwEnabled: true,
      user: {
        select: { username: true, dateOfBirth: true }
      },
      connections: {
        select: {
          id: true,
          characterName: true,
          relationshipType: true,
          specificRole: true,
          characterAge: true,
          description: true
        }
      }
    }
    
    let personas: any[] = []
    
    // Base condition: exclude current user's personas AND Blorp's personas
    const baseCondition: any = {
      id: { notIn: currentUserPersonaIds },
      userId: { not: BLORP_USER_ID }, // Exclude Blorp from discovery
    }
    
    // Only filter by online status if showOffline is false
    if (!showOffline) {
      baseCondition.isOnline = true
    }
    
    // Build search conditions
    const buildSearchConditions = () => {
      const conditions: any[] = []
      
      // General search query
      if (searchQuery) {
        const searchFields = searchIn.includes('all') 
          ? ['name', 'tags', 'backstory', 'description', 'strengths', 'flaws', 'values', 'fears', 'likes', 'hobbies', 'skills', 'personalityDescription', 'username']
          : searchIn
        
        const searchCondition = searchFields.map(field => {
          switch (field) {
            case 'name':
              return { name: { contains: searchQuery } }
            case 'tags':
              return { tags: { contains: searchQuery } }
            case 'backstory':
              return { backstory: { contains: searchQuery } }
            case 'description':
              return { description: { contains: searchQuery } }
            case 'personalityDescription':
              return { personalityDescription: { contains: searchQuery } }
            case 'strengths':
              return { strengths: { contains: searchQuery } }
            case 'flaws':
              return { flaws: { contains: searchQuery } }
            case 'values':
              return { values: { contains: searchQuery } }
            case 'fears':
              return { fears: { contains: searchQuery } }
            case 'likes':
              return { likes: { contains: searchQuery } }
            case 'hobbies':
              return { hobbies: { contains: searchQuery } }
            case 'skills':
              return { skills: { contains: searchQuery } }
            case 'appearance':
              return { appearance: { contains: searchQuery } }
            case 'username':
              // Search by owner's username - need to join with user table
              return { user: { username: { contains: searchQuery } } }
            default:
              return null
          }
        }).filter(Boolean)
        
        if (searchCondition.length > 0) {
          conditions.push({ OR: searchCondition })
        }
      }
      
      // MBTI filter with personality sync
      if (mbtiTypes.length > 0) {
        const mbtiCondition: any = {
          OR: mbtiTypes.map(type => ({ mbtiType: type }))
        }
        
        // If sync is enabled, also search for matching personality traits in HEXACO/Big Five descriptions
        if (syncPersonality) {
          const traitKeywords = new Set<string>()
          mbtiTypes.forEach(type => {
            const traits = MBTI_TO_TRAITS[type]
            if (traits) {
              traits.hexaco.forEach(t => traitKeywords.add(t))
              traits.bigFive.forEach(t => traitKeywords.add(t))
            }
          })
          
          // Add personality description search for matching traits
          if (traitKeywords.size > 0) {
            const personalitySearch = Array.from(traitKeywords).map(keyword => ({
              personalityDescription: { contains: keyword }
            }))
            mbtiCondition.OR.push(...personalitySearch)
          }
        }
        
        conditions.push(mbtiCondition)
      }
      
      // Gender filter
      if (gender.length > 0) {
        conditions.push({
          OR: gender.map(g => ({ gender: { equals: g } }))
        })
      }
      
      // Age range filter
      if (ageMin !== null || ageMax !== null) {
        const ageCondition: any = {}
        if (ageMin !== null) ageCondition.gte = ageMin
        if (ageMax !== null) ageCondition.lte = ageMax
        conditions.push({ age: ageCondition })
      }
      
      // Species filter
      if (species.length > 0) {
        conditions.push({
          OR: species.map(s => ({ species: { contains: s } }))
        })
      }
      
      // Archetype filter
      if (archetypes.length > 0) {
        conditions.push({
          OR: archetypes.map(a => ({ archetype: { equals: a } }))
        })
      }
      
      // Tags filter (must contain ANY of the specified tags)
      if (tagsFilter.length > 0) {
        conditions.push({
          OR: tagsFilter.map(tag => ({ tags: { contains: tag } }))
        })
      }
      
      // Attributes filter (strengths, flaws, values, fears)
      if (attributesFilter.length > 0) {
        conditions.push({
          OR: [
            ...attributesFilter.map(attr => ({ strengths: { contains: attr } })),
            ...attributesFilter.map(attr => ({ flaws: { contains: attr } })),
            ...attributesFilter.map(attr => ({ values: { contains: attr } })),
            ...attributesFilter.map(attr => ({ fears: { contains: attr } }))
          ]
        })
      }
      
      // Likes filter
      if (likesFilter.length > 0) {
        conditions.push({
          OR: likesFilter.map(like => ({ likes: { contains: like } }))
        })
      }
      
      // Hobbies filter
      if (hobbiesFilter.length > 0) {
        conditions.push({
          OR: hobbiesFilter.map(hobby => ({ hobbies: { contains: hobby } }))
        })
      }
      
      // Skills filter
      if (skillsFilter.length > 0) {
        conditions.push({
          OR: skillsFilter.map(skill => ({ skills: { contains: skill } }))
        })
      }
      
      return conditions
    }
    
    const searchConditions = buildSearchConditions()
    
    // Combine base condition with search conditions
    const whereCondition = searchConditions.length > 0
      ? { ...baseCondition, AND: searchConditions }
      : baseCondition
    
    if (filter === 'following') {
      // Get personas of users that current user follows
      const follows = await db.follow.findMany({
        where: { followerId: user.id },
        select: { followingId: true }
      })
      const followingIds = follows.map(f => f.followingId)
      
      personas = await db.persona.findMany({
        where: {
          ...whereCondition,
          userId: { in: followingIds },
        },
        select: personaSelect,
        orderBy: { updatedAt: 'desc' },
        take: 50,
      })
    } else if (filter === 'followers') {
      // Get personas of users that follow current user
      const followers = await db.follow.findMany({
        where: { followingId: user.id },
        select: { followerId: true }
      })
      const followerIds = followers.map(f => f.followerId)
      
      personas = await db.persona.findMany({
        where: {
          ...whereCondition,
          userId: { in: followerIds },
        },
        select: personaSelect,
        orderBy: { updatedAt: 'desc' },
        take: 50,
      })
    } else {
      // 'new' - Get all personas sorted by newest
      personas = await db.persona.findMany({
        where: whereCondition,
        select: personaSelect,
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
    }
    
    // Transform data for frontend - parse JSON fields (using shared helper)
    const result = personas.map(p => parsePersonaRow(p, userDob, isUserMinor)).filter(Boolean)
    
    return NextResponse.json({ 
      success: true,
      personas: result,
      searchMeta: {
        query: searchQuery,
        filters: {
          mbti: mbtiTypes,
          gender,
          ageRange: { min: ageMin, max: ageMax },
          species,
          archetypes,
          tags: tagsFilter,
          attributes: attributesFilter,
          likes: likesFilter,
          hobbies: hobbiesFilter,
          skills: skillsFilter,
          syncPersonality
        },
        resultCount: result.length
      }
    })
    
  } catch (error) {
    console.error('Discovery error:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}

// ─── Section: Continue Chatting ──────────────────────────────
async function handleContinueChatting(user: any) {
  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { dateOfBirth: true }
  })
  const userDob = dbUser?.dateOfBirth ?? null
  const isUserMinor = isMinor(userDob)

  const userPersonas = await db.persona.findMany({
    where: { userId: user.id },
    select: { id: true }
  })
  const personaIds = userPersonas.map(p => p.id)

  const conversations = await db.conversation.findMany({
    where: {
      OR: [
        { personaAId: { in: personaIds } },
        { personaBId: { in: personaIds } },
      ]
    },
    include: {
      personaA: {
        include: { user: { select: { id: true, username: true, dateOfBirth: true } } }
      },
      personaB: {
        include: { user: { select: { id: true, username: true, dateOfBirth: true } } }
      },
      messages: {
        take: 1,
        orderBy: { createdAt: 'desc' }
      }
    },
    orderBy: { lastMessageAt: 'desc' },
    take: 10,
  })

  const result = conversations
    .filter(conv => {
      const isA = personaIds.includes(conv.personaAId)
      const isB = personaIds.includes(conv.personaBId)
      if (isA && isB) return false // self-conversation
      const otherPersona = isA ? conv.personaB : conv.personaA
      const otherDob = otherPersona.user?.dateOfBirth ?? null
      return canInteract(userDob, otherDob)
    })
    .map(conv => {
      const isA = personaIds.includes(conv.personaAId)
      const otherPersona = isA ? conv.personaB : conv.personaA
      const lastMsg = conv.messages[0]
      return {
        conversationId: conv.id,
        persona: {
          id: otherPersona.id,
          name: otherPersona.name,
          avatarUrl: otherPersona.avatarUrl,
          isOnline: otherPersona.isOnline,
          username: otherPersona.user?.username || 'Unknown',
        },
        lastMessage: lastMsg ? {
          content: lastMsg.content,
          createdAt: lastMsg.createdAt,
          senderId: lastMsg.senderId,
        } : null,
        lastMessageAt: conv.lastMessageAt,
      }
    })

  return NextResponse.json({ success: true, conversations: result })
}

// ─── Section: For You ────────────────────────────────────────
async function handleForYou(user: any) {
  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { dateOfBirth: true }
  })
  const userDob = dbUser?.dateOfBirth ?? null
  const isUserMinor = isMinor(userDob)

  // Get user's active persona
  const activePersona = await db.persona.findFirst({
    where: { userId: user.id, isActive: true },
    select: {
      id: true, tags: true, archetype: true, rpGenres: true, mbtiType: true,
    }
  })

  if (!activePersona) {
    return NextResponse.json({ success: true, personas: [] })
  }

  const myTags: string[] = activePersona.tags ? JSON.parse(activePersona.tags) : []
  const myArchetype = activePersona.archetype
  const myGenres: string[] = activePersona.rpGenres ? JSON.parse(activePersona.rpGenres) : []
  const myMbti = activePersona.mbtiType

  // Get user's own persona IDs to exclude
  const userPersonas = await db.persona.findMany({
    where: { userId: user.id },
    select: { id: true }
  })
  const excludeIds = userPersonas.map(p => p.id)

  // Get storyline member IDs (other members in same storylines)
  const storylineMemberships = await db.storylineMember.findMany({
    where: { userId: user.id },
    select: { storylineId: true }
  })
  const storylineIds = storylineMemberships.map(m => m.storylineId)

  let fellowMemberUserIds: string[] = []
  if (storylineIds.length > 0) {
    const fellowMembers = await db.storylineMember.findMany({
      where: {
        storylineId: { in: storylineIds },
        userId: { not: user.id },
      },
      select: { userId: true },
      take: 100,
    })
    fellowMemberUserIds = [...new Set(fellowMembers.map(m => m.userId))]
  }

  // Fetch candidate personas (not user's own, not Blorp)
  const candidates = await db.persona.findMany({
    where: {
      id: { notIn: excludeIds },
      userId: { not: BLORP_USER_ID },
    },
    select: {
      id: true, userId: true, name: true, avatarUrl: true, bannerUrl: true,
      description: true, archetype: true, gender: true, age: true, tags: true,
      personalityDescription: true, personalitySpectrums: true, bigFive: true,
      hexaco: true, strengths: true, flaws: true, values: true, fears: true,
      species: true, likes: true, dislikes: true, hobbies: true, skills: true,
      languages: true, habits: true, speechPatterns: true, backstory: true,
      appearance: true, mbtiType: true, rpStyle: true, rpGenres: true,
      isOnline: true, nsfwEnabled: true,
      user: { select: { username: true, dateOfBirth: true } },
      connections: {
        select: { id: true, characterName: true, relationshipType: true, specificRole: true, characterAge: true, description: true }
      }
    },
    take: 200,
  })

  // Score each candidate
  const scored = candidates
    .map(p => {
      const parsed = parsePersonaRow(p, userDob, isUserMinor)
      if (!parsed) return null

      let score = 0
      const matchReasons: string[] = []

      // Same archetype
      if (myArchetype && p.archetype === myArchetype) {
        score += 5
        matchReasons.push('Same archetype')
      }

      // Shared tags
      const theirTags: string[] = p.tags ? JSON.parse(p.tags) : []
      const sharedTags = myTags.filter(t => theirTags.includes(t))
      if (sharedTags.length >= 2) {
        score += sharedTags.length * 2
        matchReasons.push(`${sharedTags.length} shared tags`)
      }

      // Shared RP genres
      const theirGenres: string[] = p.rpGenres ? JSON.parse(p.rpGenres) : []
      const sharedGenres = myGenres.filter(g => theirGenres.includes(g))
      if (sharedGenres.length >= 1) {
        score += sharedGenres.length
        matchReasons.push(`${sharedGenres.length} shared genres`)
      }

      // Same MBTI
      if (myMbti && p.mbtiType === myMbti) {
        score += 3
        matchReasons.push('Same MBTI')
      }

      // Fellow storyline member
      if (fellowMemberUserIds.includes(p.userId)) {
        score += 4
        matchReasons.push('In your storylines')
      }

      return { persona: parsed, score, matchReasons }
    })
    .filter(item => item !== null && item.score > 0)
    .sort((a, b) => b!.score - a!.score)
    .slice(0, 10)

  return NextResponse.json({
    success: true,
    personas: scored.map(s => ({ ...s!.persona, matchReasons: s!.matchReasons })),
  })
}

// ─── Section: Relatable Personas ─────────────────────────────
async function handleRelatable(user: any) {
  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { dateOfBirth: true }
  })
  const userDob = dbUser?.dateOfBirth ?? null
  const isUserMinor = isMinor(userDob)

  const activePersona = await db.persona.findFirst({
    where: { userId: user.id, isActive: true },
    select: {
      id: true, tags: true, archetype: true, personalitySpectrums: true,
      bigFive: true, hexaco: true, mbtiType: true,
    }
  })

  if (!activePersona) {
    return NextResponse.json({ success: true, personas: [] })
  }

  const myTags: string[] = activePersona.tags ? JSON.parse(activePersona.tags) : []
  const myArchetype = activePersona.archetype
  const mySpectrums = activePersona.personalitySpectrums ? JSON.parse(activePersona.personalitySpectrums) : null
  const myBigFive = activePersona.bigFive ? JSON.parse(activePersona.bigFive) : null
  const myMbti = activePersona.mbtiType

  const userPersonas = await db.persona.findMany({
    where: { userId: user.id },
    select: { id: true }
  })
  const excludeIds = userPersonas.map(p => p.id)

  const candidates = await db.persona.findMany({
    where: {
      id: { notIn: excludeIds },
      userId: { not: BLORP_USER_ID },
    },
    select: {
      id: true, userId: true, name: true, avatarUrl: true, bannerUrl: true,
      description: true, archetype: true, gender: true, age: true, tags: true,
      personalityDescription: true, personalitySpectrums: true, bigFive: true,
      hexaco: true, strengths: true, flaws: true, values: true, fears: true,
      species: true, likes: true, dislikes: true, hobbies: true, skills: true,
      languages: true, habits: true, speechPatterns: true, backstory: true,
      appearance: true, mbtiType: true, rpStyle: true,
      isOnline: true, nsfwEnabled: true,
      user: { select: { username: true, dateOfBirth: true } },
      connections: {
        select: { id: true, characterName: true, relationshipType: true, specificRole: true, characterAge: true, description: true }
      }
    },
    take: 200,
  })

  // Score based on personality similarity
  const scored = candidates
    .map(p => {
      const parsed = parsePersonaRow(p, userDob, isUserMinor)
      if (!parsed) return null

      let score = 0
      const matchReasons: string[] = []

      // Personality spectrums similarity (within 30% on each axis)
      const theirSpectrums = p.personalitySpectrums ? JSON.parse(p.personalitySpectrums) : null
      if (mySpectrums && theirSpectrums) {
        let closeAxes = 0
        const axes = ['introvertExtrovert', 'intuitiveObservant', 'thinkingFeeling', 'judgingProspecting', 'assertiveTurbulent']
        for (const axis of axes) {
          const myVal = mySpectrums[axis]
          const theirVal = theirSpectrums[axis]
          if (myVal != null && theirVal != null) {
            const diff = Math.abs(myVal - theirVal)
            if (diff <= 30) closeAxes++
          }
        }
        if (closeAxes >= 3) {
          score += closeAxes * 2
          matchReasons.push(`${closeAxes}/5 similar traits`)
        }
      }

      // Big Five similarity
      const theirBigFive = p.bigFive ? JSON.parse(p.bigFive) : null
      if (myBigFive && theirBigFive) {
        let closeAxes = 0
        const axes = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism']
        for (const axis of axes) {
          const myVal = myBigFive[axis]
          const theirVal = theirBigFive[axis]
          if (myVal != null && theirVal != null) {
            const diff = Math.abs(myVal - theirVal)
            if (diff <= 30) closeAxes++
          }
        }
        if (closeAxes >= 3) {
          score += closeAxes
          matchReasons.push(`Big Five: ${closeAxes}/5 close`)
        }
      }

      // Same archetype + at least 1 shared tag
      const theirTags: string[] = p.tags ? JSON.parse(p.tags) : []
      const sharedTags = myTags.filter(t => theirTags.includes(t))
      if (myArchetype && p.archetype === myArchetype && sharedTags.length >= 1) {
        score += 6
        matchReasons.push('Same archetype + shared tags')
      } else if (sharedTags.length >= 3) {
        score += 4
        matchReasons.push(`${sharedTags.length} shared tags`)
      }

      // Same MBTI type
      if (myMbti && p.mbtiType === myMbti) {
        score += 3
        matchReasons.push('Same MBTI')
      }

      return { persona: parsed, score, matchReasons }
    })
    .filter(item => item !== null && item.score > 0)
    .sort((a, b) => b!.score - a!.score)
    .slice(0, 10)

  return NextResponse.json({
    success: true,
    personas: scored.map(s => ({ ...s!.persona, matchReasons: s!.matchReasons })),
  })
}

// ─── Section: Mutual Friends ─────────────────────────────────
async function handleMutualFriends(user: any) {
  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { dateOfBirth: true }
  })
  const userDob = dbUser?.dateOfBirth ?? null
  const isUserMinor = isMinor(userDob)

  // Get user's direct friends
  const friendships = await db.friendship.findMany({
    where: { userId: user.id },
    select: { friendId: true }
  })
  const directFriendIds = friendships.map(f => f.friendId)

  if (directFriendIds.length === 0) {
    return NextResponse.json({ success: true, personas: [] })
  }

  // Get friends of friends (excluding the current user and direct friends)
  const fofFriendships = await db.friendship.findMany({
    where: {
      userId: { in: directFriendIds },
      friendId: { notIn: [...directFriendIds, user.id] },
    },
    select: { userId: true, friendId: true }
  })

  // Count mutual friends per friend-of-friend
  const mutualCount: Record<string, { count: number; mutualFriendIds: string[] }> = {}
  for (const f of fofFriendships) {
    const fofId = f.friendId
    const mutualWith = f.userId
    if (!mutualCount[fofId]) {
      mutualCount[fofId] = { count: 0, mutualFriendIds: [] }
    }
    if (!mutualCount[fofId].mutualFriendIds.includes(mutualWith)) {
      mutualCount[fofId].count++
      mutualCount[fofId].mutualFriendIds.push(mutualWith)
    }
  }

  // Sort by mutual count, take top 20 friend-of-friend user IDs
  const sortedFof = Object.entries(mutualCount)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20)

  if (sortedFof.length === 0) {
    return NextResponse.json({ success: true, personas: [] })
  }

  const fofUserIds = sortedFof.map(([id]) => id)

  // Get their active personas
  const personas = await db.persona.findMany({
    where: {
      userId: { in: fofUserIds, not: BLORP_USER_ID },
    },
    select: {
      id: true, userId: true, name: true, avatarUrl: true, bannerUrl: true,
      description: true, archetype: true, gender: true, age: true, tags: true,
      personalityDescription: true, personalitySpectrums: true, bigFive: true,
      hexaco: true, strengths: true, flaws: true, values: true, fears: true,
      species: true, likes: true, dislikes: true, hobbies: true, skills: true,
      languages: true, habits: true, speechPatterns: true, backstory: true,
      appearance: true, mbtiType: true, rpStyle: true,
      isOnline: true, nsfwEnabled: true,
      user: { select: { username: true, dateOfBirth: true } },
      connections: {
        select: { id: true, characterName: true, relationshipType: true, specificRole: true, characterAge: true, description: true }
      }
    },
  })

  // For users with multiple personas, pick the first (most recently updated)
  const seenUsers = new Set<string>()
  const uniquePersonas = personas.filter(p => {
    if (seenUsers.has(p.userId)) return false
    seenUsers.add(p.userId)
    return true
  })

  // Attach mutual friend count
  const result = uniquePersonas
    .map(p => {
      const parsed = parsePersonaRow(p, userDob, isUserMinor)
      if (!parsed) return null
      const info = mutualCount[p.userId]
      return {
        ...parsed,
        mutualFriendCount: info?.count || 0,
      }
    })
    .filter(Boolean)
    .sort((a, b) => b!.mutualFriendCount - a!.mutualFriendCount)
    .slice(0, 10)

  return NextResponse.json({
    success: true,
    personas: result,
  })
}
