import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionWithFreshRoleFromRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionWithFreshRoleFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is staff (mod, admin, or owner)
    if (!['mod', 'admin', 'owner'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden - Staff only' }, { status: 403 })
    }

    // Get various statistics
    const [
      totalUsers,
      totalStorylines,
      totalPersonas,
      totalMessages,
      totalDmMessages,
      pendingReports,
      totalChronosInCirculation,
      recentUsers,
      recentTransactions
    ] = await Promise.all([
      // Total users
      db.user.count(),
      
      // Total storylines
      db.storyline.count(),
      
      // Total personas
      db.persona.count(),
      
      // Total storyline messages
      db.storylineMessage.count(),
      
      // Total DM messages
      db.message.count(),
      
      // Pending reports
      db.report.count({ where: { status: 'pending' } }),
      
      // Total Chronos in circulation
      db.user.aggregate({
        _sum: { chronos: true }
      }),
      
      // Users registered in last 7 days
      db.user.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      }),
      
      // Transactions in last 7 days
      db.chronosTransaction.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      })
    ])

    // Get new users per day for last 7 days
    const last7Days: { date: string; count: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)
      const nextDate = new Date(date)
      nextDate.setDate(nextDate.getDate() + 1)
      
      const count = await db.user.count({
        where: {
          createdAt: {
            gte: date,
            lt: nextDate
          }
        }
      })
      
      last7Days.push({
        date: date.toISOString().split('T')[0],
        count
      })
    }

    // Get role distribution
    const roleDistribution = await db.user.groupBy({
      by: ['role'],
      _count: { role: true }
    })

    return NextResponse.json({
      stats: {
        totalUsers,
        totalStorylines,
        totalPersonas,
        totalMessages: totalMessages + totalDmMessages,
        storylineMessages: totalMessages,
        dmMessages: totalDmMessages,
        pendingReports,
        totalChronosInCirculation: totalChronosInCirculation._sum.chronos || 0,
        recentUsers,
        recentTransactions
      },
      charts: {
        newUsersPerDay: last7Days,
        roleDistribution: roleDistribution.map(r => ({ role: r.role, count: r._count.role }))
      }
    })
  } catch (error) {
    console.error('Error fetching admin stats:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
