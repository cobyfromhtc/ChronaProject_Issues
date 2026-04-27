import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// GET - Get unread status for channels in a storyline
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { channelId } = await params

    const unread = await db.storylineChannelUnread.findUnique({
      where: { channelId_userId: { channelId, userId: user.id } }
    })

    return NextResponse.json({
      success: true,
      hasUnread: unread?.hasUnread || false,
      lastReadAt: unread?.lastReadAt || null
    })
  } catch (error) {
    console.error('Get unread error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// POST - Mark channel as read
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { channelId } = await params

    await db.storylineChannelUnread.upsert({
      where: { channelId_userId: { channelId, userId: user.id } },
      update: { hasUnread: false, lastReadAt: new Date() },
      create: { channelId, userId: user.id, hasUnread: false, lastReadAt: new Date() }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Mark read error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
