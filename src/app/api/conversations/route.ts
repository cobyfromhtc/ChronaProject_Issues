import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { db } from '@/lib/db'
import { canInteract, isMinor, getAgeBracket } from '@/lib/age-utils'

// GET - Fetch all conversations for current user's active persona
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionFromRequest(request)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    // Age-gating: Fetch user's DOB for age checks
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { dateOfBirth: true }
    })
    const userDob = dbUser?.dateOfBirth ?? null
    
    // Get user's personas
    const userPersonas = await db.persona.findMany({
      where: { userId: user.id },
      select: { id: true }
    })
    const personaIds = userPersonas.map(p => p.id)
    
    // Get all conversations involving these personas
    const conversations = await db.conversation.findMany({
      where: {
        OR: [
          { personaAId: { in: personaIds } },
          { personaBId: { in: personaIds } },
        ]
      },
      include: {
        personaA: {
          include: { user: { select: { id: true, username: true, dateOfBirth: true } } }
        },
        personaB: {
          include: { user: { select: { id: true, username: true, dateOfBirth: true } } }
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { lastMessageAt: 'desc' }
    })
    
    // Transform to include "other persona" info
    // Filter out conversations where BOTH personas belong to the same user (self-conversations)
    // Age-gating: Filter out conversations where participants are in different age brackets
    // Exception: System/bot users (like Blorp) skip age-gating
    const result = conversations
      .filter(conv => {
        // Check if both personas belong to the same user (self-conversation)
        const isPersonaA = personaIds.includes(conv.personaAId)
        const isPersonaB = personaIds.includes(conv.personaBId)
        // Exclude if both belong to current user
        if (isPersonaA && isPersonaB) return false
        
        // Age-gating: Skip for system/bot users (isOfficial or role=system)
        const otherPersona = isPersonaA ? conv.personaB : conv.personaA
        const otherUser = otherPersona.user
        if (otherPersona.user?.id) {
          // Check if other user is a system/bot user
          const otherUserFull = otherPersona.user
          if (otherUserFull.username === 'Blorp' || otherPersona.name === 'Blorp') {
            return true // Always allow Blorp conversations
          }
        }
        
        // Age-gating: Filter out conversations with users in different age brackets
        const otherUserDob = otherPersona.user?.dateOfBirth ?? null
        if (!canInteract(userDob, otherUserDob)) return false
        
        return true
      })
      .map(conv => {
        const isPersonaA = personaIds.includes(conv.personaAId)
        const otherPersona = isPersonaA ? conv.personaB : conv.personaA
        const myPersona = isPersonaA ? conv.personaA : conv.personaB
        
        return {
          id: conv.id,
          otherPersona: {
            id: otherPersona.id,
            name: otherPersona.name,
            avatarUrl: otherPersona.avatarUrl,
            username: otherPersona.user.username,
            isOnline: otherPersona.isOnline,
          },
          myPersona: {
            id: myPersona.id,
            name: myPersona.name,
          },
          lastMessage: conv.messages[0] || null,
          lastMessageAt: conv.lastMessageAt,
          createdAt: conv.createdAt,
        }
      })
    
    return NextResponse.json({ 
      success: true,
      conversations: result 
    })
    
  } catch (error) {
    console.error('Fetch conversations error:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}

// POST - Start a new conversation or send DM request
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionFromRequest(request)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    const body = await request.json()
    const { targetPersonaId, myPersonaId, firstMessage, imageUrl } = body
    
    if (!targetPersonaId || !myPersonaId) {
      return NextResponse.json(
        { error: 'Missing persona IDs' },
        { status: 400 }
      )
    }
    
    // Verify myPersonaId belongs to user
    const myPersona = await db.persona.findFirst({
      where: { id: myPersonaId, userId: user.id }
    })
    
    if (!myPersona) {
      return NextResponse.json(
        { error: 'Invalid persona' },
        { status: 400 }
      )
    }
    
    // Age-gating: Check that both persona owners are in the same age bracket
    const dbUserForConv = await db.user.findUnique({
      where: { id: user.id },
      select: { dateOfBirth: true }
    })
    const myDob = dbUserForConv?.dateOfBirth ?? null
    
    // Check if target persona exists
    const targetPersona = await db.persona.findUnique({
      where: { id: targetPersonaId },
      include: { user: { select: { id: true, username: true, dateOfBirth: true } } }
    })
    
    if (!targetPersona) {
      return NextResponse.json(
        { error: 'Target persona not found' },
        { status: 404 }
      )
    }
    
    // Age-gating: Check that both persona owners are in the same age bracket
    const targetDob = targetPersona.user.dateOfBirth ?? null
    if (!canInteract(myDob, targetDob)) {
      return NextResponse.json(
        { error: 'You cannot start a conversation with this user due to age restrictions' },
        { status: 403 }
      )
    }
    
    // Check if conversation already exists (in either direction)
    const existingConv = await db.conversation.findFirst({
      where: {
        OR: [
          { personaAId: myPersonaId, personaBId: targetPersonaId },
          { personaAId: targetPersonaId, personaBId: myPersonaId },
        ]
      },
      include: {
        personaA: {
          include: { user: { select: { username: true } } }
        },
        personaB: {
          include: { user: { select: { username: true } } }
        },
      }
    })
    
    if (existingConv) {
      // Return existing conversation with full data
      return NextResponse.json({ 
        success: true,
        conversation: existingConv,
        isNew: false
      })
    }
    
    // Check if users are friends (skip DM request if they are)
    const isFriend = await db.friendship.findFirst({
      where: {
        OR: [
          { userId: user.id, friendId: targetPersona.userId },
          { userId: targetPersona.userId, friendId: user.id }
        ]
      }
    })
    
    // If users are friends, create conversation directly without DM request
    if (isFriend) {
      const conversation = await db.conversation.create({
        data: {
          personaAId: myPersonaId,
          personaBId: targetPersonaId,
        },
        include: {
          personaA: {
            include: { user: { select: { username: true } } }
          },
          personaB: {
            include: { user: { select: { username: true } } }
          },
        }
      })
      
      // If there's a first message, create it
      if (firstMessage || imageUrl) {
        await db.message.create({
          data: {
            conversationId: conversation.id,
            senderId: myPersonaId,
            content: firstMessage?.trim() || '',
            imageUrl: imageUrl || null
          }
        })
      }
      
      return NextResponse.json({ 
        success: true,
        conversation,
        isNew: true,
        isFriend: true
      })
    }
    
    // Check if there's already a pending DM request from this sender to this receiver
    const existingDmRequest = await db.dmRequest.findUnique({
      where: {
        senderId_receiverId: {
          senderId: myPersonaId,
          receiverId: targetPersonaId
        }
      }
    })
    
    if (existingDmRequest) {
      if (existingDmRequest.status === 'pending') {
        return NextResponse.json({ 
          success: false,
          error: 'DM request already sent',
          code: 'DM_REQUEST_PENDING',
          dmRequest: existingDmRequest
        }, { status: 400 })
      } else if (existingDmRequest.status === 'ignored') {
        // If previously ignored, allow re-sending (update the request)
        if (!firstMessage && !imageUrl) {
          return NextResponse.json({ 
            needsDmRequest: true,
            targetPersona: {
              id: targetPersona.id,
              name: targetPersona.name,
              username: targetPersona.user.username
            }
          })
        }
        
        // Update the existing ignored request with new message
        const updatedRequest = await db.dmRequest.update({
          where: { id: existingDmRequest.id },
          data: {
            firstMessage: firstMessage?.trim() || '',
            imageUrl: imageUrl || null,
            status: 'pending',
            createdAt: new Date()
          }
        })
        
        return NextResponse.json({
          success: true,
          dmRequest: updatedRequest,
          message: 'DM request sent again'
        })
      }
    }
    
    // Check if the TARGET has a pending DM request to the SENDER
    // In this case, we should accept it and create the conversation
    const reverseDmRequest = await db.dmRequest.findFirst({
      where: {
        senderId: targetPersonaId,
        receiverId: myPersonaId,
        status: 'pending'
      }
    })
    
    if (reverseDmRequest) {
      // The target already sent a DM request to us - accept it and create conversation
      const conversation = await db.conversation.create({
        data: {
          personaAId: targetPersonaId,
          personaBId: myPersonaId,
        },
        include: {
          personaA: {
            include: { user: { select: { username: true } } }
          },
          personaB: {
            include: { user: { select: { username: true } } }
          },
        }
      })
      
      // Create the original message from the target
      await db.message.create({
        data: {
          conversationId: conversation.id,
          senderId: targetPersonaId,
          content: reverseDmRequest.firstMessage,
          imageUrl: reverseDmRequest.imageUrl
        }
      })
      
      // If there's a response message, create it too
      if (firstMessage || imageUrl) {
        await db.message.create({
          data: {
            conversationId: conversation.id,
            senderId: myPersonaId,
            content: firstMessage?.trim() || '',
            imageUrl: imageUrl || null
          }
        })
      }
      
      // Mark the DM request as accepted
      await db.dmRequest.update({
        where: { id: reverseDmRequest.id },
        data: { status: 'accepted' }
      })
      
      return NextResponse.json({ 
        success: true,
        conversation,
        isNew: true,
        acceptedDmRequest: true
      })
    }
    
    // No existing conversation or DM request - need to create a DM request
    if (!firstMessage && !imageUrl) {
      // Frontend needs to show the DM request dialog
      return NextResponse.json({ 
        needsDmRequest: true,
        targetPersona: {
          id: targetPersona.id,
          name: targetPersona.name,
          username: targetPersona.user.username
        }
      })
    }
    
    // Create the DM request
    const dmRequest = await db.dmRequest.create({
      data: {
        senderId: myPersonaId,
        receiverId: targetPersonaId,
        firstMessage: firstMessage?.trim() || '',
        imageUrl: imageUrl || null,
        status: 'pending'
      }
    })
    
    return NextResponse.json({
      success: true,
      dmRequest,
      message: 'DM request sent'
    })
    
  } catch (error) {
    console.error('Create conversation error:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
