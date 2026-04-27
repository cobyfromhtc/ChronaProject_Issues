import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionWithFreshRoleFromRequest } from '@/lib/auth'
import { isStaff } from '@/lib/roles'

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionWithFreshRoleFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isStaff(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { action, targetUserId, reason, amount, message } = body

    switch (action) {
      case 'ban': {
        if (!targetUserId) return NextResponse.json({ error: 'Target user ID required' }, { status: 400 })
        const target = await db.user.findUnique({ where: { id: targetUserId } })
        if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
        
        await db.user.update({
          where: { id: targetUserId },
          data: { isBanned: true, banReason: reason || 'Banned by admin' }
        })
        
        await db.moderationAction.create({
          data: {
            adminId: user.id,
            targetId: targetUserId,
            action: 'ban',
            targetType: 'user',
            reason: reason || 'Banned by admin',
          }
        })

        await db.adminLog.create({
          data: {
            adminId: user.id,
            action: 'ban_user',
            targetType: 'user',
            targetId: targetUserId,
            details: reason || 'Banned by admin',
          }
        })
        
        return NextResponse.json({ success: true, message: `User ${target.username} has been banned` })
      }

      case 'unban': {
        if (!targetUserId) return NextResponse.json({ error: 'Target user ID required' }, { status: 400 })
        const target = await db.user.findUnique({ where: { id: targetUserId } })
        if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
        
        await db.user.update({
          where: { id: targetUserId },
          data: { isBanned: false, banReason: null }
        })

        await db.adminLog.create({
          data: {
            adminId: user.id,
            action: 'unban_user',
            targetType: 'user',
            targetId: targetUserId,
            details: 'Unbanned by admin',
          }
        })
        
        return NextResponse.json({ success: true, message: `User ${target.username} has been unbanned` })
      }

      case 'mute': {
        if (!targetUserId) return NextResponse.json({ error: 'Target user ID required' }, { status: 400 })
        const duration = body.duration || 60 // minutes
        const target = await db.user.findUnique({ where: { id: targetUserId } })
        if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
        
        const mutedUntil = new Date(Date.now() + duration * 60 * 1000)
        await db.user.update({
          where: { id: targetUserId },
          data: { isMuted: true, mutedUntil }
        })

        await db.moderationAction.create({
          data: {
            adminId: user.id,
            targetId: targetUserId,
            action: 'mute',
            targetType: 'user',
            reason: reason || 'Muted by admin',
            duration,
          }
        })

        await db.adminLog.create({
          data: {
            adminId: user.id,
            action: 'mute_user',
            targetType: 'user',
            targetId: targetUserId,
            details: `Muted for ${duration} minutes. Reason: ${reason || 'Muted by admin'}`,
          }
        })
        
        return NextResponse.json({ success: true, message: `User ${target.username} has been muted for ${duration} minutes` })
      }

      case 'unmute': {
        if (!targetUserId) return NextResponse.json({ error: 'Target user ID required' }, { status: 400 })
        const target = await db.user.findUnique({ where: { id: targetUserId } })
        if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
        
        await db.user.update({
          where: { id: targetUserId },
          data: { isMuted: false, mutedUntil: null }
        })

        await db.adminLog.create({
          data: {
            adminId: user.id,
            action: 'unmute_user',
            targetType: 'user',
            targetId: targetUserId,
            details: 'Unmuted by admin',
          }
        })
        
        return NextResponse.json({ success: true, message: `User ${target.username} has been unmuted` })
      }

      case 'suspend': {
        if (!targetUserId) return NextResponse.json({ error: 'Target user ID required' }, { status: 400 })
        const duration = body.duration || 1440 // 24h default
        const target = await db.user.findUnique({ where: { id: targetUserId } })
        if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
        
        const suspendedUntil = new Date(Date.now() + duration * 60 * 1000)
        await db.user.update({
          where: { id: targetUserId },
          data: { isSuspended: true, suspendedUntil, suspendReason: reason || 'Suspended by admin' }
        })

        await db.moderationAction.create({
          data: {
            adminId: user.id,
            targetId: targetUserId,
            action: 'suspend',
            targetType: 'user',
            reason: reason || 'Suspended by admin',
            duration,
          }
        })

        await db.adminLog.create({
          data: {
            adminId: user.id,
            action: 'suspend_user',
            targetType: 'user',
            targetId: targetUserId,
            details: `Suspended for ${duration} minutes. Reason: ${reason || 'Suspended by admin'}`,
          }
        })
        
        return NextResponse.json({ success: true, message: `User ${target.username} has been suspended for ${Math.floor(duration / 60)} hours` })
      }

      case 'warn': {
        if (!targetUserId) return NextResponse.json({ error: 'Target user ID required' }, { status: 400 })
        const target = await db.user.findUnique({ where: { id: targetUserId } })
        if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
        
        await db.user.update({
          where: { id: targetUserId },
          data: { warningCount: { increment: 1 } }
        })

        await db.moderationAction.create({
          data: {
            adminId: user.id,
            targetId: targetUserId,
            action: 'warn',
            targetType: 'user',
            reason: reason || 'Warning issued by admin',
          }
        })

        await db.notification.create({
          data: {
            userId: targetUserId,
            type: 'warning',
            title: 'You have received a warning',
            message: reason || 'A moderator has issued you a warning. Please review our community guidelines.',
          }
        })

        await db.adminLog.create({
          data: {
            adminId: user.id,
            action: 'warn_user',
            targetType: 'user',
            targetId: targetUserId,
            details: reason || 'Warning issued by admin',
          }
        })
        
        return NextResponse.json({ success: true, message: `Warning issued to ${target.username}` })
      }

      case 'grant_chronos': {
        if (!targetUserId || !amount) return NextResponse.json({ error: 'Target user ID and amount required' }, { status: 400 })
        const target = await db.user.findUnique({ where: { id: targetUserId } })
        if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
        
        const newBalance = target.chronos + amount
        await db.user.update({
          where: { id: targetUserId },
          data: { chronos: newBalance }
        })

        await db.chronosTransaction.create({
          data: {
            userId: targetUserId,
            amount,
            balance: newBalance,
            type: 'earn',
            category: 'admin_grant',
            description: reason || `Admin granted ${amount} Chronos`,
          }
        })

        await db.adminLog.create({
          data: {
            adminId: user.id,
            action: 'grant_chronos',
            targetType: 'user',
            targetId: targetUserId,
            details: `Granted ${amount} Chronos. Reason: ${reason || 'Admin grant'}`,
          }
        })
        
        return NextResponse.json({ success: true, message: `Granted ${amount} Chronos to ${target.username}` })
      }

      case 'broadcast': {
        if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 })
        
        // Get all users
        const users = await db.user.findMany({
          select: { id: true },
          take: 1000, // Limit to prevent abuse
        })

        // Create notifications for all users
        await db.notification.createMany({
          data: users.map(u => ({
            userId: u.id,
            type: 'broadcast',
            title: 'Announcement',
            message: message,
          }))
        })

        await db.adminLog.create({
          data: {
            adminId: user.id,
            action: 'broadcast',
            targetType: 'platform',
            details: message.slice(0, 200),
          }
        })
        
        return NextResponse.json({ success: true, message: `Broadcast sent to ${users.length} users` })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error in admin quick action:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET - fetch recent admin logs for activity feed
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionWithFreshRoleFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isStaff(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const logs = await db.adminLog.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        // adminId relation
      }
    })

    // Get admin usernames
    const adminIds = [...new Set(logs.map(l => l.adminId))]
    const admins = await db.user.findMany({
      where: { id: { in: adminIds } },
      select: { id: true, username: true, avatarUrl: true }
    })
    const adminMap = Object.fromEntries(admins.map(a => [a.id, a]))

    const formattedLogs = logs.map(log => ({
      id: log.id,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      details: log.details,
      createdAt: log.createdAt,
      admin: adminMap[log.adminId] || { id: log.adminId, username: 'Unknown', avatarUrl: null },
    }))

    return NextResponse.json({ logs: formattedLogs })
  } catch (error) {
    console.error('Error fetching admin logs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
