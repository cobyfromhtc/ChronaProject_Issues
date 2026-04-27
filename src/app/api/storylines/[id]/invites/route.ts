import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { nanoid } from 'nanoid'

// GET - Get all invites for storyline
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
    
    const invites = await db.storylineInvite.findMany({
      where: { storylineId: id },
      orderBy: { createdAt: 'desc' }
    })
    
    return NextResponse.json({ success: true, invites })
    
  } catch (error) {
    console.error('Get invites error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// POST - Create a new invite
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
    const { maxUses, expiresIn } = body
    
    // Check permissions
    const membership = await db.storylineMember.findFirst({
      where: { storylineId: id, userId: user.id },
      include: {
        customRole: {
          select: {
            canInvite: true,
          }
        }
      }
    })
    
    if (!membership) {
      return NextResponse.json({ error: 'Not a member' }, { status: 403 })
    }
    
    const canInvite = membership.role === 'owner' || 
      membership.role === 'admin' || 
      membership.customRole?.canInvite
    
    if (!canInvite) {
      return NextResponse.json({ error: 'Not authorized to create invites' }, { status: 403 })
    }
    
    // Check if storyline requires approval and member cap
    const storyline = await db.storyline.findUnique({
      where: { id },
      include: { _count: { select: { members: true } } }
    })
    
    if (!storyline) {
      return NextResponse.json({ error: 'Storyline not found' }, { status: 404 })
    }
    
    if (storyline.memberCap && storyline._count.members >= storyline.memberCap) {
      return NextResponse.json({ error: 'Member cap reached' }, { status: 400 })
    }
    
    // Generate unique code
    const code = nanoid(8)
    
    // Calculate expiration
    let expiresAt: Date | null = null
    if (expiresIn && expiresIn > 0) {
      expiresAt = new Date(Date.now() + expiresIn * 1000)
    }
    
    const invite = await db.storylineInvite.create({
      data: {
        storylineId: id,
        code,
        createdById: user.id,
        maxUses: maxUses || null,
        expiresAt
      }
    })
    
    return NextResponse.json({ success: true, invite })
    
  } catch (error) {
    console.error('Create invite error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
