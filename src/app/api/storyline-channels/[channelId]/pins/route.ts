import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// GET - Get pinned messages for a specific channel
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

    // Verify the channel exists and user is a member of its storyline
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

    // Get pinned messages that belong to this channel
    const pinnedMessages = await db.storylinePinnedMessage.findMany({
      where: {
        storylineId: channel.storylineId,
        message: { channelId }
      },
      include: {
        message: {
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
                user: { select: { username: true } }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({
      success: true,
      pinnedMessages: pinnedMessages.map(pm => ({
        id: pm.id,
        pinnedAt: pm.createdAt,
        pinnedById: pm.pinnedById,
        message: {
          id: pm.message.id,
          content: pm.message.content,
          imageUrl: pm.message.imageUrl,
          createdAt: pm.message.createdAt,
          sender: {
            id: pm.message.sender.id,
            name: pm.message.sender.name,
            avatarUrl: pm.message.sender.avatarUrl,
            username: pm.message.sender.user.username
          }
        }
      }))
    })

  } catch (error) {
    console.error('Get channel pinned messages error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// POST - Pin a message in this channel
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
    const { messageId } = body

    if (!messageId) {
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 })
    }

    // Verify channel exists and user has permissions
    const channel = await db.storylineChannel.findUnique({
      where: { id: channelId },
      include: {
        storyline: {
          include: {
            members: {
              where: { userId: user.id },
              include: { customRole: { select: { canManageMessages: true } } }
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

    const membership = channel.storyline.members[0]
    const canPin = membership.role === 'owner' || membership.role === 'admin' || membership.customRole?.canManageMessages
    if (!canPin) {
      return NextResponse.json({ error: 'Not authorized to pin messages' }, { status: 403 })
    }

    // Verify the message belongs to this channel
    const message = await db.storylineMessage.findFirst({
      where: { id: messageId, channelId }
    })

    if (!message) {
      return NextResponse.json({ error: 'Message not found in this channel' }, { status: 404 })
    }

    // Check if already pinned
    const existing = await db.storylinePinnedMessage.findUnique({
      where: { storylineId_messageId: { storylineId: channel.storylineId, messageId } }
    })

    if (existing) {
      return NextResponse.json({ error: 'Message is already pinned' }, { status: 400 })
    }

    const pinned = await db.storylinePinnedMessage.create({
      data: {
        storylineId: channel.storylineId,
        messageId,
        pinnedById: user.id
      }
    })

    return NextResponse.json({ success: true, pinnedMessage: pinned })

  } catch (error) {
    console.error('Pin message error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// DELETE - Unpin a message from this channel
export async function DELETE(
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
    const { messageId } = body

    if (!messageId) {
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 })
    }

    // Verify channel exists and user has permissions
    const channel = await db.storylineChannel.findUnique({
      where: { id: channelId },
      include: {
        storyline: {
          include: {
            members: {
              where: { userId: user.id },
              include: { customRole: { select: { canManageMessages: true } } }
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

    const membership = channel.storyline.members[0]
    const canUnpin = membership.role === 'owner' || membership.role === 'admin' || membership.customRole?.canManageMessages
    if (!canUnpin) {
      return NextResponse.json({ error: 'Not authorized to unpin messages' }, { status: 403 })
    }

    await db.storylinePinnedMessage.deleteMany({
      where: { storylineId: channel.storylineId, messageId }
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Unpin message error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
