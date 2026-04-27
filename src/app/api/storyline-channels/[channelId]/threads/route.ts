import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// GET - Get threads for a channel
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { channelId } = await params

    const channel = await db.storylineChannel.findUnique({
      where: { id: channelId },
      include: { storyline: { include: { members: { where: { userId: user.id } } } } }
    })

    if (!channel || channel.storyline.members.length === 0) {
      return NextResponse.json({ error: 'Not a member' }, { status: 403 })
    }

    const threads = await db.storylineThread.findMany({
      where: { channelId, isArchived: false },
      include: {
        message: {
          select: { id: true, content: true, sender: { select: { id: true, name: true, avatarUrl: true } } }
        },
        messages: { take: 1, orderBy: { createdAt: 'desc' } },
        _count: { select: { messages: true } }
      },
      orderBy: { updatedAt: 'desc' }
    })

    return NextResponse.json({
      success: true,
      threads: threads.map(t => ({
        id: t.id,
        name: t.name,
        messageId: t.messageId,
        message: t.message,
        messageCount: t._count.messages,
        isArchived: t.isArchived,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt
      }))
    })
  } catch (error) {
    console.error('Get threads error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// POST - Create a thread from a message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { channelId } = await params
    const body = await request.json()
    const { messageId, name } = body

    if (!messageId || !name?.trim()) {
      return NextResponse.json({ error: 'Message ID and thread name required' }, { status: 400 })
    }

    const channel = await db.storylineChannel.findUnique({
      where: { id: channelId },
      include: { storyline: { include: { members: { where: { userId: user.id } } } } }
    })

    if (!channel || channel.storyline.members.length === 0) {
      return NextResponse.json({ error: 'Not a member' }, { status: 403 })
    }

    // Check if thread already exists for this message
    const existingThread = await db.storylineThread.findFirst({
      where: { messageId }
    })

    if (existingThread) {
      return NextResponse.json({ error: 'Thread already exists for this message', thread: existingThread }, { status: 409 })
    }

    const thread = await db.storylineThread.create({
      data: {
        channelId,
        messageId,
        name: name.trim(),
        createdById: user.id
      }
    })

    return NextResponse.json({ success: true, thread })
  } catch (error) {
    console.error('Create thread error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
