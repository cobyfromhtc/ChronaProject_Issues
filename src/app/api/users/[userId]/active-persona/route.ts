import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// GET - Get user's active persona for profile display
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const user = await getSession()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    const { userId } = await params
    
    // Find the user's active persona
    const activePersona = await db.persona.findFirst({
      where: { 
        userId,
        isActive: true 
      },
      include: {
        user: {
          select: { username: true }
        },
        connections: true
      }
    })
    
    if (!activePersona) {
      // Fallback to any persona
      const anyPersona = await db.persona.findFirst({
        where: { userId },
        include: {
          user: {
            select: { username: true }
          },
          connections: true
        }
      })
      
      if (!anyPersona) {
        return NextResponse.json({ persona: null }, { status: 404 })
      }
      
      return NextResponse.json({
        persona: {
          id: anyPersona.id,
          name: anyPersona.name,
          avatarUrl: anyPersona.avatarUrl,
          bio: anyPersona.description,
          username: anyPersona.user.username,
          userId: anyPersona.userId,
          isOnline: anyPersona.isOnline,
          archetype: anyPersona.archetype,
          gender: anyPersona.gender,
          age: anyPersona.age,
          tags: anyPersona.tags ? JSON.parse(anyPersona.tags) : [],
          personalityDescription: anyPersona.personalityDescription,
          personalitySpectrums: anyPersona.personalitySpectrums ? JSON.parse(anyPersona.personalitySpectrums) : null,
          bigFive: anyPersona.bigFive ? JSON.parse(anyPersona.bigFive) : null,
          strengths: anyPersona.strengths ? JSON.parse(anyPersona.strengths) : [],
          flaws: anyPersona.flaws ? JSON.parse(anyPersona.flaws) : [],
          values: anyPersona.values ? JSON.parse(anyPersona.values) : [],
          fears: anyPersona.fears ? JSON.parse(anyPersona.fears) : [],
          species: anyPersona.species,
          likes: anyPersona.likes ? JSON.parse(anyPersona.likes) : [],
          dislikes: anyPersona.dislikes ? JSON.parse(anyPersona.dislikes) : [],
          hobbies: anyPersona.hobbies ? JSON.parse(anyPersona.hobbies) : [],
          skills: anyPersona.skills ? JSON.parse(anyPersona.skills) : [],
          languages: anyPersona.languages ? JSON.parse(anyPersona.languages) : [],
          habits: anyPersona.habits ? JSON.parse(anyPersona.habits) : [],
          speechPatterns: anyPersona.speechPatterns ? JSON.parse(anyPersona.speechPatterns) : [],
          backstory: anyPersona.backstory,
          appearance: anyPersona.appearance,
          mbtiType: anyPersona.mbtiType,
          connections: anyPersona.connections
        }
      })
    }
    
    return NextResponse.json({
      persona: {
        id: activePersona.id,
        name: activePersona.name,
        avatarUrl: activePersona.avatarUrl,
        bio: activePersona.description,
        username: activePersona.user.username,
        userId: activePersona.userId,
        isOnline: activePersona.isOnline,
        archetype: activePersona.archetype,
        gender: activePersona.gender,
        age: activePersona.age,
        tags: activePersona.tags ? JSON.parse(activePersona.tags) : [],
        personalityDescription: activePersona.personalityDescription,
        personalitySpectrums: activePersona.personalitySpectrums ? JSON.parse(activePersona.personalitySpectrums) : null,
        bigFive: activePersona.bigFive ? JSON.parse(activePersona.bigFive) : null,
        strengths: activePersona.strengths ? JSON.parse(activePersona.strengths) : [],
        flaws: activePersona.flaws ? JSON.parse(activePersona.flaws) : [],
        values: activePersona.values ? JSON.parse(activePersona.values) : [],
        fears: activePersona.fears ? JSON.parse(activePersona.fears) : [],
        species: activePersona.species,
        likes: activePersona.likes ? JSON.parse(activePersona.likes) : [],
        dislikes: activePersona.dislikes ? JSON.parse(activePersona.dislikes) : [],
        hobbies: activePersona.hobbies ? JSON.parse(activePersona.hobbies) : [],
        skills: activePersona.skills ? JSON.parse(activePersona.skills) : [],
        languages: activePersona.languages ? JSON.parse(activePersona.languages) : [],
        habits: activePersona.habits ? JSON.parse(activePersona.habits) : [],
        speechPatterns: activePersona.speechPatterns ? JSON.parse(activePersona.speechPatterns) : [],
        backstory: activePersona.backstory,
        appearance: activePersona.appearance,
        mbtiType: activePersona.mbtiType,
        connections: activePersona.connections
      }
    })
    
  } catch (error) {
    console.error('Get active persona error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
