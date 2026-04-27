import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { STORYLINE_CATEGORIES } from '@/lib/constants'
import { isMinor } from '@/lib/age-utils'

// GET - Browse public storylines with advanced search
export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    // Auto-seed the official community server if it doesn't exist
    try {
      const officialExists = await db.storyline.findFirst({
        where: { isOfficial: true },
        select: { id: true }
      })
      if (!officialExists) {
        // Seed in background - don't await to avoid blocking the response
        fetch(new URL('/api/storylines/seed-official', request.url)).catch(() => {})
      }
    } catch {
      // Don't block storylines fetching if seeding fails
    }
    
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search') || searchParams.get('q')
    const searchIn = searchParams.get('searchIn')?.split(',') || ['all']
    const tags = searchParams.get('tags')?.split(',').filter(Boolean) || []
    const sortBy = searchParams.get('sortBy') || 'newest'
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 100)
    
    // Age-gating: Fetch user's DOB to filter adult storylines for minors
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { dateOfBirth: true }
    })
    const userDob = dbUser?.dateOfBirth ?? null
    const isUserMinor = isMinor(userDob)
    
    const where: Record<string, unknown> = { isPublic: true }
    
    // Age-gating: Filter out adult storylines for minors
    if (isUserMinor) {
      where.isAdult = false
    }
    
    if (category && STORYLINE_CATEGORIES.includes(category as typeof STORYLINE_CATEGORIES[number])) {
      where.category = category
    }
    
    // Determine ordering based on sortBy
    let orderBy: Record<string, string> = { createdAt: 'desc' }
    if (sortBy === 'popular') {
      orderBy = { boostChronos: 'desc' }
    } else if (sortBy === 'members') {
      // Will sort after fetch since _count can't be used in orderBy directly
      orderBy = { createdAt: 'desc' }
    }
    
    let storylines = await db.storyline.findMany({
      where,
      include: {
        owner: {
          select: { id: true, username: true, avatarUrl: true }
        },
        _count: {
          select: { members: true }
        }
      },
      orderBy,
      take: limit
    })
    
    // Advanced search filtering
    if (search && search.length >= 2) {
      const searchLower = search.toLowerCase()
      const searchFields = searchIn.includes('all') 
        ? ['name', 'description', 'lore', 'tags', 'category']
        : searchIn
      
      storylines = storylines.filter(s => {
        const matches: boolean[] = []
        
        if (searchFields.includes('name')) {
          matches.push(s.name.toLowerCase().includes(searchLower))
        }
        if (searchFields.includes('description') && s.description) {
          matches.push(s.description.toLowerCase().includes(searchLower))
        }
        if (searchFields.includes('lore') && s.lore) {
          matches.push(s.lore.toLowerCase().includes(searchLower))
        }
        if (searchFields.includes('tags') && s.tags) {
          try {
            const storylineTags: string[] = JSON.parse(s.tags)
            matches.push(storylineTags.some(t => t.toLowerCase().includes(searchLower)))
          } catch { /* ignore */ }
        }
        if (searchFields.includes('category')) {
          matches.push(s.category.toLowerCase().includes(searchLower))
        }
        
        return matches.some(m => m)
      })
    }
    
    // Filter by specific tags
    if (tags.length > 0) {
      storylines = storylines.filter(s => {
        if (!s.tags) return false
        try {
          const storylineTags: string[] = JSON.parse(s.tags)
          return tags.some(tag => 
            storylineTags.some(t => t.toLowerCase() === tag.toLowerCase())
          )
        } catch {
          return false
        }
      })
    }
    
    const joinedIds = await db.storylineMember.findMany({
      where: { userId: user.id },
      select: { storylineId: true }
    })
    const joinedSet = new Set(joinedIds.map(j => j.storylineId))
    
    // Sort by member count if requested (can't do this in Prisma orderBy with _count)
    if (sortBy === 'members' || sortBy === 'popular') {
      storylines.sort((a, b) => {
        const scoreA = a._count.members + (a.boostChronos / 100)
        const scoreB = b._count.members + (b.boostChronos / 100)
        return scoreB - scoreA
      })
    }
    
    // Collect all tags and count usage for popular tags
    const tagUsage: Record<string, number> = {}
    storylines.forEach(s => {
      if (s.tags) {
        try {
          const storylineTags: string[] = JSON.parse(s.tags)
          storylineTags.forEach(t => {
            tagUsage[t] = (tagUsage[t] || 0) + 1
          })
        } catch { /* ignore */ }
      }
    })
    
    // Sort tags by usage (popular first)
    const popularTags = Object.entries(tagUsage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([tag, count]) => ({ tag, count }))
    
    const result = storylines.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      lore: s.lore,
      iconUrl: s.iconUrl,
      bannerUrl: s.bannerUrl,
      category: s.category,
      tags: s.tags ? JSON.parse(s.tags) : [],
      isPublic: s.isPublic,
      isOfficial: s.isOfficial,
      accentColor: s.accentColor,
      createdAt: s.createdAt,
      owner: s.owner,
      memberCount: s._count.members,
      boostChronos: s.boostChronos,
      boostTier: s.boostTier,
      isJoined: joinedSet.has(s.id)
    }))
    
    return NextResponse.json({ 
      success: true, 
      storylines: result,
      categories: STORYLINE_CATEGORIES,
      popularTags,
      searchMeta: {
        query: search,
        category,
        tags,
        searchIn,
        resultCount: result.length
      }
    })
    
  } catch (error) {
    console.error('Browse storylines error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// POST - Create a new storyline
export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    const body = await request.json()
    const { 
      name, 
      description, 
      lore,
      iconUrl, 
      bannerUrl, 
      category, 
      tags, // NEW: custom category tags
      isPublic,
      accentColor,
      welcomeMessage,
      requireApproval,
      memberCap
    } = body
    
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    
    if (!category || !STORYLINE_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: 'Valid category is required' }, { status: 400 })
    }
    
    // Validate and clean tags (no emojis, max 20 chars)
    let cleanedTags: string[] = []
    if (tags && Array.isArray(tags)) {
      cleanedTags = tags
        .map((t: string) => t.trim().toLowerCase())
        .filter((t: string) => t.length > 0 && t.length <= 20)
        .filter((t: string) => !/[\p{Emoji}]/u.test(t)) // Remove tags with emojis
        .slice(0, 10) // Max 10 tags
    }
    
    // Age-gating: Fetch user's DOB to prevent minors from creating adult storylines
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { dateOfBirth: true }
    })
    const userDob = dbUser?.dateOfBirth ?? null
    const isUserMinor = isMinor(userDob)
    
    // Age-gating: If user is a minor, force isAdult to false
    const isAdult = isUserMinor ? false : (body.isAdult || false)
    
    // Create storyline
    const storyline = await db.storyline.create({
      data: {
        ownerId: user.id,
        name: name.trim(),
        description: description?.trim() || null,
        lore: lore?.trim() || null,
        iconUrl: iconUrl || null,
        bannerUrl: bannerUrl || null,
        category,
        tags: cleanedTags.length > 0 ? JSON.stringify(cleanedTags) : null,
        isPublic: isPublic !== false,
        isAdult,
        accentColor: accentColor || '#8b5cf6',
        welcomeMessage: welcomeMessage?.trim() || null,
        requireApproval: requireApproval || false,
        memberCap: memberCap || null
      }
    })
    
    // Create default "Owner" role
    const ownerRole = await db.storylineRole.create({
      data: {
        storylineId: storyline.id,
        name: 'Owner',
        color: '#fbbf24',
        position: 100,
        canManageChannels: true,
        canManageRoles: true,
        canKickMembers: true,
        canBanMembers: true,
        canManageMessages: true,
        canInvite: true,
        canChangeSettings: true,
        isAdmin: true
      }
    })
    
    // Create default "Admin" role
    await db.storylineRole.create({
      data: {
        storylineId: storyline.id,
        name: 'Admin',
        color: '#ef4444',
        position: 50,
        canManageChannels: true,
        canManageRoles: false,
        canKickMembers: true,
        canBanMembers: true,
        canManageMessages: true,
        canInvite: true,
        canChangeSettings: false,
        isAdmin: true
      }
    })
    
    // Create default "Member" role
    await db.storylineRole.create({
      data: {
        storylineId: storyline.id,
        name: 'Member',
        color: '#8b5cf6',
        position: 0,
        canManageChannels: false,
        canManageRoles: false,
        canKickMembers: false,
        canBanMembers: false,
        canManageMessages: false,
        canInvite: true,
        canChangeSettings: false,
        isAdmin: false
      }
    })
    
    // Create default categories
    const generalCategory = await db.storylineCategory.create({
      data: {
        storylineId: storyline.id,
        name: 'Story',
        position: 0
      }
    })
    
    const oocCategory = await db.storylineCategory.create({
      data: {
        storylineId: storyline.id,
        name: 'Out of Character',
        position: 1
      }
    })
    
    // Create default channels
    await db.storylineChannel.createMany({
      data: [
        { 
          storylineId: storyline.id, 
          categoryId: generalCategory.id,
          name: 'general', 
          type: 'text', 
          position: 0,
          topic: 'General discussion'
        },
        { 
          storylineId: storyline.id, 
          categoryId: oocCategory.id,
          name: 'ooc', 
          type: 'text', 
          position: 0,
          topic: 'Out-of-character chat'
        }
      ]
    })
    
    // Add owner as member
    await db.storylineMember.create({
      data: {
        storylineId: storyline.id,
        userId: user.id,
        role: 'owner',
        roleId: ownerRole.id
      }
    })
    
    return NextResponse.json({ 
      success: true, 
      storyline,
      message: 'Storyline created successfully' 
    })
    
  } catch (error) {
    console.error('Create storyline error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}