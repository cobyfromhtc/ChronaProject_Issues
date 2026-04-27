import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// POST - Block a user
export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    const { userId: targetUserId } = await request.json()
    
    if (!targetUserId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }
    
    if (targetUserId === user.id) {
      return NextResponse.json({ error: 'Cannot block yourself' }, { status: 400 })
    }
    
    // Check if target user exists
    const targetUser = await db.user.findUnique({
      where: { id: targetUserId }
    })
    
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    
    // Check if already blocked
    const existingBlock = await db.block.findFirst({
      where: { blockerId: user.id, blockedId: targetUserId }
    })
    
    if (existingBlock) {
      return NextResponse.json({ error: 'User already blocked' }, { status: 400 })
    }
    
    // Remove friendship if exists
    await db.friendship.deleteMany({
      where: {
        OR: [
          { userId: user.id, friendId: targetUserId },
          { userId: targetUserId, friendId: user.id }
        ]
      }
    })
    
    // Remove any pending friend requests
    await db.friendRequest.deleteMany({
      where: {
        OR: [
          { senderId: user.id, receiverId: targetUserId },
          { senderId: targetUserId, receiverId: user.id }
        ]
      }
    })
    
    // Create block
    await db.block.create({
      data: {
        blockerId: user.id,
        blockedId: targetUserId
      }
    })
    
    return NextResponse.json({ success: true, message: 'User blocked' })
    
  } catch (error) {
    console.error('Block user error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
