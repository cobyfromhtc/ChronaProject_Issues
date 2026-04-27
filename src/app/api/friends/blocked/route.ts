import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// GET - Get list of blocked users
export async function GET() {
  try {
    const user = await getSession()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    const blocked = await db.block.findMany({
      where: { blockerId: user.id },
      include: {
        blocked: {
          select: {
            id: true,
            username: true,
            avatarUrl: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    
    const blockedUsers = blocked.map(b => ({
      id: b.id,
      blockedAt: b.createdAt,
      user: b.blocked
    }))
    
    return NextResponse.json({ success: true, blocked: blockedUsers })
    
  } catch (error) {
    console.error('Get blocked users error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
