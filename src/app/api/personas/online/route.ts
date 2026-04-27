import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// GET - Fetch online personas for activity display
export async function GET() {
  try {
    const user = await getSession()

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Get online personas (limit to 50, exclude current user's personas)
    const onlinePersonas = await db.persona.findMany({
      where: {
        isOnline: true,
        userId: { not: user.id },
      },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        isOnline: true,
        archetype: true,
        gender: true,
        tags: true,
        user: {
          select: { id: true, username: true, avatarUrl: true }
        }
      },
      take: 50,
      orderBy: { updatedAt: 'desc' }
    })

    const personas = onlinePersonas.map(p => ({
      id: p.id,
      name: p.name,
      avatarUrl: p.avatarUrl,
      isOnline: p.isOnline,
      archetype: p.archetype,
      gender: p.gender,
      tags: p.tags ? JSON.parse(p.tags) : [],
      username: p.user.username,
      userId: p.user.id,
    }))

    return NextResponse.json({ personas })
  } catch (error) {
    console.error('Fetch online personas error:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}

// POST - Set online/offline status for all user's personas
export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    const body = await request.json()
    const { isOnline } = body
    
    // Update all personas for this user
    await db.persona.updateMany({
      where: { userId: user.id },
      data: { isOnline: !!isOnline }
    })
    
    return NextResponse.json({ 
      success: true,
      message: `Personas set to ${isOnline ? 'online' : 'offline'}`
    })
    
  } catch (error) {
    console.error('Update online status error:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
