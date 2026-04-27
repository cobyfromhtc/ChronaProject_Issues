import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

// GET - Get available profile themes
export async function GET() {
  try {
    const user = await getSession()
    
    // Get all active themes
    const themes = await db.profileTheme.findMany({
      where: {
        isActive: true,
        OR: [
          { isSystem: true },          // System themes available to all
          { ownerId: user?.id },       // User's custom themes
        ]
      },
      orderBy: [
        { isSystem: 'desc' },          // System themes first
        { price: 'asc' },              // Then by price
      ]
    })

    return NextResponse.json({ themes })
  } catch (error) {
    console.error('Error fetching themes:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create a custom theme (for future use)
export async function POST(request: Request) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, background, borderColor, textColor, accentColor, backgroundImage } = body

    if (!name) {
      return NextResponse.json({ error: 'Theme name required' }, { status: 400 })
    }

    // Create a custom theme for the user
    const theme = await db.profileTheme.create({
      data: {
        name,
        description,
        background,
        borderColor,
        textColor,
        accentColor,
        backgroundImage,
        price: 0, // Custom themes don't have a price (already owned)
        isSystem: false,
        isActive: true,
        ownerId: user.id,
      }
    })

    return NextResponse.json({ theme })
  } catch (error) {
    console.error('Error creating theme:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
