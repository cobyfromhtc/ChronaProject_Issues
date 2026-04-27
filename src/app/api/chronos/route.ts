import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

// Chronos API Route - Get user's Chronos balance and transaction history
// Updated: Force rebuild to pick up new Prisma client
export async function GET() {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user with chronos data
    const userData = await db.user.findUnique({
      where: { id: user.id },
      select: {
        chronos: true,
        purchasedSlots: true,
        nameColor: true,
        dailyImagesUsed: true,
        dailyImagesResetAt: true,
        hasFirstPurchaseBonus: true,
        lastDailyClaimAt: true,
      }
    })

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if we need to reset daily images
    const now = new Date()
    const resetAt = userData.dailyImagesResetAt
    let needsReset = false

    if (!resetAt || new Date(resetAt) < now) {
      needsReset = true
      // Reset daily images
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(0, 0, 0, 0)

      await db.user.update({
        where: { id: user.id },
        data: {
          dailyImagesUsed: 0,
          dailyImagesResetAt: tomorrow
        }
      })
    }

    // Get persona count for slot calculation
    const personaCount = await db.persona.count({
      where: { userId: user.id }
    })

    // Calculate available slots
    const FREE_SLOTS = 25
    const totalSlots = FREE_SLOTS + userData.purchasedSlots
    const usedSlots = personaCount
    const availableSlots = totalSlots - usedSlots

    // Get recent transactions (last 20)
    const transactions = await db.chronosTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20
    })

    // Get owned themes
    const ownedThemes = await db.profileTheme.findMany({
      where: { ownerId: user.id },
      select: { id: true }
    })

    return NextResponse.json({
      chronos: userData.chronos,
      hasFirstPurchaseBonus: userData.hasFirstPurchaseBonus,
      nameColor: userData.nameColor,
      dailyImagesUsed: needsReset ? 0 : userData.dailyImagesUsed,
      dailyImagesLimit: 10,
      lastDailyClaimAt: userData.lastDailyClaimAt,
      slots: {
        free: FREE_SLOTS,
        purchased: userData.purchasedSlots,
        total: totalSlots,
        used: usedSlots,
        available: availableSlots
      },
      transactions,
      ownedThemes: ownedThemes.map(t => t.id)
    })
  } catch (error) {
    console.error('Error fetching chronos data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
