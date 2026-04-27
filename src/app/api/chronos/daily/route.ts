import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

const DAILY_BONUS_AMOUNT = 50

export async function POST() {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userData = await db.user.findUnique({
      where: { id: user.id },
      select: {
        chronos: true,
        lastDailyClaimAt: true,
      }
    })

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if already claimed today
    const now = new Date()
    const lastClaim = userData.lastDailyClaimAt

    if (lastClaim) {
      const lastClaimDate = new Date(lastClaim)
      const todayStart = new Date(now)
      todayStart.setHours(0, 0, 0, 0)
      const lastClaimStart = new Date(lastClaimDate)
      lastClaimStart.setHours(0, 0, 0, 0)

      if (lastClaimStart.getTime() >= todayStart.getTime()) {
        // Already claimed today
        const tomorrow = new Date(todayStart)
        tomorrow.setDate(tomorrow.getDate() + 1)
        const timeUntilReset = tomorrow.getTime() - now.getTime()
        const hoursLeft = Math.floor(timeUntilReset / (1000 * 60 * 60))
        const minutesLeft = Math.floor((timeUntilReset % (1000 * 60 * 60)) / (1000 * 60))

        return NextResponse.json({
          error: 'Already claimed today',
          canClaim: false,
          nextClaimIn: `${hoursLeft}h ${minutesLeft}m`,
        }, { status: 400 })
      }
    }

    // Grant the daily bonus
    const newBalance = userData.chronos + DAILY_BONUS_AMOUNT

    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        chronos: newBalance,
        lastDailyClaimAt: now,
      }
    })

    // Record the transaction
    await db.chronosTransaction.create({
      data: {
        userId: user.id,
        amount: DAILY_BONUS_AMOUNT,
        balance: newBalance,
        type: 'earn',
        category: 'daily_bonus',
        description: 'Daily login bonus',
      }
    })

    return NextResponse.json({
      success: true,
      chronos: updatedUser.chronos,
      amount: DAILY_BONUS_AMOUNT,
      canClaim: false,
      nextClaimIn: '24h',
    })
  } catch (error) {
    console.error('Error claiming daily bonus:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET - Check if daily bonus can be claimed
export async function GET() {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userData = await db.user.findUnique({
      where: { id: user.id },
      select: { lastDailyClaimAt: true }
    })

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const now = new Date()
    const lastClaim = userData.lastDailyClaimAt
    let canClaim = true
    let nextClaimIn = 'Now!'

    if (lastClaim) {
      const lastClaimDate = new Date(lastClaim)
      const todayStart = new Date(now)
      todayStart.setHours(0, 0, 0, 0)
      const lastClaimStart = new Date(lastClaimDate)
      lastClaimStart.setHours(0, 0, 0, 0)

      if (lastClaimStart.getTime() >= todayStart.getTime()) {
        canClaim = false
        const tomorrow = new Date(todayStart)
        tomorrow.setDate(tomorrow.getDate() + 1)
        const timeUntilReset = tomorrow.getTime() - now.getTime()
        const hoursLeft = Math.floor(timeUntilReset / (1000 * 60 * 60))
        const minutesLeft = Math.floor((timeUntilReset % (1000 * 60 * 60)) / (1000 * 60))
        nextClaimIn = `${hoursLeft}h ${minutesLeft}m`
      }
    }

    return NextResponse.json({
      canClaim,
      nextClaimIn,
      amount: DAILY_BONUS_AMOUNT,
    })
  } catch (error) {
    console.error('Error checking daily bonus status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
