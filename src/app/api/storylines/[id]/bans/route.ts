import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// GET - Get all bans for storyline
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
    
    // Check permissions
    const membership = await db.storylineMember.findFirst({
      where: { storylineId: id, userId: user.id },
      include: {
        customRole: {
          select: {
            canBanMembers: true,
            position: true,
          }
        }
      }
    })
    
    if (!membership) {
      return NextResponse.json({ error: 'Not a member' }, { status: 403 })
    }
    
    const canBanMembers = membership.role === 'owner' || 
      membership.role === 'admin' || 
      membership.customRole?.canBanMembers
    
    if (!canBanMembers) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }
    
    const bans = await db.storylineBan.findMany({
      where: { storylineId: id },
      include: {
        // We don't have a User relation for banned user, so we get user info differently
      }
    })
    
    return NextResponse.json({ success: true, bans })
    
  } catch (error) {
    console.error('Get bans error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// POST - Ban a user
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
    const { userId: targetUserId, reason } = body
    
    if (!targetUserId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }
    
    // Check permissions
    const membership = await db.storylineMember.findFirst({
      where: { storylineId: id, userId: user.id },
      include: {
        customRole: {
          select: {
            canBanMembers: true,
            position: true,
          }
        }
      }
    })
    
    if (!membership) {
      return NextResponse.json({ error: 'Not a member' }, { status: 403 })
    }
    
    const canBanMembers = membership.role === 'owner' || 
      membership.role === 'admin' || 
      membership.customRole?.canBanMembers
    
    if (!canBanMembers) {
      return NextResponse.json({ error: 'Not authorized to ban' }, { status: 403 })
    }
    
    // Check if target is member
    const targetMembership = await db.storylineMember.findFirst({
      where: { storylineId: id, userId: targetUserId },
      include: {
        customRole: {
          select: {
            canBanMembers: true,
            position: true,
          }
        }
      }
    })
    
    if (!targetMembership) {
      return NextResponse.json({ error: 'User is not a member' }, { status: 400 })
    }
    
    // Can't ban owners
    if (targetMembership.role === 'owner') {
      return NextResponse.json({ error: 'Cannot ban the owner' }, { status: 400 })
    }
    
    // Check role hierarchy (if both have custom roles)
    if (membership.customRole && targetMembership.customRole) {
      if (membership.customRole.position <= targetMembership.customRole.position) {
        return NextResponse.json({ error: 'Cannot ban someone with equal or higher role' }, { status: 400 })
      }
    }
    
    // Remove member
    await db.storylineMember.delete({
      where: { id: targetMembership.id }
    })
    
    // Create ban record
    const ban = await db.storylineBan.create({
      data: {
        storylineId: id,
        userId: targetUserId,
        bannedById: user.id,
        reason: reason?.trim() || null
      }
    })
    
    return NextResponse.json({ success: true, ban })
    
  } catch (error) {
    console.error('Ban user error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// DELETE - Unban a user
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
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }
    
    // Check permissions
    const membership = await db.storylineMember.findFirst({
      where: { storylineId: id, userId: user.id },
      include: {
        customRole: {
          select: {
            canBanMembers: true,
          }
        }
      }
    })
    
    if (!membership) {
      return NextResponse.json({ error: 'Not a member' }, { status: 403 })
    }
    
    const canBanMembers = membership.role === 'owner' || 
      membership.role === 'admin' || 
      membership.customRole?.canBanMembers
    
    if (!canBanMembers) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }
    
    await db.storylineBan.delete({
      where: { storylineId_userId: { storylineId: id, userId } }
    })
    
    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('Unban user error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
