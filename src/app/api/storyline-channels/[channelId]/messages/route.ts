import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// GET - Get messages for a channel (with search support)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const user = await getSession()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    const { channelId } = await params
    const searchParams = request.nextUrl.searchParams
    const searchQuery = searchParams.get('search') || ''
    
    // Get the channel and verify user is a member of the storyline
    const channel = await db.storylineChannel.findUnique({
      where: { id: channelId },
      include: {
        storyline: {
          include: {
            members: {
              where: { userId: user.id }
            }
          }
        }
      }
    })
    
    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }
    
    if (channel.storyline.members.length === 0) {
      return NextResponse.json({ error: 'Not a member of this storyline' }, { status: 403 })
    }
    
    // Build where clause
    const whereClause: any = { channelId }
    if (searchQuery) {
      whereClause.content = { contains: searchQuery }
    }
    
    // Get messages with sender info and reactions
    const messages = await db.storylineMessage.findMany({
      where: whereClause,
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            user: {
              select: { username: true }
            }
          }
        },
        reactions: true,
        pinnedBy: {
          select: { id: true }
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            sender: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'asc' },
      take: searchQuery ? 50 : 100
    })
    
    return NextResponse.json({
      success: true,
      channelTopic: channel.topic,
      channelSlowMode: channel.slowMode,
      channelType: channel.type,
      messages: messages.map(m => {
        // Group reactions by emoji
        const reactionGroups = m.reactions.reduce((acc, reaction) => {
          if (!acc[reaction.emoji]) {
            acc[reaction.emoji] = { emoji: reaction.emoji, count: 0, userIds: [] }
          }
          acc[reaction.emoji].count++
          acc[reaction.emoji].userIds.push(reaction.userId)
          return acc
        }, {} as Record<string, { emoji: string; count: number; userIds: string[] }>)
        
        return {
          id: m.id,
          content: m.content,
          imageUrl: m.imageUrl,
          createdAt: m.createdAt,
          editedAt: m.editedAt,
          replyToId: m.replyToId,
          replyTo: m.replyTo ? {
            id: m.replyTo.id,
            content: m.replyTo.content,
            senderName: m.replyTo.sender.name
          } : null,
          isPinned: m.pinnedBy.length > 0,
          sender: {
            id: m.sender.id,
            name: m.sender.name,
            avatarUrl: m.sender.avatarUrl,
            username: m.sender.user.username
          },
          reactions: Object.values(reactionGroups),
          hasReacted: m.reactions.filter(r => r.userId === user.id).map(r => r.emoji)
        }
      })
    })
    
  } catch (error) {
    console.error('Get channel messages error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// POST - Send a message to a channel (with reply support)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const user = await getSession()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    const { channelId } = await params
    const body = await request.json()
    const { content, imageUrl, senderPersonaId, replyToId } = body
    
    if (!content?.trim() && !imageUrl) {
      return NextResponse.json({ error: 'Message content or image required' }, { status: 400 })
    }
    
    // Get the channel and verify user is a member
    const channel = await db.storylineChannel.findUnique({
      where: { id: channelId },
      include: {
        storyline: {
          include: {
            members: {
              where: { userId: user.id }
            }
          }
        }
      }
    })
    
    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }
    
    if (channel.storyline.members.length === 0) {
      return NextResponse.json({ error: 'Not a member of this storyline' }, { status: 403 })
    }
    
    // Verify the persona belongs to the user
    const persona = await db.persona.findFirst({
      where: { id: senderPersonaId, userId: user.id }
    })
    
    if (!persona) {
      return NextResponse.json({ error: 'Invalid persona' }, { status: 400 })
    }
    
    // Validate replyToId if provided
    if (replyToId) {
      const replyMessage = await db.storylineMessage.findFirst({
        where: { id: replyToId, channelId }
      })
      if (!replyMessage) {
        return NextResponse.json({ error: 'Reply target message not found' }, { status: 400 })
      }
    }
    
    // Create the message
    const message = await db.storylineMessage.create({
      data: {
        channelId,
        senderId: senderPersonaId,
        content: content?.trim() || '',
        imageUrl: imageUrl || null,
        replyToId: replyToId || null
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            user: {
              select: { username: true }
            }
          }
        },
        reactions: true,
        pinnedBy: { select: { id: true } },
        replyTo: {
          select: {
            id: true,
            content: true,
            sender: {
              select: { id: true, name: true }
            }
          }
        }
      }
    })
    
    return NextResponse.json({
      success: true,
      message: {
        id: message.id,
        content: message.content,
        imageUrl: message.imageUrl,
        createdAt: message.createdAt,
        editedAt: message.editedAt,
        replyToId: message.replyToId,
        replyTo: message.replyTo ? {
          id: message.replyTo.id,
          content: message.replyTo.content,
          senderName: message.replyTo.sender.name
        } : null,
        isPinned: message.pinnedBy.length > 0,
        sender: {
          id: message.sender.id,
          name: message.sender.name,
          avatarUrl: message.sender.avatarUrl,
          username: message.sender.user.username
        },
        reactions: [],
        hasReacted: []
      }
    })
    
  } catch (error) {
    console.error('Send channel message error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// PATCH - Edit a message
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const user = await getSession()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    const { channelId } = await params
    const body = await request.json()
    const { messageId, content } = body
    
    if (!messageId || !content?.trim()) {
      return NextResponse.json({ error: 'Message ID and content required' }, { status: 400 })
    }
    
    // Find the message and verify ownership
    const message = await db.storylineMessage.findFirst({
      where: { id: messageId, channelId },
      include: {
        sender: {
          select: { userId: true }
        }
      }
    })
    
    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }
    
    if (message.sender.userId !== user.id) {
      return NextResponse.json({ error: 'Can only edit your own messages' }, { status: 403 })
    }
    
    // Update the message
    const updated = await db.storylineMessage.update({
      where: { id: messageId },
      data: {
        content: content.trim(),
        editedAt: new Date()
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            user: { select: { username: true } }
          }
        },
        reactions: true,
        pinnedBy: { select: { id: true } },
        replyTo: {
          select: {
            id: true,
            content: true,
            sender: { select: { id: true, name: true } }
          }
        }
      }
    })
    
    // Group reactions
    const reactionGroups = updated.reactions.reduce((acc, reaction) => {
      if (!acc[reaction.emoji]) {
        acc[reaction.emoji] = { emoji: reaction.emoji, count: 0, userIds: [] }
      }
      acc[reaction.emoji].count++
      acc[reaction.emoji].userIds.push(reaction.userId)
      return acc
    }, {} as Record<string, { emoji: string; count: number; userIds: string[] }>)
    
    return NextResponse.json({
      success: true,
      message: {
        id: updated.id,
        content: updated.content,
        imageUrl: updated.imageUrl,
        createdAt: updated.createdAt,
        editedAt: updated.editedAt,
        replyToId: updated.replyToId,
        replyTo: updated.replyTo ? {
          id: updated.replyTo.id,
          content: updated.replyTo.content,
          senderName: updated.replyTo.sender.name
        } : null,
        isPinned: updated.pinnedBy.length > 0,
        sender: {
          id: updated.sender.id,
          name: updated.sender.name,
          avatarUrl: updated.sender.avatarUrl,
          username: updated.sender.user.username
        },
        reactions: Object.values(reactionGroups),
        hasReacted: updated.reactions.filter(r => r.userId === user.id).map(r => r.emoji)
      }
    })
    
  } catch (error) {
    console.error('Edit message error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
