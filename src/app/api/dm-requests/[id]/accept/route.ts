import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// POST - Accept a DM request and create the conversation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    const { id: requestId } = await params
    
    // Get the DM request
    const dmRequest = await db.dmRequest.findUnique({
      where: { id: requestId },
      include: {
        receiver: {
          select: { id: true, userId: true }
        },
        sender: {
          select: { id: true }
        }
      }
    })
    
    if (!dmRequest) {
      return NextResponse.json(
        { error: 'DM request not found' },
        { status: 404 }
      )
    }
    
    // Verify the receiver belongs to the current user
    if (dmRequest.receiver.userId !== user.id) {
      return NextResponse.json(
        { error: 'Not authorized' },
        { status: 403 }
      )
    }
    
    if (dmRequest.status !== 'pending') {
      return NextResponse.json(
        { error: 'DM request already processed' },
        { status: 400 }
      )
    }
    
    // Check if conversation already exists
    const existingConversation = await db.conversation.findFirst({
      where: {
        OR: [
          { personaAId: dmRequest.senderId, personaBId: dmRequest.receiverId },
          { personaAId: dmRequest.receiverId, personaBId: dmRequest.senderId }
        ]
      }
    })
    
    let conversation
    
    if (existingConversation) {
      conversation = existingConversation
    } else {
      // Create the conversation
      conversation = await db.conversation.create({
        data: {
          personaAId: dmRequest.senderId,
          personaBId: dmRequest.receiverId
        }
      })
      
      // Create the first message
      await db.message.create({
        data: {
          conversationId: conversation.id,
          senderId: dmRequest.senderId,
          content: dmRequest.firstMessage,
          imageUrl: dmRequest.imageUrl
        }
      })
    }
    
    // Update DM request status
    await db.dmRequest.update({
      where: { id: requestId },
      data: { status: 'accepted' }
    })
    
    return NextResponse.json({
      success: true,
      conversation: {
        id: conversation.id
      }
    })
    
  } catch (error) {
    console.error('Accept DM request error:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
