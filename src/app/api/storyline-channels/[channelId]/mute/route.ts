import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// POST - Mute/unmute channel notifications
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { channelId } = await params

    // Check membership
    const channel = await db.storylineChannel.findUnique({
      where: { id: channelId },
      include: { storyline: { include: { members: { where: { userId: user.id } } } } }
    })

    if (!channel || channel.storyline.members.length === 0) {
      return NextResponse.json({ error: 'Not a member' }, { status: 403 })
    }

    // Toggle mute
    const existing = await db.storylineChannelMute.findUnique({
      where: { channelId_userId: { channelId, userId: user.id } }
    })

    if (existing) {
      await db.storylineChannelMute.delete({ where: { id: existing.id } })
      return NextResponse.json({ success: true, isMuted: false })
    } else {
      await db.storylineChannelMute.create({
        data: { channelId, userId: user.id }
      })
      return NextResponse.json({ success: true, isMuted: true })
    }
  } catch (error) {
    console.error('Toggle mute error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// GET - Check if channel is muted for user
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { channelId } = await params

    const mute = await db.storylineChannelMute.findUnique({
      where: { channelId_userId: { channelId, userId: user.id } }
    })

    return NextResponse.json({ success: true, isMuted: !!mute })
  } catch (error) {
    console.error('Check mute error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
