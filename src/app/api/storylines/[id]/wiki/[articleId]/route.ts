import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// GET - Get a single wiki article by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; articleId: string }> }
) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { id, articleId } = await params

    // Verify membership
    const membership = await db.storylineMember.findFirst({
      where: { storylineId: id, userId: user.id }
    })

    if (!membership) {
      return NextResponse.json({ error: 'Not a member' }, { status: 403 })
    }

    const article = await db.wikiArticle.findFirst({
      where: { id: articleId, storylineId: id },
      include: {
        createdBy: {
          select: { id: true, username: true, avatarUrl: true }
        },
        lastEditedByUser: {
          select: { id: true, username: true, avatarUrl: true }
        }
      }
    })

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, article })

  } catch (error) {
    console.error('Get wiki article error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// PATCH - Update a wiki article
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; articleId: string }> }
) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { id, articleId } = await params
    const body = await request.json()
    const { title, content, category, isPinned } = body

    // Verify membership + permissions
    const membership = await db.storylineMember.findFirst({
      where: { storylineId: id, userId: user.id },
      include: {
        customRole: {
          select: { canManageMessages: true }
        }
      }
    })

    if (!membership) {
      return NextResponse.json({ error: 'Not a member' }, { status: 403 })
    }

    const canManage = membership.role === 'owner' ||
      membership.role === 'admin' ||
      membership.customRole?.canManageMessages

    if (!canManage) {
      return NextResponse.json({ error: 'Not authorized to edit wiki articles' }, { status: 403 })
    }

    // Check article exists and belongs to this storyline
    const existing = await db.wikiArticle.findFirst({
      where: { id: articleId, storylineId: id }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {
      lastEditedBy: user.id
    }

    if (title !== undefined) {
      if (!title.trim()) {
        return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
      }
      updateData.title = title.trim()
      // Regenerate slug if title changed
      const baseSlug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')

      let slug = baseSlug
      let suffix = 1
      while (
        await db.wikiArticle.findFirst({
          where: {
            storylineId: id,
            slug,
            id: { not: articleId }
          }
        })
      ) {
        slug = `${baseSlug}-${suffix}`
        suffix++
      }
      updateData.slug = slug
    }

    if (content !== undefined) {
      updateData.content = content
    }

    if (category !== undefined) {
      const validCategories = ['General', 'Locations', 'Characters', 'Factions', 'Magic & Systems', 'History', 'Culture', 'Other']
      updateData.category = validCategories.includes(category) ? category : 'General'
    }

    if (isPinned !== undefined) {
      updateData.isPinned = isPinned
    }

    const article = await db.wikiArticle.update({
      where: { id: articleId },
      data: updateData,
      include: {
        createdBy: {
          select: { id: true, username: true, avatarUrl: true }
        },
        lastEditedByUser: {
          select: { id: true, username: true, avatarUrl: true }
        }
      }
    })

    return NextResponse.json({ success: true, article })

  } catch (error) {
    console.error('Update wiki article error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// DELETE - Delete a wiki article (owner/admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; articleId: string }> }
) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { id, articleId } = await params

    // Verify membership + permissions (owner/admin only for delete)
    const membership = await db.storylineMember.findFirst({
      where: { storylineId: id, userId: user.id },
      include: {
        customRole: {
          select: { canManageMessages: true }
        }
      }
    })

    if (!membership) {
      return NextResponse.json({ error: 'Not a member' }, { status: 403 })
    }

    const canDelete = membership.role === 'owner' || membership.role === 'admin'

    if (!canDelete) {
      return NextResponse.json({ error: 'Only owners and admins can delete wiki articles' }, { status: 403 })
    }

    // Check article exists and belongs to this storyline
    const existing = await db.wikiArticle.findFirst({
      where: { id: articleId, storylineId: id }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    await db.wikiArticle.delete({
      where: { id: articleId }
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Delete wiki article error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
