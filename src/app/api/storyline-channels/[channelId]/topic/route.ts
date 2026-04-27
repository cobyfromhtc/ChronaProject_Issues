import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// PATCH - Update channel topic
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
    const { topic } = body

    // Get channel with storyline membership info
    const channel = await db.storylineChannel.findUnique({
      where: { id: channelId },
      include: {
        storyline: {
          include: {
            members: {
              where: { userId: user.id },
              include: { customRole: { select: { canManageChannels: true } } }
            }
          }
        }
      }
    })

    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    const membership = channel.storyline.members[0]
    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this storyline' }, { status: 403 })
    }

    const canManage = membership.role === 'owner' || membership.role === 'admin' || membership.customRole?.canManageChannels
    if (!canManage) {
      return NextResponse.json({ error: 'Not authorized to edit channel topic' }, { status: 403 })
    }

    const updated = await db.storylineChannel.update({
      where: { id: channelId },
      data: { topic: topic?.trim() || null }
    })

    return NextResponse.json({ success: true, channel: updated })

  } catch (error) {
    console.error('Update channel topic error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
