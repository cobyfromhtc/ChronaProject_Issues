import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { 
  BOOST_AMOUNTS, 
  getTierFromChronos, 
  calculateBoostExpiry,
  BoostAmount 
} from '@/lib/boost-tiers'

// POST - Boost a storyline with Chronos
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    const { id: storylineId } = await params
    const body = await request.json()
    const { amount } = body
    
    // Validate amount
    if (!amount || !BOOST_AMOUNTS.includes(amount as BoostAmount)) {
      return NextResponse.json({ 
        error: 'Invalid boost amount. Must be 200, 500, or 1000.' 
      }, { status: 400 })
    }
    
    const boostAmount = amount as BoostAmount
    
    // Get user's active persona
    const activePersona = await db.persona.findFirst({
      where: { 
        userId: user.id, 
        isActive: true 
      }
    })
    
    if (!activePersona) {
      return NextResponse.json({ 
        error: 'You need an active persona to boost a storyline' 
      }, { status: 400 })
    }
    
    // Check if user is a member of the storyline
    const membership = await db.storylineMember.findFirst({
      where: { storylineId, userId: user.id }
    })
    
    if (!membership) {
      return NextResponse.json({ 
        error: 'You must be a member of the storyline to boost it' 
      }, { status: 403 })
    }
    
    // Get the storyline
    const storyline = await db.storyline.findUnique({
      where: { id: storylineId }
    })
    
    if (!storyline) {
      return NextResponse.json({ error: 'Storyline not found' }, { status: 404 })
    }
    
    // Get user's Chronos balance
    const userData = await db.user.findUnique({
      where: { id: user.id },
      select: { chronos: true }
    })
    
    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    
    // Check if user has enough Chronos
    if (userData.chronos < boostAmount) {
      return NextResponse.json({ 
        error: 'Insufficient Chronos',
        required: boostAmount,
        current: userData.chronos 
      }, { status: 400 })
    }
    
    // Calculate expiry date (30 days from now)
    const expiresAt = calculateBoostExpiry()
    
    // Create the boost and update user's Chronos in a transaction
    const [boost, updatedUser] = await db.$transaction([
      // Create boost record
      db.storylineBoost.create({
        data: {
          storylineId,
          personaId: activePersona.id,
          amount: boostAmount,
          expiresAt
        }
      }),
      // Deduct Chronos from user
      db.user.update({
        where: { id: user.id },
        data: { chronos: { decrement: boostAmount } }
      }),
      // Record the transaction
      db.chronosTransaction.create({
        data: {
          userId: user.id,
          amount: -boostAmount,
          balance: userData.chronos - boostAmount,
          type: 'spend',
          category: 'storyline_boost',
          description: `Boosted storyline "${storyline.name}" with ${boostAmount} Chronos`,
          referenceId: storylineId
        }
      })
    ])
    
    // Recalculate total active boost Chronos
    const activeBoosts = await db.storylineBoost.findMany({
      where: {
        storylineId,
        expiresAt: { gt: new Date() }
      },
      select: { amount: true }
    })
    
    const totalBoostChronos = activeBoosts.reduce((sum, b) => sum + b.amount, 0)
    const newTier = getTierFromChronos(totalBoostChronos)
    
    // Update storyline with new boost totals
    const updatedStoryline = await db.storyline.update({
      where: { id: storylineId },
      data: {
        boostChronos: totalBoostChronos,
        boostTier: newTier
      }
    })
    
    return NextResponse.json({
      success: true,
      boost: {
        id: boost.id,
        amount: boost.amount,
        expiresAt: boost.expiresAt,
        persona: {
          id: activePersona.id,
          name: activePersona.name,
          avatarUrl: activePersona.avatarUrl
        }
      },
      storyline: {
        boostChronos: updatedStoryline.boostChronos,
        boostTier: updatedStoryline.boostTier
      },
      user: {
        chronos: updatedUser.chronos
      }
    })
    
  } catch (error) {
    console.error('Boost storyline error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
