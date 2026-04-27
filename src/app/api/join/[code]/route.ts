import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// GET - Get invite info
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params
    
    const invite = await db.storylineInvite.findUnique({
      where: { code },
      include: {
        storyline: {
          include: {
            owner: { select: { username: true, avatarUrl: true } },
            _count: { select: { members: true } }
          }
        }
      }
    })
    
    if (!invite) {
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 })
    }
    
    // Check if expired
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'This invite has expired' }, { status: 400 })
    }
    
    // Check if max uses reached
    if (invite.maxUses && invite.uses >= invite.maxUses) {
      return NextResponse.json({ error: 'This invite has reached its maximum uses' }, { status: 400 })
    }
    
    return NextResponse.json({
      success: true,
      invite: {
        code: invite.code,
        storyline: {
          id: invite.storyline.id,
          name: invite.storyline.name,
          description: invite.storyline.description,
          iconUrl: invite.storyline.iconUrl,
          bannerUrl: invite.storyline.bannerUrl,
          category: invite.storyline.category,
          memberCount: invite.storyline._count.members,
          memberCap: invite.storyline.memberCap,
          requireApproval: invite.storyline.requireApproval,
          owner: invite.storyline.owner
        }
      }
    })
    
  } catch (error) {
    console.error('Get invite error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// POST - Join storyline via invite
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const user = await getSession()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    const { code } = await params
    
    const invite = await db.storylineInvite.findUnique({
      where: { code },
      include: {
        storyline: true
      }
    })
    
    if (!invite) {
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 })
    }
    
    // Check if expired
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'This invite has expired' }, { status: 400 })
    }
    
    // Check if max uses reached
    if (invite.maxUses && invite.uses >= invite.maxUses) {
      return NextResponse.json({ error: 'This invite has reached its maximum uses' }, { status: 400 })
    }
    
    // Check if already a member
    const existingMember = await db.storylineMember.findFirst({
      where: { storylineId: invite.storylineId, userId: user.id }
    })
    
    if (existingMember) {
      return NextResponse.json({ error: 'You are already a member of this storyline', storylineId: invite.storylineId }, { status: 400 })
    }
    
    // Check if banned
    const ban = await db.storylineBan.findUnique({
      where: { storylineId_userId: { storylineId: invite.storylineId, userId: user.id } }
    })
    
    if (ban) {
      return NextResponse.json({ error: 'You are banned from this storyline' }, { status: 403 })
    }
    
    // Check member cap
    if (invite.storyline.memberCap) {
      const memberCount = await db.storylineMember.count({
        where: { storylineId: invite.storylineId }
      })
      if (memberCount >= invite.storyline.memberCap) {
        return NextResponse.json({ error: 'This storyline has reached its member limit' }, { status: 400 })
      }
    }
    
    // Check if requires approval
    if (invite.storyline.requireApproval) {
      // For now, just reject - in future, create a join request
      return NextResponse.json({ error: 'This storyline requires approval to join. Contact the owner.' }, { status: 400 })
    }
    
    // Get the default member role
    const memberRole = await db.storylineRole.findFirst({
      where: { storylineId: invite.storylineId, name: 'Member' }
    })
    
    // Join the storyline
    await db.storylineMember.create({
      data: {
        storylineId: invite.storylineId,
        userId: user.id,
        role: 'member',
        roleId: memberRole?.id
      }
    })
    
    // Increment invite uses
    await db.storylineInvite.update({
      where: { code },
      data: { uses: { increment: 1 } }
    })
    
    return NextResponse.json({ 
      success: true, 
      storylineId: invite.storylineId,
      message: 'Successfully joined!' 
    })
    
  } catch (error) {
    console.error('Join storyline error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
