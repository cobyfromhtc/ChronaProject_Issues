import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { isMinor, sanitizeContentMaturity } from '@/lib/age-utils'

// GET - Fetch user preferences
export async function GET() {
  try {
    const sessionUser = await getSession()

    if (!sessionUser) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const user = await db.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        contentMaturity: true,
        theme: true,
        febBoxToken: true,
        navigationMode: true,
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      preferences: {
        contentMaturity: user.contentMaturity,
        theme: user.theme,
        febBoxToken: user.febBoxToken,
        navigationMode: user.navigationMode,
      }
    })
  } catch (error) {
    console.error('Get preferences error:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}

// PATCH - Update user preferences
export async function PATCH(request: NextRequest) {
  try {
    const sessionUser = await getSession()

    if (!sessionUser) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { contentMaturity, theme, febBoxToken, navigationMode } = body

    const updateData: Record<string, unknown> = {}

    if (contentMaturity !== undefined) {
      if (!['safe', 'mature', 'unrestricted'].includes(contentMaturity)) {
        return NextResponse.json(
          { error: 'Invalid content maturity level. Use: safe, mature, or unrestricted' },
          { status: 400 }
        )
      }
      // Age-gating: Fetch user's DOB and sanitize content maturity for minors
      const dbUser = await db.user.findUnique({
        where: { id: sessionUser.id },
        select: { dateOfBirth: true }
      })
      const userDob = dbUser?.dateOfBirth ?? null
      updateData.contentMaturity = sanitizeContentMaturity(userDob, contentMaturity)
    }

    if (theme !== undefined) {
      if (!['dark', 'light', 'midnight', 'forest'].includes(theme)) {
        return NextResponse.json(
          { error: 'Invalid theme. Use: dark, light, midnight, or forest' },
          { status: 400 }
        )
      }
      updateData.theme = theme
    }

    if (febBoxToken !== undefined) {
      updateData.febBoxToken = febBoxToken || null
    }

    if (navigationMode !== undefined) {
      if (!['static', 'linear'].includes(navigationMode)) {
        return NextResponse.json(
          { error: 'Invalid navigation mode. Use: static or linear' },
          { status: 400 }
        )
      }
      updateData.navigationMode = navigationMode
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid preferences to update' },
        { status: 400 }
      )
    }

    const updatedUser = await db.user.update({
      where: { id: sessionUser.id },
      data: updateData,
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        contentMaturity: true,
        theme: true,
        febBoxToken: true,
        navigationMode: true,
      }
    })

    return NextResponse.json({
      success: true,
      preferences: {
        contentMaturity: updatedUser.contentMaturity,
        theme: updatedUser.theme,
        febBoxToken: updatedUser.febBoxToken,
        navigationMode: updatedUser.navigationMode,
      }
    })
  } catch (error) {
    console.error('Update preferences error:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
