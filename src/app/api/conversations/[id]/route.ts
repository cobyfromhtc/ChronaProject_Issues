import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// GET - Fetch a single conversation with details
export async function GET(
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
    
    const { id: conversationId } = await params
    
    // Get conversation with persona details
    const conversation = await db.conversation.findUnique({
      where: { id: conversationId },
      include: {
        personaA: {
          include: { user: { select: { username: true } } }
        },
        personaB: {
          include: { user: { select: { username: true } } }
        },
      }
    })
    
    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }
    
    // Verify user is part of this conversation
    const userIds = [conversation.personaA.userId, conversation.personaB.userId]
    if (!userIds.includes(user.id)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }
    
    // Determine which persona belongs to the current user
    const isPersonaA = conversation.personaA.userId === user.id
    const myPersona = isPersonaA ? conversation.personaA : conversation.personaB
    const otherPersona = isPersonaA ? conversation.personaB : conversation.personaA
    
    return NextResponse.json({ 
      success: true,
      conversation: {
        id: conversation.id,
        myPersona: {
          id: myPersona.id,
          name: myPersona.name,
          avatarUrl: myPersona.avatarUrl,
        },
        otherPersona: {
          id: otherPersona.id,
          name: otherPersona.name,
          avatarUrl: otherPersona.avatarUrl,
          username: otherPersona.user.username,
          isOnline: otherPersona.isOnline,
        },
        createdAt: conversation.createdAt,
        lastMessageAt: conversation.lastMessageAt,
      }
    })
    
  } catch (error) {
    console.error('Fetch conversation error:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
