import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// DELETE - Kick a member
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string, memberId: string }> }
) {
  try {
    const user = await getSession()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    const { id, memberId } = await params
    
    // Check permissions
    const membership = await db.storylineMember.findFirst({
      where: { storylineId: id, userId: user.id },
      include: {
        customRole: {
          select: {
            canKickMembers: true,
            position: true,
          }
        }
      }
    })
    
    if (!membership) {
      return NextResponse.json({ error: 'Not a member' }, { status: 403 })
    }
    
    const canKickMembers = membership.role === 'owner' || 
      membership.role === 'admin' || 
      membership.customRole?.canKickMembers
    
    if (!canKickMembers) {
      return NextResponse.json({ error: 'Not authorized to kick' }, { status: 403 })
    }
    
    // Get target member
    const targetMember = await db.storylineMember.findUnique({
      where: { id: memberId },
      include: {
        customRole: {
          select: {
            position: true,
          }
        }
      }
    })
    
    if (!targetMember || targetMember.storylineId !== id) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }
    
    // Can't kick owners
    if (targetMember.role === 'owner') {
      return NextResponse.json({ error: 'Cannot kick the owner' }, { status: 400 })
    }
    
    // Can't kick yourself
    if (targetMember.userId === user.id) {
      return NextResponse.json({ error: 'Cannot kick yourself' }, { status: 400 })
    }
    
    // Check role hierarchy
    if (membership.customRole && targetMember.customRole) {
      if (membership.customRole.position <= targetMember.customRole.position) {
        return NextResponse.json({ error: 'Cannot kick someone with equal or higher role' }, { status: 400 })
      }
    }
    
    await db.storylineMember.delete({
      where: { id: memberId }
    })
    
    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('Kick member error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// PUT - Update member role
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string, memberId: string }> }
) {
  try {
    const user = await getSession()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    const { id, memberId } = await params
    const body = await request.json()
    const { roleId } = body
    
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
    
    const canManageRoles = membership.role === 'owner' || 
      membership.role === 'admin' || 
      membership.customRole?.canManageRoles
    
    if (!canManageRoles) {
      return NextResponse.json({ error: 'Not authorized to manage roles' }, { status: 403 })
    }
    
    // Get target member
    const targetMember = await db.storylineMember.findUnique({
      where: { id: memberId }
    })
    
    if (!targetMember || targetMember.storylineId !== id) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }
    
    // Can't change owner's role
    if (targetMember.role === 'owner') {
      return NextResponse.json({ error: 'Cannot change owner role' }, { status: 400 })
    }
    
    // Validate role exists and belongs to this storyline
    if (roleId) {
      const role = await db.storylineRole.findUnique({
        where: { id: roleId }
      })
      
      if (!role || role.storylineId !== id) {
        return NextResponse.json({ error: 'Role not found' }, { status: 400 })
      }
    }
    
    const updated = await db.storylineMember.update({
      where: { id: memberId },
      data: { roleId: roleId || null }
    })
    
    return NextResponse.json({ success: true, member: updated })
    
  } catch (error) {
    console.error('Update member role error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
