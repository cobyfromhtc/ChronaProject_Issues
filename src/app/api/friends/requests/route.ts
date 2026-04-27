import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { canInteract } from '@/lib/age-utils'

// GET - Get pending friend requests (sent and received)
export async function GET() {
  try {
    const user = await getSession()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    // Age-gating: Fetch user's DOB for age checks
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { dateOfBirth: true }
    })
    const userDob = dbUser?.dateOfBirth ?? null
    
    // Get received requests
    const received = await db.friendRequest.findMany({
      where: { receiverId: user.id, status: 'pending' },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            dateOfBirth: true,
            personas: {
              where: { isActive: true },
              select: { id: true, name: true, avatarUrl: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    
    // Get sent requests
    const sent = await db.friendRequest.findMany({
      where: { senderId: user.id, status: 'pending' },
      include: {
        receiver: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            dateOfBirth: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    
    // Age-gating: Filter friend requests to only show those from/to users in the same age bracket
    const filteredReceived = received.filter(r => {
      const senderDob = r.sender.dateOfBirth ?? null
      return canInteract(userDob, senderDob)
    })
    
    const filteredSent = sent.filter(s => {
      const receiverDob = s.receiver.dateOfBirth ?? null
      return canInteract(userDob, receiverDob)
    })
    
    return NextResponse.json({
      success: true,
      received: filteredReceived.map(r => ({
        id: r.id,
        sender: r.sender
      })),
      sent: filteredSent.map(s => ({
        id: s.id,
        receiver: s.receiver
      }))
    })
    
  } catch (error) {
    console.error('Get friend requests error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
