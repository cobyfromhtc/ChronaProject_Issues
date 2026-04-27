import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// GET - Check friend status with another user
export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const targetUserId = searchParams.get('targetUserId')
    
    if (!targetUserId) {
      return NextResponse.json({ error: 'Target user ID is required' }, { status: 400 })
    }
    
    // Check if already friends
    const existingFriendship = await db.friendship.findFirst({
      where: {
        OR: [
          { userId: user.id, friendId: targetUserId },
          { userId: targetUserId, friendId: user.id }
        ]
      }
    })
    
    if (existingFriendship) {
      return NextResponse.json({
        isFriend: true,
        hasPendingRequest: false,
        hasSentRequest: false
      })
    }
    
    // Check for pending friend requests
    const pendingRequest = await db.friendRequest.findFirst({
      where: {
        OR: [
          { senderId: user.id, receiverId: targetUserId },
          { senderId: targetUserId, receiverId: user.id }
        ],
        status: 'pending'
      }
    })
    
    if (pendingRequest) {
      return NextResponse.json({
        isFriend: false,
        hasPendingRequest: pendingRequest.receiverId === user.id, // Someone sent us a request
        hasSentRequest: pendingRequest.senderId === user.id // We sent a request
      })
    }
    
    return NextResponse.json({
      isFriend: false,
      hasPendingRequest: false,
      hasSentRequest: false
    })
    
  } catch (error) {
    console.error('Check friend status error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
