import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { ACHIEVEMENT_DEFINITIONS } from '@/lib/achievements'

// POST /api/achievements/seed — Seeds all default achievement definitions
export async function POST() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins can seed
    if (session.role !== 'admin' && session.role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
    }

    // Upsert each achievement definition
    let created = 0
    let updated = 0

    for (const def of ACHIEVEMENT_DEFINITIONS) {
      const existing = await db.achievement.findUnique({
        where: { key: def.key },
      })

      if (existing) {
        // Update existing definition (preserve isActive state)
        await db.achievement.update({
          where: { key: def.key },
          data: {
            name: def.name,
            description: def.description,
            icon: def.icon,
            category: def.category,
            tier: def.tier,
            requirement: def.requirement,
            isHidden: def.isHidden,
          },
        })
        updated++
      } else {
        // Create new definition
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
        created++
      }
    }

    return NextResponse.json({
      success: true,
      message: `Achievements seeded: ${created} created, ${updated} updated`,
      created,
      updated,
      total: ACHIEVEMENT_DEFINITIONS.length,
    })
  } catch (error) {
    console.error('[Achievements/Seed] POST error:', error)
    return NextResponse.json({ error: 'Failed to seed achievements' }, { status: 500 })
  }
}
