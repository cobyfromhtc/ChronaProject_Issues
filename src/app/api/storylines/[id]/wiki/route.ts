import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// GET - List all wiki articles for a storyline (grouped by category)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { id } = await params

    // Verify membership
    const membership = await db.storylineMember.findFirst({
      where: { storylineId: id, userId: user.id }
    })

    if (!membership) {
      return NextResponse.json({ error: 'Not a member' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim()

    // Build where clause
    const where: Record<string, unknown> = { storylineId: id }
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { content: { contains: search } }
      ]
    }

    const articles = await db.wikiArticle.findMany({
      where,
      include: {
        createdBy: {
          select: { id: true, username: true, avatarUrl: true }
        },
        lastEditedByUser: {
          select: { id: true, username: true, avatarUrl: true }
        }
      },
      orderBy: [
        { isPinned: 'desc' },
        { position: 'asc' },
        { title: 'asc' }
      ]
    })

    // Group by category
    const grouped: Record<string, typeof articles> = {}
    const pinnedArticles = articles.filter(a => a.isPinned)

    for (const article of articles) {
      const cat = article.category || 'General'
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push(article)
    }

    return NextResponse.json({
      success: true,
      articles,
      grouped,
      pinnedArticles
    })

  } catch (error) {
    console.error('Get wiki articles error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// POST - Create a new wiki article
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { title, content, category, isPinned } = body

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

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
      return NextResponse.json({ error: 'Not authorized to create wiki articles' }, { status: 403 })
    }

    // Auto-generate slug from title
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    // Ensure slug is unique within storyline
    let slug = baseSlug
    let suffix = 1
    while (await db.wikiArticle.findUnique({ where: { storylineId_slug: { storylineId: id, slug } } })) {
      slug = `${baseSlug}-${suffix}`
      suffix++
    }

    // Get max position
    const maxPosition = await db.wikiArticle.findFirst({
      where: { storylineId: id },
      orderBy: { position: 'desc' },
      select: { position: true }
    })

    const validCategories = ['General', 'Locations', 'Characters', 'Factions', 'Magic & Systems', 'History', 'Culture', 'Other']
    const articleCategory = validCategories.includes(category) ? category : 'General'

    const article = await db.wikiArticle.create({
      data: {
        storylineId: id,
        title: title.trim(),
        slug,
        content: content || '',
        category: articleCategory,
        createdById: user.id,
        isPinned: isPinned || false,
        position: (maxPosition?.position ?? -1) + 1
      },
      include: {
        createdBy: {
          select: { id: true, username: true, avatarUrl: true }
        }
      }
    })

    return NextResponse.json({ success: true, article })

  } catch (error) {
    console.error('Create wiki article error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
