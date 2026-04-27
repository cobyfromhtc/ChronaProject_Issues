import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// POST - Decline a friend request OR cancel a sent request
export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    const body = await request.json()
    const { requestId, cancelSent } = body
    
    if (!requestId) {
      return NextResponse.json({ error: 'Request ID is required' }, { status: 400 })
    }
    
    if (cancelSent) {
      // Cancel a sent request (user is the sender)
      const friendRequest = await db.friendRequest.findFirst({
        where: {
          id: requestId,
          senderId: user.id,
          status: 'pending'
        }
      })
      
      if (!friendRequest) {
        return NextResponse.json({ error: 'Friend request not found' }, { status: 404 })
      }
      
      // Delete the request entirely
      await db.friendRequest.delete({
        where: { id: requestId }
      })
      
      return NextResponse.json({ success: true, message: 'Friend request cancelled' })
    } else {
      // Decline an incoming request (user is the receiver)
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
      
      await db.friendRequest.update({
        where: { id: requestId },
        data: { status: 'declined' }
      })
      
      return NextResponse.json({ success: true, message: 'Friend request declined' })
    }
    
  } catch (error) {
    console.error('Decline friend request error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
