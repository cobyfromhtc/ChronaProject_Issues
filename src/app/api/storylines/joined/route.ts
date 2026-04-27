import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// GET - Get user's joined storylines (auto-joins official community if not already a member)
export async function GET() {
  try {
    const user = await getSession()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    // Auto-join the official community if user is not already a member
    try {
      const official = await db.storyline.findFirst({
        where: { isOfficial: true },
        select: { id: true }
      })
      
      if (official) {
        const existingMembership = await db.storylineMember.findFirst({
          where: { storylineId: official.id, userId: user.id }
        })
        
        if (!existingMembership) {
          // Get or create the Member role for the official server
          const memberRole = await db.storylineRole.findFirst({
            where: { storylineId: official.id, name: 'Member' }
          })
          
          await db.storylineMember.create({
            data: {
              storylineId: official.id,
              userId: user.id,
              role: 'member',
              roleId: memberRole?.id || null
            }
          })
        }
      }
    } catch (autoJoinError) {
      // Don't block the main request if auto-join fails
      console.error('[Storylines/Joined] Auto-join official error:', autoJoinError)
    }
    
    const memberships = await db.storylineMember.findMany({
      where: { userId: user.id },
      include: {
        storyline: {
          include: {
            owner: {
              select: { id: true, username: true, avatarUrl: true }
            },
            _count: {
              select: { members: true }
            },
            channels: {
              orderBy: { position: 'asc' },
              select: { id: true, name: true, type: true }
            }
          }
        }
      },
      orderBy: { joinedAt: 'desc' }
    })
    
    const storylines = memberships.map(m => ({
      ...m.storyline,
      role: m.role,
      joinedAt: m.joinedAt,
      memberCount: m.storyline._count.members
    }))
    
    return NextResponse.json({ success: true, storylines })
    
  } catch (error) {
    console.error('Get joined storylines error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
