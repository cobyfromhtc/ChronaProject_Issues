import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

// Constants for Chronos pricing
export const PRICING = {
  PERSONA_SLOT: 200,        // Extra persona slot
  STORYLINE: 500,           // Create a storyline
  EXTRA_IMAGE: 2,           // Send an extra image beyond daily cap
  NAME_COLOR: 300,          // Global name color
  PROFILE_THEME_MIN: 100,   // Minimum theme price
  PROFILE_THEME_MAX: 600,   // Maximum theme price
  DAILY_LOGIN: 10,          // Daily login bonus
  WEEKLY_STREAK: 50,        // Weekly streak bonus
  FIRST_PURCHASE_BONUS_MULTIPLIER: 2,  // Double value for first purchase
}

// POST - Purchase items with Chronos
export async function POST(request: Request) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, data } = body

    // Get current user data
    const userData = await db.user.findUnique({
      where: { id: user.id },
      select: {
        chronos: true,
        purchasedSlots: true,
        nameColor: true,
        dailyImagesUsed: true,
        dailyImagesResetAt: true,
        hasFirstPurchaseBonus: true,
      }
    })

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    let cost = 0
    let description = ''
    let category = ''
    let referenceId: string | undefined

    switch (action) {
      case 'buy_slot': {
        // Purchase an extra persona slot
        cost = PRICING.PERSONA_SLOT
        description = 'Purchased extra persona slot'
        category = 'slot'
        break
      }

      case 'create_storyline': {
        // Create a storyline
        cost = PRICING.STORYLINE
        description = 'Created a new storyline'
        category = 'storyline'
        break
      }

      case 'extra_image': {
        // Send an extra image beyond daily cap
        cost = PRICING.EXTRA_IMAGE
        description = 'Sent extra image beyond daily cap'
        category = 'extra_image'
        break
      }

      case 'buy_name_color': {
        // Purchase a name color
        const { color } = data
        if (!color || !/^#[0-9A-Fa-f]{6}$/.test(color)) {
          return NextResponse.json({ error: 'Invalid color format' }, { status: 400 })
        }
        cost = PRICING.NAME_COLOR
        description = `Purchased name color: ${color}`
        category = 'name_color'
        referenceId = color
        break
      }

      case 'buy_theme': {
        // Purchase a profile theme
        const { themeId } = data
        if (!themeId) {
          return NextResponse.json({ error: 'Theme ID required' }, { status: 400 })
        }

        const theme = await db.profileTheme.findUnique({
          where: { id: themeId }
        })

        if (!theme || !theme.isActive) {
          return NextResponse.json({ error: 'Theme not found or unavailable' }, { status: 404 })
        }

        // Check if already owned
        if (theme.ownerId === user.id) {
          return NextResponse.json({ error: 'You already own this theme' }, { status: 400 })
        }

        cost = theme.price
        description = `Purchased profile theme: ${theme.name}`
        category = 'theme'
        referenceId = themeId
        break
      }

      case 'earn_daily': {
        // Daily login bonus
        cost = -PRICING.DAILY_LOGIN // Negative because it's earning
        description = 'Daily login bonus'
        category = 'daily_login'
        break
      }

      case 'earn_streak': {
        // Weekly streak bonus
        cost = -PRICING.WEEKLY_STREAK // Negative because it's earning
        description = 'Weekly streak bonus'
        category = 'streak_bonus'
        break
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Calculate bonus for first purchase
    let bonusAmount = 0
    const isFirstPurchase = cost > 0 && !userData.hasFirstPurchaseBonus

    // For the first purchase, give them back the same amount as bonus (effectively double value)
    if (isFirstPurchase) {
      bonusAmount = cost
    }

    // Check if user has enough chronos (for purchases)
    if (cost > 0 && userData.chronos < cost) {
      return NextResponse.json({ 
        error: 'Insufficient Chronos',
        required: cost,
        current: userData.chronos 
      }, { status: 400 })
    }

    // Calculate new balance
    const newBalance = userData.chronos - cost + bonusAmount

    // Perform the transaction
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        chronos: newBalance,
        hasFirstPurchaseBonus: isFirstPurchase ? true : userData.hasFirstPurchaseBonus,
        // Update specific fields based on action
        ...(action === 'buy_slot' && { purchasedSlots: { increment: 1 } }),
        ...(action === 'buy_name_color' && { nameColor: referenceId }),
        ...(action === 'extra_image' && { dailyImagesUsed: { increment: 1 } }),
      }
    })

    // If buying a theme, update ownership
    if (action === 'buy_theme' && referenceId) {
      await db.profileTheme.update({
        where: { id: referenceId },
        data: { ownerId: user.id }
      })
    }

    // Record the transaction
    await db.chronosTransaction.create({
      data: {
        userId: user.id,
        amount: -cost + bonusAmount,
        balance: newBalance,
        type: cost > 0 ? 'spend' : 'earn',
        category,
        description,
        referenceId,
      }
    })

    return NextResponse.json({
      success: true,
      chronos: updatedUser.chronos,
      bonusReceived: bonusAmount,
      isFirstPurchase,
      message: isFirstPurchase 
        ? `🎉 First purchase bonus! You received ${bonusAmount} Chronos back!`
        : undefined
    })
  } catch (error) {
    console.error('Error processing chronos transaction:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
