import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// POST - Leave a storyline
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
    
    // Check if member
    const membership = await db.storylineMember.findFirst({
      where: { storylineId: id, userId: user.id }
    })
    
    if (!membership) {
      return NextResponse.json({ error: 'Not a member' }, { status: 400 })
    }
    
    // Cannot leave if owner
    if (membership.role === 'owner') {
      return NextResponse.json({ 
        error: 'Owner cannot leave. Transfer ownership or delete the storyline instead.' 
      }, { status: 400 })
    }
    
    // Leave the storyline
    await db.storylineMember.delete({
      where: { id: membership.id }
    })
    
    return NextResponse.json({ success: true, message: 'Left storyline' })
    
  } catch (error) {
    console.error('Leave storyline error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
