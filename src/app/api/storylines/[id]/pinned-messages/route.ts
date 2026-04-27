import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// GET - Get pinned messages for a storyline
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { id } = await params

    // Check membership
    const membership = await db.storylineMember.findFirst({
      where: { storylineId: id, userId: user.id }
    })

    if (!membership) {
      return NextResponse.json({ error: 'Not a member' }, { status: 403 })
    }

    const pinnedMessages = await db.storylinePinnedMessage.findMany({
      where: { storylineId: id },
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
    console.error('Get pinned messages error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// POST - Pin a message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { messageId } = body

    if (!messageId) {
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 })
    }

    // Check membership & permissions
    const membership = await db.storylineMember.findFirst({
      where: { storylineId: id, userId: user.id },
      include: { customRole: { select: { canManageMessages: true } } }
    })

    if (!membership) {
      return NextResponse.json({ error: 'Not a member' }, { status: 403 })
    }

    const canPin = membership.role === 'owner' || membership.role === 'admin' || membership.customRole?.canManageMessages
    if (!canPin) {
      return NextResponse.json({ error: 'Not authorized to pin messages' }, { status: 403 })
    }

    // Check if already pinned
    const existing = await db.storylinePinnedMessage.findUnique({
      where: { storylineId_messageId: { storylineId: id, messageId } }
    })

    if (existing) {
      return NextResponse.json({ error: 'Message is already pinned' }, { status: 400 })
    }

    const pinned = await db.storylinePinnedMessage.create({
      data: {
        storylineId: id,
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

// DELETE - Unpin a message
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { messageId } = body

    if (!messageId) {
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 })
    }

    // Check membership & permissions
    const membership = await db.storylineMember.findFirst({
      where: { storylineId: id, userId: user.id },
      include: { customRole: { select: { canManageMessages: true } } }
    })

    if (!membership) {
      return NextResponse.json({ error: 'Not a member' }, { status: 403 })
    }

    const canUnpin = membership.role === 'owner' || membership.role === 'admin' || membership.customRole?.canManageMessages
    if (!canUnpin) {
      return NextResponse.json({ error: 'Not authorized to unpin messages' }, { status: 403 })
    }

    await db.storylinePinnedMessage.deleteMany({
      where: { storylineId: id, messageId }
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Unpin message error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
