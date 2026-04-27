import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

/**
 * GET /api/storylines/[id]/reviews
 * Fetch reviews for a storyline
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const storyline = await db.storyline.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!storyline) {
      return NextResponse.json({ error: 'Storyline not found' }, { status: 404 })
    }

    const reviews = await db.storylineReview.findMany({
      where: { storylineId: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Calculate average rating
    const avgRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0

    return NextResponse.json({
      reviews,
      reviewCount: reviews.length,
      averageRating: Math.round(avgRating * 10) / 10,
    })
  } catch (error) {
    console.error('[StorylineReviews] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 })
  }
}

/**
 * POST /api/storylines/[id]/reviews
 * Submit a review for a storyline
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { rating, content } = body

    // Validate
    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 })
    }
    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Review content is required' }, { status: 400 })
    }
    if (content.length > 1000) {
      return NextResponse.json({ error: 'Review content must be under 1000 characters' }, { status: 400 })
    }

    // Check storyline exists
    const storyline = await db.storyline.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!storyline) {
      return NextResponse.json({ error: 'Storyline not found' }, { status: 404 })
    }

    // Check if user is a member
    const membership = await db.storylineMember.findUnique({
      where: { storylineId_userId: { storylineId: id, userId: session.id } },
    })

    if (!membership) {
      return NextResponse.json({ error: 'You must be a member to review this storyline' }, { status: 403 })
    }

    // Upsert review (one review per user per storyline)
    const review = await db.storylineReview.upsert({
      where: {
        storylineId_userId: { storylineId: id, userId: session.id },
      },
      update: {
        rating,
        content: content.trim(),
      },
      create: {
        storylineId: id,
        userId: session.id,
        rating,
        content: content.trim(),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    })

    return NextResponse.json(review, { status: 201 })
  } catch (error) {
    console.error('[StorylineReviews] POST error:', error)
    return NextResponse.json({ error: 'Failed to submit review' }, { status: 500 })
  }
}
