import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTierFromChronos } from '@/lib/boost-tiers'

// Cron secret for authentication
const CRON_SECRET = process.env.CRON_SECRET || 'chrona-cron-secret-change-in-production'

// POST - Expire old boosts (called by cron job)
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('x-cron-secret')
    
    if (authHeader !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const now = new Date()
    
    // Find all expired boosts
    const expiredBoosts = await db.storylineBoost.findMany({
      where: {
        expiresAt: { lte: now }
      },
      select: {
        id: true,
        storylineId: true
      }
    })
    
    if (expiredBoosts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No expired boosts found',
        expiredCount: 0
      })
    }
    
    // Get unique storyline IDs that need updating
    const affectedStorylineIds = [...new Set(expiredBoosts.map(b => b.storylineId))]
    
    // Delete expired boosts
    const deleteResult = await db.storylineBoost.deleteMany({
      where: {
        id: { in: expiredBoosts.map(b => b.id) }
      }
    })
    
    // Recalculate boost totals for affected storylines
    const updatePromises = affectedStorylineIds.map(async (storylineId) => {
      // Get remaining active boosts
      const activeBoosts = await db.storylineBoost.findMany({
        where: {
          storylineId,
          expiresAt: { gt: now }
        },
        select: { amount: true }
      })
      
      const totalBoostChronos = activeBoosts.reduce((sum, b) => sum + b.amount, 0)
      const newTier = getTierFromChronos(totalBoostChronos)
      
      // Update storyline
      return db.storyline.update({
        where: { id: storylineId },
        data: {
          boostChronos: totalBoostChronos,
          boostTier: newTier
        }
      })
    })
    
    await Promise.all(updatePromises)
    
    return NextResponse.json({
      success: true,
      message: `Expired ${deleteResult.count} boosts and updated ${affectedStorylineIds.length} storylines`,
      expiredCount: deleteResult.count,
      updatedStorylines: affectedStorylineIds.length
    })
    
  } catch (error) {
    console.error('Expire boosts cron error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
