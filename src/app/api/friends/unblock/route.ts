import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// POST - Unblock a user
export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    const { userId: blockedUserId } = await request.json()
    
    if (!blockedUserId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }
    
    // Delete the block
    await db.block.deleteMany({
      where: {
        blockerId: user.id,
        blockedId: blockedUserId
      }
    })
    
    return NextResponse.json({ success: true, message: 'User unblocked' })
    
  } catch (error) {
    console.error('Unblock user error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
