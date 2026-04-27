import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { isMinor } from '@/lib/age-utils'

// POST - Join a storyline
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    const { id } = await params
    
    // Check if storyline exists and is public
    const storyline = await db.storyline.findUnique({
      where: { id }
    })
    
    if (!storyline) {
      return NextResponse.json({ error: 'Storyline not found' }, { status: 404 })
    }
    
    // Age-gating: If storyline is adult, check if user is 18+
    if (storyline.isAdult) {
      const dbUser = await db.user.findUnique({
        where: { id: user.id },
        select: { dateOfBirth: true }
      })
      if (isMinor(dbUser?.dateOfBirth ?? null)) {
        return NextResponse.json({ error: 'You must be 18+ to join adult storylines' }, { status: 403 })
      }
    }
    
    if (!storyline.isPublic) {
      return NextResponse.json({ error: 'This storyline is private' }, { status: 403 })
    }
    
    // Check if already a member
    const existing = await db.storylineMember.findFirst({
      where: { storylineId: id, userId: user.id }
    })
    
    if (existing) {
      return NextResponse.json({ error: 'Already a member' }, { status: 400 })
    }
    
    // Join the storyline
    await db.storylineMember.create({
      data: {
        storylineId: id,
        userId: user.id,
        role: 'member'
      }
    })
    
    return NextResponse.json({ success: true, message: 'Joined storyline' })
    
  } catch (error) {
    console.error('Join storyline error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
