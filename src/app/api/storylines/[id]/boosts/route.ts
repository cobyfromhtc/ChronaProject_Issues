import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { getTierInfo } from '@/lib/boost-tiers'

// GET - Get all active boosts for a storyline
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    const { id: storylineId } = await params
    
    // Check if storyline exists
    const storyline = await db.storyline.findUnique({
      where: { id: storylineId },
      select: { 
        id: true, 
        name: true, 
        boostChronos: true, 
        boostTier: true 
      }
    })
    
    if (!storyline) {
      return NextResponse.json({ error: 'Storyline not found' }, { status: 404 })
    }
    
    // Check if user is a member
    const membership = await db.storylineMember.findFirst({
      where: { storylineId, userId: user.id }
    })
    
    if (!membership) {
      return NextResponse.json({ 
        error: 'You must be a member to view boosters' 
      }, { status: 403 })
    }
    
    // Get all active boosts with persona info
    const activeBoosts = await db.storylineBoost.findMany({
      where: {
        storylineId,
        expiresAt: { gt: new Date() }
      },
      include: {
        persona: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            user: {
              select: {
                id: true,
                username: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    
    // Calculate real-time boost stats
    const totalBoostChronos = activeBoosts.reduce((sum, b) => sum + b.amount, 0)
    const tierInfo = getTierInfo(totalBoostChronos)
    
    // Format boosts for response
    const formattedBoosts = activeBoosts.map(boost => ({
      id: boost.id,
      amount: boost.amount,
      expiresAt: boost.expiresAt,
      createdAt: boost.createdAt,
      persona: {
        id: boost.persona.id,
        name: boost.persona.name,
        avatarUrl: boost.persona.avatarUrl,
        username: boost.persona.user.username
      }
    }))
    
    return NextResponse.json({
      success: true,
      boosts: formattedBoosts,
      boostStats: {
        boostChronos: totalBoostChronos,
        boostTier: tierInfo.tier,
        currentThreshold: tierInfo.currentThreshold,
        nextThreshold: tierInfo.nextThreshold,
        progress: tierInfo.progress,
        chronosToNext: tierInfo.chronosToNext
      }
    })
    
  } catch (error) {
    console.error('Get boosts error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
