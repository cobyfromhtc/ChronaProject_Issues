import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// Get user profile with stats
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
        id: true,
        email: true,
        username: true,
        avatarUrl: true,
        bio: true,
        bannerUrl: true,
        status: true,
        pronouns: true,
        location: true,
        socialLinks: true,
        role: true,
        chronos: true,
        isOfficial: true,
        createdAt: true,
        contentMaturity: true,
        theme: true,
        febBoxToken: true,
        _count: {
          select: { personas: true }
        }
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
      profile: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        bannerUrl: user.bannerUrl,
        status: user.status,
        pronouns: user.pronouns,
        location: user.location,
        socialLinks: user.socialLinks,
        role: user.role,
        chronos: user.chronos,
        isOfficial: user.isOfficial,
        createdAt: user.createdAt,
        totalPersonas: user._count.personas,
        contentMaturity: user.contentMaturity,
        theme: user.theme,
        febBoxToken: user.febBoxToken,
      }
    })
  } catch (error) {
    console.error('Get profile error:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}

// Update user profile (bio, avatarUrl)
export async function PATCH(request: Request) {
  try {
    const sessionUser = await getSession()

    if (!sessionUser) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { bio, avatarUrl, bannerUrl, status, pronouns, location, socialLinks, contentMaturity, theme, febBoxToken } = body

    const updateData: Record<string, unknown> = {}

    if (bio !== undefined) {
      if (typeof bio !== 'string') {
        return NextResponse.json(
          { error: 'Bio must be a string' },
          { status: 400 }
        )
      }
      if (bio.length > 200) {
        return NextResponse.json(
          { error: 'Bio must be 200 characters or less' },
          { status: 400 }
        )
      }
      updateData.bio = bio.trim() || null
    }

    if (avatarUrl !== undefined) {
      updateData.avatarUrl = avatarUrl || null
    }

    if (bannerUrl !== undefined) {
      updateData.bannerUrl = bannerUrl || null
    }

    if (status !== undefined) {
      if (typeof status !== 'string') {
        return NextResponse.json(
          { error: 'Status must be a string' },
          { status: 400 }
        )
      }
      if (status.length > 60) {
        return NextResponse.json(
          { error: 'Status must be 60 characters or less' },
          { status: 400 }
        )
      }
      updateData.status = status.trim() || null
    }

    if (pronouns !== undefined) {
      if (typeof pronouns !== 'string') {
        return NextResponse.json(
          { error: 'Pronouns must be a string' },
          { status: 400 }
        )
      }
      updateData.pronouns = pronouns.trim() || null
    }

    if (location !== undefined) {
      if (typeof location !== 'string') {
        return NextResponse.json(
          { error: 'Location must be a string' },
          { status: 400 }
        )
      }
      updateData.location = location.trim() || null
    }

    if (socialLinks !== undefined) {
      if (typeof socialLinks !== 'string') {
        return NextResponse.json(
          { error: 'Social links must be a JSON string' },
          { status: 400 }
        )
      }
      // Validate it's valid JSON
      try {
        if (socialLinks) {
          JSON.parse(socialLinks)
        }
      } catch {
        return NextResponse.json(
          { error: 'Invalid social links format' },
          { status: 400 }
        )
      }
      updateData.socialLinks = socialLinks || null
    }

    if (contentMaturity !== undefined) {
      if (!['safe', 'mature', 'unrestricted'].includes(contentMaturity)) {
        return NextResponse.json(
          { error: 'Invalid content maturity level' },
          { status: 400 }
        )
      }
      updateData.contentMaturity = contentMaturity
    }

    if (theme !== undefined) {
      if (!['dark', 'light', 'midnight', 'forest'].includes(theme)) {
        return NextResponse.json(
          { error: 'Invalid theme' },
          { status: 400 }
        )
      }
      updateData.theme = theme
    }

    if (febBoxToken !== undefined) {
      updateData.febBoxToken = febBoxToken || null
    }

    const updatedUser = await db.user.update({
      where: { id: sessionUser.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        username: true,
        avatarUrl: true,
        bio: true,
        bannerUrl: true,
        status: true,
        pronouns: true,
        location: true,
        socialLinks: true,
        role: true,
        chronos: true,
        isOfficial: true,
        createdAt: true,
        contentMaturity: true,
        theme: true,
        febBoxToken: true,
      }
    })

    return NextResponse.json({
      success: true,
      user: updatedUser
    })
  } catch (error) {
    console.error('Update profile error:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
