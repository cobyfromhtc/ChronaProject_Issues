import { NextRequest, NextResponse } from 'next/server'
import { getSessionWithFreshRoleFromRequest } from '@/lib/auth'

// Dynamic import to force fresh PrismaClient with Notification model
async function getPrisma() {
  const { PrismaClient } = await import('@prisma/client')
  return new PrismaClient()
}

// GET - List chronos transactions
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
    const type = searchParams.get('type') || ''
    const userId = searchParams.get('userId') || ''

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}
    if (type) {
      where.type = type
    }
    if (userId) {
      where.userId = userId
    }

    const prisma = await getPrisma()
    const [transactions, total] = await Promise.all([
      prisma.chronosTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatarUrl: true
            }
          }
        }
      }),
      prisma.chronosTransaction.count({ where })
    ])

    return NextResponse.json({
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching transactions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Add or remove Chronos from a user, or reset to 0
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionWithFreshRoleFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and owner can modify Chronos
    if (!['admin', 'owner'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    const body = await request.json()
    const { targetUserId, amount, reason, reset } = body

    if (!targetUserId || !reason) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const prisma = await getPrisma()
    
    // Get target user
    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } })
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    let newBalance: number
    let transactionAmount: number
    let actionType: string
    let category: string
    let notificationType: string
    let notificationTitle: string
    let notificationMessage: string

    if (reset) {
      // Reset balance to 0
      transactionAmount = -targetUser.chronos // Negative of current balance
      newBalance = 0
      actionType = 'reset_chronos'
      category = 'admin_reset'
      notificationType = 'chronos_reset'
      notificationTitle = 'Chronos Reset'
      notificationMessage = `Your Chronos balance has been reset to 0.\n\nReason: ${reason}`
    } else {
      // Normal add/subtract
      if (!amount) {
        return NextResponse.json({ error: 'Missing amount' }, { status: 400 })
      }
      
      const amountNum = parseInt(amount)
      if (isNaN(amountNum) || amountNum === 0) {
        return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
      }

      transactionAmount = amountNum
      newBalance = targetUser.chronos + amountNum
      actionType = amountNum > 0 ? 'grant_chronos' : 'deduct_chronos'
      category = amountNum > 0 ? 'admin_grant' : 'admin_deduct'
      notificationType = amountNum > 0 ? 'chronos_grant' : 'chronos_deduct'
      
      if (amountNum > 0) {
        notificationTitle = 'Chronos Granted'
        notificationMessage = `You have been granted ${amountNum} Chronos!\n\nReason: ${reason}\n\nNew balance: ${newBalance} Chronos`
      } else {
        notificationTitle = 'Chronos Deducted'
        notificationMessage = `${Math.abs(amountNum)} Chronos have been deducted from your balance.\n\nReason: ${reason}\n\nNew balance: ${newBalance} Chronos`
      }

      if (newBalance < 0) {
        return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 })
      }
    }

    // Update user balance
    await prisma.user.update({
      where: { id: targetUserId },
      data: { chronos: newBalance }
    })

    // Create transaction record
    const transaction = await prisma.chronosTransaction.create({
      data: {
        userId: targetUserId,
        amount: transactionAmount,
        balance: newBalance,
        type: 'admin',
        category,
        description: `Admin: ${reason}`
      }
    })

    // Create notification for the user
    await prisma.notification.create({
      data: {
        userId: targetUserId,
        type: notificationType,
        title: notificationTitle,
        message: notificationMessage,
        data: JSON.stringify({
          previousBalance: targetUser.chronos,
          newBalance,
          amount: transactionAmount,
          reason,
          adminId: user.id,
          adminUsername: user.username,
          transactionId: transaction.id
        })
      }
    })

    // Log the action
    await prisma.adminLog.create({
      data: {
        adminId: user.id,
        action: actionType,
        targetType: 'user',
        targetId: targetUserId,
        details: JSON.stringify({ 
          previousBalance: targetUser.chronos,
          newBalance, 
          amount: transactionAmount,
          reason, 
          transactionId: transaction.id 
        })
      }
    })

    return NextResponse.json({
      success: true,
      transaction,
      newBalance,
      previousBalance: targetUser.chronos
    })
  } catch (error) {
    console.error('Error modifying Chronos:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
