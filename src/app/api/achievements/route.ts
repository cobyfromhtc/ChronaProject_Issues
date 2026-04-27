import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { checkAndAwardAchievements } from '@/lib/achievements'

// GET /api/achievements — Returns all achievements + user's earned achievements
export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all active achievements
    const achievements = await db.achievement.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { tier: 'asc' }, { requirement: 'asc' }],
    })

    // Get user's achievement progress
    const userAchievements = await db.userAchievement.findMany({
      where: { userId: session.id },
      include: { achievement: true },
    })

    // Map user achievement data
    const userAchievementMap = new Map(
      userAchievements.map((ua) => [ua.achievementId, ua])
    )

    // Combine data
    const combined = achievements.map((achievement) => {
      const userAch = userAchievementMap.get(achievement.id)

      // If the achievement is hidden and not yet completed, mask it
      if (achievement.isHidden && (!userAch || !userAch.completed)) {
        return {
          ...achievement,
          userProgress: 0,
          userCompleted: false,
          userCompletedAt: null,
          isSecret: true, // tell frontend this is a secret achievement
        }
      }

      return {
        ...achievement,
        userProgress: userAch?.progress ?? 0,
        userCompleted: userAch?.completed ?? false,
        userCompletedAt: userAch?.completedAt ?? null,
        isSecret: false,
      }
    })

    // Calculate stats
    const totalAchievements = achievements.length
    const completedCount = userAchievements.filter((ua) => ua.completed).length

    return NextResponse.json({
      achievements: combined,
      stats: {
        total: totalAchievements,
        completed: completedCount,
      },
    })
  } catch (error) {
    console.error('[Achievements] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch achievements' }, { status: 500 })
  }
}

// POST /api/achievements — Seeds if none exist, then checks/awards for the user
export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const category = body.category as string | undefined

    // Auto-seed if no achievements exist
    const existingCount = await db.achievement.count()
    if (existingCount === 0) {
      // Import definitions and seed
      const { ACHIEVEMENT_DEFINITIONS } = await import('@/lib/achievements')
      for (const def of ACHIEVEMENT_DEFINITIONS) {
        await db.achievement.create({
          data: {
            key: def.key,
            name: def.name,
            description: def.description,
            icon: def.icon,
            category: def.category,
            tier: def.tier,
            requirement: def.requirement,
            isHidden: def.isHidden,
            isActive: true,
          },
        })
      }
    }

    // If a category is specified, check and award achievements
    let newlyEarned: string[] = []
    if (category) {
      const validCategories = ['social', 'creative', 'storytelling', 'storylines', 'economy', 'special']
      if (!validCategories.includes(category)) {
        return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
      }
      newlyEarned = await checkAndAwardAchievements(session.id, category, db)
    } else {
      // Check all categories
      const categories = ['social', 'creative', 'storytelling', 'storylines', 'economy', 'special']
      for (const cat of categories) {
        const earned = await checkAndAwardAchievements(session.id, cat, db)
        newlyEarned.push(...earned)
      }
    }

    return NextResponse.json({
      success: true,
      newlyEarned,
      count: newlyEarned.length,
    })
  } catch (error) {
    console.error('[Achievements] POST error:', error)
    return NextResponse.json({ error: 'Failed to check achievements' }, { status: 500 })
  }
}
