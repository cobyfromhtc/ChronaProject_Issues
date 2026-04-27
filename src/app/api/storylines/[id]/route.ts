import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { isMinor } from '@/lib/age-utils'

// GET - Get storyline details
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
    
    // Age-gating: Fetch user's DOB to check if they can access adult storylines
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { dateOfBirth: true }
    })
    const userDob = dbUser?.dateOfBirth ?? null
    const isUserMinor = isMinor(userDob)
    
    const storyline = await db.storyline.findUnique({
      where: { id },
      include: {
        owner: {
          select: { id: true, username: true, avatarUrl: true }
        },
        members: {
          include: {
            user: {
              select: { id: true, username: true, avatarUrl: true }
            },
            customRole: true
          }
        },
        roles: {
          orderBy: { position: 'desc' }
        },
        categories: {
          orderBy: { position: 'asc' },
          include: {
            channels: {
              orderBy: { position: 'asc' }
            }
          }
        },
        channels: {
          orderBy: { position: 'asc' }
        },
        invites: {
          where: { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
          orderBy: { createdAt: 'desc' }
        },
        _count: {
          select: { members: true }
        }
      }
    })
    
    if (!storyline) {
      return NextResponse.json({ error: 'Storyline not found' }, { status: 404 })
    }
    
    // Age-gating: If storyline is adult and user is a minor, return 403
    if (storyline.isAdult && isUserMinor) {
      return NextResponse.json({ error: 'You must be 18+ to view adult storylines' }, { status: 403 })
    }
    
    // Check if user is member
    const membership = await db.storylineMember.findFirst({
      where: { storylineId: id, userId: user.id },
      include: { customRole: true }
    })
    
    // Check if user is banned
    const ban = await db.storylineBan.findUnique({
      where: { storylineId_userId: { storylineId: id, userId: user.id } }
    })
    
    if (ban) {
      return NextResponse.json({ error: 'You are banned from this storyline', reason: ban.reason }, { status: 403 })
    }
    
    return NextResponse.json({ 
      success: true, 
      storyline: {
        id: storyline.id,
        name: storyline.name,
        description: storyline.description,
        lore: storyline.lore,
        iconUrl: storyline.iconUrl,
        bannerUrl: storyline.bannerUrl,
        category: storyline.category,
        isPublic: storyline.isPublic,
        accentColor: storyline.accentColor,
        welcomeMessage: storyline.welcomeMessage,
        requireApproval: storyline.requireApproval,
        memberCap: storyline.memberCap,
        createdAt: storyline.createdAt,
        owner: storyline.owner,
        memberCount: storyline._count.members,
        isMember: !!membership,
        role: membership?.role || null,
        customRole: membership?.customRole || null,
        roles: storyline.roles,
        categories: storyline.categories,
        channels: storyline.channels,
        invites: storyline.invites,
        members: storyline.members.map(m => ({
          id: m.id,
          role: m.role,
          customRole: m.customRole,
          joinedAt: m.joinedAt,
          user: m.user
        }))
      }
    })
    
  } catch (error) {
    console.error('Get storyline error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// PUT - Update storyline settings
export async function PUT(
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
    const { 
      name, 
      description, 
      lore,
      iconUrl, 
      bannerUrl, 
      category, 
      isPublic,
      isAdult: requestedIsAdult,
      accentColor,
      welcomeMessage,
      requireApproval,
      memberCap
    } = body
    
    // Age-gating: Fetch user's DOB to prevent minors from setting isAdult
    const dbUserForUpdate = await db.user.findUnique({
      where: { id: user.id },
      select: { dateOfBirth: true }
    })
    const isUserMinorForUpdate = isMinor(dbUserForUpdate?.dateOfBirth ?? null)
    
    // Check if user has permission to change settings
    const membership = await db.storylineMember.findFirst({
      where: { storylineId: id, userId: user.id },
      include: {
        customRole: {
          select: {
            canChangeSettings: true,
          }
        }
      }
    })
    
    if (!membership) {
      return NextResponse.json({ error: 'Not a member' }, { status: 403 })
    }
    
    // Check custom role permissions or owner/admin role
    const canChangeSettings = membership.role === 'owner' || 
      membership.role === 'admin' ||
      (membership.customRole?.canChangeSettings)
    
    if (!canChangeSettings) {
      return NextResponse.json({ error: 'Not authorized to change settings' }, { status: 403 })
    }
    
    const updateData: Record<string, unknown> = {}
    
    if (name !== undefined) updateData.name = name?.trim()
    if (description !== undefined) updateData.description = description?.trim() || null
    if (lore !== undefined) updateData.lore = lore?.trim() || null
    if (iconUrl !== undefined) updateData.iconUrl = iconUrl || null
    if (bannerUrl !== undefined) updateData.bannerUrl = bannerUrl || null
    if (category !== undefined) updateData.category = category
    if (isPublic !== undefined) updateData.isPublic = isPublic
    // Age-gating: Prevent minors from setting isAdult to true
    if (requestedIsAdult !== undefined) {
      updateData.isAdult = isUserMinorForUpdate ? false : requestedIsAdult
    }
    if (accentColor !== undefined) updateData.accentColor = accentColor
    if (welcomeMessage !== undefined) updateData.welcomeMessage = welcomeMessage?.trim() || null
    if (requireApproval !== undefined) updateData.requireApproval = requireApproval
    if (memberCap !== undefined) updateData.memberCap = memberCap || null
    
    const updated = await db.storyline.update({
      where: { id },
      data: updateData
    })
    
    return NextResponse.json({ success: true, storyline: updated })
    
  } catch (error) {
    console.error('Update storyline error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// DELETE - Delete storyline
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
    
    // Check if user is owner
    const membership = await db.storylineMember.findFirst({
      where: { storylineId: id, userId: user.id, role: 'owner' }
    })
    
    if (!membership) {
      return NextResponse.json({ error: 'Only owner can delete storyline' }, { status: 403 })
    }
    
    await db.storyline.delete({ where: { id } })
    
    return NextResponse.json({ success: true, message: 'Storyline deleted' })
    
  } catch (error) {
    console.error('Delete storyline error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
