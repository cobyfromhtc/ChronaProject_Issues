import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// GET - Get all roles for storyline
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
    
    const roles = await db.storylineRole.findMany({
      where: { storylineId: id },
      orderBy: { position: 'desc' },
      include: {
        _count: { select: { members: true } }
      }
    })
    
    return NextResponse.json({ 
      success: true, 
      roles: roles.map(r => ({
        ...r,
        memberCount: r._count.members
      }))
    })
    
  } catch (error) {
    console.error('Get roles error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// POST - Create a new role
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
    const { 
      name, 
      color = '#8b5cf6',
      canManageChannels = false,
      canManageRoles = false,
      canKickMembers = false,
      canBanMembers = false,
      canManageMessages = false,
      canInvite = true,
      canChangeSettings = false,
      isAdmin = false
    } = body
    
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    
    // Check permissions
    const membership = await db.storylineMember.findFirst({
      where: { storylineId: id, userId: user.id },
      include: {
        customRole: {
          select: {
            canManageRoles: true,
          }
        }
      }
    })
    
    if (!membership) {
      return NextResponse.json({ error: 'Not a member' }, { status: 403 })
    }
    
    const hasManageRolesPermission = membership.role === 'owner' || 
      membership.role === 'admin' || 
      membership.customRole?.canManageRoles
    
    if (!hasManageRolesPermission) {
      return NextResponse.json({ error: 'Not authorized to manage roles' }, { status: 403 })
    }
    
    // Check if role name exists
    const existing = await db.storylineRole.findFirst({
      where: { storylineId: id, name: name.trim() }
    })
    
    if (existing) {
      return NextResponse.json({ error: 'Role name already exists' }, { status: 400 })
    }
    
    // Get max position
    const maxPosition = await db.storylineRole.findFirst({
      where: { storylineId: id },
      orderBy: { position: 'desc' },
      select: { position: true }
    })
    
    const role = await db.storylineRole.create({
      data: {
        storylineId: id,
        name: name.trim(),
        color,
        position: (maxPosition?.position ?? -1) + 1,
        canManageChannels,
        canManageRoles,
        canKickMembers,
        canBanMembers,
        canManageMessages,
        canInvite,
        canChangeSettings,
        isAdmin
      }
    })
    
    return NextResponse.json({ success: true, role })
    
  } catch (error) {
    console.error('Create role error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
