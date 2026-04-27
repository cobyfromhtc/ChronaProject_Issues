import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// POST - Create a new channel in a storyline
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
    const { name, type, categoryId, topic, slowMode } = body
    
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Channel name is required' }, { status: 400 })
    }
    
    // Check if user is owner or admin
    const membership = await db.storylineMember.findFirst({
      where: { storylineId: id, userId: user.id, role: { in: ['owner', 'admin'] } }
    })
    
    if (!membership) {
      return NextResponse.json({ error: 'Not authorized to create channels' }, { status: 403 })
    }
    
    // Get the highest position
    const channels = await db.storylineChannel.findMany({
      where: { storylineId: id },
      orderBy: { position: 'desc' },
      take: 1
    })
    
    const nextPosition = channels.length > 0 ? channels[0].position + 1 : 0
    
    // Create the channel
    const channel = await db.storylineChannel.create({
      data: {
        storylineId: id,
        name: name.trim().toLowerCase().replace(/\s+/g, '-'),
        type: type || 'text',
        position: nextPosition,
        categoryId: categoryId || null,
        topic: topic || null,
        slowMode: slowMode || 0
      }
    })
    
    return NextResponse.json({ success: true, channel })
    
  } catch (error) {
    console.error('Create channel error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
