import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// POST - Remove a friend (unfriend)
export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    const { friendId } = await request.json()
    
    if (!friendId) {
      return NextResponse.json({ error: 'Friend ID is required' }, { status: 400 })
    }
    
    // Delete both friendship records
    await db.friendship.deleteMany({
      where: {
        OR: [
          { userId: user.id, friendId: friendId },
          { userId: friendId, friendId: user.id }
        ]
      }
    })
    
    return NextResponse.json({ success: true, message: 'Friend removed' })
    
  } catch (error) {
    console.error('Remove friend error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
