import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// POST - Accept a friend request
export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    const body = await request.json()
    const { requestId } = body
    
    if (!requestId) {
      return NextResponse.json({ error: 'Request ID is required' }, { status: 400 })
    }
    
    // Find the friend request
    const friendRequest = await db.friendRequest.findFirst({
      where: {
        id: requestId,
        receiverId: user.id,
        status: 'pending'
      }
    })
    
    if (!friendRequest) {
      return NextResponse.json({ error: 'Friend request not found' }, { status: 404 })
    }
    
    // Update request status to accepted
    await db.friendRequest.update({
      where: { id: requestId },
      data: { status: 'accepted' }
    })
    
    // Create friendships for both users (bidirectional)
    // SQLite doesn't support skipDuplicates, so we create each one separately
    try {
      await db.friendship.create({
        data: { userId: user.id, friendId: friendRequest.senderId }
      })
    } catch {
      // Already exists, ignore
    }

    try {
      await db.friendship.create({
        data: { userId: friendRequest.senderId, friendId: user.id }
      })
    } catch {
      // Already exists, ignore
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Friend request accepted',
      friendId: friendRequest.senderId 
    })
    
  } catch (error) {
    console.error('Accept friend request error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
