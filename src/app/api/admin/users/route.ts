import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionWithFreshRoleFromRequest } from '@/lib/auth'

// GET - List users with pagination and search
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionWithFreshRoleFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is staff
    if (!['mod', 'admin', 'owner'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden - Staff only' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const role = searchParams.get('role') || ''

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}
    if (search) {
      where.OR = [
        { username: { contains: search } },
        { email: { contains: search } }
      ]
    }
    if (role) {
      where.role = role
    }

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          username: true,
          email: true,
          avatarUrl: true,
          role: true,
          chronos: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              personas: true,
              storylineMembers: true,
              chronosTransactions: true
            }
          }
        }
      }),
      db.user.count({ where })
    ])

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update user role
export async function PATCH(request: NextRequest) {
  try {
    const user = await getSessionWithFreshRoleFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and owner can change roles (NOT moderators)
    if (!['admin', 'owner'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden - Admin only. Moderators cannot change roles.' }, { status: 403 })
    }

    const body = await request.json()
    const { userId, role } = body

    if (!userId || !role) {
      return NextResponse.json({ error: 'Missing userId or role' }, { status: 400 })
    }

    // Prevent changing your own role
    if (userId === user.id) {
      return NextResponse.json({ error: 'You cannot change your own role' }, { status: 400 })
    }

    // Validate role
    const validRoles = ['user', 'mod', 'admin', 'owner']
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    // Get target user
    const targetUser = await db.user.findUnique({ where: { id: userId } })
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Permission checks based on hierarchy
    // Owner: can do anything except change their own role (already checked above)
    // Admin: can only change user <-> mod, cannot touch admins or owners

    if (user.role === 'admin') {
      // Admins cannot promote anyone to admin or owner
      if (role === 'admin' || role === 'owner') {
        return NextResponse.json({ error: 'Admins cannot promote to admin or owner' }, { status: 403 })
      }
      
      // Admins cannot demote other admins or owners
      if (targetUser.role === 'admin' || targetUser.role === 'owner') {
        return NextResponse.json({ error: 'Admins cannot modify other admins or owners' }, { status: 403 })
      }
    }

    // Only owner can assign owner role
    if (role === 'owner' && user.role !== 'owner') {
      return NextResponse.json({ error: 'Only owners can assign owner role' }, { status: 403 })
    }

    // Only owner can modify existing owners
    if (targetUser.role === 'owner' && user.role !== 'owner') {
      return NextResponse.json({ error: 'Cannot modify owner' }, { status: 403 })
    }

    // Only owner can modify existing admins (except themselves, already checked)
    if (targetUser.role === 'admin' && user.role !== 'owner') {
      return NextResponse.json({ error: 'Only owners can modify admins' }, { status: 403 })
    }

    // Update user role
    const updatedUser = await db.user.update({
      where: { id: userId },
      data: { role }
    })

    // Log the action
    await db.adminLog.create({
      data: {
        adminId: user.id,
        action: 'change_role',
        targetType: 'user',
        targetId: userId,
        details: JSON.stringify({ oldRole: targetUser.role, newRole: role })
      }
    })

    return NextResponse.json({ user: updatedUser })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
